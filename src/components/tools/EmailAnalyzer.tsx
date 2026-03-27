"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { EmailAnalysisResponse, ThreatLevel, SuspiciousElement } from "@/types/email-analyzer";

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

// ── Main Component ──

export function EmailAnalyzer() {
  const [emailContent, setEmailContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailAnalysisResponse | null>(null);
  const [copied, setCopied] = useState(false);
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
          {loading ? <span className="animate-pulse">Analyzing...</span> : "Analyze Email"}
        </button>
      </form>

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
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-6 animate-pulse">
          <div className="w-44 h-44 rounded-full bg-bg-elevated" />
          <div className="w-48 h-4 rounded bg-bg-elevated" />
          <div className="w-full grid gap-4 sm:grid-cols-2 mt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-bg-elevated" />
            ))}
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
            <p className="mt-4 text-lg font-medium text-text-primary">{result.verdict}</p>
            <p className="mt-2 text-sm text-text-secondary max-w-xl">{result.summary}</p>
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
                      <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-muted">
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
