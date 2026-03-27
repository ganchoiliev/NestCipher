import type { Metadata } from "next";
import { EmailAnalyzer } from "@/components/tools/EmailAnalyzer";

export const metadata: Metadata = {
  title: "AI Email Analyzer — Phishing Detection — Nest Cipher",
  description:
    "Paste a suspicious email and get an AI-powered threat analysis in seconds. Free, no sign-up required.",
  openGraph: {
    title: "AI Email Analyzer — Nest Cipher",
    description:
      "Paste a suspicious email and get an AI-powered phishing threat analysis in seconds.",
    type: "website",
    url: "https://nestcipher.com/tools/email-analyzer",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Email Analyzer — Nest Cipher",
    description:
      "AI-powered phishing detection. Paste an email, get a threat score.",
  },
};

export default function EmailAnalyzerPage() {
  return <EmailAnalyzer />;
}
