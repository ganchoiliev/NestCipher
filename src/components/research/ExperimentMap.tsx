"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { exportExperimentResultsMarkdown, getExperimentMap, type ResultCounts } from "@/lib/experiment-map";
import { getResearchReview, type AttemptReviewFlag } from "@/lib/research-review";
import { LIMITS, type Attempt, type Conditions, type Experiment } from "@/lib/research-workbench";
import styles from "./ExperimentMap.module.css";

export interface ExperimentMapProps {
  experiment: Experiment;
  onOpenAttempt: (id: string) => void;
  onCompareParent: (id: string, parentId: string) => void;
  onPrepareNext: (id: string) => void;
  busy?: boolean;
}

type Mode = "lineage" | "groups";
const attemptLabel = (index: number) => `Attempt ${String(index + 1).padStart(2, "0")}`;
const groupLabel = (index: number) => `Captured input group ${String(index + 1).padStart(2, "0")}`;
const executionLabels: Record<Attempt["executionState"], string> = {
  "not-tested": "Not tested", recorded: "Result recorded manually", error: "Execution / provider error reported",
};
const assessmentLabels: Record<Attempt["assessment"], string> = {
  unassessed: "Unassessed", met: "Met criterion", "not-met": "Did not meet criterion", inconclusive: "Inconclusive",
};
const conditionLabels: { key: keyof Conditions; label: string }[] = [
  { key: "question", label: "Research question" }, { key: "scope", label: "Authorized scope" },
  { key: "target", label: "Target" }, { key: "modelVersion", label: "Model / version" },
  { key: "criterion", label: "Observable criterion" }, { key: "settings", label: "Known settings" },
  { key: "context", label: "Known context" },
];

function ExactText({ text, label }: { text: string; label: string }) {
  const content = <>{text.length > 0 && <pre className={styles.exactText} aria-label={label}>{text}</pre>}{!text.trim().length && <p className={styles.help}>{text.length ? "Blank or whitespace-only; condition unknown." : "Not entered."}</p>}</>;
  return text.length > 2_000 ? <details className={styles.longText}><summary>Read complete {label.toLowerCase()} · {text.length.toLocaleString("en-US")} characters</summary>{content}</details> : content;
}

function CapturedConditions({ attempt }: { attempt: Attempt }) {
  return <details className={styles.conditions}><summary>Read all captured conditions</summary><dl><div><dt>Input placement</dt><dd><ExactText text={attempt.inputPlacement} label="Captured input placement" /></dd></div>{conditionLabels.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd><ExactText text={attempt.conditions[key]} label={`Captured ${label.toLowerCase()}`} /></dd></div>)}</dl></details>;
}

function FieldChecks({ flags }: { flags: AttemptReviewFlag[] }) {
  return flags.length ? <ul className={styles.flags}>{flags.map((flag) => <li key={flag.code}>{flag.label}</li>)}</ul> : <p className={styles.help}>No missing-field flags.</p>;
}

function ResultSummary({ counts, compact = false }: { counts: ResultCounts; compact?: boolean }) {
  return <div className={compact ? styles.compactResults : styles.results}>
    <dl className={styles.stateCounts} aria-label="Entered execution states"><div><dt>Attempt records</dt><dd>{counts.total}</dd></div><div><dt>Not tested</dt><dd>{counts.notTested}</dd></div><div><dt>Recorded-state attempts</dt><dd>{counts.recorded}</dd></div><div><dt>Reported errors</dt><dd>{counts.errors}</dd></div></dl>
    <div className={styles.assessments}><p>Assessments of recorded-state attempts</p><dl><div><dt>Unassessed</dt><dd>{counts.recordedAssessments.unassessed}</dd></div><div><dt>Met criterion</dt><dd>{counts.recordedAssessments.met}</dd></div><div><dt>Did not meet criterion</dt><dd>{counts.recordedAssessments.notMet}</dd></div><div><dt>Inconclusive</dt><dd>{counts.recordedAssessments.inconclusive}</dd></div></dl></div>
    {counts.nonRecordedAssessments > 0 && <p className={styles.outsideAssessment}>{counts.nonRecordedAssessments} {counts.nonRecordedAssessments === 1 ? "assessment" : "assessments"} outside recorded-state attempts. Review the execution state before interpreting these entries.</p>}
  </div>;
}

