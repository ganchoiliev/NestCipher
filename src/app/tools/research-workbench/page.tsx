import type { Metadata } from "next";
import { ResearchWorkbench } from "@/components/tools/ResearchWorkbench";
import { getResearchLab } from "@/lib/research-labs";
import { parseResearchAccountReturnStatus } from "@/lib/research-auth-feedback";

export const metadata: Metadata = {
  title: "Research Workbench — Private AI Research Notes — NestCipher",
  description: "Record manual prompt experiments, compare attempts and export private research notes for Obsidian. Save in an encrypted local vault, with optional account backup; no model execution.",
  alternates: { canonical: "https://nestcipher.com/tools/research-workbench" },
  openGraph: {
    title: "Research Workbench — NestCipher",
    description: "Frame a question, preserve observations and export a private research record.",
    type: "website",
    url: "https://nestcipher.com/tools/research-workbench",
  },
};

export default async function ResearchWorkbenchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Only a single built-in identifier is accepted. Query content never becomes
  // experiment text, and selecting a lab does not start or replace a draft.
  const selectedLab = typeof query.lab === "string" ? getResearchLab(query.lab) : null;
  const initialAccountStatus = parseResearchAccountReturnStatus(query.account);
  return <>
    <noscript><p className="site-container pt-8 text-base leading-relaxed text-text-secondary">The Research Workbench needs JavaScript to keep a session in page memory, compare attempts and prepare private downloads. Saving is explicit: use an optional passphrase-encrypted local vault or download readable private files. Enable JavaScript to start, or use the field guide&apos;s research checklist.</p></noscript>
    <ResearchWorkbench selectedLabId={selectedLab?.id} initialAccountStatus={initialAccountStatus} />
  </>;
}
