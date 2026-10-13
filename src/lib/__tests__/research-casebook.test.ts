import { describe, expect, it } from "vitest";
import {
  CASEBOOK_ORIGIN_NOTICE,
  exportResearchCasebookMarkdown,
  getResearchCasebookEntry,
  researchCasebook,
  type CasebookEntry,
} from "../research-casebook";
import { compareLabConditions, getResearchLab } from "../research-labs";

const ids = ["labels-and-authority", "reply-and-effect", "criterion-and-fidelity"];
const sourceUrls = new Set([
  "https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html",
  "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
  "https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations",
]);

describe("public authored research casebook", () => {
  it("contains distinct, versioned fictional walkthroughs linked to existing labs", () => {
    expect(researchCasebook.map((entry) => entry.id)).toEqual(ids);
    expect(new Set(researchCasebook.map((entry) => entry.ordinal)).size).toBe(3);
    for (const entry of researchCasebook) {
      expect(entry.origin).toBe("authored-fictional");
      expect(entry.version).toBe(1);
      expect(getResearchLab(entry.labId)).toBeDefined();
      expect(entry.question.endsWith("?")).toBe(true);
      expect(entry.supportedClaim).not.toBe(entry.unsupportedClaim);
      expect(entry.followUp.length).toBeGreaterThan(100);
    }
    expect(CASEBOOK_ORIGIN_NOTICE).toContain("No model or tools run");
    expect(CASEBOOK_ORIGIN_NOTICE).toContain("No live challenge findings");
  });

  it.each(ids)("resolves only the exact built-in identifier %s", (id) => {
    expect(getResearchCasebookEntry(id)).toBe(researchCasebook.find((entry) => entry.id === id));
  });

  it.each([
    undefined, null, 1, {}, [], ["labels-and-authority"],
    "unknown", "constructor", "__proto__", "LABELS-AND-AUTHORITY",
    " labels-and-authority ", "../labels-and-authority", "labels-and-authority?draft=private",
    "https://nestcipher.com/casebook/labels-and-authority",
  ])("does not interpret an unsupported lookup as a path, query or record: %j", (id) => {
    expect(getResearchCasebookEntry(id as string)).toBeUndefined();
    expect(exportResearchCasebookMarkdown(id as string)).toBeUndefined();
  });

  it("keeps every fictional payload independent of external destinations and real recipients", () => {
    for (const entry of researchCasebook) {
      const payload = [entry.trustedTask, ...[entry.baseline, entry.variant].flatMap((record) => [
        record.input, record.context, record.reply, ...record.actionRecord.map((action) => action.text),
      ])].join("\n");
      expect(payload).not.toMatch(/https?:\/\//i);
      expect(payload).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      expect(payload).not.toMatch(/Gray Swan|Arena|challenge/i);
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(sourceUrls.has(source.url)).toBe(true);
        expect(new URL(source.url).protocol).toBe("https:");
      }
    }
  });

  it("freezes nested evidence and returns no mutable Workbench experiment", () => {
    const original = JSON.stringify(researchCasebook);
    expect(Object.isFrozen(researchCasebook)).toBe(true);
    for (const entry of researchCasebook) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.baseline)).toBe(true);
      expect(Object.isFrozen(entry.variant.actionRecord)).toBe(true);
      expect(Object.isFrozen(entry.variant.actionRecord[0])).toBe(true);
      expect(Object.isFrozen(entry.conditions[0])).toBe(true);
      expect(Object.isFrozen(entry.sources[0])).toBe(true);
      expect(Reflect.set(entry.baseline, "reply", "Private learner observation")).toBe(false);
      expect(Reflect.set(entry.conditions[0], "variant", "Private captured input")).toBe(false);
      expect(entry).not.toHaveProperty("attempts");
      expect(entry).not.toHaveProperty("executionState");
      expect(entry.baseline).not.toHaveProperty("reportedTestAt");
    }
    expect(JSON.stringify(researchCasebook)).toBe(original);
  });
});

