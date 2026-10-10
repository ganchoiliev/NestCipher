import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Brand";
import styles from "../community/FieldGuide.module.css";

export const metadata: Metadata = {
  title: "About — The Project & Design Process — NestCipher",
  description:
    "The independent security toolkit built by Gancho: its purpose, design process, engineering decisions and open-source implementation.",
  alternates: { canonical: "https://nestcipher.com/about" },
};

const techStack = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Vercel",
  "OpenAI",
];
const sourceUrl = "https://github.com/ganchoiliev/NestCipher";

export default function AboutPage() {
  return (
    <div className={"site-container " + styles.aboutPage}>
      <header className={"page-header " + styles.aboutHeader}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">About</span>
        </nav>
        <p className="eyebrow mt-8">Independent project / Open source</p>
        <h1 className={styles.aboutTitle}>
          Behind
          <br />
          the toolkit.
        </h1>
        <p className={"page-description " + styles.guideDescription}>
          Practical security tools, built to be used. A free, open toolkit for
          developers, security researchers, and red teamers.
        </p>
      </header>

      <div className={styles.aboutLayout}>
        <div>
          <section
            aria-labelledby="mission-heading"
            className={styles.caseSection}
          >
            <p className="eyebrow">01 / The purpose</p>
            <h2 id="mission-heading">
              Useful tools should
              <br />
              be within reach.
            </h2>
            <p className={styles.caseCopy}>
              NestCipher is a free, open security toolkit. Developers and
              security researchers should be able to inspect an email, review a
              website&apos;s security headers, or learn about LLM risks without
              a paywall or an account.
            </p>
            <p className={styles.caseCopy}>
              The aim is to make the evidence easier to examine: show what was
              observed, explain why it matters, and give the next step a clear
              place in the interface.
            </p>
            <Link href="/tools" className="button-secondary">
              Explore the toolkit <ArrowIcon />
            </Link>
          </section>

          <section
            aria-labelledby="creator-heading"
            className={styles.caseSection}
          >
            <p className="eyebrow">02 / The person behind it</p>
            <h2 id="creator-heading">Built by Gancho.</h2>
            <p className={styles.caseCopy}>
              I&apos;m Gancho — a web developer and cybersecurity enthusiast
              based in Surrey, UK. I built NestCipher because I wanted free,
              well-designed security tools that don&apos;t gate useful
              functionality behind sign-ups or paywalls. Every tool here is
              something I&apos;d actually use myself.
            </p>
          </section>

          <section
            aria-labelledby="design-heading"
            className={styles.caseSection}
          >
            <p className="eyebrow">03 / A design case study</p>
            <h2 id="design-heading">
              An identity with
              <br />
              something to show.
            </h2>
            <p className={styles.caseCopy}>
              The redesign had two jobs: make the existing tools easier to use
              and give the project a distinctive identity that could stand as a
              portfolio piece. That required more than changing an accent
              colour.
            </p>
            <ol className={styles.processList}>
              <li>
                <span className={styles.processNumber} aria-hidden="true">
                  01
                </span>
                <div>
                  <h3>Question the first answers.</h3>
                  <p>
                    Two initial directions were rejected: a graphite and citron
                    editorial layout, then an orange technical workbench. Both
                    helped clarify the brief: a bolder identity, recognisable
                    typography, and evidence of real craft.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.processNumber} aria-hidden="true">
                  02
                </span>
                <div>
                  <h3>Study the original sources.</h3>
                  <p>
                    <a
                      href="https://www.pentagram.com/work/oxide"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pentagram&apos;s Oxide identity
                    </a>{" "}
                    shows how a technical visual language can extend across a
                    product.{" "}
                    <a
                      href="https://pair.withgoogle.com/explorables/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google PAIR&apos;s Explorables
                    </a>{" "}
                    show how an interaction can explain a relationship. The
                    lesson for NestCipher was to connect its identity to
                    something visitors can inspect.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.processNumber} aria-hidden="true">
                  03
                </span>
                <div>
                  <h3>Build three real alternatives.</h3>
                  <p>
                    Signal, Evidence Bureau, and Cipher Atlas explored different
                    type, colour, and composition. Each prototype used the same
                    three tool destinations and working synthetic email
                    examples, so the comparison could focus on the design.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.processNumber} aria-hidden="true">
                  04
                </span>
                <div>
                  <h3>Choose Signal. Carry it through.</h3>
                  <p>
                    Signal was selected for its bold condensed type, solid lime
                    and ink planes, and geometric boundary mark. Barlow
                    Condensed gives the identity its voice; Barlow and DM Mono
                    keep the reading and evidence clear. The selected system is
                    integrated across the toolkit and field guide.
                  </p>
                </div>
              </li>
            </ol>
            <div className={styles.reviewRecord}>
              <span className={styles.reviewLabel}>
                Prototype review / measured implementation checks
              </span>
              <p>
                <strong>206 scoped checks passed</strong> across the three
                concepts and comparison board. They covered responsive geometry,
                control sizes, contrast, fixture output, keyboard state, reduced
                motion, and readable defaults without JavaScript.
              </p>
              <p>
                These are prototype implementation checks. No participant user
                study was run. The integrated application is verified separately
                with production builds and browser tests for navigation,
                filtering, tool handoff, report display, and keyboard
                interaction.
              </p>
            </div>
            <p className={styles.caseCopy}>
              The example inspector runs the toolkit&apos;s deterministic email
              prepass on clearly labelled synthetic inputs. It makes the source,
              displayed text, destination, and findings visible. A flag is
              evidence to investigate, rather than a final verdict.
            </p>
          </section>

          <section
            aria-labelledby="craft-heading"
            className={styles.caseSection}
          >
            <p className="eyebrow">04 / Under the hood</p>
            <h2 id="craft-heading">The details matter.</h2>
            <p className={styles.caseCopy}>
              Interface design, application development, and security
              engineering meet in the finished tools. These are concrete
              implementation choices that can be examined in the source.
            </p>
            <div className={styles.craftRows}>
              <div>
                <span className="eyebrow">01 / Request boundaries</span>
                <h3>Inspect a URL without trusting it.</h3>
                <p>
                  The headers scanner checks destinations before fetching them,
                  using SSRF safeguards to restrict access to private network
                  addresses. A per-request nonce and content security policy
                  define the site&apos;s script boundary.
                </p>
              </div>
              <div>
                <span className="eyebrow">02 / Structured analysis</span>
                <h3>Turn a response into a usable report.</h3>
                <p>
                  Email analysis uses a validated response schema. The interface
                  presents a score alongside the reasons and recommendations,
                  and renders returned content as text.
                </p>
              </div>
              <div>
                <span className="eyebrow">03 / Interface resilience</span>
                <h3>Make the small interactions hold up.</h3>
                <p>
                  Search and filters work together. Reports handle long values
                  on small screens. Reference content renders before JavaScript,
                  with keyboard focus, labelled inputs, and clear status
                  messages.
                </p>
              </div>
              <div>
                <span className="eyebrow">04 / Private research continuity</span>
                <h3>Carry the evidence without losing the context.</h3>
                <p>
                  The Research Workbench keeps historical conditions beside
                  exact inputs and observations. Explicit encrypted local
                  saving, validated backups, report attachments and private
                  Markdown exports support longer sessions. Concurrent save
                  checks and draft replacement controls protect ongoing work.
                  Encryption protects stored content; it does not protect an
                  unlocked page from compromised code.
                </p>
              </div>
              <div>
                <span className="eyebrow">05 / Inspectable teaching</span>
                <h3>Make the reasoning part of the interface.</h3>
                <p>
                  Three authored labs turn source authority, action evidence
                  and controlled comparisons into decisions a visitor can
                  inspect. An exact permission check, a revealed action record
                  and explicit unknown conditions make each lesson concrete.
                  Prepared private experiments carry the question forward with
                  empty observations. These invented examples teach a method;
                  they do not claim to measure a model&apos;s robustness.
                </p>
                <Link href="/labs" className="text-link">Explore the learning labs <ArrowIcon /></Link>
              </div>
            </div>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Explore the implementation <ArrowIcon diagonal />
            </a>
          </section>

          <section
            aria-labelledby="contact-heading"
            className={styles.caseSection}
          >
            <p className="eyebrow">05 / Keep it useful</p>
            <h2 id="contact-heading">
              Feedback shapes
              <br />
              what comes next.
            </h2>
            <p className={styles.caseCopy}>
              Got feedback, ideas, or just want to say hi? Reach out at{" "}
              <a href="mailto:hello@nestcipher.com">hello@nestcipher.com</a>.
            </p>
          </section>
        </div>

        <aside className={styles.projectAside}>
          <section
            className={styles.projectNotes}
            aria-labelledby="project-notes-heading"
          >
            <h2 id="project-notes-heading" className="eyebrow">
              Project notes
            </h2>
            <dl>
              <div>
                <dt>Access</dt>
                <dd>Free to use</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>MIT</dd>
              </div>
              <div>
                <dt>Based in</dt>
                <dd>Surrey, UK</dd>
              </div>
            </dl>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              View the source <ArrowIcon diagonal />
            </a>
          </section>
          <section
            className={styles.stackSection}
            aria-labelledby="stack-heading"
          >
            <h2 id="stack-heading" className="eyebrow">
              Built with
            </h2>
            <ul className={styles.stackList}>
              {techStack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </section>
          <p className={styles.asideNote}>
            NestCipher is an independent project. Gray Swan and the projects
            linked in the field guide are separate organisations. Suggestions
            and good-faith security research are welcome.
          </p>
        </aside>
      </div>
    </div>
  );
}
