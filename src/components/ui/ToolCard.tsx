import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/tools/ToolsCatalog.module.css";

interface ToolCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  detail?: string;
  category?: string;
  number?: number;
  status?: "coming-soon" | "live";
  href?: string;
  headingLevel?: 2 | 3;
}

export function ToolCard({
  icon,
  title,
  description,
  detail,
  category,
  number,
  status = "live",
  href,
  headingLevel = 3,
}: ToolCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const content = (
    <>
      <span className={styles.rowNumber} aria-hidden="true">
        {number ? String(number).padStart(2, "0") : icon}
      </span>
      <div className={styles.rowContent}>
        {category && <span className={styles.rowCategory}>{category}</span>}
        <Heading>{title}</Heading>
        <p>{description}</p>
        {detail && <p className={styles.rowDetail}>{detail}</p>}
      </div>
      <span className={styles.rowAction}>
        <span>{status === "coming-soon" ? "Coming soon" : "Open tool"}</span>
        {status === "live" && <span className={styles.rowArrow} aria-hidden="true">↗</span>}
      </span>
    </>
  );

  if (href && status === "live") {
    if (href === "/tools/research-workbench") {
      return <a href={href} className={styles.toolRow}>{content}</a>;
    }
    return <Link href={href} className={styles.toolRow}>{content}</Link>;
  }

  return <div className={styles.toolRow}>{content}</div>;
}
