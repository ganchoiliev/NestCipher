# Prompt Studio

Prompt Studio guides a research idea into a private, untested experiment inside
the existing Workbench. Open **Plan an experiment** from the starting screen or
Compose. The current working experiment remains separate while planning.

## Prepare a test

1. Enter a title, research question, observable criterion and authorized scope.
2. Enter the exact baseline input and optional input placement. Record known
   target, model/version, settings and context; unknown values stay blank.
3. Add up to three variants. Each needs its complete input and an intended change.
   A baseline alone is supported. The baseline's conditions are copied separately
   into every prepared attempt; edit actual conditions later if they differ.
4. Choose **Review plan**. Inspect the inputs, changes and shared conditions.
   Editing the plan invalidates this prepared snapshot.
5. Choose **Prepare untested attempts**. An existing unsaved experiment must be
   saved, downloaded or explicitly replaced before handoff. Cancelling keeps the
   reviewed plan and working experiment. Handoff uses the reviewed IDs and text.
6. Test manually on the target platform. Record actual observations in Compose,
   compare attempts and use **Save locally** to keep the prepared experiment.

The baseline has no parent; variants link to its stable ID. Responses, action
observations, execution errors, test times, assessments and attached reports
start empty. Copying, preparing and downloading never imply a test occurred.
Reported authorship stays unspecified until the researcher changes it.

The explicit synthetic plan is an independently invented agenda-formatting
exercise. Its origin remains visible. Unchanged fixture inputs/context retain
imported provenance; edited fixture inputs/context and newly entered variants
are distinguished. Loading it over an entered plan requires a discard choice.

## Optional brainstorming brief

Enable AI drafting only when the rules for the research permit it. Enter a
separate generic goal and constraints, then choose **Preview briefing**. Existing
plans, inputs, responses, reports and account data are never included
automatically. The exact reviewed plain text can be copied to the researcher's
own AI tool; no provider call occurs in NestCipher. Review included text before
pasting it into another service.

Changing either briefing field invalidates the preview. Disabling AI drafting
clears both fields and the preview. A failed clipboard operation offers a manual
copy field. Late clipboard completion after editing, closing or locking cannot
restore the preview or copy status. An already initiated clipboard write cannot
be withdrawn; locking does not erase the operating-system clipboard.

The separate briefing is not part of the prepared experiment or its JSON backup.

## Saving and leaving

Planner edits and the briefing exist only in page memory. Closing an entered
planner asks whether to keep it or discard it; Escape uses the same guard. The
page adds a leaving warning, but browsers do not guarantee it, especially on
mobile. A valid reviewed plan can be downloaded as ordinary NestCipher research
JSON and restored through the existing experiment importer.

While planning, **Save working experiment** and **Working experiment JSON** refer
only to the separate existing experiment. They do not save an unprepared plan.
A lock that discards planning text does not offer a misleading save-and-continue
action. Keep the session, review the plan and download or prepare it first.

Accepted lock clears the planner, reviewed experiment and briefing alongside the
working document and vault session. Saving an existing experiment as a new copy
after a revision conflict preserves the open planner. Async file restores and
replacement guards retain their existing generation checks.

## Format and privacy

The reviewed download is readable, private schema-2 research JSON, not an
encrypted vault archive. It contains planned inputs and conditions. Prepared
experiments use existing encryption, library search and Obsidian exports without
a new storage format, database migration or service. Field bounds and the final
5 MiB encoded-experiment limit apply; evidence edits are rejected in full when
too long, rather than truncated.

Plans start with an unknown challenge end, `publish: false` and private
visibility. Live findings remain restricted until at least 30 full days after
the actual confirmed end. Set actual challenge metadata in the Workbench when
known; no date automatically authorizes or publishes findings. An unlocked page,
copied brief or readable download is outside the vault's encryption-at-rest
boundary.
