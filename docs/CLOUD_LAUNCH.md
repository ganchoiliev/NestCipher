# Encrypted account backup: hosted launch

The local implementation supports explicit encrypted vault backup and restore.
Public tools, learning labs and local research remain available without an
account. This document records the saved production configuration, the release
still to complete and the deliberate hosted synthetic-data check.

## Observed state — 10 October 2026

- Vercel project `nest-cipher` uses `master` as its production branch. Pushing
  that branch triggers an automatic production deployment. The earlier
  read-only inspection made no production changes. The release candidate is
  prepared on `codex/nestcipher-research-cloud`; no PR, push or deployment of
  this code has been completed.
- Production has masked `KV_REST_API_URL` and `KV_REST_API_TOKEN` settings.
  Their presence was observed; limiter connectivity and availability were not
  tested.
- Vercel CLI configuration has now saved `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY` and `NESTCIPHER_APP_URL` for production. An
  independent configuration readback confirmed the dedicated project URL,
  publishable-key format, app origin `https://nestcipher.com` and absence of
  the local-preview flag. No privileged project key was used; ignored local
  `.env*` files were never uploaded. Provider health still needs verification
  in the released runtime.
- Vercel domain configuration and public HTTP checks now confirm the apex
  returns HTTP 200 without a redirect, and `www` returns HTTP 308 to
  `https://nestcipher.com`. The redirect preserves `/auth/callback` and its
  query string, with `max-age=0, must-revalidate`. This resolves the earlier
  apex-to-`www` configuration that conflicted with the app's exact Host/Origin
  checks. No DNS records were changed in this production configuration phase.
- The dedicated Supabase project and encrypted-backup migration are prepared;
  the configured database boundaries are documented in
  [RESEARCH_CLOUD.md](RESEARCH_CLOUD.md).
- After the user's approval, the three exact Resend sending records were saved
  in Hostinger: the TXT record at `resend._domainkey.nestcipher.com` and the
  MX/TXT records at `send.nestcipher.com`. Hostinger shows all 11 prior records
  plus those three additions. At 17:13 UTC on 10 October 2026, both authoritative
  nameservers (`ns1.dns-parking.com` and `ns2.dns-parking.com`) and the
  Cloudflare/Google public resolvers returned the exact three additions. All 11
  original records, including their authoritative TTLs, matched the baseline.
  Resend now reports the domain ready to send and marks DKIM, the bounce MX and
  SPF individually Verified. Sending is enabled, receiving remains disabled,
  and its configuration shows no tracking configured.
- Supabase custom SMTP is enabled and saved: sender `no-reply@nestcipher.com`
  (`NestCipher`), host `smtp.resend.com`, port `465`, username `resend` and minimum
  interval `60` seconds. The user reports saving the replacement password, and
  the dashboard shows the stored password hidden. Resend's `NestCipher Auth v2`
  key has Sending access restricted to `nestcipher.com`; no secret value was
  read or recorded.
- Branded [sign-up confirmation](../supabase/templates/confirm-sign-up.html)
  and [magic-link](../supabase/templates/magic-link.html) templates are saved
  in Supabase email settings. Subjects are “Confirm your NestCipher email” and
  “Your NestCipher sign-in link”, respectively. A full Chrome page reload and
  rendered previews verified persistence of both templates, including the
  dark/lime styling, same-browser instructions, separate vault-unlock text and
  exact `{{ .ConfirmationURL }}` placeholder.

Three authorized localhost sign-in requests have been made: one failed and two
showed check-email success. The first two used the clean Chrome Incognito
session. The first returned HTTP 502; the supplied
Supabase Auth `/otp` log at `2026-10-10T18:12:40Z` confirmed SMTP authentication
rejection (535). After credential replacement, the fresh retry returned HTTP
200 in 1,485 ms and the UI showed check-email success. Resend marked the email
with subject “Confirm your NestCipher email” Delivered. The SMTP authentication
blocker is resolved; DNS and templates remain verified.

