import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Hall of Fame — NestCipher",
  description:
    "Researchers who reported security issues in NestCipher, with thanks.",
};

export default function SecurityThanksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">
        Security Hall of Fame
      </h1>
      <p className="mt-6 text-text-secondary leading-relaxed">
        Researchers who took the time to report a valid security issue in
        NestCipher, credited with thanks. How to report:{" "}
        <a
          href="/.well-known/security.txt"
          className="text-accent hover:underline"
        >
          security.txt
        </a>
        .
      </p>
      <div className="mt-10 rounded-lg border border-border-subtle bg-bg-card p-8 text-center">
        <p className="text-text-secondary">
          No entries yet. Be the first — good-faith research is welcome.
        </p>
      </div>
    </div>
  );
}
