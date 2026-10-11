"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Experiment, EvidenceField } from "@/lib/research-workbench";
import type { ResearchVaultSession, SavedExperimentSummary } from "@/lib/research-vault";
import {
  buildResearchLibraryIndex,
  filterResearchLibraryIndex,
  type SavedResearchRecord,
} from "@/lib/research-library";
import {
  buildObsidianResearchPack,
  encodeResearchPackZip,
  getObsidianResearchPackEligibility,
  type ObsidianResearchPack,
} from "@/lib/obsidian-research-pack";
import styles from "./ResearchLibrary.module.css";

export interface ResearchLibraryProps {
  session: ResearchVaultSession | null;
  refresh: number;
  busy?: boolean;
  onOpenExperiment: (experiment: Experiment, summary: SavedExperimentSummary) => void;
  onManageVault: () => void;
}

const evidenceFields: { key: EvidenceField; label: string }[] = [
  { key: "input", label: "Prompt input" },
  { key: "context", label: "Known context" },
  { key: "response", label: "Response / transcript" },
  { key: "actions", label: "Observed tool actions" },
  { key: "notes", label: "Research notes" },
  { key: "assessmentReason", label: "Assessment reasoning" },
  { key: "executionError", label: "Execution / provider error details" },
];

const recordTitle = (record: SavedResearchRecord) => record.experiment.title.trim().length ? record.experiment.title : "Untitled experiment";
const savedTime = (value: string) => value.replace("T", " ").replace(".000Z", " UTC");

function initialNoteIssue(record: SavedResearchRecord): string | null {
  if (!record.experiment.title.trim()) return "Add a title in Compose before including this record in a Markdown pack.";
  if (!record.experiment.attempts.some((attempt) => attempt.input.trim())) return "Add at least one attempt with input in Compose before including this record in a Markdown pack.";
  return null;
}

export function ResearchLibrary(props: ResearchLibraryProps) {
  if (!props.session) return <section className={styles.library} aria-label="Research library">
    <header className={styles.heading}><div><p className="eyebrow">Saved research / local only</p><h2>Research library</h2><p>Pick up an experiment. Keep a private record.</p></div><span className={styles.privateBadge}>Private / locked</span></header>
    <div className={styles.locked}><span className={styles.marker} aria-hidden="true">[ / ]</span><div><h3>The vault is locked.</h3><p>Unlock your local vault to search saved experiments and prepare an Obsidian pack. Saved titles and contents stay hidden until then. The current working draft is separate.</p><button type="button" className="button-primary" onClick={props.onManageVault} disabled={props.busy}>Open vault <span aria-hidden="true">↗</span></button></div></div>
  </section>;
  // Removing the unlocked subtree on lock drops its decrypted records, index,
  // search, selection and prepared Markdown. None are written to browser storage.
  return <UnlockedResearchLibrary {...props} session={props.session} />;
}