describe("exact and bounded comparison designs", () => {
  it.each(ids)("records one changed input and preserves unknown conditions for %s", (id) => {
    const entry = getResearchCasebookEntry(id)!;
    const compared = compareLabConditions(entry.conditions);
    expect(compared.changed).toEqual(["Captured input"]);
    expect(compared.unknown).toEqual(["Real model version", "Real inference settings"]);
    expect(compared.matched).not.toContain("Real model version");
    expect(compared.matched).not.toContain("Real inference settings");
    expect(entry.baseline.context).toBe(entry.variant.context);
    expect(entry.variant.input.startsWith(`${entry.baseline.input}\n\n`)).toBe(true);
    expect(entry.conditions.find((condition) => condition.label === "Captured input")).toEqual({
      label: "Captured input", baseline: entry.baseline.input, variant: entry.variant.input,
    });
    expect(entry.conditions.find((condition) => condition.label === "Fixed task context")).toEqual({
      label: "Fixed task context", baseline: entry.baseline.context, variant: entry.variant.context,
    });
    expect(entry.conditions.find((condition) => condition.label === "Execution")?.baseline).toContain("no inference or tools");
  });

  it("keeps the inventory source's authority claim separate from the fixed trusted task", () => {
    const entry = getResearchCasebookEntry("labels-and-authority")!;
    expect(entry.baseline.context).toBe(entry.trustedTask);
    expect(entry.baseline.input).not.toContain("EDITOR NOTE");
    expect(entry.variant.input).toContain("EDITOR NOTE");
    expect(entry.variant.context).not.toContain("EDITOR NOTE");
    expect(entry.baseline.reply).toContain("North store: 12");
    expect(entry.variant.reply).toContain("North store: 100");
    expect(entry.variant.assessment).toContain("does not meet");
    expect(entry.unsupportedClaim).toContain("None of those events was tested");
    expect(entry.variant.actionRecord.every((action) => action.state === "none")).toBe(true);
  });

  it("does not convert the booking proposal or matching replies into a completed effect", () => {
    const entry = getResearchCasebookEntry("reply-and-effect")!;
    expect(entry.baseline.reply).toBe(entry.variant.reply);
    expect(entry.variant.actionRecord.map((action) => action.state)).toEqual(["proposed", "unknown"]);
    expect(entry.variant.actionRecord.some((action) => action.state === "completed")).toBe(false);
    expect(entry.variant.assessment).toContain("inconclusive");
    expect(entry.variant.limits).toContain("no real room booking was attempted");
    expect(entry.unsupportedClaim).toContain("proposal was blocked");
    expect(entry.baseline.actionRecord[1].label).toContain("Complete authored");
  });

  it("distinguishes the variant's fulfilled format condition from omitted required content", () => {
    const entry = getResearchCasebookEntry("criterion-and-fidelity")!;
    expect(entry.baseline.reply.split("\n")).toHaveLength(3);
    expect(entry.variant.reply.split("\n")).toHaveLength(1);
    expect(entry.baseline.reply).toContain("09:30 — Willow bridge, accessible route");
    expect(entry.variant.reply).not.toContain("Willow bridge");
    expect(entry.variant.reply).not.toContain("accessible route");
    expect(entry.variant.assessment).toContain("does not meet the combined");
    expect(entry.criterion).toContain("Check content and format independently");
    expect(entry.variant.actionRecord.every((action) => action.state === "none")).toBe(true);
  });
});

describe("standalone authored Markdown notes", () => {
  it.each(ids)("preserves the fictional origin, complete evidence and limits in %s", (id) => {
    const entry = getResearchCasebookEntry(id)!;
    const note = exportResearchCasebookMarkdown(id)!;
    expect(note).toContain(CASEBOOK_ORIGIN_NOTICE);
    expect(note).toContain("Origin: authored-fictional · Fixture version: 1");
    for (const record of [entry.baseline, entry.variant]) {
      expect(note).toContain(`\n${record.input}\n`);
      expect(note).toContain(`\n${record.context}\n`);
      expect(note).toContain(`\n${record.reply}\n`);
      expect(note).toContain(record.assessment);
      expect(note).toContain(record.limits);
      for (const action of record.actionRecord) expect(note).toContain(action.text);
    }
    expect(note).toContain(entry.supportedClaim);
    expect(note).toContain(entry.unsupportedClaim);
    expect(note).toContain(entry.followUp);
    expect(note).toContain("Unknown / not captured");
    expect(note).toContain("They did not produce or verify these fictional replies");
    expect(note).toContain("30 full days after the confirmed challenge end");
    expect(note).toContain("unknown or unconfirmed ends remain restricted");
    expect(note).not.toContain("schemaVersion");
    expect(note).not.toContain("reportedTestAt");
    expect(note.endsWith("\n")).toBe(true);
    for (const source of entry.sources) expect(note).toContain(source.url);
  });

  it("exports deterministically without altering the immutable catalog or sharing session state", () => {
    const original = JSON.stringify(researchCasebook);
    const first = exportResearchCasebookMarkdown("reply-and-effect");
    exportResearchCasebookMarkdown("labels-and-authority");
    expect(exportResearchCasebookMarkdown("reply-and-effect")).toBe(first);
    expect(JSON.stringify(researchCasebook)).toBe(original);
    expect(getResearchCasebookEntry("reply-and-effect")).toEqual(researchCasebook[1] as CasebookEntry);
  });
});
