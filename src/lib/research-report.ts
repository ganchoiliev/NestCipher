import { z } from "zod";
import type { EmailAnalysisResponse } from "@/types/email-analyzer";
import type { ScanResponse } from "@/types/headers-scanner";

export const REPORT_LIMITS = {
  maxEncodedBytes: 1024 * 1024,
  maxEvidenceLength: 100_000,
  maxMetadataLength: 2_000,
  maxCategories: 20,
  maxFindings: 100,
  maxSuspiciousElements: 100,
  maxRecommendations: 100,
  maxHeaders: 50,
  maxPerAttempt: 10,
  maxPerExperiment: 50,
} as const;

const evidence = z.string().max(REPORT_LIMITS.maxEvidenceLength);
const metadata = z.string().max(REPORT_LIMITS.maxMetadataLength);
const timestamp = z.iso.datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)));
const identifier = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const score = z.number().finite().min(0).max(100);
const threatLevel = z.enum(["critical", "high", "medium", "low", "safe"]);

// These are captured response shapes, not a new grading or model-verdict policy.
const emailReportSchema = z.strictObject({
  overallScore: score,
  overallLevel: threatLevel,
  verdict: evidence,
  categories: z.array(z.strictObject({
    name: metadata, score, level: threatLevel,
    findings: z.array(evidence).max(REPORT_LIMITS.maxFindings), explanation: evidence,
  })).min(1).max(REPORT_LIMITS.maxCategories),
  suspiciousElements: z.array(z.strictObject({
    type: z.enum(["link", "sender", "attachment", "language", "impersonation", "other"]),
    value: evidence, reason: evidence,
  })).max(REPORT_LIMITS.maxSuspiciousElements),
  recommendations: z.array(evidence).max(REPORT_LIMITS.maxRecommendations),
  summary: evidence,
  analysedAt: timestamp,
});

const headersReportSchema = z.strictObject({
  url: evidence,
  grade: z.enum(["A+", "A", "B", "C", "D", "F"]),
  score,
  maxScore: z.number().finite().positive().max(100),
  scannedAt: timestamp,
  headers: z.array(z.strictObject({
    name: metadata, present: z.boolean(), value: evidence.nullable(), score,
    maxScore: z.number().finite().positive().max(100),
    status: z.enum(["pass", "fail", "partial"]),
    description: evidence, recommendation: evidence.nullable(),
  })).min(1).max(REPORT_LIMITS.maxHeaders),
  serverInfo: z.strictObject({ ip: metadata.nullable(), server: evidence.nullable(), poweredBy: evidence.nullable() }),
});

const envelope = {
  format: z.literal("nestcipher-report-snapshot"),
  snapshotVersion: z.literal(1),
  id: identifier,
  capturedAt: timestamp,
  visibility: z.literal("private"),
  publish: z.literal(false),
  provenance: z.strictObject({
    captureScope: z.literal("report-only"),
    rawInputIncluded: z.literal(false),
    verification: z.literal("unverified"),
    // The current responses do not expose these fields. Never guess from configuration.
    provider: z.null(), model: z.null(), policyVersion: z.null(),
    httpMethod: z.null(), originalTarget: z.null(),
  }),
};

export const reportSnapshotSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...envelope, kind: z.literal("email-analysis"), report: emailReportSchema }),
  z.strictObject({ ...envelope, kind: z.literal("headers-scan"), report: headersReportSchema }),
]).superRefine((snapshot, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > REPORT_LIMITS.maxEncodedBytes) {
    ctx.addIssue({ code: "custom", message: "The report snapshot exceeds the 1 MiB encoded-document limit." });
  }
});
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ReportSnapshotValidation = { ok: true; snapshot: ReportSnapshot } | { ok: false; error: string };

const encodedLength = (text: string) => new TextEncoder().encode(text).byteLength;

export function validateReportSnapshot(value: unknown): ReportSnapshotValidation {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== "string") return { ok: false, error: "Expected a private NestCipher report snapshot." };
    if (encodedLength(json) > REPORT_LIMITS.maxEncodedBytes) return { ok: false, error: "The report snapshot exceeds the 1 MiB encoded-document limit." };
  } catch {
    return { ok: false, error: "The report snapshot is not a serializable document." };
  }
  const parsed = reportSnapshotSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Unsupported report snapshot structure or invalid field value. The existing attempt is unchanged." };
  return { ok: true, snapshot: parsed.data };
}

function requireSnapshot(value: unknown): ReportSnapshot {
  const checked = validateReportSnapshot(value);
  if (!checked.ok) throw new Error(checked.error);
  return checked.snapshot;
}

type CaptureOptions = { now?: string; id?: string };
function captureEnvelope(options: CaptureOptions) {
  return {
    format: "nestcipher-report-snapshot", snapshotVersion: 1,
    id: options.id ?? crypto.randomUUID(), capturedAt: options.now ?? new Date().toISOString(),
    visibility: "private", publish: false,
    provenance: {
      captureScope: "report-only", rawInputIncluded: false, verification: "unverified",
      provider: null, model: null, policyVersion: null, httpMethod: null, originalTarget: null,
    },
  };
}

/** Copies the completed response only. It never receives or exports raw email input. */
export function createEmailReportSnapshot(report: EmailAnalysisResponse, options: CaptureOptions = {}): ReportSnapshot {
  return requireSnapshot({ ...captureEnvelope(options), kind: "email-analysis", report });
}

/** The report URL is the returned URL; the original submitted target and method remain unknown. */
export function createHeadersReportSnapshot(report: ScanResponse, options: CaptureOptions = {}): ReportSnapshot {
  return requireSnapshot({ ...captureEnvelope(options), kind: "headers-scan", report });
}

export function restoreReportSnapshot(json: string): ReportSnapshotValidation {
  if (typeof json !== "string") return { ok: false, error: "Choose a private NestCipher report snapshot JSON file." };
  if (encodedLength(json) > REPORT_LIMITS.maxEncodedBytes) return { ok: false, error: "The report snapshot exceeds the 1 MiB encoded-file limit." };
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { return { ok: false, error: "The report snapshot is not valid JSON." }; }
  return validateReportSnapshot(value);
}

export function exportReportSnapshot(snapshot: ReportSnapshot): string {
  const checked = requireSnapshot(snapshot);
  const pretty = JSON.stringify(checked, null, 2);
  return encodedLength(pretty) <= REPORT_LIMITS.maxEncodedBytes ? pretty : JSON.stringify(checked);
}
