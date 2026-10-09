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
