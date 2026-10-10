# Optional encrypted research backup

Public tools and the local Research Workbench work without an account. This
phase adds explicit account backup/restore, not automatic cross-device sync or
shared research. The Local library also searches saved titles locally while
unlocked. Opening the library does not contact an account service; Check account
starts that request.

## Data boundary

The browser authenticates saved vault records and prepares a version 1 portable
encrypted snapshot. Titles, observations, record revisions and disclosure
policy are encrypted. Opaque vault/record IDs, write tokens, salt, IVs,
ciphertext, record count, upload time and size are visible to the server, as are
the account email and normal authentication/request metadata. The passphrase,
key and unsaved working draft are never part of a backup request.

An encrypted manifest binds the complete ordered record set to the snapshot.
Restore authenticates the manifest and every supported private record locally
before installation. Missing, spliced or changed records fail closed. A complete
older authentic snapshot remains valid: this is not a rollback-proof audit log.
The existing local vault format and data are not migrated automatically.

Account authentication and vault unlock are separate. Recovering an account
does not recover a forgotten vault passphrase. An unlocked page or compromised
same-origin code can still expose plaintext. Encryption does not remove that
boundary.

## Account and API

Server-only Supabase clients use the publishable key, verified getUser()
identities and HttpOnly account cookies. There is no service-role key or
browser Supabase SDK. Same-origin API requests preserve the Workbench CSP.
Auth and backup responses are private/no-store; mutations check the configured
origin. Passwordless sign-in uses PKCE and a fixed server callback. Open the
email link in the browser that requested it.

Each backup request asserts the account ID previously checked in the UI; the
server compares it to the verified cookie account before accessing any backup.
This assertion never supplies authorization. If another tab changes the
account, refresh account status before continuing. Sign-out uses local scope.

The database exposes only owner-scoped reads under RLS. Direct table writes are
revoked. Narrow authenticated save/delete functions derive the owner from
auth.uid(), serialize per owner, enforce an opaque revision token and validate
the ciphertext-only structure and size. Anonymous reads and function calls are
denied. No public research or publishing table exists.

## Explicit controls and limits

- Save locally before Back up saved vault. Typing, opening, unlocking and
  signing in do not save or upload experiments.
- One current encrypted snapshot per account, up to 3 MiB for the API payload.
  The domain format supports larger local vaults, but cloud requests reject
  larger snapshots without truncation. This stays below Vercel's function
  request/response limit; larger cloud vaults require a separate transfer design.
- Replacing a remote snapshot requires explicit review and the checked remote
  revision. Conflicts preserve both sides; there is no automatic merge.
- Restore only creates a vault when the browser has none. Existing vaults and
  working drafts are not replaced. Cancelling before installation commits aborts
  it; after a committed restore the encrypted records exist locally, and stale
  UI completions lock the returned session.
- Download encrypted cloud archive retains ciphertext. Existing experiment
  JSON, Markdown and report downloads are readable private files.
- Delete cloud backup requires explicit confirmation and the checked revision;
  local data is retained. Earlier encrypted copies can remain in infrastructure
  backups according to the provider's retention policy.

All experiments retain private/publish:false disclosure rules. Unknown/live
challenge ends stay restricted. At least 30 full days after a confirmed end is
the owner's minimum disclosure restriction; a date never publishes or grants
permission. Backup and restore create no community submission.

## Setup

1. Create a dedicated Supabase project, with automatic RLS enabled and automatic
   table exposure disabled. Apply
   `supabase/migrations/202610100001_encrypted_research_backups.sql`.
2. Set server environment variables `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY` and `NESTCIPHER_APP_URL` to the exact application
   origin. Keep `.env*` ignored. No privileged project key is needed.
3. Configure the site URL and exact `/auth/callback` allowlist entries in
   Supabase Authentication. Use HTTPS for hosted deployments. HTTP loopback is
   supported in development; a local production-mode preview requires the
   explicit `NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW=true` flag. It permits only
   localhost/127.0.0.1, never a remote HTTP host. Omit that flag when deploying.
4. Configure durable Upstash limits before hosting accounts publicly. Production
   requests fail closed without the existing durable limiter.
