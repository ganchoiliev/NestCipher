"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { AIContentAnalysis, ContentVerdict, DetectionSignal, SentenceAnalysis } from "@/types/ai-content-detector";
import { AIContentDetectorSkeleton } from "@/components/ui/SkeletonLoader";

const LOADING_PHASES = [
  "Scanning text patterns...",
  "Analyzing vocabulary and structure...",
  "Evaluating sentence-level signals...",
  "Generating detection report...",
];

const SCORE_RANGES = [
  { range: "0–20", label: "Human", description: "Text shows strong human writing patterns.", min: 0, max: 20 },
  { range: "21–40", label: "Likely Human", description: "Mostly human with minor AI-like patterns.", min: 21, max: 40 },
  { range: "41–60", label: "Mixed", description: "Contains both human and AI-like characteristics.", min: 41, max: 60 },
  { range: "61–80", label: "Likely AI", description: "Strong AI patterns detected.", min: 61, max: 80 },
  { range: "81–100", label: "AI", description: "Text is very likely AI-generated.", min: 81, max: 100 },
];

const EXAMPLE_AI = `In today's rapidly evolving technological landscape, artificial intelligence has emerged as a transformative force reshaping virtually every aspect of our daily lives. It is important to note that while these advancements bring tremendous benefits, they also raise crucial questions about ethics and privacy. Furthermore, the integration of machine learning algorithms has streamlined operations across multiple sectors.`;

const EXAMPLE_HUMAN = `Look, I know everyone is going on about AI these days and honestly? Half of it is hype. I tried using ChatGPT to write my cover letter last month and it came out sounding like a robot wrote it. My friend Sarah told me she can spot AI applications a mile off. Nobody talks like that. Real people ramble and go off on tangents.`;

const SIGNAL_EXPLANATIONS: Record<string, string> = {
  "Perplexity & Predictability": "How surprising and varied the word choices are. AI text tends to always pick the most expected next word.",
  "Burstiness & Rhythm": "Whether sentence lengths vary naturally. Humans mix short and long sentences \u2014 AI tends to be uniform.",
  "Vocabulary & Phrasing": "Whether the text uses phrases that AI models commonly overuse, like \u2018delve\u2019, \u2018crucial\u2019, or \u2018it\u2019s important to note\u2019.",
  "Structural Patterns": "Whether the text follows a predictable formula \u2014 clean intro, balanced paragraphs, tidy conclusion.",
  "Authenticity Markers": "Whether the text has a personal voice \u2014 opinions, humour, specific experiences, contractions, colloquialisms.",
};

// ── Colors ──

function verdictColor(verdict: ContentVerdict): string {
  switch (verdict) {
    case "human": return "#00D4AA";
    case "likely_human": return "#22C55E";
    case "mixed": return "#F59E0B";
    case "likely_ai": return "#F97316";
    case "ai": return "#EF4444";
  }
}

function verdictBadgeClasses(verdict: ContentVerdict): string {
  switch (verdict) {
    case "human": return "bg-[#00D4AA]/10 text-[#00D4AA]";
    case "likely_human": return "bg-[#22C55E]/10 text-[#22C55E]";
    case "mixed": return "bg-[#F59E0B]/10 text-[#F59E0B]";
    case "likely_ai": return "bg-[#F97316]/10 text-[#F97316]";
    case "ai": return "bg-[#EF4444]/10 text-[#EF4444]";
  }
}

function verdictLabel(verdict: ContentVerdict): string {
  switch (verdict) {
    case "human": return "Human";
    case "likely_human": return "Likely Human";
    case "mixed": return "Mixed";
    case "likely_ai": return "Likely AI";
    case "ai": return "AI";
  }
}

// ── Score Circle ──

