import { NextRequest, NextResponse } from "next/server";
import { buildCsp, generateNonce } from "@/lib/csp";

// Next 16 proxy (the renamed middleware): generates the per-request nonce
// and serves the strict CSP on every rendered page. API routes, static
// assets and prefetches are excluded by the matcher; static security
// headers for ALL routes (HSTS included) live in next.config.ts.

export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon|apple-touch-icon|opengraph-image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
