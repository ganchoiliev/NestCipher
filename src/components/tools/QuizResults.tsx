"use client";

import type { Difficulty } from "@/types/owasp";

interface QuizResultsProps {
  score: number;
  total: number;
  answers: {
    questionTitle: string;
    correct: boolean;
    difficulty: Difficulty;
  }[];
  onRetry: () => void;
  onBackToExplorer: () => void;
}

function scoreColor(score: number, total: number): string {
  const pct = score / total;
  if (pct >= 0.9) return "var(--success)";
  if (pct >= 0.7) return "var(--info)";
  if (pct >= 0.5) return "var(--warning)";
  return "var(--danger)";
}

function scoreMessage(score: number, total: number): string {
  if (score === total) return "Perfect score. You know your LLM security.";
  if (score >= 7) return "Solid knowledge. Review the ones you missed.";
  if (score >= 4)
    return "Getting there. Explore the vulnerabilities you missed below.";
  return "Time to study. Start with the Explorer mode.";
}

export function QuizResults({
  score,
  total,
  answers,
  onRetry,
  onBackToExplorer,
}: QuizResultsProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / total;
  const color = scoreColor(score, total);

  return (
    <div className="flex flex-col items-center">
      <p className="eyebrow">Knowledge check complete</p>
      <h2 className="mb-8 mt-3 text-3xl font-semibold tracking-tight">
        Quiz results
      </h2>
      <p className="sr-only" role="status">
        Quiz complete. {score} of {total} answers correct.
      </p>
      {/* Score circle */}
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
            {score}/{total}
          </span>
        </div>
      </div>

      <p className="mt-4 text-text-secondary text-center">
        {scoreMessage(score, total)}
      </p>

      {/* Difficulty breakdown */}
      <div className="mt-8 w-full max-w-xl space-y-3 border-y border-border-subtle py-5">
        {(["introductory", "intermediate", "advanced"] as const).map((d) => {
          const group = answers.filter((a) => a.difficulty === d);
          const correct = group.filter((a) => a.correct).length;
          return (
            <div key={d} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary capitalize">{d}</span>
              <span
                className={
                  correct === group.length ? "text-success" : "text-danger"
                }
              >
                {correct}/{group.length} correct
              </span>
            </div>
          );
        })}
      </div>

      {/* Answer summary */}
      <div className="mt-8 w-full max-w-xl space-y-3">
        {answers.map((a, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span
              aria-label={a.correct ? "Correct" : "Incorrect"}
              className={a.correct ? "text-success" : "text-danger"}
            >
              {a.correct ? "✓" : "✗"}
            </span>
            <span className="text-text-secondary">{a.questionTitle}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={onRetry} className="button-secondary">
          Retake Quiz
        </button>
        <button
          type="button"
          onClick={onBackToExplorer}
          className="button-primary disabled:opacity-50"
        >
          Back to Explorer
        </button>
      </div>
    </div>
  );
}
