"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type {
  EmailAnalysisResponse,
  ThreatLevel,
  SuspiciousElement,
} from "@/types/email-analyzer";
import { EmailAnalyzerSkeleton } from "@/components/ui/SkeletonLoader";
import { ReportSnapshotCapture } from "./ReportAttachments";

const LOADING_PHASES = [
  "Scanning email content...",
  "Analyzing threat indicators...",
  "Generating security report...",
  "Almost done...",
];

const SCORE_RANGES = [
  {
    range: "0–15",
    label: "Safe",
    description: "No significant phishing indicators found.",
    min: 0,
    max: 15,
  },
  {
    range: "16–35",
    label: "Low",
    description: "Minor suspicious elements, likely legitimate.",
    min: 16,
    max: 35,
  },
  {
    range: "36–60",
    label: "Medium",
    description: "Some phishing indicators present. Exercise caution.",
    min: 36,
    max: 60,
  },
  {
    range: "61–85",
    label: "High",
    description: "Strong phishing indicators. Do not interact with this email.",
    min: 61,
    max: 85,
  },
  {
    range: "86–100",
    label: "Critical",
    description: "This is almost certainly a phishing attempt or scam.",
    min: 86,
    max: 100,
  },
];

// ── Colors ──

function threatColor(level: ThreatLevel): string {
  switch (level) {
    case "safe":
      return "var(--success)";
    case "low":
      return "var(--success)";
    case "medium":
      return "var(--warning)";
    case "high":
      return "var(--warning)";
    case "critical":
      return "var(--danger)";
  }
}

function threatBadgeClasses(level: ThreatLevel): string {
  switch (level) {
    case "safe":
      return "bg-success/10 text-success";
    case "low":
      return "bg-success/10 text-success";
    case "medium":
      return "bg-warning/10 text-warning";
    case "high":
      return "bg-warning/10 text-warning";
    case "critical":
      return "bg-danger/10 text-danger";
  }
}

// ── Score Circle ──

function ThreatScoreCircle({
  score,
  level,
}: {
  score: number;
  level: ThreatLevel;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = threatColor(level);

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
            {score}
          </span>
          <span className="text-xs text-text-muted">/ 100</span>
        </div>
      </div>
      <span
        className={`rounded px-3 py-1 text-xs font-medium capitalize ${threatBadgeClasses(level)}`}
      >
        {level}
      </span>
    </div>
  );
}

// ── Category Card ──

