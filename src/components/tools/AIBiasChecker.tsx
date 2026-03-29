"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { BiasAnalysis, BiasLevel, BiasCategory, BiasCategoryAnalysis, BiasInstance } from "@/types/ai-bias-checker";
import { AIBiasCheckerSkeleton } from "@/components/ui/SkeletonLoader";

const LOADING_PHASES = [
  "Scanning for demographic patterns...",
  "Checking for stereotyping and assumptions...",
  "Analyzing representation and framing...",
  "Generating improvement suggestions...",
];

const SCORE_RANGES = [
  { range: "0–15", label: "Minimal", description: "No significant bias detected. Well-balanced text.", min: 0, max: 15 },
  { range: "16–35", label: "Low", description: "Minor bias patterns. Generally fair with room for improvement.", min: 16, max: 35 },
  { range: "36–60", label: "Moderate", description: "Noticeable bias present. Review suggested changes.", min: 36, max: 60 },
  { range: "61–80", label: "Significant", description: "Substantial bias detected. Rewriting recommended.", min: 61, max: 80 },
  { range: "81–100", label: "High", description: "Severe bias throughout. Major revision needed.", min: 81, max: 100 },
];

// ── Colors ──

function levelColor(level: BiasLevel): string {
  switch (level) {
    case "minimal": return "#00D4AA";
    case "low": return "#22C55E";
    case "moderate": return "#F59E0B";
    case "significant": return "#F97316";
    case "high": return "#EF4444";
  }
}

function levelBadgeClasses(level: BiasLevel): string {
  switch (level) {
    case "minimal": return "bg-[#00D4AA]/10 text-[#00D4AA]";
    case "low": return "bg-[#22C55E]/10 text-[#22C55E]";
    case "moderate": return "bg-[#F59E0B]/10 text-[#F59E0B]";
    case "significant": return "bg-[#F97316]/10 text-[#F97316]";
    case "high": return "bg-[#EF4444]/10 text-[#EF4444]";
  }
}

function levelLabel(level: BiasLevel): string {
  switch (level) {
    case "minimal": return "Minimal";
    case "low": return "Low";
    case "moderate": return "Moderate";
    case "significant": return "Significant";
    case "high": return "High";
  }
}

function severityColor(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "low": return "#22C55E";
    case "medium": return "#F59E0B";
    case "high": return "#EF4444";
  }
}

const EXAMPLE_BIASED = `We are looking for a young, energetic rockstar developer. He should have 10+ years of experience and be willing to work in our fast-paced office. The ideal candidate is a culture fit who enjoys beer Fridays and ping pong. Must be a native English speaker with a strong work ethic.`;
const EXAMPLE_BIASED_CONTEXT = "Job listing for a software engineer";

const EXAMPLE_INCLUSIVE = `We are seeking a software engineer to join our distributed team. Candidates of all experience levels are encouraged to apply. We offer flexible working arrangements, inclusive team activities, and comprehensive benefits. Our team values diverse perspectives. Proficiency in Python or JavaScript is required. We provide reasonable accommodations during the interview process.`;
const EXAMPLE_INCLUSIVE_CONTEXT = "Job listing for a software engineer";

const CATEGORY_EXPLANATIONS: Record<BiasCategory, string> = {
  demographic: "Does the text favor or exclude people based on gender, age, race, nationality, or other demographic traits?",
  stereotyping: "Does the text reinforce generalizations about groups \u2014 like \u2018women are nurturing\u2019 or \u2018millennials are lazy\u2019?",
  representation: "Does the text consistently show one perspective while ignoring others \u2014 like assuming everyone is Western, male, or able-bodied?",
  assumption: "Does the text assume things about the reader \u2014 like their income, education, family structure, or cultural background?",
  framing: "How does the text frame issues \u2014 is one viewpoint treated as \u2018normal\u2019 while others are presented as \u2018different\u2019?",
};

const CATEGORY_LABELS: Record<BiasCategory, string> = {
  demographic: "Demographic",
  stereotyping: "Stereotyping",
  representation: "Representation",
  assumption: "Assumption",
  framing: "Framing",
};

// ── Score Circle ──

function BiasScoreCircle({ score, level }: { score: number; level: BiasLevel }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = levelColor(level);

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
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${levelBadgeClasses(level)}`}>
        {levelLabel(level)} Bias
      </span>
    </div>
  );
}

// ── Category Card ──

function BiasCategoryCard({ cat, index }: { cat: BiasCategoryAnalysis; index: number }) {
  const color = levelColor(cat.level);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl border border-border-subtle bg-bg-card p-5"
      style={{ borderLeftWidth: 2, borderLeftColor: color }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 relative group">
          <h3 className="font-mono text-sm font-semibold text-text-primary">{cat.name}</h3>
          {CATEGORY_EXPLANATIONS[cat.category] && (
            <>
              <svg className="w-3.5 h-3.5 text-text-muted shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.5" />
                <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 rounded-lg px-3 py-2 text-xs text-text-secondary"
                style={{ backgroundColor: "#1A1A25", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                {CATEGORY_EXPLANATIONS[cat.category]}
              </span>
            </>
          )}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${levelBadgeClasses(cat.level)}`}>
          {levelLabel(cat.level)}
        </span>
      </div>
      {/* Score bar */}
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${cat.score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.05 }}
        />
      </div>
      <p className="font-mono text-xs text-text-muted mb-2">{cat.score}/100</p>
      <p className="text-xs text-text-secondary mb-3">{cat.description}</p>
      {/* Findings */}
      <ul className="space-y-1 mb-3">
        {cat.findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted leading-relaxed">{cat.explanation}</p>
    </motion.div>
  );
}

