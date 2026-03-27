"use client";

import { motion } from "framer-motion";

interface QuizResultsProps {
  score: number;
  total: number;
  answers: { questionTitle: string; correct: boolean }[];
  onRetry: () => void;
  onBackToExplorer: () => void;
}

function scoreColor(score: number, total: number): string {
  const pct = score / total;
  if (pct >= 0.9) return "#00D4AA";
  if (pct >= 0.7) return "#3B82F6";
  if (pct >= 0.5) return "#F59E0B";
  return "#EF4444";
}

function scoreMessage(score: number, total: number): string {
  if (score === total) return "Perfect score. You know your LLM security.";
  if (score >= 7) return "Solid knowledge. Review the ones you missed.";
  if (score >= 4) return "Getting there. Explore the vulnerabilities you missed below.";
  return "Time to study. Start with the Explorer mode.";
}

export function QuizResults({ score, total, answers, onRetry, onBackToExplorer }: QuizResultsProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / total;
  const color = scoreColor(score, total);

  return (
    <div className="flex flex-col items-center">
      {/* Score circle */}
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
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
            {score}/{total}
          </span>
        </motion.div>
      </div>

      <p className="mt-4 text-text-secondary text-center">{scoreMessage(score, total)}</p>

      {/* Answer summary */}
      <div className="mt-8 w-full max-w-md space-y-2">
        {answers.map((a, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className={a.correct ? "text-[#00D4AA]" : "text-[#EF4444]"}>
              {a.correct ? "✓" : "✗"}
            </span>
            <span className="text-text-secondary">{a.questionTitle}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-border-hover px-6 py-3 text-sm font-medium text-text-primary hover:border-accent hover:text-accent transition-colors"
        >
          Retake Quiz
        </button>
        <button
          type="button"
          onClick={onBackToExplorer}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg-primary hover:bg-accent-hover transition-colors"
        >
          Back to Explorer
        </button>
      </div>
    </div>
  );
}
