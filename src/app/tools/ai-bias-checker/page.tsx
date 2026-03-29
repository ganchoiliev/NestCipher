import type { Metadata } from "next";
import { AIBiasChecker } from "@/components/tools/AIBiasChecker";

export const metadata: Metadata = {
  title: "AI Bias Checker — Detect Bias in AI Outputs — Nest Cipher",
  description:
    "Analyze AI-generated text for demographic bias, stereotyping, and representation gaps. Free, detailed analysis with actionable suggestions.",
  openGraph: {
    title: "AI Bias Checker — Nest Cipher",
    description:
      "Analyze AI-generated text for demographic bias, stereotyping, and representation gaps. Free, detailed analysis with actionable suggestions.",
    type: "website",
    url: "https://nestcipher.com/tools/ai-bias-checker",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Bias Checker — Nest Cipher",
    description:
      "Analyze AI-generated text for demographic bias, stereotyping, and representation gaps. Free, detailed analysis with actionable suggestions.",
  },
};

export default function AIBiasCheckerPage() {
  return <AIBiasChecker />;
}
