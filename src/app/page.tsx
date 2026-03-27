"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { HeroCanvas } from "@/components/ui/HeroCanvas";
import { ToolCard } from "@/components/ui/ToolCard";
import { NewsletterForm } from "@/components/ui/NewsletterForm";
import { ShieldIcon, ScanIcon, BookIcon } from "@/components/ui/icons";

const tools = [
  {
    icon: <ShieldIcon />,
    title: "AI Email Analyzer",
    description: "Paste a suspicious email. Get an AI-powered threat breakdown in seconds.",
    status: "coming-soon" as const,
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
    status: "coming-soon" as const,
  },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <HeroCanvas />
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-mono text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
          >
            Free AI-Powered{" "}
            <span className="text-accent">Security Tools</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-lg text-text-secondary sm:text-xl"
          >
            Scan. Analyze. Protect. — Open tools for developers and security professionals.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/tools"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-bg-primary hover:bg-accent-hover transition-colors"
            >
              Explore Tools
            </Link>
            <a
              href="#newsletter"
              className="rounded-lg border border-border-hover px-8 py-3 font-medium text-text-primary hover:border-accent hover:text-accent transition-colors"
            >
              Join Newsletter
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Tools Grid ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="mb-12 flex items-center gap-4"
        >
          <h2 className="font-mono text-2xl font-bold sm:text-3xl">Security Toolkit</h2>
          <div className="flex-1 h-px bg-border-subtle" />
        </motion.div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>

      {/* ── Newsletter ── */}
      <section id="newsletter" className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-border-subtle bg-bg-card p-8 sm:p-12 text-center"
        >
          <h2 className="font-mono text-2xl font-bold sm:text-3xl">Stay sharp.</h2>
          <p className="mt-4 text-text-secondary">
            Weekly AI security insights. No spam. Unsubscribe anytime.
          </p>
          <div className="relative mt-8">
            <NewsletterForm />
          </div>
        </motion.div>
      </section>
    </>
  );
}
