import { NestMark, ArrowIcon } from "@/components/ui/Brand";
import styles from "./Footer.module.css";
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`site-container ${styles.top}`}>
        <div>
          {/* Fresh documents keep workbench entry and exit separate from instrumented pages. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={styles.brand}>
            <NestMark />
            <span>
              NESTCIPHER<span className={styles.slash}>/</span>
            </span>
          </a>
          <p>Stay curious. Question the system.</p>
        </div>
        <nav aria-label="Footer navigation" className={styles.links}>
          <a href="/tools">Tools</a>
          {/* Fresh navigation restores normal instrumentation when leaving the private workbench. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/labs">Labs</a>
          <a href="/community">Field guide</a>
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
        </nav>
        <a href="mailto:hello@nestcipher.com" className="text-link">
          Say hello <ArrowIcon diagonal />
        </a>
      </div>
      <div className={`site-container ${styles.bottom}`}>
        <p>
          © {new Date().getFullYear()} NestCipher <span> / </span> An
          independent project by{" "}
          <a
            href="https://gosmartr.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GoSmartR
          </a>
        </p>
        <div>
          <a
            href="https://github.com/ganchoiliev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
          <a
            href="https://x.com/gancho_iliev"
            target="_blank"
            rel="noopener noreferrer"
          >
            X ↗
          </a>
          <a
            href="https://www.linkedin.com/in/gancho-iliev-6b146817b"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
