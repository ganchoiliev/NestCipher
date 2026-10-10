import { describe, expect, it } from "vitest";
import { createEmailReportSnapshot } from "../research-report";
import {
  createAttempt,
  createExperiment,
  createSyntheticExperiment,
  duplicateAttempt,
  exportExperimentJson,
  exportExperimentMarkdown,
  getDisclosureStatus,
  LIMITS,
  removeAttempt,
  restoreExperiment,
  validateExperiment,
  withChallenge,
  type Experiment,
} from "../research-workbench";

const NOW = "2026-10-10T10:00:00.000Z";
const LATER = "2026-10-10T11:00:00.000Z";
const id = (number: number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const fixture = () => createSyntheticExperiment({ now: NOW });

describe("research experiment factories and snapshots", () => {
  it("starts a private, untested partial draft with a separate condition snapshot", () => {
    const experiment = createExperiment({ now: NOW, id: id(1) });
    expect(experiment.attempts).toHaveLength(1);
    expect(experiment.attempts[0]).toMatchObject({
      parentId: null, executionState: "not-tested", assessment: "unassessed",
      actionsStatus: "not-recorded", reportedTestAt: null,
    });
    expect(experiment.disclosure).toEqual({
      visibility: "private", publish: false,
      challenge: { name: "", endsAt: null, endConfirmed: false }, publicNotBefore: null,
    });
    experiment.defaults.target = "Changed default";
    expect(experiment.attempts[0].conditions.target).toBe("");
    expect(validateExperiment(experiment).ok).toBe(true);
    const restored = restoreExperiment(exportExperimentJson(experiment));
    expect(restored).toEqual({ ok: true, experiment });
    expect(() => exportExperimentMarkdown(experiment)).toThrow("title");
    experiment.title = "Partial setup";
    expect(() => exportExperimentMarkdown(experiment)).toThrow("input");
  });

  it("duplicates the parent's input and conditions but clears all observations", () => {
    const experiment = fixture();
    const parent = experiment.attempts[0];
    parent.input = "  first\r\nsecond\t  ";
    parent.conditions.context = "known\r\ncontext";
    parent.response = "Observed output";
    parent.actions = "An observed tool action";
    parent.actionsStatus = "recorded";
    parent.executionState = "error";
    parent.executionError = "Recorded provider error";
    parent.reportedTestAt = "2026-10-09T07:00:00.000Z";
    parent.acquisition.input = "imported";
    const snapshot = structuredClone(parent);
    experiment.defaults.target = "A new default target";
    const variant = duplicateAttempt(parent, { now: LATER, id: id(2) });
    expect(variant).toMatchObject({
      id: id(2), parentId: parent.id, input: parent.input,
      conditions: parent.conditions, response: "", actions: "",
      actionsStatus: "not-recorded", executionState: "not-tested", executionError: "",
      reportedTestAt: null, assessment: "unassessed", assessmentReason: "", notes: "", changeNote: "",
    });
    expect(variant.acquisition.input).toBe("imported");
    expect(variant.acquisition.response).toBe("browser-entered");
    variant.conditions.target = "Explicitly edited variant";
    expect(parent).toEqual(snapshot);
    expect(variant.conditions.target).not.toBe(experiment.defaults.target);
  });

  it("preserves stable IDs and parent links through ordering, clearing links on removal", () => {
    const experiment = fixture();
    const [parent, child] = experiment.attempts;
    experiment.attempts.reverse();
    expect(restoreExperiment(exportExperimentJson(experiment))).toEqual({ ok: true, experiment });
    const removed = removeAttempt(experiment, parent.id, LATER);
    expect(removed.clearedParentIds).toEqual([child.id]);
    expect(removed.experiment.attempts).toHaveLength(1);
    expect(removed.experiment.attempts[0]).toMatchObject({ id: child.id, parentId: null, updatedAt: LATER });
    expect(experiment.attempts[0].parentId).toBe(parent.id);
  });

  it("labels every demonstration record as synthetic and never claims a variant was run", () => {
    const experiment = fixture();
    expect(experiment.tags).toEqual(["synthetic-example"]);
    expect(experiment.title).toContain("Synthetic");
    expect(experiment.attempts[0].notes).toContain("no model was run");
    expect(experiment.attempts[1]).toMatchObject({ executionState: "not-tested", response: "", assessment: "unassessed" });
    expect(experiment.attempts[1].notes).toContain("Synthetic");
  });
});

describe("lossless private JSON backups", () => {
  it("preserves hostile strings, Unicode, whitespace, timestamps and acquisition metadata", () => {
    const experiment = fixture();
    const hostile = "  \r\n<script>fetch('https://example.invalid')</script>\r\n---\npublish: true\n```\n```````\n[[vault-link]]\t\u200B\u202E\u{E0041}é🧪\uD800  ";
    const attempt = experiment.attempts[0];
    attempt.input = hostile;
    attempt.conditions.context = hostile;
    attempt.response = hostile;
    attempt.actions = hostile;
    attempt.notes = hostile;
    attempt.assessmentReason = hostile;
    attempt.executionError = hostile;
    attempt.createdAt = "2026-10-09T17:00:00+02:00";
    attempt.acquisition.response = "imported";
    attempt.acquisition.notes = "browser-edited";
    const before = structuredClone(experiment);
    const restored = restoreExperiment(exportExperimentJson(experiment));
    expect(restored).toEqual({ ok: true, experiment: before });
    expect(experiment).toEqual(before);
    if (!restored.ok) throw new Error("Expected a valid restored fixture");
    restored.experiment.attempts[0].input = "browser\nedited";
    restored.experiment.attempts[0].acquisition.input = "browser-edited";
    expect(restoreExperiment(exportExperimentJson(restored.experiment))).toEqual(restored);
    expect(attempt.input).toBe(hostile);
  });

  it("retains distinct execution, manual assessment and observed-action states", () => {
    const experiment = fixture();
    experiment.attempts[0].executionState = "error";
    experiment.attempts[0].executionError = "Timeout reported by researcher";
    experiment.attempts[0].assessment = "inconclusive";
    experiment.attempts[0].actionsStatus = "none-observed";
    experiment.attempts[1].actionsStatus = "not-recorded";
    const result = restoreExperiment(exportExperimentJson(experiment));
    expect(result).toEqual({ ok: true, experiment });
    expect(exportExperimentMarkdown(experiment, { exportedAt: NOW })).toContain("Execution: error. Observed actions: none-observed.");
  });

  it("uses compact JSON when formatting alone would exceed the encoded limit", () => {
    const experiment = createExperiment({ now: NOW, id: id(1) });
    experiment.attempts = Array.from({ length: 50 }, (_, index) => ({
      ...createAttempt(experiment.defaults, { now: NOW, id: id(index + 2) }),
      input: "x".repeat(LIMITS.maxEvidenceLength),
    }));
    let remaining = LIMITS.maxEncodedBytes - 64 - bytes(JSON.stringify(experiment));
    expect(remaining).toBeGreaterThan(0);
    for (const attempt of experiment.attempts) {
      const length = Math.min(remaining, LIMITS.maxEvidenceLength);
      attempt.conditions.context = "x".repeat(length);
      remaining -= length;
      if (remaining === 0) break;
    }
    expect(remaining).toBe(0);
    expect(validateExperiment(experiment).ok).toBe(true);
    expect(bytes(JSON.stringify(experiment, null, 2))).toBeGreaterThan(LIMITS.maxEncodedBytes);
    const json = exportExperimentJson(experiment);
    expect(bytes(json)).toBeLessThanOrEqual(LIMITS.maxEncodedBytes);
    expect(restoreExperiment(json)).toEqual({ ok: true, experiment });
  });
});

describe("strict atomic restore and limits", () => {
  it.each([
    ["unknown version", (e: Experiment) => ({ ...e, schemaVersion: 3 })],
    ["unknown root key", (e: Experiment) => ({ ...e, surprise: true })],
    ["unknown nested key", (e: Experiment) => ({ ...e, defaults: { ...e.defaults, extra: "ignored?" } })],
    ["invalid identifier", (e: Experiment) => ({ ...e, id: "attempt-one" })],
    ["duplicate identifier", (e: Experiment) => ({ ...e, attempts: [e.attempts[0], { ...e.attempts[1], id: e.attempts[0].id }] })],
    ["experiment/attempt ID collision", (e: Experiment) => ({ ...e, id: e.attempts[0].id })],
    ["missing parent", (e: Experiment) => ({ ...e, attempts: [{ ...e.attempts[0], parentId: id(99) }] })],
    ["self parent", (e: Experiment) => ({ ...e, attempts: [{ ...e.attempts[0], parentId: e.attempts[0].id }] })],
    ["parent cycle", (e: Experiment) => ({ ...e, attempts: [{ ...e.attempts[0], parentId: e.attempts[1].id }, e.attempts[1]] })],
    ["invalid timestamp", (e: Experiment) => ({ ...e, createdAt: "2026-02-30T10:00:00Z" })],
    ["missing timezone", (e: Experiment) => ({ ...e, createdAt: "2026-10-10T10:00:00" })],
    ["backdated update", (e: Experiment) => ({ ...e, updatedAt: "2026-01-01T00:00:00Z" })],
    ["invalid enum", (e: Experiment) => ({ ...e, attempts: [{ ...e.attempts[0], assessment: "safe" }] })],
    ["public visibility", (e: Experiment) => ({ ...e, disclosure: { ...e.disclosure, visibility: "public" } })],
    ["publish flag", (e: Experiment) => ({ ...e, disclosure: { ...e.disclosure, publish: true } })],
    ["oversized metadata", (e: Experiment) => ({ ...e, title: "x".repeat(LIMITS.maxMetadataLength + 1) })],
    ["oversized evidence", (e: Experiment) => ({ ...e, attempts: [{ ...e.attempts[0], input: "x".repeat(LIMITS.maxEvidenceLength + 1) }] })],
  ])("rejects %s without changing the existing experiment", (_label, mutate) => {
    const current = fixture();
    const before = structuredClone(current);
    const bad = mutate(structuredClone(current));
    expect(restoreExperiment(JSON.stringify(bad)).ok).toBe(false);
    expect(current).toEqual(before);
  });

  it("accepts 100 attempts but rejects 101", () => {
    const experiment = createExperiment({ now: NOW, id: id(1) });
    experiment.attempts = Array.from({ length: 100 }, (_, index) => createAttempt(experiment.defaults, { now: NOW, id: id(index + 2) }));
    expect(validateExperiment(experiment).ok).toBe(true);
    experiment.attempts.push(createAttempt(experiment.defaults, { now: NOW, id: id(102) }));
    expect(validateExperiment(experiment).ok).toBe(false);
  });

  it("measures encoded bytes rather than string length and checks file bytes before parsing", () => {
    const experiment = createExperiment({ now: NOW });
    experiment.attempts = Array.from({ length: 4 }, () => {
      const attempt = createAttempt(experiment.defaults, { now: NOW });
      const value = "é".repeat(LIMITS.maxEvidenceLength);
      return { ...attempt, input: value, response: value, actions: value, notes: value, assessmentReason: value, executionError: value, conditions: { ...attempt.conditions, context: value } };
    });
    expect(JSON.stringify(experiment).length).toBeLessThan(LIMITS.maxEncodedBytes);
    expect(bytes(JSON.stringify(experiment))).toBeGreaterThan(LIMITS.maxEncodedBytes);
    expect(validateExperiment(experiment)).toMatchObject({ ok: false, error: expect.stringContaining("encoded") });
    expect(restoreExperiment(" ".repeat(LIMITS.maxEncodedBytes + 1))).toMatchObject({ ok: false, error: expect.stringContaining("encoded-file") });
    expect(restoreExperiment("{broken" )).toMatchObject({ ok: false, error: expect.stringContaining("valid JSON") });
  });
});

const reportFixture = (number = 900) => createEmailReportSnapshot({
  overallScore: 0, overallLevel: "safe", verdict: "Synthetic report; no model was run",
  categories: [{ name: "Synthetic category", score: 0, level: "safe", findings: ["REPORT CANARY\r\n<script>synthetic</script>\n```````\n[[vault-link]]"], explanation: "Authored fixture" }],
  suspiciousElements: [], recommendations: [], summary: "Invented report-only evidence", analysedAt: NOW,
}, { now: LATER, id: id(number) });

describe("version 2 report attachments and strict legacy migration", () => {
  it("migrates only the version of a valid original backup, preserving partial and hostile strings", () => {
    const experiment = fixture();
    experiment.attempts[0].input = "\r\n<script>synthetic</script>\u200B\u2028\uD800 ";
    experiment.attempts[0].acquisition.input = "imported";
    const legacy = { ...experiment, schemaVersion: 1 };
    const before = structuredClone(legacy);
    const restored = restoreExperiment(JSON.stringify(legacy));
    expect(restored).toEqual({ ok: true, experiment });
    expect(experiment.schemaVersion).toBe(2);
    expect(legacy).toEqual(before);
    expect(experiment.attempts[0]).not.toHaveProperty("reportSnapshots");
    const blank = createExperiment({ now: NOW });
    expect(restoreExperiment(JSON.stringify({ ...blank, schemaVersion: 1 }))).toEqual({ ok: true, experiment: blank });
  });

  it("rejects unknown legacy keys, attachments in v1 and forged disclosure before migration", () => {
    const experiment = fixture();
    const legacy = { ...experiment, schemaVersion: 1 };
    for (const bad of [
      { ...legacy, extra: true },
      { ...legacy, attempts: [{ ...legacy.attempts[0], reportSnapshots: [] }] },
      { ...legacy, attempts: [{ ...legacy.attempts[0], acquisition: { ...legacy.attempts[0].acquisition, unknown: "imported" } }] },
      { ...legacy, disclosure: { ...legacy.disclosure, publicNotBefore: NOW } },
    ]) expect(restoreExperiment(JSON.stringify(bad)).ok).toBe(false);
  });

  it("restores reports without altering conditions, assessment, execution or disclosure", () => {
    const experiment = withChallenge(fixture(), { name: "Synthetic embargo", endsAt: "2027-01-01T00:00:00Z", endConfirmed: true }, NOW);
    const before = structuredClone(experiment);
    const snapshot = reportFixture();
    experiment.attempts[0].reportSnapshots = [snapshot];
    const restored = restoreExperiment(exportExperimentJson(experiment));
    expect(restored).toEqual({ ok: true, experiment });
    expect(experiment.disclosure).toEqual(before.disclosure);
    expect(experiment.attempts[0]).toMatchObject({ conditions: before.attempts[0].conditions, assessment: before.attempts[0].assessment, executionState: before.attempts[0].executionState });
    expect(duplicateAttempt(experiment.attempts[0], { now: LATER })).not.toHaveProperty("reportSnapshots");
    experiment.attempts.reverse();
    expect(restoreExperiment(exportExperimentJson(experiment))).toEqual({ ok: true, experiment });
  });

  it("preserves explicit empty attachments and enforces per-attempt, global and identity limits", () => {
    const experiment = createExperiment({ now: NOW, id: id(1) });
    experiment.attempts[0].reportSnapshots = [];
    expect(restoreExperiment(exportExperimentJson(experiment))).toEqual({ ok: true, experiment });
    experiment.attempts = Array.from({ length: 5 }, (_, index) => ({
      ...createAttempt(experiment.defaults, { now: NOW, id: id(index + 2) }),
      reportSnapshots: Array.from({ length: 10 }, (_, report) => reportFixture(900 + index * 10 + report)),
    }));
    expect(validateExperiment(experiment).ok).toBe(true);
    experiment.attempts.push({ ...createAttempt(experiment.defaults, { now: NOW, id: id(8) }), reportSnapshots: [reportFixture(999)] });
    expect(validateExperiment(experiment).ok).toBe(false);
    experiment.attempts.pop();
    experiment.attempts[0].reportSnapshots!.push(reportFixture(998));
    expect(validateExperiment(experiment).ok).toBe(false);
    experiment.attempts[0].reportSnapshots!.pop();
    experiment.attempts[1].reportSnapshots![0] = experiment.attempts[0].reportSnapshots![0];
    expect(validateExperiment(experiment).ok).toBe(false);
    experiment.attempts[1].reportSnapshots![0] = reportFixture(2);
    expect(validateExperiment(experiment).ok).toBe(false);
  });

  it("enforces report byte limits inside the backup as well as standalone imports", () => {
    const experiment = fixture();
    const snapshot = reportFixture();
    if (snapshot.kind !== "email-analysis") throw new Error("Expected email snapshot");
    snapshot.report.categories[0].findings = Array.from({ length: 11 }, () => "x".repeat(100_000));
    experiment.attempts[0].reportSnapshots = [snapshot];
    expect(bytes(JSON.stringify(experiment))).toBeLessThan(LIMITS.maxEncodedBytes);
    expect(validateExperiment(experiment).ok).toBe(false);
  });

  it("fences report contents in Markdown or omits whole reports without altering the JSON", () => {
    const experiment = fixture();
    experiment.attempts[0].reportSnapshots = [reportFixture()];
    const before = exportExperimentJson(experiment);
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW });
    expect(markdown).toContain("REPORT CANARY");
    expect(markdown).toContain("````````text");
    expect(markdown).toContain("Raw source input is excluded");
    expect(markdown).toContain("workbench did not run attached tools");
    expect(markdown).toContain("visibility: private\npublish: false");
    const omitted = exportExperimentMarkdown(experiment, { exportedAt: NOW, includeReportSnapshots: false });
    expect(omitted).not.toContain("REPORT CANARY");
    expect(omitted).not.toContain(reportFixture().id);
    expect(omitted).toContain("All report snapshots omitted");
    expect(exportExperimentJson(experiment)).toBe(before);
  });
});

