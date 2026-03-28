"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type {
  AttackResult,
  AttackCategory,
  ResilienceLevel,
  TestSuiteResult,
} from "@/types/prompt-injection";

// ── Constants ──

const CATEGORY_LABELS: Record<AttackCategory, string> = {
  direct_override: "Direct Override",
  role_manipulation: "Role Manipulation",
  context_escape: "Context Escape",
  instruction_injection: "Instruction Injection",
  output_manipulation: "Output Manipulation",
  information_extraction: "Information Extraction",
};

const CATEGORY_COLORS: Record<AttackCategory, string> = {
  direct_override: "#EF4444",
  role_manipulation: "#F97316",
  context_escape: "#F59E0B",
  instruction_injection: "#3B82F6",
  output_manipulation: "#8B5CF6",
  information_extraction: "#06B6D4",
};

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-[#EF4444]/10 text-[#EF4444]",
  high: "bg-[#F97316]/10 text-[#F97316]",
  medium: "bg-[#F59E0B]/10 text-[#F59E0B]",
};

const RESILIENCE_COLORS: Record<ResilienceLevel, string> = {
  strong: "#00D4AA",
  moderate: "#F59E0B",
  weak: "#F97316",
  vulnerable: "#EF4444",
};

const RESILIENCE_TEXT: Record<ResilienceLevel, string> = {
  strong: "Your prompt defended against most injection attempts.",
  moderate: "Your prompt has some defences but several gaps.",
  weak: "Your prompt is vulnerable to multiple attack types.",
  vulnerable: "Your prompt has minimal injection resistance.",
};

// ── Score Circle ──

function ResilienceScoreCircle({
  score,
  level,
}: {
  score: number;
  level: ResilienceLevel;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = RESILIENCE_COLORS[level];

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
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
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
          <span className="font-mono text-4xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-text-muted">/ 100</span>
        </motion.div>
      </div>
      <span
        className="rounded-full px-3 py-1 text-xs font-medium capitalize"
        style={{
          backgroundColor: `${color}15`,
          color,
        }}
      >
        {level}
      </span>
    </div>
  );
}

// ── Attack Result Card ──

