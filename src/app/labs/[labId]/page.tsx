import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/ui/Brand";
import { ResearchLab } from "@/components/learning/ResearchLab";
import { getResearchLab, type LabCase } from "@/lib/research-labs";
import styles from "../Labs.module.css";

type LabPageProps = { params: Promise<{ labId: string }> };

export async function generateMetadata({ params }: LabPageProps): Promise<Metadata> {
  const { labId } = await params;
  const lab = getResearchLab(labId);
  if (!lab) notFound();
  return {
    title: `${lab.title} — Learning Lab — NestCipher`,
    description: lab.summary,
    alternates: { canonical: `https://nestcipher.com/labs/${lab.id}` },
    openGraph: {
      title: `${lab.title} — NestCipher Learning Labs`,
      description: lab.summary,
      url: `https://nestcipher.com/labs/${lab.id}`,
      type: "website",
    },
  };
}

function WorkbookCase({ labCase, index }: { labCase: LabCase; index: number }) {
  const expectedChoice = labCase.choices.find((choice) => choice.id === labCase.correctChoiceId);
  return (
    <article className={styles.workbookCase}>
      <h3>{String(index + 1).padStart(2, "0")} / {labCase.title}</h3>
      <p>{labCase.summary}</p>
      {labCase.panels.map((panel, panelIndex) => (
        <div key={panelIndex}><h4>{panel.label}</h4><pre>{panel.text}</pre></div>
      ))}
      {labCase.comparison && (
        <div>
          <h4>Recorded conditions</h4>
          {labCase.comparison.map((row) => (
            <p key={row.label}><strong>{row.label}</strong><br />Baseline: {row.baseline ?? "Unknown"}<br />Variant: {row.variant ?? "Unknown"}</p>
          ))}
        </div>
      )}
      {labCase.trace && (
        <details className={styles.workbookAnswer}>
          <summary>Read the authored action record</summary>
          {labCase.trace.map((entry, entryIndex) => <div key={entryIndex}><h4>{entry.label} / {entry.state}</h4><pre>{entry.text}</pre></div>)}
        </details>
      )}
      <h4>Choose a decision</h4>
      <ol>{labCase.choices.map((choice) => <li key={choice.id}>{choice.label}</li>)}</ol>
      <details className={styles.workbookAnswer}>
        <summary>Read the explanation for this complete record</summary>
        <p><strong>{expectedChoice?.label}</strong></p>
        <p>{labCase.explanation}</p>
        <p>{labCase.conclusion}</p>
      </details>
    </article>
  );
}

export default async function LearningLabPage({ params }: LabPageProps) {
  const { labId } = await params;
  const lab = getResearchLab(labId);
  if (!lab) notFound();
  return (
    <div className={`site-container ${styles.page}`}>
      <header className={styles.labHeader}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/labs">Learning labs</Link><span aria-hidden="true">/</span>
          <span aria-current="page">Lab {lab.ordinal}</span>
        </nav>
        <div className={styles.labHeading}>
          <div>
            <p className="eyebrow">Lab {lab.ordinal} / Authored practice</p>
            <h1>{lab.title}</h1>
            <p className={styles.labSummary}>{lab.summary}</p>
          </div>
          <p className={styles.goal}><span>What you will practise</span>{lab.goal}</p>
        </div>
      </header>

      <p className={styles.noScript}>
        Prefer a reading version? The <a href="#exercise-workbook">complete exercise workbook</a>
        {" "}contains all three authored cases and their explanations, with or
        without JavaScript. The interactive review needs JavaScript.
      </p>
      <ResearchLab key={lab.id} lab={lab} />

      <section className={styles.belowLab} aria-labelledby="lab-followup-heading">
        <div>
          <p className="eyebrow">From practice to a private record</p>
          <h2 id="lab-followup-heading">Keep the question.<br />Bring your own evidence.</h2>
          <p>
            Prepare an untested baseline and variant in the Research Workbench.
            A separate tab keeps your current workspace in place. Your choices,
            reviews and authored action records are not copied into results.
          </p>
          <a href={`/tools/research-workbench?lab=${lab.id}`} target="_blank" rel="noopener noreferrer" className={`button-primary ${styles.handoffLink}`}>
            Prepare in Workbench <ArrowIcon diagonal />
          </a>
          <p>The workbench opens in a new tab and asks you to start the lab setup. Review its scope before any real testing.</p>
        </div>
        <div>
          <p className="eyebrow">Read the primary sources</p>
          <h2>Go deeper.</h2>
          <ul className={styles.sources}>
            {lab.sources.map((source) => (
              <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link">{source.title} <ArrowIcon diagonal /></a></li>
            ))}
          </ul>
          <p>These sources inform the lesson. The fictional cases were authored by NestCipher and do not reproduce live challenge attempts.</p>
        </div>
      </section>

      <details id="exercise-workbook" className={styles.workbook}>
        <summary>Read the complete exercise workbook</summary>
        <div className={styles.workbookBody}>
          <p>Use this reading version with or without JavaScript. All records are authored exercises; no model or tools run. Make your decision before expanding an explanation.</p>
          <div className={styles.workbookCase}>
            <h3>Trusted task</h3><pre>{lab.task}</pre>
            <h4>Exercise criterion</h4><p>{lab.criterion}</p>
          </div>
          {lab.id === "action-evidence" && <p>The final reply alone supports an inconclusive decision in every case. Reveal the authored action record before assessing a completed effect.</p>}
          {lab.cases.map((labCase, index) => <WorkbookCase key={labCase.id} labCase={labCase} index={index} />)}
        </div>
      </details>
    </div>
  );
}
