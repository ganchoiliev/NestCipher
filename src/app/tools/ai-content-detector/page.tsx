import type { Metadata } from "next";
import { AIContentDetector } from "@/components/tools/AIContentDetector";

export const metadata: Metadata = {
  title: "AI Content Detector — Detect AI-Generated Text — Nest Cipher",
  description:
    "Paste any text and detect whether it was written by AI. Free, detailed analysis with sentence-level highlighting and 5 detection signals.",
  openGraph: {
    title: "AI Content Detector — Nest Cipher",
    description:
      "Paste any text and detect whether it was written by AI. Free, detailed analysis with sentence-level highlighting and 5 detection signals.",
    type: "website",
    url: "https://nestcipher.com/tools/ai-content-detector",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Content Detector — Nest Cipher",
    description:
      "Paste any text and detect whether it was written by AI. Free, detailed analysis with sentence-level highlighting and 5 detection signals.",
  },
};

export default function AIContentDetectorPage() {
  return <AIContentDetector />;
}
