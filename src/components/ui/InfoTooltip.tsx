"use client";

import { useRef, useEffect, useState, useCallback, useId } from "react";

interface InfoTooltipProps {
  text: string;
  label?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function InfoTooltip({
  text,
  label = "More info",
  isOpen,
  onToggle,
}: InfoTooltipProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        onToggle();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onToggle();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onToggle]);

  const checkOverflow = useCallback(() => {
    if (tooltipRef.current)
      setAlignRight(
        tooltipRef.current.getBoundingClientRect().right >
          window.innerWidth - 8,
      );
  }, []);

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(checkOverflow);
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen, checkOverflow]);

  return (
    <div ref={wrapperRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? tooltipId : undefined}
        aria-describedby={isOpen ? tooltipId : undefined}
        className={`inline-flex h-11 w-11 items-center justify-center rounded transition-colors ${isOpen ? "bg-bg-elevated text-accent" : "text-text-muted hover:text-text-primary"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          className="h-4 w-4"
        >
          <circle cx="8" cy="8" r="6.5" />
          <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {isOpen && (
        <div
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          className={`absolute top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border-hover bg-bg-elevated px-4 py-3 text-sm leading-relaxed text-text-secondary shadow-sm ${alignRight ? "right-0" : "left-0"}`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