function PrivateResultsNote({ experiment, busy }: { experiment: Experiment; busy: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function preparePreview() {
    if (busy) return;
    setError("");
    setStatus("");
    try { setPreview(exportExperimentResultsMarkdown(experiment)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The private results note could not be prepared. Your experiment is unchanged."); }
  }

  function downloadPreview() {
    if (!preview || busy) return;
    try {
      const url = URL.createObjectURL(new Blob([preview], { type: "text/markdown;charset=utf-8" }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "nestcipher-private-results.md";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError("");
      setStatus("Private results note download started. This is a readable file; keep it private and check your downloads.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The private results note could not be downloaded. Your experiment is unchanged."); }
  }

  return <section className={styles.note} aria-labelledby="private-results-note-heading"><div className={styles.noteHeading}><div><p className="eyebrow">Keep a research trail</p><h3 id="private-results-note-heading">Private results note</h3></div><button type="button" className="button-secondary" disabled={busy} onClick={preparePreview}>Preview private results note</button></div><p className={styles.help}>Preview a summary of entered states, parent links and captured input groups. Raw inputs, responses, conditions, changes and attached reports are excluded. Experiment title and challenge metadata remain in the note; review them before downloading.</p><p className={styles.help}>The preview reflects this document snapshot. Editing the experiment clears the preview and download. Nothing is saved or sent automatically.</p>{error && <p ref={errorRef} tabIndex={-1} className={styles.error} role="alert">{error}</p>}<p className={styles.status} role="status" aria-live="polite">{status}</p>{preview && <div className={styles.notePreview}><h4 ref={previewHeading} tabIndex={-1}>Review the private note</h4><pre aria-label="Private results note preview">{preview}</pre><button type="button" className="button-secondary" disabled={busy} onClick={downloadPreview}>Download private results note <span aria-hidden="true">↓</span></button></div>}</section>;
}

export function ExperimentMap({ experiment, onOpenAttempt, onCompareParent, onPrepareNext, busy = false }: ExperimentMapProps) {
  const map = useMemo(() => getExperimentMap(experiment), [experiment]);
  const review = useMemo(() => getResearchReview(experiment), [experiment]);
  const byId = useMemo(() => new Map(experiment.attempts.map((attempt, index) => [attempt.id, { attempt, index }])), [experiment]);
  const flagsById = useMemo(() => new Map(review.rows.map((row) => [row.id, row.flags])), [review]);
  const [mode, setMode] = useState<Mode>("lineage");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [noteSource, setNoteSource] = useState({ experiment, generation: 0 });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const attemptHeadingRef = useRef<HTMLHeadingElement>(null);
  const groupHeadingRef = useRef<HTMLHeadingElement>(null);
  // A source change resets the keyed preview before React commits the new document.
  // Its key is an opaque generation number, never serialized research or evidence.
  if (noteSource.experiment !== experiment) setNoteSource({ experiment, generation: noteSource.generation + 1 });
  useEffect(() => { headingRef.current?.focus(); }, []);

  const selectedNode = map.nodes.find((node) => node.id === selectedId) ?? map.nodes[0];
  const selectedRecord = selectedNode ? byId.get(selectedNode.id) : undefined;
  const selectedParent = selectedNode?.parentId ? byId.get(selectedNode.parentId) : undefined;
  const selectedGroup = map.groups.find((group) => group.id === selectedGroupId) ?? map.groups[0];
  const selectedGroupIndex = selectedGroup ? map.groups.findIndex((group) => group.id === selectedGroup.id) : -1;
  const canPrepareNext = experiment.attempts.length < LIMITS.maxAttempts;

  function selectAttempt(id: string, switchMode = false) {
    setSelectedId(id);
    if (switchMode) setMode("lineage");
    window.requestAnimationFrame(() => attemptHeadingRef.current?.focus());
  }

  function selectGroup(id: string) {
    setSelectedGroupId(id);
    window.requestAnimationFrame(() => groupHeadingRef.current?.focus());
  }

  return <section className={styles.map} aria-labelledby="experiment-map-heading">
    <header className={styles.heading}><div><p className="eyebrow">Lineage / captured conditions / entered results</p><h2 id="experiment-map-heading" ref={headingRef} tabIndex={-1}>Trace the experiment.</h2></div><span className={styles.privateBadge}>Private · publish: false</span></header>
    <p className={styles.intro}>Follow how your attempts branch, then inspect records with identical captured inputs and conditions. Execution states and assessments are entered by the researcher.</p>
    <ResultSummary counts={map.counts} />
    <p className={styles.help}>Counts describe entered fields. A recorded state does not verify a model run, and parent links do not prove that a change caused an outcome.</p>
    <div className={styles.modeSwitch} role="group" aria-label="Experiment map view"><button type="button" aria-label="Lineage" aria-pressed={mode === "lineage"} onClick={() => setMode("lineage")}>Lineage <span>{map.nodes.length}</span></button><button type="button" aria-label="Captured input groups" aria-pressed={mode === "groups"} onClick={() => setMode("groups")}>Captured input groups <span>{map.groups.length}</span></button></div>

    {!map.nodes.length ? <div className={styles.empty}><h3>No attempt records yet.</h3><p>Create or prepare an attempt in Compose to trace its lineage and inspect entered results here.</p></div> : mode === "lineage" ? <>
      <div className={styles.viewIntro}><h3>A change has a parent.</h3><p>Original attempt numbers are preserved as branches are displayed. Parent links are researcher-entered; a root is simply an attempt with no parent.</p></div>
      <div className={styles.workspace}>
        <div className={styles.navigation}><p className={styles.columnLabel}>Attempt / parent / entered state</p><ol className={styles.lineage} aria-label="Experiment lineage">{map.nodes.map((node) => {
          const record = byId.get(node.id);
          if (!record) return null;
          const parent = node.parentId ? byId.get(node.parentId) : undefined;
          return <li key={node.id} data-root={node.parentId === null} style={{ "--branch-depth": Math.min(node.depth, 4) } as CSSProperties}><button type="button" data-testid={`map-attempt-${node.id}`} aria-label={`Select ${attemptLabel(node.index)}`} aria-pressed={selectedNode?.id === node.id} className={styles.node} onClick={() => selectAttempt(node.id)}><span className={styles.nodeTitle}><strong>{attemptLabel(node.index)}</strong><span aria-hidden="true">↗</span></span><span className={styles.connection}>{parent ? `From ${attemptLabel(parent.index)} · depth ${node.depth}` : "Root · no parent"}</span><span className={styles.nodeState}>{executionLabels[record.attempt.executionState]}<span>{assessmentLabels[record.attempt.assessment]}</span></span></button></li>;
        })}</ol></div>
        {selectedRecord && selectedNode && <section className={styles.inspector} aria-label="Selected attempt" key={selectedNode.id}><p className={styles.columnLabel}>Inspect the captured record</p><h3 ref={attemptHeadingRef} tabIndex={-1}>{attemptLabel(selectedNode.index)}</h3><p className={styles.identity}>ID / <span>{selectedNode.id}</span></p><dl className={styles.recordStates}><div><dt>Entered execution state</dt><dd>{executionLabels[selectedRecord.attempt.executionState]}</dd></div><div><dt>Researcher assessment</dt><dd>{assessmentLabels[selectedRecord.attempt.assessment]}</dd></div><div><dt>Parent link</dt><dd>{selectedParent ? `${attemptLabel(selectedParent.index)} · depth ${selectedNode.depth}` : "No parent entered"}</dd></div><div><dt>Direct children</dt><dd>{selectedNode.childIds.length}</dd></div></dl><div className={styles.change}><h4>Change note</h4><ExactText text={selectedRecord.attempt.changeNote} label="Captured change note" /></div><div className={styles.input}><h4>Exact captured input</h4><ExactText text={selectedRecord.attempt.input} label="Exact captured input" /></div><CapturedConditions attempt={selectedRecord.attempt} /><div className={styles.fieldChecks}><h4>Field checks</h4><FieldChecks flags={flagsById.get(selectedNode.id) ?? []} /></div><div className={styles.actions}><button type="button" className="button-secondary" disabled={busy} aria-label={`Open ${attemptLabel(selectedNode.index)}`} onClick={() => onOpenAttempt(selectedNode.id)}>Open {attemptLabel(selectedNode.index)} <span aria-hidden="true">↗</span></button>{selectedParent && <button type="button" className="button-secondary" disabled={busy} aria-label={`Compare ${attemptLabel(selectedNode.index)} with ${attemptLabel(selectedParent.index)}`} onClick={() => onCompareParent(selectedNode.id, selectedParent.attempt.id)}>Compare with parent</button>}<button type="button" className="button-primary" disabled={busy || !canPrepareNext} aria-label={`Use ${attemptLabel(selectedNode.index)} as next attempt`} onClick={() => onPrepareNext(selectedNode.id)}>Use as next attempt <span aria-hidden="true">+</span></button></div><p className={styles.help}>{canPrepareNext ? "Creates a new linked, untested attempt with these inputs and conditions. Observations, assessments and attached reports start empty. Save explicitly afterward." : "The 100-attempt document limit is reached. Keep a backup before changing the record."}</p></section>}
      </div>
    </> : <>
      <div className={styles.viewIntro}><h3>Hold the captured fields together.</h3><p>Groups match exact input, input placement and all seven captured condition fields, including blanks. Identical recorded fields do not verify independent trials or identical model behavior.</p></div>
      <div className={styles.workspace}><div className={styles.navigation}><p className={styles.columnLabel}>Exact captured field groups</p><ol className={styles.groups} aria-label="Captured input groups">{map.groups.map((group, index) => <li key={group.id}><button type="button" data-testid={`captured-group-${group.id}`} aria-label={`Select captured input group ${String(index + 1).padStart(2, "0")}`} aria-pressed={selectedGroup?.id === group.id} onClick={() => selectGroup(group.id)}><span className={styles.groupTitle}><strong>{groupLabel(index)}</strong><span>{group.attemptIds.length} {group.attemptIds.length === 1 ? "record" : "records"}</span></span><span className={styles.groupAttempts}>{group.indexes.map(attemptLabel).join(" / ")}</span><span className={styles.groupMeta}>{group.counts.recorded} recorded-state · {group.counts.notTested} not tested · {group.counts.errors} reported errors</span><span className={styles.groupUnknown}>{group.missingFields.length ? `${group.missingFields.length} blank or whitespace-only ${group.missingFields.length === 1 ? "field" : "fields"}` : "No blank captured fields"}</span></button></li>)}</ol></div>
        {selectedGroup && <section className={styles.inspector} aria-label="Selected captured input group" key={selectedGroup.id}><p className={styles.columnLabel}>Same captured fields / entered outcomes</p><h3 ref={groupHeadingRef} tabIndex={-1}>{groupLabel(selectedGroupIndex)}</h3><p className={styles.groupExplanation}>Exact captured field equality across {selectedGroup.attemptIds.length} {selectedGroup.attemptIds.length === 1 ? "record" : "records"}. Each assessment belongs to its own attempt.</p><ResultSummary counts={selectedGroup.counts} compact /><div className={styles.missingFields}><h4>Unknown captured fields</h4>{selectedGroup.missingFields.length ? <><p className={styles.help}>These fields are blank or whitespace-only. Equal blanks preserve a gap in the record.</p><ul>{selectedGroup.missingFields.map((field) => <li key={field}>{field}</li>)}</ul></> : <p className={styles.help}>No blank captured fields. Presence does not verify the accuracy of a condition.</p>}</div><div className={styles.groupRecords}><h4>Inspect each record</h4><ol>{selectedGroup.attemptIds.map((id) => {
          const record = byId.get(id);
          if (!record) return null;
          return <li key={id}><div><h5>{attemptLabel(record.index)}</h5><p className={styles.identity}>ID / <span>{id}</span></p><p className={styles.groupRecordState}>{executionLabels[record.attempt.executionState]} · {assessmentLabels[record.attempt.assessment]}</p><FieldChecks flags={flagsById.get(id) ?? []} /></div><button type="button" className="button-secondary" aria-label={`Inspect ${attemptLabel(record.index)} in lineage`} onClick={() => selectAttempt(id, true)}>Inspect record <span aria-hidden="true">↗</span></button></li>;
        })}</ol></div></section>}
      </div>
    </>}
    <PrivateResultsNote key={noteSource.generation} experiment={experiment} busy={busy} />
    <p className={styles.footerNote}>This view stays private. Live challenge methods remain restricted until 30 full days after the confirmed actual end, and still require your disclosure review. Unknown or unconfirmed end dates remain restricted.</p>
  </section>;
}
