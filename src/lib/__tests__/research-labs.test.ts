import { describe, expect, it } from "vitest";
import {
  compareLabConditions,
  createLabExperiment,
  evaluateLabAnswer,
  evaluateLabPermission,
  getResearchLab,
  researchLabs,
  type ResearchLabId,
} from "../research-labs";
import { exportExperimentJson, restoreExperiment, validateExperiment } from "../research-workbench";

const now = "2026-10-10T12:00:00.000Z";
const permitted = "researcher@example.invalid";
const outside = "archive@example.invalid";
const ids: ResearchLabId[] = ["source-authority", "action-evidence", "controlled-comparison"];

describe("authored practice catalog", () => {
  it("provides three distinct versioned labs with internally consistent case answers", () => {
    expect(researchLabs.map((lab) => lab.id)).toEqual(ids);
    for (const lab of researchLabs) {
      expect(lab.version).toBe(1);
      expect(lab.cases).toHaveLength(3);
      expect(new Set(lab.cases.map((item) => item.id)).size).toBe(3);
      for (const item of lab.cases) {
        expect(item.choices.some((choice) => choice.id === item.correctChoiceId)).toBe(true);
        expect(new Set(item.choices.map((choice) => choice.id)).size).toBe(item.choices.length);
        expect(item.explanation.length).toBeGreaterThan(40);
      }
      expect(lab.sources.every((source) => new URL(source.url).protocol === "https:")).toBe(true);
    }
  });

  it.each([undefined, null, 1, [], ["source-authority"], {}, "unknown", "SOURCE-AUTHORITY", " source-authority "])("rejects unsupported lab lookup %j", (id) => {
    expect(getResearchLab(id)).toBeUndefined();
    expect(() => createLabExperiment(id, { now })).toThrow("Choose a supported NestCipher practice lab.");
  });

  it("freezes all shared fixture levels and does not retain session changes", () => {
    const lab = getResearchLab("source-authority")!;
    expect(Object.isFrozen(researchLabs)).toBe(true);
    expect(Object.isFrozen(lab)).toBe(true);
    expect(Object.isFrozen(lab.cases[0].panels)).toBe(true);
    expect(Object.isFrozen(lab.cases[0].permissionGate!.proposal)).toBe(true);
    expect(() => { lab.cases[0].panels[0].text = "Learner edit"; }).toThrow();
    const original = JSON.stringify(researchLabs);
    const experiment = createLabExperiment(lab.id, { now });
    experiment.attempts[0].conditions.context = "Edited context";
    experiment.attempts[0].notes = "Private learner notes";
    expect(JSON.stringify(researchLabs)).toBe(original);
  });
});

describe("finite action permission teaching rule", () => {
  it("checks the actual operation and exact recipient rather than source wording", () => {
    const cases = getResearchLab("source-authority")!.cases;
    expect(evaluateLabPermission(cases[0].permissionGate).allowed).toBe(false);
    expect(evaluateLabPermission(cases[1].permissionGate).allowed).toBe(true);
    expect(evaluateLabPermission(cases[2].permissionGate).allowed).toBe(false);
  });

  it("allows summarising only when no recipient is supplied and the same operation is authorised", () => {
    expect(evaluateLabPermission({
      proposal: { operation: "summarise-agenda", recipient: null },
      authorisation: { source: "trusted-user", operation: "summarise-agenda", recipient: null },
    }).allowed).toBe(true);
    expect(evaluateLabPermission({
      proposal: { operation: "summarise-agenda", recipient: permitted },
      authorisation: { source: "trusted-user", operation: "summarise-agenda", recipient: permitted },
    }).allowed).toBe(false);
  });

  it.each([
    null,
    [],
    { proposal: { operation: "send-agenda", recipient: permitted }, authorisation: null },
    { proposal: { operation: "send-agenda", recipient: permitted }, authorisation: { source: "external-content", operation: "send-agenda", recipient: permitted } },
    { proposal: { operation: "send-agenda", recipient: outside }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: permitted } },
    { proposal: { operation: "send-agenda", recipient: "Researcher@example.invalid" }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: permitted } },
    { proposal: { operation: "send-agenda", recipient: "real@example.com" }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: "real@example.com" } },
    { proposal: { operation: "delete-agenda", recipient: null }, authorisation: { source: "trusted-user", operation: "delete-agenda", recipient: null } },
    { proposal: { operation: "send-agenda", recipient: permitted }, authorisation: { source: "trusted-user", operation: "send-agenda" } },
    { proposal: { operation: "send-agenda", recipient: permitted, override: true }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: permitted } },
    { proposal: { operation: "send-agenda", recipient: permitted }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: permitted }, override: true },
    Object.create({ proposal: { operation: "send-agenda", recipient: permitted }, authorisation: { source: "trusted-user", operation: "send-agenda", recipient: permitted } }),
  ])("fails closed for invalid, expanded or mismatched authorisation %j", (value) => {
    expect(evaluateLabPermission(value).allowed).toBe(false);
  });
});

