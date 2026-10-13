import { NextRequest, NextResponse } from "next/server";
import { isUnknownCatalogPath } from "@/lib/research-catalog-routes";
import {
  buildCsp,
  generateNonce,
  isResearchWorkbenchPath,
  WORKBENCH_REQUEST_HEADER,
} from "@/lib/csp";

// Next 16 proxy (the renamed middleware): generates the per-request nonce
// and serves the strict CSP on every rendered page. API routes, static
// assets are excluded by the matcher; static security
// headers for ALL routes (HSTS included) live in next.config.ts.

export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const isWorkbench = isResearchWorkbenchPath(request.nextUrl.pathname);
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development", {
    analytics: !isWorkbench,
  });

  const requestHeaders = new Headers(request.headers);
  // Never trust an inbound privacy-boundary header. This also runs for
  // prefetch requests so a caller cannot bypass the overwrite with one.
  requestHeaders.set(WORKBENCH_REQUEST_HEADER, isWorkbench ? "1" : "0");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Unknown closed-catalog IDs use an ordinary SSR recovery page. Keeping the
  // status and nonce here avoids the framework's empty dynamic error shell.
  const missing = isUnknownCatalogPath(request.nextUrl.pathname);
  const response = missing
    ? NextResponse.rewrite(new URL("/404", request.url), { status: 404, request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon|apple-touch-icon|opengraph-image).*)",
    },
  ],
};