The confirmation email was found in the Hostinger inbox with the expected
branded text. Its CTA was opened in the existing requesting Incognito session;
the callback returned HTTP 303 to the Workbench. Initial Check account then
confirmed the expected identity and “No snapshot saved”. Local email delivery
and the authenticated callback/session flow are verified.
The stale sign-in return banner now clears only after an explicit valid
signed-in account response; failed account checks retain the hint. A live check
confirmed the banner cleared and the synthetic draft was preserved.

The user created a private test vault and saved exactly one fixture,
“NestCipher cloud roundtrip — synthetic”, at local revision 1. It contains two
authored attempts, no model run and private disclosure with an unknown challenge
end. The first explicit cloud upload was visibly confirmed at
`2026-10-10 18:58:47 UTC`: one saved experiment, 5.6 KiB. Unsaved working drafts
were excluded. The independent real local restore is verified. Production
configuration is now saved and checked; release and hosted account/backup
verification remain pending. The synthetic cloud snapshot is retained.

Refreshed cloud metadata retained one saved experiment and 5.6 KiB. Download
encrypted cloud archive retrieved the stored snapshot through the authenticated
app, saved as `nestcipher-synthetic-encrypted-cloud-backup.json` (5,725 bytes).
The project validator accepts its version 1 format, one encrypted record,
manifest, base64, size bounds and PBKDF2 configuration. Known fixture titles,
prompts and markers were absent from readable text. This checks the encrypted
structure; it does not prove decryption.

An independent Chrome Guest profile began with no existing local vault. Its third
authorized sign-in request showed check-email success. The latest Hostinger
email is now verified as received, with subject “Your NestCipher sign-in link”
and sender `no-reply@nestcipher.com`. The Guest callback returned HTTP 303 to the
Workbench. Explicit Check account confirmed the expected test identity and one
saved experiment, 5.6 KiB, uploaded at `2026-10-10 18:58:47 UTC`, before any local
vault existed. After the user entered the original passphrase, the Guest UI
reported “Encrypted backup restored into this browser and unlocked”. One saved
record is unlocked with two attempts, local revision 1 and original saved time
`2026-10-10 18:53:47.882Z`. The baseline prompt, response, authored reasoning and
research notes match the original; private `publish:false` and unknown challenge
end are preserved. The second attempt's prompt and parent-variant relationship
also match, with execution “Not tested” and assessment “Unassessed” preserved.

Guest authentication, retrieval, decryption and independent restore complete
the real local roundtrip. Only the synthetic fixture was uploaded; no real
research was included and no cleanup or deletion has been performed.

## Local research workflow

Use Compose to record an attempt's conditions, prompt, observations and manual
assessment. Review filters the current experiment by not-tested state, reported
errors, unassessed entries or selected missing-field context. Its search reads
prompt input, change notes, targets and criteria locally. Open attempt returns
to that record; Compare with parent selects its existing parent relationship.
Review changes the view, not the evidence or reported status. Counts can overlap
and do not measure success or research quality.

The Local library searches saved titles only while unlocked. Save locally before
an explicit cloud backup; unsaved working drafts are excluded. All records stay
private, including during a live challenge. The minimum disclosure restriction
remains 30 full days after the actual confirmed challenge end, with explicit
review rather than automatic publication.

Sign-in return hints open the library and explain the next step. A query such as
`account=connected` does not establish an identity. Check account starts the
verified account request; opening the page or library does not make that cloud
call. Email-link requests have a local resend interval and safe service feedback
that does not display raw provider diagnostics. Open the latest link in the same
browser that requested it. Signing in neither unlocks nor uploads a vault.

## Complete the hosted setup

1. Keep the checked `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
   `NESTCIPHER_APP_URL` production configuration and exact HTTPS app origin
   `https://nestcipher.com`. Keep `NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW` absent.
   The apex and `www` redirect checks above are complete; repeat them after
   release because the server accepts only the configured Host and Origin.
2. Check the Supabase site URL and exact
   `https://nestcipher.com/auth/callback` redirect allowlist entry. Verify the
   existing durable limiter is available to production requests.