describe("evidence-aware authored answers", () => {
  it("keeps pre-reveal case metadata and replies neutral about hidden outcomes", () => {
    const cases = getResearchLab("action-evidence")!.cases;
    expect(cases.map((item) => item.title)).toEqual(["Action record A", "Action record B", "Action record C"]);
    expect(new Set(cases.map((item) => item.summary))).toEqual(new Set(["Read the reply, then inspect the authored action record."]));
    expect(new Set(cases.map((item) => item.panels[0].text))).toEqual(new Set(["I have reviewed the meeting agenda."]));
    for (const item of cases) {
      const visibleMetadata = [item.title, item.summary, ...item.panels.map((panel) => panel.text)].join("\n");
      expect(visibleMetadata).not.toMatch(/proposed|complet|blocked|delivered|missing|reject|no delivery/i);
    }
  });

  it.each(["missing-completion", "explicit-block", "completed-effect"])("keeps %s inconclusive when only the identical final reply is visible", (caseId) => {
    const review = evaluateLabAnswer("action-evidence", caseId, "inconclusive", false);
    expect(review).toMatchObject({ valid: true, correct: true, expectedChoiceId: "inconclusive", basis: "reply-only" });
    expect(evaluateLabAnswer("action-evidence", caseId, "criterion-met", false).correct).toBe(false);
    expect(evaluateLabAnswer("action-evidence", caseId, "criterion-not-met", false).correct).toBe(false);
  });

  it("requires strict revelation and uses the positive safety criterion for completed evidence", () => {
    expect(new Set(getResearchLab("action-evidence")!.cases.map((item) => item.panels[0].text)).size).toBe(1);
    expect(evaluateLabAnswer("action-evidence", "missing-completion", "inconclusive", true).correct).toBe(true);
    expect(evaluateLabAnswer("action-evidence", "explicit-block", "criterion-met", true)).toMatchObject({ correct: true, basis: "complete-case" });
    expect(evaluateLabAnswer("action-evidence", "completed-effect", "criterion-not-met", true)).toMatchObject({ correct: true, basis: "complete-case" });
    expect(evaluateLabAnswer("action-evidence", "completed-effect", "criterion-not-met", "true" as unknown as boolean)).toMatchObject({ correct: false, basis: "reply-only" });
  });

  it("assesses each available answer without changing shared cases", () => {
    const original = JSON.stringify(researchLabs);
    for (const lab of researchLabs) {
      for (const item of lab.cases) {
        for (const choice of item.choices) {
          const review = evaluateLabAnswer(lab.id, item.id, choice.id, true);
          expect(review.valid).toBe(true);
          expect(review.correct).toBe(choice.id === item.correctChoiceId);
          expect(review.conclusion).toBe(item.conclusion);
        }
      }
    }
    expect(JSON.stringify(researchLabs)).toBe(original);
  });

  it.each([
    ["bad-lab", "quoted-authority", "external-data"],
    ["source-authority", "bad-case", "external-data"],
    ["source-authority", "quoted-authority", "bad-choice"],
    [["source-authority"], "quoted-authority", "external-data"],
    ["source-authority", ["quoted-authority"], "external-data"],
    ["source-authority", "quoted-authority", ["external-data"]],
  ])("does not score unsupported identifiers", (lab, item, choice) => {
    expect(evaluateLabAnswer(lab, item, choice, true)).toMatchObject({ valid: false, correct: false, expectedChoiceId: null, basis: "invalid" });
  });
});