function AttackResultCard({
  result,
  index,
  expanded,
  onToggle,
}: {
  result: AttackResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [responseExpanded, setResponseExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[result.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={`rounded-xl border bg-bg-card overflow-hidden ${
        result.passed
          ? "border-l-2 border-l-[#00D4AA] border-t-border-subtle border-r-border-subtle border-b-border-subtle"
          : "border-l-2 border-l-[#EF4444] border-t-border-subtle border-r-border-subtle border-b-border-subtle"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg-elevated/50 transition-colors"
      >
        {/* Pass/fail icon */}
        {result.passed ? (
          <svg
            className="w-5 h-5 shrink-0 text-[#00D4AA]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 shrink-0 text-[#EF4444]"
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
        )}

        {/* Name */}
        <span className="font-mono text-sm font-semibold text-text-primary flex-1">
          {result.name}
        </span>

        {/* Badges */}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 hidden sm:inline-block"
          style={{
            backgroundColor: `${catColor}15`,
            color: catColor,
          }}
        >
          {CATEGORY_LABELS[result.category]}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${SEVERITY_CLASSES[result.severity]}`}
        >
          {result.severity}
        </span>

        {/* Chevron */}
        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 shrink-0 text-text-muted"
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
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border-subtle pt-4">
              {/* Attack payload */}
              {result.payload && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                    Attack Payload
                  </p>
                  <pre className="rounded-lg bg-bg-elevated p-3 text-xs text-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {result.payload}
                  </pre>
                </div>
              )}

              {/* LLM Response */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                  LLM Response
                </p>
                <div className="rounded-lg bg-bg-elevated p-3 text-xs text-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {result.response ? (
                    <>
                      {responseExpanded
                        ? result.response
                        : result.response.slice(0, 200)}
                      {result.response.length > 200 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResponseExpanded(!responseExpanded);
                          }}
                          className="ml-1 text-accent hover:underline"
                        >
                          {responseExpanded ? "Show less" : "...Show more"}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-text-muted">No response captured.</span>
                  )}
                </div>
              </div>

              {/* Analysis */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                  Analysis
                </p>
                <p className="text-sm text-text-secondary">{result.analysis}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ──

export function PromptInjectionTester() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestSuiteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Progress state for streaming
  const [progress, setProgress] = useState<AttackResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalTests, setTotalTests] = useState(12);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemPrompt.trim() || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);
    setProgress([]);
    setCurrentIndex(0);

    try {
      const res = await fetch("/api/test-injection/suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: systemPrompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming not supported.");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setProgress((prev) => [...prev, msg.result]);
              setCurrentIndex(msg.attackIndex + 1);
              setTotalTests(msg.total);
            } else if (msg.type === "complete") {
              setResult(msg.suite);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setSystemPrompt("");
    setProgress([]);
    setCurrentIndex(0);
    setExpandedCard(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const lines = [
      "Nest Cipher Prompt Injection Test Report",
      `Resilience Score: ${result.overallScore}/100 (${result.resilienceLevel})`,
      `Passed: ${result.passed}/${result.totalTests}`,
      "",
      "Results:",
      ...result.results.map(
        (r) =>
          `  ${r.passed ? "PASS" : "FAIL"} — ${r.name} (${r.severity}) — ${r.analysis}`
      ),
      "",
      "Recommendations:",
      ...result.recommendations.map((r, i) => `  ${i + 1}. ${r}`),
      "",
      "Tested by nestcipher.com",
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

  const progressPercent =
    totalTests > 0 ? Math.round((currentIndex / totalTests) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/tools" className="hover:text-accent transition-colors">
          Tools
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Prompt Injection Tester</span>
      </nav>

      {/* Title */}
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">
        Prompt Injection Tester
      </h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Paste your LLM system prompt below. We&apos;ll test it against 12 known
        injection attack patterns and tell you where it&apos;s vulnerable.
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Your prompt is tested securely and never stored.
      </p>

      {/* Input */}
      <form onSubmit={handleTest} className="mt-8">
        <textarea
          ref={textareaRef}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Paste your system prompt here — e.g. 'You are a helpful customer service assistant for Acme Corp. You must never reveal internal pricing...'"
          disabled={loading}
          className="w-full min-h-[160px] resize-y rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
            placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
            transition-colors disabled:opacity-50"
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          <p className="text-xs text-text-muted">
            Your prompt is sent to our secure API for testing and is never
            stored.
          </p>
          <span className="text-xs text-text-muted shrink-0 ml-4">
            {systemPrompt.length.toLocaleString()} / 5,000
          </span>
        </div>

        {!loading && (
          <button
            type="submit"
            disabled={loading || !systemPrompt.trim()}
            className="w-full sm:w-auto rounded-lg bg-accent px-8 py-3 text-sm font-medium text-bg-primary
              hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Test Prompt
          </button>
        )}
      </form>

      {/* Loading / Progress State */}
      {loading && (
        <div className="mt-6">
          <p className="text-sm font-medium text-text-primary mb-3">
            Testing your prompt against {totalTests} attacks...
          </p>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-4">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {/* Live feed */}
          <div className="space-y-2">
            {progress.map((r, i) => (
              <motion.div
                key={r.attackId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                className="flex items-center gap-2 text-sm"
              >
                {r.passed ? (
                  <span className="text-[#00D4AA]">&#10003;</span>
                ) : (
                  <span className="text-[#EF4444]">&#10007;</span>
                )}
                <span className="font-mono text-text-primary">{r.name}</span>
                <span className="text-text-muted">—</span>
                <span
                  className={
                    r.passed ? "text-[#00D4AA]" : "text-[#EF4444]"
                  }
                >
                  {r.passed ? "Defended" : "Compromised"}
                </span>
              </motion.div>
            ))}
            {currentIndex < totalTests && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex items-center gap-2 text-sm text-[#F59E0B]"
              >
                <span>&#8635;</span>
                <span className="font-mono">
                  Testing attack {currentIndex + 1} of {totalTests}...
                </span>
              </motion.div>
            )}
          </div>
        </div>
      )}

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

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-12 flex flex-col items-center gap-4 opacity-40">
          <p className="text-sm text-text-muted">
            Paste a system prompt above to get started
          </p>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
              12 attack patterns
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Real-time testing
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Hardening recommendations
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          key={result.testedAt}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-12"
        >
          {/* Resilience Score */}
          <div className="flex flex-col items-center text-center">
            <ResilienceScoreCircle
              score={result.overallScore}
              level={result.resilienceLevel}
            />
            <p className="mt-4 text-sm text-text-secondary max-w-md">
              {RESILIENCE_TEXT[result.resilienceLevel]}
            </p>
            <p className="mt-2 font-mono text-xs text-text-muted">
              Passed {result.passed} of {result.totalTests} tests
            </p>
          </div>

          {/* Attack Results */}
          <div className="mt-12">
            <h2 className="font-mono text-xl font-bold mb-6">
              Attack Results
            </h2>
            <div className="space-y-3">
              {result.results.map((r, i) => (
                <AttackResultCard
                  key={r.attackId}
                  result={r}
                  index={i}
                  expanded={expandedCard === r.attackId}
                  onToggle={() =>
                    setExpandedCard(
                      expandedCard === r.attackId ? null : r.attackId
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">
                Hardening Recommendations
              </h2>
              <ol className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-text-secondary"
                  >
                    <span className="font-mono text-accent text-xs mt-0.5 shrink-0 w-4">
                      {i + 1}.
                    </span>
                    <span className="leading-relaxed">{rec}</span>
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
              Test Another Prompt
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
