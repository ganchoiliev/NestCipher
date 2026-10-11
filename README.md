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
- **Research Workbench** — develop prompt attempts, manually record observations,
  compare conditions and export private Markdown notes for Obsidian or lossless
  JSON backups. Opt in to an encrypted local vault for explicit saving, inspect
  prompt differences, review attempts with local search and manual-state filters,
  and attach private snapshots from the existing tools. The research library
  searches saved evidence locally, filters by tags and historical targets, and
  exports selected saved revisions as a linked private Obsidian ZIP pack.
  **Prompt Studio** guides a question, criterion, baseline and up to three
  variants into reviewed, untested attempts. An optional separate brainstorming
  brief can be previewed and copied into the researcher's own AI tool.
  **Experiment Map** traces parent links, groups identical captured inputs and
  conditions, and previews a private results note with descriptive manual-state
  counts and links to the source attempts.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind v4 on
Vercel. Public tools and local research need no account. Optional Supabase
accounts support explicit encrypted vault backup and restore. Hosted email
sign-in setup and the real backup roundtrip are tracked in
[the cloud launch checklist](docs/CLOUD_LAUNCH.md).

## Private research and challenge disclosures

Research Workbench notes and backups are private by default. The project's
challenge policy is to wait until **30 full days after a challenge ends** before
publicly sharing how it was broken. An unknown end time provides no disclosure
date. A displayed date never automatically publishes or authorizes publication.
Private personal exports remain available during that period and Markdown notes
include `publish: false`. Downloaded files can still be shared outside the app;
their restriction remains the researcher's responsibility.

The workbench opens as a fresh document without the site's analytics or BotID
initialization. Existing paid tools keep their BotID protections. Research
plaintext is not placed in URLs or sent to an API. Drafts stay in memory until an
explicit save or download. The optional vault stores AES-GCM encrypted records
in IndexedDB, including their titles, with a PBKDF2-SHA-256 passphrase-derived,
nonextractable key (600,000 iterations). Use a unique passphrase of at least 16
characters. There is no passphrase recovery, autosave or automatic sync.

Optional cloud backup uploads only an authenticated encrypted snapshot of saved
vault records, through a same-origin API. Account sign-in is separate from vault
unlocking. One snapshot per account, up to 3 MiB; larger local vaults are never
truncated. Replacement and deletion are explicit and check the remote revision.
Restore authenticates the entire snapshot locally and only creates an absent
browser vault; it never replaces or merges an existing one. Cloud archives are
encrypted; ordinary experiment JSON/Markdown downloads remain readable files.
See [cloud setup and boundaries](docs/RESEARCH_CLOUD.md) and
[the current hosted setup and verification steps](docs/CLOUD_LAUNCH.md).

The Research library is separate from vault setup and account backup. Create a
new vault or restore an existing cloud copy through separate paths; restoring
uses the original vault passphrase. Library search and its index exist only in
the unlocked page. The Obsidian pack contains readable Markdown, an index and
instructions; it is **not encrypted** and is not a restore archive. Preview the
selected saved notes and omissions before downloading. See
[the library and Obsidian workflow](docs/RESEARCH_LIBRARY.md).

Prompt Studio planning stays in page memory until explicit preparation or a
reviewed research JSON download. It protects the existing working draft and
uses the same encrypted saving and private exports after handoff. The optional
briefing accepts separately entered generic text; no saved evidence is included
automatically and no AI provider request occurs. See
[planning and briefing boundaries](docs/PROMPT_STUDIO.md).

In Review, choose **Experiment map** to inspect lineage and captured-input
groups. Equal captured fields do not establish independent trials or matched
real environments; missing conditions stay visible. The results-note preview
contains title/challenge metadata, IDs and descriptive counts, excluding raw
evidence and condition values. It is a readable private summary, not a restore
archive. See [experiment map and results](docs/EXPERIMENT_MAP.md).

Local encryption is not origin isolation: same-origin code can read/delete
ciphertext, and compromised code or device access can expose an unlocked page.
Locking drops open-record/key references; it cannot guarantee memory erasure.
Browser storage can be cleared or evicted. Keep private JSON backups, which are
**unencrypted**; Markdown is a readable note, not the restore format. Version 1
JSON backups migrate to version 2 without changing their evidence.

Email and header results can be downloaded as private report-only JSON snapshots
and imported into an attempt. Capture never reruns analysis or scanning; the
original email input is excluded, although the returned report may quote it.
Unknown model/provider/settings provenance stays unknown. Attaching a snapshot
does not change the attempt's execution or assessment. Examples are synthetic
and contain no live challenge findings.

## Learning labs

`/labs` provides three authored exercises with three cases each: source
authority, action evidence and controlled comparisons. Inspect the records,
review decisions and read the complete workbook with or without JavaScript.
No model, scan or challenge submission runs. Choices remain in the page session.

A fresh-document handoff transfers only a built-in lab identifier. Explicit
Start in the private Workbench prepares an untested baseline and variant with
empty observations; existing draft, export and encrypted-save controls apply.
The field guide includes a downloadable proposal template for independently
invented teaching examples. No hosted submission or public findings feed exists.
See [learning content and handoff rules](docs/LEARNING_LABS.md).

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
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Optional research account and encrypted backup |
| `NESTCIPHER_APP_URL` | Exact trusted origin for research account requests and callbacks |
| `NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW` | Set `true` only for a production-mode HTTP loopback preview |

Without Redis configured, rate limiting fails **closed** in production and
open (with a console warning) in development.

```sh
npm test          # vitest unit suite (also runs first in `npm run build`)
npm run test:e2e  # Playwright browser suite (npx playwright install chromium once)
npm run check:cloud-launch  # Configuration only, using the supplied runtime environment
```

The cloud preflight prints check labels and variable names only. It does not load
`.env` files, contact providers or confirm service health.

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