describe("condition comparisons", () => {
  it("distinguishes exact matches, differences and absence without normalising evidence", () => {
    expect(compareLabConditions([
      { label: "Exact", baseline: "v1", variant: "v1" },
      { label: "Changed", baseline: "v1", variant: "v2" },
      { label: "Both absent", baseline: null, variant: null },
      { label: "One absent", baseline: "v1", variant: null },
      { label: "Empty", baseline: "", variant: "" },
      { label: "Blank", baseline: " ", variant: " " },
      { label: "Line endings", baseline: "A\r\nB", variant: "A\nB" },
      { label: "Unicode", baseline: "é", variant: "e\u0301" },
    ])).toEqual({ matched: ["Exact"], changed: ["Changed", "Line endings", "Unicode"], unknown: ["Both absent", "One absent", "Empty", "Blank"] });
  });

  it("classifies the three authored designs as intended", () => {
    const cases = getResearchLab("controlled-comparison")!.cases;
    const one = compareLabConditions(cases[0].comparison!);
    const many = compareLabConditions(cases[1].comparison!);
    const missing = compareLabConditions(cases[2].comparison!);
    expect(one.changed).toEqual(["Input"]);
    expect(one.unknown).toEqual([]);
    expect(many.changed).toEqual(["Input", "Version", "Context"]);
    expect(missing.changed).toEqual(["Input"]);
    expect(missing.unknown).toEqual(["Version", "Settings"]);
    expect(missing.matched).not.toContain("Version");
  });
});

describe("private untested Workbench practice setup", () => {
  it.each(ids)("prepares %s without claiming the learner ran any fixture", (id) => {
    const experiment = createLabExperiment(id, { now });
    const lab = getResearchLab(id)!;
    expect(validateExperiment(experiment).ok).toBe(true);
    expect(experiment.schemaVersion).toBe(2);
    expect(experiment.createdAt).toBe(now);
    expect(experiment.tags).toEqual(["synthetic-example", "practice-lab", id, "lab-version-1"]);
    expect(experiment.defaults.question).toBe(lab.question);
    expect(experiment.defaults.criterion).toBe(lab.criterion);
    expect(experiment.defaults.modelVersion).toBe("No model — scripted fixture");
    expect(experiment.disclosure).toEqual({
      visibility: "private", publish: false,
      challenge: { name: "", endsAt: null, endConfirmed: false },
      publicNotBefore: null,
    });
    expect(experiment.attempts).toHaveLength(2);
    expect(experiment.attempts[0].parentId).toBeNull();
    expect(experiment.attempts[1].parentId).toBe(experiment.attempts[0].id);
    for (const attempt of experiment.attempts) {
      expect(attempt.authorship).toBe("unspecified");
      expect(attempt.executionState).toBe("not-tested");
      expect(attempt.assessment).toBe("unassessed");
      expect(attempt.actionsStatus).toBe("not-recorded");
      expect(attempt.reportedTestAt).toBeNull();
      expect([attempt.response, attempt.actions, attempt.assessmentReason, attempt.executionError]).toEqual(["", "", "", ""]);
      expect(attempt.reportSnapshots).toBeUndefined();
      expect(attempt.notes).toContain(`${id}, version 1`);
      expect(attempt.notes).toContain("untested");
      expect(attempt.acquisition).toEqual({
        input: "imported", context: "imported", notes: "imported",
        response: "browser-entered", actions: "browser-entered", assessmentReason: "browser-entered", executionError: "browser-entered",
      });
    }
    const restored = restoreExperiment(exportExperimentJson(experiment));
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.experiment).toEqual(experiment);
  });

  it("uses fresh identifiers and independent objects across repeated preparation", () => {
    const first = createLabExperiment("source-authority", { now });
    const second = createLabExperiment("source-authority", { now });
    const identifiers = [first.id, ...first.attempts.map((item) => item.id), second.id, ...second.attempts.map((item) => item.id)];
    expect(new Set(identifiers).size).toBe(6);
    first.attempts[0].conditions.context = "Changed baseline";
    expect(first.attempts[1].conditions.context).toBe(second.attempts[0].conditions.context);
    expect(first.defaults.context).toBe(second.defaults.context);
    expect(second.attempts[1].parentId).toBe(second.attempts[0].id);
  });

  it("preserves the prepared exact evidence and does not insert theory answers or action traces into outcomes", () => {
    const comparison = createLabExperiment("controlled-comparison", { now });
    const authored = getResearchLab("controlled-comparison")!.cases[0].comparison!;
    const inputs = authored.find((row) => row.label === "Input")!;
    const context = authored.find((row) => row.label === "Context")!;
    expect(comparison.attempts.map((item) => item.input)).toEqual([inputs.baseline, inputs.variant]);
    expect(comparison.attempts.map((item) => item.conditions.context)).toEqual([context.baseline, context.variant]);
    const action = createLabExperiment("action-evidence", { now });
    expect(action.attempts.every((item) => item.response === "" && item.actions === "" && item.assessmentReason === "")).toBe(true);
    expect(action.attempts.every((item) => !item.notes.includes("delivered to"))).toBe(true);
  });
});
