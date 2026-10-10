import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieMethodsServer } from "@supabase/ssr";

const sdk = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: sdk.createServerClient }));
import { createResearchCloudClient } from "../supabase/server";

const config = {
  supabaseUrl: "https://example.supabase.co", publishableKey: "sb_publishable_dummy_only",
  appOrigin: "https://nestcipher.com", secureCookies: true,
};
beforeEach(() => { sdk.createServerClient.mockReset(); sdk.createServerClient.mockReturnValue({ auth: {} }); });

function callbacks(): CookieMethodsServer {
  return sdk.createServerClient.mock.calls[0][2].cookies;
}

describe("request-local server-only Supabase cookies", () => {
  it("reads cookies only from the current request", async () => {
    createResearchCloudClient(new NextRequest(config.appOrigin, { headers: { cookie: "sb-session=opaque" } }), config);
    expect(await callbacks().getAll()).toEqual([{ name: "sb-session", value: "opaque" }]);
  });
  it("forces HttpOnly secure cookies even when provider options differ", async () => {
    const context = createResearchCloudClient(new NextRequest(config.appOrigin), config);
    await callbacks().setAll?.([{ name: "sb-session", value: "opaque", options: { httpOnly: false, secure: false, sameSite: "none", path: "/other" } }], {});
    const response = context.apply(NextResponse.json({ user: null }));
    const cookie = response.cookies.get("sb-session");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("propagates SDK refresh cache headers and keeps all responses no-store", async () => {
    const context = createResearchCloudClient(new NextRequest(config.appOrigin), config);
    await callbacks().setAll?.([{ name: "sb-session", value: "fresh", options: {} }], { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" });
    const response = context.apply(NextResponse.json({ user: null }));
    expect(response.cookies.get("sb-session")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("expires")).toBe("0");
  });
  it("does not leak cookie writes across requests", async () => {
    const first = createResearchCloudClient(new NextRequest(config.appOrigin), config);
    await callbacks().setAll?.([{ name: "sb-session", value: "first", options: {} }], {});
    const second = createResearchCloudClient(new NextRequest(config.appOrigin), config);
    expect(first.apply(NextResponse.json({})).cookies.get("sb-session")?.value).toBe("first");
    expect(second.apply(NextResponse.json({})).cookies.get("sb-session")).toBeUndefined();
  });
  it("permits insecure cookies only for validated local HTTP configuration", async () => {
    const context = createResearchCloudClient(new NextRequest("http://127.0.0.1:3001"), { ...config, appOrigin: "http://127.0.0.1:3001", secureCookies: false });
    await callbacks().setAll?.([{ name: "sb-session", value: "local", options: {} }], {});
    expect(context.apply(NextResponse.json({})).cookies.get("sb-session")).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax" });
  });
});
