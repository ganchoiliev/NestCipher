import type { Metadata } from "next";
import { OwaspExplorer } from "@/components/tools/OwaspExplorer";

export const metadata: Metadata = {
  title: "OWASP Top 10 for LLMs — Nest Cipher",
  description:
    "Interactive guide to the OWASP Top 10 for Large Language Model Applications 2025. Learn about prompt injection, data poisoning, and more AI security risks.",
  openGraph: {
    title: "OWASP Top 10 for LLMs — Nest Cipher",
    description:
      "Interactive guide to the OWASP Top 10 for LLM Applications. Learn, explore, and test your knowledge.",
    type: "website",
    url: "https://nestcipher.com/tools/owasp-llm-top-10",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "OWASP Top 10 for LLMs — Nest Cipher",
    description:
      "Interactive guide to the OWASP Top 10 for LLM Applications.",
  },
};

export default function OwaspLlmTop10Page() {
  return <OwaspExplorer />;
}
