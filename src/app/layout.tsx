import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nestcipher.com"),
  title: "Nest Cipher — Free AI-Powered Security Tools",
  description:
    "Free security toolkit for developers. Scan headers, detect phishing, and explore the OWASP LLM Top 10. No sign-ups, no ads, no cookies.",
  openGraph: {
    title: "Nest Cipher — Free AI-Powered Security Tools",
    description:
      "Free security toolkit for developers. Scan headers, detect phishing, and explore the OWASP LLM Top 10. No sign-ups, no ads, no cookies.",
    url: "https://nestcipher.com",
    siteName: "Nest Cipher",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nest Cipher — Free AI-Powered Security Tools",
    description:
      "Free security toolkit for developers. Scan headers, detect phishing, and explore the OWASP LLM Top 10.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "256x256", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  alternates: {
    canonical: "https://nestcipher.com",
  },
};

// Nonce-based CSP requires per-request rendering (docs/DECISIONS.md).
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Nest Cipher",
              url: "https://nestcipher.com",
              description: "Free AI-powered security toolkit for developers and security professionals.",
              applicationCategory: "SecurityApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
              author: { "@type": "Organization", name: "GoSmartR", url: "https://gosmartr.co.uk" },
            }),
          }}
        />
        <Script
          src="https://plausible.io/js/pa-FOyFgrwIcEk2zlKADZTcX.js"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <Script id="plausible-init" strategy="afterInteractive" nonce={nonce}>
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider nonce={nonce}>
          <Navbar />
          <main className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