function DetectionScoreCircle({ score, verdict }: { score: number; verdict: ContentVerdict }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = verdictColor(verdict);

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
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${verdictBadgeClasses(verdict)}`}>
        {verdictLabel(verdict)}
      </span>
    </div>
  );
}

// ── Signal Card ──

function SignalCard({ signal, index }: { signal: DetectionSignal; index: number }) {
  const color = verdictColor(signal.verdict);

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
          <h3 className="font-mono text-sm font-semibold text-text-primary">{signal.name}</h3>
          {SIGNAL_EXPLANATIONS[signal.name] && (
            <>
              <svg className="w-3.5 h-3.5 text-text-muted shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.5" />
                <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-64 rounded-lg px-3 py-2 text-xs text-text-secondary"
                style={{ backgroundColor: "#1A1A25", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                {SIGNAL_EXPLANATIONS[signal.name]}
              </span>
            </>
          )}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verdictBadgeClasses(signal.verdict)}`}>
          {verdictLabel(signal.verdict)}
        </span>
      </div>
      {/* Score bar */}
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${signal.score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.05 }}
        />
      </div>
      <p className="font-mono text-xs text-text-muted mb-2">{signal.score}/100</p>
      <p className="text-xs text-text-secondary mb-3">{signal.description}</p>
      {/* Findings */}
      <ul className="space-y-1 mb-3">
        {signal.findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted leading-relaxed">{signal.explanation}</p>
    </motion.div>
  );
}

// ── Sentence Highlighting ──

interface MatchedSegment {
  text: string;
  sentence: SentenceAnalysis | null;
}

function matchSentences(originalText: string, sentences: SentenceAnalysis[]): MatchedSegment[] {
  const segments: MatchedSegment[] = [];
  let remaining = originalText;

  for (const sentence of sentences) {
    const trimmed = sentence.text.trim();
    if (!trimmed) continue;

    const idx = remaining.indexOf(trimmed);
    if (idx === -1) continue;

    // Text before this sentence (unmatched)
    if (idx > 0) {
      segments.push({ text: remaining.slice(0, idx), sentence: null });
    }

    // The matched sentence
    segments.push({ text: trimmed, sentence });

    remaining = remaining.slice(idx + trimmed.length);
  }

  // Any remaining text after all sentences
  if (remaining.length > 0) {
    segments.push({ text: remaining, sentence: null });
  }

  return segments;
}

