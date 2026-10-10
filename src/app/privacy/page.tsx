import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — NestCipher",
  description:
    "What NestCipher processes, which providers are involved, and your rights.",
};

const processors = [
  {
    name: "Supabase",
    role: "Optional research account and encrypted backup",
    receives:
      "Your account email, authentication and request information, and encrypted saved-vault snapshots when you explicitly back up. Snapshot identifiers, size, record count and upload time are visible; titles, research contents and disclosure notes are encrypted. Your vault passphrase is never sent.",
  },
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
      "Cookieless, aggregated page-view statistics on other site pages. Plausible is omitted from the Research Workbench document.",
  },
  {
    name: "Vercel BotID",
    role: "Bot protection for paid or write actions",
    receives:
      "Browser and request signals for protected actions such as email analysis and newsletter subscription. Its client SDK is not imported or initialized on the Research Workbench document.",
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
    <div className="site-container max-w-3xl py-12 sm:py-16">
      <h1 className="page-title">Privacy</h1>

      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight">Who is responsible</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          NestCipher is operated by GoSmartR Ltd, a company registered in
          England and Wales (company number 15407332), registered office:
          18 Howard Road, Reigate, Surrey, RH2 7JE, United Kingdom. GoSmartR
          Ltd is the data controller for this site.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight">What the tools do with your input</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          The Email
          Analyzer sends your pasted email to OpenAI for
          analysis and returns the result; the Headers Scanner fetches the URL
          you enter once from our server; the OWASP LLM Top 10 explorer runs
          entirely in your browser. The Research Workbench processes its
          session content locally and makes no model API calls. Optional
          account backup stores encrypted saved-vault snapshots on Supabase;
          working drafts are not uploaded. Paste only
          content you are comfortable
          sending to the listed providers — redact anything you would not.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight">Private research sessions</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Research starts in the current page&apos;s memory. You can explicitly
          save it to an encrypted local vault in this browser, unlocked with
          your passphrase. Titles and record contents are encrypted before
          storage. The passphrase is not saved or sent to a server. There is no
          autosave or automatic sync. Optional account backup uploads only
          saved encrypted records after you choose to back up. Account sign-in
          and recovery do not unlock a vault or recover its passphrase. Keep
          a private backup;
          clearing browser data, storage eviction or a forgotten passphrase
          can make saved records unavailable.
        </p>
        <p className="mt-4 text-text-secondary leading-relaxed">
          The workbench does not send research to analytics or BotID. Cloud
          backup is explicit and contains encrypted records, with a limit of
          3 MiB per account snapshot. Private search runs in the unlocked
          browser. Encryption protects stored content; it does not protect an
          unlocked page from compromised site code or device access. Other
          scripts on this site&apos;s origin can access or delete encrypted
          storage. Locking clears the workbench&apos;s open record and key
          references, but does not guarantee erasure from device memory.
          Normal hosting request logs still apply to loading the page.
        </p>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Experiment Markdown notes, JSON backups and report snapshots are unencrypted
          private downloads. An Email Analyzer or Headers Scanner result can
          be downloaded and attached to an attempt without running the tool
          again. Snapshots contain the returned report, which may quote
          sensitive material, and exclude the original email input. An encrypted
          cloud archive needs the original vault passphrase for restoration. Private
          exports remain available while a challenge is live and during its
          waiting period. Review their contents before moving or sharing files.
        </p>
        <p className="mt-4 text-text-secondary leading-relaxed">
          NestCipher&apos;s site policy keeps details of how a live challenge was
          broken private until 30 days after the challenge ends. This is a
          project policy based on a rule provided by the owner; NestCipher has
          not independently verified it as an organiser&apos;s official rule.
          Check the terms of each challenge. This release provides no public
          sharing or submission capability, including after the waiting period.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight">Processors</h2>
        <div className="mt-4 space-y-4">
          {processors.map((p) => (
            <div
              key={p.name}
              className="rounded-sm border border-border-subtle bg-bg-card p-4"
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
        <h2 className="text-xl font-medium tracking-tight">Retention</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-text-secondary leading-relaxed">
          <li>Tool inputs: not stored by NestCipher.</li>
          <li>Research Workbench drafts: current page memory, with no autosave.</li>
          <li>Opt-in local vault: encrypted records remain in this browser until you delete them or browser storage is cleared or evicted. NestCipher cannot recover them.</li>
          <li>Optional research account: email and authentication records remain until the account is deleted on request. Essential account session cookies support sign-in and contain no vault passphrase.</li>
          <li>Optional cloud backup: one encrypted snapshot remains until you explicitly replace or delete it, or the account is deleted. Supabase infrastructure backups may retain earlier encrypted copies under its retention policy.</li>
          <li>Downloaded private files: remain on your device until you delete them.</li>
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
        <h2 className="text-xl font-medium tracking-tight">Your rights</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Under UK GDPR you can ask for access to, correction of, or deletion
          of personal data we hold, including newsletter and optional research
          account information,
          object to or restrict processing, and take your data elsewhere. You
          can also complain to the Information Commissioner&apos;s Office
          (ico.org.uk).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium tracking-tight">Contact</h2>
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
