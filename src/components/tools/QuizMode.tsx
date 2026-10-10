"use client";

import { useState, useCallback } from "react";
import type { OwaspVulnerability, Difficulty } from "@/types/owasp";
import { QuizResults } from "./QuizResults";

interface QuizModeProps {
  vulnerabilities: OwaspVulnerability[];
  onBackToExplorer: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizMode({ vulnerabilities, onBackToExplorer }: QuizModeProps) {
  const [order, setOrder] = useState<OwaspVulnerability[]>(() =>
    shuffle(vulnerabilities),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<
    { questionTitle: string; correct: boolean; difficulty: Difficulty }[]
  >([]);
  const [showResults, setShowResults] = useState(false);

  const initQuiz = useCallback(() => {
    setOrder(shuffle(vulnerabilities));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setResults([]);
    setShowResults(false);
  }, [vulnerabilities]);

  if (order.length === 0) return null;

  if (showResults) {
    const score = results.filter((r) => r.correct).length;
    return (
      <QuizResults
        score={score}
        total={results.length}
        answers={results}
        onRetry={initQuiz}
        onBackToExplorer={onBackToExplorer}
      />
    );
  }

  const current = order[currentIndex];
  const quiz = current.quiz;
  const isLast = currentIndex === order.length - 1;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setAnswered(true);
  };

  const handleNext = () => {
    setResults((prev) => [
      ...prev,
      {
        questionTitle: `${current.id}: ${current.title}`,
        correct: selectedOption === quiz.correctIndex,
        difficulty: current.difficulty,
      },
    ]);

    if (isLast) {
      setShowResults(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    }
  };

  const progress = ((currentIndex + 1) / order.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between font-mono text-xs text-text-muted mb-4">
          <span>
            Question {currentIndex + 1} of {order.length}
          </span>
          <button
            type="button"
            onClick={onBackToExplorer}
            className="text-text-muted hover:text-accent transition-colors"
          >
            Exit Quiz
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={order.length}
          aria-valuenow={currentIndex + 1}
          className="h-1 overflow-hidden bg-bg-elevated"
        >
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}

      <div key={currentIndex}>
        <p className="font-mono text-sm text-accent mb-2">
          {current.id}: {current.title}
        </p>
        <h2
          id="quiz-question"
          className="mb-6 text-2xl font-medium leading-relaxed tracking-tight text-text-primary"
        >
          {quiz.question}
        </h2>

        {/* Options */}
        <div role="group" aria-labelledby="quiz-question" className="space-y-3">
          {quiz.options.map((option, i) => {
            let className =
              "w-full text-left border p-4 text-sm transition-all min-h-[48px]";

            if (!answered) {
              className +=
                selectedOption === i
                  ? " border-accent bg-accent/5 text-text-primary"
                  : " border-border-hover bg-bg-card text-text-secondary hover:border-border-hover";
            } else {
              if (i === quiz.correctIndex) {
                className += " border-success bg-success/10 text-text-primary";
              } else if (i === selectedOption && i !== quiz.correctIndex) {
                className += " border-danger bg-danger/10 text-text-primary";
              } else {
                className += " border-border-subtle bg-bg-card text-text-muted";
              }
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => !answered && setSelectedOption(i)}
                disabled={answered}
                aria-pressed={selectedOption === i}
                className={className}
              >
                <span className="flex items-start gap-3">
                  <span className="font-mono text-xs text-text-muted mt-0.5 shrink-0">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}

        {answered && (
          <div
            role="status"
            className="mt-5 border-l-2 border-accent/40 bg-bg-elevated p-5"
          >
            <p className="mb-2 text-sm font-semibold text-text-primary">
              {selectedOption === quiz.correctIndex
                ? "Correct answer."
                : "Review this one."}
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              {quiz.explanation}
            </p>
            <span
              className={`inline-block mt-2 rounded px-2.5 py-0.5 text-xs font-medium capitalize ${
                current.difficulty === "introductory"
                  ? "bg-success/10 text-success"
                  : current.difficulty === "intermediate"
                    ? "bg-warning/10 text-warning"
                    : "bg-info/10 text-info"
              }`}
            >
              {current.difficulty} question
            </span>
          </div>
        )}

        {/* Action button */}
        <div className="mt-6">
          {!answered ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="button-primary disabled:opacity-50"
            >
              Check Answer
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="button-primary disabled:opacity-50"
            >
              {isLast ? "See Results" : "Next Question"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
