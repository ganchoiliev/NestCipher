import { describe, expect, it } from "vitest";
import { createAttempt, createExperiment, duplicateAttempt, validateExperiment, withChallenge, type Attempt, type Experiment } from "../research-workbench";
import { createHeadersReportSnapshot } from "../research-report";
import { getResearchReview, type AttemptReviewFlagCode } from "../research-review";

const NOW = "2026-10-10T12:00:00.000Z";
const fixture = () => {
  const experiment = createExperiment({ now: NOW });
  experiment.attempts[0].conditions.target = "Invented model under test";
  experiment.attempts[0].conditions.criterion = "Keep the invented marker private.";
  return experiment;
};
const codes = (experiment: Experiment): AttemptReviewFlagCode[] => getResearchReview(experiment).rows[0].flags.map((flag) => flag.code);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("local attempt review", () => {
  it("preserves manual not-tested and unassessed states without treating a prompt or notes as a run", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.input = "An invented prompt awaiting a run.";
    attempt.notes = "Plan: compare with another prompt later.";
    attempt.conditions.context = "Invented setup, not an observation.";
    const review = getResearchReview(experiment);
    expect(review.counts).toEqual({ total: 1, notTested: 1, errors: 0, unassessed: 1, needsContext: 0 });
    expect(review.rows[0]).toMatchObject({ executionState: "not-tested", assessment: "unassessed", flags: [],
      evidence: { input: true, context: true, response: false, actions: false, error: false, notes: true } });
  });

  it("handles an experiment with no attempts without inventing a review row", () => {
    const experiment = fixture();
    experiment.attempts = [];
    expect(getResearchReview(experiment)).toEqual({ rows: [], counts: { total: 0, notTested: 0, errors: 0, unassessed: 0, needsContext: 0 } });
  });

  it("uses each attempt's own historical conditions and retains original order and parent IDs", () => {
    const experiment = fixture();
    const parent = experiment.attempts[0];
    const variant = duplicateAttempt(parent, { now: NOW });
    variant.conditions.target = "Different reported target";
    variant.conditions.criterion = "Different reported criterion";
    variant.changeNote = "Changed the intended criterion, not a result.";
    experiment.attempts = [variant, parent];
    experiment.defaults.target = "New defaults must not replace history";
    experiment.defaults.criterion = "A future attempt's default criterion";
    const review = getResearchReview(experiment);
    expect(review.rows.map(({ id, index, parentId, target, criterion }) => ({ id, index, parentId, target, criterion }))).toEqual([
      { id: variant.id, index: 0, parentId: parent.id, target: variant.conditions.target, criterion: variant.conditions.criterion },
      { id: parent.id, index: 1, parentId: null, target: parent.conditions.target, criterion: parent.conditions.criterion },
    ]);
    expect(review.rows[0].changeNote).toBe(variant.changeNote);
  });

  it("identifies blank target and criterion without filling them from experiment defaults or normalizing strings", () => {
    const experiment = fixture();
    experiment.defaults.target = "A newer default";
    experiment.defaults.criterion = "A newer criterion";
    experiment.attempts[0].conditions.target = " \t\r\n ";
    experiment.attempts[0].conditions.criterion = "";
    const row = getResearchReview(experiment).rows[0];
    expect(row.target).toBe(" \t\r\n ");
    expect(row.criterion).toBe("");
    expect(row.flags).toEqual([
      { code: "missing-target", label: "Target is blank", field: "conditions.target" },
      { code: "missing-criterion", label: "Criterion is blank", field: "conditions.criterion" },
    ]);
    expect(row.needsContext).toBe(true);
  });

  it.each(["met", "not-met", "inconclusive"] as const)("prompts inspection of an unexplained %s assessment and preserves that assessment", (assessment) => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.executionState = "recorded";
    attempt.response = "Researcher-entered observation";
    attempt.assessment = assessment;
    const review = getResearchReview(experiment);
    expect(review.rows[0].flags.map((flag) => flag.code)).toEqual(["missing-assessment-reason"]);
    expect(review.rows[0].assessment).toBe(assessment);
    expect(review.counts.unassessed).toBe(0);
    attempt.assessmentReason = "Researcher's own explanation, not verified here.";
    expect(getResearchReview(experiment).rows[0].flags).toEqual([]);
  });

  it("does not require reasoning for an unassessed attempt or infer an assessment from reasoning text", () => {
    const experiment = fixture();
    expect(codes(experiment)).not.toContain("missing-assessment-reason");
    experiment.attempts[0].assessmentReason = "Possible interpretation to investigate later.";
    expect(getResearchReview(experiment).rows[0].assessment).toBe("unassessed");
    expect(codes(experiment)).toEqual([]);
  });

  it("distinguishes an unspecified action observation from explicitly reported none observed", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.executionState = "recorded";
    expect(codes(experiment)).toEqual(["missing-observation-text"]);
    attempt.actionsStatus = "none-observed";
    expect(codes(experiment)).toEqual([]);
    expect(getResearchReview(experiment).rows[0]).toMatchObject({ actionsStatus: "none-observed", evidence: { actions: false } });
  });

  it("does not infer absence of actions from a refusal or infer action status from pasted action text", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.executionState = "recorded";
    attempt.response = "I cannot do that.";
    let row = getResearchReview(experiment).rows[0];
    expect(row.actionsStatus).toBe("not-recorded");
    expect(row.evidence.actions).toBe(false);
    attempt.actions = "A pasted record whose completion has not been verified.";
    row = getResearchReview(experiment).rows[0];
    expect(row.actionsStatus).toBe("not-recorded");
    expect(row.evidence.actions).toBe(true);
    expect(row.assessment).toBe("unassessed");
  });

  it("flags actions marked recorded with an empty field without requiring unrelated response text", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.executionState = "recorded";
    attempt.actionsStatus = "recorded";
    expect(codes(experiment)).toEqual(["missing-action-text"]);
    attempt.actions = "The researcher recorded an action trace here.";
    expect(codes(experiment)).toEqual([]);
    expect(getResearchReview(experiment).rows[0].evidence.response).toBe(false);
  });

  it("keeps error status separate from interpretation and flags only its empty details field", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.executionState = "error";
    attempt.assessment = "met";
    attempt.assessmentReason = "The positive criterion concerned refusing an unsupported call.";
    expect(codes(experiment)).toEqual(["missing-error-detail"]);
    attempt.executionError = "Researcher-reported unsupported-operation error.";
    const review = getResearchReview(experiment);
    expect(review.rows[0].flags).toEqual([]);
    expect(review.rows[0].assessment).toBe("met");
    expect(review.counts).toEqual({ total: 1, notTested: 0, errors: 1, unassessed: 0, needsContext: 0 });
  });

  it.each(["response", "actions", "executionError", "reportedTestAt", "assessment"] as const)("flags %s beside a not-tested state without changing the reported state", (field) => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    if (field === "reportedTestAt") attempt.reportedTestAt = NOW;
    else if (field === "assessment") { attempt.assessment = "inconclusive"; attempt.assessmentReason = "No verified run has been established."; }
    else attempt[field] = "Recorded information awaiting review";
    const review = getResearchReview(experiment);
    expect(review.rows[0].flags.map((flag) => flag.code)).toEqual(["test-state-unset"]);
    expect(review.rows[0].executionState).toBe("not-tested");
    expect(review.counts.notTested).toBe(1);
  });

  it("preserves whitespace, invisible characters and exact hostile evidence as presence rather than interpreting it", () => {
    const experiment = fixture();
    const attempt = experiment.attempts[0];
    attempt.input = "\u200B";
    attempt.conditions.context = "\r\n";
    attempt.executionState = "recorded";
    attempt.response = "  ";
    attempt.actionsStatus = "recorded";
    attempt.actions = "\t";
    attempt.executionError = "\u202E";
    attempt.assessment = "met";
    attempt.assessmentReason = "\uD800";
    attempt.notes = "<script>fetch('https://example.invalid')</script>\r\npublish:true";
    const before = structuredClone(experiment);
    const row = getResearchReview(experiment).rows[0];
    expect(row.evidence).toEqual({ input: true, context: true, response: true, actions: true, error: true, assessmentReason: true, notes: true, reportCount: 0 });
    expect(row.flags).toEqual([]);
    expect(experiment).toEqual(before);
    const summary = JSON.stringify(row);
    expect(summary).not.toContain("https://example.invalid");
    expect(summary).not.toContain("publish:true");
  });

  it("counts attached reports without treating their grades or timestamps as a tested outcome", () => {
    const experiment = fixture();
    experiment.attempts[0].reportSnapshots = [createHeadersReportSnapshot({
      url: "https://example.invalid/invented", grade: "A+", score: 100, maxScore: 100, scannedAt: NOW,
      headers: [{ name: "Synthetic-Header", present: true, value: "Invented", score: 100, maxScore: 100, status: "pass", description: "An invented report, not a run.", recommendation: null }],
      serverInfo: { ip: null, server: null, poweredBy: null },
    }, { now: NOW })];
    const review = getResearchReview(experiment);
    expect(review.rows[0]).toMatchObject({ executionState: "not-tested", assessment: "unassessed", flags: [], evidence: { reportCount: 1, response: false, actions: false } });
    expect(review.counts).toEqual({ total: 1, notTested: 1, errors: 0, unassessed: 1, needsContext: 0 });
    expect(JSON.stringify(review)).not.toContain("A+");
    expect(JSON.stringify(review)).not.toContain("https://example.invalid");
  });

  it("counts each row with gaps once and independently counts reported states", () => {
    const experiment = fixture();
    const first = experiment.attempts[0];
    first.conditions.target = "";
    first.conditions.criterion = "";
    first.actionsStatus = "recorded";
    const second = createAttempt({ ...experiment.defaults, target: "Another invented target", criterion: "Criterion" }, { now: NOW });
    second.executionState = "error";
    second.executionError = "A recorded error";
    second.assessment = "inconclusive";
    second.assessmentReason = "The error prevents interpreting the response.";
    experiment.attempts.push(second);
    const review = getResearchReview(experiment);
    expect(review.rows[0].flags).toHaveLength(3);
    expect(review.rows[1].flags).toEqual([]);
    expect(review.counts).toEqual({ total: 2, notTested: 1, errors: 1, unassessed: 1, needsContext: 1 });
  });

  it("does not mutate a deeply frozen experiment, its provenance, history or disclosure restriction", () => {
    const experiment = withChallenge(fixture(), { name: "Private live challenge", endsAt: "2026-10-11T00:00:00.000Z", endConfirmed: false });
    const before = JSON.stringify(experiment);
    freeze(experiment);
    const review = getResearchReview(experiment);
    review.rows[0].target = "A changed detached review label";
    review.rows[0].flags.push({ code: "missing-target", label: "Detached addition", field: "conditions.target" });
    expect(JSON.stringify(experiment)).toBe(before);
    expect(experiment.disclosure).toMatchObject({ visibility: "private", publish: false, publicNotBefore: null });
    expect(validateExperiment(experiment).ok).toBe(true);
  });

  it("recomputes after deliberate edits without stale flags or changing stored IDs", () => {
    const experiment = fixture();
    experiment.attempts[0].conditions.criterion = "";
    const initial = getResearchReview(experiment);
    const attempt = experiment.attempts[0];
    attempt.conditions.criterion = "The manually supplied criterion";
    attempt.executionState = "recorded";
    attempt.response = "The manually supplied response";
    const current = getResearchReview(experiment);
    expect(initial.counts.needsContext).toBe(1);
    expect(initial.counts.notTested).toBe(1);
    expect(current.counts.needsContext).toBe(0);
    expect(current.counts.notTested).toBe(0);
    expect(initial.rows[0].id).toBe(current.rows[0].id);
    expect(current.rows[0].assessment).toBe("unassessed");
  });

  it("reviews all 100 supported attempts while preserving independent manual assessments", () => {
    const experiment = fixture();
    const template = experiment.attempts[0].conditions;
    const assessments: Attempt["assessment"][] = ["unassessed", "met", "not-met", "inconclusive"];
    experiment.attempts = Array.from({ length: 100 }, (_, index) => {
      const attempt = createAttempt(template, { now: NOW });
      attempt.executionState = index % 2 === 0 ? "not-tested" : "recorded";
      attempt.assessment = assessments[index % assessments.length];
      if (attempt.assessment !== "unassessed") attempt.assessmentReason = "Researcher-entered interpretation";
      if (attempt.executionState === "recorded") attempt.response = "Researcher-entered observation";
      return attempt;
    });
    expect(validateExperiment(experiment).ok).toBe(true);
    const review = getResearchReview(experiment);
    expect(review.rows).toHaveLength(100);
    expect(review.counts).toEqual({ total: 100, notTested: 50, errors: 0, unassessed: 25, needsContext: 25 });
    expect(review.rows.map((row) => row.assessment)).toEqual(experiment.attempts.map((attempt) => attempt.assessment));
  });
});
