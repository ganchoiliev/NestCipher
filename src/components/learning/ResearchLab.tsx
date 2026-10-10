"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  compareLabConditions,
  evaluateLabAnswer,
  evaluateLabPermission,
  type ResearchLab as ResearchLabDefinition,
} from "@/lib/research-labs";
import styles from "./ResearchLab.module.css";

const subscribeToHydration = () => () => {};
type Review = ReturnType<typeof evaluateLabAnswer>;
type PermissionReview = ReturnType<typeof evaluateLabPermission>;
type CaseState = {
  choiceId: string;
  recordRevealed: boolean;
  review: Review | null;
  permissionReview: PermissionReview | null;
};
const emptyCaseState = (): CaseState => ({
  choiceId: "",
  recordRevealed: false,
  review: null,
  permissionReview: null,
});

export function ResearchLab({ lab }: { lab: ResearchLabDefinition }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [activeCaseId, setActiveCaseId] = useState(lab.cases[0].id);
  const [caseStates, setCaseStates] = useState<Record<string, CaseState>>({});
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const decisionHeading = useRef<HTMLHeadingElement>(null);
  const activeCase = lab.cases.find((item) => item.id === activeCaseId) ?? lab.cases[0];
  const activeCaseIndex = lab.cases.indexOf(activeCase);
  const state = caseStates[activeCase.id] ?? emptyCaseState();
  const conditions = activeCase.comparison ? compareLabConditions(activeCase.comparison) : null;

  function updateCase(update: Partial<CaseState>) {
    setCaseStates((current) => ({
      ...current,
      [activeCase.id]: { ...(current[activeCase.id] ?? emptyCaseState()), ...update },
    }));
  }

  function chooseCase(id: string) {
    setActiveCaseId(id);
    setNotice("");
  }

  function reviewDecision() {
    if (!state.choiceId) {
      setNotice("Choose a decision before reviewing it.");
      decisionHeading.current?.focus();
      return;
    }
    const review = evaluateLabAnswer(lab.id, activeCase.id, state.choiceId, state.recordRevealed);
    updateCase({ review });
    if (review.valid) {
      setReviewedIds((current) => current.includes(activeCase.id) ? current : [...current, activeCase.id]);
    }
    setNotice("");
  }

  function revealRecord() {
    updateCase({ recordRevealed: true, review: null });
    setNotice("The authored action record is now visible. Review the evidence and revise your decision if needed.");
  }

  function retryCase() {
    updateCase({ choiceId: "", review: null, permissionReview: null });
    setNotice("Decision cleared. The authored evidence is unchanged.");
    decisionHeading.current?.focus();
  }

  return (
    <section className={styles.lab} aria-label={`${lab.title} exercise`}>
      <div className={styles.sessionBar}>
        <span>Authored exercise · no model or tools run</span>
        <span>Session only · {reviewedIds.length} of {lab.cases.length} cases reviewed</span>
      </div>
      <nav className={styles.caseNavigation} aria-label="Choose an exercise case">
        {lab.cases.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={activeCase.id === item.id}
            disabled={!hydrated}
            onClick={() => chooseCase(item.id)}
          >
            <span className={styles.caseNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.caseName}>{item.title}</span>
            {reviewedIds.includes(item.id) && <span className={styles.reviewed}>Reviewed</span>}
          </button>
        ))}
      </nav>

      <div className={styles.workspace}>
        <div className={styles.record}>
          <header className={styles.caseHeader}>
            <p className={styles.label}>Case {String(activeCaseIndex + 1).padStart(2, "0")} / The authored record</p>
            <h2>{activeCase.title}</h2>
            <p>{activeCase.summary}</p>
          </header>
          <section className={styles.trustedTask} aria-labelledby="lab-trusted-task-heading">
            <h3 id="lab-trusted-task-heading">Trusted task</h3>
            <pre>{lab.task}</pre>
          </section>
          <div className={styles.panels}>
            {activeCase.panels.map((panel, index) => (
              <section key={`${activeCase.id}-${index}`} className={styles.evidencePanel}>
                <h3>{panel.label}</h3>
                <pre>{panel.text}</pre>
              </section>
            ))}
          </div>

          {activeCase.comparison && (
            <section className={styles.comparison} aria-labelledby="comparison-heading">
              <h3 id="comparison-heading">Conditions in the record</h3>
              <p>Record the intended change, other changed conditions and unknowns. A difference alone does not prove a cause.</p>
              <div className={styles.tableScroll} role="region" aria-label="Baseline and variant conditions" tabIndex={0}>
                <table>
                  <caption className={styles.visuallyHidden}>A comparison of recorded baseline and variant conditions</caption>
                  <thead><tr><th scope="col">Condition</th><th scope="col">Baseline</th><th scope="col">Variant</th><th scope="col">Record</th></tr></thead>
                  <tbody>
                    {activeCase.comparison.map((row) => {
                      const unknown = conditions?.unknown.includes(row.label) ?? true;
                      const matches = conditions?.matched.includes(row.label) ?? false;
                      return (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.baseline?.trim() ? row.baseline : "Unknown"}</td>
                          <td>{row.variant?.trim() ? row.variant : "Unknown"}</td>
                          <td><span className={unknown ? styles.unknown : matches ? styles.matched : styles.changed}>{unknown ? "Unknown" : matches ? "Matched" : "Different"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {conditions && <p className={styles.conditionSummary}>{conditions.matched.length} matched · {conditions.changed.length} different · {conditions.unknown.length} unknown</p>}
            </section>
          )}

          {activeCase.trace && (
            <section className={styles.trace} aria-labelledby="action-record-heading">
              <div className={styles.traceHeading}>
                <div>
                  <p className={styles.label}>Evidence depth</p>
                  <h3 id="action-record-heading">Authored action record</h3>
                </div>
                <span>{state.recordRevealed ? "Record revealed" : "Reply only"}</span>
              </div>
              {!state.recordRevealed ? (
                <>
                  <p>You can read the reply above. The action record has not been revealed. Decide what that evidence supports before looking further.</p>
                  <button type="button" disabled={!hydrated} className="button-secondary" onClick={revealRecord}>Reveal action record</button>
                </>
              ) : (
                <>
                  <p>These entries were written for the exercise. No action has been executed here.</p>
                  <ol className={styles.traceList}>
                    {activeCase.trace.map((entry, index) => (
                      <li key={`${activeCase.id}-trace-${index}`}>
                        <span className={styles.traceNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                        <div><div className={styles.traceEntryHeader}><h4>{entry.label}</h4><span className={styles.traceState}>{entry.state}</span></div><pre>{entry.text}</pre></div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}
        </div>

        <aside className={styles.decision} aria-label="Your exercise decision">
          <div className={styles.decisionIntro}>
            <p className={styles.label}>Read → Decide → Review</p>
            <h2 ref={decisionHeading} tabIndex={-1}>What does the<br />evidence support?</h2>
            <p>{lab.question}</p>
          </div>
          <div className={styles.criterion}><h3>Exercise criterion</h3><p>{lab.criterion}</p></div>
          <fieldset className={styles.choices} disabled={!hydrated}>
            <legend>Your decision</legend>
            {activeCase.choices.map((choice) => (
              <label key={choice.id} className={styles.choice}>
                <input
                  type="radio"
                  name={`decision-${lab.id}-${activeCase.id}`}
                  value={choice.id}
                  checked={state.choiceId === choice.id}
                  onChange={() => {
                    updateCase({ choiceId: choice.id, review: null });
                    setNotice("");
                  }}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <button type="button" className={`button-primary ${styles.reviewButton}`} disabled={!hydrated} onClick={reviewDecision}>Review decision</button>
          <p className={styles.notice} role="status" aria-live="polite" aria-atomic="true">{notice}</p>

          {state.review && (
            <section className={styles.feedback} aria-label="Decision review" role="status" aria-live="polite">
              <p className={styles.feedbackLabel}>{state.review.correct ? "That matches the record." : "Review the evidence again."}</p>
              <p>{state.review.explanation}</p>
              {state.review.conclusion && <p className={styles.conclusion}><strong>Supported conclusion</strong>{state.review.conclusion}</p>}
              {!state.review.correct && state.review.expectedChoiceId && <p className={styles.expectedChoice}>Expected decision: {activeCase.choices.find((choice) => choice.id === state.review?.expectedChoiceId)?.label}</p>}
              <button type="button" onClick={retryCase}>Try again</button>
            </section>
          )}

          {activeCase.permissionGate && (
            <section className={styles.permission} aria-labelledby="permission-heading">
              <h3 id="permission-heading">Check the permission boundary</h3>
              <p>A fixed check of this case&apos;s proposal against the trusted instruction. It does not execute the action.</p>
              <button type="button" className="button-secondary" disabled={!hydrated} onClick={() => updateCase({ permissionReview: evaluateLabPermission(activeCase.permissionGate) })}>Check authored permission</button>
              {state.permissionReview && <p role="status" className={styles.permissionResult}><strong>{state.permissionReview.allowed ? "Permitted by the trusted instruction" : "Not permitted by the trusted instruction"}</strong>{state.permissionReview.reason}</p>}
            </section>
          )}
          <p className={styles.sessionNote}>Your selections and reviews stay in this page session. Reloading clears them.</p>
        </aside>
      </div>
    </section>
  );
}
