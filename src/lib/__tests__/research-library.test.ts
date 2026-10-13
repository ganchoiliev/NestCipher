import { describe, expect, it } from "vitest";
import { createAttempt, createExperiment, duplicateAttempt, withChallenge } from "../research-workbench";
import { createHeadersReportSnapshot } from "../research-report";
import { buildResearchLibraryIndex, filterResearchLibraryIndex, getResearchLibrary, type SavedResearchRecord } from "../research-library";

const NOW = "2026-10-11T12:00:00.000Z";
function fixture(title = "Synthetic saved research"): SavedResearchRecord {
  const experiment = createExperiment({ now: NOW });
  experiment.title = title;
  experiment.defaults.target = "Current invented target";
  experiment.attempts[0].conditions.target = "Historical invented target";
  experiment.attempts[0].conditions.criterion = "Researcher-entered criterion";
  experiment.attempts[0].input = "Invented prompt awaiting a test";
  return { experiment, summary: { id: experiment.id, title, attemptCount: 1, savedAt: NOW, updatedAt: NOW, revision: 1 } };
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("private research library", () => {
  it("searches full entered text across fields, Unicode and historical attempts rather than only titles", () => {
    const record = fixture();
    record.experiment.defaults.question = "Invented prompt hypothesis";
    record.experiment.attempts[0].response = "研究者 recorded an unusual observation";
    record.experiment.attempts[0].notes = "BLUEBIRD next step";
    const other = fixture("An unrelated saved record");
    expect(getResearchLibrary([record, other], { query: "  bluebird  研究者 HYPOTHESIS " }).map(({ record }) => record.summary.id)).toEqual([record.summary.id]);
    expect(getResearchLibrary([record], { query: "absent observation" })).toEqual([]);
    expect(getResearchLibrary([record], { query: "  " })).toHaveLength(1);
    expect(getResearchLibrary([record], { query: "assessmentReason" })).toEqual([]);
  });

  it("includes report text in local search without converting an attached grade into a research assessment", () => {
    const record = fixture();
    record.experiment.attempts[0].reportSnapshots = [createHeadersReportSnapshot({
      url: "https://example.invalid/synthetic-capture", grade: "A+", score: 100, maxScore: 100, scannedAt: NOW,
      headers: [{ name: "Invented-Header", present: true, value: "Unique report phrase", score: 100, maxScore: 100,
        status: "pass", description: "Synthetic attached report", recommendation: null }],
      serverInfo: { ip: null, server: null, poweredBy: null },
    }, { now: NOW })];
    const entry = getResearchLibrary([record], { query: "unique report phrase" })[0];
    expect(entry.record).toBe(record);
    expect(entry.counts).toEqual({ total: 1, notTested: 1, errors: 0, unassessed: 1, needsContext: 0 });
    expect(entry.needsReview).toBe(true);
    expect(record.experiment.attempts[0].assessment).toBe("unassessed");
  });

  it("filters exact tags and all historical targets, retaining stored labels and saved order", () => {
    const first = fixture("First");
    const parent = first.experiment.attempts[0];
    const variant = duplicateAttempt(parent, { now: NOW });
    variant.conditions.target = "Another historical target";
    first.experiment.attempts.push(variant);
    first.experiment.tags = ["campaign-a", "campaign-a", "", "  ", "CaseSensitive", " original spacing "];
    const second = fixture("Second");
    second.experiment.tags = ["campaign-a"];
    const entries = getResearchLibrary([second, first], { tag: "campaign-a", target: "Historical invented target" });
    expect(entries.map(({ record }) => record.summary.title)).toEqual(["Second", "First"]);
    expect(entries[1].tags).toEqual(["campaign-a", "CaseSensitive", " original spacing "]);
    expect(entries[1].targets).toEqual(["Current invented target", "Historical invented target", "Another historical target"]);
    expect(getResearchLibrary([first], { target: "current invented target" })).toEqual([]);
    expect(getResearchLibrary([first], { tag: "casesensitive" })).toEqual([]);
    expect(getResearchLibrary([first], { tag: "campaign-a", query: "missing" })).toEqual([]);
  });

  it("derives needs-review from independently recorded states and gaps, including empty saved drafts", () => {
    const reviewed = fixture("Manually reviewed");
    const attempt = reviewed.experiment.attempts[0];
    attempt.executionState = "recorded";
    attempt.response = "Researcher-entered response";
    attempt.assessment = "not-met";
    attempt.assessmentReason = "Researcher's own reasoning";
    const error = fixture("Recorded error");
    error.experiment.attempts[0].executionState = "error";
    error.experiment.attempts[0].executionError = "Invented error details";
    error.experiment.attempts[0].assessment = "inconclusive";
    error.experiment.attempts[0].assessmentReason = "Cannot interpret the invented failed run";
    const empty = fixture("Empty saved draft");
    empty.experiment.attempts = [];
    const gap = fixture("Manual context gap");
    gap.experiment.attempts[0] = { ...attempt, id: gap.experiment.attempts[0].id,
      conditions: { ...attempt.conditions, criterion: "" } };
    const planned = fixture("Untested plan");
    const records = [reviewed, error, empty, gap, planned];
    expect(getResearchLibrary(records, { needsReview: false }).map(({ record }) => record.experiment.title)).toEqual(["Manually reviewed"]);
    expect(getResearchLibrary(records, { needsReview: true }).map(({ record }) => record.experiment.title)).toEqual([
      "Recorded error", "Empty saved draft", "Manual context gap", "Untested plan",
    ]);
    expect(getResearchLibrary(records)[0].counts).toEqual({ total: 1, notTested: 0, errors: 0, unassessed: 0, needsContext: 0 });
    expect(getResearchLibrary(records)[3].counts.needsContext).toBe(1);
  });

  it("reuses a built index across query changes without traversing the underlying private data again", () => {
    const record = fixture();
    record.experiment.attempts[0].notes = "Unique local needle";
    const index = buildResearchLibraryIndex([record]);
    Object.defineProperty(record.experiment, "attempts", { get() { throw new Error("Must not rebuild entered text while filtering"); } });
    expect(filterResearchLibraryIndex(index, { query: "needle" })).toHaveLength(1);
    expect(filterResearchLibraryIndex(index, { query: "different" })).toEqual([]);
    expect(filterResearchLibraryIndex(index, { target: "Historical invented target" })).toHaveLength(1);
  });

  it("never mutates deeply frozen evidence, disclosure or saved metadata and returns detached derived labels", () => {
    const record = fixture();
    record.experiment.tags = ["private-campaign"];
    record.experiment = withChallenge(record.experiment, { name: "Synthetic unconfirmed challenge", endsAt: NOW, endConfirmed: false }, NOW);
    record.experiment.attempts[0].notes = "<script>publish(true)</script>\r\n\u200B";
    const before = JSON.stringify(record);
    freeze(record);
    const [entry] = getResearchLibrary([record], { query: "publish(true)" });
    entry.tags.push("Detached label");
    entry.targets.push("Detached target");
    entry.counts.notTested = 0;
    expect(JSON.stringify(record)).toBe(before);
    expect(record.experiment.disclosure).toMatchObject({ visibility: "private", publish: false, publicNotBefore: null });
  });

  it("handles the entire 25-record library, retaining independent historical targets and attempt counts", () => {
    const records = Array.from({ length: 25 }, (_, index) => {
      const record = fixture(`Saved research ${index}`);
      record.experiment.attempts.push(createAttempt({ ...record.experiment.defaults, target: `Prior target ${index}` }, { now: NOW }));
      return record;
    });
    expect(getResearchLibrary(records)).toHaveLength(25);
    const [entry] = getResearchLibrary(records, { target: "Prior target 24" });
    expect(entry.record).toBe(records[24]);
    expect(entry.counts.total).toBe(2);
    expect(getResearchLibrary([])).toEqual([]);
  });
});
