import { NextRequest, NextResponse } from "next/server";
import type {
  ScanResponse,
  HeaderResult,
  GradeLevel,
  HeaderStatus,
} from "@/types/headers-scanner";

// ── SSRF Protection ──

function isPrivateIP(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  ) {
    return true;
  }

  // Check IPv4 private ranges
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true; // 127.x.x.x
    if (a === 10) return true; // 10.x.x.x
    if (a === 192 && b === 168) return true; // 192.168.x.x
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16-31.x.x
    if (a === 0) return true; // 0.x.x.x
    if (a === 169 && b === 254) return true; // 169.254.x.x (link-local)
  }

  return false;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function validateUrl(input: string): { valid: boolean; url?: string; error?: string } {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Please enter a valid URL (e.g. google.com or https://example.com)" };
  }

  if (input.length > 2048) {
    return { valid: false, error: "URL is too long (max 2048 characters)." };
  }

  const normalized = normalizeUrl(input);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: "Please enter a valid URL (e.g. google.com or https://example.com)" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are supported." };
  }

  if (isPrivateIP(parsed.hostname)) {
    return { valid: false, error: "Scanning internal or private addresses is not allowed." };
  }

  return { valid: true, url: normalized };
}

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
    recommendation: 'Add the header: X-Content-Type-Options: nosniff',
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
      'Add the header: Referrer-Policy: strict-origin-when-cross-origin',
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
      "Legacy XSS filter. Modern best practice is to set it to \"0\" and rely on CSP instead, as the filter itself can introduce vulnerabilities.",
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

// ── Route Handler ──

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const validation = validateUrl(body.url ?? "");
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const targetUrl = validation.url!;

  // Fetch headers with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "NestCipher-Scanner/1.0",
      },
      redirect: "follow",
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const error = err as Error;
    if (error.name === "AbortError") {
      return NextResponse.json(
        {
          error:
            "The website took too long to respond. It may be down or blocking automated requests.",
        },
        { status: 502 }
      );
    }
    if (
      error.message?.includes("getaddrinfo") ||
      error.message?.includes("ENOTFOUND")
    ) {
      return NextResponse.json(
        {
          error:
            "Could not resolve the domain. Please check the URL and try again.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  // Score headers
  const responseHeaders = response.headers;
  const headerResults: HeaderResult[] = HEADER_CHECKS.map((check) => {
    const value = responseHeaders.get(check.name);
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
  const maxScore = 100;

  const result: ScanResponse = {
    url: targetUrl,
    grade: calculateGrade(totalScore),
    score: totalScore,
    maxScore,
    scannedAt: new Date().toISOString(),
    headers: headerResults,
    serverInfo: {
      ip: null,
      server: responseHeaders.get("server"),
      poweredBy: responseHeaders.get("x-powered-by"),
    },
  };

  return NextResponse.json(result);
}
