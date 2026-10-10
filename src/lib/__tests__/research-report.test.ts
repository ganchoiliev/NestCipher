import { describe, expect, it } from "vitest";
import type { EmailAnalysisResponse } from "@/types/email-analyzer";
import type { ScanResponse } from "@/types/headers-scanner";
import {
  createEmailReportSnapshot, createHeadersReportSnapshot, exportReportSnapshot,
  REPORT_LIMITS, restoreReportSnapshot, validateReportSnapshot, type ReportSnapshot,
} from "../research-report";

const NOW = "2026-10-10T10:00:00.000Z";
const id = (number: number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const hostile = "  \r\n<script>fetch('https://example.invalid')</script>\n```````\n---\npublish: true\n[[vault-link]]\u200B\u202E\u2028\u2029é🧪\uD800  ";
const email = (): EmailAnalysisResponse => ({
  overallScore: 42, overallLevel: "medium", verdict: "Synthetic verdict",
  categories: [{ name: "Synthetic category", score: 42, level: "medium", findings: [hostile], explanation: "Authored example" }],
  suspiciousElements: [{ type: "link", value: hostile, reason: "Invented example; no analysis was performed" }],
  recommendations: ["Synthetic recommendation"], summary: hostile,
  analysedAt: "2026-10-09T12:00:00+02:00",
});
const headers = (): ScanResponse => ({
  url: "https://example.invalid/final?synthetic=canary", grade: "B", score: 15, maxScore: 25,
  scannedAt: "2026-10-09T12:00:00.000Z",
  headers: [{ name: "Synthetic-Header", present: true, value: hostile, score: 15, maxScore: 25,
    status: "partial", description: "Authored example, not a scan", recommendation: null }],
  serverInfo: { ip: null, server: hostile, poweredBy: null },
});
const fixture = () => createEmailReportSnapshot(email(), { now: NOW, id: id(1) });

describe("private report-only capture", () => {
  it("copies complete email response strings without receiving raw input or guessing provenance", () => {
    const result = email();
    const before = structuredClone(result);
    const snapshot = createEmailReportSnapshot(result, { now: NOW, id: id(1) });
    expect(snapshot).toMatchObject({
      format: "nestcipher-report-snapshot", snapshotVersion: 1, kind: "email-analysis",
      id: id(1), capturedAt: NOW, visibility: "private", publish: false,
      provenance: { captureScope: "report-only", rawInputIncluded: false, verification: "unverified",
        provider: null, model: null, policyVersion: null, httpMethod: null, originalTarget: null },
      report: before,
    });
    expect(result).toEqual(before);
    if (snapshot.kind !== "email-analysis") throw new Error("Expected email snapshot");
    result.summary = "Later changed source";
    expect(snapshot.report.summary).toBe(hostile);
    expect(snapshot.capturedAt).not.toBe(snapshot.report.analysedAt);
    expect(restoreReportSnapshot(exportReportSnapshot(snapshot))).toEqual({ ok: true, snapshot });
  });

  it("preserves returned header URL, nulls, timestamps and reported grades without regrading", () => {
    const result = headers();
    const snapshot = createHeadersReportSnapshot(result, { now: NOW, id: id(2) });
    expect(snapshot.kind).toBe("headers-scan");
    expect(snapshot.report).toEqual(result);
    expect(snapshot.provenance.originalTarget).toBeNull();
    expect(snapshot.provenance.httpMethod).toBeNull();
    expect(restoreReportSnapshot(exportReportSnapshot(snapshot))).toEqual({ ok: true, snapshot });
  });

  it.each([
    ["unknown envelope key", (s: ReportSnapshot) => ({ ...s, rawEmail: "ignored?" })],
    ["unknown report key", (s: ReportSnapshot) => ({ ...s, report: { ...s.report, extra: "ignored?" } })],
    ["unknown provenance key", (s: ReportSnapshot) => ({ ...s, provenance: { ...s.provenance, authenticated: true } })],
    ["future version", (s: ReportSnapshot) => ({ ...s, snapshotVersion: 2 })],
    ["wrong format", (s: ReportSnapshot) => ({ ...s, format: "experiment" })],
    ["public file", (s: ReportSnapshot) => ({ ...s, visibility: "public" })],
    ["publish flag", (s: ReportSnapshot) => ({ ...s, publish: true })],
    ["claimed model", (s: ReportSnapshot) => ({ ...s, provenance: { ...s.provenance, model: "guessed" } })],
    ["claimed raw input", (s: ReportSnapshot) => ({ ...s, provenance: { ...s.provenance, rawInputIncluded: true } })],
    ["invalid id", (s: ReportSnapshot) => ({ ...s, id: "arbitrary" })],
    ["invalid time", (s: ReportSnapshot) => ({ ...s, capturedAt: "2026-02-30T12:00:00Z" })],
    ["unsupported kind", (s: ReportSnapshot) => ({ ...s, kind: "llm-experiment" })],
    ["kind/payload mismatch", (s: ReportSnapshot) => ({ ...s, kind: "headers-scan" })],
    ["invalid score", (s: ReportSnapshot) => ({ ...s, report: { ...s.report, overallScore: 101 } })],
  ])("rejects %s atomically without exposing supplied strings", (_name, mutate) => {
    const snapshot = fixture();
    const before = structuredClone(snapshot);
    const result = restoreReportSnapshot(JSON.stringify(mutate(snapshot)));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected rejection");
    expect(result.error).not.toContain("<script>");
    expect(snapshot).toEqual(before);
  });

  it("enforces field, collection, encoded-byte and serialized-file limits", () => {
    const report = email();
    report.categories[0].name = "x".repeat(REPORT_LIMITS.maxMetadataLength + 1);
    expect(() => createEmailReportSnapshot(report)).toThrow();
    report.categories[0].name = "Synthetic category";
    report.summary = "x".repeat(REPORT_LIMITS.maxEvidenceLength + 1);
    expect(() => createEmailReportSnapshot(report)).toThrow();
    report.summary = "";
    report.categories = Array.from({ length: REPORT_LIMITS.maxCategories + 1 }, () => ({ name: "Synthetic", score: 0, level: "safe", findings: [], explanation: "" }));
    expect(() => createEmailReportSnapshot(report)).toThrow();
    const snapshot = fixture();
    if (snapshot.kind !== "email-analysis") throw new Error("Expected email snapshot");
    snapshot.report.categories[0].findings = Array.from({ length: 6 }, () => "é".repeat(REPORT_LIMITS.maxEvidenceLength));
    expect(JSON.stringify(snapshot).length).toBeLessThan(REPORT_LIMITS.maxEncodedBytes);
    expect(validateReportSnapshot(snapshot).ok).toBe(false);
    expect(restoreReportSnapshot(" ".repeat(REPORT_LIMITS.maxEncodedBytes + 1))).toMatchObject({ ok: false, error: expect.stringContaining("encoded-file") });
    expect(restoreReportSnapshot("{broken").ok).toBe(false);
  });

  it("backs up a valid near-limit capture even when pretty formatting does not fit", () => {
    const snapshot = fixture();
    if (snapshot.kind !== "email-analysis") throw new Error("Expected email snapshot");
    snapshot.report.categories[0].findings = Array.from({ length: 10 }, () => "x".repeat(REPORT_LIMITS.maxEvidenceLength));
    const remaining = REPORT_LIMITS.maxEncodedBytes - bytes(JSON.stringify(snapshot)) - 1;
    expect(remaining).toBeGreaterThan(0);
    snapshot.report.recommendations = ["x".repeat(remaining)];
    expect(validateReportSnapshot(snapshot).ok).toBe(true);
    expect(bytes(JSON.stringify(snapshot, null, 2))).toBeGreaterThan(REPORT_LIMITS.maxEncodedBytes);
    const json = exportReportSnapshot(snapshot);
    expect(bytes(json)).toBeLessThanOrEqual(REPORT_LIMITS.maxEncodedBytes);
    expect(restoreReportSnapshot(json)).toEqual({ ok: true, snapshot });
  });
});
