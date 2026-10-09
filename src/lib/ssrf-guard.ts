import { lookup as dnsLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * SSRF guard: URL parsing and IP classification for the headers scanner.
 *
 * Policy (docs/THREAT-MODEL.md, abuse case A1):
 * - http/https only, no credentials, default ports only (the WHATWG parser
 *   elides :80 on http and :443 on https, so any surviving explicit port is
 *   non-default and refused).
 * - A hostname may only be contacted if EVERY resolved A/AAAA record is a
 *   public unicast address per ipaddr.js. One bad record refuses the lot.
 * - IPv4-mapped IPv6 is never allowed, even when the inner IPv4 is public:
 *   mapped literals exist here only as a smuggling vector.
 * - Everything fails closed: unparseable input, resolution failure and empty
 *   answers are all refusals, never passes.
 */

export type Refusal = { ok: false; reason: string };

const MAX_URL_LENGTH = 2048;
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function parseTargetUrl(
  input: string,
  opts: { base?: URL } = {}
): { ok: true; url: URL } | Refusal {
  const raw = (input ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "Please enter a URL to scan." };
  }
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, reason: "URL is too long (max 2048 characters)." };
  }

  let candidate = raw;
  if (!opts.base && !SCHEME_RE.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = opts.base ? new URL(candidate, opts.base) : new URL(candidate);
  } catch {
    return { ok: false, reason: "That does not parse as a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      reason: `Scheme "${url.protocol.slice(0, -1)}" is not supported. Only http and https are scanned.`,
    };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }
  if (url.port !== "") {
    return {
      ok: false,
      reason: `Port ${url.port} is not allowed. Only the default ports 80 and 443 are scanned.`,
    };
  }

  return { ok: true, url };
}

export function classifyAddress(ip: string): { allowed: boolean; range: string } {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return { allowed: false, range: "unparseable" };
  }

  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      // Never allowed, regardless of the inner address; record the inner
      // range for diagnostics.
      const inner = v6.toIPv4Address().range();
      return { allowed: false, range: `ipv4Mapped(${inner})` };
    }
  }

  const range = addr.range();
  return { allowed: range === "unicast", range };
}

export type ResolvedAddress = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const defaultResolver: Resolver = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/** Returns the bare IP when the hostname is an IP literal, else null. */
export function ipLiteralOf(hostname: string): string | null {
  const bare =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  return ipaddr.isValid(bare) ? bare : null;
}

export async function resolveAllowedAddresses(
  hostname: string,
  resolver: Resolver = defaultResolver
): Promise<{ ok: true; addresses: string[] } | Refusal> {
  const literal = ipLiteralOf(hostname);
  if (literal !== null) {
    const { allowed, range } = classifyAddress(literal);
    return allowed
      ? { ok: true, addresses: [literal] }
      : {
          ok: false,
          reason: `Scanning addresses in the "${range}" range is not allowed.`,
        };
  }

  let results: ResolvedAddress[];
  try {
    results = await resolver(hostname);
  } catch {
    return { ok: false, reason: "Could not resolve the domain. Please check the URL." };
  }
  if (!results || results.length === 0) {
    return { ok: false, reason: "Could not resolve the domain. Please check the URL." };
  }

  for (const r of results) {
    const { allowed, range } = classifyAddress(r.address);
    if (!allowed) {
      return {
        ok: false,
        reason: `This hostname resolves to a non-public address (${range}). Refusing to scan.`,
      };
    }
  }

  return { ok: true, addresses: results.map((r) => r.address) };
}
