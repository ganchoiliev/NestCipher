import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Prompt Injection Tester — Retired — Nest Cipher",
  description:
    "The Prompt Injection Tester is retired. It is coming back as a canary-based leak test.",
  robots: { index: false },
};

export default function PromptInjectionTesterPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">
        Prompt Injection Tester
      </h1>
      <p className="mt-6 text-lg text-text-secondary">
        Retired. Coming back as a canary-based leak test.
      </p>
      <p className="mt-4 text-text-secondary">
        In the meantime, learn how these attacks actually work in the{" "}
        <Link
          href="/tools/owasp-llm-top-10"
          className="text-accent transition-colors hover:underline"
        >
          OWASP LLM Top 10 explorer
        </Link>
        .
      </p>
    </div>
  );
}
