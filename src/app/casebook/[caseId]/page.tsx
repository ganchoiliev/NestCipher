import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/ui/Brand";
import { CASEBOOK_ORIGIN_NOTICE, getResearchCasebookEntry, researchCasebook, type CasebookEntry } from "@/lib/research-casebook";
import styles from "../Casebook.module.css";

type Props = { params: Promise<{ caseId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { caseId } = await params;
  const entry = getResearchCasebookEntry(caseId);
  if (!entry) return { title: "Page not found — NestCipher", robots: { index: false, follow: false } };
  return { title: `${entry.title} — Research Casebook — NestCipher`, description: entry.summary, alternates: { canonical: `https://nestcipher.com/casebook/${entry.id}` } };
}

function Record({ record, label }: { record: CasebookEntry["baseline"]; label: string }) {
  return <article className={styles.record} aria-label={`Authored ${label.toLowerCase()}`}><h3>{label}</h3><p className={styles.version}>Exact text / authored fixture</p><h4>Input</h4><pre>{record.input}</pre><h4>Fixed task context</h4><pre>{record.context}</pre><details className={styles.outcome}><summary>Read the authored outcome</summary><div><h4>Fictional reply</h4><pre>{record.reply}</pre><h4>Authored action record</h4>{record.actionRecord.length ? <ol className={styles.trace}>{record.actionRecord.map((action, index) => <li key={index}><span>{action.state} / {action.label}</span><pre>{action.text}</pre></li>)}</ol> : <p>No action record is supplied in this fixture.</p>}<h4>Assessment of this fixture</h4><p>{record.assessment}</p><h4>Limits of the record</h4><p>{record.limits}</p></div></details></article>;
}

export default async function CasebookDetailPage({ params }: Props) {
  const { caseId } = await params;
  const entry = getResearchCasebookEntry(caseId);
  if (!entry) notFound();
  const next = researchCasebook[(researchCasebook.findIndex((item) => item.id === entry.id) + 1) % researchCasebook.length];
  return <div className={`site-container ${styles.page}`}>
    <header className={styles.detailHeader}><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/casebook">Research casebook</Link><span aria-hidden="true">/</span><span aria-current="page">Case {entry.ordinal}</span></nav><p className="eyebrow">Case {entry.ordinal} / Research walkthrough</p><h1>{entry.title}</h1><p className={styles.summary}>{entry.summary}</p><p className={styles.origin}>{CASEBOOK_ORIGIN_NOTICE}</p><nav className={styles.outline} aria-label="Case sections"><a href="#question">Question</a><a href="#record">Record</a><a href="#conditions">Conditions</a><a href="#conclusion">Conclusion</a><a href="#follow-up">Follow-up</a></nav></header>
    <section id="question" className={styles.section} aria-labelledby="question-heading"><div className={styles.sectionBar}><p className="eyebrow">01 / Define the question</p><span>Case version {entry.version}</span></div><div className={styles.questionGrid}><div><h2 id="question-heading">What are we testing?</h2><p>{entry.question}</p><h3>Observable criterion</h3><p>{entry.criterion}</p></div><div className={styles.task}><h3>Trusted task · invented setup</h3><pre>{entry.trustedTask}</pre></div></div></section>
    <section id="record" className={styles.section} aria-labelledby="record-heading"><div className={styles.sectionBar}><p className="eyebrow">02 / Inspect the exact change</p><span>Authored inputs and outcomes</span></div><h2 id="record-heading">Read both records.</h2><div className={styles.change}><span>Intended change</span><p>{entry.changeNote}</p></div><div className={styles.records}><Record record={entry.baseline} label="Baseline" /><Record record={entry.variant} label="Variant" /></div></section>
    <section id="conditions" className={styles.section} aria-labelledby="conditions-heading"><div className={styles.sectionBar}><p className="eyebrow">03 / Keep the conditions visible</p><span>Known / unknown</span></div><h2 id="conditions-heading">What stayed the same?</h2><p className={styles.help}>These are authored setup values. Equal missing fields do not establish matched real conditions.</p><div className={styles.conditions}>{entry.conditions.map((condition) => <div key={condition.label}><h3>{condition.label}</h3><dl><div><dt>Baseline</dt><dd>{condition.baseline ?? "Unknown — no real run"}</dd></div><div><dt>Variant</dt><dd>{condition.variant ?? "Unknown — no real run"}</dd></div></dl></div>)}</div></section>
    <section id="conclusion" className={styles.section} aria-labelledby="conclusion-heading"><div className={styles.sectionBar}><p className="eyebrow">04 / Make a bounded claim</p><span>Evidence / interpretation</span></div><h2 id="conclusion-heading">Say what the record supports.</h2><div className={styles.claims}><div><h3>Supported by this fixture</h3><p>{entry.supportedClaim}</p></div><div><h3>Not established by this fixture</h3><p>{entry.unsupportedClaim}</p></div></div></section>
    <section id="follow-up" className={styles.followup} aria-labelledby="follow-up-heading"><div><p className="eyebrow">05 / Prepare the next question</p><h2 id="follow-up-heading">Carry the method forward.</h2><p>{entry.followUp}</p></div><div><a href="/tools/research-workbench" target="_blank" rel="noopener noreferrer" className="button-primary">Plan a follow-up <ArrowIcon diagonal /></a><p className={styles.help}>Opens an empty private workspace in a new tab. Enter your own authorised scope and observations. Casebook replies and actions are never copied into research results.</p><Link href={`/labs/${entry.labId}`} className="text-link">Practise the related lab <ArrowIcon /></Link><a href={`/casebook/${entry.id}/note`} className="text-link">Download authored case note <ArrowIcon /></a><p className={styles.help}>A public teaching note with fictional evidence and its provenance. It is separate from your private research exports.</p></div></section>
    <p className={styles.origin}>Keep live challenge findings private until 30 full days after the actual confirmed end. Unknown or unconfirmed end dates stay restricted. A date passing never publishes your research.</p>
    <section className={styles.sources} aria-labelledby="sources-heading"><h2 id="sources-heading">Read the primary sources.</h2><p>These references inform the method. NestCipher authored the examples and outcomes; the sources do not verify these fixtures.</p><ul>{entry.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link">{source.title} <ArrowIcon diagonal /></a></li>)}</ul></section>
    <nav className={styles.nextCase} aria-label="Continue reading"><Link href="/casebook" className="text-link">All cases <ArrowIcon /></Link><Link href={`/casebook/${next.id}`} className="text-link">Next / {next.title} <ArrowIcon /></Link></nav>
  </div>;
}
