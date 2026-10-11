import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createAttempt, createExperiment, duplicateAttempt, exportExperimentMarkdown, withChallenge, type EvidenceField } from "../research-workbench";
import { createHeadersReportSnapshot } from "../research-report";
import type { SavedResearchRecord } from "../research-library";
import {
  buildObsidianResearchPack, encodeResearchPackZip, getObsidianResearchPackEligibility,
  ObsidianResearchPackError, OBSIDIAN_RESEARCH_PACK_LIMITS, type ObsidianResearchPack,
} from "../obsidian-research-pack";

const NOW = "2026-10-11T12:00:00.000Z";
const OMIT_ALL: EvidenceField[] = ["input", "context", "response", "actions", "notes", "assessmentReason", "executionError"];
const fixture = (title = "Synthetic private record"): SavedResearchRecord => {
  const experiment = createExperiment({ now: NOW });
  experiment.title = title;
  experiment.attempts[0].input = "Invented prompt, not a live challenge finding";
  return { experiment, summary: { id: experiment.id, title, attemptCount: 1, savedAt: NOW, updatedAt: NOW, revision: 1 } };
};
const options = { exportedAt: NOW };
const noteFor = (pack: ObsidianResearchPack, record: SavedResearchRecord) => pack.files.find((file) => file.path === `experiments/${record.experiment.id}.md`)!.content;
const expectCode = (action: () => unknown, code: ObsidianResearchPackError["code"]) => {
  try { action(); throw new Error("Expected pack operation to fail"); }
  catch (error) { expect(error).toBeInstanceOf(ObsidianResearchPackError); expect((error as ObsidianResearchPackError).code).toBe(code); }
};

