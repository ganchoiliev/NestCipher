/**
 * Nonce-based CSP for every rendered page (docs/THREAT-MODEL.md A4).
 *
 * Built per the installed Next 16 guide
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 * the proxy generates a fresh nonce per request, sets it in both the
 * Content-Security-Policy header and x-nonce; Next extracts the nonce from
 * the CSP header and applies it to framework scripts, bundles and <Script>
 * components. Nonces require dynamic rendering — accepted, recorded in
 * docs/DECISIONS.md.
 *
 * 'unsafe-eval' is DEV ONLY: React uses eval for debugging info in
 * development; neither React nor Next uses eval in production.
 *
 * style-src keeps 'unsafe-inline': server-rendered style attributes
 * (React inline styles, Framer Motion initial states) are blocked by a
 * nonce-only style policy, and style injection is not the attack surface
 * this phase defends. script-src is where the strictness lives.
 */

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export const WORKBENCH_REQUEST_HEADER = "x-nestcipher-workbench";

export function isResearchWorkbenchPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/tools/research-workbench";
}

export function buildCsp(
  nonce: string,
  isDev: boolean,
  { analytics = true }: { analytics?: boolean } = {},
): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'${analytics ? " https://plausible.io" : ""}`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}