// ── Bias Instance Card ──

function BiasInstanceCard({ instance, index }: { instance: BiasInstance; index: number }) {
  const sevColor = severityColor(instance.severity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl border border-border-subtle bg-bg-card p-5"
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
          style={{ backgroundColor: `${sevColor}15`, color: sevColor }}
        >
          {instance.severity}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-bg-elevated text-text-muted">
          {CATEGORY_LABELS[instance.category]}
        </span>
      </div>

      {/* Issue & Impact */}
      <p className="text-sm text-text-secondary mb-1">
        <span className="font-medium text-text-primary">Issue:</span> {instance.issue}
      </p>
      <p className="text-sm text-text-secondary mb-3">
        <span className="font-medium text-text-primary">Impact:</span> {instance.impact}
      </p>

      {/* Original excerpt */}
      <div
        className="rounded-lg bg-bg-elevated/70 p-3"
        style={{ borderLeftWidth: 2, borderLeftColor: `${sevColor}80` }}
      >
        <p className="text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wider">Original</p>
        <p className="font-mono text-sm text-text-primary leading-relaxed opacity-80">&ldquo;{instance.excerpt}&rdquo;</p>
      </div>

      {/* Arrow */}
      <div className="flex justify-center py-1.5">
        <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>

      {/* Improved rewrite */}
      <div
        className="rounded-lg bg-bg-elevated p-3"
        style={{ borderLeftWidth: 2, borderLeftColor: "#00D4AA" }}
      >
        <p className="text-[10px] font-medium text-[#00D4AA] mb-1 uppercase tracking-wider">Improved</p>
        <p className="text-sm text-text-secondary leading-relaxed">{instance.suggestion}</p>
      </div>
    </motion.div>
  );
}

// ── Main Component ──

