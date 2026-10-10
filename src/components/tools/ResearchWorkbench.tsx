"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LIMITS,
  createAttempt,
  createExperiment,
  createSyntheticExperiment,
  duplicateAttempt,
  exportExperimentJson,
  exportExperimentMarkdown,
  getDisclosureStatus,
  restoreExperiment,
  validateExperiment,
  withChallenge,
  type Attempt,
  type Conditions,
  type Experiment,
} from "@/lib/research-workbench";
import { ResearchVaultError, type ResearchVaultSession, type SavedExperimentSummary } from "@/lib/research-vault";
import { createLabExperiment, getResearchLab, type ResearchLabId } from "@/lib/research-labs";
import { ResearchVaultPanel } from "./ResearchVaultPanel";
import { ResearchTextDiff } from "./ResearchTextDiff";
import { ReportAttachments } from "./ReportAttachments";
import { ResearchAttemptReview } from "./ResearchAttemptReview";
import styles from "./ResearchWorkbench.module.css";

type View = "compose" | "review" | "compare" | "export";
type EvidenceField = "input" | "context" | "response" | "actions" | "notes" | "assessmentReason" | "executionError";
type Pending =
  | { kind: "replace"; next: Experiment; imported: boolean; label: string; saved?: SavedExperimentSummary }
  | { kind: "delete"; id: string; label: string }
  | { kind: "lock"; label: string };
const subscribe = () => () => {};
const mountedSnapshot = () => true;
const serverSnapshot = () => false;
const FieldErrorContext = createContext<(message: string) => void>(() => {});
const conditionFields: { key: keyof Conditions; label: string; long?: boolean }[] = [
  { key: "question", label: "Hypothesis", long: true },
  { key: "scope", label: "Permitted scope / challenge", long: true },
  { key: "target", label: "Target / model" },
  { key: "modelVersion", label: "Model version" },
  { key: "criterion", label: "Expected behavior / criterion", long: true },
  { key: "settings", label: "Settings / configuration", long: true },
  { key: "context", label: "Known system / conversation context", long: true },
];
const evidenceFields: { key: EvidenceField; label: string }[] = [
  { key: "input", label: "Prompt input" },
  { key: "context", label: "Known context" },
  { key: "response", label: "Response / transcript" },
  { key: "actions", label: "Observed tool actions" },
  { key: "notes", label: "Research notes" },
  { key: "assessmentReason", label: "Assessment reasoning" },
  { key: "executionError", label: "Execution / provider error details" },
];
const executionLabels: Record<Attempt["executionState"], string> = {
  "not-tested": "Not tested",
  recorded: "Result recorded manually",
  error: "Execution / provider error reported",
};
const assessmentLabels: Record<Attempt["assessment"], string> = {
  unassessed: "Unassessed",
  met: "Met criterion",
  "not-met": "Did not meet criterion",
  inconclusive: "Inconclusive",
};
const actionLabels: Record<Attempt["actionsStatus"], string> = {
  "not-recorded": "Actions not recorded",
  "none-observed": "None observed by researcher",
  recorded: "Actions recorded by researcher",
};

function Field({ id, label, value, onChange, long = false, evidence = false, hint }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  long?: boolean; evidence?: boolean; hint?: string;
}) {
  const limit = evidence ? LIMITS.maxEvidenceLength : LIMITS.maxMetadataLength;
  const reportError = useContext(FieldErrorContext);
  function changeValue(proposed: string) {
    // Validate the complete browser edit; native maxLength would truncate pasted evidence.
    if (proposed.length > limit) {
      reportError(`${label} exceeds the ${limit.toLocaleString("en-US")} character limit. The previous value was kept.`);
      return;
    }
    onChange(proposed);
  }
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {long ? <textarea id={id} data-testid={id} value={value} spellCheck={false}
      className={evidence ? styles.evidenceInput : undefined} onChange={(event) => changeValue(event.target.value)}
      aria-describedby={hint ? `${id}-hint` : undefined} />
      : <input id={id} data-testid={id} value={value} autoComplete="off" spellCheck={false}
        onChange={(event) => changeValue(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />}
    {hint && <p id={`${id}-hint`} className={styles.help}>{hint}</p>}
  </div>;
}

function ConditionFields({ prefix, value, onChange }: {
  prefix: string; value: Conditions; onChange: (field: keyof Conditions, value: string) => void;
}) {
  return <div className={styles.fields}>{conditionFields.map((field) => <Field key={field.key}
    id={`${prefix}-${field.key}`} label={field.label} value={value[field.key]} long={field.long}
    evidence={field.key === "context"} onChange={(text) => onChange(field.key, text)}
    hint={field.key === "modelVersion" ? "Leave unknown values blank. Record only what the target exposes." : undefined} />)}</div>;
}

function Evidence({ value, empty = "Not recorded" }: { value: string; empty?: string }) {
  return value.length ? <pre className={styles.evidence} tabIndex={0}>{value}</pre> : <p className={styles.missing}>{empty}</p>;
}

function utcInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 19);
}

