"use client";

import { useState } from "react";
import Link from "next/link";
import { owaspLlmTop10 } from "@/data/owasp-llm-top10";
import type { RiskLevel } from "@/types/owasp";
import { VulnerabilityCard } from "./VulnerabilityCard";
import { QuizMode } from "./QuizMode";

const riskFilters: { label: string; value: RiskLevel | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
];

export function OwaspExplorer() {
  const [mode, setMode] = useState<"explore" | "quiz">("explore");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [hasExpandedAny, setHasExpandedAny] = useState(false);
  const [exploredIds, setExploredIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    const isExpanding = expandedId !== id;
    setExpandedId(isExpanding ? id : null);
    if (isExpanding) {
      setHasExpandedAny(true);
      setExploredIds((prev) => new Set(prev).add(id));
    }
  };

  const filtered =
    riskFilter === "all"
      ? owaspLlmTop10
      : owaspLlmTop10.filter((v) => v.riskLevel === riskFilter);

  return (
    <div className="site-container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">OWASP LLM Top 10</span>
      </nav>

      <header className="page-header">
        <div className="max-w-3xl">
          <p className="eyebrow">03 / Learning reference</p>
          <h1 className="page-title">OWASP Top 10 for LLMs</h1>
          <p className="page-description">
            Understand the risks behind large language model applications.
            Explore each vulnerability, then test what you know.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-t border-border-subtle pt-6">
          <p className="font-mono text-xs text-text-muted">
            Based on{" "}
            <a
              href="https://genai.owasp.org/llm-top-10/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary underline underline-offset-4 hover:text-accent"
            >
              OWASP LLM Applications 2025
            </a>
          </p>
          <div
            aria-label="Learning mode"
            className="inline-flex gap-1 border border-border-subtle bg-bg-elevated p-1"
          >
            {(["explore", "quiz"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`min-h-[44px] px-5 py-2 text-sm font-medium transition-colors ${mode === m ? "bg-bg-card text-text-primary" : "text-text-muted hover:text-text-primary"}`}
              >
                {m === "explore" ? "Explorer" : "Quiz"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-border-subtle py-5">
        <p className="max-w-xl text-base text-text-secondary">
          Put the reference into practice: inspect source authority, action
          evidence and controlled comparisons in three authored labs.
        </p>
        <Link href="/labs" className="text-link min-h-[44px]">
          Explore the labs ↗
        </Link>
      </div>

      <noscript>
        <p className="mb-6 text-sm text-text-secondary">
          The reference summaries are available below. Enable JavaScript to
          expand them, filter risks, and use the quiz.
        </p>
      </noscript>

      {mode === "explore" ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <section aria-label="Vulnerability reference" className="min-w-0">
            <div
              aria-label="Filter by risk level"
              className="mb-5 flex flex-wrap items-center gap-2"
            >
              {riskFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setRiskFilter(f.value)}
                  aria-pressed={riskFilter === f.value}
                  className={`min-h-[44px] border px-4 py-2 text-xs font-mono transition-colors ${riskFilter === f.value ? "border-accent bg-accent/10 text-accent" : "border-border-hover text-text-secondary hover:border-border-hover hover:text-text-primary"}`}
                >
                  {f.label}
                </button>
              ))}
              <span
                className="ml-auto font-mono text-xs text-text-muted"
                aria-live="polite"
              >
                {filtered.length} / {owaspLlmTop10.length} risks
              </span>
            </div>
            <div className="space-y-3">
              {filtered.map((v) => (
                <VulnerabilityCard
                  key={v.id}
                  vulnerability={v}
                  isExpanded={expandedId === v.id}
                  onToggle={() => handleToggle(v.id)}
                  showStartHere={!hasExpandedAny}
                />
              ))}
            </div>
          </section>

          <aside className="border border-border-subtle bg-bg-card p-6">
            <p className="eyebrow">Your field notes</p>
            <p className="mt-5 text-3xl font-medium tracking-tight">
              {exploredIds.size}
              <span className="ml-2 font-mono text-sm text-text-muted">
                / 10 explored
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Vulnerabilities explored"
              aria-valuemin={0}
              aria-valuemax={owaspLlmTop10.length}
              aria-valuenow={exploredIds.size}
              className="mt-4 h-1 overflow-hidden bg-bg-elevated"
            >
              <div
                className="h-full bg-accent"
                style={{
                  width: `${(exploredIds.size / owaspLlmTop10.length) * 100}%`,
                }}
              />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-text-secondary">
              Start with prompt injection. Open a risk to read its real-world
              example, impact, and mitigations.
            </p>
            <div className="mt-6 border-t border-border-subtle pt-5">
              <p className="font-mono text-xs text-text-muted">
                LOCAL REFERENCE
              </p>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Runs in your browser. Nothing you do here leaves this page.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <section aria-label="LLM security quiz" className="tool-workspace">
          <QuizMode
            vulnerabilities={owaspLlmTop10}
            onBackToExplorer={() => setMode("explore")}
          />
        </section>
      )}
    </div>
  );
}
