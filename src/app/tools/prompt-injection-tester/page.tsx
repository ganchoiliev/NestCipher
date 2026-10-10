import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Prompt Injection Tester — Retired — Nest Cipher",
  description: "The Prompt Injection Tester is retired. It is coming back as a canary-based leak test.",
  robots: { index: false },
};

export default function PromptInjectionTesterPage() {
  return (
    <div className="site-container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/tools">Tools</Link><span aria-hidden="true">/</span><span aria-current="page">Prompt Injection Tester</span></nav>
      <header className="page-header"><p className="eyebrow">Tool status / Retired</p><h1 className="page-title">Prompt Injection Tester</h1><p className="page-description">Retired. Coming back as a canary-based leak test.</p></header>
      <section className="tool-workspace max-w-3xl"><p className="text-base leading-relaxed text-text-secondary">In the meantime, learn how these attacks actually work in the OWASP LLM Top 10 explorer.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/tools/owasp-llm-top-10" className="button-primary">Open the reference <span aria-hidden="true">↗</span></Link><Link href="/tools" className="button-secondary">All tools</Link></div></section>
    </div>
  );
}
