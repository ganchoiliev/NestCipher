"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [order, setOrder] = useState<OwaspVulnerability[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questionTitle: string; correct: boolean; difficulty: Difficulty }[]>([]);
  const [showResults, setShowResults] = useState(false);

  const initQuiz = useCallback(() => {
    setOrder(shuffle(vulnerabilities));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setResults([]);
    setShowResults(false);
  }, [vulnerabilities]);

  useEffect(() => {
    initQuiz();
  }, [initQuiz]);

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
        <div className="flex justify-between text-sm text-text-muted mb-2">
          <span>Question {currentIndex + 1} of {order.length}</span>
          <button
            type="button"
            onClick={onBackToExplorer}
            className="text-text-muted hover:text-accent transition-colors"
          >
            Exit Quiz
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <p className="font-mono text-sm text-accent mb-2">
            {current.id}: {current.title}
          </p>
          <p className="text-lg text-text-primary font-medium leading-relaxed mb-6">
            {quiz.question}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {quiz.options.map((option, i) => {
              let className =
                "w-full text-left rounded-lg border p-4 text-sm transition-all min-h-[48px]";

              if (!answered) {
                className +=
                  selectedOption === i
                    ? " border-accent bg-accent/5 text-text-primary"
                    : " border-border-subtle bg-bg-card text-text-secondary hover:border-border-hover";
              } else {
                if (i === quiz.correctIndex) {
                  className += " border-[#00D4AA] bg-[#00D4AA]/10 text-text-primary";
                } else if (i === selectedOption && i !== quiz.correctIndex) {
                  className += " border-[#EF4444] bg-[#EF4444]/10 text-text-primary";
                } else {
                  className += " border-border-subtle bg-bg-card text-text-muted";
                }
              }

              return (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => !answered && setSelectedOption(i)}
                  disabled={answered}
                  whileHover={!answered ? { scale: 1.01 } : undefined}
                  whileTap={!answered ? { scale: 0.99 } : undefined}
                  className={className}
                >
                  <span className="flex items-start gap-3">
                    <span className="font-mono text-xs text-text-muted mt-0.5 shrink-0">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {option}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Explanation */}
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 border-l-2 border-accent/40 bg-bg-elevated rounded-r-lg pl-4 pr-4 py-3"
              >
                <p className="text-sm text-text-secondary leading-relaxed">{quiz.explanation}</p>
                <span className={`inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  current.difficulty === "introductory"
                    ? "bg-green-500/10 text-green-400"
                    : current.difficulty === "intermediate"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}>
                  {current.difficulty} question
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action button */}
          <div className="mt-6">
            {!answered ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={selectedOption === null}
                className="rounded-lg bg-accent px-8 py-3 text-sm font-medium text-bg-primary hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                Check Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-accent px-8 py-3 text-sm font-medium text-bg-primary hover:bg-accent-hover transition-colors"
              >
                {isLast ? "See Results" : "Next Question"}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
