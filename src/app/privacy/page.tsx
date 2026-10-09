import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — NestCipher",
  description:
    "What NestCipher processes, which providers are involved, and your rights.",
};

const processors = [
  {
    name: "Vercel",
    role: "Hosting and edge network",
    receives:
      "Standard request data (IP address, user agent) in transient infrastructure logs.",
  },
  {
    name: "OpenAI",
    role: "Email Analyzer model",
    receives:
      "The email content you paste into the Email Analyzer, sent for analysis. OpenAI's API data policy applies.",
  },
  {
    name: "Resend",
    role: "Newsletter delivery",
    receives: "Your email address, if you subscribe to release notes.",
  },
  {
    name: "Plausible",
    role: "Analytics",
    receives:
      "Cookieless, aggregated page-view statistics. No personal profiles.",
  },
  {
    name: "Upstash",
    role: "Rate limiting",
    receives:
      "Short-lived request counters keyed by a client identifier derived from your IP address. They expire automatically.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-mono text-3xl font-bold sm:text-4xl">Privacy</h1>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">Who is responsible</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          NestCipher is operated by GoSmartR Ltd, a company registered in
          England and Wales (company number 15407332), registered office:
          18 Howard Road, Reigate, Surrey, RH2 7JE, United Kingdom. GoSmartR
          Ltd is the data controller for this site.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">What the tools do with your input</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          NestCipher keeps no database and stores nothing you type into the
          tools. The Email Analyzer sends your pasted email to OpenAI for
          analysis and returns the result; the Headers Scanner fetches the URL
          you enter once from our server; the OWASP LLM Top 10 explorer runs
          entirely in your browser. Paste only content you are comfortable
          sending to the listed providers — redact anything you would not.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">Processors</h2>
        <div className="mt-4 space-y-4">
          {processors.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-border-subtle bg-bg-card p-4"
            >
              <p className="font-medium text-text-primary">
                {p.name}
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {p.role}
                </span>
              </p>
              <p className="mt-1 text-sm text-text-secondary">{p.receives}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">Retention</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-text-secondary leading-relaxed">
          <li>Tool inputs: not stored by NestCipher.</li>
          <li>Rate-limit counters: expire automatically within about a day.</li>
          <li>
            Newsletter address: kept until you unsubscribe (every email has an
            unsubscribe link), or on request.
          </li>
          <li>
            Infrastructure logs: held briefly by Vercel under its standard
            retention.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">Your rights</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Under UK GDPR you can ask for access to, correction of, or deletion
          of personal data we hold (in practice: your newsletter address),
          object to or restrict processing, and take your data elsewhere. You
          can also complain to the Information Commissioner&apos;s Office
          (ico.org.uk).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xl font-bold">Contact</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Privacy questions and requests:{" "}
          <a
            href="mailto:hello@nestcipher.com"
            className="text-accent hover:underline"
          >
            hello@nestcipher.com
          </a>
          . Security reports: see{" "}
          <a href="/.well-known/security.txt" className="text-accent hover:underline">
            security.txt
          </a>
          .
        </p>
      </section>
    </div>
  );
}
