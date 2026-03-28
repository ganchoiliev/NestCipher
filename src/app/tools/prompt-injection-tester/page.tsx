import type { Metadata } from "next";
import { PromptInjectionTester } from "@/components/tools/PromptInjectionTester";

export const metadata: Metadata = {
  title: "Prompt Injection Tester — Test Your LLM System Prompt — Nest Cipher",
  description:
    "Test your AI system prompt against 12 known injection attacks. Get a resilience score and hardening recommendations. Free, no sign-up required.",
  openGraph: {
    title: "Prompt Injection Tester — Nest Cipher",
    description:
      "Test your AI system prompt against known injection attacks and get hardening recommendations.",
    type: "website",
    url: "https://nestcipher.com/tools/prompt-injection-tester",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Injection Tester — Nest Cipher",
    description:
      "Test your AI system prompt against 12 known injection attacks. Get a resilience score.",
  },
};

export default function PromptInjectionTesterPage() {
  return <PromptInjectionTester />;
}
