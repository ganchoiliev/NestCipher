"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GradeLevel, HeaderResult, ScanResponse } from "@/types/headers-scanner";
import {
  MAX_COMPARE_TARGETS,
  buildCompareReport,
  leaksServerInfo,
  parseTargets,
  rowLabel,
  sortRowsByScore,
  summarizeHeaders,
  type CompareRow,
  type CompareRowState,
  type CompareTarget,
} from "@/lib/headers-compare";
import styles from "./HeadersCompare.module.css";

// ── Presentation helpers ──

type Tone = "success" | "info" | "warning" | "danger" | "pending";

function gradeTone(grade: GradeLevel): Tone {
  switch (grade) {
    case "A+":
    case "A":
      return "success";
    case "B":
      return "info";
    case "C":
    case "D":
      return "warning";
    case "F":
      return "danger";
  }
}

const STATUS_WORD: Record<HeaderResult["status"], string> = {
  pass: "pass",
  partial: "partial",
  fail: "fail",
};

/** The ten checks in the order the API returns them; used for pending squares. */
const CHECK_COUNT = 10;

// ── Row ──

function Row({
  row,
  rows,
  position,
  redact,
}: {
  row: CompareRow;
  rows: CompareRow[];
  position: number;
  redact: boolean;
}) {
  const label = rowLabel(row, rows, redact);
  const isRedacted = redact && !row.target.isReference;
  const { state } = row;

  return (
    <li
      className={styles.row}
      data-reference={row.target.isReference ? "true" : "false"}
      aria-busy={state.kind === "scanning"}
    >
      <span className={styles.index} aria-hidden="true">
        {String(position).padStart(2, "0")}
      </span>

      <div className={styles.label}>
        <span className={styles.host} data-redacted={isRedacted ? "true" : "false"}>
          {label}
        </span>
        {row.target.isReference && <span className={styles.tag}>Yours</span>}
      </div>

      <div className={styles.grade}>
        {state.kind === "done" ? (
          <>
            <span className={styles.gradeLetter} data-tone={gradeTone(state.result.grade)}>
              {state.result.grade}
            </span>
            <span className={styles.score}>
              {state.result.score} / {state.result.maxScore}
            </span>
          </>
        ) : (
          <>
            <span className={styles.gradeLetter} data-tone="pending" aria-hidden="true">
              {state.kind === "error" ? "×" : "–"}
            </span>
            <span className={styles.score}>
              {state.kind === "scanning"
                ? "scanning"
                : state.kind === "error"
                  ? "no grade"
                  : "queued"}
            </span>
          </>
        )}
      </div>

      <ul className={styles.checks} aria-label={`Header checks for ${label}`}>
        {state.kind === "done"
          ? state.result.headers.map((h) => (
              <li
                key={h.name}
                className={styles.check}
                data-status={h.status}
                title={`${h.name}: ${STATUS_WORD[h.status]} (${h.score}/${h.maxScore})`}
              >
                <span className="sr-only">
                  {h.name}: {STATUS_WORD[h.status]}
                </span>
              </li>
            ))
          : Array.from({ length: CHECK_COUNT }, (_, i) => (
              <li key={i} className={styles.check} data-status="pending" aria-hidden="true" />
            ))}
      </ul>

      <div className={styles.meta}>
        {state.kind === "done" && (
          <>
            <span>
              {(() => {
                const s = summarizeHeaders(state.result.headers);
                return `${s.passed} pass · ${s.partial} partial · ${s.failed} fail`;
              })()}
            </span>
            {leaksServerInfo(state.result) && (
              <span className={styles.warn}>server software disclosed</span>
            )}
          </>
        )}
        {state.kind === "scanning" && <span>Fetching response headers</span>}
        {state.kind === "error" && (
          <span className={styles.error} role="alert">
            Could not scan: {state.message}
          </span>
        )}
      </div>

      {state.kind === "done" && (
        <details className={styles.details}>
          <summary>Header findings</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Header</th>
                <th scope="col">Status</th>
                <th scope="col">Score</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {state.result.headers.map((h) => (
                <tr key={h.name}>
                  <td>{h.name}</td>
                  <td>
                    <span className={styles.statusText} data-status={h.status}>
                      {STATUS_WORD[h.status]}
                    </span>
                  </td>
                  <td>
                    {h.score}/{h.maxScore}
                  </td>
                  <td>
                    <span className={styles.value}>
                      {!h.present ? "missing" : isRedacted ? "hidden" : h.value}
                    </span>
                    {h.recommendation && !isRedacted && (
                      <p className={styles.fix}>{h.recommendation}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </li>
  );
}

// ── Main component ──

export function HeadersCompare() {
  const [othersText, setOthersText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [redact, setRedact] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const parsedCount = useMemo(
    () => parseTargets(othersText, referenceText).length,
    [othersText, referenceText],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const setRowState = (id: string, state: CompareRowState) =>
    setRows((prev) => prev.map((r) => (r.target.id === id ? { ...r, state } : r)));

  const scanOne = async (
    target: CompareTarget,
    signal: AbortSignal,
  ): Promise<CompareRowState> => {
    try {
      const res = await fetch("/api/scan-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.input }),
        signal,
      });
      const data = (await res.json()) as ScanResponse | { error?: string };
      if (!res.ok || !("grade" in data)) {
        return {
          kind: "error",
          message: ("error" in data && data.error) || "the scan failed.",
        };
      }
      return { kind: "done", result: data };
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") throw err;
      return { kind: "error", message: "the scan failed." };
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    const targets = parseTargets(othersText, referenceText);
    if (targets.length < 2) {
      setFormError("Enter at least two sites to compare.");
      return;
    }
    setFormError(null);
    setCopied(false);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setRows(targets.map((target) => ({ target, state: { kind: "idle" } })));
    setRunning(true);
    try {
      for (const target of targets) {
        if (controller.signal.aborted) return;
        setRowState(target.id, { kind: "scanning" });
        const state = await scanOne(target, controller.signal);
        if (controller.signal.aborted) return;
        setRowState(target.id, state);
      }
    } catch {
      // Aborted by reset; the rows are already cleared.
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRows([]);
    setRunning(false);
    setFormError(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    const text = buildCompareReport(visibleRows, redact);
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const visibleRows = sortByScore ? sortRowsByScore(rows) : rows;
  const doneCount = rows.filter((r) => r.state.kind !== "idle" && r.state.kind !== "scanning").length;
  const statusText =
    rows.length === 0
      ? ""
      : running
        ? `Scanning ${Math.min(doneCount + 1, rows.length)} of ${rows.length}`
        : `Scan complete · ${rows.length} sites`;

  return (
    <div className="site-container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools/headers-scanner">Headers Scanner</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Compare</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow">02 / Web security</p>
        <h1 className="page-title">Compare security headers</h1>
        <p className="page-description">
          Scan up to {MAX_COMPARE_TARGETS} websites in one pass and read their
          grades side by side. Mark one as yours to keep it in full view while
          the others stay anonymous.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="tool-workspace" aria-labelledby="compare-input-heading">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-5">
            <h2 id="compare-input-heading" className="text-lg font-semibold tracking-tight">
              Choose the sites
            </h2>
            <span className="font-mono text-xs text-text-muted">
              {parsedCount} / {MAX_COMPARE_TARGETS} SELECTED
            </span>
          </div>
          <form onSubmit={handleRun} aria-busy={running} className={styles.form}>
            <div className={styles.fields}>
              <div>
                <label htmlFor="compare-targets" className={styles.fieldLabel}>
                  Sites to compare
                </label>
                <textarea
                  id="compare-targets"
                  value={othersText}
                  onChange={(e) => setOthersText(e.target.value)}
                  disabled={running}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={4096}
                  placeholder={"example.com\nanother-example.co.uk\nhttps://third.example/pricing"}
                  aria-describedby="compare-targets-hint"
                />
                <p id="compare-targets-hint" className={styles.fieldHint}>
                  One per line. Duplicates are dropped.
                </p>
              </div>
              <div>
                <label htmlFor="compare-reference" className={styles.fieldLabel}>
                  Your site (optional)
                </label>
                <input
                  id="compare-reference"
                  type="text"
                  inputMode="url"
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  disabled={running}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={2048}
                  placeholder="yoursite.co.uk"
                  aria-describedby="compare-reference-hint"
                />
                <p id="compare-reference-hint" className={styles.fieldHint}>
                  Scanned last, highlighted on the board, never hidden.
                </p>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="submit" disabled={running || parsedCount < 2} className="button-primary">
                {running ? "Scanning..." : "Run comparison"}
                <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={redact}
                onClick={() => setRedact((v) => !v)}
              >
                Hide other domains
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-text-muted">
              Each site is fetched once from NestCipher&apos;s server, one after
              another. Nothing is stored. Hiding domains only changes what this
              page shows.
            </p>
            {formError && (
              <p role="alert" className="mt-5 border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
                {formError}
              </p>
            )}
          </form>
        </section>

        <aside className="border border-border-subtle bg-bg-card p-6">
          <p className="eyebrow">How to read it</p>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-text-secondary">
            <p>
              Each square is one of the ten header checks. Filled green passed,
              amber is partial, red is missing or weak. The letter is the same
              grade the single-site scanner gives.
            </p>
            <p>
              A grade describes one response. It is a starting point for a
              review, not a verdict on the whole site.
            </p>
          </div>
          <div className="mt-6 border-t border-border-subtle pt-5">
            <p className="font-mono text-xs text-text-muted">SINGLE SITE</p>
            <Link href="/tools/headers-scanner" className="text-link mt-1">
              Open the full scanner <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>
      </div>

      {rows.length > 0 && (
        <section className={styles.board} aria-labelledby="compare-board-heading">
          <div className={styles.boardHeader}>
            <div>
              <p className="eyebrow">Comparison</p>
              <h2 id="compare-board-heading">Board</h2>
            </div>
            <p className={styles.status} role="status" aria-live="polite" data-busy={running ? "true" : "false"}>
              {statusText}
            </p>
          </div>

          <ol className={styles.rows}>
            {visibleRows.map((row, i) => (
              <Row key={row.target.id} row={row} rows={rows} position={i + 1} redact={redact} />
            ))}
          </ol>

          <div className={styles.checkLegend} aria-hidden="true">
            <span><i style={{ background: "var(--success)" }} /> pass</span>
            <span><i style={{ background: "var(--warning)" }} /> partial</span>
            <span><i style={{ background: "var(--danger)" }} /> fail</span>
            <span><i style={{ border: "1px dashed var(--border-hover)" }} /> pending</span>
          </div>

          <div className={styles.boardActions}>
            <button type="button" className={styles.toggle} aria-pressed={sortByScore} onClick={() => setSortByScore((v) => !v)}>
              Sort by score
            </button>
            <button type="button" className="button-secondary" onClick={handleCopy} disabled={running || doneCount === 0}>
              {copied ? "Copied" : "Copy report"}
            </button>
            <button type="button" className="button-secondary" onClick={handleReset}>
              Start again
            </button>
          </div>
          <span className="sr-only" role="status">
            {copied ? "Report copied to clipboard." : ""}
          </span>
        </section>
      )}
    </div>
  );
}
