"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useToolDraft } from "@/components/layout/ToolDraftProvider";
import type {
  ScanResponse,
  HeaderResult,
  GradeLevel,
} from "@/types/headers-scanner";
import { HeadersScannerSkeleton } from "@/components/ui/SkeletonLoader";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ReportSnapshotCapture } from "./ReportAttachments";

// ── Data maps ──

const HEADER_EXPLAINERS: Record<string, string> = {
  "Strict-Transport-Security":
    "Forces your browser to always use a secure HTTPS connection.",
  "Content-Security-Policy":
    "Controls what scripts and resources a website is allowed to load.",
  "X-Content-Type-Options":
    "Stops browsers from guessing file types, which can be exploited.",
  "X-Frame-Options":
    "Prevents other websites from embedding this site in a hidden frame.",
  "Referrer-Policy":
    "Controls how much information your browser shares when you click a link.",
  "Permissions-Policy":
    "Limits which device features (camera, mic, location) a site can access.",
  "X-XSS-Protection":
    "Legacy protection against script injection — modern sites use CSP instead.",
  "Cross-Origin-Opener-Policy":
    "Isolates this site's window from other sites for extra security.",
  "Cross-Origin-Resource-Policy":
    "Controls whether other websites can load this site's files.",
  "Cross-Origin-Embedder-Policy":
    "Ensures all loaded resources have explicitly granted permission.",
};

const GRADE_EXPLANATIONS: Record<GradeLevel, string> = {
  "A+": "Excellent. This site implements all recommended security headers.",
  A: "Strong security posture with minor improvements possible.",
  B: "Good foundation, but several important headers are missing.",
  C: "Moderate risk. Multiple security headers need attention.",
  D: "Weak security. Most recommended headers are not configured.",
  F: "Critical gaps. This site is missing essential security protections.",
};

// ── Grade colors ──

function gradeColor(grade: GradeLevel): string {
  switch (grade) {
    case "A+":
    case "A":
      return "var(--success)";
    case "B":
      return "var(--info)";
    case "C":
      return "var(--warning)";
    case "D":
      return "var(--warning)";
    case "F":
      return "var(--danger)";
  }
}

// ── Grade Circle ──

function GradeCircle({
  grade,
  score,
  maxScore,
}: {
  grade: GradeLevel;
  score: number;
  maxScore: number;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / maxScore;
  const color = gradeColor(grade);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="8"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percentage)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-bold" style={{ color }}>
            {grade}
          </span>
        </div>
      </div>
      <p className="font-mono text-lg text-text-secondary">
        {score} / {maxScore}
      </p>
      <p className="mt-2 text-sm text-text-muted text-center max-w-xs">
        {GRADE_EXPLANATIONS[grade]}
      </p>
    </div>
  );
}

// ── Result Summary ──

function ResultSummary({ headers }: { headers: HeaderResult[] }) {
  const passed = headers.filter((h) => h.status === "pass").length;
  const failed = headers.filter((h) => h.status === "fail").length;
  const partial = headers.filter((h) => h.status === "partial").length;

  return (
    <div className="flex items-center justify-center gap-4 text-sm text-text-muted font-mono flex-wrap">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-success" />
        {passed} passed
      </span>
      <span aria-hidden="true" className="text-border-hover">
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-danger" />
        {failed} failed
      </span>
      <span aria-hidden="true" className="text-border-hover">
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-warning" />
        {partial} partial
      </span>
    </div>
  );
}

// ── Status Icons ──

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-success"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-5 h-5 text-danger"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="w-5 h-5 text-warning"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function StatusIcon({ status }: { status: HeaderResult["status"] }) {
  switch (status) {
    case "pass":
      return <CheckIcon />;
    case "fail":
      return <XIcon />;
    case "partial":
      return <WarningIcon />;
  }
}

// ── Header Card ──

