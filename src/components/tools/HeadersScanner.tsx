"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { ScanResponse, HeaderResult, GradeLevel } from "@/types/headers-scanner";
import { HeadersScannerSkeleton } from "@/components/ui/SkeletonLoader";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

// ── Data maps ──

const HEADER_EXPLAINERS: Record<string, string> = {
  "Strict-Transport-Security": "Forces your browser to always use a secure HTTPS connection.",
  "Content-Security-Policy": "Controls what scripts and resources a website is allowed to load.",
  "X-Content-Type-Options": "Stops browsers from guessing file types, which can be exploited.",
  "X-Frame-Options": "Prevents other websites from embedding this site in a hidden frame.",
  "Referrer-Policy": "Controls how much information your browser shares when you click a link.",
  "Permissions-Policy": "Limits which device features (camera, mic, location) a site can access.",
  "X-XSS-Protection": "Legacy protection against script injection — modern sites use CSP instead.",
  "Cross-Origin-Opener-Policy": "Isolates this site's window from other sites for extra security.",
  "Cross-Origin-Resource-Policy": "Controls whether other websites can load this site's files.",
  "Cross-Origin-Embedder-Policy": "Ensures all loaded resources have explicitly granted permission.",
};

const GRADE_EXPLANATIONS: Record<GradeLevel, string> = {
  "A+": "Excellent. This site implements all recommended security headers.",
  "A": "Strong security posture with minor improvements possible.",
  "B": "Good foundation, but several important headers are missing.",
  "C": "Moderate risk. Multiple security headers need attention.",
  "D": "Weak security. Most recommended headers are not configured.",
  "F": "Critical gaps. This site is missing essential security protections.",
};

// ── Grade colors ──

function gradeColor(grade: GradeLevel): string {
  switch (grade) {
    case "A+":
    case "A":
      return "#00D4AA";
    case "B":
      return "#3B82F6";
    case "C":
      return "#F59E0B";
    case "D":
      return "#F97316";
    case "F":
      return "#EF4444";
  }
}

// ── Grade Circle ──

function GradeCircle({ grade, score, maxScore }: { grade: GradeLevel; score: number; maxScore: number }) {
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
            {grade}
          </span>
        </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex items-center justify-center gap-4 text-sm text-text-muted font-mono flex-wrap"
    >
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#00D4AA]" />
        {passed} passed
      </span>
      <span className="text-border-hover">·</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
        {failed} failed
      </span>
      <span className="text-border-hover">·</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
        {partial} partial
      </span>
    </motion.div>
  );
}

// ── Status Icons ──

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-[#00D4AA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5 text-[#EF4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-[#F59E0B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function HeaderCard({ header, index }: { header: HeaderResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isLongValue = header.value && header.value.length > 80;
  const explainer = HEADER_EXPLAINERS[header.name];

  const scorePillColor =
    header.status === "pass"
      ? "text-[#00D4AA] bg-[#00D4AA]/10"
      : header.status === "partial"
        ? "text-[#F59E0B] bg-[#F59E0B]/10"
        : "text-[#EF4444] bg-[#EF4444]/10";

  const recommendationBorder =
    header.status === "partial" ? "border-[#F59E0B]/40" : "border-[#EF4444]/40";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl border border-border-subtle bg-bg-card p-5 hover:border-border-hover transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={header.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono text-sm font-semibold text-text-primary">
                {header.name}
              </h3>
              {explainer && (
                <InfoTooltip
                  text={explainer}
                  isOpen={tooltipOpen}
                  onToggle={() => setTooltipOpen((prev) => !prev)}
                />
              )}
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${scorePillColor}`}>
              {header.score}/{header.maxScore}
            </span>
          </div>

          {header.present && header.value && (
            <div className="mt-2">
              <button
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
    </motion.div>
  );
}

// ── Main Component ──

export function HeadersScanner() {
  const [url, setUrl] = useState("");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          `${h.status === "pass" ? "✓" : h.status === "partial" ? "~" : "✗"} ${h.name}: ${h.score}/${h.maxScore}`
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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/tools" className="hover:text-accent transition-colors">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Headers Scanner</span>
      </nav>

      {/* Title */}
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">
        Security Headers Scanner
      </h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Check any website&apos;s HTTP security headers and get actionable recommendations.
      </p>

      {/* Input */}
      <form onSubmit={handleScan} className="mt-8 flex flex-col sm:flex-row gap-3">
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter a URL — e.g. google.com"
          disabled={loading}
          className="flex-1 rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
            placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
            transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-lg bg-accent px-8 py-3 text-sm font-medium text-bg-primary
            hover:bg-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Scanning...
            </motion.span>
          ) : (
            "Scan"
          )}
        </button>
      </form>

      {/* Progress text */}
      <AnimatePresence>
        {loading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-sm text-text-muted"
          >
            Fetching headers from {url.trim().replace(/^https?:\/\//, "")}...
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
      {loading && <HeadersScannerSkeleton />}

      {/* Results */}
      {result && !loading && (
          <motion.div
            key={result.scannedAt}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12"
          >
            {/* Grade */}
            <div className="flex flex-col items-center text-center">
              <GradeCircle
                grade={result.grade}
                score={result.score}
                maxScore={result.maxScore}
              />
              <p className="mt-4 font-mono text-sm text-text-muted break-all">
                {result.url}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Scanned at {new Date(result.scannedAt).toLocaleString()}
              </p>
            </div>

            {/* Result Summary */}
            <div className="mt-6">
              <ResultSummary headers={result.headers} />
            </div>

            {/* Header Analysis */}
            <div className="mt-12">
              <h2 className="font-mono text-xl font-bold mb-6">Header Analysis</h2>
              <div className="space-y-3">
                {result.headers.map((header, i) => (
                  <HeaderCard key={header.name} header={header} index={i} />
                ))}
              </div>
            </div>

            {/* Server Info */}
            {(result.serverInfo.server || result.serverInfo.poweredBy) && (
              <div className="mt-8 rounded-xl border border-border-subtle bg-bg-card p-5">
                <h3 className="font-mono text-sm font-semibold text-text-primary mb-3">
                  Server Information
                </h3>
                <div className="space-y-1 text-sm text-text-secondary">
                  {result.serverInfo.server && (
                    <p>
                      <span className="text-text-muted">Server:</span>{" "}
                      <span className="font-mono">{result.serverInfo.server}</span>
                    </p>
                  )}
                  {result.serverInfo.poweredBy && (
                    <p>
                      <span className="text-text-muted">X-Powered-By:</span>{" "}
                      <span className="font-mono">{result.serverInfo.poweredBy}</span>
                    </p>
                  )}
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  Consider removing server version headers to reduce information disclosure.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary
                  hover:border-accent hover:text-accent transition-colors"
              >
                Scan Another
              </button>
              <button
                type="button"
                onClick={handleCopyResults}
                className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary
                  hover:border-accent hover:text-accent transition-colors"
              >
                {copied ? "Copied!" : "Copy Results"}
              </button>
            </div>
          </motion.div>
        )}
    </div>
  );
}
