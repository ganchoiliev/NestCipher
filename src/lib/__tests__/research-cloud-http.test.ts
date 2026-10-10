import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { allowsCloudRequest, matchesCloudAuthority, privateResponse, readBoundedCloudJson } from "../research-cloud-http";

const config = { supabaseUrl: "https://example.supabase.co", publishableKey: "unused", appOrigin: "https://nestcipher.com", secureCookies: true };
const request = (headers: Record<string, string> = {}, url = config.appOrigin) => new NextRequest(url, { headers });

describe("cloud same-origin boundary", () => {
  it("requires the exact configured origin on mutations", () => {
    expect(allowsCloudRequest(request({ origin: config.appOrigin }), config, true)).toBe(true);
    for (const origin of ["https://evil.test", "https://nestcipher.com.evil.test", "https://nestcipher.com:444", "null"]) {
      expect(allowsCloudRequest(request({ origin }), config, true)).toBe(false);
    }
    expect(allowsCloudRequest(request(), config, true)).toBe(false);
  });
  it("does not trust forwarded hosts or request origins", () => {
    expect(allowsCloudRequest(request({ origin: config.appOrigin, "x-forwarded-host": "nestcipher.com" }, "https://evil.test"), config, true)).toBe(false);
  });
  it("accepts the actual127.0.0.1 authority despite NextURL normalizing it to localhost", () => {
    const local = { ...config, appOrigin: "http://127.0.0.1:3001", secureCookies: false };
    const incoming = new NextRequest(`${local.appOrigin}/api/research/account`, {
      headers: { host: "127.0.0.1:3001", "sec-fetch-site": "same-origin" },
    });
    expect(incoming.nextUrl.origin).toBe("http://localhost:3001");
    expect(allowsCloudRequest(incoming, local)).toBe(true);
    const mutation = new NextRequest(`${local.appOrigin}/api/research/backup`, {
      method: "PUT", headers: { host: "127.0.0.1:3001", origin: local.appOrigin, "sec-fetch-site": "same-origin" },
    });
    expect(allowsCloudRequest(mutation, local, true)).toBe(true);
  });
  it("never broadens a local configured authority to other loopback hosts or ports", () => {
    const local = { ...config, appOrigin: "http://127.0.0.1:3001", secureCookies: false };
    for (const host of ["localhost:3001", "127.0.0.2:3001", "127.0.0.1:3002", "127.0.0.1:3001.evil.test", "127.0.0.1:3001, evil.test"]) {
      const incoming = new NextRequest(`${local.appOrigin}/api/research/account`, {
        headers: { host, "x-forwarded-host": "127.0.0.1:3001", origin: local.appOrigin },
      });
      expect(allowsCloudRequest(incoming, local, true)).toBe(false);
    }
  });
  it("uses fixed Host authority behind an internal URL without trusting forwarded destinations", () => {
    const internal = new NextRequest("http://localhost:3000/api/research/account", {
      headers: { host: "nestcipher.com", "x-forwarded-host": "evil.test", "sec-fetch-site": "same-origin" },
    });
    expect(matchesCloudAuthority(internal, config)).toBe(true);
    expect(allowsCloudRequest(internal, config)).toBe(true);
    const mutation = new NextRequest("http://localhost:3000/api/research/backup", {
      method: "PUT", headers: { host: "nestcipher.com", origin: "https://evil.test", "x-forwarded-origin": config.appOrigin },
    });
    expect(allowsCloudRequest(mutation, config, true)).toBe(false);
  });
  it("rejects cross-site and sibling-subdomain browser reads", () => {
    for (const site of ["cross-site", "same-site"]) expect(allowsCloudRequest(request({ "sec-fetch-site": site }), config)).toBe(false);
    expect(allowsCloudRequest(request({ origin: "https://evil.test" }), config)).toBe(false);
    expect(allowsCloudRequest(request({ "sec-fetch-site": "same-origin" }), config)).toBe(true);
  });
  it("marks all account and backup responses private and non-cacheable", () => {
    const response = privateResponse({ user: null });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie, Origin");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("bounded cloud JSON reader", () => {
  const jsonRequest = (body: string, headers: Record<string, string> = {}) => new NextRequest(config.appOrigin, {
    method: "PUT", headers: { "content-type": "application/json", ...headers }, body,
  });
  it("accepts bounded JSON with an optional charset", async () => {
    expect(await readBoundedCloudJson(jsonRequest('{"a":1}', { "content-type": "application/json; charset=utf-8" }), 32)).toEqual({ a: 1 });
  });
  it("refuses non-JSON content types", async () => {
    await expect(readBoundedCloudJson(jsonRequest("{}", { "content-type": "text/plain" }), 32)).rejects.toMatchObject({ status: 415 });
  });
  it("rejects declared and streamed oversized bodies", async () => {
    await expect(readBoundedCloudJson(jsonRequest("{}", { "content-length": "100" }), 32)).rejects.toMatchObject({ status: 413 });
    await expect(readBoundedCloudJson(jsonRequest(JSON.stringify("💡".repeat(20))), 32)).rejects.toMatchObject({ status: 413 });
    await expect(readBoundedCloudJson(jsonRequest(JSON.stringify("a".repeat(50)), { "content-length": "1" }), 32)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects missing or malformed JSON", async () => {
    await expect(readBoundedCloudJson(jsonRequest("invalid"), 32)).rejects.toMatchObject({ status: 400 });
    await expect(readBoundedCloudJson(new NextRequest(config.appOrigin, { method: "PUT", headers: { "content-type": "application/json" } }), 32)).rejects.toMatchObject({ status: 400 });
  });
});
