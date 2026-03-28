"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { EmailAnalysisResponse, ThreatLevel, SuspiciousElement } from "@/types/email-analyzer";
import { EmailAnalyzerSkeleton } from "@/components/ui/SkeletonLoader";

const LOADING_PHASES = [
  "Scanning email content...",
  "Analyzing threat indicators...",
  "Generating security report...",
  "Almost done...",
];

const SCORE_RANGES = [
  { range: "0–15", label: "Safe", description: "No significant phishing indicators found.", min: 0, max: 15 },
  { range: "16–35", label: "Low", description: "Minor suspicious elements, likely legitimate.", min: 16, max: 35 },
  { range: "36–60", label: "Medium", description: "Some phishing indicators present. Exercise caution.", min: 36, max: 60 },
  { range: "61–85", label: "High", description: "Strong phishing indicators. Do not interact with this email.", min: 61, max: 85 },
  { range: "86–100", label: "Critical", description: "This is almost certainly a phishing attempt or scam.", min: 86, max: 100 },
];

// ── Colors ──

function threatColor(level: ThreatLevel): string {
  switch (level) {
    case "safe": return "#00D4AA";
    case "low": return "#22C55E";
    case "medium": return "#F59E0B";
    case "high": return "#F97316";
    case "critical": return "#EF4444";
  }
}

function threatBadgeClasses(level: ThreatLevel): string {
  switch (level) {
    case "safe": return "bg-[#00D4AA]/10 text-[#00D4AA]";
    case "low": return "bg-[#22C55E]/10 text-[#22C55E]";
    case "medium": return "bg-[#F59E0B]/10 text-[#F59E0B]";
    case "high": return "bg-[#F97316]/10 text-[#F97316]";
    case "critical": return "bg-[#EF4444]/10 text-[#EF4444]";
  }
}

// ── Score Circle ──

function ThreatScoreCircle({ score, level }: { score: number; level: ThreatLevel }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = threatColor(level);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
          <motion.circle
            cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - percentage) }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-mono text-4xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-text-muted">/ 100</span>
        </motion.div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${threatBadgeClasses(level)}`}>
        {level}
      </span>
    </div>
  );
}

// ── Category Card ──

function CategoryCard({ name, score, level, findings, explanation, index }: {
  name: string; score: number; level: ThreatLevel; findings: string[]; explanation: string; index: number;
}) {
  const color = threatColor(level);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl border border-border-subtle bg-bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-sm font-semibold text-text-primary">{name}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${threatBadgeClasses(level)}`}>
          {level}
        </span>
      </div>
      {/* Score bar */}
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.05 }}
        />
      </div>
      <p className="font-mono text-xs text-text-muted mb-2">{score}/100</p>
      {/* Findings */}
      <ul className="space-y-1 mb-3">
        {findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted leading-relaxed">{explanation}</p>
    </motion.div>
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
  link: "border-[#EF4444]/40",
  sender: "border-[#F97316]/40",
  attachment: "border-[#EF4444]/40",
  language: "border-[#F59E0B]/40",
  impersonation: "border-[#F97316]/40",
  other: "border-[#3B82F6]/40",
};

