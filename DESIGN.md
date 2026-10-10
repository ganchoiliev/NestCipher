# NestCipher — Signal design system

## Purpose and selection

An independent free toolkit for developers, security practitioners and AI red teamers. Four tools cover email analysis, HTTP security headers, OWASP LLM risks and a manual research workbench. The field guide connects learning, practice and reproducible research, including Gray Swan Arena, without implying affiliation.

The owner selected **A — Signal** after rejecting two earlier directions and comparing three functional prototypes. Signal makes the technical identity visible through condensed typography, lime and ink planes, and a recurring open-boundary illustration. The split N is the compact brand mark. The portfolio story belongs on About; tool flows focus on the user's task.

Primary references informed the principles, rather than supplying layouts: [Pentagram's Oxide identity](https://www.pentagram.com/work/oxide) for a coherent technical language; [Instrument](https://www.instrument.com/) for graphic hierarchy; [Google PAIR Explorables](https://pair.withgoogle.com/explorables/) for explanatory interaction. Research and comparison artifacts are separate from application validation.

## Type

- Display and brand: Barlow Condensed 600/700. Homepage 98–174px, page titles 44–80px, large editorial titles 64–154px, section headings 34–72px.
- Body: Barlow 400/500/600. Reading text generally 16–22px; compact reports 14px or larger.
- Labels and evidence: DM Mono 400/500, minimum 12px for metadata. Long source and destinations wrap.
- Fonts are self-hosted by Next. The social image uses a local Barlow Condensed TTF with its OFL license in src/assets.
- Compatibility aliases for the preceding font variables remain while existing tool components share the same new type system.

## Colour

Dark default: background #0b100d, surface #151d17, elevated #1e291f, primary #f0f3e9, secondary #c1cbbd, muted #acb6a8. Accent #c7ff48 with #0b100d labels. Decorative rules #354336; identifiable control boundaries #677a65.

Light alternate: background #f2f5ed, surface #ffffff, elevated #e7ece0, primary #111a13, secondary #465343, muted #596752. Accent #365b0e with white labels. Rules #cbd5c4; control boundaries #687762. The homepage field-guide plane remains lime with ink text in both themes.

Status colours remain separate tokens and pair with written labels. Keep danger, warning, information and success distinct from the brand accent. No glow, gradient, fake terminal activity or continuous decorative motion.

## Layout and interaction

- Shell: up to 1360px, 48px desktop margins, 32px below 1050px, 20px below 700px.
- Hero: dominant two-line headline and an open trust boundary. The toolkit immediately follows as four large numbered links derived from the registry.
- Quick start: functional tool selector. Scanner drafts stay in React memory, never in URL parameters or persistent storage. Navigation does not execute the scan.
- Evidence inspector: three labelled synthetic examples, run with the existing deterministic email prepass. The displayed text, destination, source and actual flags are inspectable. All computation is local; these examples never call an analysis API.
- Catalog: working search and category intersection, counts and reset/empty state.
- Workspaces: quieter form and report typography, clear labels, provider/privacy context, long-value wrapping and useful findings.
- Research Workbench: an active experiment with ordered prompt attempts, historical condition snapshots, manual observations, bounded exact-text comparisons and private Markdown/JSON exports for Obsidian. Optional explicit saving uses a passphrase-encrypted local library; no autosave or sync. Compact setup panels keep the active attempt prominent. Report-only private JSON snapshots connect existing email/header tools without rerunning them or inferring test outcomes. Enter/leave through fresh document navigation to keep analytics and BotID initialization out of this workspace; other tools retain their protections. No model execution or public sharing. Encryption protects stored content, not an unlocked page or the origin from compromised code.
- Challenge findings remain private until at least 30 full days after the confirmed challenge end. Unknown/unconfirmed ends keep the restriction. Displayed dates never publish or authorize publication. All exports remain private and Markdown includes `publish: false`; public examples and portfolio artifacts use synthetic or already public material.
- Learning labs: a separate numbered editorial index and three authored exercises with three cases each. Use an open evidence/decision split on desktop and stacked reading on mobile. Case selections, written reviews, a revealed action record and matched/changed/unknown labels explain the method. No model runner, fabricated performance score or saved learning progress. Native complete workbooks preserve every case and explanation without JavaScript.
- Lab preparation: a native new-tab handoff preserves an existing private workspace. Only a known built-in identifier crosses; explicit Start in the Workbench creates private, untested baseline/variant records with empty observations. Apply ordinary draft/vault/export controls. Keep the actual permission source, outcome evidence and authored origin visible.
- Field guide: numbered research loop, links to the three learning labs, reproducibility checklist, minimum disclosure policy, four primary resource destinations and an invented teaching-example contribution template. Contributions are local drafts for maintainer review; no hosted submission or public findings feed exists.
- About: purpose, author, selected design process and concrete engineering decisions. Do not invent results, community activity, affiliations or testimonials.
- Hard rules and square controls. Spacious reading surfaces; no floating-card shadows.

## Accessibility and resilience

Controls use 44px minimum touch dimensions where applicable; main actions use 48–56px height. Focus uses a 3px accent outline with offset. Native source disclosure works before JavaScript; initial evidence and OWASP reference summaries render on the server. Selected state is exposed through aria-pressed, errors through alerts and findings through polite live regions.

Use short colour/border transitions and honour reduced motion. Preserve the nonce CSP, existing input validation, BotID, SSRF safeguards, rate limits and API schemas.

## Validation scope

The prototype comparison passed 206 scoped automated checks; this is not a participant user study or a full accessibility audit. Verify the integrated production application separately with its unit suite, browser interaction tests, responsive geometry and solid-colour contrast checks. Keep mocked report tests distinct from live provider integrations.
