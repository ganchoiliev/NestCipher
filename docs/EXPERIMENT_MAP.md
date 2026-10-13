# Experiment map and results

Open **Review → Experiment map** in the Workbench. The map complements
per-attempt review and pairwise comparison without changing the experiment.

## Lineage

The map follows the entered parent links. Roots and siblings follow their
positions in the experiment; every label retains its original attempt number
and stable ID. Reordering an attempt changes its reading position, not its ID
or stored parent link. Select a record to inspect its exact input, captured
conditions, manual states and existing field-review flags.

**Open attempt** returns to Compose. **Compare with parent** opens the existing
comparison with those exact IDs. **Use as next attempt** explicitly calls the
existing duplication flow: it preserves input, placement, captured conditions
and input attribution, creates a fresh child ID, and leaves results, notes,
assessments, test time and attached reports empty. No test is submitted.

Parent links describe the researcher's entered relationships. They do not prove
that a changed input caused an outcome, or distinguish a true independent
repeat from another variant.

## Captured input groups

Records join a group only when exact input, input placement and all seven
condition fields match. No whitespace, line endings, Unicode or invisible
characters are normalized. Missing and whitespace-only values are labelled;
equality between blank values does not establish equivalent real conditions.

Execution counts split not-tested, recorded-state and reported-error attempts.
Assessment counts include only recorded-state attempts, separating met,
not-met, inconclusive and unassessed entries. Assessments entered on other
execution states are counted separately. These are descriptive manual entries,
not verified trials, automatic grades or success percentages. Existing
missing-observation flags remain available for inspection.

Groups retain every source attempt ID and link. They do not claim independent
sampling, reproducibility or reliability, even when all captured fields match.

## Private results note

Choose **Preview private results note** to generate a summary for the current
working snapshot. Inspect the exact inert Markdown before choosing **Download
private results note**. Changes to the source invalidate the preview and
download. Leaving the map, replacing the document or accepting vault lock
clears its transient preview.

The summary contains title and challenge metadata, snapshot time, stable IDs,
parent relationships, group memberships, field-gap names, counts and disclosure
restrictions. It excludes prompt inputs, context, condition values, responses,
actions, change notes, research notes, assessment reasoning, error details and report
contents. Entered title/challenge metadata may still be sensitive. The file is
readable private Markdown and does not replace a full JSON restore backup or
the detailed Obsidian pack.

Reading the map and previewing/downloading a note never saves, edits, syncs or
publishes the working experiment. After creating a next attempt, use the
ordinary explicit local save to retain it. Existing encryption and optional
ciphertext backup remain unchanged; no new schema, service or database
migration is required.

Live findings stay private until at least 30 full days after the actual
confirmed challenge end. Unknown ends remain restricted. A date passing never
publishes a record or authorizes sharing by itself.
