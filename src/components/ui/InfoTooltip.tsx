"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InfoTooltipProps {
  text: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function InfoTooltip({ text, isOpen, onToggle }: InfoTooltipProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  // Check viewport overflow and flip alignment
  const checkOverflow = useCallback(() => {
    if (!tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      setAlignRight(true);
    } else {
      setAlignRight(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Wait for render then check
      requestAnimationFrame(checkOverflow);
    }
  }, [isOpen, checkOverflow]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        aria-label="More info"
        className={`inline-flex items-center justify-center w-4 h-4 transition-colors ${
          isOpen ? "text-accent" : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-4 h-4"
        >
          <circle cx="8" cy="8" r="6.5" />
          <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-1.5 z-50 max-w-[280px] rounded-lg border border-border-subtle bg-bg-elevated p-3 text-sm text-text-secondary shadow-lg ${
              alignRight ? "right-0" : "left-0"
            }`}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
