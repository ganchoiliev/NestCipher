"use client";

import { useId, useMemo, useState } from "react";
import { compareResearchText, showHiddenCharacters } from "@/lib/research-text-diff";
import styles from "./ResearchTextDiff.module.css";

export function ResearchTextDiff({ baseline, variant, label }: { baseline: string; variant: string; label: string }) {
  const difference = useMemo(() => compareResearchText(baseline, variant), [baseline, variant]);
  const [showHidden, setShowHidden] = useState(true);
  const id = useId();
  if (difference.status === "identical") return <p className={styles.notice}>These values match exactly.</p>;
  if (difference.status === "skipped") return <p className={styles.notice} role="status">{difference.reason}</p>;
  return <div className={styles.diff}>
    <div className={styles.bar}><p>{difference.removed} {difference.removed === 1 ? "line" : "lines"} removed · {difference.added} {difference.added === 1 ? "line" : "lines"} added</p>
      <label htmlFor={id}><input id={id} type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />Show whitespace and hidden characters</label></div>
    <p className={styles.notice}>Text changes do not establish why an outcome changed. The complete originals remain available.</p>
    <div className={styles.lines} tabIndex={0} role="region" aria-label={`${label} text changes`}>
      {difference.rows.map((row, index) => <div className={`${styles.line} ${styles[row.kind]}`} key={index}>
        <span className={styles.kind}>{row.kind === "removed" ? "Removed from baseline" : row.kind === "added" ? "Added in variant" : "Unchanged"}</span>
        <pre>{showHidden ? showHiddenCharacters(row.text) : row.text}{showHidden && <span className={styles.ending}> {row.ending === "\r\n" ? "↵ CRLF" : row.ending === "\r" ? "↵ CR" : row.ending === "\n" ? "↵ LF" : "⟦End of text⟧"}</span>}</pre>
      </div>)}
    </div>
  </div>;
}
