# Decisions

Dated, append-only. Each entry records what was decided, why, and the trade-off accepted.

## 2026-10-09 — Live caps set before any code shipped

- OpenAI organization spend limit: $20 (alert-only) → **$5/month, hard limit enforced**.
  Verified from the dashboard: an enforced limit makes requests fail with 429 at the
  cap; an unenforced one only alerts. Enforcement lags slightly, so final spend can
  overshoot by a small amount. Auto-reload ($5 → $10) remains on; the enforced cap
  bounds the damage.
- Vercel WAF rule **"API per-IP rate limit"** published to production:
  `Request Path starts with /api/` → fixed window, **10 requests / 60 s per IP** →
  **429 Too Many Requests**. Billed $0.50 per 1M *allowed* requests; blocked are free.
  This is the manual, dashboard-managed rule the repo cannot express in code —
  if it disappears, re-add it with exactly these parameters.

## 2026-10-09 — SSRF guard semantics (scan-headers)

- Only `unicast` per ipaddr.js is scannable. IPv4-mapped IPv6 is refused **even when
  the inner IPv4 is public**: a mapped literal in user input exists only to smuggle
  an address past string checks. Trade-off: a hypothetical legitimate user scanning
  `[::ffff:a.b.c.d]` is refused; they can scan `a.b.c.d` directly.
- Only default ports (80/443) are scannable. The WHATWG parser elides default ports,
  so the rule is simply `url.port === ""`.
- Rebinding defence lives in the socket path (`connect.lookup` on an undici Agent),
  not only in a pre-check. The scanner calls `undici.request` directly because
  Next's patched global fetch documents no `dispatcher` passthrough
  (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md).
  A test proves the custom lookup controls the dialled IP.
- `@types/node` ^20 → ^22 to match the actual Node 22 runtime (vitest 5 peer range).

## 2026-10-09 — Bot check: Vercel BotID over Cloudflare Turnstile

BotID wins on every axis that matters here. It is native to the platform: no second
vendor, no site/secret key pair to manage, no widget, and the challenge is invisible,
which matters for a security-audience site where a visible CAPTCHA on a free tool
invites ridicule. Basic mode is free on all plans and Deep Analysis (Kasada) costs
$1/1000 `checkBotId()` calls on Pro — and those calls sit *behind* the free durable
per-IP limiter, so the billed surface is capped. The deciding technical factor:
Turnstile requires `challenges.cloudflare.com` in `script-src` and `frame-src`, which
would punch a third-party hole in the strict nonce CSP this phase ships, while BotID
rides same-origin rewrites added by `withBotId`. Trade-off accepted: BotID Basic
catches less than a visible challenge might, and Deep Analysis spend in a distributed
attack is bounded only by the WAF and per-IP limits — volumetric abuse is explicitly
out of scope (SECURITY.md) and the $5 OpenAI hard cap bounds the real damage.
Sources: vercel.com/docs/botid, vercel.com/docs/botid/get-started (fetched 2026-10-09).

## 2026-10-09 — Layer order on paid routes

`WAF (edge) → zod schema → durable per-IP limit (Upstash) → checkBotId() → global
daily budget → provider`. Rationale: free and cheap checks run first; the paid bot
check runs only for traffic that survived them; the budget is spent only by requests
that passed the bot check, so bots cannot drain the day's budget and deny humans.
Each layer refuses on its own (B.L.A.S.T. "L").

## 2026-10-09 — Durable limits infrastructure

- Upstash Redis via Vercel Marketplace, database `nestcipher-ratelimit`, region iad1,
  **Free plan (500K commands/month)**, eviction off, env prefix `KV` (Sensitive),
  connected to Production + Preview. Upgrade path: Pay As You Go at $0.20/100K
  commands if launch traffic ever threatens the free ceiling.
- Client IP comes from `ipAddress()` (@vercel/functions) everywhere. Raw
  `x-forwarded-for` is never parsed again.
- Fail closed: Redis unreachable or unconfigured in production → limited routes 503.
  Local development without Redis env allows with a console warning, so tools stay
  testable offline. Trade-off: a Redis outage takes the paid tools down rather than
  leaving them unlimited — correct for a free site with a hard budget.
- `DAILY_LLM_BUDGET=200` (requests/day, UTC-keyed counter) and
  `OPENAI_MODEL=gpt-4o-mini` set in Vercel env for all environments.

## 2026-10-09 — Email Analyzer: server owns the arithmetic; calibration added

Live testing with three real inbox emails found two defects: (1) a genuine
new-sign-in notification from a matching brand domain scored 72/High — the model
treated unverifiability and even the absence of URLs as threat signals; (2) the
model inverted one category's scale ("Sender Legitimacy: 90" meaning *legitimate*,
labelled "low") and its overall score ignored its own weighted-average definition
(and surfaced as a float in the UI).

