import type { Metadata } from "next";
import { HeadersScanner } from "@/components/tools/HeadersScanner";

export const metadata: Metadata = {
  title: "Security Headers Scanner — Nest Cipher",
  description:
    "Enter any URL. Get an instant security grade with actionable fixes for your HTTP security headers.",
  openGraph: {
    title: "Security Headers Scanner — Nest Cipher",
    description:
      "Enter any URL. Get an instant security grade with actionable fixes for your HTTP security headers.",
    type: "website",
    url: "https://nestcipher.com/tools/headers-scanner",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "Security Headers Scanner — Nest Cipher",
    description:
      "Enter any URL. Get an instant security grade with actionable fixes.",
  },
};

export default function HeadersScannerPage() {
  return <HeadersScanner />;
}
