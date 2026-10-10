import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { ResearchCloudConfig } from "../research-cloud-config";
import { noStore } from "../research-cloud-http";

/** A new client per request. No browser SDK or service-role credential is used. */
export function createResearchCloudClient(request: NextRequest, config: ResearchCloudConfig) {
  const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const cacheHeaders = new Headers();
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookieOptions: { httpOnly: true, secure: config.secureCookies, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies, headers) => {
        for (const cookie of cookies) { jar.set(cookie.name, cookie.value); pending.set(cookie.name, cookie); }
        for (const [name, value] of Object.entries(headers)) cacheHeaders.set(name, value);
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return {
    client,
    apply(response: NextResponse): NextResponse {
      for (const { name, value, options } of pending.values()) {
        response.cookies.set(name, value, {
          ...options, httpOnly: true, secure: config.secureCookies, sameSite: "lax", path: "/",
        });
      }
      cacheHeaders.forEach((value, name) => response.headers.set(name, value));
      return noStore(response);
    },
  };
}