Fixes: calibration rules in the system prompt (unverifiability ≠ attack; routine
security notifications from matching domains cap at "medium" without concrete
indicators; high/critical reserved for concrete indicators), and server-side
arithmetic: category scores are clamped into their own level's band, the overall
is recomputed with the documented weights, and the final verdict is
`round(max(model overall, recomputed, pre-pass floor))`. Deliberate bias: upward
corrections apply, downward never do — a security tool fails toward caution, and
downward calibration stays the prompt's job, not the maths'. The full
header-aware fix (SPF/DKIM) belongs to Email X-Ray in Phase 2, not Phase 0.

## 2026-10-09 — Strict nonce CSP via the Next 16 proxy

- `src/proxy.ts` (the renamed middleware; root placement is silently ignored
  when the app lives under `src/` — caught by a local header check, not by the
  build) generates a per-request nonce and serves:
  `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'` (dev adds
  `'unsafe-eval'` for React debugging only), `object-src 'none'`,
  `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `connect-src 'self' https://plausible.io`, `img-src 'self' data:`,
  `upgrade-insecure-requests`.
- **Trade-off accepted: every page now renders per request** (`force-dynamic` in
  the root layout; nonces cannot exist in build-time HTML). A tools site that
  renders untrusted input needs a strict CSP more than static HTML.
- `style-src` keeps `'unsafe-inline'`: server-rendered style attributes (React
  inline styles, Framer Motion initial states) break under a nonce-only style
  policy, and style injection is not this phase's attack surface.
- Plausible loader + inline init carry the nonce; BotID rides same-origin
  rewrites, covered by 'strict-dynamic'.
- HSTS `max-age=31536000; includeSubDomains` set statically for all routes.
  Preload deliberately deferred.
- Scanner CSP scoring is now honest (`src/lib/csp-score.ts`): the site's own
  pre-rebuild policy scores 2/20 (fail) under it.

## 2026-10-09 — Progressive enhancement: CSS owns the entrances

- The `PageTransition` opacity wrapper is deleted. It blanked the whole site
  without JS and caused a reproducible dead first click on tool pages while
  hydration raced the overlay (seen live twice during testing).
- All framer-motion `initial={{opacity: 0}}` entrance animations on home,
  /tools and /about are replaced with a CSS-only `.rise-in` keyframe
  animation: identical visual effect, runs without JavaScript, honours
  `prefers-reduced-motion`. Framer stays for genuinely interactive motion
  (mobile menu, tooltips, tool internals).
- Home and About pages are server components again.
- The two interactive tools carry a `<noscript>` line; everything else
  renders fully without JS — proven by `npm run test:e2e`
  (tests/e2e/no-js.spec.ts, JavaScript disabled, asserting COMPUTED opacity,
  since Playwright's toBeVisible treats opacity:0 as visible).
- e2e runs with Playwright's own Chromium (`npx playwright install chromium`
  once per machine) or any Chromium via `PW_EXECUTABLE=`. Deliberately NOT in
  the `build` script: Vercel's build image has no browser.
- `poweredByHeader: false` — the scanner's own advice, applied to ourselves.

## 2026-10-09 — Honesty, privacy and open-source hygiene (deliverables 8–9)

- Every tool now states its true data flow: Email Analyzer "Sent to OpenAI…
  NestCipher stores nothing" with the OpenAI API data policy linked; Headers
  Scanner "fetched once from NestCipher's server"; OWASP explorer "runs in
  your browser". The false "never stored, logged, or shared" lines are gone.
- Site retitled "NestCipher — Free, Open-Source AI Security Tools"; "No
  sign-ups" and "AI-Powered" removed from metadata and the hero. "AI security
  tools" means tools FOR AI security — that phrasing is deliberate.
- /privacy: controller GoSmartR Ltd (company 15407332, registered office as
  published on gosmartr.co.uk), the five processors and what each receives,
  retention, UK GDPR rights, ICO reference. Linked from footer, newsletter
  and the analyzer.
- Newsletter promise corrected to "Release notes, a few times a year".
- Subscribe call moved to Resend's CURRENT API (POST /contacts — the
  /audiences/{id}/contacts path is gone from their docs; checked 2026-10-09).
  RESEND_AUDIENCE_ID is no longer read and can be deleted from Vercel env.
  Needs one live form submission after deploy to confirm against his account.
- LICENSE (MIT), README (what/run/security model), SECURITY.md (scope,
  out-of-scope incl. volumetric DoS and cost exhaustion, safe harbour,
  honest solo-operator response times), RFC 9116 security.txt (expires
  2027-10-09), /security/thanks Hall of Fame stub.

## 2026-10-10 — Private workbench continuity