describe("private Markdown and the 30-day disclosure rule", () => {
  it("fences hostile evidence and escapes frontmatter and headings", () => {
    const experiment = fixture();
    experiment.title = "<script>title</script>\n---\npublish: true\n[[link]]";
    experiment.defaults.target = "quoted\"\n---\npublish: true\u2028target";
    experiment.disclosure.challenge.name = "Challenge\n---\npublish: true";
    const input = "<script>alert(1)</script>\n```````\n---\npublish: true\n[[vault-link]]";
    experiment.attempts[0].input = input;
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW });
    const frontmatter = markdown.slice(4, markdown.indexOf("\n---", 4));
    expect(frontmatter).toContain("visibility: private\npublish: false");
    expect(frontmatter).not.toMatch(/^publish: true$/m);
    expect(frontmatter).toContain('nestcipher_target: "quoted\\\"\\n---\\npublish: true\\u2028target"');
    expect(markdown).toContain(`\`\`\`\`\`\`\`\`text\n${input}\n\`\`\`\`\`\`\`\``);
    expect(markdown).toContain("# \\<script\\>title\\</script\\>");
    expect(markdown).toContain("not a lossless restore file");
  });

  it("makes omissions explicit without changing the full private backup", () => {
    const experiment = fixture();
    experiment.attempts[0].response = "UNIQUE PRIVATE RESPONSE";
    experiment.attempts[0].executionError = "UNIQUE PRIVATE ERROR";
    const before = exportExperimentJson(experiment);
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW, omittedFields: ["response", "context", "executionError"] });
    expect(markdown).not.toContain("UNIQUE PRIVATE RESPONSE");
    expect(markdown).not.toContain("UNIQUE PRIVATE ERROR");
    expect(markdown).not.toContain("CANARY-EXAMPLE-472");
    expect(markdown).toContain("Omitted from this private Markdown export");
    expect(markdown).toContain("response, context, executionError");
    expect(exportExperimentJson(experiment)).toBe(before);
  });

  it("round-trips actual Unicode line separators and literal escape text in flat properties", () => {
    const experiment = fixture();
    const value = "actual\u2028separator\u2029 / literal \\u2028 and \\u2029 / quoted \"value\"\r\nnext";
    experiment.defaults.target = value;
    experiment.disclosure.challenge.name = value;
    experiment.tags = [value];
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW });
    const frontmatter = markdown.slice(4, markdown.indexOf("\n---", 4));
    for (const key of ["nestcipher_target", "nestcipher_challenge_name"]) {
      const line = frontmatter.split("\n").find((entry) => entry.startsWith(`${key}: `));
      expect(line).toBeDefined();
      expect(JSON.parse(line!.slice(key.length + 2))).toBe(value);
    }
    const tags = frontmatter.split("\n").find((entry) => entry.startsWith("tags: "));
    expect(JSON.parse(tags!.slice(6))).toEqual([value]);
    expect(frontmatter).not.toContain("\u2028");
    expect(frontmatter).not.toContain("\u2029");
  });

  it("handles many short backtick runs without argument-spread limits", () => {
    const experiment = fixture();
    experiment.attempts[0].input = "`x".repeat(50_000);
    const markdown = exportExperimentMarkdown(experiment, { exportedAt: NOW });
    expect(markdown).toContain(`\`\`\`text\n${experiment.attempts[0].input}\n\`\`\``);
  });

  it("adds exactly 30 full UTC days across timezone, month and leap boundaries", () => {
    const challenge = { name: "Synthetic challenge", endsAt: "2026-01-31T23:30:00+02:00", endConfirmed: true };
    const before = getDisclosureStatus(challenge, "2026-03-02T21:29:59.999Z");
    expect(before).toEqual({ publicNotBefore: "2026-03-02T21:30:00.000Z", status: "embargoed", publicationPermitted: false });
    expect(getDisclosureStatus(challenge, "2026-03-02T21:30:00.000Z")).toMatchObject({ status: "window-reached", publicationPermitted: false });
    expect(getDisclosureStatus({ ...challenge, endsAt: "2028-02-29T00:00:00Z" }, NOW).publicNotBefore).toBe("2028-03-30T00:00:00.000Z");
    expect(getDisclosureStatus({ ...challenge, endsAt: "2027-12-01T00:00:00Z" }, NOW)).toMatchObject({ status: "embargoed", publicationPermitted: false });
  });

  it("never establishes an eligible date for unknown or unconfirmed ends", () => {
    expect(getDisclosureStatus({ name: "", endsAt: null, endConfirmed: false }, NOW)).toEqual({ publicNotBefore: null, status: "end-unknown", publicationPermitted: false });
    expect(getDisclosureStatus({ name: "Synthetic", endsAt: "2020-01-01T00:00:00Z", endConfirmed: false }, NOW)).toEqual({ publicNotBefore: null, status: "end-unconfirmed", publicationPermitted: false });
    expect(() => getDisclosureStatus({ name: "", endsAt: null, endConfirmed: true }, NOW)).toThrow();
  });

  it("validates derived imported dates and remains private after the date is reached", () => {
    const experiment = withChallenge(fixture(), { name: "Synthetic closed exercise", endsAt: "2026-08-01T00:00:00Z", endConfirmed: true }, NOW);
    expect(experiment.disclosure.publicNotBefore).toBe("2026-08-31T00:00:00.000Z");
    expect(getDisclosureStatus(experiment.disclosure.challenge, NOW).publicationPermitted).toBe(false);
    expect(JSON.parse(exportExperimentJson(experiment)).disclosure).toEqual(experiment.disclosure);
    expect(exportExperimentMarkdown(experiment, { exportedAt: NOW })).toContain("visibility: private\npublish: false");
    const forged = structuredClone(experiment);
    forged.disclosure.publicNotBefore = "2026-08-02T00:00:00.000Z";
    expect(restoreExperiment(JSON.stringify(forged)).ok).toBe(false);
    const unknown = structuredClone(experiment);
    unknown.disclosure.challenge.endConfirmed = false;
    expect(restoreExperiment(JSON.stringify(unknown)).ok).toBe(false);
  });
});