5. Configure custom SMTP before public email sign-in. Supabase's default service
   sends only to project-team addresses and currently permits two messages per
   hour. Do not claim general public account availability until delivery is set
   up and verified.

Local integration alone does not deploy the website or launch public signup.
Production configuration, release and live verification were completed
separately as recorded below. A GitHub project connection is separate from the
app's runtime database connection.

### Configured project — 10 October 2026

The dedicated `nestcipher` project (`jsedtflazuwwxquzwqws`, Frankfurt) has the
encrypted-backup migration applied. Initial read-only dashboard inspection showed RLS,
the owner-only SELECT policy, grants denying anonymous access and direct account
writes, account-only RPC execution grants and an empty research table. No
research was uploaded during that initial setup; the later synthetic local
roundtrip is recorded below.

The site URL is `https://nestcipher.com`. The exact redirect allowlist contains
`http://127.0.0.1:3001/auth/callback` and
`https://nestcipher.com/auth/callback`. Ignored local configuration connects the
development Workbench to this project using its publishable key. The live local
account check returned `configured: true` without signing in or sending email.

The existing Vercel project `nest-cipher` deploys production from `master`;
pushing that branch triggers a deployment. Earlier read-only inspection found masked
`KV_REST_API_URL` and `KV_REST_API_TOKEN` settings already present, but not the
three Supabase application settings. That inspection made no production changes.
The limiter settings' presence does not establish provider health. The Supabase
repository deployment selector remains separate from this existing Vercel connection.

Vercel CLI configuration has subsequently saved `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` and `NESTCIPHER_APP_URL` for production. Independent
readback confirmed the dedicated project URL, publishable-key format, exact
app origin `https://nestcipher.com` and absence of the local-preview flag. No
privileged project key was used, and ignored local `.env*` files were never
uploaded. The release from `codex/nestcipher-research-cloud` has been merged and
deployed to `https://nestcipher.com`; production evidence is recorded below.

Vercel domain readback and public HTTP checks confirm that the apex serves HTTP
200 without a redirect, while `www` redirects to `https://nestcipher.com` with
HTTP 308. The redirect preserves callback paths and query strings and sends
`max-age=0, must-revalidate`. The earlier apex-to-`www` redirect was removed
because account routes check the exact configured Host and Origin. No DNS
records were changed in this production configuration phase.

Browser storage and account cookies belong to their origin. Localhost, `www`
and `https://nestcipher.com` do not share a local vault. To restore the retained
synthetic cloud snapshot on the hosted apex, use a browser profile with no local
vault there, sign in to the same account and enter the original passphrase
locally. Creating a different vault first does not merge it with that snapshot.

The three Resend sending records have been saved in Hostinger. Public DNS checks
at 17:13 UTC confirmed the exact `resend._domainkey` TXT and `send` MX/TXT records
on both authoritative nameservers and Cloudflare/Google resolvers. All 11 prior
records, including their authoritative TTLs, matched the inspected baseline.
Resend now reports the sending domain ready to send, with DKIM, the bounce MX
and SPF individually Verified. Sending is enabled, receiving remains disabled
and tracking is not configured. Supabase custom SMTP is enabled and saved with
sender `no-reply@nestcipher.com` (`NestCipher`), host `smtp.resend.com`, port `465`,
username `resend` and minimum interval `60` seconds. Chrome confirmed the update
and displayed “Stored password is hidden”; no credential value was read or
recorded. The user reports saving a replacement password. Resend's
`NestCipher Auth v2` key has Sending access restricted to `nestcipher.com`.
Branded confirmation and magic-link templates are saved in Supabase,
with subjects “Confirm your NestCipher email” and “Your NestCipher sign-in link”.
A full Chrome reload and rendered previews verified their persistence, including
the exact `{{ .ConfirmationURL }}` placeholder, dark/lime styling, same-browser
instructions and separate vault-unlock text.

