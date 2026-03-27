"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "coming-soon" | "live";
  href?: string;
}

export function ToolCard({ icon, title, description, status, href }: ToolCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-accent">
          {icon}
        </div>
        {status === "coming-soon" ? (
          <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-medium text-white/50">
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
    </>
  );

  const motionProps = {
    whileHover: {
      scale: 1.02,
      borderColor: "rgba(0, 212, 170, 0.3)",
      boxShadow: "0 0 30px rgba(0, 212, 170, 0.1)",
    },
    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
    className:
      "group relative cursor-pointer rounded-xl border border-border-subtle bg-bg-card p-6 flex flex-col gap-4",
  };

  if (href) {
    return (
      <Link href={href}>
        <motion.div {...motionProps}>{content}</motion.div>
      </Link>
    );
  }

  return <motion.div {...motionProps}>{content}</motion.div>;
}
