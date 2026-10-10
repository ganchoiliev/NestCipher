import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Brand";
import { researchLabs } from "@/lib/research-labs";
import styles from "./Labs.module.css";

export const metadata: Metadata = {
  title: "Learning Labs — Practise AI Security Research — NestCipher",
  description:
    "Practise source authority, action evidence and controlled comparisons with authored AI security exercises. Take a research question into your private workbench.",
  alternates: { canonical: "https://nestcipher.com/labs" },
  openGraph: {
    title: "Learning Labs — NestCipher",
    description: "Read the record. Make a call. Keep the reasoning.",
    url: "https://nestcipher.com/labs",
    type: "website",
  },
};

export default function LearningLabsPage() {
  return (
    <div className={`site-container ${styles.page}`}>
      <header className={styles.header}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Learning labs</span>
        </nav>
        <div className={styles.hero}>
          <div>
            <p className="eyebrow">Learning / AI security research</p>
            <h1 className={styles.title}>Learn to<br />read the evidence.</h1>
          </div>
          <p className={styles.heroCopy}>
            Small exercises for a sharper research instinct. Follow the trust
            boundary, check what actually happened, and know what a comparison
            can tell you.
          </p>
        </div>
        <p className={styles.authored}>
          <strong>Authored exercises · no model or tools run</strong>
          <span>Public, synthetic cases. No live challenge solutions.</span>
        </p>
      </header>

      <section className={styles.index} aria-labelledby="lab-index-heading">
        <div className={styles.indexBar}>
          <h2 id="lab-index-heading" className="eyebrow">The exercise index</h2>
          <span>{String(researchLabs.length).padStart(2, "0")} labs / 3 cases each</span>
        </div>
        <ol className={styles.labList}>
          {researchLabs.map((lab) => (
            <li key={lab.id} className={styles.labRow}>
              <span className={styles.number} aria-hidden="true">{lab.ordinal}</span>
              <div>
                <h2>{lab.title}</h2>
                <p className={styles.summary}>{lab.summary}</p>
              </div>
              <div className={styles.labDetail}>
                <span>What you will practise</span>
                <p>{lab.goal}</p>
                <Link
                  href={`/labs/${lab.id}`}
                  className={`button-secondary ${styles.startLink}`}
                  aria-label={`Open ${lab.title} lab`}
                >
                  Open lab <ArrowIcon />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.continuity} aria-labelledby="continuity-heading">
        <div>
          <p className="eyebrow">Read → Decide → Record</p>
          <h2 id="continuity-heading">Turn a lesson<br />into a research question.</h2>
        </div>
        <div className={styles.continuityCopy}>
          <p>
            Each lab can prepare an untested experiment with a baseline and one
            variant in the private Research Workbench. Keep your own hypothesis, exact observations and test
            conditions together as you move from practice to authorised research.
          </p>
          <p>
            Lab answers stay in this page session. Nothing is saved or sent by
            the exercises. The workbench opens separately and asks you to start.
          </p>
          <Link href="/community" className="text-link">
            Explore the field guide <ArrowIcon />
          </Link>
        </div>
      </section>
    </div>
  );
}
