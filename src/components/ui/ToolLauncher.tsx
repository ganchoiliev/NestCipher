"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToolDraft } from "@/components/layout/ToolDraftProvider";
import styles from "./ToolLauncher.module.css";

type LauncherTool = "headers" | "email" | "llm";

const launcherTools: {
  id: LauncherTool;
  label: string;
  detail: string;
  href: string;
}[] = [
  {
    id: "headers",
    label: "Headers",
    detail: "HTTP response inspection",
    href: "/tools/headers-scanner",
  },
  {
    id: "email",
    label: "Email",
    detail: "Phishing threat analysis",
    href: "/tools/email-analyzer",
  },
  {
    id: "llm",
    label: "LLM risks",
    detail: "OWASP security reference",
    href: "/tools/owasp-llm-top-10",
  },
];

export function ToolLauncher() {
  const router = useRouter();
  const { setScannerDraft } = useToolDraft();
  const [activeTool, setActiveTool] = useState<LauncherTool>("headers");
  const [targetUrl, setTargetUrl] = useState("");

  function openScanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = targetUrl.trim();
    if (!url) return;
    setScannerDraft(url);
    router.push("/tools/headers-scanner");
  }

  return (
    <section aria-label="Tool launcher" className={styles.launcher}>
      <div className={styles.toolbar}>
        <span>QUICK START</span>
        <span className={styles.toolCount}>{launcherTools.length} SHORTCUTS / FREE ACCESS</span>
      </div>
      <div className={styles.body}>
        <div className={styles.chooser} role="group" aria-label="Select a tool">
          {launcherTools.map((tool, index) => (
            <button
              key={tool.id}
              type="button"
              aria-pressed={activeTool === tool.id}
              aria-controls={`launcher-${tool.id}`}
              onClick={() => setActiveTool(tool.id)}
              className={styles.chooserButton}
            >
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.toolLabel}>{tool.label}</span>
              <span className={styles.toolDetail} aria-hidden="true">
                {tool.detail}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.panels}>
          <section
            id="launcher-headers"
            hidden={activeTool !== "headers"}
            aria-labelledby="launcher-headers-title"
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 id="launcher-headers-title">Inspect response headers.</h2>
              <p>
                Find missing protections and get practical fixes for a public
                website.
              </p>
            </div>
            <form onSubmit={openScanner} className={styles.form}>
              <label htmlFor="launcher-target">Target URL</label>
              <div className={styles.entry}>
                <input
                  id="launcher-target"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={2048}
                  required
                  placeholder="https://example.com"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  aria-describedby="launcher-headers-note"
                />
                <button
                  type="submit"
                  className={`button-primary ${styles.launchButton}`}
                  disabled={!targetUrl.trim()}
                >
                  Open scanner <span aria-hidden="true">↗</span>
                </button>
              </div>
              <p id="launcher-headers-note" className={styles.inputNote}>
                Your URL opens in the scanner. Run the check from there.
              </p>
            </form>
            <dl className={styles.capabilities}>
              <div>
                <dt>INPUT</dt>
                <dd>Public URL</dd>
              </div>
              <div>
                <dt>CHECKS</dt>
                <dd>10 security headers</dd>
              </div>
              <div>
                <dt>OUTPUT</dt>
                <dd>Grade + recommendations</dd>
              </div>
            </dl>
          </section>

          <section
            id="launcher-email"
            hidden={activeTool !== "email"}
            aria-labelledby="launcher-email-title"
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 id="launcher-email-title">Examine a suspicious email.</h2>
              <p>
                Review phishing indicators, suspicious links, and social
                engineering tactics in one report.
              </p>
            </div>
            <div className={styles.routeAction}>
              <Link href="/tools/email-analyzer" className="button-primary">
                Open email analyzer <span aria-hidden="true">↗</span>
              </Link>
              <p>
                Paste the email in the analyzer. Content is sent to OpenAI;
                NestCipher stores nothing.
              </p>
            </div>
            <dl className={styles.capabilities}>
              <div>
                <dt>INPUT</dt>
                <dd>Email content</dd>
              </div>
              <div>
                <dt>REVIEW</dt>
                <dd>6 threat categories</dd>
              </div>
              <div>
                <dt>OUTPUT</dt>
                <dd>Assessment + next steps</dd>
              </div>
            </dl>
          </section>

          <section
            id="launcher-llm"
            hidden={activeTool !== "llm"}
            aria-labelledby="launcher-llm-title"
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <h2 id="launcher-llm-title">Understand the risks in LLMs.</h2>
              <p>
                Work through the OWASP LLM Top 10 with real-world examples and
                mitigation guidance.
              </p>
            </div>
            <div className={styles.routeAction}>
              <Link href="/tools/owasp-llm-top-10" className="button-primary">
                Explore LLM risks <span aria-hidden="true">↗</span>
              </Link>
              <p>A local learning reference and quiz. Runs in your browser.</p>
            </div>
            <dl className={styles.capabilities}>
              <div>
                <dt>REFERENCE</dt>
                <dd>OWASP 2025</dd>
              </div>
              <div>
                <dt>EXPLORE</dt>
                <dd>10 vulnerabilities</dd>
              </div>
              <div>
                <dt>PRACTICE</dt>
                <dd>Knowledge check</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.footerLabel}>OPEN A TOOL</span>
        <nav aria-label="Tool shortcuts" className={styles.shortcuts}>
          {launcherTools.map((tool) => (
            <Link key={tool.id} href={tool.href}>
              {tool.label}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