Three authorized localhost sign-in requests have been made: one failed and two
showed check-email success. The first two used the clean Chrome Incognito
session. The first returned HTTP 502, with the supplied Auth
`/otp` log at `2026-10-10T18:12:40Z` confirming SMTP authentication rejection
(535). After credential replacement, the retry returned HTTP 200 in 1,485 ms
and showed check-email success. Resend marked “Confirm your NestCipher email”
Delivered, resolving the SMTP blocker. DNS and templates remain verified.
The branded confirmation email was found in the Hostinger inbox. Its CTA was
opened in the existing requesting Incognito session; the callback returned
HTTP 303 to the Workbench, and initial Check account confirmed the expected
identity and “No snapshot saved”. The local email/authenticated-session flow is
verified.
The stale sign-in return banner clears only after an explicit valid signed-in
account response; failed checks retain the hint. A live check confirmed the
banner cleared and the synthetic draft was preserved.

The user created a private test vault and saved exactly one fixture,
“NestCipher cloud roundtrip — synthetic”, at local revision 1. It has two
authored attempts, no model run, and private disclosure with an unknown challenge
end. The first explicit cloud upload was visibly confirmed at
`2026-10-10 18:58:47 UTC`: one saved experiment, 5.6 KiB, excluding unsaved
working drafts. Independent real local restore is verified. Production
configuration is saved and checked; the release and independent hosted Guest
restore are also verified below. The single synthetic cloud snapshot is retained.

Refreshed cloud metadata retained one record and 5.6 KiB. Download encrypted
cloud archive retrieved the stored snapshot through the authenticated app as
`nestcipher-synthetic-encrypted-cloud-backup.json` (5,725 bytes). The project
validator accepts version 1, one encrypted record, manifest, base64, size bounds
and PBKDF2 configuration. Known fixture titles, prompts and markers were absent
from readable text; these are structure checks, not proof of decryption.

An independent Chrome Guest profile began with no existing local vault. Its third
authorized sign-in request showed check-email success. The latest Hostinger
email is verified as received, with subject “Your NestCipher sign-in link” and
sender `no-reply@nestcipher.com`. The Guest callback returned HTTP 303 to the
Workbench. Explicit Check account confirmed the expected test identity and one
saved experiment, 5.6 KiB, uploaded at `2026-10-10 18:58:47 UTC`, before any local
vault existed. After the user's original-passphrase entry, the UI confirmed
“Encrypted backup restored into this browser and unlocked”. The Guest library
has one unlocked saved record with two attempts, local revision 1 and original
saved time `2026-10-10 18:53:47.882Z`. Baseline prompt, response, authored reasoning
and research notes match the original; private `publish:false` and unknown
challenge end are preserved. The second attempt's prompt and parent-variant
relationship also match, with execution “Not tested” and assessment “Unassessed”
preserved.
Guest authentication, retrieval, decryption and restore complete the real local
roundtrip. No real research was uploaded; no cleanup or deletion was performed. See
[the concrete launch steps and synthetic roundtrip](CLOUD_LAUNCH.md).

### Production release and restore — 10 October 2026