3. Run the configuration preflight with the intended deployment runtime
   environment already supplied, complete the production build gate and final
   validation, then release the prepared branch deliberately. The existing
   `master` push-to-deploy connection is part of that release path. The release
   candidate has not yet been deployed.

```sh
npm run check:cloud-launch
```

This script inspects runtime environment configuration only. It does not load
`.env` files, print setting values, contact providers or verify health. It prints
check labels and variable names and exits nonzero for missing or unsupported
configuration. A passing result does not confirm DNS, SMTP delivery, database
permissions, callback behavior or limiter connectivity; those need the checks
above and the roundtrip below.

The release candidate also runs this check from `prebuild` with
`--if-production`: it blocks `npm run build` when `VERCEL_ENV=production` and
required configuration is missing or unsupported. It skips this automatic gate
outside Vercel Production. The manual command above remains strict in every
environment; neither mode checks provider health.

## Verify with an invented record

The local email/account, vault creation, save, upload, retrieval and independent
restore steps are verified. Further conflict/account-boundary checks below have
not been reported as live results; repeat the roundtrip after deliberate deployment.

1. Open the latest delivered email in the browser that requested it, return to
   the library and choose Check account to confirm the verified session. A
   hosted rerun should request its own fresh link for the tester's address.
2. Create a local vault with a test passphrase kept separately. Save one clearly
   labelled invented experiment, with no real challenge prompt or finding.
3. Choose Back up saved vault. Check the returned account, snapshot count and
   upload confirmation. Edit and save locally, then explicitly back up again
   and confirm the remote revision changes. An unsaved edit stays outside the
   snapshot.
4. Use a second browser profile with no existing local vault. Sign in to the
   same account, check cloud status, and restore using the original passphrase
   locally. Confirm the invented input, conditions, manual statuses and private
   disclosure metadata match the saved record. An existing browser vault must
   refuse replacement.
5. Confirm a stale remote revision produces a conflict, and that another
   authenticated account cannot read or change the first account's snapshot.
   Check account-switch feedback, wrong-passphrase refusal and sign-out.
6. Delete the test cloud snapshot with its checked revision. Confirm the local
   copies remain and the cloud status reports no snapshot. Downloaded or local
   test copies can be removed separately by their owner.

Record actual outcomes without storing email-link tokens, SMTP credentials,
vault passphrases or real research. This exercise does not publish a finding or
test a live challenge.

## Implementation validation

The earlier local code checks completed on 10 October 2026: 405 unit tests across 18
files, 18 targeted browser tests, lint and a Next.js production build. The five
Review browser tests were rerun after the mobile layout changes. Browser cloud
responses use synthetic fixtures; these results complement, rather than replace,
the hosted email/session/backup roundtrip.

The subsequent safe sign-in diagnostics passed 40 focused tests and lint. Full
validation before the banner fix passed 412 unit tests across 19 files and a
production build including TypeScript. That unit baseline was not rerun for the
UI change; the earlier 18 targeted browser results remain historical checks.

The banner fix passed a fresh production build and all 15 isolated Playwright
tests: five auth-feedback tests (including two new regressions) and ten cloud
tests covering privacy, revision conflicts and restore cancellation with mocked
responses. The isolated QA server was closed afterward; the live local session
remained available. These mocked checks are separate from the real local
roundtrip and independent Guest restore recorded above.

The pre-gate release baseline passed 416 unit tests across 19 files, lint, a
Next.js production build including TypeScript, and all 76 fresh Playwright
tests. This was before the production build-gate addition. The Upstash timeout
and fail-closed change passed 15 focused tests; the new production gate passed
17 focused CLI tests. After a test-helper type correction, the fresh release
build passed 425 unit tests across 19 files and the Next.js 16.4 production build,
including TypeScript and route generation. The 76 browser tests cover the final
application code; the later changes were confined to the package/CLI build gate.
The fresh full lint pass also succeeded.
PR CI, deployment and hosted account/backup smoke checks have not yet been
recorded. Mocked browser results do not establish production provider health.
