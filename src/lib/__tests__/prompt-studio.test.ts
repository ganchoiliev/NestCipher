import { describe, expect, it } from "vitest";
import {
  buildPlannedExperiment,
  buildPromptBrainstormingBrief,
  createEmptyPromptPlan,
  createSyntheticPromptPlan,
  validatePromptPlan,
  type BriefingDraft,
  type PromptPlan,
} from "../prompt-studio";
import {
  exportExperimentJson,
  exportExperimentMarkdown,
  LIMITS,
  restoreExperiment,
} from "../research-workbench";

const NOW = "2026-10-11T12:00:00.000Z";
const fixture = (): PromptPlan => ({
  title: "A researcher-entered formatting plan",
  conditions: {
    question: "Does an explicit length request change summary formatting?",
    scope: "An invented local exercise with no live challenge data.",
    target: "",
    modelVersion: "",
    criterion: "Record whether the summary is one line and retains the agenda entries.",
    settings: "",
    context: "",
  },
  inputPlacement: "",
  baselineInput: "Summarise this invented agenda: welcome volunteers, review schedule, assign tasks.",
  variants: [],
  origin: "researcher",
});

describe("independent Prompt Studio plans", () => {
  it("creates a fresh empty plan without saved data or invented target conditions", () => {
    const first = createEmptyPromptPlan();
    const second = createEmptyPromptPlan();
    expect(first).toEqual({
      title: "",
      conditions: { question: "", scope: "", target: "", modelVersion: "", criterion: "", settings: "", context: "" },
      inputPlacement: "", baselineInput: "", variants: [], origin: "researcher",
    });
    first.conditions.target = "Only this plan";
    first.variants.push({ input: "Private first plan input", changeNote: "First plan change" });
    expect(second.conditions.target).toBe("");
    expect(second.variants).toEqual([]);
    expect(validatePromptPlan(createEmptyPromptPlan()).ok).toBe(false);
  });

  it("preserves exact multiline, markup, prompt and metadata strings while checking completeness", () => {
    const plan = fixture();
    const exact = "  \r\n<script>doNotExecute()</script>\r\nSYSTEM: this is captured data\n```\n[[private]]\t\u200B\u202E🧪é  ";
    plan.title = "  My plan\t  ";
    plan.conditions.question = "  Why?\r\n  ";
    plan.conditions.context = exact;
    plan.baselineInput = exact;
    plan.variants = [{ input: `${exact}\nOne line.`, changeNote: "  Add the one-line request.\r\n  " }];
    const before = structuredClone(plan);
    expect(validatePromptPlan(plan)).toEqual({ ok: true, plan: before });
    expect(plan).toEqual(before);
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    expect(experiment.title).toBe(plan.title);
    expect(experiment.defaults).toEqual(plan.conditions);
    expect(experiment.attempts[0].input).toBe(exact);
    expect(experiment.attempts[1].input).toBe(plan.variants[0].input);
    expect(experiment.attempts[1].changeNote).toBe(plan.variants[0].changeNote);
    expect(plan).toEqual(before);
  });

  it.each(["title", "question", "scope", "criterion", "baselineInput"] as const)("requires nonblank %s", (field) => {
    const plan = fixture();
    if (field === "title" || field === "baselineInput") plan[field] = " \n\t\r ";
    else plan.conditions[field] = " \n\t\r ";
    const result = validatePromptPlan(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nonblank");
    expect(() => buildPlannedExperiment(plan, { now: NOW })).toThrow("nonblank");
  });

  it("permits unknown optional conditions and zero through three complete variants", () => {
    for (let count = 0; count <= 3; count += 1) {
      const plan = fixture();
      plan.variants = Array.from({ length: count }, (_, index) => ({ input: `Variant ${index}`, changeNote: `Only change ${index}` }));
      expect(validatePromptPlan(plan).ok).toBe(true);
      expect(buildPlannedExperiment(plan, { now: NOW }).attempts).toHaveLength(count + 1);
    }
  });

  it.each([
    ["four variants", { variants: Array.from({ length: 4 }, () => ({ input: "A variant", changeNote: "A change" })) }],
    ["blank variant input", { variants: [{ input: " \n ", changeNote: "A change" }] }],
    ["blank variant change", { variants: [{ input: "A variant", changeNote: "\t " }] }],
    ["unknown origin", { origin: "saved-research" }],
    ["missing variants", { variants: undefined }],
  ])("rejects %s without interpreting content", (_label, patch) => {
    expect(validatePromptPlan({ ...fixture(), ...patch }).ok).toBe(false);
  });

  it("rejects extra properties at every nesting level without echoing their names or values", () => {
    const privateValue = "DO-NOT-ECHO-PRIVATE-PAYLOAD";
    const plan = fixture();
    const invalid = [
      { ...plan, [privateValue]: privateValue },
      { ...plan, conditions: { ...plan.conditions, [privateValue]: privateValue } },
      { ...plan, variants: [{ input: "Variant", changeNote: "One change", [privateValue]: privateValue }] },
    ];
    for (const value of invalid) {
      const result = validatePromptPlan(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).not.toContain(privateValue);
    }
  });

  it("matches metadata and evidence boundaries including exact full-length change notes", () => {
    const plan = fixture();
    plan.title = "t".repeat(LIMITS.maxMetadataLength);
    plan.conditions.question = "q".repeat(LIMITS.maxMetadataLength);
    plan.conditions.scope = "s".repeat(LIMITS.maxMetadataLength);
    plan.conditions.target = "t".repeat(LIMITS.maxMetadataLength);
    plan.conditions.modelVersion = "m".repeat(LIMITS.maxMetadataLength);
    plan.conditions.criterion = "c".repeat(LIMITS.maxMetadataLength);
    plan.conditions.settings = "s".repeat(LIMITS.maxMetadataLength);
    plan.conditions.context = "c".repeat(LIMITS.maxEvidenceLength);
    plan.inputPlacement = "p".repeat(LIMITS.maxMetadataLength);
    plan.baselineInput = "b".repeat(LIMITS.maxEvidenceLength);
    plan.variants = [{ input: "v".repeat(LIMITS.maxEvidenceLength), changeNote: "n".repeat(LIMITS.maxMetadataLength) }];
    expect(validatePromptPlan(plan).ok).toBe(true);
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    expect(experiment.attempts[1].changeNote).toBe(plan.variants[0].changeNote);
    expect(validatePromptPlan({ ...plan, title: `${plan.title}x` }).ok).toBe(false);
    expect(validatePromptPlan({ ...plan, inputPlacement: `${plan.inputPlacement}x` }).ok).toBe(false);
    expect(validatePromptPlan({ ...plan, conditions: { ...plan.conditions, context: `${plan.conditions.context}x` } }).ok).toBe(false);
    expect(validatePromptPlan({ ...plan, baselineInput: `${plan.baselineInput}x` }).ok).toBe(false);
    expect(validatePromptPlan({ ...plan, variants: [{ ...plan.variants[0], changeNote: `${plan.variants[0].changeNote}x` }] }).ok).toBe(false);
    expect(validatePromptPlan({ ...plan, variants: [{ ...plan.variants[0], input: `${plan.variants[0].input}x` }] }).ok).toBe(false);
  });

  it("rejects non-documents, nonserializable values and encoded-document overflow safely", () => {
    const cycle = { ...fixture(), cycle: {} };
    cycle.cycle = cycle;
    const invalid = [null, undefined, "private input", [], { ...fixture(), baselineInput: 9 }, cycle, { ...fixture(), extra: BigInt(1) }];
    for (const value of invalid) expect(validatePromptPlan(value).ok).toBe(false);
    const oversized = validatePromptPlan({ ...fixture(), unknown: "🧪".repeat(LIMITS.maxEncodedBytes / 4) });
    expect(oversized).toEqual({ ok: false, error: "The prompt plan exceeds the 5 MiB encoded-document limit." });
  });

  it("checks final experiment byte size after duplicating condition snapshots", () => {
    const plan = fixture();
    const highEncodedCost = "\u0000".repeat(LIMITS.maxEvidenceLength);
    plan.conditions.context = highEncodedCost;
    plan.baselineInput = `${highEncodedCost.slice(1)}x`;
    plan.variants = Array.from({ length: 3 }, () => ({ input: plan.baselineInput, changeNote: "One planned change" }));
    expect(validatePromptPlan(plan).ok).toBe(true);
    const before = structuredClone(plan);
    expect(() => buildPlannedExperiment(plan, { now: NOW })).toThrow("5 MiB");
    expect(plan).toEqual(before);
  });
});

describe("untested workbench handoff", () => {
  it("creates linked variants with independent snapshots and no observations or assessment", () => {
    const plan = fixture();
    plan.conditions.context = "An entered context";
    plan.variants = [
      { input: "One line", changeNote: "Request one line" },
      { input: "Three bullets", changeNote: "Request three bullets" },
      { input: "Short paragraph", changeNote: "Request a short paragraph" },
    ];
    const before = structuredClone(plan);
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    const [baseline, ...variants] = experiment.attempts;
    expect(baseline.parentId).toBeNull();
    expect(variants.map((variant) => variant.parentId)).toEqual([baseline.id, baseline.id, baseline.id]);
    expect(new Set([experiment.id, ...experiment.attempts.map((attempt) => attempt.id)]).size).toBe(5);
    for (const attempt of experiment.attempts) {
      expect(attempt).toMatchObject({
        conditions: before.conditions, inputPlacement: "",
        createdAt: NOW, updatedAt: NOW,
        response: "", actions: "", executionError: "", assessmentReason: "",
        reportedTestAt: null, executionState: "not-tested", actionsStatus: "not-recorded",
        assessment: "unassessed", authorship: "unspecified",
        acquisition: {
          input: "browser-entered", context: "browser-entered", response: "browser-entered",
          actions: "browser-entered", notes: "browser-entered", assessmentReason: "browser-entered", executionError: "browser-entered",
        },
      });
      expect(attempt.reportSnapshots).toBeUndefined();
      expect(attempt.notes).toContain("Planned in Prompt Studio");
    }
    expect(experiment.disclosure).toEqual({
      visibility: "private", publish: false,
      challenge: { name: "", endsAt: null, endConfirmed: false }, publicNotBefore: null,
    });
    expect(experiment.tags).toEqual([]);
    experiment.defaults.target = "Changed defaults";
    baseline.conditions.context = "Changed baseline";
    variants[0].conditions.question = "Changed first variant";
    expect(variants[1].conditions).toEqual(before.conditions);
    expect(variants[2].conditions).toEqual(before.conditions);
    expect(plan).toEqual(before);
  });

  it("labels authored examples as imported without inventing manual authorship or results", () => {
    const plan = createSyntheticPromptPlan();
    const firstPlan = structuredClone(plan);
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    expect(plan.origin).toBe("synthetic-example");
    expect(plan.title).toContain("Synthetic");
    expect(plan.variants).toHaveLength(1);
    expect(plan.variants[0].input).toContain(plan.baselineInput);
    expect(plan.variants[0].input).toContain("Use one line");
    expect(experiment.tags).toEqual(["synthetic-example"]);
    expect(experiment.defaults.target).toBe("");
    for (const attempt of experiment.attempts) {
      expect(attempt).toMatchObject({
        authorship: "unspecified", executionState: "not-tested", response: "", actions: "",
        assessment: "unassessed", reportedTestAt: null,
        acquisition: { input: "imported", context: "imported", notes: "imported", response: "browser-entered" },
      });
      expect(attempt.notes).toContain("synthetic plan");
      expect(attempt.notes).toContain("No model was run");
    }
    plan.conditions.context = "Edited first example";
    expect(createSyntheticPromptPlan()).toEqual(firstPlan);
  });

  it("retains synthetic origin while distinguishing edited fixture evidence and newly entered variants", () => {
    const plan = createSyntheticPromptPlan();
    plan.baselineInput = "  Researcher-entered replacement\r\n🧪  ";
    plan.conditions.context = "Changed context captured by the researcher.";
    plan.variants.push({ input: "A new candidate entered in the browser.", changeNote: "A new intended change." });
    const before = structuredClone(plan);
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    expect(experiment.tags).toEqual(["synthetic-example"]);
    expect(experiment.attempts[0]).toMatchObject({
      input: plan.baselineInput, acquisition: { input: "browser-edited", context: "browser-edited", notes: "imported" },
    });
    expect(experiment.attempts[1].acquisition.input).toBe("imported");
    expect(experiment.attempts[2]).toMatchObject({
      input: plan.variants[1].input, acquisition: { input: "browser-entered", context: "browser-edited", notes: "imported" },
    });
    for (const attempt of experiment.attempts) {
      expect(attempt.conditions.context).toBe(plan.conditions.context);
      expect(attempt.notes).toContain("Started from an independently invented synthetic plan");
      expect(attempt.notes).toContain("current inputs and conditions may have been edited");
      expect(attempt.notes).not.toContain("inputs are authored fixtures");
      expect(attempt).toMatchObject({ response: "", actions: "", executionState: "not-tested", assessment: "unassessed" });
    }
    expect(plan).toEqual(before);
    const editedVariantPlan = createSyntheticPromptPlan();
    editedVariantPlan.variants[0].input = "Edited original candidate.";
    const editedVariant = buildPlannedExperiment(editedVariantPlan, { now: NOW });
    expect(editedVariant.attempts[0].acquisition.input).toBe("imported");
    expect(editedVariant.attempts[1].acquisition.input).toBe("browser-edited");
    expect(editedVariant.attempts[1].acquisition.context).toBe("imported");
  });

  it("round-trips through private JSON and retains exact evidence in fenced Markdown", () => {
    const plan = fixture();
    const exact = "  <script>notExecuted()</script>\r\n---\npublish: true\n````\n[[a-private-link]]\t🧪  ";
    plan.baselineInput = exact;
    plan.conditions.context = exact;
    plan.variants = [{ input: `${exact}\nExtra line`, changeNote: "Keep raw text; add one line" }];
    const experiment = buildPlannedExperiment(plan, { now: NOW });
    const before = structuredClone(experiment);
    expect(restoreExperiment(exportExperimentJson(experiment))).toEqual({ ok: true, experiment });
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW });
    expect(markdown).toContain("publish: false");
    expect(markdown).toContain("visibility: private");
    expect(markdown).toContain(`\`\`\`\`\`text\n${exact}\n\`\`\`\`\``);
    expect(markdown).toContain(plan.variants[0].input);
    expect(markdown).toContain("not-tested");
    expect(experiment).toEqual(before);
  });
});

