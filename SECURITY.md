# Security Policy

NestCipher is a set of free, open-source AI security tools operated by a solo
developer. Security reports are genuinely welcome — this project exists for
the community that finds these things.

## Reporting

Email **hello@nestcipher.com** with:

- the affected URL or file,
- steps to reproduce,
- impact as you understand it.

Machine-readable details live at
[`/.well-known/security.txt`](https://nestcipher.com/.well-known/security.txt).

## Scope

- `nestcipher.com` and its API routes
- this repository's code

## Out of scope

- Volumetric denial of service and traffic flooding
- Cost exhaustion / budget-drain attacks (rate limits and hard spend caps are
  the accepted control; demonstrating "I can spend your budget" is not a
  finding)
- Social engineering of the operator or of third parties
- Vulnerabilities in third-party platforms themselves (Vercel, OpenAI,
  Resend, Upstash, Plausible) — report those upstream
- Reports from automated scanners without a demonstrated impact
- Missing best-practice headers on pages with no sensitive function, clickjacking
  on pages with nothing to click, and similar no-impact findings

## Safe harbour

If you make a good-faith effort to comply with this policy during your
research, we consider it authorised, will not pursue or support legal action
against you for it, and will work with you to understand and fix the issue.
Good faith means: don't access or modify other people's data, don't degrade
the service for others, stop and report once you can demonstrate the issue,
and give us reasonable time to fix it before public disclosure.

## Response times

Solo operator, evenings and weekends — honest numbers rather than corporate
ones:

| Stage | Target |
|---|---|
| Acknowledgement | 72 hours |
| Triage and severity assessment | 7 days |
| Fix for confirmed issues | 30 days (critical: as fast as humanly possible) |
| Coordinated disclosure | after the fix ships, or 90 days, whichever is sooner |

## Recognition

Valid reports are credited (with your permission) on the
[Hall of Fame](https://nestcipher.com/security/thanks).
