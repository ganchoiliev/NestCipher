import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Brand";
import { researchCasebook, CASEBOOK_ORIGIN_NOTICE } from "@/lib/research-casebook";
import styles from "./Casebook.module.css";

export const metadata: Metadata = {
  title: "Research Casebook — Inspect the Evidence — NestCipher",
  description: "Three authored AI security research walkthroughs: inspect an exact change, its fictional evidence and the limits of a claim.",
  alternates: { canonical: "https://nestcipher.com/casebook" },
};

export default function CasebookPage() {
  return <div className={`site-container ${styles.page}`}>
    <header className={styles.header}>
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Research casebook</span></nav>
      <div className={styles.hero}><div><p className="eyebrow">Research / worked examples</p><h1>A claim needs<br />a record.</h1></div><p>Follow a research question through an exact change, authored evidence and a conclusion with limits. Learn how to make a finding inspectable.</p></div>
      <p className={styles.origin}>{CASEBOOK_ORIGIN_NOTICE}</p>
    </header>
    <section aria-labelledby="case-index-heading" className={styles.index}>
      <div className={styles.sectionBar}><h2 id="case-index-heading" className="eyebrow">The research casebook</h2><span>{String(researchCasebook.length).padStart(2,"0")} authored walkthroughs</span></div>
      <ol className={styles.caseList}>{researchCasebook.map((entry) => <li key={entry.id}>
        <span className={styles.ordinal} aria-hidden="true">{entry.ordinal}</span>
        <div><h2><Link href={`/casebook/${entry.id}`}>{entry.title}</Link></h2><p>{entry.summary}</p><span className={styles.version}>Authored fixture / version {entry.version}</span></div>
        <Link href={`/casebook/${entry.id}`} className={`button-secondary ${styles.readLink}`} aria-label={`Read ${entry.title}`}>Read the case <ArrowIcon /></Link>
      </li>)}</ol>
    </section>
    <section className={styles.followup} aria-labelledby="casebook-followup-heading"><div><p className="eyebrow">Question → Change → Evidence → Claim</p><h2 id="casebook-followup-heading">Keep the reasoning<br />with the record.</h2></div><div><p>Plan a baseline and variants in Prompt Studio. Record real observations manually, trace their relationships in Experiment Map, and save or export your private research when ready.</p><a href="/tools/research-workbench" target="_blank" rel="noopener noreferrer" className="button-primary">Plan a follow-up <ArrowIcon diagonal /></a><p className={styles.help}>Opens a separate, empty Workbench. These authored outcomes are kept in the casebook.</p><Link href="/labs" className="text-link">Practise in the learning labs <ArrowIcon /></Link></div></section>
  </div>;
}
