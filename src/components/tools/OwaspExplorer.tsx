"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const filtered =
    riskFilter === "all"
      ? owaspLlmTop10
      : owaspLlmTop10.filter((v) => v.riskLevel === riskFilter);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/tools" className="hover:text-accent transition-colors">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">OWASP LLM Top 10</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="font-mono text-3xl font-bold sm:text-4xl">OWASP Top 10 for LLMs</h1>
          <p className="mt-3 text-text-secondary max-w-2xl">
            The most critical security risks in Large Language Model applications.
            Click any vulnerability to explore.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Based on{" "}
            <a
              href="https://genai.owasp.org/llm-top-10/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              OWASP Top 10 for LLM Applications 2025
            </a>
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-bg-elevated p-1 shrink-0">
          {(["explore", "quiz"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize ${
                mode === m
                  ? "bg-accent text-bg-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {m === "explore" ? "Explorer" : "Quiz"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === "explore" ? (
          <motion.div
            key="explore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-8"
          >
            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {riskFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setRiskFilter(f.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    riskFilter === f.value
                      ? "bg-accent text-bg-primary"
                      : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="text-xs text-text-muted ml-2">
                Showing {filtered.length} of {owaspLlmTop10.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {filtered.map((v, i) => (
                <VulnerabilityCard
                  key={v.id}
                  vulnerability={v}
                  isExpanded={expandedId === v.id}
                  onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-8"
          >
            <QuizMode
              vulnerabilities={owaspLlmTop10}
              onBackToExplorer={() => setMode("explore")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