function CategoryCard({
  name,
  score,
  level,
  findings,
  explanation,
}: {
  name: string;
  score: number;
  level: ThreatLevel;
  findings: string[];
  explanation: string;
}) {
  const color = threatColor(level);

  return (
    <div className="min-w-0 border border-border-subtle bg-bg-card p-5 [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-sans text-sm font-semibold text-text-primary">
          {name}
        </h3>
        <span
          className={`rounded px-2.5 py-0.5 text-xs font-medium capitalize ${threatBadgeClasses(level)}`}
        >
          {level}
        </span>
      </div>
      {/* Score bar */}
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-3">
        <div
          className="h-full rounded-full"
          style={{ backgroundColor: color, width: `${score}%` }}
        />
      </div>
      <p className="font-mono text-xs text-text-muted mb-2">{score}/100</p>
      {/* Findings */}
      <ul className="space-y-1 mb-3">
        {findings.map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-text-secondary"
          >
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted leading-relaxed">{explanation}</p>
    </div>
  );
}

// ── Suspicious Element Type Icons ──

const elementTypeLabels: Record<SuspiciousElement["type"], string> = {
  link: "Link",
  sender: "Sender",
  attachment: "Attachment",
  language: "Language",
  impersonation: "Impersonation",
  other: "Other",
};

const elementTypeBorders: Record<SuspiciousElement["type"], string> = {
  link: "border-danger/40",
  sender: "border-warning/40",
  attachment: "border-danger/40",
  language: "border-warning/40",
  impersonation: "border-warning/40",
  other: "border-info/40",
};

function ElementTypeIcon({ type }: { type: SuspiciousElement["type"] }) {
  const props = {
    className: "w-4 h-4 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "link":
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "sender":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
        </svg>
      );
    case "attachment":
      return (
        <svg {...props}>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );
    case "language":
      return (
        <svg {...props}>
          <path d="M4 7h6M7 4v6M10 21l4-9 4 9M12.5 17h5" />
        </svg>
      );
    case "impersonation":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "other":
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

// ── Main Component ──

export function EmailAnalyzer() {
  const [emailContent, setEmailContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailAnalysisResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailContent.trim() || loading) return;

    setError(null);
    setResult(null);
    setLoadingPhase(0);
    setLoading(true);

    try {
      const res = await fetch("/api/analyze-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent: emailContent.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(data as EmailAnalysisResponse);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setEmailContent("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const lines = [
      "Nest Cipher AI Email Analysis Report",
      `Threat Score: ${result.overallScore}/100 (${result.overallLevel})`,
      `Verdict: ${result.verdict}`,
      "",
      "Category Breakdown:",
      ...result.categories.map(
        (c) => `  ${c.name}: ${c.score}/100 (${c.level})`,
      ),
      "",
      "Recommendations:",
      ...result.recommendations.map((r, i) => `  ${i + 1}. ${r}`),
      "",
      "Analyzed by nestcipher.com",
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingPhase((prev) => Math.min(prev + 1, LOADING_PHASES.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="site-container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Email Analyzer</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow">01 / Threat analysis</p>
        <h1 className="page-title">AI Email Analyzer</h1>
        <p className="page-description">
          Examine a suspicious email for phishing indicators, social engineering
          tactics, and other threats.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section
          className="tool-workspace"
          aria-labelledby="email-input-heading"
        >
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-5">
            <h2
              id="email-input-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Inspect an email
            </h2>
            <span className="font-mono text-xs text-text-muted">
              AI ANALYSIS / 6 CATEGORIES
            </span>
          </div>
          <form onSubmit={handleAnalyze} aria-busy={loading}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="email-content"
                className="font-mono text-xs text-text-secondary"
              >
                EMAIL CONTENT
              </label>
              <span
                id="email-length"
                className="font-mono text-xs text-text-muted"
              >
                {emailContent.length.toLocaleString()} / 15,000
              </span>
            </div>
            <textarea
              id="email-content"
              ref={textareaRef}
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              maxLength={15000}
              aria-describedby="email-input-help email-data-flow email-length"
              placeholder="Paste the email headers, links, and body text here..."
              disabled={loading}
              className="min-h-[260px] w-full resize-y border border-border-hover bg-bg-primary px-4 py-4 font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
            <p
              id="email-input-help"
              className="mt-3 text-xs leading-relaxed text-text-muted"
            >
              Include the full email content for the most useful assessment.
            </p>
            <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading || !emailContent.trim()}
                className="button-primary whitespace-nowrap"
              >
                {loading ? "Analyzing..." : "Analyze Email"}
                <span aria-hidden="true">↗</span>
              </button>
              <p
                id="email-data-flow"
                className="max-w-md text-xs leading-relaxed text-text-muted"
              >
                Sent to OpenAI for analysis. NestCipher stores nothing.{" "}
                <a
                  href="https://openai.com/policies/api-data-usage-policies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-accent"
                >
                  OpenAI&apos;s API data policy
                </a>{" "}
                applies. See our{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-accent"
                >
                  privacy page
                </Link>
                .
              </p>
            </div>
          </form>
          {loading && (
            <p
              role="status"
              className="mt-5 font-mono text-xs text-text-secondary"
            >
              {LOADING_PHASES[loadingPhase]}
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
        </section>
        <aside className="border border-border-subtle bg-bg-card p-6">
          <p className="eyebrow">Before you analyze</p>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-text-secondary">
            <p>
              Keep suspicious links as text. You do not need to open them to run
              this analysis.
            </p>
            <p>
              Remove personal or sensitive information you do not want sent to
              the analysis provider.
            </p>
          </div>
          <div className="mt-6 border-t border-border-subtle pt-5">
            <p className="font-mono text-xs text-text-muted">REPORT OUTPUT</p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              A threat assessment, category breakdown, suspicious elements, and
              recommended next steps.
            </p>
          </div>
        </aside>
      </div>
      {loading && <EmailAnalyzerSkeleton />}
      {!loading && !result && !error && (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle pt-5 font-mono text-xs text-text-muted">
          <span>READY TO ANALYZE</span>
          <span>PHISHING / IMPERSONATION / SUSPICIOUS LINKS</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div
          key={result.analysedAt}
          role="region"
          aria-label="Email analysis report"
          className="mt-12 min-w-0 [overflow-wrap:anywhere]"
        >
          <div className="mb-6">
            <p className="eyebrow">Analysis complete</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Threat report
            </h2>
            <p role="status" className="sr-only">
              Analysis complete. Threat score {result.overallScore} of 100.{" "}
              {result.overallLevel} risk.
            </p>
          </div>
          {/* Threat Score */}
          <div className="tool-workspace flex flex-col items-center text-center">
            <ThreatScoreCircle
              score={result.overallScore}
              level={result.overallLevel}
            />
            <div
              className="mt-4 max-w-xl mx-auto border-l-2 pl-4 text-left"
              style={{ borderColor: threatColor(result.overallLevel) }}
            >
              <p className="text-lg font-medium text-text-primary">
                {result.verdict}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {result.summary}
              </p>
            </div>

            {/* Score explainer */}
            <div className="mt-4 w-full max-w-xl">
              <button
                type="button"
                onClick={() => setScoreExplainerOpen((prev) => !prev)}
                aria-expanded={scoreExplainerOpen}
                aria-controls={
                  scoreExplainerOpen ? "email-score-ranges" : undefined
                }
                className="flex min-h-[44px] items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mx-auto"
              >
                What does this score mean?
                <svg
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 ${scoreExplainerOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {scoreExplainerOpen && (
                <div id="email-score-ranges" className="overflow-hidden">
                  <div className="mt-3 bg-bg-elevated p-4 space-y-2">
                    {SCORE_RANGES.map((r) => {
                      const isActive =
                        result.overallScore >= r.min &&
                        result.overallScore <= r.max;
                      return (
                        <div
                          key={r.range}
                          className={`grid grid-cols-[42px_62px_minmax(0,1fr)] items-baseline gap-3 text-sm rounded px-2 py-1 ${
                            isActive
                              ? "bg-accent/10 text-text-primary"
                              : "text-text-muted"
                          }`}
                        >
                          <span className="font-mono text-xs shrink-0">
                            {r.range}
                          </span>
                          <span className="font-medium shrink-0">
                            {r.label}
                          </span>
                          <span className="text-xs text-left">
                            {r.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mt-12">
            <h2 className="font-sans text-xl font-bold mb-6">
              Threat Analysis
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.categories.map((cat) => (
                <CategoryCard key={cat.name} {...cat} />
              ))}
            </div>
          </div>

          {/* Suspicious Elements */}
          <div className="mt-12">
            <h2 className="font-sans text-xl font-bold mb-6">
              {result.suspiciousElements.length > 0
                ? "Red Flags Found"
                : "No Red Flags Found"}
            </h2>
            {result.suspiciousElements.length > 0 ? (
              <div className="space-y-3">
                {result.suspiciousElements.map((el, i) => (
                  <div
                    key={i}
                    className={`border-l-2 ${elementTypeBorders[el.type]} bg-bg-card p-4`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-muted">
                        <ElementTypeIcon type={el.type} />
                        {elementTypeLabels[el.type]}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-text-primary break-all">
                      {el.value}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {el.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-success">
                No suspicious elements were identified in this email.
              </p>
            )}
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mt-12">
              <h2 className="font-sans text-xl font-bold mb-6">
                What You Should Do
              </h2>
              <ol className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <span className="font-mono text-accent text-xs mt-0.5 shrink-0 w-4">
                      {i + 1}.
                    </span>
                    <span className="min-w-0">{rec}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <ReportSnapshotCapture kind="email-analysis" report={result} />
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="button-secondary"
            >
              Analyze Another
            </button>
            <button
              type="button"
              onClick={handleCopyReport}
              className="button-secondary"
            >
              {copied ? "Copied!" : "Copy Report"}
            </button>
          </div>
          <span className="sr-only" role="status">
            {copied ? "Report copied to clipboard." : ""}
          </span>
        </div>
      )}
    </div>
  );
}
