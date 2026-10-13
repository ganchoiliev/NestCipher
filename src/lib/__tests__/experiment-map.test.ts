import { describe, expect, it, vi } from "vitest";
import {
  createAttempt,
  createExperiment,
  exportExperimentJson,
  restoreExperiment,
  validateExperiment,
  withChallenge,
  type Attempt,
  type Experiment,
} from "../research-workbench";
import { createHeadersReportSnapshot } from "../research-report";
import { exportExperimentResultsMarkdown, getExperimentMap, type ResultCounts } from "../experiment-map";

const NOW = "2026-10-11T10:00:00.000Z";
const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const conditionKeys = ["question", "scope", "target", "modelVersion", "criterion", "settings", "context"] as const;
const missingLabels = ["Prompt input", "Input placement", "Research question", "Authorized scope", "Target", "Model / version", "Observable criterion", "Settings", "System / context"];

function fixture(): Experiment {
  const experiment = createExperiment({ now: NOW, id: id(1) });
  experiment.title = "Invented experiment";
  experiment.defaults = {
    question: "Invented question", scope: "Invented permitted scope", target: "Invented target",
    modelVersion: "Invented version", criterion: "Invented criterion", settings: "Invented settings", context: "Invented context",
  };
  experiment.attempts = [attempt(experiment, 2)];
  return experiment;
}