export function AIBiasChecker() {
  const [content, setContent] = useState("");
  const [context, setContext] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BiasAnalysis | null>(null);
  const [copied, setCopied] = useState(false);
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/check-bias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          ...(context.trim() ? { context: context.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(data as BiasAnalysis);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setContent("");
    setContext("");
    setContextOpen(false);
    setScoreExplainerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const lines = [
      "Nest Cipher AI Bias Check Report",
      `Overall Score: ${result.overallScore}/100 (${levelLabel(result.overallLevel)})`,
      `Verdict: ${result.verdictText}`,
      "",
      "Bias Categories:",
      ...result.categories.map((c) => `  ${c.name}: ${c.score}/100 (${levelLabel(c.level)})`),
      "",
      `Instances Found: ${result.instances.length}`,
      "",
      "Positive Aspects:",
      ...result.positiveAspects.map((p, i) => `  ${i + 1}. ${p}`),
      "",
      "Suggestions:",
      ...result.rewriteSuggestions.map((s, i) => `  ${i + 1}. ${s}`),
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
        <span className="text-text-primary">AI Bias Checker</span>
      </nav>

      {/* Title */}
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">AI Bias Checker</h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Paste AI-generated text below — job listings, product descriptions, marketing copy,
        chatbot responses — and we&apos;ll analyze it for bias and suggest improvements.
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Your text is analyzed securely and never stored.
      </p>

      {/* Input */}
      <form onSubmit={handleAnalyze} className="mt-8">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste AI-generated text here — e.g. a job description, product copy, chatbot response, article, or any AI output you want to check for bias..."
          disabled={loading}
          className="w-full min-h-[200px] resize-y rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
            placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
            transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between mt-2 mb-2">
          <p className="text-xs text-text-muted">
            Privacy: Your text is sent to our secure API for analysis and is never stored, logged, or shared.
          </p>
          <span className="text-xs text-text-muted shrink-0 ml-4">
            {content.length.toLocaleString()} / 10,000
          </span>
        </div>

        {/* Quick start examples */}
        {!loading && !result && (
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">Quick start:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => { setContent(EXAMPLE_BIASED); setContext(EXAMPLE_BIASED_CONTEXT); setContextOpen(true); }}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
              >
                Try biased text
              </button>
              <button
                type="button"
                onClick={() => { setContent(EXAMPLE_INCLUSIVE); setContext(EXAMPLE_INCLUSIVE_CONTEXT); setContextOpen(true); }}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
              >
                Try inclusive text
              </button>
            </div>
          </div>
        )}

        {/* Optional context field */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setContextOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {contextOpen ? "Hide context" : "Add context (optional)"}
              <motion.svg
                animate={{ rotate: contextOpen ? 180 : 0 }}
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
            <span className="relative group">
              <svg className="w-3.5 h-3.5 text-text-muted cursor-help" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.5" />
                <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 rounded-lg px-3 py-2 text-xs text-text-secondary"
                style={{ backgroundColor: "#1A1A25", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                Adding context helps the AI understand the text&apos;s purpose. A job listing, product description, and chatbot response each have different bias considerations.
              </span>
            </span>
          </div>
          <AnimatePresence>
            {contextOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-2">
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="What is this text for? e.g. 'Job listing for a software engineer' or 'Product description for skincare targeting all genders'"
                    disabled={loading}
                    className="w-full min-h-[80px] resize-y rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
                      placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                      transition-colors disabled:opacity-50"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-text-muted">
                      {context.length} / 500
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={loading || !content.trim()}
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
          ) : "Check for Bias"}
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
      {loading && <AIBiasCheckerSkeleton />}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <p className="text-sm text-text-muted">Paste AI-generated text above to check for bias</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" />
                <path d="M6 7l-4 8h8L6 7z" />
                <path d="M18 7l-4 8h8l-4-8z" />
                <path d="M6 3h12" />
              </svg>
              5 bias categories
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Specific instance detection
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Rewrite suggestions
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          key={result.analyzedAt}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-12"
        >
          {/* ── 1. Overall Score ── */}
          <div className="flex flex-col items-center text-center">
            <BiasScoreCircle score={result.overallScore} level={result.overallLevel} />

            {/* Verdict text */}
            <div
              className="mt-4 max-w-xl mx-auto border-l-2 pl-4 text-left"
              style={{ borderColor: levelColor(result.overallLevel) }}
            >
              <p className="text-lg font-medium text-text-primary">{result.verdictText}</p>
              <p className="mt-1 text-sm text-text-secondary">{result.summary}</p>
            </div>

            {/* Score explanation */}
            <p className="mt-3 text-xs text-text-muted max-w-md">
              {result.overallScore <= 15
                ? "This text shows minimal bias. Well done."
                : result.overallScore <= 35
                ? "Minor bias detected. Small adjustments would improve inclusivity."
                : result.overallScore <= 60
                ? "Noticeable bias present. Review the instances below and apply suggestions."
                : result.overallScore <= 80
                ? "Significant bias detected. This text needs revision before publishing."
                : "Severe bias detected. Major rewriting recommended."}
            </p>

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

          {/* ── 2. Bias Categories ── */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">Bias Analysis</h2>
            <div className="space-y-4">
              {result.categories.map((cat, i) => (
                <BiasCategoryCard key={cat.category} cat={cat} index={i} />
              ))}
            </div>
          </div>

          {/* ── 3. Bias Instances ── */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">
              {result.instances.length > 0
                ? `Bias Instances Found (${result.instances.length})`
                : "No Bias Instances Found"}
            </h2>
            {result.instances.length > 0 ? (
              <div>
                {/* Severity legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted mb-4">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                    Low — subtle or unconscious
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                    Medium — noticeable bias
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    High — overt or harmful
                  </span>
                </div>
                <div className="space-y-4">
                  {result.instances.map((instance, i) => (
                    <BiasInstanceCard key={instance.id} instance={instance} index={i} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#00D4AA]">
                No specific bias instances were identified in this text.
              </p>
            )}
          </div>

          {/* ── 4. Positive Aspects ── */}
          {result.positiveAspects.length > 0 && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">What This Text Does Well</h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border border-border-subtle bg-bg-card p-5"
                style={{ borderLeftWidth: 2, borderLeftColor: "#22C55E" }}
              >
                <ul className="space-y-2">
                  {result.positiveAspects.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <svg className="w-4 h-4 shrink-0 mt-0.5 text-[#22C55E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          )}

          {/* ── 5. Rewrite Suggestions ── */}
          {result.rewriteSuggestions.length > 0 && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">How to Improve</h2>
              <ol className="space-y-2">
                {result.rewriteSuggestions.map((sug, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="font-mono text-accent text-xs mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    {sug}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── 6. Educational Note ── */}
          {result.educationalNote && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">Understanding AI Bias</h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border border-border-subtle bg-bg-card p-5"
                style={{ borderLeftWidth: 2, borderLeftColor: "#00D4AA" }}
              >
                <p className="text-sm text-text-secondary leading-relaxed">{result.educationalNote}</p>
              </motion.div>
            </div>
          )}

          {/* ── 7. Action Buttons ── */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary
                hover:border-accent hover:text-accent transition-colors"
            >
              Check Another
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
