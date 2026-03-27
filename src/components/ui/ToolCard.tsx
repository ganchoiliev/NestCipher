"use client";

import { motion } from "framer-motion";

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "coming-soon" | "live";
  href?: string;
}

export function ToolCard({ icon, title, description, status }: ToolCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, borderColor: "var(--accent)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative rounded-xl border border-border-subtle bg-bg-card p-6 flex flex-col gap-4
        hover:shadow-[0_0_30px_rgba(0,212,170,0.08)] transition-shadow duration-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-accent">
          {icon}
        </div>
        {status === "coming-soon" ? (
          <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
            Coming Soon
          </span>
        ) : (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            Launch
          </span>
        )}
      </div>
      <h3 className="font-mono text-lg font-semibold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
}
