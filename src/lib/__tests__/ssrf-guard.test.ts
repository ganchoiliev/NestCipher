import { describe, expect, it } from "vitest";
import {
  classifyAddress,
  parseTargetUrl,
  resolveAllowedAddresses,
  type Resolver,
} from "../ssrf-guard";

/**
 * The hostile-input table. Every row here must be REFUSED.
 * Three stages, matching the guard's layers:
 *   1. parse-level refusals (scheme, port, credentials, garbage)
 *   2. literal/normalised addresses (the WHATWG parser canonicalises
 *      decimal/octal/hex IPv4, so we assert on the parsed hostname)
 *   3. DNS-resolved addresses (resolver mocked — no network in tests)
 */

// ── Stage 1: refused at parse time ──
const PARSE_REFUSED: string[] = [
  "",
  "   ",
  "ftp://example.com/",
  "file:///etc/passwd",
  "gopher://example.com/_GET",
  "javascript:alert(1)",
  "ws://example.com/",
  "http://user:pass@example.com/",
  "https://:secret@example.com/",
  "example.com:6379", // parses with scheme "example.com" → refused scheme
  "http://example.com:8080/",
  "http://example.com:443/", // non-default port for http
  "https://example.com:8443/",
  "http://[::1]:8080/",
  "http://127.0.0.1:6379/",
];

// ── Stage 2: parses fine, hostname classifies as non-public ──
// [input URL, expected canonical hostname]
const LITERAL_REFUSED: Array<[string, string]> = [
  ["http://127.0.0.1/", "127.0.0.1"],
  ["http://127.255.255.254/", "127.255.255.254"],
  ["http://0.0.0.0/", "0.0.0.0"],
  ["http://10.1.2.3/", "10.1.2.3"],
  ["http://172.16.0.1/", "172.16.0.1"],
  ["http://172.31.255.254/", "172.31.255.254"],
  ["http://192.168.0.1/", "192.168.0.1"],
  ["http://169.254.169.254/latest/meta-data/", "169.254.169.254"],
  ["http://100.64.0.1/", "100.64.0.1"], // CGNAT
  ["http://100.127.255.254/", "100.127.255.254"],
  ["http://224.0.0.251/", "224.0.0.251"], // multicast
  ["http://255.255.255.255/", "255.255.255.255"], // broadcast
  ["http://192.0.2.5/", "192.0.2.5"], // TEST-NET-1, reserved
  ["http://198.18.0.1/", "198.18.0.1"], // benchmarking, reserved
  ["http://240.0.0.1/", "240.0.0.1"], // class E, reserved
  // WHATWG canonicalisation of obfuscated IPv4 forms:
  ["http://2130706433/", "127.0.0.1"], // decimal
  ["http://0x7f000001/", "127.0.0.1"], // hex
  ["http://017700000001/", "127.0.0.1"], // octal
  ["http://127.1/", "127.0.0.1"], // shorthand
  ["http://0/", "0.0.0.0"],
  // IPv6:
  ["http://[::1]/", "::1"],
  ["http://[::]/", "::"],
  ["http://[fd00::1]/", "fd00::1"], // unique-local
  ["http://[fe80::1]/", "fe80::1"], // link-local
  ["http://[ff02::1]/", "ff02::1"], // multicast
  ["http://[::ffff:127.0.0.1]/", "::ffff:7f00:1"], // v4-mapped loopback (WHATWG hex form)
  ["http://[::ffff:10.0.0.5]/", "::ffff:a00:5"], // v4-mapped private (WHATWG hex form)
  ["http://[2001:db8::1]/", "2001:db8::1"], // documentation range
];

// ── Stage 3: public-looking hostnames, hostile resolutions (mocked DNS) ──
const DNS_REFUSED: Array<[string, Array<{ address: string; family: number }>]> = [
  ["127.0.0.1.nip.io", [{ address: "127.0.0.1", family: 4 }]],
  ["169.254.169.254.nip.io", [{ address: "169.254.169.254", family: 4 }]],
  ["internal.corp.example", [{ address: "10.0.0.5", family: 4 }]],
  [
    "dual.example", // one good record does not launder one bad one
    [
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.9", family: 4 },
    ],
  ],
  ["v6-private.example", [{ address: "fd00::1", family: 6 }]],
  ["v6-mapped.example", [{ address: "::ffff:127.0.0.1", family: 6 }]],
  ["empty.example", []],
];

const resolverFor =
  (table: Record<string, Array<{ address: string; family: number }>>): Resolver =>
  async (hostname) => {
    if (hostname in table) return table[hostname];
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  };

describe("parseTargetUrl refusals", () => {
  it.each(PARSE_REFUSED)("refuses %j", (input) => {
    const r = parseTargetUrl(input);
    expect(r.ok).toBe(false);
  });

  it("refuses oversized input", () => {
    expect(parseTargetUrl("https://example.com/" + "a".repeat(2100)).ok).toBe(false);
  });
});

describe("literal / canonicalised address refusals", () => {
  it.each(LITERAL_REFUSED)("refuses %s", async (input, expectedHost) => {
    const parsed = parseTargetUrl(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const host = parsed.url.hostname.replace(/^\[|\]$/g, "");
    expect(host).toBe(expectedHost);

    const resolverThatMustNotRun: Resolver = async () => {
      throw new Error("resolver must not be called for IP literals");
    };
    const r = await resolveAllowedAddresses(parsed.url.hostname, resolverThatMustNotRun);
    expect(r.ok).toBe(false);
  });
});

describe("DNS resolution refusals (mocked)", () => {
  it.each(DNS_REFUSED)("refuses %s", async (hostname, records) => {
    const r = await resolveAllowedAddresses(
      hostname,
      resolverFor({ [hostname]: records })
    );
    expect(r.ok).toBe(false);
  });

  it("refuses when resolution throws", async () => {
    const r = await resolveAllowedAddresses("nxdomain.example", resolverFor({}));
    expect(r.ok).toBe(false);
  });
});

describe("allowed inputs still pass", () => {
  it("allows a public hostname", async () => {
    const r = await resolveAllowedAddresses(
      "example.com",
      resolverFor({ "example.com": [{ address: "93.184.216.34", family: 4 }] })
    );
    expect(r).toEqual({ ok: true, addresses: ["93.184.216.34"] });
  });

  it("allows public IPv4 and IPv6 literals", async () => {
    expect(classifyAddress("8.8.8.8").allowed).toBe(true);
    expect(classifyAddress("2606:4700:4700::1111").allowed).toBe(true);
  });

  it("allows default ports, which the parser elides", () => {
    const r = parseTargetUrl("https://example.com:443/path");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.port).toBe("");
  });

  it("prepends https:// to bare domains", () => {
    const r = parseTargetUrl("example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.href).toBe("https://example.com/");
  });
});

describe("classifyAddress fails closed", () => {
  it("refuses garbage", () => {
    expect(classifyAddress("not-an-ip").allowed).toBe(false);
    expect(classifyAddress("").allowed).toBe(false);
  });

  it("refuses v4-mapped v6 even when the inner address is public", () => {
    const r = classifyAddress("::ffff:93.184.216.34");
    expect(r.allowed).toBe(false);
    expect(r.range).toContain("ipv4Mapped");
  });
});
