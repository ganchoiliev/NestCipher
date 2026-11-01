import { describe, expect, it } from "vitest";
import {
  buildCompareReport,
  leaksServerInfo,
  parseTargets,
  redactedLabel,
  rowLabel,
  shortHost,
  sortRowsByScore,
  summarizeHeaders,
  type CompareRow,
} from "../headers-compare";
import type { HeaderResult, ScanResponse } from "@/types/headers-scanner";

function header(name: string, status: HeaderResult["status"], score = 10): HeaderResult {
  return {
    name,
    present: status !== "fail",
    value: status === "fail" ? null : "x",
    score,
    maxScore: 10,
    status,
    description: "",
    recommendation: status === "pass" ? null : "fix",
  };
}

function scan(url: string, score: number, server: string | null = null): ScanResponse {
  return {
    url,
    grade: score >= 85 ? "A" : score >= 55 ? "C" : "F",
    score,
    maxScore: 100,
    scannedAt: "2026-11-01T09:00:00.000Z",
    headers: [header("A", "pass"), header("B", "partial", 5), header("C", "fail", 0)],
    serverInfo: { ip: null, server, poweredBy: null },
  };
}

describe("shortHost", () => {
  it("strips scheme, www and trailing slash", () => {
    expect(shortHost("https://www.example.co.uk/")).toBe("example.co.uk");
  });
  it("keeps a meaningful path", () => {
    expect(shortHost("example.com/pricing/")).toBe("example.com/pricing");
  });
  it("tolerates garbage without throwing", () => {
    expect(shortHost("http://")).toBe("");
  });
});

describe("parseTargets", () => {
  it("dedupes by host, drops blanks and caps at six including the reference", () => {
    const text = [
      "a.com",
      "",
      "https://www.a.com/",
      "b.com",
      "c.com",
      "d.com",
      "e.com",
      "f.com",
      "g.com",
    ].join("\n");
    const targets = parseTargets(text, "mine.com");
    expect(targets.map((t) => t.input)).toEqual([
      "a.com",
      "b.com",
      "c.com",
      "d.com",
      "e.com",
      "mine.com",
    ]);
    expect(targets.at(-1)?.isReference).toBe(true);
  });

  it("does not list the reference twice", () => {
    const targets = parseTargets("mine.com\nother.com", "https://mine.com");
    expect(targets.map((t) => t.input)).toEqual(["other.com", "https://mine.com"]);
  });

  it("works with no reference", () => {
    const targets = parseTargets("a.com\nb.com", "   ");
    expect(targets).toHaveLength(2);
    expect(targets.every((t) => !t.isReference)).toBe(true);
  });
});

describe("labels and summaries", () => {
  const rows: CompareRow[] = [
    { target: { id: "1", input: "one.com", isReference: false }, state: { kind: "done", result: scan("https://one.com", 40, "nginx/1.18") } },
    { target: { id: "2", input: "two.com", isReference: false }, state: { kind: "error", message: "unreachable" } },
    { target: { id: "3", input: "mine.com", isReference: true }, state: { kind: "done", result: scan("https://mine.com", 90) } },
  ];

  it("redacts non-reference rows only", () => {
    expect(rowLabel(rows[0], rows, true)).toBe("Site 01");
    expect(rowLabel(rows[1], rows, true)).toBe("Site 02");
    expect(rowLabel(rows[2], rows, true)).toBe("mine.com");
    expect(rowLabel(rows[0], rows, false)).toBe("one.com");
    expect(redactedLabel(12)).toBe("Site 12");
  });

  it("summarises header statuses", () => {
    expect(summarizeHeaders(scan("x", 1).headers)).toEqual({ passed: 1, partial: 1, failed: 1 });
  });

  it("flags version strings and X-Powered-By, not bare platform names", () => {
    expect(leaksServerInfo(scan("x", 1, "nginx/1.18.0"))).toBe(true);
    expect(leaksServerInfo(scan("x", 1, "Vercel"))).toBe(false);
    expect(leaksServerInfo(scan("x", 1, "cloudflare"))).toBe(false);
    expect(leaksServerInfo(scan("x", 1))).toBe(false);
    const powered = scan("x", 1);
    powered.serverInfo.poweredBy = "PHP/8.1";
    expect(leaksServerInfo(powered)).toBe(true);
  });

  it("sorts scored rows by score and keeps unscored rows after them", () => {
    const sorted = sortRowsByScore(rows);
    expect(sorted.map((r) => r.target.input)).toEqual(["mine.com", "one.com", "two.com"]);
    expect(rows[0].target.input).toBe("one.com");
  });

  it("builds a redacted plain-text report with no grade for failed scans", () => {
    const text = buildCompareReport(rows, true, new Date("2026-11-01T09:00:00Z"));
    expect(text).toContain("Site 01: F (40/100), 1 pass, 1 partial, 1 fail, server software disclosed");
    expect(text).toContain("Site 02: not scanned (unreachable)");
    expect(text).toContain("mine.com: A (90/100)");
    expect(text).not.toContain("one.com");
  });
});
