"use client";

import { useEffect, useRef, useState } from "react";
import type { Attempt } from "@/lib/research-workbench";
import type { EmailAnalysisResponse } from "@/types/email-analyzer";
import type { ScanResponse } from "@/types/headers-scanner";
import {
  createEmailReportSnapshot, createHeadersReportSnapshot, exportReportSnapshot,
  REPORT_LIMITS, restoreReportSnapshot, type ReportSnapshot,
} from "@/lib/research-report";
import styles from "./ReportAttachments.module.css";

const reportName = (snapshot: ReportSnapshot) => snapshot.kind === "email-analysis" ? "Email analysis" : "Header scan";

function ReportPreview({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <details className={styles.preview}>
      <summary>Preview private {snapshot.kind === "email-analysis" ? "email" : "header"} report snapshot</summary>
      <pre className={styles.payload} tabIndex={0} aria-label="Report snapshot, inert text">{exportReportSnapshot(snapshot)}</pre>
    </details>
  );
}

function SnapshotNotice() {
  return <p className={styles.help}>Report only: raw source input is excluded. Report findings may quote sensitive content or target URLs. Capture time records copying, not verification. Provider, model, policy version, HTTP method and original submitted target are unknown. This file is private and does not establish full reproducibility.</p>;
}

function downloadSnapshot(snapshot: ReportSnapshot) {
  const url = URL.createObjectURL(new Blob([exportReportSnapshot(snapshot)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  // Never put email excerpts or target URLs into filenames.
  link.download = `nestcipher-report-${snapshot.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

type CaptureProps =
  | { kind: "email-analysis"; report: EmailAnalysisResponse }
  | { kind: "headers-scan"; report: ScanResponse };

/** This receives the completed report, never the currently edited source input. */
export function ReportSnapshotCapture(props: CaptureProps) {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  function prepare() {
    try {
      const next = props.kind === "email-analysis"
        ? createEmailReportSnapshot(props.report) : createHeadersReportSnapshot(props.report);
      setSnapshot(next);
      setError("");
      setStatus("Private report snapshot prepared. Review its contents before downloading.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be captured.");
      setStatus("");
    }
  }
  return (
    <section className={styles.section} aria-label="Private report capture">
      <div className={styles.header}><h3>Keep this report with an attempt</h3><span className={styles.badge}>Private / report only</span></div>
      <p className={styles.help}>Prepare a JSON snapshot of this completed report, then attach the downloaded file in the research workbench. This action does not run the analyzer or scanner again.</p>
      <SnapshotNotice />
      <div className={styles.actions}><button className="button-secondary" type="button" onClick={prepare}>Prepare private report snapshot</button></div>
      {snapshot && <>
        <p className={styles.metadata}>Copied: {snapshot.capturedAt}</p>
        <ReportPreview snapshot={snapshot} />
        <div className={styles.actions}><button className="button-secondary" type="button" onClick={() => {
          try { downloadSnapshot(snapshot); setStatus("Private report JSON download requested. Attach it to an attempt in the workbench."); }
          catch { setError("The private report file could not be downloaded."); }
        }}>Download private report JSON</button></div>
      </>}
      <p className={styles.status} role="status">{status}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

export type ReportAttachmentsProps = {
  attempt: Attempt;
  onAttach: (snapshot: ReportSnapshot) => void;
  onRemove: (id: string) => void;
  onError: (message: string) => void;
};

export function ReportAttachments(props: ReportAttachmentsProps) {
  // A selection change discards pending preview state and cancels the old reader.
  return <AttemptReportAttachments key={props.attempt.id} {...props} />;
}

function AttemptReportAttachments({ attempt, onAttach, onRemove, onError }: ReportAttachmentsProps) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const readGeneration = useRef(0);
  const [candidate, setCandidate] = useState<ReportSnapshot | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readGeneration.current += 1; };
  }, []);
  const snapshots = attempt.reportSnapshots ?? [];
  function fail(message: string) { setError(message); onError(message); }
  async function readFile(file: File) {
    const generation = ++readGeneration.current;
    setReading(true); setCandidate(null); setError("");
    try {
      if (file.size > REPORT_LIMITS.maxEncodedBytes) throw new Error("Choose a report snapshot no larger than 1 MiB. The attempt is unchanged.");
      const checked = restoreReportSnapshot(await file.text());
      if (!alive.current || generation !== readGeneration.current) return;
      if (!checked.ok) { fail(checked.error); return; }
      if (snapshots.some((snapshot) => snapshot.id === checked.snapshot.id)) { fail("This report snapshot is already attached to this attempt."); return; }
      setCandidate(checked.snapshot);
    } catch (cause) {
      if (alive.current && generation === readGeneration.current) fail(cause instanceof Error ? cause.message : "The report file could not be read.");
    } finally {
      if (alive.current && generation === readGeneration.current) setReading(false);
    }
  }
  const alreadyAttached = candidate !== null && snapshots.some((snapshot) => snapshot.id === candidate.id);
  return (
    <section className={styles.section} aria-label="Attached tool reports">
      <div className={styles.header}><h3>Attached tool reports</h3><span className={styles.badge}>{snapshots.length} / {REPORT_LIMITS.maxPerAttempt}</span></div>
      <p className={styles.help}>Attach a completed email or header report using its private JSON snapshot. Import does not read a URL, run a tool, or change this attempt&apos;s conditions, execution state or assessment. Every attachment inherits this experiment&apos;s private disclosure restriction.</p>
      <SnapshotNotice />
      <input ref={input} className={styles.hiddenInput} type="file" accept=".json,application/json" aria-label="Choose private report snapshot JSON" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void readFile(file);
      }} />
      <div className={styles.actions}><button type="button" className="button-secondary" disabled={reading || snapshots.length >= REPORT_LIMITS.maxPerAttempt} onClick={() => input.current?.click()}>{reading ? "Reading report snapshot…" : "Choose report snapshot"}</button></div>
      {snapshots.length >= REPORT_LIMITS.maxPerAttempt && <p className={styles.help}>This attempt has reached the 10-report limit. Remove an attachment before importing another.</p>}
      {candidate && <div className={styles.card}>
        <h4>{reportName(candidate)} report selected</h4>
        <p className={styles.metadata}>Copied: {candidate.capturedAt} / unverified</p>
        <ReportPreview snapshot={candidate} />
        <div className={styles.actions}><button type="button" className="button-secondary" disabled={alreadyAttached || snapshots.length >= REPORT_LIMITS.maxPerAttempt} onClick={() => {
          try { onAttach(candidate); } catch { fail("The report could not be attached. The current draft is unchanged."); }
        }}>{alreadyAttached ? "Report attached" : "Attach report to attempt"}</button></div>
      </div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!snapshots.length && <p className={styles.help}>No tool report snapshots attached.</p>}
      <ul className={styles.list}>{snapshots.map((snapshot, index) => <li className={styles.card} key={snapshot.id}>
        <div className={styles.cardHeader}>
          <div><h4>{reportName(snapshot)} report {index + 1}</h4><p className={styles.metadata}>Copied: {snapshot.capturedAt} / unverified</p></div>
          <button type="button" className={styles.remove} aria-label={`Remove ${reportName(snapshot).toLowerCase()} report ${index + 1}`} onClick={() => onRemove(snapshot.id)}>Remove report</button>
        </div>
        <ReportPreview snapshot={snapshot} />
      </li>)}</ul>
    </section>
  );
}
