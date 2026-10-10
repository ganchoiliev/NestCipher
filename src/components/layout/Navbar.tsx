"use client";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { NestMark } from "@/components/ui/Brand";
import styles from "./Navbar.module.css";
const navLinks = [
  { href: "/tools", label: "Tools" },
  { href: "/labs", label: "Labs" },
  { href: "/community", label: "Field guide" },
  { href: "/about", label: "About" },
];
const subscribeToMount = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;
export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToMount,
    clientMounted,
    serverMounted,
  );
  const { resolvedTheme, setTheme } = useTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <header className={styles.header}>
      <nav
        className={`site-container ${styles.nav}`}
        aria-label="Main navigation"
      >
        {/* Fresh documents drop the workbench session and restore normal instrumentation on exit. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className={styles.brand}
          aria-label="NestCipher home"
          onClick={() => setMobileOpen(false)}
        >
          <NestMark className={styles.mark} />
          <span>
            nest<span className={styles.brandLight}>cipher</span>
            <span className={styles.brandDot}>/</span>
          </span>
        </a>
        <div className={styles.desktopLinks}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.navLink}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className={styles.actions}>
          <span className={styles.openLabel}>FREE & OPEN SOURCE</span>
          <button
            className={styles.iconButton}
            disabled={!mounted}
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
          >
            {dark ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M20.5 14.2A9 9 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z" />
              </svg>
            )}
          </button>
          <button
            ref={toggleRef}
            disabled={!mounted}
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <path d="m6 6 12 12M6 18 18 6" />
              ) : (
                <path d="M3 8h18M3 16h18" />
              )}
            </svg>
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          className={styles.mobileNav}
          aria-label="Mobile navigation"
        >
          {navLinks.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            >
              <span>0{index + 1}</span>
              {link.label}
            </a>
          ))}
          <p>Independent tools. Open to everyone.</p>
        </nav>
      )}
      <noscript>
        <nav className={styles.noScriptNav} aria-label="Navigation">
          <a href="/tools">Tools</a>
          {/* Keep the same fresh-document exit boundary without JavaScript. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/labs">Labs</a>
          <a href="/community">Field guide</a>
          <a href="/about">About</a>
        </nav>
      </noscript>
    </header>
  );
}