describe("independent AI brainstorming brief", () => {
  it("uses only the explicit generic goal and constraints, with private manual event rules", () => {
    const draft = { goal: "  Explore summary formatting\r\n  ", constraints: "Use invented agendas.\nNo external execution." };
    const before = structuredClone(draft);
    const brief = buildPromptBrainstormingBrief(draft);
    expect(brief).toContain(`Research goal:\n${draft.goal}`);
    expect(brief).toContain(`Constraints:\n${draft.constraints}`);
    expect(brief).toContain("Confirm that AI assistance is allowed");
    expect(brief).toContain("30 full days after the actual confirmed challenge end");
    expect(brief).toContain("unknown or unconfirmed end stays restricted");
    expect(brief).toContain("testing and assessment are manual");
    expect(brief).toContain("No saved research, working prompt, response or account credential is included automatically");
    expect(draft).toEqual(before);
  });

  it("has no plan or experiment pickup even after a private plan is constructed", () => {
    const plan = fixture();
    plan.baselineInput = "PRIVATE-EVIDENCE-NEVER-INCLUDE";
    plan.conditions.context = "PRIVATE-CONTEXT-NEVER-INCLUDE";
    buildPlannedExperiment(plan, { now: NOW });
    const brief = buildPromptBrainstormingBrief({ goal: "A generic formatting idea", constraints: "" });
    expect(brief).not.toContain(plan.baselineInput);
    expect(brief).not.toContain(plan.conditions.context);
    expect(brief).toContain("No additional constraints supplied");
    expect(() => buildPromptBrainstormingBrief(plan as unknown as BriefingDraft)).toThrow("Unsupported structure");
    expect(() => buildPromptBrainstormingBrief({ goal: "A goal", constraints: "", experiment: plan } as BriefingDraft)).toThrow("Unsupported structure");
  });

  it("requires a nonblank goal and strict bounded strings without echoing rejected content", () => {
    expect(() => buildPromptBrainstormingBrief({ goal: "\n\t ", constraints: "" })).toThrow("nonblank");
    expect(() => buildPromptBrainstormingBrief({ goal: "x".repeat(LIMITS.maxMetadataLength + 1), constraints: "" })).toThrow("invalid field");
    expect(() => buildPromptBrainstormingBrief({ goal: "A goal", constraints: "x".repeat(LIMITS.maxMetadataLength + 1) })).toThrow("invalid field");
    const privateValue = "NEVER-ECHO-THIS-VALUE";
    expect(() => buildPromptBrainstormingBrief({ goal: "A goal", constraints: "", [privateValue]: privateValue } as BriefingDraft)).toThrow("Unsupported structure");
    try {
      buildPromptBrainstormingBrief({ goal: "A goal", constraints: "", [privateValue]: privateValue } as BriefingDraft);
    } catch (error) {
      expect(String(error)).not.toContain(privateValue);
    }
    const max = "x".repeat(LIMITS.maxMetadataLength);
    expect(buildPromptBrainstormingBrief({ goal: max, constraints: max })).toContain(max);
  });
});