function attempt(experiment: Experiment, index: number, parentId: string | null = null): Attempt {
  return { ...createAttempt(experiment.defaults, { id: id(index), now: NOW, parentId }), input: "Invented exact input", inputPlacement: "Invented user message" };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const emptyCounts: ResultCounts = {
  total: 0, notTested: 0, recorded: 0, errors: 0,
  recordedAssessments: { unassessed: 0, met: 0, notMet: 0, inconclusive: 0 }, nonRecordedAssessments: 0,
};

function twoSameAttempts(): Experiment {
  const experiment = fixture();
  experiment.attempts.push(attempt(experiment, 3, id(2)));
  return experiment;
}

describe("private experiment map", () => {
  it("handles an empty experiment without inventing roots, groups or outcomes", () => {
    const experiment = fixture();
    experiment.attempts = [];
    expect(getExperimentMap(experiment)).toEqual({ nodes: [], groups: [], counts: emptyCounts });
  });

  it("renders preorder with roots and siblings following original experiment positions, even when parents occur later", () => {
    const experiment = fixture();
    const rootA = attempt(experiment, 2);
    const childB = attempt(experiment, 3, rootA.id);
    const rootC = attempt(experiment, 4);
    const childD = attempt(experiment, 5, rootA.id);
    const grandchildE = attempt(experiment, 6, childB.id);
    const grandchildF = attempt(experiment, 7, childB.id);
    const childG = attempt(experiment, 8, rootC.id);
    experiment.attempts = [grandchildE, childD, rootC, grandchildF, childB, childG, rootA];
    expect(getExperimentMap(experiment).nodes).toEqual([
      { id: rootC.id, index: 2, parentId: null, depth: 0, rootId: rootC.id, childIds: [childG.id] },
      { id: childG.id, index: 5, parentId: rootC.id, depth: 1, rootId: rootC.id, childIds: [] },
      { id: rootA.id, index: 6, parentId: null, depth: 0, rootId: rootA.id, childIds: [childD.id, childB.id] },
      { id: childD.id, index: 1, parentId: rootA.id, depth: 1, rootId: rootA.id, childIds: [] },
      { id: childB.id, index: 4, parentId: rootA.id, depth: 1, rootId: rootA.id, childIds: [grandchildE.id, grandchildF.id] },
      { id: grandchildE.id, index: 0, parentId: childB.id, depth: 2, rootId: rootA.id, childIds: [] },
      { id: grandchildF.id, index: 3, parentId: childB.id, depth: 2, rootId: rootA.id, childIds: [] },
    ]);
  });

  it("supports the maximum 100-node deep chain without recursive traversal or source reordering", () => {
    const experiment = fixture();
    const ordered = Array.from({ length: 100 }, (_, index) => attempt(experiment, index + 2, index === 0 ? null : id(index + 1)));
    experiment.attempts = ordered.slice().reverse();
    const before = JSON.stringify(experiment);
    const map = getExperimentMap(experiment);
    expect(map.nodes).toHaveLength(100);
    expect(map.nodes.map((node) => node.id)).toEqual(ordered.map((item) => item.id));
    expect(map.nodes.map((node) => node.depth)).toEqual(Array.from({ length: 100 }, (_, index) => index));
    expect(map.nodes[99]).toEqual({ id: id(101), index: 0, parentId: id(100), depth: 99, rootId: id(2), childIds: [] });
    expect(JSON.stringify(experiment)).toBe(before);
  });

  it("keeps original attempt indexes and representative IDs after deliberate reorder", () => {
    const experiment = fixture();
    const root = experiment.attempts[0];
    const variant = attempt(experiment, 3, root.id);
    experiment.attempts = [variant, root];
    const map = getExperimentMap(experiment);
    expect(map.nodes.map((node) => [node.id, node.index])).toEqual([[root.id, 1], [variant.id, 0]]);
    expect(map.groups).toHaveLength(1);
    expect(map.groups[0]).toMatchObject({ id: variant.id, attemptIds: [variant.id, root.id], indexes: [0, 1] });
  });

  it("groups unrelated roots and variants by identical captured strings, without using links or outcomes as group keys", () => {
    const experiment = fixture();
    const root = experiment.attempts[0];
    const variant = attempt(experiment, 3, root.id);
    const independentRoot = attempt(experiment, 4);
    variant.response = "A different researcher response";
    variant.changeNote = "A different intended change";
    variant.executionState = "recorded";
    variant.assessment = "inconclusive";
    independentRoot.authorship = "ai-assisted";
    independentRoot.acquisition.input = "imported";
    experiment.attempts.push(variant, independentRoot);
    expect(getExperimentMap(experiment).groups).toEqual([{
      id: root.id, attemptIds: [root.id, variant.id, independentRoot.id], indexes: [0, 1, 2], missingFields: [],
      counts: { ...emptyCounts, total: 3, notTested: 2, recorded: 1, recordedAssessments: { ...emptyCounts.recordedAssessments, inconclusive: 1 } },
    }]);
  });

  it.each(conditionKeys)("splits groups when only captured %s differs", (key) => {
    const experiment = twoSameAttempts();
    experiment.attempts[1].conditions[key] += " ";
    const map = getExperimentMap(experiment);
    expect(map.groups).toHaveLength(2);
    expect(map.groups.map((group) => group.attemptIds)).toEqual([[id(2)], [id(3)]]);
  });

  it.each(["input", "inputPlacement"] as const)("splits groups when only %s differs", (key) => {
    const experiment = twoSameAttempts();
    experiment.attempts[1][key] += "\r\n";
    expect(getExperimentMap(experiment).groups).toHaveLength(2);
  });

  it.each([
    ["line\r\nend", "line\nend"],
    ["\u00e9", "e\u0301"],
    ["input", "input\u200b"],
    ["input\u202e", "input"],
    ["A B", "A\u00a0B"],
    ["", " "],
    ["\ud800", "\ufffd"],
  ])("preserves exact Unicode and hidden strings when grouping (%j, %j)", (first, second) => {
    const experiment = twoSameAttempts();
    experiment.attempts[0].input = first;
    experiment.attempts[1].input = second;
    const before = structuredClone(experiment);
    expect(getExperimentMap(experiment).groups).toHaveLength(2);
    expect(experiment).toEqual(before);
  });

  it("does not confuse concatenated field boundaries or JSON escape sequences", () => {
    const experiment = twoSameAttempts();
    experiment.attempts[0].input = "a";
    experiment.attempts[0].inputPlacement = "bc";
    experiment.attempts[1].input = "ab";
    experiment.attempts[1].inputPlacement = "c";
    expect(getExperimentMap(experiment).groups).toHaveLength(2);
    experiment.attempts[0].input = "line\nend";
    experiment.attempts[1].input = "line\\nend";
    expect(getExperimentMap(experiment).groups).toHaveLength(2);
  });

  it("labels whitespace-only captured fields as missing without grouping distinct whitespace together", () => {
    const experiment = twoSameAttempts();
    for (const item of experiment.attempts) {
      item.input = "\t \r\n";
      item.inputPlacement = "\u00a0";
      for (const key of conditionKeys) item.conditions[key] = " ";
    }
    experiment.attempts[1].conditions.settings = "";
    const map = getExperimentMap(experiment);
    expect(map.groups).toHaveLength(2);
    expect(map.groups[0].missingFields).toEqual(missingLabels);
    expect(map.groups[1].missingFields).toEqual(missingLabels);
    experiment.attempts[0].input = "\u200b";
    expect(getExperimentMap(experiment).groups[0].missingFields).not.toContain("Prompt input");
  });

  it("uses historical captured conditions and ignores newer experiment defaults", () => {
    const experiment = twoSameAttempts();
    experiment.defaults.context = "A newer default that was never captured in these attempts";
    experiment.defaults.target = "New target";
    expect(getExperimentMap(experiment).groups).toHaveLength(1);
    experiment.attempts[1].conditions.target = experiment.defaults.target;
    expect(getExperimentMap(experiment).groups).toHaveLength(2);
  });

  it("counts assessments only within recorded states and explicitly excludes contradictory error/not-tested assessments", () => {
    const experiment = fixture();
    const states: [Attempt["executionState"], Attempt["assessment"]][] = [
      ["recorded", "met"], ["recorded", "met"], ["recorded", "not-met"],
      ["recorded", "inconclusive"], ["recorded", "unassessed"],
      ["not-tested", "met"], ["not-tested", "unassessed"],
      ["error", "not-met"], ["error", "inconclusive"], ["error", "unassessed"],
    ];
    experiment.attempts = states.map(([executionState, assessment], index) => ({ ...attempt(experiment, index + 2), executionState, assessment }));
    const map = getExperimentMap(experiment);
    const expected: ResultCounts = {
      total: 10, notTested: 2, recorded: 5, errors: 3,
      recordedAssessments: { met: 2, notMet: 1, inconclusive: 1, unassessed: 1 }, nonRecordedAssessments: 3,
    };
    expect(map.counts).toEqual(expected);
    expect(map.groups[0].counts).toEqual(expected);
    expect(map.counts.total).toBe(map.counts.notTested + map.counts.recorded + map.counts.errors);
    expect(Object.values(map.counts.recordedAssessments).reduce((sum, value) => sum + value, 0)).toBe(map.counts.recorded);
  });

  it("does not infer execution or assessment from observations, reports, errors or timestamps", () => {
    const experiment = fixture();
    const item = experiment.attempts[0];
    item.response = "A recorded response alongside an unchanged not-tested state";
    item.actions = "An entered action trace";
    item.actionsStatus = "recorded";
    item.executionError = "An entered error";
    item.assessmentReason = "A proposed interpretation";
    item.reportedTestAt = NOW;
    item.reportSnapshots = [createHeadersReportSnapshot({
      url: "https://example.invalid/map-fixture", grade: "A+", score: 100, maxScore: 100, scannedAt: NOW,
      headers: [{ name: "Invented-Header", present: true, value: "Invented value", score: 100, maxScore: 100, status: "pass", description: "Invented report", recommendation: null }], serverInfo: { ip: null, server: null, poweredBy: null },
    }, { now: NOW })];
    expect(getExperimentMap(experiment).counts).toEqual({ ...emptyCounts, total: 1, notTested: 1 });
  });

  it("counts a reported recorded result even with absent observations, without silently grading or rejecting it", () => {
    const experiment = fixture();
    experiment.attempts[0].executionState = "recorded";
    expect(getExperimentMap(experiment).counts).toEqual({
      ...emptyCounts, total: 1, recorded: 1, recordedAssessments: { ...emptyCounts.recordedAssessments, unassessed: 1 },
    });
  });

  it("returns detached summaries and never mutates frozen source evidence, provenance, ordering or disclosure", () => {
    const experiment = twoSameAttempts();
    const before = JSON.stringify(experiment);
    freeze(experiment);
    const map = getExperimentMap(experiment);
    map.nodes[0].childIds.push(id(20));
    map.groups[0].attemptIds.push(id(21));
    map.groups[0].missingFields.push("Detached label");
    map.counts.recordedAssessments.met = 99;
    map.groups[0].counts.recordedAssessments.met = 98;
    expect(JSON.stringify(experiment)).toBe(before);
    expect(getExperimentMap(experiment).counts.recordedAssessments.met).toBe(0);
  });

  it.each(["cycle", "missing-parent", "duplicate-id", "unknown-field", "invalid-state"] as const)("rejects unsupported %s documents before deriving graph results", (kind) => {
    const experiment = twoSameAttempts();
    if (kind === "cycle") experiment.attempts[0].parentId = experiment.attempts[1].id;
    if (kind === "missing-parent") experiment.attempts[1].parentId = id(90);
    if (kind === "duplicate-id") experiment.attempts[1].id = experiment.attempts[0].id;
    if (kind === "unknown-field") (experiment as unknown as Record<string, unknown>).unexpected = "DO_NOT_ECHO_MAP_DATA";
    if (kind === "invalid-state") (experiment.attempts[0] as unknown as Record<string, unknown>).executionState = "DO_NOT_ECHO_MAP_DATA";
    expect(validateExperiment(experiment).ok).toBe(false);
    expect(() => getExperimentMap(experiment)).toThrow();
    expect(() => exportExperimentResultsMarkdown(experiment)).toThrow();
    try { exportExperimentResultsMarkdown(experiment); } catch (error) { expect(String(error)).not.toContain("DO_NOT_ECHO_MAP_DATA"); }
  });

  it("rejects documents beyond the existing 5 MiB encoded input cap even though the summary would be short", () => {
    const experiment = fixture();
    experiment.attempts = Array.from({ length: 100 }, (_, index) => ({ ...attempt(experiment, index + 2), input: "x".repeat(60_000) }));
    expect(() => getExperimentMap(experiment)).toThrow("5 MiB");
    expect(() => exportExperimentResultsMarkdown(experiment)).toThrow("5 MiB");
  });
});

describe("private experiment results Markdown", () => {
  it("includes stable map/group identifiers, original labels and counts without a lossless backup claim", () => {
    const experiment = twoSameAttempts();
    experiment.attempts[0].executionState = "recorded";
    experiment.attempts[0].assessment = "met";
    experiment.attempts = experiment.attempts.slice().reverse();
    const text = exportExperimentResultsMarkdown(experiment);
    expect(text).toContain("visibility: private\npublish: false");
    expect(text).toContain(`nestcipher_snapshot_updated_at: "${NOW}"`);
    expect(text).toContain(`- Attempt 02 (${id(2)}); parent: none; depth: 0; root: ${id(2)}.`);
    expect(text).toContain(`- Attempt 01 (${id(3)}); parent: Attempt 02 (${id(2)}); depth: 1; root: ${id(2)}.`);
    expect(text).toContain(`Representative ID: ${id(3)}.`);
    expect(text).toContain(`Members: Attempt 01 (${id(3)}); Attempt 02 (${id(2)}).`);
    expect(text).toContain("1 met criterion; 0 did not meet criterion; 0 inconclusive; 0 unassessed");
    expect(text).toContain("not encrypted");
    expect(text).toContain("not a lossless backup or restore archive");
    expect(text).not.toMatch(/success rate|reliability:|\d+%/i);
  });

  it("excludes all prompt/evidence/condition values, report content, tags, provenance and change notes", () => {
    const experiment = fixture();
    const item = experiment.attempts[0];
    const secrets: string[] = [];
    for (const key of conditionKeys) {
      const value = `EXCLUDED_CONDITION_${key}_RAW_VALUE`;
      item.conditions[key] = value;
      experiment.defaults[key] = `EXCLUDED_DEFAULT_${key}_RAW_VALUE`;
      secrets.push(value, experiment.defaults[key]);
    }
    for (const key of ["input", "inputPlacement", "response", "actions", "notes", "assessmentReason", "executionError", "changeNote"] as const) {
      item[key] = `EXCLUDED_EVIDENCE_${key}_RAW_VALUE`;
      secrets.push(item[key]);
    }
    experiment.tags = ["EXCLUDED_TAG_RAW_VALUE"];
    secrets.push(experiment.tags[0]);
    item.authorship = "ai-assisted";
    item.reportSnapshots = [createHeadersReportSnapshot({
      url: "https://example.invalid/EXCLUDED_REPORT_URL", grade: "A+", score: 100, maxScore: 100, scannedAt: NOW,
      headers: [{ name: "EXCLUDED_REPORT_HEADER", present: true, value: "EXCLUDED_REPORT_VALUE", score: 100, maxScore: 100, status: "pass", description: "EXCLUDED_REPORT_DESCRIPTION", recommendation: "EXCLUDED_REPORT_RECOMMENDATION" }],
      serverInfo: { ip: "EXCLUDED_REPORT_IP", server: "EXCLUDED_REPORT_SERVER", poweredBy: "EXCLUDED_REPORT_POWERED" },
    }, { now: NOW })];
    secrets.push(...["URL", "HEADER", "VALUE", "DESCRIPTION", "RECOMMENDATION", "IP", "SERVER", "POWERED"].map((suffix) => `EXCLUDED_REPORT_${suffix}`), item.reportSnapshots[0].id);
    const before = JSON.stringify(experiment);
    const text = exportExperimentResultsMarkdown(experiment);
    for (const secret of secrets) expect(text).not.toContain(secret);
    expect(text).not.toContain("ai-assisted");
    expect(text).not.toContain("browser-entered");
    expect(JSON.stringify(experiment)).toBe(before);
    expect(JSON.stringify(getExperimentMap(experiment))).not.toContain("EXCLUDED_");
  });

  it("fences arbitrary title and challenge text with a delimiter longer than every supplied backtick run", () => {
    const experiment = fixture();
    const title = `Title\r\n${"`".repeat(12)}\n---\npublish: true\n<script>alert('title')</script>\n# injected heading\n\u2028`;
    const challengeName = "~~~\n```\npublish: true\n<img src=x onerror=alert('challenge')>\n[go](javascript:alert(1))";
    experiment.title = title;
    experiment.disclosure.challenge.name = challengeName;
    const text = exportExperimentResultsMarkdown(experiment);
    expect(text).toContain(`${"`".repeat(13)}text\n${title}\n${"`".repeat(13)}`);
    expect(text).toContain(`\`\`\`\`text\n${challengeName}\n\`\`\`\``);
    const frontmatter = text.split("---\n")[1];
    expect(frontmatter).not.toContain("<script>");
    expect(frontmatter).not.toContain("publish: true");
    expect(frontmatter).not.toContain("injected");
    expect(frontmatter).toContain("publish: false");
  });

  it("has a deterministic updatedAt snapshot timestamp independent of the current clock", () => {
    const experiment = fixture();
    experiment.updatedAt = "2026-10-12T11:00:00.000Z";
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2028-01-01T00:00:00Z"));
      const first = exportExperimentResultsMarkdown(experiment);
      vi.setSystemTime(new Date("2029-01-01T00:00:00Z"));
      expect(exportExperimentResultsMarkdown(experiment)).toBe(first);
      expect(first).toContain(experiment.updatedAt);
      expect(first).not.toContain("2028-01-01");
      expect(first).not.toContain("2029-01-01");
    } finally { vi.useRealTimers(); }
  });

  it.each([
    { name: "Unknown private challenge", endsAt: null, endConfirmed: false },
    { name: "Unconfirmed private challenge", endsAt: "2026-10-01T00:00:00.000Z", endConfirmed: false },
  ])("keeps $name restricted without deriving a disclosure date", (challenge) => {
    const experiment = withChallenge(fixture(), challenge, NOW);
    const text = exportExperimentResultsMarkdown(experiment);
    expect(text).toContain("nestcipher_public_not_before: null");
    expect(text).toContain("No public disclosure date is established");
    expect(text).toContain("publish: false");
    expect(text).not.toContain("Earliest disclosure date under");
  });

  it.each(["2026-10-11T11:00:00.000Z", "2027-01-01T00:00:00.000Z"])("keeps private restrictions before or after the derived date (snapshot %s)", (snapshotAt) => {
    const experiment = withChallenge(fixture(), { name: "Invented confirmed challenge", endsAt: "2026-10-10T08:15:00.000Z", endConfirmed: true }, snapshotAt);
    const text = exportExperimentResultsMarkdown(experiment);
    expect(text).toContain('nestcipher_public_not_before: "2026-11-09T08:15:00.000Z"');
    expect(text).toContain("Earliest disclosure date under the recorded 30-full-day rule: 2026-11-09T08:15:00.000Z");
    expect(text).toContain("This summary remains private");
    expect(text).toContain("A date never authorizes publication");
    expect(text).toContain("publish: false");
    expect(text).not.toContain("publish: true");
  });

  it("exports an empty/partial record with missing fields instead of inventing content", () => {
    const experiment = createExperiment({ now: NOW });
    const text = exportExperimentResultsMarkdown(experiment);
    expect(text).toContain(`Missing captured fields: ${missingLabels.join("; ")}.`);
    experiment.attempts = [];
    const empty = exportExperimentResultsMarkdown(experiment);
    expect(empty).toContain("No attempts in this snapshot");
    expect(empty).toContain("No captured-input groups in this snapshot");
    expect(empty).toContain("Total attempts: 0");
  });

  it("uses the existing experiment JSON format without changing it and accepts a migrated legacy restore", () => {
    const experiment = fixture();
    const json = exportExperimentJson(experiment);
    const restored = restoreExperiment(json);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.error);
    expect(exportExperimentResultsMarkdown(restored.experiment)).toBe(exportExperimentResultsMarkdown(experiment));
    const legacy = { ...experiment, schemaVersion: 1 };
    expect(() => exportExperimentResultsMarkdown(legacy as unknown as Experiment)).toThrow();
    const migrated = restoreExperiment(JSON.stringify(legacy));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) throw new Error(migrated.error);
    expect(getExperimentMap(migrated.experiment)).toEqual(getExperimentMap(experiment));
    expect(exportExperimentJson(experiment)).toBe(json);
  });
});
