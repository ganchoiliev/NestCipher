import type { Metadata } from "next";
import { HeadersCompare } from "@/components/tools/HeadersCompare";

export const metadata: Metadata = {
  title: "Compare Security Headers — Nest Cipher",
  description:
    "Scan up to six websites in one pass and read their HTTP security header grades side by side.",
  openGraph: {
    title: "Compare Security Headers — Nest Cipher",
    description:
      "Scan up to six websites in one pass and read their HTTP security header grades side by side.",
    type: "website",
    url: "https://nestcipher.com/tools/headers-scanner/compare",
    siteName: "Nest Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compare Security Headers — Nest Cipher",
    description:
      "Up to six websites, one pass, grades side by side.",
  },
};

export default function HeadersComparePage() {
  return (
    <>
      <noscript>
        <p className="site-container pt-8 text-sm text-text-secondary">
          The comparison board needs JavaScript to run. Everything else on this
          site works without it.
        </p>
      </noscript>
      <HeadersCompare />
    </>
  );
}
