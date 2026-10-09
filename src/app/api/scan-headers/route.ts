import { NextRequest, NextResponse } from "next/server";
import { fetchHeadersSafely } from "@/lib/safe-fetch";
import type {
  ScanResponse,
  HeaderResult,
  GradeLevel,
  HeaderStatus,
} from "@/types/headers-scanner";

// SSRF protection lives in src/lib/ssrf-guard.ts and src/lib/safe-fetch.ts:
// WHATWG parsing, default ports only, unicast-only DNS classification, and a
// connect-time pinned lookup that defeats rebinding. See docs/THREAT-MODEL.md.

// ── Header Scoring ──

interface HeaderCheck {
  name: string;
  maxScore: number;
  description: string;
  recommendation: string;
  evaluate: (value: string | null) => { score: number; status: HeaderStatus };
}

const HEADER_CHECKS: HeaderCheck[] = [
  {
    name: "Strict-Transport-Security",
    maxScore: 20,
    description:
      "Forces browsers to use HTTPS, preventing man-in-the-middle attacks.",
    recommendation:
      "Add the header: Strict-Transport-Security: max-age=31536000; includeSubDomains",
    evaluate(value) {
      if (!value) return { score: 0, status: "fail" };
      const maxAgeMatch = value.match(/max-age=(\d+)/i);
      if (!maxAgeMatch) return { score: 5, status: "partial" };
      const maxAge = parseInt(maxAgeMatch[1], 10);
      let score = maxAge >= 31536000 ? 15 : 10;
      if (/includeSubDomains/i.test(value)) score += 5;
      return { score, status: score >= 15 ? "pass" : "partial" };
    },
  },
  {
    name: "Content-Security-Policy",
    maxScore: 20,
    description:
      "Controls which resources the browser is allowed to load, preventing XSS and injection attacks.",
    recommendation:
      "Add a Content-Security-Policy header. Start with a report-only policy to avoid breaking your site.",
    evaluate(value) {
      if (!value) return { score: 0, status: "fail" };
      const stripped = value.replace(/\s/g, "").toLowerCase();
      if (stripped === "upgrade-insecure-requests") {
        return { score: 10, status: "partial" };
      }
      return { score: 20, status: "pass" };
    },
  },
  {
    name: "X-Content-Type-Options",
    maxScore: 10,
    description:
      "Prevents browsers from MIME-sniffing a response away from the declared content-type, reducing drive-by download attacks.",
    recommendation: "Add the header: X-Content-Type-Options: nosniff",
    evaluate(value) {
      if (value?.toLowerCase() === "nosniff") {
        return { score: 10, status: "pass" };
      }
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "X-Frame-Options",
    maxScore: 10,
    description:
      "Prevents your page from being embedded in iframes, protecting against clickjacking attacks.",
    recommendation:
      "Add the header: X-Frame-Options: DENY (or SAMEORIGIN if you need to iframe your own pages).",
    evaluate(value) {
      if (!value) return { score: 0, status: "fail" };
      const upper = value.toUpperCase();
      if (upper === "DENY" || upper === "SAMEORIGIN") {
        return { score: 10, status: "pass" };
      }
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "Referrer-Policy",
    maxScore: 10,
    description:
      "Controls how much referrer information is sent with requests, reducing information leakage to third parties.",
    recommendation:
      "Add the header: Referrer-Policy: strict-origin-when-cross-origin",
    evaluate(value) {
      if (!value) return { score: 0, status: "fail" };
      const valid = [
        "no-referrer",
        "no-referrer-when-downgrade",
        "origin",
        "origin-when-cross-origin",
        "same-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
      ];
      if (valid.includes(value.toLowerCase().trim())) {
        return { score: 10, status: "pass" };
      }
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "Permissions-Policy",
    maxScore: 10,
    description:
      "Controls which browser features and APIs can be used, limiting the attack surface of your application.",
    recommendation:
      "Add a Permissions-Policy header to restrict access to sensitive browser APIs like camera, microphone, and geolocation.",
    evaluate(value) {
      if (value) return { score: 10, status: "pass" };
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "X-XSS-Protection",
    maxScore: 5,
    description:
      'Legacy XSS filter. Modern best practice is to set it to "0" and rely on CSP instead, as the filter itself can introduce vulnerabilities.',
    recommendation:
      "Set X-XSS-Protection: 0 and rely on a strong Content-Security-Policy instead.",
    evaluate(value) {
      if (!value) return { score: 0, status: "fail" };
      const trimmed = value.trim();
      if (trimmed === "0") return { score: 5, status: "pass" };
      if (trimmed.startsWith("1") && trimmed.includes("mode=block")) {
        return { score: 3, status: "partial" };
      }
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "Cross-Origin-Opener-Policy",
    maxScore: 5,
    description:
      "Isolates your browsing context from cross-origin windows, preventing Spectre-style side-channel attacks.",
    recommendation: "Add the header: Cross-Origin-Opener-Policy: same-origin",
    evaluate(value) {
      if (value) return { score: 5, status: "pass" };
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "Cross-Origin-Resource-Policy",
    maxScore: 5,
    description:
      "Controls which origins can read your resources, preventing cross-origin data leaks.",
    recommendation:
      "Add the header: Cross-Origin-Resource-Policy: same-origin (or same-site if needed).",
    evaluate(value) {
      if (value) return { score: 5, status: "pass" };
      return { score: 0, status: "fail" };
    },
  },
  {
    name: "Cross-Origin-Embedder-Policy",
    maxScore: 5,
    description:
      "Ensures your document only loads cross-origin resources that explicitly grant permission, enabling cross-origin isolation.",
    recommendation:
      "Add the header: Cross-Origin-Embedder-Policy: require-corp",
    evaluate(value) {
      if (value) return { score: 5, status: "pass" };
      return { score: 0, status: "fail" };
    },
  },
];

function calculateGrade(score: number): GradeLevel {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const v = headers[name.toLowerCase()];
  if (v === undefined) return null;
  return Array.isArray(v) ? v.join(", ") : v;
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await fetchHeadersSafely(body.url ?? "");

  if (!result.ok) {
    // Fail closed: a refusal or failure is an error, never a grade.
    const status = result.kind === "blocked" ? 400 : 502;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const headerResults: HeaderResult[] = HEADER_CHECKS.map((check) => {
    const value = headerValue(result.headers, check.name);
    const { score, status } = check.evaluate(value);
    return {
      name: check.name,
      present: value !== null,
      value,
      score,
      maxScore: check.maxScore,
      status,
      description: check.description,
      recommendation: status === "pass" ? null : check.recommendation,
    };
  });

  const totalScore = headerResults.reduce((sum, h) => sum + h.score, 0);

  const payload: ScanResponse = {
    url: result.finalUrl,
    grade: calculateGrade(totalScore),
    score: totalScore,
    maxScore: 100,
    scannedAt: new Date().toISOString(),
    headers: headerResults,
    serverInfo: {
      ip: null,
      server: headerValue(result.headers, "server"),
      poweredBy: headerValue(result.headers, "x-powered-by"),
    },
  };

  return NextResponse.json(payload);
}
