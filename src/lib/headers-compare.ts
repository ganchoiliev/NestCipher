import type { HeaderResult, ScanResponse } from "@/types/headers-scanner";

/**
 * Pure helpers for the headers comparison board. No I/O: the board calls the
 * existing /api/scan-headers route once per target, so SSRF guarding, rate
 * limiting and the scoring model stay in one place.
 */

export const MAX_COMPARE_TARGETS = 6;

export type CompareRowState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "done"; result: ScanResponse }
  | { kind: "error"; message: string };

export interface CompareTarget {
  /** Stable key for React and for the status line. */
  id: string;
  /** The text the user typed, trimmed. */
  input: string;
  /** True for the site the user marked as their own. Never redacted. */
  isReference: boolean;
}

/** Short display host: strips scheme, credentials, trailing slash and "www." */
export function shortHost(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./i, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

/** Redacted label for the n-th non-reference site (1-based): "Site 01". */
export function redactedLabel(position: number): string {
  return `Site ${String(position).padStart(2, "0")}`;
}

/**
 * Splits a textarea into targets: one per line, trimmed, de-duplicated by
 * short host, capped at MAX_COMPARE_TARGETS. The optional reference site is
 * appended last so it is scanned and revealed last.
 */
export function parseTargets(
  othersText: string,
  referenceText: string,
): CompareTarget[] {
  const seen = new Set<string>();
  const targets: CompareTarget[] = [];
  const reference = referenceText.trim();
  const referenceKey = reference ? shortHost(reference).toLowerCase() : null;

  for (const raw of othersText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = shortHost(line).toLowerCase();
    if (seen.has(key) || key === referenceKey) continue;
    seen.add(key);
    targets.push({ id: `t-${key}`, input: line, isReference: false });
    if (targets.length === MAX_COMPARE_TARGETS - (reference ? 1 : 0)) break;
  }

  if (reference) {
    targets.push({ id: `ref-${referenceKey}`, input: reference, isReference: true });
  }
  return targets;
}

export interface HeaderSummary {
  passed: number;
  partial: number;
  failed: number;
}

export function summarizeHeaders(headers: HeaderResult[]): HeaderSummary {
  return headers.reduce<HeaderSummary>(
    (acc, h) => {
      if (h.status === "pass") acc.passed += 1;
      else if (h.status === "partial") acc.partial += 1;
      else acc.failed += 1;
      return acc;
    },
    { passed: 0, partial: 0, failed: 0 },
  );
}

/**
 * True when the response discloses something an attacker can use: a server
 * header carrying a version string ("nginx/1.18.0", "Apache/2.4.57") or any
 * X-Powered-By. A bare platform name ("Vercel", "cloudflare") is not a leak.
 */
export function leaksServerInfo(result: ScanResponse): boolean {
  if (result.serverInfo.poweredBy) return true;
  const server = result.serverInfo.server;
  return Boolean(server && /\d/.test(server));
}

export interface CompareRow {
  target: CompareTarget;
  state: CompareRowState;
}

/** Display label honouring redaction. Reference rows are never redacted. */
export function rowLabel(
  row: CompareRow,
  rows: CompareRow[],
  redact: boolean,
): string {
  if (row.target.isReference || !redact) return shortHost(row.target.input);
  const position =
    rows.filter((r) => !r.target.isReference).indexOf(row) + 1;
  return redactedLabel(position);
}

/** Sorted copy: scored rows by score descending, then the rest in input order. */
export function sortRowsByScore(rows: CompareRow[]): CompareRow[] {
  const scored = rows.filter((r) => r.state.kind === "done");
  const rest = rows.filter((r) => r.state.kind !== "done");
  scored.sort((a, b) => {
    const sa = a.state.kind === "done" ? a.state.result.score : 0;
    const sb = b.state.kind === "done" ? b.state.result.score : 0;
    return sb - sa;
  });
  return [...scored, ...rest];
}

/** Plain-text report for the clipboard. Redaction applies to labels and values. */
export function buildCompareReport(
  rows: CompareRow[],
  redact: boolean,
  now: Date = new Date(),
): string {
  const lines: string[] = [
    "nestcipher.com Security Headers Comparison",
    `Generated: ${now.toISOString()}`,
    "---",
  ];
  for (const row of rows) {
    const label = rowLabel(row, rows, redact);
    if (row.state.kind !== "done") {
      lines.push(
        `${label}: ${row.state.kind === "error" ? `not scanned (${row.state.message})` : "not scanned"}`,
      );
      continue;
    }
    const { result } = row.state;
    const s = summarizeHeaders(result.headers);
    lines.push(
      `${label}: ${result.grade} (${result.score}/${result.maxScore}), ${s.passed} pass, ${s.partial} partial, ${s.failed} fail${
        leaksServerInfo(result) ? ", server software disclosed" : ""
      }`,
    );
  }
  return lines.join("\n");
}