function UnlockedResearchLibrary({ session, refresh, busy = false, onOpenExperiment, onManageVault }: ResearchLibraryProps & { session: ResearchVaultSession }) {
  const [loaded, setLoaded] = useState<{ session: ResearchVaultSession; records: SavedResearchRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [target, setTarget] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [omitted, setOmitted] = useState<EvidenceField[]>([]);
  const [includeReports, setIncludeReports] = useState(true);
  const [preview, setPreview] = useState<ObsidianResearchPack | null>(null);
  const [previewPath, setPreviewPath] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [noteIssues, setNoteIssues] = useState<{ id: string; title: string; error: string }[]>([]);
  const [status, setStatus] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const alive = useRef(true);
  const loadGeneration = useRef(0);
  const openGeneration = useRef(0);
  const busyRef = useRef(busy);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; loadGeneration.current += 1; openGeneration.current += 1; };
  }, []);

  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    let active = true;
    const generation = ++loadGeneration.current;
    const current = () => active && alive.current && generation === loadGeneration.current;
    async function load() {
      await Promise.resolve();
      if (!current()) return;
      setLoading(true);
      setLoaded(null);
      setLoadError("");
      setSelected(new Set());
      setPreview(null);
      setPreviewPath("");
      setPreviewError("");
      setNoteIssues([]);
      setStatus("");
      setOpening(null);
      openGeneration.current += 1;
      setProgress("Reading saved experiments…");
      try {
        const records = await session.readAll();
        if (!current()) return;
        setLoaded({ session, records });
        setProgress("");
      } catch (reason) {
        if (current()) setLoadError(reason instanceof Error ? reason.message : "The saved library could not be read. Your working draft is unchanged.");
      } finally { if (current()) setLoading(false); }
    }
    void load();
    return () => { active = false; loadGeneration.current += 1; openGeneration.current += 1; };
  }, [session, refresh, retry]);

  const records = useMemo(() => loaded?.session === session ? loaded.records : [], [loaded, session]);
  // Build the normalized full-text index once per saved-record snapshot. Queries
  // filter that index rather than reserializing evidence on each keystroke.
  const index = useMemo(() => buildResearchLibraryIndex(records), [records]);
  const allEntries = useMemo(() => filterResearchLibraryIndex(index), [index]);
  const entries = useMemo(() => filterResearchLibraryIndex(index, { query, tag: tag || undefined, target: target || undefined, needsReview: needsReview ? true : undefined }), [index, query, tag, target, needsReview]);
  const tags = useMemo(() => [...new Set(allEntries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b)), [allEntries]);
  const targets = useMemo(() => [...new Set(allEntries.flatMap((entry) => entry.targets))].sort((a, b) => a.localeCompare(b)), [allEntries]);
  const noteReadiness = useMemo(() => new Map(records.map((record) => [record.experiment.id, initialNoteIssue(record)])), [records]);
  const selectedRecords = useMemo(() => allEntries.filter((entry) => selected.has(entry.record.experiment.id)).map((entry) => entry.record), [allEntries, selected]);
  const shownEligible = entries.filter((entry) => !noteReadiness.get(entry.record.experiment.id));
  const selectedShown = entries.filter((entry) => selected.has(entry.record.experiment.id)).length;
  const selectedHidden = selectedRecords.length - selectedShown;
  const filtersActive = Boolean(query.length || tag || target || needsReview);
  const previewFile = preview?.files.find((file) => file.path === previewPath);

  function invalidatePreview() {
    setPreview(null);
    setPreviewPath("");
    setPreviewError("");
    setNoteIssues([]);
    setStatus("");
  }

  function selectRecord(id: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    invalidatePreview();
  }

  function clearFilters() { setQuery(""); setTag(""); setTarget(""); setNeedsReview(false); }

  async function openRecord(id: string) {
    if (busy || loading || opening) return;
    const operation = ++openGeneration.current;
    const generation = loadGeneration.current;
    const current = () => alive.current && operation === openGeneration.current && generation === loadGeneration.current;
    setOpening(id);
    setLoadError("");
    try {
      const record = await session.open(id);
      if (current() && !busyRef.current) onOpenExperiment(record.experiment, record.summary);
    } catch (reason) {
      if (current()) setLoadError(reason instanceof Error ? reason.message : "This saved experiment could not be opened. Your draft is unchanged.");
    } finally { if (current()) setOpening(null); }
  }

  function preparePack() {
    if (busy || loading || !selectedRecords.length) return;
    invalidatePreview();
    const options = { omittedFields: omitted, includeReportSnapshots: includeReports };
    try {
      const issues = selectedRecords.flatMap((record) => {
        const eligibility = getObsidianResearchPackEligibility(record, options);
        return eligibility.eligible ? [] : [{ id: record.experiment.id, title: recordTitle(record), error: eligibility.error }];
      });
      if (issues.length) { setNoteIssues(issues); setPreviewError("Some selected notes are not ready. Review these records or adjust the omissions, then preview again."); return; }
      const pack = buildObsidianResearchPack(selectedRecords, options);
      setPreview(pack);
      setPreviewPath(pack.files.some((file) => file.path === "index.md") ? "index.md" : pack.files[0]?.path ?? "");
      setStatus(`Private pack prepared from ${pack.recordCount} saved ${pack.recordCount === 1 ? "experiment" : "experiments"}. Review the filenames and readable notes before downloading.`);
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : "The private pack could not be prepared. Saved records are unchanged."); }
  }

  function downloadPack() {
    if (!preview || busy || loading) return;
    try {
      const bytes = encodeResearchPackZip(preview);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "nestcipher-private-obsidian-pack.zip";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setStatus(`Private Obsidian pack download started. It contains ${preview.recordCount} saved ${preview.recordCount === 1 ? "experiment" : "experiments"} as readable Markdown. Check your downloads.`);
      setPreviewError("");
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : "The ZIP could not be downloaded. Your selection and saved records are unchanged."); }
  }

  return <section className={styles.library} aria-label="Research library">
    <header className={styles.heading}><div><p className="eyebrow">Saved research / unlocked</p><h2>Research library</h2><p>Pick up an experiment. Carry selected notes into Obsidian.</p></div><div className={styles.headerActions}><span className={styles.privateBadge}>Private / local</span><button type="button" className="button-secondary" onClick={onManageVault} disabled={busy || Boolean(opening)}>Manage vault</button><button type="button" className={styles.textButton} onClick={() => setRetry((value) => value + 1)} disabled={busy || loading || Boolean(opening)}>Reload library</button></div></header>
    <p className={styles.scope}>Only saved revisions are listed and exported. The unsaved working draft is excluded. Search, filters and selection stay in this page; nothing is saved automatically.</p>
    {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
    <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>{loading ? progress : status}</p>
    {loading ? <div className={styles.loading}><span aria-hidden="true">[ … ]</span><p>Opening the saved library. Decrypted records appear only after loading completes.</p></div> : !records.length ? <div className={styles.firstSave}><p className="eyebrow">A library starts with one deliberate save</p><h3>{loadError ? "The library could not be loaded." : "No saved experiments yet"}</h3><p>{loadError ? "Reload the library to retry. The current working draft remains separate and unchanged." : "Create or open an experiment in Compose, then choose Save locally. Unlocking the vault does not save the working draft."}</p><button type="button" className="button-secondary" onClick={loadError ? () => setRetry((value) => value + 1) : onManageVault} disabled={busy}>{loadError ? "Retry library load" : "Manage vault"}</button></div> : <>
      <div className={styles.filters} role="group" aria-label="Library filters"><div className={styles.search}><label htmlFor="library-search">Search saved research</label><input id="library-search" type="search" value={query} placeholder="Search titles, prompts, results or notes" autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} /></div><div className={styles.filterRow}><div className={styles.field}><label htmlFor="library-tag">Tag</label><select id="library-tag" value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><div className={styles.field}><label htmlFor="library-target">Target</label><select id="library-target" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">All targets</option>{targets.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><label className={styles.checkbox}><input type="checkbox" checked={needsReview} onChange={(event) => setNeedsReview(event.target.checked)} /><span>Needs review</span></label><button type="button" className={styles.textButton} onClick={clearFilters} disabled={!filtersActive}>Clear filters</button></div></div>
      <div className={styles.content}><div className={styles.recordColumn}><div className={styles.listBar}><p>{entries.length} of {records.length} saved {records.length === 1 ? "experiment" : "experiments"} shown · recent saves first</p><button type="button" className={styles.textButton} disabled={busy || !shownEligible.length} onClick={() => { setSelected((previous) => new Set([...previous, ...shownEligible.map((entry) => entry.record.experiment.id)])); invalidatePreview(); }}>Select shown records</button></div><p className={styles.help}>Review labels reflect reported test states, unassessed attempts and record gaps. They are prompts for manual review, not a quality or success score.</p>
        {!entries.length ? <div className={styles.noResults}><h3>No saved research matches these filters.</h3><p>Try fewer terms or clear the filters. Selected records remain selected even when hidden.</p><button type="button" className="button-secondary" onClick={clearFilters}>Show all saved research</button></div> : <ol className={styles.records}>{entries.map((entry) => {
          const record = entry.record;
          const id = record.experiment.id;
          const title = recordTitle(record);
          const issue = noteReadiness.get(id);
          return <li key={id} className={styles.record} data-selected={selected.has(id) || undefined}><label className={styles.recordSelect}><input type="checkbox" checked={selected.has(id)} aria-label={`Select ${title}`} disabled={busy || Boolean(issue)} onChange={(event) => selectRecord(id, event.target.checked)} /><span className="sr-only">Select {title}</span></label><div className={styles.recordBody}><div className={styles.recordHeading}><h3>{title}</h3><span className={styles.reviewBadge}>{entry.needsReview ? "Needs review" : "No listed review gaps"}</span></div><p className={styles.saved}>Saved {savedTime(record.summary.savedAt)} · Revision {record.summary.revision}</p>{entry.tags.length > 0 && <ul className={styles.tags} aria-label="Experiment tags">{entry.tags.map((value) => <li key={value}>{value}</li>)}</ul>}<dl className={styles.metadata}><div><dt>Target</dt><dd>{entry.targets.length ? entry.targets.join(" · ") : "Unspecified"}</dd></div><div><dt>Challenge</dt><dd>{entry.challengeName || "Unspecified"} <span className={styles.inlinePrivate}>/ private</span></dd></div></dl><p className={styles.counts}>{entry.counts.total} {entry.counts.total === 1 ? "attempt" : "attempts"} · {entry.counts.notTested} not tested · {entry.counts.errors} errors · {entry.counts.unassessed} unassessed · {entry.counts.needsContext} record gaps</p>{issue && <p className={styles.noteIssue}>{issue} The partial draft stays available in the vault.</p>}</div><button type="button" className="button-secondary" aria-label={`Open saved experiment ${title}`} disabled={busy || Boolean(opening)} onClick={() => void openRecord(id)}>{opening === id ? "Opening…" : "Open"}<span aria-hidden="true"> ↗</span></button></li>;
        })}</ol>}
      </div><aside className={styles.packOptions} aria-labelledby="pack-heading"><p className="eyebrow">Selected saved revisions / readable notes</p><h3 id="pack-heading">An Obsidian pack.</h3><p className={styles.selectionCount}>{selectedRecords.length} selected{selectedHidden > 0 ? ` · ${selectedHidden} hidden by filters` : ""}</p><button type="button" className={styles.textButton} disabled={busy || !selectedRecords.length} onClick={() => { setSelected(new Set()); invalidatePreview(); }}>Clear selection</button><div className={styles.privateWarning}><strong>Readable private files</strong><p>The ZIP is not encrypted. Notes remain private with publish: false. Keep live challenge findings private until at least 30 days after the confirmed challenge end. Unknown or unconfirmed ends remain restricted.</p></div><fieldset className={styles.omissions}><legend>Include in every selected note</legend>{evidenceFields.map((field) => <label className={styles.checkbox} key={field.key}><input type="checkbox" checked={!omitted.includes(field.key)} disabled={busy} onChange={(event) => { setOmitted((previous) => event.target.checked ? previous.filter((key) => key !== field.key) : [...previous, field.key]); invalidatePreview(); }} /><span>{field.label}</span></label>)}<label className={styles.checkbox}><input type="checkbox" checked={includeReports} disabled={busy} onChange={(event) => { setIncludeReports(event.target.checked); invalidatePreview(); }} /><span>Attached report snapshots</span></label></fieldset><p className={styles.help}>Omissions are labelled in the notes and do not edit saved experiments. This pack is not a lossless JSON or encrypted vault backup.</p><button type="button" className="button-primary" disabled={busy || !selectedRecords.length} onClick={preparePack}>Preview Obsidian pack</button><button type="button" className="button-secondary" aria-label="Download Obsidian pack" disabled={busy || !preview} onClick={downloadPack}>Download Obsidian pack ZIP <span aria-hidden="true">↓</span></button></aside></div>
      {previewError && <p className={styles.error} role="alert">{previewError}</p>}
      {noteIssues.length > 0 && <ul className={styles.issues}>{noteIssues.map((issue) => <li key={issue.id}><strong>{issue.title}</strong><p>{issue.error}</p></li>)}</ul>}
      {preview && <section className={styles.preview} aria-labelledby="pack-preview-heading"><div className={styles.previewHeading}><div><p className="eyebrow">Review before downloading / inert Markdown</p><h3 id="pack-preview-heading">Private pack preview</h3></div><span>{preview.recordCount} notes · {preview.files.length} files</span></div><p className={styles.previewHelp}>Extract the ZIP into a private folder in your Obsidian vault. Open index.md to follow the linked notes. Files below are readable text; previewing does not open links, execute evidence or publish anything.</p><div className={styles.previewGrid}><div className={styles.fileList}><label htmlFor="pack-preview-file">Preview file</label><select id="pack-preview-file" value={previewPath} onChange={(event) => setPreviewPath(event.target.value)}>{preview.files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select><ul aria-label="Obsidian pack filenames">{preview.files.map((file) => <li key={file.path}><button type="button" aria-pressed={previewPath === file.path} onClick={() => setPreviewPath(file.path)}>{file.path}</button></li>)}</ul></div>{previewFile && <pre tabIndex={0} aria-label={`Private pack file preview: ${previewFile.path}`}>{previewFile.content}</pre>}</div></section>}
    </>}
  </section>;
}
