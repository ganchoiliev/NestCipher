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

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <HeroCanvas />
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <h1 className="rise-in font-mono text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Free, Open-Source{" "}
            <span className="text-accent">AI Security Tools</span>
          </h1>
          <p
            className="rise-in mt-6 text-lg text-text-secondary sm:text-xl"
            style={{ animationDelay: "0.15s" }}
          >
            Scan. Analyze. Protect. — Open tools for developers and security professionals.
          </p>
          <div
            className="rise-in mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/tools"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-bg-primary hover:bg-accent-hover transition-colors"
            >
              Explore Tools
            </Link>
            <a
              href="/#newsletter"
              className="rounded-lg border border-border-hover px-8 py-3 font-medium text-text-primary hover:border-accent hover:text-accent transition-colors"
            >
              Join Newsletter
            </a>
          </div>
        </div>
      </section>

      {/* ── Tools Grid ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
        <div className="rise-in mb-12 flex items-center gap-4">
          <h2 className="font-mono text-2xl font-bold sm:text-3xl">Security Toolkit</h2>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <div
              key={tool.title}
              className="rise-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <ToolCard {...tool} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Newsletter ── */}
      <section id="newsletter" className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
        <div className="rise-in rounded-2xl border border-border-subtle bg-bg-card p-8 sm:p-12 text-center">
          <h2 className="font-mono text-2xl font-bold sm:text-3xl">Stay sharp.</h2>
          <p className="mt-4 text-text-secondary">
            Release notes, a few times a year. Unsubscribe anytime.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Your address goes to Resend to send you the emails — see the{" "}
            <Link href="/privacy" className="underline hover:text-accent">
              privacy page
            </Link>
            .
          </p>
          <div className="relative mt-8">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
