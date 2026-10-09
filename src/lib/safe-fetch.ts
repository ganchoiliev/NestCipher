import { Agent, request as undiciRequest } from "undici";
import { lookup as nodeLookup } from "node:dns";
import {
  classifyAddress,
  defaultResolver,
  parseTargetUrl,
  resolveAllowedAddresses,
  type Resolver,
} from "./ssrf-guard";

/**
 * Pinned-connect fetch for the headers scanner.
 *
 * Why undici directly: Next.js patches the global server `fetch` for its own
 * caching semantics (see node_modules/next/dist/docs/01-app/03-api-reference/
 * 04-functions/fetch.md) and documents no `dispatcher` passthrough. Calling
 * `undici.request` with our own Agent guarantees the connection goes through
 * `connect.lookup` below — proven by test, not assumed.
 *
 * DNS rebinding defence: `createGuardedLookup` runs INSIDE the socket connect
 * path, so the addresses actually dialled are classified at connect time. A
 * record that changes between pre-check and connect is re-filtered; if nothing
 * public unicast remains, the connect fails with EBLOCKED. IP-literal hosts
 * never reach `lookup`, so every hop is also literal-checked up front in
 * `fetchHeadersSafely`.
 */

type RawLookup = typeof nodeLookup;

export const SSRF_BLOCKED_CODE = "EBLOCKED";

export function createGuardedLookup(rawLookup: RawLookup = nodeLookup) {
  return function guardedLookup(
    hostname: string,
    options: { all?: boolean } | undefined,
    callback: (
      err: NodeJS.ErrnoException | null,
      address?: unknown,
      family?: number
    ) => void
  ): void {
    rawLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = (addresses as { address: string; family: number }[]).filter(
        (a) => classifyAddress(a.address).allowed
      );
      if (list.length === 0) {
        const e: NodeJS.ErrnoException = new Error(
          `SSRF guard: "${hostname}" does not resolve to a public unicast address`
        );
        e.code = SSRF_BLOCKED_CODE;
        return callback(e);
      }
      if (options?.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

export const guardedAgent = new Agent({
  connect: { lookup: createGuardedLookup() as never, timeout: 5_000 },
});

// ── Hop loop ──

const MAX_REDIRECT_HOPS = 5;
const TOTAL_BUDGET_MS = 8_000;

export interface HopResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  destroy(): void;
}

export type DoRequest = (
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
) => Promise<HopResponse>;

async function defaultDoRequest(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<HopResponse> {
  const res = await undiciRequest(url, {
    method,
    dispatcher: guardedAgent,
    signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    headers: { "user-agent": "NestCipher-Scanner/2.0 (+https://nestcipher.com)" },
  });
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    destroy: () => {
      try {
        res.body.destroy();
      } catch {
        /* already closed */
      }
    },
  };
}

export type SafeFetchResult = {
  ok: true;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  finalUrl: string;
  hops: number;
};

export type SafeFetchError = {
  ok: false;
  kind: "blocked" | "timeout" | "too_many_redirects" | "network";
  reason: string;
};

function mapNetworkError(e: unknown): SafeFetchError {
  const err = e as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
  const code = err?.code ?? err?.cause?.code;
  const name = err?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") {
    return {
      ok: false,
      kind: "timeout",
      reason: "The website took too long to respond.",
    };
  }
  if (
    code === SSRF_BLOCKED_CODE ||
    String(err?.message).includes("SSRF guard") ||
    String(err?.cause?.message ?? "").includes("SSRF guard")
  ) {
    return {
      ok: false,
      kind: "blocked",
      reason: "This hostname resolves to a non-public address. Refusing to scan.",
    };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      ok: false,
      kind: "network",
      reason: "Could not resolve the domain. Please check the URL.",
    };
  }
  return {
    ok: false,
    kind: "network",
    reason: "Could not reach the website. It may be down or blocking automated requests.",
  };
}

export interface SafeFetchDeps {
  resolver?: Resolver;
  doRequest?: DoRequest;
  budgetMs?: number;
}

export async function fetchHeadersSafely(
  rawUrl: string,
  deps: SafeFetchDeps = {}
): Promise<SafeFetchResult | SafeFetchError> {
  const resolver = deps.resolver ?? defaultResolver;
  const doRequest = deps.doRequest ?? defaultDoRequest;
  const deadline = Date.now() + (deps.budgetMs ?? TOTAL_BUDGET_MS);

  const first = parseTargetUrl(rawUrl);
  if (!first.ok) return { ok: false, kind: "blocked", reason: first.reason };
  let url = first.url;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    // Advisory pre-check (friendly refusals + literal hosts, which bypass
    // connect-time lookup). The guarded lookup remains the authority.
    const pre = await resolveAllowedAddresses(url.hostname, resolver);
    if (!pre.ok) return { ok: false, kind: "blocked", reason: pre.reason };

    let remaining = deadline - Date.now();
    if (remaining <= 0) {
      return { ok: false, kind: "timeout", reason: "The scan timed out." };
    }

    let res: HopResponse;
    try {
      res = await doRequest(url.href, "HEAD", remaining);
      if (res.statusCode === 405 || res.statusCode === 501) {
        res.destroy();
        remaining = deadline - Date.now();
        if (remaining <= 0) {
          return { ok: false, kind: "timeout", reason: "The scan timed out." };
        }
        res = await doRequest(url.href, "GET", remaining);
      }
    } catch (headErr) {
      const mapped = mapNetworkError(headErr);
      if (mapped.kind !== "network") return mapped;
      // Some servers drop HEAD entirely; one GET retry within budget.
      remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { ok: false, kind: "timeout", reason: "The scan timed out." };
      }
      try {
        res = await doRequest(url.href, "GET", remaining);
      } catch (getErr) {
        return mapNetworkError(getErr);
      }
    }

    const { statusCode, headers } = res;
    const location = headers["location"];

    if (statusCode >= 300 && statusCode < 400 && location !== undefined) {
      res.destroy();
      if (hop === MAX_REDIRECT_HOPS) {
        return {
          ok: false,
          kind: "too_many_redirects",
          reason: `Gave up after ${MAX_REDIRECT_HOPS} redirects.`,
        };
      }
      const loc = Array.isArray(location) ? location[0] : location;
      const next = parseTargetUrl(String(loc), { base: url });
      if (!next.ok) {
        return {
          ok: false,
          kind: "blocked",
          reason: `Refused to follow a redirect: ${next.reason}`,
        };
      }
      url = next.url;
      continue;
    }

    res.destroy(); // headers are all we need; never read the body
    return { ok: true, status: statusCode, headers, finalUrl: url.href, hops: hop };
  }

  return {
    ok: false,
    kind: "too_many_redirects",
    reason: `Gave up after ${MAX_REDIRECT_HOPS} redirects.`,
  };
}