- The owner selected an encrypted local vault. Drafts remain in page memory;
  Save locally is explicit. IndexedDB stores opaque IDs/write tokens, IVs and
  authenticated ciphertext. Titles, timestamps, revisions, disclosure metadata
  and evidence are encrypted. AES-256-GCM uses fresh 96-bit IVs and 128-bit tags;
  PBKDF2-SHA-256 uses a random 128-bit salt and 600,000 iterations through native
  WebCrypto. The nonextractable key remains in the workbench session; no account,
  passphrase storage, recovery, sync or autosave is provided.
- This protects content at rest, not the origin or an unlocked page. A separate
  private origin remains a stronger future boundary. Same-origin scripts can
  access/delete ciphertext, and compromised page code can use unlocked keys or
  capture passphrases. Lock clears UI/key references and invalidates pending
  operations, without claiming secure memory erasure. Browser storage is best
  effort; readable private JSON backups remain essential.
- Vault limits: 25 records, 50 MiB total plaintext, 5 MiB per experiment. Writes
  compare encrypted revisions and transaction-scoped opaque tokens before
  replacing a saved copy; success is reported only after transaction completion.
  Conflicts and storage failures retain the active draft. Version 1 backups
  migrate to schema 2 after strict legacy validation; evidence is unchanged.
- Existing completed email/header reports are transferred through explicitly
  downloaded private report-only JSON files. Capturing or attaching never runs
  a provider or scanner, changes execution/assessment, or guesses missing
  provenance. Original email input is excluded; reports may quote sensitive
  content. Attached reports inherit the experiment's disclosure restriction.
- Prompt differences are bounded by size/line count. Original evidence remains
  available, with CRLF/LF and invisible characters labelled in the display only.
  The owner-supplied end-plus-30-days policy and `publish: false` remain in every
  research export; no public publishing feature exists.
- Next.js and matching ESLint config updated to 16.4.0 after published runtime
  advisories were found in 16.2.1. Compatible audit fixes applied to development
  dependencies; no forced downgrade. See release validation for remaining
  development-only advisory status and actual checks.

## 2026-10-10 — Authored learning labs and private preparation

- The owner selected learning labs plus research workflow. Preserve Signal and
  the four active utilities; add a separate /labs index and three authored,
  versioned exercises with three cases each. No model runner or challenge
  submission is added. All tasks, replies and action traces are invented.
- Teach authority through a structured trusted-user operation/recipient check,
  action evidence through an initially inconclusive reply and revealed authored
  trace, and comparisons through explicit matched/changed/unknown conditions.
  A proposed action is not a completed effect; two missing values do not match;
  one fixture does not establish causality or robustness. Primary sources are
  linked on each lesson. Complete native workbooks support no-JavaScript reading.
- Choices and review progress remain in React page memory. Only one exact,
  allowlisted lab ID crosses a native new-tab no-opener/noreferrer handoff. The
  Workbench retains its fresh-document script boundary. Unknown/array values
  are ignored. Opening the route does not create a record, save or unlock.
- Explicit Start uses the existing dirty-draft replacement guard. Prepared
  schema 2 experiments have fresh IDs, a baseline/variant parent link, exact
  authored inputs and imported provenance. Outcomes, execution time,
  assessments and attachments remain empty. Answer keys and fictional traces
  never become observed results. The ordinary encrypted vault and private
  export paths handle these records without a new storage or backup format.
- Public contribution starts with a local Markdown template and maintainer
  review of independently invented examples. No submission endpoint or
  publishing action exists. Preserve the owner's confirmed-end-plus-30-days
  minimum disclosure restriction, unknown-end restriction and publish:false.
  Public lessons and portfolio screenshots contain no live challenge findings.
# 2026-10-10 — Optional encrypted account backup

- The owner authorized a dedicated Supabase project and its additional
  $10/month MICRO compute cost. Runtime access uses the existing publishable key;
  no service-role credential is needed.
- Public tools and local research need no account. Check account is explicit;
  saved records upload only after an explicit backup action. Unsaved drafts,
  passphrases and plaintext evidence stay local.
- Keep one encrypted snapshot per owner, a 3 MiB API cap, database RLS and
  owner-derived save/delete functions with atomic remote revision checks. Bind
  requests to the checked account to prevent cross-tab sign-in races.
- Add a portable encrypted manifest and authenticated empty-browser restore.
  Cancellation before installation commits leaves no vault; existing local
  vaults are never merged or replaced. A full older valid snapshot can still be
  restored; this is not an immutable audit log.
- Same-origin server routes preserve the Workbench network policy. HttpOnly
  account cookies and no-store responses support server-only PKCE auth; opening
  the emailed link in the requesting browser is required.
- Cloud backup never publishes. The 30-full-day minimum after a confirmed
  challenge end, private exports and explicit publication review remain intact.
- Public email sign-in requires custom SMTP; the provider's default mail is
  restricted to project-team addresses. Full sync, encrypted team key sharing
  and community publishing remain separate milestones. See RESEARCH_CLOUD.md.
