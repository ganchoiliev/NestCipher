# Learning labs

The public `/labs` index and `/labs/[labId]` routes provide three versioned, authored teaching exercises. They are not a model runner, benchmark or challenge submission tool. All scenarios and action records are invented; no model or tool runs in a lab.

`src/lib/research-labs.ts` owns the immutable fixtures, stable IDs, permission gate, condition comparison, decision evaluation and prepared experiment factory. The React exercise owns only page-session choices, reviews and reveals. Public pages retain the site's normal page instrumentation; no answer text/progress event or persistence has been added.

## Content rules

Each lab has a trusted task, a positive criterion, an inspectable record, three cases, explanations and primary references. Source authority uses a finite structured operation/recipient check against actual trusted-user authorisation. Action evidence is inconclusive before revealing the authored trace and remains inconclusive when completion evidence is missing. Controlled comparisons distinguish matched, changed and unknown conditions; two blank values are unknown. One fixture cannot establish model reliability or causality.

The native complete workbook keeps all authored cases and explanations readable without JavaScript. UI progress counts reviewed cases in the current page session; it is not a score, certification or saved learning record.

Use the downloadable `public/templates/nestcipher-lab-contribution.md` to propose an independently invented teaching example. It is a local authoring template, not a submission endpoint. Require maintainer review before changing the fixture module. Increment the lab version when its lesson or evidence changes, and keep prepared record notes explicit about their authored origin.

## Workbench handoff

A native `target="_blank" rel="noopener noreferrer"` link opens `/tools/research-workbench?lab=<allowlisted-id>` as a fresh document. Only one known, built-in ID is accepted; unknown, array or repeated values are ignored. No answer, user content, stored payload or window messaging crosses the boundary.

Opening the route does not create an experiment, run anything, save or unlock a vault. The user explicitly chooses Start this lab. Existing dirty-draft protection still applies. The factory creates a private schema 2 experiment with fresh record/attempt IDs and two ordered, untested attempts. The variant references the baseline. Authored inputs/context/notes have imported provenance, while observed response/actions and assessments remain empty. Expected answers and authored action traces never become observations. Existing JSON, private Markdown and optional encrypted saving handle the record normally.

All prepared records have `visibility: private`, `publish: false` and no confirmed challenge end or disclosure date. Preserve the owner's minimum restriction of 30 full days after an actual confirmed challenge end; unknown/live ends remain restricted. A date does not grant permission or publish a record. Only invented material belongs in public labs, screenshots and proposals.

## Checks

Run the domain tests, production build, lint and Playwright suite. New browser coverage checks session-only decisions, action reveal/review, permission demonstrations, comparisons, no-JavaScript workbooks, invalid routes, new-document handoff, draft preservation and real downloaded exports. Keep the pre-existing Workbench/vault/report/privacy tests passing. Native visual review checks four pages at narrow/desktop widths in both themes. No provider request or paid scan is needed.

Sources reviewed for this phase on 10 October 2026: [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html), [Gray Swan agent hijacking research](https://www.grayswan.ai/blog/your-ai-agent-can-be-compromised-youd-never-know), [NIST evaluation guidance](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations).
