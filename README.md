# NestCipher

Free, open-source AI security tools: [nestcipher.com](https://nestcipher.com)

- **Email Analyzer** — paste a suspicious email, get a structured phishing
  assessment (OpenAI-backed, with a deterministic pre-pass the model cannot
  override).
- **Security Headers Scanner** — fetches a URL's response headers and grades
  them, including honest CSP scoring that penalises `unsafe-inline`,
  `unsafe-eval` and scheme-wide sources.
- **OWASP LLM Top 10 explorer** — interactive reference, runs entirely in the
  browser.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind v4 on
Vercel. No accounts, no database.

## Run it locally

```sh
git clone https://github.com/ganchoiliev/NestCipher.git
cd NestCipher
npm ci
npm run dev
```

The site runs without any environment variables; tools that need backends
degrade gracefully. To exercise everything locally:

| Variable | Used by |
|---|---|
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Email Analyzer |
| `RESEND_API_KEY` | Newsletter subscribe |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Durable rate limits (Upstash Redis) |
| `DAILY_LLM_BUDGET` | Global daily cap on paid model calls |

Without Redis configured, rate limiting fails **closed** in production and
open (with a console warning) in development.

```sh
npm test          # vitest unit suite (also runs first in `npm run build`)
npm run test:e2e  # Playwright no-JS smoke tests (npx playwright install chromium once)
```

## Security model

The threat model lives in [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) and
dated decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md). The short
version:

- **Layered refusals** on anything that costs money: WAF rate rule → schema
  validation → durable per-IP limits (Upstash) → invisible bot check
  (Vercel BotID) → global daily budget → provider. Each layer refuses on its
  own.
- **SSRF-hardened scanner**: unicast-only DNS classification via `ipaddr.js`,
  connect-time pinned lookups on an undici Agent (anti-rebinding), manual
  redirects re-validated per hop, default ports only.
- **Prompt-injection resistance**: the analyzer treats pasted email as data,
  uses strict structured outputs re-validated with zod, and a deterministic
  pre-pass floors the verdict — a steered model cannot lower it.
- **Strict CSP**: per-request nonce with `'strict-dynamic'`, no `unsafe-eval`
  in production, HSTS with `includeSubDomains`.
- **Fail closed**: errors, timeouts and unparseable model replies are
  inconclusive, never "safe".

Found something? See [SECURITY.md](SECURITY.md) — good-faith research is
welcome and credited.

## License

[MIT](LICENSE)