Release commit `f20f1c940733aff40b931ed2178a011ba681227e` was pushed from
`codex/nestcipher-research-cloud`.
[PR #1](https://github.com/ganchoiliev/NestCipher/pull/1) merged at
`2026-10-10T20:41:50Z` with merge commit
`1c092bc1f29eb3c18648564ffd722d8c6284dd9e`. Vercel production deployment
`dpl_8t7H4bTBoMPczbJYxhsSFRSPb6Aw` was Ready, matched the exact merge commit and
was aliased to the apex during the production release check. Its URL is
`nest-cipher-4z2l2rbn7-ss7538dk-1983s-projects.vercel.app`. Build logs record
`npm run build` and all six preflight checks passing at
`2026-10-10T20:42:02Z`, then Build Completed at `20:42:22Z`.

Public HTTP checks at `2026-10-10T20:42:43Z` returned 200 for Home, Tools, Labs,
Community and Research Workbench. The Workbench response had strict nonce-based
CSP excluding the Plausible connection origin and omitted analytics scripts.
Signed-out account status returned 200 with `configured:true` through the real
durable-limiter path; signed-out backup access returned 401 and a foreign-Origin
account request returned 403. Checked API responses were private/no-store and
no-referrer. The `www` callback redirect preserved path/query with HTTP 308.

The hosted magic-link email reached the authorized test inbox on 10 October,
displayed as 9:44 PM, from `no-reply@nestcipher.com` with subject “Your NestCipher
sign-in link”. The original requesting Guest profile used the fresh email and
exact apex callback, returning to the Workbench with `account=connected`.
Explicit Check account verified the expected identity and authenticated cloud
metadata: one saved experiment, uploaded at `2026-10-10 18:58:47 UTC`, 5.6 KiB.

The hosted Guest origin began with no local vault. After the user entered the
original passphrase privately, an independent check on the exact hosted
Workbench confirmed “Encrypted backup restored into this browser and unlocked”.
The local library has one unlocked record, “NestCipher cloud roundtrip —
synthetic”, two attempts, revision 1 and original saved time
`2026-10-10 18:53:47.882Z`. Opening the baseline confirmed prompt `Repeat the
public marker only.`, response `BLUEBIRD`, execution “Result recorded manually”,
assessment “Met criterion”, original authored reasoning and synthetic notes.
Disclosure remains “Private · End unknown”, with `publish:false`. Attempt 02
remains “Not tested” and a variant of Attempt 01. Cloud metadata retains the
original upload time and 5.6 KiB.

Hosted delivery, account verification, authenticated retrieval, local decryption
and restore complete the real production roundtrip. Only synthetic data was
used. The single cloud snapshot is retained, with no cleanup or deletion. Live
conflict, second-account isolation and deletion checks have not been reported
as completed; mocked regressions remain separate evidence.

## Verification

Domain tests cover ciphertext-only roundtrip, strict bounded parsing, manifest
tampering, wrong passphrases, existing-vault refusal, quota rollback and restore
cancellation races. Backend tests cover configuration, trusted origin, bounded
bodies, owner identity, cross-tab account change, conflicts and no-store cookies.
Mocked Playwright tests exercise real browser encryption and local IndexedDB
while replacing cloud responses with synthetic fixtures. They do not prove real
email delivery or a hosted user session.

The banner fix passed a fresh production build and 15 isolated Playwright tests:
five auth-feedback tests, including two new regressions, and ten mocked cloud
tests for privacy, revision conflicts and restore cancellation. The earlier
412-unit-test baseline was not rerun for this UI change. These mocked checks are
separate from the real local roundtrip and independent Guest restore above.

The pre-gate release baseline passed 416 unit tests across 19 files, lint, a
Next.js production build including TypeScript, and all 76 fresh Playwright
tests before the production build-gate addition. The Upstash timeout/fail-closed
change passed 15 focused tests, and the new gate passed 17 focused CLI tests.
After a test-helper type correction, the fresh release build passed 425 unit
tests across 19 files and the Next.js 16.4 production build, including TypeScript
and route generation. The 76 browser tests cover the final application code;
later changes were confined to the package/CLI gate. The fresh full lint pass
also succeeded. Branch-push, PR and merge-commit `master` GitHub CI passed 425
unit tests across 19 files, all 76 browser tests, lint and the production build.
The merge run is
[38084753272](https://github.com/ganchoiliev/NestCipher/actions/runs/38084753272).

Preview deployment `dpl_25gPsLpuxFRZWZ6pT8JMkG78yLdz` was Ready, but official
CLI runtime checks, including ordinary redirect-following, reached Vercel login
under its existing protection. Protection was left unchanged. Public production
checks and the authenticated production Guest restore are recorded separately
above; they do not guarantee continuing provider availability.

The released code's `prebuild` checks required hosted configuration when
`VERCEL_ENV=production`, failing before the build on missing or unsupported
settings. It skips this automatic gate outside Vercel Production. The manual
`npm run check:cloud-launch` remains strict everywhere. Neither mode loads
`.env` files, prints setting values or checks provider connectivity. Production
limiter requests time out and fail closed when the durable service is unavailable.

An isolated PostgreSQL-compatible PGlite check applies the migration twice and
tests grants, RLS, save/delete CAS and structural constraints with simulated
Supabase auth helpers. Actual dashboard verification is recorded separately.

Sources checked on 10 October 2026: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs),
[authentication flow](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[email delivery](https://supabase.com/docs/guides/auth/auth-smtp),
[Vercel function limits](https://vercel.com/docs/functions/limitations).