function ElementTypeIcon({ type }: { type: SuspiciousElement["type"] }) {
  const props = { className: "w-4 h-4 shrink-0", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "link":
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
    case "sender":
      return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></svg>;
    case "attachment":
      return <svg {...props}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
    case "language":
      return <svg {...props}><path d="M4 7h6M7 4v6M10 21l4-9 4 9M12.5 17h5" /></svg>;
    case "impersonation":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "other":
      return <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      ...result.categories.map((c) => `  ${c.name}: ${c.score}/100 (${c.level})`),
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
    if (!loading) {
      setLoadingPhase(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingPhase((prev) => Math.min(prev + 1, LOADING_PHASES.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/tools" className="hover:text-accent transition-colors">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Email Analyzer</span>
      </nav>

      {/* Title */}
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">AI Email Analyzer</h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Paste a suspicious email below. Our AI will analyze it for phishing indicators,
        social engineering tactics, and other threats.
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Your email content is analyzed securely and never stored.
      </p>

      {/* Input */}
      <form onSubmit={handleAnalyze} className="mt-8">
        <textarea
          ref={textareaRef}
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          placeholder="Paste the full email content here — including headers, links, and body text for the most accurate analysis..."
          disabled={loading}
          className="w-full min-h-[200px] resize-y rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
            placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
            transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          <p className="text-xs text-text-muted">
            Privacy: Your email is sent to our secure API for analysis and is never stored, logged, or shared.
          </p>
          <span className="text-xs text-text-muted shrink-0 ml-4">
            {emailContent.length.toLocaleString()} / 15,000
          </span>
        </div>
        <button
          type="submit"
          disabled={loading || !emailContent.trim()}
          className="w-full sm:w-auto rounded-lg bg-accent px-8 py-3 text-sm font-medium text-bg-primary
            hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Analyzing...
            </motion.span>
          ) : "Analyze Email"}
        </button>
      </form>

      {/* Loading phase text */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.p
            key={loadingPhase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 text-sm text-accent"
          >
            {LOADING_PHASES[loadingPhase]}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 text-sm text-[#EF4444]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && <EmailAnalyzerSkeleton />}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <p className="text-sm text-text-muted">Paste an email above to get started</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              6 threat categories
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
              AI-powered analysis
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Instant results
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          key={result.analysedAt}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-12"
        >
          {/* Threat Score */}
          <div className="flex flex-col items-center text-center">
            <ThreatScoreCircle score={result.overallScore} level={result.overallLevel} />
            <div
              className="mt-4 max-w-xl mx-auto border-l-2 pl-4 text-left"
              style={{ borderColor: threatColor(result.overallLevel) }}
            >
              <p className="text-lg font-medium text-text-primary">{result.verdict}</p>
              <p className="mt-1 text-sm text-text-secondary">{result.summary}</p>
            </div>

            {/* Score explainer */}
            <div className="mt-4 w-full max-w-xl">
              <button
                type="button"
                onClick={() => setScoreExplainerOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors mx-auto"
              >
                What does this score mean?
                <motion.svg
                  animate={{ rotate: scoreExplainerOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </motion.svg>
              </button>
              <AnimatePresence>
                {scoreExplainerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 bg-bg-elevated rounded-lg p-4 space-y-2">
                      {SCORE_RANGES.map((r) => {
                        const isActive = result.overallScore >= r.min && result.overallScore <= r.max;
                        return (
                          <div
                            key={r.range}
                            className={`flex items-baseline justify-between gap-4 text-sm rounded px-2 py-1 ${
                              isActive ? "bg-accent/10 text-text-primary" : "text-text-muted"
                            }`}
                          >
                            <span className="font-mono text-xs shrink-0">{r.range}</span>
                            <span className="font-medium shrink-0">{r.label}</span>
                            <span className="text-xs text-right">{r.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">Threat Analysis</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.categories.map((cat, i) => (
                <CategoryCard key={cat.name} {...cat} index={i} />
              ))}
            </div>
          </div>

          {/* Suspicious Elements */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">
              {result.suspiciousElements.length > 0 ? "Red Flags Found" : "No Red Flags Found"}
            </h2>
            {result.suspiciousElements.length > 0 ? (
              <div className="space-y-3">
                {result.suspiciousElements.map((el, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className={`rounded-xl border-l-2 ${elementTypeBorders[el.type]} bg-bg-card p-4`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-muted">
                        <ElementTypeIcon type={el.type} />
                        {elementTypeLabels[el.type]}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-text-primary break-all">{el.value}</p>
                    <p className="mt-1 text-sm text-text-secondary">{el.reason}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#00D4AA]">
                No suspicious elements were identified in this email.
              </p>
            )}
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">What You Should Do</h2>
              <ol className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="font-mono text-accent text-xs mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary
                hover:border-accent hover:text-accent transition-colors"
            >
              Analyze Another
            </button>
            <button
              type="button"
              onClick={handleCopyReport}
              className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary
                hover:border-accent hover:text-accent transition-colors"
            >
              {copied ? "Copied!" : "Copy Report"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
