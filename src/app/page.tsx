import Link from "next/link";
import { NewsletterForm } from "@/components/ui/NewsletterForm";
import { ToolLauncher } from "@/components/ui/ToolLauncher";
import { EvidenceInspector } from "@/components/ui/EvidenceInspector";
import { ArrowIcon, BoundaryFigure } from "@/components/ui/Brand";
import { tools } from "@/data/tools";
import styles from "./Home.module.css";

export default function Home() {
  return (
    <>
      <section className={`site-container ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Independent tools / Open access</p>
          <h1>
            LOOK
            <br />
            <span>CLOSER.</span>
          </h1>
          <p className={styles.intro}>
            Question the input.
            <br />
            Understand the risk. Follow the evidence.
          </p>
          <div className={styles.actions}>
            <Link href="/tools" className={styles.primary}>
              OPEN THE TOOLKIT <ArrowIcon />
            </Link>
            <a
              href="https://github.com/ganchoiliev/nestcipher"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              View the source <ArrowIcon diagonal />
            </a>
          </div>
          <p className={styles.access}>
            FREE TO USE <span aria-hidden="true">/</span> NO ACCOUNT{" "}
            <span aria-hidden="true">/</span> OPEN SOURCE
          </p>
        </div>
        <BoundaryFigure className={styles.boundary} />
      </section>

      <section
        className={`site-container ${styles.tools}`}
        aria-labelledby="tools-heading"
      >
        <div className={styles.sectionLine}>
          <h2 id="tools-heading">01 / THE TOOLKIT</h2>
          <p>{tools.length} WAYS TO LOOK CLOSER</p>
        </div>
        {tools.map((tool, index) => {
          const ToolLink = tool.id === "research-workbench" ? "a" : Link;
          return <ToolLink key={tool.id} href={tool.href} className={styles.toolRow}>
            <span className={styles.toolNumber}>0{index + 1}</span>
            <div>
              <h3>{tool.title}</h3>
              <p>
                {tool.description}
                <span>
                  {tool.category === "ai-tools"
                    ? "AI-assisted analysis"
                    : tool.category === "scanners"
                      ? "Live header checks"
                      : tool.category === "research"
                        ? "Private session notes"
                        : "Learn & practise"}
                </span>
              </p>
            </div>
            <ArrowIcon diagonal />
          </ToolLink>;
        })}
        <p className={styles.dataNote}>
          Clear inputs. Useful findings.{" "}
          <Link href="/privacy">Transparent data handling ↗</Link>
        </p>
      </section>

      <section
        className={`site-container ${styles.launcher}`}
        aria-labelledby="quick-start-heading"
      >
        <div className={styles.launcherIntro}>
          <p className="eyebrow">02 / Quick start</p>
          <h2 id="quick-start-heading" className="section-heading">
            Start with a target.
          </h2>
        </div>
        <ToolLauncher />
      </section>

      <EvidenceInspector />

      <section className={styles.guide} aria-labelledby="guide-heading">
        <div className={`site-container ${styles.guideInner}`}>
          <div>
            <p className={styles.guideEyebrow}>04 / THE FIELD GUIDE</p>
            <h2 id="guide-heading">
              GOOD RESEARCH
              <br />
              STARTS WITH
              <br />A BETTER QUESTION.
            </h2>
          </div>
          <div>
            <p>
              Learn to question the evidence. Explore three authored labs,
              prepare a private experiment, and carry your research into your
              own notes.
            </p>
            <Link href="/labs" className={styles.guideLink}>
              EXPLORE THE LABS <ArrowIcon diagonal />
            </Link>
            <Link href="/community" className={styles.guideLink}>
              OPEN THE FIELD GUIDE <ArrowIcon diagonal />
            </Link>
            <span className={styles.guideNote}>
              Invented teaching examples. Independent of Gray Swan.
            </span>
          </div>
        </div>
      </section>

      <section
        id="newsletter"
        className={`site-container ${styles.newsletter}`}
        aria-labelledby="newsletter-heading"
      >
        <div>
          <p className="eyebrow">05 / Project updates</p>
          <h2 id="newsletter-heading" className="section-heading">
            The occasional dispatch.
          </h2>
          <p>New tools and release notes, a few times a year.</p>
        </div>
        <div className={styles.newsletterForm}>
          <NewsletterForm />
          <p>
            Your address goes to Resend for delivery.{" "}
            <Link href="/privacy">Privacy notes ↗</Link>
          </p>
        </div>
      </section>
    </>
  );
}
