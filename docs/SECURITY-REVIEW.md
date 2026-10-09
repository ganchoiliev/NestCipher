# NestCipher Security Review — Phase 0 gate

Self red-team of the production deployment (nestcipher.com), 2026-10-09. Each
threat-model abuse case was exercised against the live site and the controlling
layer confirmed to refuse it. "Before" is the March deployment (`3db4b42`, as
audited in `docs/THREAT-MODEL.md`); "after" is the current deployment.

Flood- and cost-style cases were run at polite volume. The daily-budget drain
was **simulated, not executed** — actually draining it would cost money and
deny the tool to real users, which is the out-of-scope cost-exhaustion case in
SECURITY.md. SSRF probes were sent through the public scanner exactly as any
user would; the guard refuses them before any network fetch occurs, so no
request ever reached an internal address.

## Summary

| # | Abuse case | Before (March) | After (now) | Control | Result |
|---|---|---|---|---|---|
| A1 | SSRF via scanner | 12/16 hostile inputs reached fetch | All refused at parse/DNS | `ssrf-guard` + pinned-connect | **PASS** |
| A2 | Cost exhaustion | 3/h in-memory, per-instance, resets on cold start | WAF edge 429 + durable Upstash limit + hard budget | layered limits | **PASS** |
| A3 | Prompt injection (verdict steering) | Raw email to model, fails open | Delimited data, structured output, deterministic floor, fail-closed | `email-analysis` + `email-prepass` | **PASS** |
| A4 | XSS / weak CSP | `unsafe-inline unsafe-eval`, self-graded A | Nonce + strict-dynamic, no eval in prod | proxy CSP | **PASS** |
| A5 | Header spoofing vs limiter | First-entry `x-forwarded-for` | Platform-trusted IP; WAF keys independently | `@vercel/functions` ipAddress | **PASS** |
| A6 | Newsletter abuse | 3/h spoofable, in-memory | Durable limit + BotID; current Resend API | layered limits | **PASS** |
| — | Bot access to paid routes | none | BotID 403 on header-less client | Vercel BotID | **PASS** |
| — | Progressive enhancement | blank with JS off | content server-rendered | CSS entrances | **PASS** |

## Evidence

### A1 — SSRF (PASS)

Six representative internal/metadata targets submitted to the live scanner;
every one refused with HTTP 400 and the correct range classification:

| Input | Result |
|---|---|
| `http://127.0.0.1/` | refused — `loopback` |
| `http://169.254.169.254/latest/meta-data/` | refused — `linkLocal` |
| `http://2130706433/` (decimal loopback) | refused — `loopback` (normalised first) |
| `http://[::1]/` | refused — `loopback` |
| `http://10.0.0.1/` | refused — `private` |
| `http://100.64.0.1/` | refused — `carrierGradeNat` |

The exhaustive 50-row hostile table (decimal/octal/hex IPv4, IPv4-mapped IPv6,
nip.io-style names mocked to private IPs, a redirect to the metadata IP, and
more) is enforced in `src/lib/__tests__/ssrf-guard.test.ts` and gates the
build. Connect-time pinning (anti-rebinding) is proven in
`src/lib/__tests__/safe-fetch.test.ts`. **Before:** the string-only guard let
12/16 of these through.

### A2 / A5 — Cost exhaustion and limiter spoofing (PASS)

A 12-request burst to `/api/scan-headers` returned `200 ×4` then `429 ×8`. The
429s carry `x-vercel-mitigated: deny` — the **WAF edge rule** refusing before
the request reaches the function, the outermost of the layered limits. Behind
it sit the durable Upstash sliding windows (per route + platform-trusted IP)
and, on paid routes, the global daily budget. The limiter key comes from
`ipAddress()` (`@vercel/functions`), never from a client-supplied
`x-forwarded-for`, so header spoofing cannot shift or reset a client's bucket.
**Before:** a per-instance in-memory Map that reset on every cold start and
trusted the first `x-forwarded-for` entry.

### A3 — Prompt injection (PASS)

A real phishing email pulled from the operator's spam folder — spoofed display
name, lookalike payment lure, sender routed through an unrelated domain —
scored **85/100 High** on the live analyzer. A genuine security notification
from a matching brand domain correctly scored **medium** ("cannot be fully
verified from the text alone") after calibration, not a false "phishing"
verdict. The email travels to the model as delimited data; the reply is strict
structured output re-validated with zod; a deterministic pre-pass (AI-directed
instructions, invisible Unicode, link-text/href mismatch) floors the verdict
upward only. Steered-model fixtures in `email-analysis.test.ts` prove a fully
compromised model cannot push a hidden-manipulation email below "high".
Errors, refusals and truncation return inconclusive, never "safe". **Before:**
raw email as the user message; API errors and parse failures recorded as
`passed`/`safe` (fail-open).

### A4 — CSP / XSS surface (PASS)

Live response headers on `/` carry a per-request nonce CSP:
`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-eval` in production,
plus `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`. HSTS is
`max-age=31536000; includeSubDomains`; `x-powered-by` is gone. The site's own
scanner, pointed at itself, grades **A+ (95/100)** with CSP **20/20** — and the
rebuilt scoring fails the March policy at 2/20, so the earlier "A" cannot
recur. Browser console on load shows **zero CSP violations**. **Before:**
`unsafe-inline unsafe-eval`, self-graded A on a present-but-hollow policy.

### A6 — Newsletter abuse (PASS)

A live subscribe returned 200 against the current Resend `POST /contacts` API
(the legacy audience-scoped path the March code used is gone from Resend's
docs). The route sits behind the same durable per-IP limit and BotID as the
analyzer, and validates input with zod. **Before:** 3/h on a spoofable
in-memory key, legacy API.

### Bot access to paid routes (PASS)

A header-less client (plain curl, no BotID challenge solution) to
`/api/analyze-email` returned **403 "Automated traffic detected."** — the paid
route will not run for automated traffic. Same-origin requests from the real
page carry the BotID headers and pass.

### Progressive enhancement (PASS)

The server-rendered home HTML contains the heading ("Free, Open-Source AI
Security Tools"), the "Security Toolkit" section and all three tool links
without any JavaScript. The Playwright JS-off suite (`npm run test:e2e`, 3/3)
asserts computed opacity > 0.99 on home, `/tools`, `/about` and the retired
page. `/privacy` and `/.well-known/security.txt` return 200; the pruned
`/tools/ai-content-detector` 308-redirects to `/tools`. **Before:** the whole
app rendered inside an `opacity: 0` wrapper — blank with JS off.

## Gate

- Every abuse case in this review is refused against the live deployment: **met.**
- CI is green (116 vitest unit tests + gated build): **met.**
- The JS-off Playwright test passes: **met.**

**Phase 0 gate: PASS.** Do not start Phase 1 (identity + Break Board) until the
18 Dec review decides to continue.

## Residual notes (not blockers)

- Daily-budget enforcement is code- and unit-tested (`limits.test.ts`), not
  drained live by design.
- Header-spoofing immunity is argued from the platform-trusted IP source plus
  the independent WAF rule; a browser client cannot set `x-forwarded-for` to
  prove it from the outside, so this rests on code inspection, not a live
  bypass attempt.
- `RESEND_AUDIENCE_ID` is now unused and can be removed from Vercel env.
- Cross-Origin-Embedder-Policy is intentionally unset (would break the
  cross-origin Plausible/BotID loads); it costs 5 points on the scanner's own
  scale, which is why the self-score is A+ (95) rather than A+ (100).
