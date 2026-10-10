import type { Attempt, Experiment } from "./research-workbench";

export type AttemptReviewFlagCode =
  | "missing-target" | "missing-criterion" | "missing-assessment-reason"
  | "missing-action-text" | "missing-error-detail" | "missing-observation-text" | "test-state-unset";

export type AttemptReviewField =
  | "conditions.target" | "conditions.criterion" | "assessmentReason"
  | "actions" | "executionError" | "response" | "executionState";

export interface AttemptReviewFlag {
  code: AttemptReviewFlagCode;
  label: string;
  field: AttemptReviewField;
}

export interface AttemptReviewRow {
  id: string;
  /** Zero-based position in the current experiment, without sorting or renumbering its data. */
  index: number;
  parentId: string | null;
  changeNote: string;
  target: string;
  criterion: string;
  executionState: Attempt["executionState"];
  actionsStatus: Attempt["actionsStatus"];
  assessment: Attempt["assessment"];
  needsContext: boolean;
  flags: AttemptReviewFlag[];
  evidence: {
    input: boolean;
    context: boolean;
    response: boolean;
    actions: boolean;
    error: boolean;
    assessmentReason: boolean;
    notes: boolean;
    reportCount: number;
  };
}

export interface ResearchReview {
  rows: AttemptReviewRow[];
  counts: {
    total: number;
    notTested: number;
    errors: number;
    unassessed: number;
    needsContext: number;
  };
}

function reviewAttempt(attempt: Attempt, index: number): AttemptReviewRow {
  // Evidence presence describes captured bytes/characters, not substantive quality.
  // Whitespace and invisible characters can be evidence and are never normalized here.
  const evidence = {
    input: attempt.input.length > 0,
    context: attempt.conditions.context.length > 0,
    response: attempt.response.length > 0,
    actions: attempt.actions.length > 0,
    error: attempt.executionError.length > 0,
    assessmentReason: attempt.assessmentReason.length > 0,
    notes: attempt.notes.length > 0,
    reportCount: attempt.reportSnapshots?.length ?? 0,
  };
  const flags: AttemptReviewFlag[] = [];
  if (attempt.conditions.target.trim().length === 0) flags.push({
    code: "missing-target", label: "Target is blank", field: "conditions.target",
  });
  if (attempt.conditions.criterion.trim().length === 0) flags.push({
    code: "missing-criterion", label: "Criterion is blank", field: "conditions.criterion",
  });
  if (attempt.assessment !== "unassessed" && !evidence.assessmentReason) flags.push({
    code: "missing-assessment-reason", label: "Assessment reasoning field is empty", field: "assessmentReason",
  });
  if (attempt.actionsStatus === "recorded" && !evidence.actions) flags.push({
    code: "missing-action-text", label: "Actions are marked recorded; action text is empty", field: "actions",
  });
  if (attempt.executionState === "error" && !evidence.error) flags.push({
    code: "missing-error-detail", label: "Error state is recorded; error details field is empty", field: "executionError",
  });
  if (attempt.executionState === "recorded" && !evidence.response && !evidence.actions
    && attempt.actionsStatus === "not-recorded") flags.push({
    code: "missing-observation-text", label: "Recorded attempt has no response or action observation", field: "response",
  });
  if (attempt.executionState === "not-tested" && (evidence.response || evidence.actions || evidence.error
    || attempt.assessment !== "unassessed" || attempt.reportedTestAt !== null)) flags.push({
    code: "test-state-unset", label: "State is not tested; review recorded test information", field: "executionState",
  });
  return {
    id: attempt.id, index, parentId: attempt.parentId, changeNote: attempt.changeNote,
    target: attempt.conditions.target, criterion: attempt.conditions.criterion,
    executionState: attempt.executionState, actionsStatus: attempt.actionsStatus, assessment: attempt.assessment,
    needsContext: flags.length > 0, flags, evidence,
  };
}

/**
 * Read an already supported experiment without changing its content or interpreting outcomes.
 * Gaps are prompts to inspect the record; they are neither validation errors nor a completeness score.
 * Optional details may be absent intentionally. Counts preserve researcher-reported states.
 */
export function getResearchReview(experiment: Experiment): ResearchReview {
  const rows = experiment.attempts.map(reviewAttempt);
  return {
    rows,
    counts: {
      total: rows.length,
      notTested: rows.filter((row) => row.executionState === "not-tested").length,
      errors: rows.filter((row) => row.executionState === "error").length,
      unassessed: rows.filter((row) => row.assessment === "unassessed").length,
      needsContext: rows.filter((row) => row.needsContext).length,
    },
  };
}
