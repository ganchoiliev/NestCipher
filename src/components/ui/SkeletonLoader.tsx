"use client";

import { motion } from "framer-motion";

// ── Base shimmer element ──

export function SkeletonShimmer({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

// ── Headers Scanner skeleton layout ──

export function HeadersScannerSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mt-12 flex flex-col items-center gap-6"
    >
      {/* Grade circle placeholder */}
      <SkeletonShimmer className="w-44 h-44 rounded-full" />

      {/* Score text placeholder */}
      <SkeletonShimmer className="w-32 h-4 rounded" />

      {/* Grade explanation placeholder */}
      <SkeletonShimmer className="w-56 h-3 rounded" />

      {/* Header cards placeholder */}
      <div className="w-full space-y-3 mt-8">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonShimmer key={i} className="h-24 rounded-xl w-full" />
        ))}
      </div>
    </motion.div>
  );
}