describe("linked private Obsidian research pack", () => {
  it("creates stable UUID paths and escaped linked titles, never using hostile titles as filenames", () => {
    const first = fixture("../outside [bait](https://example.invalid) <script>alert(1)</script>\n# injected | 研究 🔬");
    const second = fixture("Second note");
    const pack = buildObsidianResearchPack([first, second], options);
    expect(pack.recordCount).toBe(2);
    expect(pack.files.map(({ path }) => path)).toEqual(["README.md", "index.md", `experiments/${first.experiment.id}.md`, `experiments/${second.experiment.id}.md`]);
    const index = pack.files[1].content;
    expect(index).toContain(`](experiments/${first.experiment.id}.md)`);
    expect(index).not.toContain("<script>");
    expect(index).not.toContain("\n# injected");
    expect(index).toContain("研究 🔬");
    first.experiment.title = "Renamed safely";
    first.summary.title = first.experiment.title;
    expect(buildObsidianResearchPack([first], options).files[2].path).toBe(pack.files[2].path);
  });

  it("delegates notes to the existing serializer, preserving exact evidence and parent-linked history", () => {
    const record = fixture();
    const attempt = record.experiment.attempts[0];
    attempt.input = " 研究 🔬\r\n```literal fence`````\n\u200B\t final spaces  ";
    attempt.conditions.context = "Exact context\r\n\u202E";
    attempt.response = "  Exact response\r\n \n";
    attempt.notes = "Do not replace or normalize this text";
    const variant = duplicateAttempt(attempt, { now: NOW });
    variant.input = "Untested variation";
    record.experiment.attempts.push(variant);
    record.summary.attemptCount = 2;
    const before = JSON.stringify(record);
    const pack = buildObsidianResearchPack([record], options);
    const note = noteFor(pack, record);
    expect(note).toBe(`${exportExperimentMarkdown(record.experiment, options)}\n[Back to the research index](../index.md)\n`);
    expect(note).toContain(attempt.input);
    expect(note).toContain(attempt.conditions.context);
    expect(note).toContain(attempt.response);
    expect(note).toContain(`Parent: ${attempt.id}`);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("retains private disclosure for a passed date, unknown end and unconfirmed end without granting sharing", () => {
    const confirmed = fixture("Confirmed synthetic end");
    confirmed.experiment = withChallenge(confirmed.experiment, { name: "Invented challenge", endsAt: "2026-08-01T00:00:00.000Z", endConfirmed: true }, NOW);
    const unknown = fixture("Unknown synthetic end");
    const unconfirmed = fixture("Unconfirmed synthetic end");
    unconfirmed.experiment = withChallenge(unconfirmed.experiment, { name: "Invented challenge", endsAt: NOW, endConfirmed: false }, NOW);
    const pack = buildObsidianResearchPack([confirmed, unknown, unconfirmed], options);
    for (const file of pack.files) {
      expect(file.content).toContain("visibility: private");
      expect(file.content).toContain("publish: false");
    }
    expect(noteFor(pack, confirmed)).toContain('nestcipher_public_not_before: "2026-08-31T00:00:00.000Z"');
    expect(noteFor(pack, unknown)).toContain("No public disclosure date is established.");
    expect(noteFor(pack, unconfirmed)).toContain("No public disclosure date is established.");
    expect(pack.files[1].content).toContain("30 full days after the confirmed challenge end");
    expect(pack.files[0].content).toContain("not encrypted");
    expect(pack.files[0].content).toContain("not a lossless restore format");
  });

  it("applies whole-field omission to every attempt and treats report inclusion as a separate explicit option", () => {
    const record = fixture();
    const attempt = record.experiment.attempts[0];
    attempt.input = "omit-input-marker";
    attempt.response = "omit-response-marker";
    attempt.notes = "keep-notes-marker";
    record.experiment.defaults.context = "omit-default-context-marker";
    attempt.conditions.context = "omit-attempt-context-marker";
    attempt.reportSnapshots = [createHeadersReportSnapshot({
      url: "https://example.invalid/report-sensitive-marker", grade: "A+", score: 100, maxScore: 100, scannedAt: NOW,
      headers: [{ name: "Invented-Header", present: true, value: "Report may quote input", score: 100, maxScore: 100,
        status: "pass", description: "Synthetic report", recommendation: null }],
      serverInfo: { ip: null, server: null, poweredBy: null },
    }, { now: NOW })];
    const variant = duplicateAttempt(attempt, { now: NOW });
    variant.response = "omit-response-variant-marker";
    record.experiment.attempts.push(variant);
    record.summary.attemptCount = 2;
    const before = JSON.stringify(record);
    const omittedFields: EvidenceField[] = ["input", "context", "response"];
    const pack = buildObsidianResearchPack([record], { ...options, omittedFields, includeReportSnapshots: false });
    const text = pack.files.map(({ content }) => content).join("\n");
    for (const marker of ["omit-input-marker", "omit-response-marker", "omit-default-context-marker", "omit-attempt-context-marker", "omit-response-variant-marker", "report-sensitive-marker"]) expect(text).not.toContain(marker);
    expect(text).toContain("keep-notes-marker");
    expect(text).toContain("All report snapshots omitted");
    expect(noteFor(buildObsidianResearchPack([record], { ...options, omittedFields }), record)).toContain("report-sensitive-marker");
    expect(JSON.stringify(record)).toBe(before);
  });

  it("reports partial saved records clearly and rejects the entire selection rather than skipping them", () => {
    const complete = fixture();
    const noTitle = fixture("");
    expect(getObsidianResearchPackEligibility(noTitle, options)).toEqual({ eligible: false, error: expect.stringContaining("title") });
    expectCode(() => buildObsidianResearchPack([complete, noTitle], options), "invalid-record");
    const noInput = fixture("Saved partial record");
    noInput.experiment.attempts[0].input = " \t\r\n ";
    expect(getObsidianResearchPackEligibility(noInput, options)).toEqual({ eligible: false, error: expect.stringContaining("input") });
    expectCode(() => buildObsidianResearchPack([noInput], options), "invalid-record");
    const noAttempts = fixture();
    noAttempts.experiment.attempts = [];
    noAttempts.summary.attemptCount = 0;
    expectCode(() => buildObsidianResearchPack([noAttempts], options), "invalid-record");
    expect(getObsidianResearchPackEligibility(complete, options)).toEqual({ eligible: true });
  });

  it("validates saved-copy metadata and unsafe input without echoing record contents", () => {
    const record = fixture("SENSITIVE_TITLE_NOT_FOR_ERRORS");
    record.summary.id = crypto.randomUUID();
    expectCode(() => buildObsidianResearchPack([record], options), "invalid-record");
    expect(getObsidianResearchPackEligibility(record, options)).toEqual({ eligible: false, error: expect.not.stringContaining(record.experiment.title) });
    record.summary.id = record.experiment.id;
    record.summary.attemptCount = 5;
    expectCode(() => buildObsidianResearchPack([record], options), "invalid-record");
    record.summary.attemptCount = 1;
    record.summary.revision = 0;
    expectCode(() => buildObsidianResearchPack([record], options), "invalid-record");
    record.summary.revision = 1;
    record.experiment.id = "../../escape";
    expectCode(() => buildObsidianResearchPack([record], options), "invalid-record");
  });

  it("rejects empty selections, duplicate IDs, over-limit selections and invalid omission/export options", () => {
    const record = fixture();
    expectCode(() => buildObsidianResearchPack([], options), "empty");
    expectCode(() => buildObsidianResearchPack([record, record], options), "duplicate-record");
    expectCode(() => buildObsidianResearchPack(Array.from({ length: 26 }, () => fixture()), options), "limit");
    expectCode(() => buildObsidianResearchPack([record], { exportedAt: "not-a-timestamp" }), "invalid-options");
    expectCode(() => buildObsidianResearchPack([record], { omittedFields: ["unknown" as EvidenceField] }), "invalid-options");
    expectCode(() => buildObsidianResearchPack([record], { includeReportSnapshots: "yes" as unknown as boolean }), "invalid-options");
  });

  it("accepts all 25 supported saved records with one linked note per selected record", () => {
    const records = Array.from({ length: 25 }, (_, index) => fixture(`Synthetic record ${index}`));
    const pack = buildObsidianResearchPack(records, options);
    expect(pack.files).toHaveLength(OBSIDIAN_RESEARCH_PACK_LIMITS.maxFiles);
    expect(pack.recordCount).toBe(25);
    for (const record of records) expect(pack.files[1].content).toContain(`](experiments/${record.experiment.id}.md)`);
    expect(encodeResearchPackZip(pack).byteLength).toBeLessThan(OBSIDIAN_RESEARCH_PACK_LIMITS.maxOutputBytes);
  });

  it("enforces the 50 MiB source quota even when omissions make Markdown output small", () => {
    const repeated = "x".repeat(90_000);
    const records = Array.from({ length: 11 }, () => {
      const record = fixture();
      record.experiment.attempts = Array.from({ length: 8 }, () => {
        const attempt = createAttempt(record.experiment.defaults, { now: NOW });
        for (const field of OMIT_ALL) {
          if (field === "context") attempt.conditions.context = repeated;
          else attempt[field] = repeated;
        }
        return attempt;
      });
      record.summary.attemptCount = 8;
      return record;
    });
    expectCode(() => buildObsidianResearchPack(records, { ...options, omittedFields: OMIT_ALL }), "limit");
  });
});

describe("portable research pack ZIP", () => {
  it("round-trips every UTF-8 file through Python's independent ZIP reader, with correct CRC and STORE entries", () => {
    const record = fixture("Unicode research 研究 🔬 café");
    record.experiment.attempts[0].input = "Exact Unicode: e\u0301 and é; 研究 🔬\r\n  tabs\tand space  ";
    const pack = buildObsidianResearchPack([record], options);
    const zip = encodeResearchPackZip(pack);
    const script = [
      "import io, json, sys, zipfile",
      "with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:",
      "    assert archive.testzip() is None",
      "    assert all(info.compress_type == zipfile.ZIP_STORED for info in archive.infolist())",
      "    assert all(info.flag_bits & 0x800 for info in archive.infolist())",
      "    assert all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in archive.infolist())",
      "    print(json.dumps([{'path': info.filename, 'content': archive.read(info).decode('utf-8')} for info in archive.infolist()], ensure_ascii=True))",
    ].join("\n");
    const result = spawnSync("python3", ["-c", script], { input: zip, maxBuffer: 1024 * 1024, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(pack.files);
    expect(encodeResearchPackZip(pack)).toEqual(zip);
  });

  it("refuses path traversal, absolute paths, duplicate entries and a mismatched record count", () => {
    const pack = buildObsidianResearchPack([fixture()], options);
    for (const path of ["../outside.md", "/absolute.md", "experiments/../outside.md", "experiments\\outside.md", "https://example.invalid/file.md", "experiments/not-a-uuid.md"]) {
      expectCode(() => encodeResearchPackZip({ ...pack, files: pack.files.map((file, index) => index === 2 ? { ...file, path } : file) }), "invalid-pack");
    }
    expectCode(() => encodeResearchPackZip({ ...pack, files: [pack.files[0], pack.files[1], pack.files[1]] }), "invalid-pack");
    expectCode(() => encodeResearchPackZip({ ...pack, recordCount: 2 }), "invalid-pack");
    expectCode(() => encodeResearchPackZip({ ...pack, files: pack.files.map((file, index) => index === 0 ? { ...file, path: `experiments/${crypto.randomUUID()}.md` } : file) }), "invalid-pack");
  });

  it("bounds individual UTF-8 files and the complete archive before allocating the final ZIP", () => {
    const pack = buildObsidianResearchPack([fixture()], options);
    expectCode(() => encodeResearchPackZip({ ...pack, files: pack.files.map((file, index) => index === 2 ? { ...file, content: "🔬".repeat(2 * 1024 * 1024) } : file) }), "limit");
    const recordCount = 16;
    const content = "x".repeat(4 * 1024 * 1024);
    const largePack = { recordCount, files: [pack.files[0], pack.files[1], ...Array.from({ length: recordCount }, () => ({ path: `experiments/${crypto.randomUUID()}.md`, content }))] };
    expectCode(() => encodeResearchPackZip(largePack), "limit");
  });
});
