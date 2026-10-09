import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Agent, request as undiciRequest } from "undici";
import {
  createGuardedLookup,
  fetchHeadersSafely,
  SSRF_BLOCKED_CODE,
  type DoRequest,
  type HopResponse,
} from "../safe-fetch";
import type { Resolver } from "../ssrf-guard";

const PUBLIC_V4 = "93.184.216.34";

const publicResolver: Resolver = async () => [{ address: PUBLIC_V4, family: 4 }];

function hop(
  statusCode: number,
  headers: Record<string, string | string[]> = {}
): HopResponse {
  return { statusCode, headers, destroy: () => {} };
}

/** Scripted transport: each call shifts the next response; records calls. */
function scriptedTransport(script: Array<HopResponse | Error>) {
  const calls: Array<{ url: string; method: string }> = [];
  const doRequest: DoRequest = async (url, method) => {
    calls.push({ url, method });
    const next = script.shift();
    if (!next) throw new Error("script exhausted");
    if (next instanceof Error) throw next;
    return next;
  };
  return { doRequest, calls };
}

describe("fetchHeadersSafely redirect handling", () => {
  it("refuses a redirect into the metadata service", async () => {
    const { doRequest } = scriptedTransport([
      hop(301, { location: "http://169.254.169.254/latest/meta-data/" }),
    ]);
    const r = await fetchHeadersSafely("https://example.com", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
  });

  it("refuses a redirect to a non-default port", async () => {
    const { doRequest } = scriptedTransport([
      hop(302, { location: "https://example.com:8443/admin" }),
    ]);
    const r = await fetchHeadersSafely("https://example.com", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
  });

  it("re-validates every hop, not just the first", async () => {
    const seen: string[] = [];
    const resolver: Resolver = async (hostname) => {
      seen.push(hostname);
      if (hostname === "inner.corp.example")
        return [{ address: "10.0.0.5", family: 4 }];
      return [{ address: PUBLIC_V4, family: 4 }];
    };
    const { doRequest } = scriptedTransport([
      hop(302, { location: "https://still-public.example/" }),
      hop(302, { location: "https://inner.corp.example/" }),
    ]);
    const r = await fetchHeadersSafely("https://example.com", { resolver, doRequest });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
    expect(seen).toEqual(["example.com", "still-public.example", "inner.corp.example"]);
  });

  it("resolves relative redirects against the current URL", async () => {
    const { doRequest, calls } = scriptedTransport([
      hop(301, { location: "/moved" }),
      hop(200, { "content-security-policy": "default-src 'self'" }),
    ]);
    const r = await fetchHeadersSafely("https://example.com/start", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.finalUrl).toBe("https://example.com/moved");
      expect(r.hops).toBe(1);
    }
    expect(calls.map((c) => c.url)).toEqual([
      "https://example.com/start",
      "https://example.com/moved",
    ]);
  });

  it("gives up after 5 redirect hops", async () => {
    const { doRequest } = scriptedTransport(
      Array.from({ length: 7 }, (_, i) =>
        hop(301, { location: `https://example.com/${i}` })
      )
    );
    const r = await fetchHeadersSafely("https://example.com", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("too_many_redirects");
  });

  it("enforces the total time budget across hops", async () => {
    const doRequest: DoRequest = async (url) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return hop(301, { location: url + "x" });
    };
    const r = await fetchHeadersSafely("https://example.com/", {
      resolver: publicResolver,
      doRequest,
      budgetMs: 40,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("timeout");
  });
});

describe("fetchHeadersSafely method fallback", () => {
  it("falls back from HEAD to GET on 405", async () => {
    const { doRequest, calls } = scriptedTransport([
      hop(405),
      hop(200, { server: "nginx" }),
    ]);
    const r = await fetchHeadersSafely("https://example.com", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
  });

  it("falls back to GET when HEAD throws a network error", async () => {
    const { doRequest, calls } = scriptedTransport([
      Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      hop(200, {}),
    ]);
    const r = await fetchHeadersSafely("https://example.com", {
      resolver: publicResolver,
      doRequest,
    });
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
  });
});

describe("connect-time lookup is the real socket path (undici called directly)", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      res.setHeader("x-pinned", "yes");
      res.statusCode = 200;
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("no port");
    port = addr.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve()))
    );
  });

  it("a custom connect.lookup decides which IP undici dials", async () => {
    // "pinned.test" does not exist in DNS. If this request succeeds, the
    // ONLY way it reached our local server is through the Agent's
    // connect.lookup — proving the dispatcher controls the socket, which is
    // why the scanner calls undici directly instead of Next's patched fetch
    // (whose documented options include no dispatcher passthrough).
    const agent = new Agent({
      connect: {
        lookup: ((hostname: string, options: { all?: boolean }, cb: (
          err: Error | null,
          address?: unknown,
          family?: number
        ) => void) => {
          const rec = { address: "127.0.0.1", family: 4 };
          if (options?.all) return cb(null, [rec]);
          cb(null, rec.address, rec.family);
        }) as never,
      },
    });
    const res = await undiciRequest(`http://pinned.test:${port}/`, {
      dispatcher: agent,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-pinned"]).toBe("yes");
    await res.body.text();
    await agent.close();
  });

  it("the guarded lookup refuses at connect time when DNS answers private", async () => {
    // Simulates rebinding: whatever was pre-checked, the connect-time answer
    // is private — the socket must never open.
    const rawLookup = ((hostname: string, _opts: unknown, cb: (
      err: Error | null,
      addresses?: unknown
    ) => void) => {
      cb(null, [{ address: "10.0.0.5", family: 4 }]);
    }) as never;
    const agent = new Agent({
      connect: { lookup: createGuardedLookup(rawLookup) as never },
    });
    let failure: unknown = null;
    try {
      await undiciRequest(`http://rebound.test:${port}/`, { dispatcher: agent });
    } catch (e) {
      failure = e;
    }
    expect(failure).not.toBeNull();
    const err = failure as NodeJS.ErrnoException & {
      cause?: NodeJS.ErrnoException;
    };
    const code = err.code ?? err.cause?.code;
    const message = `${err.message} ${err.cause?.message ?? ""}`;
    expect(code === SSRF_BLOCKED_CODE || message.includes("SSRF guard")).toBe(true);
    await agent.close();
  });

  it("the guarded lookup refuses when no public answers remain", async () => {
    const rawLookup = ((hostname: string, _opts: unknown, cb: (
      err: Error | null,
      addresses?: unknown
    ) => void) => {
      cb(null, [
        { address: "10.0.0.5", family: 4 }, // filtered out
        { address: "127.0.0.1", family: 4 }, // filtered out (loopback)
      ]);
    }) as never;
    const lookup = createGuardedLookup(rawLookup);
    await expect(
      new Promise((resolve, reject) =>
        lookup("any.test", { all: true }, (err, addrs) =>
          err ? reject(err) : resolve(addrs)
        )
      )
    ).rejects.toMatchObject({ code: SSRF_BLOCKED_CODE });
  });
});
