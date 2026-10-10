"use client";

import { useMemo, useState } from "react";
import { getResearchReview, type AttemptReviewRow } from "@/lib/research-review";
import type { Attempt, Experiment } from "@/lib/research-workbench";
import styles from "./ResearchAttemptReview.module.css";

type Filter = "all" | "not-tested" | "errors" | "unassessed" | "needs-context";
type Props = { experiment: Experiment; onOpenAttempt: (id: string) => void; onCompareParent: (id: string, parentId: string) => void };
const executionLabels: Record<Attempt["executionState"], string> = { "not-tested": "Not tested", recorded: "Result recorded manually", error: "Execution / provider error reported" };
const assessmentLabels: Record<Attempt["assessment"], string> = { unassessed: "Unassessed", met: "Met criterion", "not-met": "Did not meet criterion", inconclusive: "Inconclusive" };
const actionLabels: Record<Attempt["actionsStatus"], string> = { "not-recorded": "Actions not recorded", "none-observed": "None observed by researcher", recorded: "Actions recorded by researcher" };
const label = (index: number) => `Attempt ${String(index + 1).padStart(2, "0")}`;

function matchesFilter(row: AttemptReviewRow, filter: Filter) {
  return filter === "all" || (filter === "not-tested" && row.executionState === "not-tested")
    || (filter === "errors" && row.executionState === "error")
    || (filter === "unassessed" && row.assessment === "unassessed")
    || (filter === "needs-context" && row.needsContext);
}

export function ResearchAttemptReview({ experiment, onOpenAttempt, onCompareParent }: Props) {
  const review = useMemo(() => getResearchReview(experiment), [experiment]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(experiment.attempts.map((attempt, index) => [attempt.id, { attempt, index }])), [experiment]);
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return review.rows.filter((row) => matchesFilter(row, filter) && (!search || [
      label(row.index), row.changeNote, row.target, row.criterion, byId.get(row.id)?.attempt.input ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(search))));
  }, [review.rows, filter, query, byId]);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All attempts", count: review.counts.total },
    { id: "not-tested", label: "Not tested", count: review.counts.notTested },
    { id: "errors", label: "Reported errors", count: review.counts.errors },
    { id: "unassessed", label: "Unassessed", count: review.counts.unassessed },
    { id: "needs-context", label: "Needs context", count: review.counts.needsContext },
  ];

  function reset() { setFilter("all"); setQuery(""); }

  return <section className={styles.review} aria-labelledby="research-review-heading">
    <header className={styles.header}><div><p className="eyebrow">The experiment / at a glance</p><h2 id="research-review-heading">Review the record.</h2></div><span className={styles.private}>Private · publish: false</span></header>
    <p className={styles.intro}>Find the attempts that need your attention. Execution states and assessments are your recorded entries; field checks help you spot missing context.</p>
    <div className={styles.filters} role="group" aria-label="Filter attempts for review">{filters.map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><span>{item.label}</span><strong>{item.count}</strong></button>)}</div>
    <p className={styles.help}>These counts overlap. They describe recorded fields, rather than test success or research quality.</p>
    <div className={styles.search}><div><label htmlFor="review-search">Find an attempt</label><input id="review-search" type="search" value={query} maxLength={2000} autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} aria-describedby="review-search-help" /><p id="review-search-help" className={styles.help}>Search prompt input, change note, target or criterion.</p></div><button type="button" className="button-secondary" onClick={reset} disabled={filter === "all" && !query}>Reset view</button></div>
    <p className={styles.resultCount} role="status" aria-live="polite">Showing {visible.length} of {review.counts.total} {review.counts.total === 1 ? "attempt" : "attempts"} · Experiment order</p>
    {visible.length ? <>
      <div className={styles.columnLabels} aria-hidden="true"><span>Attempt / conditions</span><span>Recorded state</span><span>Context to review</span><span>Continue</span></div>
      <ol className={styles.register} aria-label="Attempt review register">{visible.map((row) => {
        const parent = row.parentId ? byId.get(row.parentId) : null;
        return <li key={row.id} data-testid={`review-attempt-${row.index + 1}`}>
          <article aria-labelledby={`review-attempt-${row.id}`}>
            <div className={styles.identity}><p className={styles.number}>{String(row.index + 1).padStart(2, "0")}</p><h3 id={`review-attempt-${row.id}`}>{label(row.index)}</h3><p className={styles.parent}>{parent ? `Variant of ${label(parent.index)}` : "No parent attempt"}</p><p className={styles.change}>{row.changeNote || "Change note not entered"}</p><details className={styles.conditions}><summary>Read captured conditions</summary><dl><div><dt>Target</dt><dd>{row.target || "Not entered"}</dd></div><div><dt>Criterion</dt><dd>{row.criterion || "Not entered"}</dd></div></dl></details></div>
            <div className={styles.record}><p className={styles.mobileLabel}>Recorded state</p><p className={styles.execution}>{executionLabels[row.executionState]}</p><p className={styles.assessment}><span>Researcher assessment</span>{assessmentLabels[row.assessment]}</p><p className={styles.actionsState}>{actionLabels[row.actionsStatus]}</p><p className={styles.evidence}>{row.evidence.response ? "Response entered" : "Response not entered"}<br />{row.evidence.actions ? "Action text entered" : "Action text not entered"}{row.evidence.reportCount > 0 && <><br />{row.evidence.reportCount} private {row.evidence.reportCount === 1 ? "report" : "reports"} attached</>}</p></div>
            <div className={styles.context}><p className={styles.mobileLabel}>Context to review</p>{row.flags.length ? <details className={styles.flags}><summary>{row.flags.length} {row.flags.length === 1 ? "field check" : "field checks"}</summary><ul>{row.flags.map((flag) => <li key={flag.code}>{flag.label}</li>)}</ul></details> : <p className={styles.help}>No missing-field flags.</p>}</div>
            <div className={styles.actions}><button type="button" className="button-secondary" onClick={() => onOpenAttempt(row.id)} aria-label={`Open ${label(row.index)}`}>Open attempt <span aria-hidden="true">↗</span></button>{parent && <button type="button" className={styles.compare} onClick={() => onCompareParent(row.id, parent.attempt.id)} aria-label={`Compare ${label(row.index)} with ${label(parent.index)}`}>Compare with parent</button>}</div>
          </article>
        </li>;
      })}</ol>
    </> : <div className={styles.empty}><h3>{review.counts.total ? "No attempts match this view." : "No attempts yet."}</h3><p>{review.counts.total ? "Adjust the search or reset the filters to see the full record." : "Create an attempt from your experiment defaults to start recording."}</p>{review.counts.total > 0 && <button type="button" className="button-secondary" onClick={reset}>Show all attempts</button>}</div>}
  </section>;
}
