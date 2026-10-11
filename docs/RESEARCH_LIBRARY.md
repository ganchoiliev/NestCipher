# Research library and private Obsidian packs

The Workbench now includes a full-width **Research library** view. It reads saved
experiments from the unlocked local vault. The current working draft stays
separate; browsing, filtering, opening and exporting never save it automatically.

## Daily workflow

1. Open **Local library** to create or unlock the browser vault. If you have an
   encrypted cloud backup on another device, choose **Restore an existing vault**
   instead of creating a new one. Check its account and enter the original vault
   passphrase privately. Account sign-in does not recover a forgotten phrase.
2. In Compose, add tags one at a time and choose **Save locally**. Tags are encrypted
   with the record. Unsaved tag edits are excluded from library filters and packs.
3. Open **Research library**. Recent saves appear first. Search entered text across
   saved titles, metadata, historical conditions, evidence and report snapshots.
   Search terms are case-insensitive; every term must occur somewhere in a record.
4. Combine Tag, Target and Needs review filters. Target includes both experiment
   defaults and historical attempt targets. Review labels reflect reported states
   and missing fields, not research quality or automatically judged success.
5. Open a saved record to continue. If a newer working draft exists, the ordinary
   save/download/discard choice protects it before replacement.

**Reload library** explicitly reads a fresh saved snapshot, including changes from
another tab. The list is not a live cross-device feed. Locking removes the
unlocked library subtree, its search index, selection and prepared Markdown from
the UI. JavaScript cannot guarantee erasure of runtime memory copies.

## Export to Obsidian

1. Select saved records individually or use **Select shown records**. Hidden
   selected records remain selected and their count is displayed. Partial records
   without a title or an attempt input remain available to open, but cannot be
   selected for Markdown export until completed and explicitly saved.
2. Choose evidence fields and whether to include attached report snapshots.
   Omissions are labelled and do not edit the originals. Reports may quote their
   original input; omitting prompt input does not remove such quotations from
   other selected fields or reports.
3. Choose **Preview Obsidian pack**. Review its filenames and readable text.
   Changing the selection, inclusion options or loaded snapshot invalidates the
   prepared pack; preview again before downloading.
4. Choose **Download Obsidian pack ZIP**. Extract it into a private folder in your
   Obsidian vault. Open `index.md` to follow links to `experiments/<UUID>.md`.

The pack also includes `README.md`. UUID filenames stay stable when titles change.
Notes link back to the index. Extraction does not automatically update an earlier
export; review files before replacing notes. Archive timestamps use a fixed ZIP
convention; record times remain in the content.

This ZIP is **not encrypted** and is not a lossless restore archive. It contains
only the selected saved revisions, never the unsaved draft. Keep a separate
encrypted vault archive for restoration. All notes, the index and instructions
remain private with `publish: false`. Live challenge findings stay restricted
until at least 30 full days after the actual confirmed end; unknown or unconfirmed
ends provide no disclosure date. Passing a date never authorizes or publishes
anything. Any later sharing needs explicit review.

## Implementation boundaries

- `ResearchVaultSession.readAll()` authenticates one local snapshot, with one
  decryption per saved record. A lock during an outstanding read rejects its result.
- Search derives an in-memory index once per loaded snapshot and filters it locally.
  No plaintext search index, tags, selection or query is persisted or uploaded.
- Markdown uses the existing serializer and its field/report omission policy.
  Selection validation rejects invalid data, inconsistent summaries and duplicate
  record IDs. It never silently drops a selected record.
- ZIP uses UTF-8 STORE entries, CRC-32, local headers and a central directory.
  UUID paths exclude titles and prevent path traversal. It needs no new service.
- Limits remain 25 records and 50 MiB source data, with a 64 MiB pack output cap.
  Existing per-record Markdown bounds still apply. Export fewer records or omit
  fields when a pack exceeds its limits. Cloud snapshots retain their 3 MiB limit.
- Supabase stores the existing encrypted snapshot format. No migration, additional
  database permission or cloud-sync behavior is introduced in this phase.

These controls preserve the existing privacy boundary: encryption protects saved
content at rest, not a compromised origin, unlocked page or device.
