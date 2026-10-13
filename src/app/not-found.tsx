import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Brand";
import styles from "./casebook/Casebook.module.css";

export default function NotFoundPage() {
  return <div className={`site-container ${styles.page}`}>
    <header className={styles.detailHeader}>
      <p className="eyebrow">404 / Missing page</p>
      <h1>Page not found.</h1>
      <p className={styles.summary}>This address has no page. Choose a place to continue.</p>
    </header>
    <nav className={styles.outline} aria-label="Continue from the missing page">
      <Link href="/">Home <ArrowIcon /></Link>
      <Link href="/tools">The toolkit <ArrowIcon /></Link>
      <Link href="/casebook">Research casebook <ArrowIcon /></Link>
    </nav>
  </div>;
}
