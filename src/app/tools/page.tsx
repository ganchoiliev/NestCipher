"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ToolCard } from "@/components/ui/ToolCard";
import { ShieldIcon, ScanIcon, BookIcon } from "@/components/ui/icons";

const categories = ["All", "Scanners", "AI Tools", "Learning"] as const;

const tools = [
  {
    icon: <ShieldIcon />,
    title: "AI Email Analyzer",
    description: "Paste a suspicious email. Get an AI-powered threat breakdown in seconds.",
    status: "live" as const,
    href: "/tools/email-analyzer",
  },
  {
    icon: <ScanIcon />,
    title: "Security Headers Scanner",
    description: "Enter any URL. Get an instant security grade with actionable fixes.",
    status: "live" as const,
    href: "/tools/headers-scanner",
  },
  {
    icon: <BookIcon />,
    title: "OWASP LLM Top 10",
    description: "Interactive explorer of the most critical AI security vulnerabilities.",
    status: "live" as const,
    href: "/tools/owasp-llm-top-10",
  },
];

export default function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-text-muted">
        <Link href="/" className="hover:text-accent transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Tools</span>
      </nav>

      <h1 className="font-mono text-3xl font-bold sm:text-4xl">Security Toolkit</h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        Free, open tools to help developers and security professionals scan, analyze, and protect.
      </p>

      {/* Category tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-accent text-bg-primary"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tools grid */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, i) => (
          <motion.div
            key={tool.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <ToolCard {...tool} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