function fromUtcInput(value: string) {
  if (!value) return null;
  const date = new Date(`${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function shortId(id: string) { return id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 18) || "experiment"; }

function download(text: string, filename: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: contentType }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export function ResearchWorkbench({ selectedLabId, initialAccountStatus }: { selectedLabId?: ResearchLabId; initialAccountStatus?: "connected" | "error" } = {}) {
  const selectedLab = getResearchLab(selectedLabId);
  const mounted = useSyncExternalStore(subscribe, mountedSnapshot, serverSnapshot);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("compose");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [omitted, setOmitted] = useState<EvidenceField[]>([]);
  const [includeReports, setIncludeReports] = useState(true);
  const [comparisonView, setComparisonView] = useState<"originals" | "changes">("originals");
  const [dirty, setDirty] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [pending, setPendingState] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [vaultSession, setVaultSession] = useState<ResearchVaultSession | null>(null);
  const [savedRecord, setSavedRecord] = useState<SavedExperimentSummary | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(Boolean(initialAccountStatus));
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [vaultGeneration, setVaultGeneration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const vaultRef = useRef<ResearchVaultSession | null>(null);
  const savedRecordRef = useRef<SavedExperimentSummary | null>(null);
  const savingRef = useRef(false);
  const workspaceGeneration = useRef(0);
  const restoreGeneration = useRef(0);
  const importedFields = useRef(new Map<string, Set<EvidenceField>>());
  const currentSession = useRef<{ experiment: Experiment | null; dirty: boolean }>({ experiment: null, dirty: false });
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const attemptHeading = useRef<HTMLHeadingElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const active = experiment?.attempts.find((attempt) => attempt.id === activeId) ?? experiment?.attempts[0];
  const activeIndex = active ? experiment!.attempts.indexOf(active) : -1;
  const baseline = experiment?.attempts.find((attempt) => attempt.id === compareA) ?? experiment?.attempts[0];
  const variant = experiment?.attempts.find((attempt) => attempt.id === compareB) ?? experiment?.attempts[1];
  const sharedConditions = baseline && variant ? conditionFields.filter((field) => baseline.conditions[field.key].length > 0 && baseline.conditions[field.key] === variant.conditions[field.key]) : [];
  const differingConditions = baseline && variant ? conditionFields.filter((field) => baseline.conditions[field.key] !== variant.conditions[field.key]) : [];
  const missingSharedConditions = baseline && variant ? conditionFields.filter((field) => !baseline.conditions[field.key].length && !variant.conditions[field.key].length) : [];
  const disclosure = experiment ? getDisclosureStatus(experiment.disclosure.challenge) : null;
  const synthetic = experiment?.tags.includes("synthetic-example") ?? false;
  const markdown = useMemo(() => {
    if (view !== "export") return { text: "", error: "Open Export to prepare a private note." };
    if (!experiment) return { text: "", error: "Start an experiment to prepare a note." };
    try { return { text: exportExperimentMarkdown(experiment, { omittedFields: omitted, includeReportSnapshots: includeReports }), error: "" }; }
    catch (reason) { return { text: "", error: reason instanceof Error ? reason.message : "The private note is not ready yet." }; }
  }, [experiment, omitted, includeReports, view]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (pending && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!pending && dialog.current?.open) dialog.current.close();
  }, [pending]);

  function setPending(next: Pending | null) {
    pendingRef.current = next;
    setPendingState(next);
  }

  function commit(next: Experiment) {
    const checked = validateExperiment(next);
    if (!checked.ok) { setError(checked.error); return false; }
    currentSession.current = { experiment: checked.experiment, dirty: true };
    setExperiment(checked.experiment);
    setDirty(true);
    setError("");
    setStatus("");
    return true;
  }

  function updateDocument(change: (current: Experiment) => Experiment) {
    if (!experiment) return;
    commit({ ...change(experiment), updatedAt: new Date().toISOString() });
  }

  function updateAttempt(change: (current: Attempt) => Attempt) {
    if (!active || !experiment) return;
    const now = new Date().toISOString();
    updateDocument((current) => ({ ...current, attempts: current.attempts.map((attempt) => attempt.id === active.id ? { ...change(attempt), updatedAt: now } : attempt) }));
  }

  function updateEvidence(field: Exclude<EvidenceField, "context">, value: string) {
    updateAttempt((attempt) => ({ ...attempt, [field]: value, acquisition: {
      ...attempt.acquisition,
      [field]: importedFields.current.get(attempt.id)?.has(field) || attempt.acquisition[field] === "imported" ? "browser-edited" : attempt.acquisition[field],
    } }));
  }

  function replace(next: Experiment, imported: boolean, saved?: SavedExperimentSummary) {
    workspaceGeneration.current += 1;
    setExperiment(next);
    setActiveId(next.attempts[0]?.id ?? null);
    setCompareA(next.attempts[0]?.id ?? null);
    setCompareB(next.attempts[1]?.id ?? null);
    importedFields.current = new Map(imported ? next.attempts.map((attempt) => [attempt.id, new Set(evidenceFields.map((field) => field.key))]) : []);
    const changed = !saved && !imported && next.tags.includes("synthetic-example");
    currentSession.current = { experiment: next, dirty: changed };
    setDirty(changed);
    setDefaultsOpen(!imported && next.attempts.length === 0);
    setOmitted([]);
    setIncludeReports(true);
    setComparisonView("originals");
    setView("compose");
    setPending(null);
    setError("");
    savedRecordRef.current = saved ?? null;
    setSavedRecord(saved ?? null);
    setSaveConflict(false);
    setStatus(saved ? "Saved experiment opened. Exact captured evidence and condition snapshots were preserved." : imported ? "Backup restored. Exact captured evidence and condition snapshots were preserved." : next.tags.includes("synthetic-example") ? "Synthetic example loaded. Its content is authored, not a real run." : "Blank experiment started. Nothing has been tested.");
  }

  function requestReplacement(next: Experiment, imported: boolean, label: string, saved?: SavedExperimentSummary) {
    if (currentSession.current.experiment && currentSession.current.dirty) setPending({ kind: "replace", next, imported, label, saved });
    else replace(next, imported, saved);
  }

  function unlocked(session: ResearchVaultSession) {
    vaultRef.current = session;
    setVaultSession(session);
    setStatus("Local vault unlocked. Choose Save locally to store the current draft; nothing was saved automatically.");
  }

  async function saveLocally(asNewCopy = false) {
    const source = currentSession.current.experiment;
    const session = vaultRef.current;
    if (!source || savingRef.current) return false;
    if (!session) { setLibraryOpen(true); setStatus("Unlock or create the local vault, then choose Save locally again."); return false; }
    const generation = workspaceGeneration.current;
    const idMap = new Map(asNewCopy ? source.attempts.map((attempt) => [attempt.id, crypto.randomUUID()]) : []);
    const snapshot: Experiment = asNewCopy ? { ...source, id: crypto.randomUUID(), attempts: source.attempts.map((attempt) => ({
      ...attempt, id: idMap.get(attempt.id)!, parentId: attempt.parentId ? idMap.get(attempt.parentId)! : null,
    })) } : source;
    const expected = !asNewCopy && savedRecordRef.current?.id === source.id ? savedRecordRef.current.revision : null;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const summary = await session.save(snapshot, expected);
      if (vaultRef.current !== session) return false;
      setLibraryRefresh((value) => value + 1);
      if (workspaceGeneration.current !== generation) return false;
      const unchanged = currentSession.current.experiment === source;
      if (asNewCopy && unchanged) {
        const previousImported = importedFields.current;
        replace(snapshot, false, summary);
        importedFields.current = new Map(source.attempts.flatMap((attempt) => {
          const fields = previousImported.get(attempt.id);
          return fields ? [[idMap.get(attempt.id)!, fields] as const] : [];
        }));
        setStatus("Saved as a separate encrypted copy. The original saved record is unchanged.");
      } else if (!asNewCopy) {
        savedRecordRef.current = summary;
        setSavedRecord(summary);
        currentSession.current = { experiment: currentSession.current.experiment, dirty: !unchanged };
        setDirty(!unchanged);
        setStatus(unchanged ? "Experiment saved locally in the encrypted vault. Keep a downloaded backup too." : "The earlier revision was saved locally. Newer edits remain unsaved.");
      } else {
        setStatus("A separate encrypted copy of the submitted revision was saved. Newer edits remain in this unsaved draft.");
      }
      setSaveConflict(false);
      return unchanged;
    } catch (reason) {
      if (workspaceGeneration.current === generation) {
        setSaveConflict(reason instanceof ResearchVaultError && reason.code === "conflict");
        setError(reason instanceof Error ? reason.message : "Saving failed. Your working draft is unchanged; download a private JSON backup.");
      }
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }

  async function openLatest() {
    const session = vaultRef.current;
    const current = currentSession.current.experiment;
    if (!session || !current || savingRef.current) return;
    const generation = workspaceGeneration.current;
    try {
      const record = await session.open(current.id);
      if (vaultRef.current === session && workspaceGeneration.current === generation) requestReplacement(record.experiment, true, "Open the latest saved copy", record.summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The saved copy could not be opened. Your draft is unchanged."); }
  }

  function finishLock() {
    vaultRef.current?.lock();
    vaultRef.current = null;
    savedRecordRef.current = null;
    currentSession.current = { experiment: null, dirty: false };
    importedFields.current.clear();
    workspaceGeneration.current += 1;
    setVaultSession(null);
    setSavedRecord(null);
    setExperiment(null);
    setActiveId(null);
    setCompareA(null);
    setCompareB(null);
    setPending(null);
    setDirty(false);
    setError("");
    setSaveConflict(false);
    setLibraryOpen(false);
    setVaultGeneration((value) => value + 1);
    setStatus("Vault locked. Decrypted records are no longer displayed. Unlock to open a saved experiment.");
  }

  function requestLock() {
    if (savingRef.current) return;
    if (currentSession.current.experiment && currentSession.current.dirty) setPending({ kind: "lock", label: "Lock vault and close this draft?" });
    else finishLock();
  }

  function savedCopyDeleted(id: string) {
    if (currentSession.current.experiment?.id === id) {
      savedRecordRef.current = null;
      setSavedRecord(null);
      currentSession.current = { ...currentSession.current, dirty: true };
      setDirty(true);
      setStatus("Saved copy deleted. Your working draft is still open in memory; save or download it to keep a copy.");
    }
    setLibraryRefresh((value) => value + 1);
  }

  function startBlank() {
    const next = createExperiment();
    requestReplacement({ ...next, attempts: [] }, false, "Start a new blank experiment");
  }

  function startSelectedLab() {
    if (!selectedLab || savingRef.current) return;
    try {
      const prepared = createLabExperiment(selectedLab.id);
      if (!prepared) return;
      requestReplacement(prepared, false, `Start the synthetic lab: ${selectedLab.title}`);
    } catch {
      setError("The synthetic lab draft could not be prepared. Your current work is unchanged.");
    }
  }

  function addAttempt(parent?: Attempt) {
    if (!experiment) return;
    if (experiment.attempts.length >= LIMITS.maxAttempts) { setError(`A session supports up to ${LIMITS.maxAttempts} attempts. Download a backup before starting another.`); return; }
    const next = parent ? duplicateAttempt(parent) : createAttempt(experiment.defaults);
    if (!commit({ ...experiment, updatedAt: new Date().toISOString(), attempts: [...experiment.attempts, next] })) return;
    if (parent) {
      const inherited = (["input", "context"] as const).filter((field) => importedFields.current.get(parent.id)?.has(field));
      if (inherited.length) importedFields.current.set(next.id, new Set(inherited));
    }
    setActiveId(next.id);
    setCompareA(parent?.id ?? experiment.attempts[0]?.id ?? null);
    setCompareB(next.id);
    setView("compose");
    setDefaultsOpen(false);
    setStatus(parent ? "Variant created from its parent conditions. Response, actions, assessment and reported test time are empty." : "New attempt created from the current experiment defaults.");
    window.requestAnimationFrame(() => promptRef.current?.querySelector("textarea")?.focus());
  }

  function openReviewedAttempt(id: string) {
    if (!experiment?.attempts.some((attempt) => attempt.id === id)) return;
    setActiveId(id);
    setView("compose");
    window.requestAnimationFrame(() => attemptHeading.current?.focus());
  }

  function compareReviewedParent(id: string, parentId: string) {
    const attempt = experiment?.attempts.find((item) => item.id === id);
    if (!attempt || attempt.parentId !== parentId || !experiment?.attempts.some((item) => item.id === parentId)) return;
    setCompareA(parentId);
    setCompareB(id);
    setView("compare");
    window.requestAnimationFrame(() => comparisonHeading.current?.focus());
  }

  function moveAttempt(direction: -1 | 1) {
    if (!active || !experiment) return;
    const destination = activeIndex + direction;
    if (destination < 0 || destination >= experiment.attempts.length) return;
    const attempts = [...experiment.attempts];
    [attempts[activeIndex], attempts[destination]] = [attempts[destination], attempts[activeIndex]];
    commit({ ...experiment, attempts, updatedAt: new Date().toISOString() });
  }

  function confirmPending(choice = pendingRef.current) {
    if (!choice || choice !== pendingRef.current || savingRef.current) return;
    if (choice.kind === "lock") { finishLock(); return; }
    if (choice.kind === "replace") { replace(choice.next, choice.imported, choice.saved); return; }
    if (!experiment) return;
    const now = new Date().toISOString();
    const index = experiment.attempts.findIndex((attempt) => attempt.id === choice.id);
    const children = experiment.attempts.filter((attempt) => attempt.parentId === choice.id).length;
    const attempts = experiment.attempts.filter((attempt) => attempt.id !== choice.id).map((attempt) => attempt.parentId === choice.id ? { ...attempt, parentId: null, updatedAt: now } : attempt);
    if (commit({ ...experiment, attempts, updatedAt: now })) {
      setActiveId(attempts[Math.min(index, attempts.length - 1)]?.id ?? null);
      setPending(null);
      setStatus(`Attempt deleted.${children ? ` ${children} remaining ${children === 1 ? "variant has" : "variants have"} no parent reference now.` : ""} Other captured evidence is unchanged.`);
    }
  }

  async function saveAndContinue() {
    const choice = pendingRef.current;
    const workspace = workspaceGeneration.current;
    if (choice && await saveLocally() && choice === pendingRef.current && workspace === workspaceGeneration.current) confirmPending(choice);
  }

  async function restoreFile(file?: File) {
    if (!file) return;
    const request = ++restoreGeneration.current;
    const workspace = workspaceGeneration.current;
    const isCurrent = () => request === restoreGeneration.current && workspace === workspaceGeneration.current;
    if (file.size > LIMITS.maxEncodedBytes) { setError("This backup is larger than 5 MiB. The active experiment is unchanged."); return; }
    try {
      const text = await file.text();
      // A file read cannot reopen evidence after locking, replace a newer
      // experiment, or supersede a more recently selected backup.
      if (!isCurrent()) return;
      const restored = restoreExperiment(text);
      if (!restored.ok) { setError(restored.error); return; }
      requestReplacement(restored.experiment, true, "Restore this private JSON backup");
    } catch {
      if (isCurrent()) setError("The backup could not be read. The active experiment is unchanged.");
    }
  }

  function backup() {
    if (!experiment) return;
    try {
      download(exportExperimentJson(experiment), `nestcipher-private-${shortId(experiment.id)}.json`, "application/json;charset=utf-8");
      setStatus("Private JSON backup download started. It includes all entered content; check your downloads before leaving.");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The backup could not be prepared. Your session is unchanged."); }
  }

  function downloadNote() {
    if (!experiment || !markdown.text) return;
    try {
      download(markdown.text, `nestcipher-private-${shortId(experiment.id)}.md`, "text/markdown;charset=utf-8");
      setStatus("Private Markdown note download started. Move the file into your Obsidian vault when it is available.");
      setError("");
    } catch { setError("The note could not be prepared. Your session is unchanged."); }
  }

  async function copyPrompt() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.input);
      setStatus("Prompt copied exactly as captured. Copying does not execute a test.");
      setError("");
    } catch { setError("Clipboard access was unavailable. Select the prompt text and copy it manually."); }
  }

  function updateChallenge(change: Partial<Experiment["disclosure"]["challenge"]>) {
    if (!experiment) return;
    const challenge = { ...experiment.disclosure.challenge, ...change };
    if (!challenge.endsAt) challenge.endConfirmed = false;
    try { commit(withChallenge(experiment, challenge)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The challenge time could not be applied. Your current record is unchanged."); }
  }

  function attemptLabel(attempt: Attempt) {
    return `Attempt ${String((experiment?.attempts.indexOf(attempt) ?? -1) + 1).padStart(2, "0")}`;
  }

  function conditionComparison(field: (typeof conditionFields)[number]) {
    if (!baseline || !variant) return null;
    return <div className={styles.compareRow} key={field.key}><h3>{field.label} <span>{baseline.conditions[field.key] === variant.conditions[field.key] ? "Same captured value" : "Different captured values"}</span></h3><div className={styles.compareValues}><div><span>Baseline · {attemptLabel(baseline)}</span><Evidence value={baseline.conditions[field.key]} /></div><div><span>Variant · {attemptLabel(variant)}</span><Evidence value={variant.conditions[field.key]} /></div></div></div>;
  }

  const disclosureText = !disclosure || disclosure.status === "end-unknown"
    ? "Challenge end unknown. Public disclosure remains restricted."
    : disclosure.status === "end-unconfirmed"
      ? "Challenge end is not confirmed. Public disclosure remains restricted."
      : disclosure.status === "embargoed"
        ? "Public disclosure remains restricted until at least 30 days after the confirmed challenge end."
        : "The earliest disclosure date has been reached. This experiment and every export remain private; nothing is published automatically.";
  const disclosureSummary = disclosure?.publicNotBefore
    ? `Private · ${disclosure.status === "window-reached" ? "Earliest date reached" : "Restricted until"} ${disclosure.publicNotBefore.replace("T", " ").replace(".000Z", " UTC")}`
    : `Private · ${disclosure?.status === "end-unconfirmed" ? "End unconfirmed" : "End unknown"}`;
  const storageStatus = savedRecord ? dirty ? "Unsaved changes" : `Saved locally · ${savedRecord.savedAt.replace("T", " ").replace(".000Z", " UTC")}` : "Session only";

  return <FieldErrorContext.Provider value={setError}><div className={`site-container ${styles.page}`}>
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {/* Native document navigation clears scripts when crossing the workbench boundary. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/">Home</a>
      <span aria-hidden="true">/</span>
      <a href="/tools">Tools</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Research Workbench</span>
    </nav>
    <header className={`${styles.header} ${experiment ? styles.activeHeader : ""}`}>
      <div><p className="eyebrow">04 / Manual research</p><h1 className="page-title">Research Workbench.</h1><p className="page-description">Frame a question. Keep each attempt. Carry the evidence into Obsidian.</p></div>
      <div className={styles.headerActions}><span className={styles.privateBadge}>Private · publish: false</span><button type="button" className="button-secondary" disabled={!mounted || saving} onClick={() => setLibraryOpen(true)}>Local library</button></div>
    </header>

    {selectedLab && <section className={styles.labCallout} aria-labelledby="selected-lab-heading">
      <div><p className="eyebrow">Synthetic lab / version {selectedLab.version}</p><h2 id="selected-lab-heading">{selectedLab.title}</h2><p>Prepare two private, untested attempts from the authored exercise. Results stay empty; no model runs and nothing is saved automatically.</p></div>
      <div className={styles.labActions}><button type="button" className="button-primary" disabled={!mounted || saving} onClick={startSelectedLab}>Start this lab <span aria-hidden="true">↗</span></button><a href={`/labs/${selectedLab.id}`} target="_blank" rel="noopener noreferrer">Review the exercise <span aria-hidden="true">↗</span></a></div>
    </section>}

    <div className={styles.sessionNotice} aria-labelledby="session-heading">
      <div><h2 id="session-heading" data-testid="storage-status">{saving ? "Saving submitted revision…" : storageStatus}</h2><p>{experiment ? "Save is explicit. Unsaved changes are lost on reload or close; mobile leaving warnings may not appear. Downloads are readable private files." : "Work without saving, or opt into an encrypted local vault. Optional account backup is a separate action in the local library; no model runs here."}</p></div>
      <div className={styles.utilityActions}>{experiment && <button type="button" className="button-primary" onClick={() => void saveLocally()} disabled={saving}>{saving ? "Saving…" : "Save locally"}</button>}<button type="button" className="button-secondary" aria-label="Download full JSON backup" onClick={backup} disabled={!experiment || saving}>JSON backup</button>{vaultSession && <button type="button" className={styles.textButton} onClick={requestLock} disabled={saving}>Lock vault</button>}</div>
    </div>
    <div className={styles.feedback}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
      {saveConflict && <div className={styles.conflict}><p>A different saved revision exists. Your draft was kept. Open that copy or save this draft under new experiment and attempt IDs.</p><div className={styles.utilityActions}><button type="button" className="button-secondary" onClick={() => void openLatest()} disabled={saving}>Open latest saved copy</button><button type="button" className="button-secondary" onClick={() => void saveLocally(true)} disabled={saving}>Save as new copy</button></div></div>}
    </div>

    <input ref={fileInput} data-testid="restore-experiment" className={styles.hiddenInput} type="file" accept=".json,application/json" aria-label="Restore private JSON backup" tabIndex={-1}
      onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void restoreFile(file); }} />

    {!experiment ? <section className={styles.empty} aria-labelledby="start-heading">
      <div><p className="eyebrow">One experiment. A useful record.</p><h2 id="start-heading">Keep the question<br />beside the evidence.</h2><p>You run the target elsewhere. Record what you sent, what you observed and what changed between attempts.</p></div>
      <div className={styles.emptyActions}><button type="button" className="button-primary" disabled={!mounted} onClick={startBlank}>Start an experiment <span aria-hidden="true">↗</span></button><button type="button" className="button-secondary" disabled={!mounted} onClick={() => requestReplacement(createSyntheticExperiment(), false, "Load the synthetic example")}>Load synthetic example</button><button type="button" className={styles.textButton} disabled={!mounted} onClick={() => fileInput.current?.click()}>Open a JSON backup</button><p>Examples are invented and labelled. Only your own supported NestCipher backup format can be restored.</p></div>
    </section> : <>
      {synthetic && <p className={styles.synthetic}>Synthetic example — authored exercise content, not a real model or challenge run.</p>}
      <section className={styles.setup} aria-labelledby="setup-heading">
        <h2 id="setup-heading" className="sr-only">Experiment setup</h2><div className={styles.experimentBar}><Field id="experiment-title" label="Experiment title" value={experiment.title} onChange={(title) => updateDocument((current) => ({ ...current, title }))} /><div className={styles.utilityActions}><button type="button" className={styles.textButton} onClick={() => fileInput.current?.click()} disabled={saving}>Restore JSON</button><button type="button" className={styles.textButton} onClick={startBlank} disabled={saving}>New experiment</button></div></div>
        {!experiment.attempts.length && <button type="button" className="button-primary" onClick={() => addAttempt()}>Create first attempt from defaults</button>}
        <details className={styles.details} open={defaultsOpen} onToggle={(event) => setDefaultsOpen(event.currentTarget.open)}><summary><span>Edit experiment defaults</span> <span className={styles.summaryNote}>{experiment.defaults.target || "Target unspecified"}</span></summary><p className={styles.help}>Copied when an attempt is created; existing snapshots do not change. A title and one nonblank input prepare a Markdown note. Partial drafts can always be saved or backed up.</p><ConditionFields prefix="defaults" value={experiment.defaults} onChange={(field, value) => updateDocument((current) => ({ ...current, defaults: { ...current.defaults, [field]: value } }))} /></details>
      </section>

      <details className={styles.privacyDetails}><summary>Challenge disclosure <span className={styles.summaryNote}>{disclosureSummary}</span></summary><section className={styles.disclosure} aria-labelledby="disclosure-heading">
        <div><p className="eyebrow">Private research / disclosure timing</p><h2 id="disclosure-heading">Keep findings private.</h2><p>Findings and how a live challenge was broken must not be shared until 30 days after that challenge ends. Private Obsidian notes and backups remain available.</p></div>
        <div><div className={styles.fields}><Field id="challenge-name" label="Challenge name (optional)" value={experiment.disclosure.challenge.name} onChange={(name) => updateChallenge({ name })} />
          <div className={styles.field}><label htmlFor="challenge-end">Challenge end time (UTC, optional)</label><input id="challenge-end" type="datetime-local" step="1" value={utcInput(experiment.disclosure.challenge.endsAt)} onChange={(event) => updateChallenge({ endsAt: fromUtcInput(event.target.value), endConfirmed: false })} /><p className={styles.help}>Record the actual end time in UTC, after confirming the challenge has ended. Scheduled dates can change. An unknown or unconfirmed end keeps the restriction in place.</p></div></div>
          <label className={styles.checkbox}><input type="checkbox" checked={experiment.disclosure.challenge.endConfirmed} disabled={!experiment.disclosure.challenge.endsAt} onChange={(event) => updateChallenge({ endConfirmed: event.target.checked })} /><span>I have confirmed the challenge ended at this time.</span></label>
          <div className={styles.disclosureStatus}><span className={styles.privateBadge}>Private · publish: false</span><p>{disclosureText}</p>{disclosure?.publicNotBefore && <p>Earliest disclosure date: <strong>{new Date(disclosure.publicNotBefore).toISOString().replace("T", " ").replace(".000Z", " UTC")}</strong></p>}<p className={styles.help}>There is no share or publish action. Reaching a date never publishes or changes the privacy of a record.</p></div>
        </div>
      </section></details>

      <div className={styles.workToolbar}><div className={styles.viewSwitch} role="group" aria-label="Workbench view">{(["compose", "review", "compare", "export"] as const).map((item) => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === "compose" ? "Compose" : item === "review" ? "Review" : item === "compare" ? "Compare" : "Export"}</button>)}</div><button type="button" className="button-primary" onClick={() => addAttempt()} disabled={experiment.attempts.length >= LIMITS.maxAttempts}>New attempt <span aria-hidden="true">+</span></button></div>

      {view === "review" && <ResearchAttemptReview key={experiment.id} experiment={experiment} onOpenAttempt={openReviewedAttempt} onCompareParent={compareReviewedParent} />}

      {view === "compose" && <div className={styles.workspace}>
        <aside className={styles.rail} aria-labelledby="attempts-heading"><div className={styles.railHeading}><h2 id="attempts-heading">Attempts</h2><span>{experiment.attempts.length} / {LIMITS.maxAttempts}</span></div>
          <div className={styles.mobileSelector}><label htmlFor="active-attempt">Current attempt</label><select id="active-attempt" value={active?.id ?? ""} disabled={!experiment.attempts.length} onChange={(event) => setActiveId(event.target.value)}>{!experiment.attempts.length && <option value="">No attempts yet</option>}{experiment.attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>{attemptLabel(attempt)} · {executionLabels[attempt.executionState]}</option>)}</select></div>
          <ol className={styles.attemptList}>{experiment.attempts.map((attempt) => <li key={attempt.id}><button type="button" onClick={() => setActiveId(attempt.id)} aria-current={active?.id === attempt.id ? "step" : undefined}><span>{attemptLabel(attempt)}</span><small>{executionLabels[attempt.executionState]}</small><small>{attempt.parentId ? `Variant of ${attemptLabel(experiment.attempts.find((parent) => parent.id === attempt.parentId)!)}` : "No parent attempt"}</small></button></li>)}</ol>
          {!experiment.attempts.length && <p className={styles.help}>No attempts yet. Create one from your experiment defaults.</p>}
        </aside>
        {active ? <section key={active.id} className={styles.editor} aria-labelledby="attempt-heading">
          <div className={styles.sectionBar}><div><p className="eyebrow">Exact input / reported observations</p><h2 id="attempt-heading" ref={attemptHeading} tabIndex={-1}>{attemptLabel(active)}</h2></div><button type="button" className="button-secondary" onClick={() => addAttempt(active)} disabled={experiment.attempts.length >= LIMITS.maxAttempts}>Use as next attempt</button></div>
          <div ref={promptRef}><Field id="attempt-input" label="Prompt input" value={active.input} long evidence onChange={(value) => updateEvidence("input", value)} hint={`Exact captured text · up to ${LIMITS.maxEvidenceLength.toLocaleString()} characters. Nothing is sent from this page.`} /></div>
          <div className={styles.inputActions}><button type="button" className="button-secondary" disabled={!active.input.length} onClick={() => void copyPrompt()}>Copy prompt</button><span>Input acquisition: {active.acquisition.input}</span></div>
          <div className={styles.fields}><Field id="change-note" label="What changed in this attempt?" value={active.changeNote} onChange={(changeNote) => updateAttempt((attempt) => ({ ...attempt, changeNote }))} /><Field id="input-placement" label="Input placement / trust boundary" value={active.inputPlacement} onChange={(inputPlacement) => updateAttempt((attempt) => ({ ...attempt, inputPlacement }))} /></div>
          <details className={styles.details}><summary>Edit this attempt&apos;s conditions</summary><p className={styles.help}>This is the attempt&apos;s own snapshot. Editing it does not update the experiment defaults. Captured {active.createdAt}; NestCipher does not verify a run.</p><ConditionFields prefix="attempt" value={active.conditions} onChange={(field, value) => updateAttempt((attempt) => ({ ...attempt, conditions: { ...attempt.conditions, [field]: value }, acquisition: field === "context" ? { ...attempt.acquisition, context: importedFields.current.get(attempt.id)?.has("context") || attempt.acquisition.context === "imported" ? "browser-edited" : attempt.acquisition.context } : attempt.acquisition }))} /><div className={styles.field}><label htmlFor="authorship">Prompt authorship (reported)</label><select id="authorship" value={active.authorship} onChange={(event) => updateAttempt((attempt) => ({ ...attempt, authorship: event.target.value as Attempt["authorship"] }))}><option value="unspecified">Unspecified</option><option value="manual">Manual</option><option value="ai-assisted">AI-assisted</option></select></div></details>
          <details className={styles.details} open><summary>Record observation <span className={styles.summaryNote}>{executionLabels[active.executionState]} · {actionLabels[active.actionsStatus]}</span></summary><p className={styles.help}>Copying a prompt never changes execution state. Set these fields yourself after testing elsewhere.</p>
          <div className={styles.fields}><div className={styles.field}><label htmlFor="execution-state">Execution state (reported)</label><select id="execution-state" value={active.executionState} onChange={(event) => updateAttempt((attempt) => ({ ...attempt, executionState: event.target.value as Attempt["executionState"] }))}>{Object.entries(executionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className={styles.field}><label htmlFor="reported-test-time">Reported test time (UTC, optional)</label><input id="reported-test-time" type="datetime-local" step="1" value={utcInput(active.reportedTestAt)} onChange={(event) => updateAttempt((attempt) => ({ ...attempt, reportedTestAt: fromUtcInput(event.target.value) }))} /><p className={styles.help}>Researcher-reported; distinct from the capture timestamp.</p></div></div>
          <Field id="attempt-response" label="Response / transcript" value={active.response} long evidence onChange={(value) => updateEvidence("response", value)} />
          <div className={styles.field}><label htmlFor="actions-status">Tool action observation</label><select id="actions-status" value={active.actionsStatus} onChange={(event) => updateAttempt((attempt) => ({ ...attempt, actionsStatus: event.target.value as Attempt["actionsStatus"] }))}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <Field id="attempt-actions" label="Observed tool actions" value={active.actions} long evidence onChange={(value) => updateEvidence("actions", value)} hint="Paste what you actually observed. A refusal in the response does not establish that no action occurred." />
          <Field id="execution-error" label="Execution / provider error details" value={active.executionError} long evidence onChange={(value) => updateEvidence("executionError", value)} />
          <ReportAttachments key={active.id} attempt={active} onAttach={(snapshot) => updateAttempt((attempt) => ({ ...attempt, reportSnapshots: [...(attempt.reportSnapshots ?? []), snapshot] }))} onRemove={(id) => updateAttempt((attempt) => ({ ...attempt, reportSnapshots: (attempt.reportSnapshots ?? []).filter((snapshot) => snapshot.id !== id) }))} onError={setError} />
          </details><details className={styles.details} open><summary>Researcher assessment <span className={styles.summaryNote}>{assessmentLabels[active.assessment]}</span></summary><p className={styles.help}>A manual interpretation of the criterion, separate from captured evidence.</p>
          <div className={styles.field}><label htmlFor="assessment">Researcher assessment</label><select id="assessment" value={active.assessment} onChange={(event) => updateAttempt((attempt) => ({ ...attempt, assessment: event.target.value as Attempt["assessment"] }))}>{Object.entries(assessmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <Field id="assessment-reason" label="Assessment reasoning" value={active.assessmentReason} long evidence onChange={(value) => updateEvidence("assessmentReason", value)} />
          <Field id="attempt-notes" label="Research notes" value={active.notes} long evidence onChange={(value) => updateEvidence("notes", value)} />
          </details>
          <div className={styles.attemptActions}><button type="button" className={styles.textButton} disabled={activeIndex <= 0} onClick={() => moveAttempt(-1)}>Move earlier</button><button type="button" className={styles.textButton} disabled={activeIndex >= experiment.attempts.length - 1} onClick={() => moveAttempt(1)}>Move later</button><button type="button" className={`${styles.textButton} ${styles.dangerButton}`} onClick={() => setPending({ kind: "delete", id: active.id, label: `Delete ${attemptLabel(active)}` })}>Delete attempt</button></div>
        </section> : <section className={styles.editor}><h2>No attempts yet.</h2><p className={styles.help}>Your experiment setup is kept. Add an attempt to capture input.</p><button type="button" className="button-primary" onClick={() => addAttempt()}>Add the first attempt</button></section>}
      </div>}

      {view === "compare" && <section className={styles.comparison} aria-labelledby="comparison-heading"><div className={styles.sectionBar}><div><p className="eyebrow">Conditions / evidence / interpretation</p><h2 id="comparison-heading" ref={comparisonHeading} tabIndex={-1}>Compare two attempts.</h2></div></div><p className={styles.help}>Text changes are not proof of causation. Missing evidence and different conditions remain visible. Baseline and variant are reading labels, not a safety ranking.</p>
        {experiment.attempts.length < 2 ? <div className={styles.comparisonEmpty}><p>Two attempts are needed for comparison.</p><button type="button" className="button-secondary" onClick={() => { setView("compose"); if (active) addAttempt(active); else addAttempt(); }}>{active ? "Create a variant" : "Create an attempt"}</button></div> : <>
          <div className={styles.fields}><div className={styles.field}><label htmlFor="baseline-attempt">Baseline attempt</label><select id="baseline-attempt" value={baseline?.id ?? ""} onChange={(event) => setCompareA(event.target.value)}>{experiment.attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>{attemptLabel(attempt)}</option>)}</select></div><div className={styles.field}><label htmlFor="variant-attempt">Variant attempt</label><select id="variant-attempt" value={variant?.id ?? ""} onChange={(event) => setCompareB(event.target.value)}>{experiment.attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>{attemptLabel(attempt)}</option>)}</select></div></div>
          {baseline && variant && baseline.id !== variant.id ? <>
            <div className={styles.comparisonSwitch} role="group" aria-label="Comparison text view"><button type="button" aria-pressed={comparisonView === "originals"} onClick={() => setComparisonView("originals")}>Originals</button><button type="button" aria-pressed={comparisonView === "changes"} onClick={() => setComparisonView("changes")}>Changes</button></div>
            {missingSharedConditions.length > 0 && <p className={styles.help}>Same captured value — not recorded in either attempt: {missingSharedConditions.map((field) => field.label).join(", ")}. Missing values do not establish matched test conditions.</p>}
            {sharedConditions.length > 0 && <details className={styles.details}><summary>Shared conditions · {sharedConditions.length} captured {sharedConditions.length === 1 ? "value" : "values"}</summary>{sharedConditions.map(conditionComparison)}</details>}
            <div className={styles.compareRows}>
            {differingConditions.map(conditionComparison)}
            {[
              { label: "Prompt input", a: baseline.input, b: variant.input },
              { label: "Response / transcript", a: baseline.response, b: variant.response },
              { label: "Execution state", a: executionLabels[baseline.executionState], b: executionLabels[variant.executionState] },
              { label: "Reported test time", a: baseline.reportedTestAt ?? "", b: variant.reportedTestAt ?? "" },
              { label: "Tool action observation", a: actionLabels[baseline.actionsStatus], b: actionLabels[variant.actionsStatus] },
              { label: "Observed tool actions", a: baseline.actions, b: variant.actions },
              { label: "Execution / provider error details", a: baseline.executionError, b: variant.executionError },
              { label: "Input placement", a: baseline.inputPlacement, b: variant.inputPlacement },
              { label: "What changed", a: baseline.changeNote, b: variant.changeNote },
              { label: "Researcher assessment", a: assessmentLabels[baseline.assessment], b: assessmentLabels[variant.assessment] },
              { label: "Assessment reasoning", a: baseline.assessmentReason, b: variant.assessmentReason },
              { label: "Research notes", a: baseline.notes, b: variant.notes },
            ].map((row) => <div className={styles.compareRow} key={row.label}><h3>{row.label}</h3>{comparisonView === "changes" && ["Prompt input", "Response / transcript", "Observed tool actions", "Execution / provider error details", "Assessment reasoning", "Research notes"].includes(row.label) ? <><ResearchTextDiff baseline={row.a} variant={row.b} label={row.label} /><details className={styles.details}><summary>Read complete originals</summary><div className={styles.compareValues}><div><span>Baseline · {attemptLabel(baseline)}</span><Evidence value={row.a} /></div><div><span>Variant · {attemptLabel(variant)}</span><Evidence value={row.b} /></div></div></details></> : <div className={styles.compareValues}><div><span>Baseline · {attemptLabel(baseline)}</span><Evidence value={row.a} /></div><div><span>Variant · {attemptLabel(variant)}</span><Evidence value={row.b} /></div></div>}</div>)}
          </div></> : <p className={styles.missing}>Choose two different attempts.</p>}
        </>}
      </section>}

      {view === "export" && <section className={styles.export} aria-labelledby="export-heading"><div className={styles.sectionBar}><div><p className="eyebrow">Review / private files</p><h2 id="export-heading">Carry the record forward.</h2></div><span className={styles.privateBadge}>Private · publish: false</span></div><p className={styles.help}>Personal Obsidian exports are available during the embargo. Downloads are marked private; downloading does not publish. Keep these files private during the embargo.</p><div className={styles.exportGrid}>
        <div className={styles.exportOptions}><h3>Include in the private note</h3><p>Omit a whole evidence field across all attempts. Omissions are labelled in Markdown and leave this session unchanged.</p>{evidenceFields.map((field) => <label key={field.key} className={styles.checkbox}><input type="checkbox" checked={!omitted.includes(field.key)} onChange={(event) => setOmitted((current) => event.target.checked ? current.filter((key) => key !== field.key) : [...current, field.key])} /><span>{field.label}</span></label>)}{experiment.attempts.some((attempt) => attempt.reportSnapshots?.length) && <label className={styles.checkbox}><input type="checkbox" checked={includeReports} onChange={(event) => setIncludeReports(event.target.checked)} /><span>Attached report snapshots</span></label>}<button type="button" className="button-primary" disabled={!markdown.text} onClick={downloadNote}>Download private Markdown</button><button type="button" className="button-secondary" onClick={backup}>Download full JSON backup</button><p>Full JSON always contains all entered content and attached reports, including omitted note fields. It is a readable private file, not an encrypted vault archive. Markdown is a readable note.</p></div>
        <div className={styles.preview}><div className={styles.previewHeader}><h3>Private note preview</h3><span>{omitted.length ? `${omitted.length} ${omitted.length === 1 ? "field" : "fields"} omitted` : "Entered evidence included"}</span></div>{markdown.text ? <pre aria-label="Private Markdown preview" tabIndex={0}>{markdown.text}</pre> : <p className={styles.missing}>{markdown.error}</p>}</div>
      </div></section>}
    </>}

    <footer className={styles.toolFooter}><p>Manual research, explicit saving, portable private files. Optional encrypted account backup; research stays private.</p><a href="/community" target="_blank" rel="noopener noreferrer">Open the field guide <span aria-hidden="true">↗</span></a><a href="/privacy" target="_blank" rel="noopener noreferrer">Read privacy details <span aria-hidden="true">↗</span></a></footer>
    <ResearchVaultPanel key={vaultGeneration} open={libraryOpen} session={vaultSession} refresh={libraryRefresh} initialAccountStatus={initialAccountStatus} onClose={() => setLibraryOpen(false)} onUnlocked={unlocked} onOpenExperiment={(next, summary) => requestReplacement(next, true, "Open this saved experiment", summary)} onDeleted={savedCopyDeleted} onLock={requestLock} />
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="replace-heading" onCancel={(event) => { event.preventDefault(); if (!saving) setPending(null); }}>
      <p className="eyebrow">Keep a copy before discarding</p><h2 id="replace-heading">{pending?.label ?? "Replace current work"}</h2><p>{pending?.kind === "delete" ? "This removes the attempt and clears references from its variants. Their remaining evidence is preserved." : pending?.kind === "lock" ? "Locking closes the decrypted working draft. Saved records remain encrypted; unsaved changes would be lost. Save or download a private backup before continuing." : "The working draft will be replaced. Unsaved changes exist only in memory; save locally or download a private backup to keep them."}</p><div className={styles.dialogActions}><button type="button" className="button-secondary" onClick={() => setPending(null)} disabled={saving}>Keep current session</button>{vaultSession && pending?.kind !== "delete" && <button type="button" className="button-primary" onClick={() => void saveAndContinue()} disabled={saving}>{saving ? "Saving…" : "Save and continue"}</button>}<button type="button" className="button-secondary" onClick={backup} disabled={saving}>Download current backup</button><button type="button" className="button-secondary" onClick={() => confirmPending()} disabled={saving}>{pending?.kind === "delete" ? "Delete this attempt" : pending?.kind === "lock" ? "Discard changes and lock" : "Replace current session"}</button></div><p className={styles.help}>Downloads are readable private files. Check that the file is available before discarding your work.</p>{status && <p role="status">{status}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    </dialog>
  </div></FieldErrorContext.Provider>;
}