function HeaderCard({ header }: { header: HeaderResult }) {
  const [expanded, setExpanded] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isLongValue = header.value && header.value.length > 80;
  const explainer = HEADER_EXPLAINERS[header.name];

  const scorePillColor =
    header.status === "pass"
      ? "text-success bg-success/10"
      : header.status === "partial"
        ? "text-warning bg-warning/10"
        : "text-danger bg-danger/10";

  const recommendationBorder =
    header.status === "partial" ? "border-warning/40" : "border-danger/40";

  return (
    <div className="border border-border-subtle bg-bg-card p-5 hover:border-border-hover transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={header.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <h3 className="font-sans text-sm font-semibold text-text-primary">
                {header.name}
              </h3>
              {explainer && (
                <InfoTooltip
                  label={`About ${header.name}`}
                  text={explainer}
                  isOpen={tooltipOpen}
                  onToggle={() => setTooltipOpen((prev) => !prev)}
                />
              )}
            </div>
            <span
              className={`rounded px-2.5 py-0.5 text-xs font-medium ${scorePillColor}`}
            >
              {header.score}/{header.maxScore}
            </span>
          </div>

          {header.present && header.value && (
            <div className="mt-2">
              <button
                type="button"
                disabled={!isLongValue}
                aria-expanded={isLongValue ? expanded : undefined}
                aria-label={
                  isLongValue
                    ? `${expanded ? "Collapse" : "Expand"} ${header.name} value`
                    : undefined
                }
                onClick={() => isLongValue && setExpanded(!expanded)}
                className={`text-left font-mono text-xs text-text-muted bg-bg-elevated rounded px-2 py-1 break-all ${
                  isLongValue ? "cursor-pointer hover:text-text-secondary" : ""
                }`}
              >
                {isLongValue && !expanded
                  ? `${header.value.slice(0, 80)}...`
                  : header.value}
              </button>
            </div>
          )}

          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            {header.description}
          </p>

          {header.recommendation && (
            <div className={`mt-3 border-l-2 ${recommendationBorder} pl-3`}>
              <p className="text-sm text-text-secondary leading-relaxed">
                {header.recommendation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export function HeadersScanner() {
  const { scannerDraft } = useToolDraft();
  const [url, setUrl] = useState(() => scannerDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/scan-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(data as ScanResponse);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setUrl("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCopyResults = async () => {
    if (!result) return;
    const lines = [
      `nestcipher.com Security Headers Report`,
      `URL: ${result.url}`,
      `Grade: ${result.grade} (${result.score}/${result.maxScore})`,
      `Scanned: ${new Date(result.scannedAt).toLocaleString()}`,
      `---`,
      ...result.headers.map(
        (h) =>
          `${h.status === "pass" ? "✓" : h.status === "partial" ? "~" : "✗"} ${h.name}: ${h.score}/${h.maxScore}`,
      ),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
  };

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  return (
    <div className="site-container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Headers Scanner</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow">02 / Web security</p>
        <h1 className="page-title">Security Headers Scanner</h1>
        <p className="page-description">
          Inspect a website’s HTTP security headers. See what is configured,
          what is missing, and where to improve.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section
          className="tool-workspace"
          aria-labelledby="scanner-input-heading"
        >
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-5">
            <h2
              id="scanner-input-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Scan a website
            </h2>
            <span className="font-mono text-xs text-text-muted">
              HTTP RESPONSE / 10 CHECKS
            </span>
          </div>
          <form onSubmit={handleScan} aria-busy={loading}>
            <label
              htmlFor="scan-url"
              className="mb-3 block font-mono text-xs text-text-secondary"
            >
              TARGET URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="scan-url"
                ref={inputRef}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={2048}
                aria-describedby="scanner-data-flow"
                placeholder="example.com or https://example.com"
                disabled={loading}
                className="min-w-0 flex-1 border border-border-hover bg-bg-primary px-4 py-3.5 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="button-primary whitespace-nowrap"
              >
                {loading ? "Scanning..." : "Scan headers"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <p
              id="scanner-data-flow"
              className="mt-4 text-xs leading-relaxed text-text-muted"
            >
              The URL you enter is fetched once from NestCipher&apos;s server.
              Nothing is stored.
            </p>
          </form>
          {loading && (
            <p
              role="status"
              className="mt-5 font-mono text-xs text-text-secondary break-all"
            >
              Fetching headers from {url.trim().replace(/^https?:\/\//, "")}...
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 border border-danger/20 bg-danger/5 p-4 text-sm text-danger"
            >
              {error}
            </p>
          )}
          {!loading && !result && !error && (
            <div className="mt-8 border-t border-border-subtle pt-6">
              <p className="font-mono text-xs text-text-muted">
                READY TO INSPECT
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                Your report will include a security grade, header values, and
                actionable recommendations.
              </p>
            </div>
          )}
        </section>
        <aside className="border border-border-subtle bg-bg-card p-6">
          <p className="eyebrow">Before you scan</p>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-text-secondary">
            <p>
              A public URL is enough. Include the path to inspect a specific
              page.
            </p>
            <p>
              The grade describes the response headers. It is a starting point
              for a review of the website’s security.
            </p>
          </div>
          <div className="mt-6 border-t border-border-subtle pt-5">
            <p className="font-mono text-xs text-text-muted">REPORT OUTPUT</p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Header-by-header findings, configuration advice, and a report you
              can copy.
            </p>
          </div>
        </aside>
      </div>

      {loading && <HeadersScannerSkeleton />}

      {result && !loading && (
        <section
          key={result.scannedAt}
          aria-labelledby="scan-report-heading"
          className="mt-12"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Scan complete</p>
              <h2
                id="scan-report-heading"
                className="mt-2 text-2xl font-semibold tracking-tight"
              >
                Header report
              </h2>
            </div>
            <p className="font-mono text-xs text-text-muted">
              {new Date(result.scannedAt).toLocaleString()}
            </p>
          </div>
          <p role="status" className="sr-only">
            Scan complete. Grade {result.grade}, score {result.score} of{" "}
            {result.maxScore}.
          </p>
          <div className="tool-workspace grid gap-8 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
            <GradeCircle
              grade={result.grade}
              score={result.score}
              maxScore={result.maxScore}
            />
            <div className="min-w-0">
              <p className="eyebrow">Inspected response</p>
              <p className="mt-4 break-all font-mono text-sm text-text-primary">
                {result.url}
              </p>
              <div className="mt-6 border-y border-border-subtle py-5">
                <ResultSummary headers={result.headers} />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-text-secondary">
                Review the individual findings below. A strong grade means the
                recommended headers are configured on this response.
              </p>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {result.headers.map((header) => (
              <HeaderCard key={header.name} header={header} />
            ))}
          </div>
          {(result.serverInfo.server || result.serverInfo.poweredBy) && (
            <div className="mt-6 border border-border-subtle bg-bg-card p-6">
              <h3 className="text-base font-semibold">Server information</h3>
              <dl className="mt-4 space-y-2 font-mono text-xs text-text-secondary">
                {result.serverInfo.server && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <dt className="text-text-muted">Server</dt>
                    <dd className="break-all">{result.serverInfo.server}</dd>
                  </div>
                )}
                {result.serverInfo.poweredBy && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <dt className="text-text-muted">X-Powered-By</dt>
                    <dd className="break-all">{result.serverInfo.poweredBy}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-text-muted">
                Consider removing server version headers to reduce information
                disclosure.
              </p>
            </div>
          )}
          <ReportSnapshotCapture kind="headers-scan" report={result} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCopyResults}
              className="button-primary disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy Results"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="button-secondary"
            >
              Scan Another
            </button>
          </div>
          <span className="sr-only" role="status">
            {copied ? "Report copied to clipboard." : ""}
          </span>
        </section>
      )}
    </div>
  );
}