function SentenceHighlighter({
  originalText,
  sentences,
}: {
  originalText: string;
  sentences: SentenceAnalysis[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const segments = matchSentences(originalText, sentences);

  // Track which segments are actual sentences (for indexing)
  let sentenceIdx = -1;

  return (
    <div>
      <div className="rounded-xl border border-border-subtle bg-bg-card p-5 text-sm leading-relaxed text-text-primary relative">
        {segments.map((seg, i) => {
          if (!seg.sentence) {
            return <span key={i}>{seg.text}</span>;
          }

          sentenceIdx++;
          const idx = sentenceIdx;
          const color = verdictColor(seg.sentence.verdict);
          const isActive = activeIndex === idx;

          return (
            <span
              key={i}
              className="relative cursor-pointer transition-colors duration-150 rounded-sm"
              style={{ backgroundColor: `${color}${isActive ? "30" : "18"}` }}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(isActive ? null : idx)}
            >
              {seg.text}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border-subtle bg-bg-card p-3 shadow-lg"
                    style={{ borderTopColor: color, borderTopWidth: 2 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold" style={{ color }}>
                        {seg.sentence.aiProbability}% AI probability
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${verdictBadgeClasses(seg.sentence.verdict)}`}>
                        {verdictLabel(seg.sentence.verdict)}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {seg.sentence.signals.map((s, si) => (
                        <li key={si} className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <span className="mt-1 w-1 h-1 rounded-full bg-accent shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </span>
          );
        })}
      </div>

      {/* Colour legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">Legend:</span>
        {([
          ["human", "Human"],
          ["likely_human", "Likely Human"],
          ["mixed", "Mixed"],
          ["likely_ai", "Likely AI"],
          ["ai", "AI"],
        ] as [ContentVerdict, string][]).map(([v, label]) => (
          <span key={v} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: `${verdictColor(v)}30` }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──

export function AIContentDetector() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIContentAnalysis | null>(null);
  const [copied, setCopied] = useState(false);
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [analyzedContent, setAnalyzedContent] = useState("");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);
    setAnalyzedContent(content.trim());

    try {
      const res = await fetch("/api/detect-ai-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(data as AIContentAnalysis);
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
    setAnalyzedContent("");
    setScoreExplainerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const lines = [
      "Nest Cipher AI Content Detection Report",
      `Overall Score: ${result.overallScore}/100 (${verdictLabel(result.overallVerdict)})`,
      `Confidence: ${result.confidence}%`,
      `Verdict: ${result.verdictText}`,
      "",
      "Detection Signals:",
      ...result.signals.map((s) => `  ${s.name}: ${s.score}/100`),
      "",
      "Text Statistics:",
      `  Words: ${result.stats.wordCount} | Sentences: ${result.stats.sentenceCount} | Avg length: ${result.stats.avgWordsPerSentence} words`,
      `  Vocabulary richness: ${result.stats.vocabularyRichness}%`,
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
        <span className="text-text-primary">AI Content Detector</span>
      </nav>

      {/* Title */}
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">AI Content Detector</h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Paste any text below. Our AI will analyze it across 5 detection signals and
        highlight individual sentences by AI probability.
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
          placeholder="Paste the text you want to analyze — essays, articles, emails, blog posts, or any written content..."
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
                onClick={() => setContent(EXAMPLE_AI)}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
              >
                Try AI-generated text
              </button>
              <button
                type="button"
                onClick={() => setContent(EXAMPLE_HUMAN)}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
              >
                Try human-written text
              </button>
            </div>
          </div>
        )}

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
          ) : "Detect AI Content"}
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
      {loading && <AIContentDetectorSkeleton />}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <p className="text-sm text-text-muted">Paste text above to analyze</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              5 detection signals
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Sentence-level highlighting
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Educational analysis
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
            <DetectionScoreCircle score={result.overallScore} verdict={result.overallVerdict} />

            {/* Verdict text */}
            <div
              className="mt-4 max-w-xl mx-auto border-l-2 pl-4 text-left"
              style={{ borderColor: verdictColor(result.overallVerdict) }}
            >
              <p className="text-lg font-medium text-text-primary">{result.verdictText}</p>
              <p className="mt-1 text-sm text-text-secondary">{result.summary}</p>
            </div>

            {/* Confidence bar */}
            <div className="mt-4 w-full max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Confidence</span>
                <span className="font-mono text-xs text-text-secondary">{result.confidence}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${result.confidence}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                />
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                {result.confidence < 50
                  ? "Low confidence \u2014 this text is too short or too formal for a definitive assessment."
                  : result.confidence <= 75
                  ? "Moderate confidence \u2014 the analysis is indicative but not conclusive."
                  : "High confidence \u2014 the detection signals strongly agree."}
              </p>
            </div>

            {/* Score explainer */}
            <div className="mt-4 w-full max-w-xl">
              <button
                type="button"
                onClick={() => setScoreExplainerOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors mx-auto"
              >
                What does this mean?
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

          {/* ── 2. Sentence Analysis ── */}
          {result.sentenceAnalysis && result.sentenceAnalysis.length > 0 && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">Sentence Analysis</h2>
              <SentenceHighlighter
                originalText={analyzedContent}
                sentences={result.sentenceAnalysis}
              />
            </div>
          )}

          {/* ── 3. Detection Signals ── */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">Detection Signals</h2>
            <div className="space-y-4">
              {result.signals.map((signal, i) => (
                <SignalCard key={signal.name} signal={signal} index={i} />
              ))}
            </div>
          </div>

          {/* ── 4. Text Statistics ── */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">Text Statistics</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              {[
                { label: "Words", value: result.stats.wordCount },
                { label: "Sentences", value: result.stats.sentenceCount },
                { label: "Avg Words/Sentence", value: result.stats.avgWordsPerSentence },
                { label: "Vocabulary Richness", value: `${result.stats.vocabularyRichness}%` },
                { label: "Longest Sentence", value: `${result.stats.longestSentence} words` },
                { label: "Shortest Sentence", value: `${result.stats.shortestSentence} words` },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl border border-border-subtle bg-bg-card p-4 text-center"
                >
                  <p className="font-mono text-2xl font-bold text-text-primary">{stat.value}</p>
                  <p className="mt-1 text-xs text-text-muted">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── 5. Educational Note ── */}
          {result.educationalNote && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">What to Look For</h2>
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

          {/* ── 6. Action Buttons ── */}
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
