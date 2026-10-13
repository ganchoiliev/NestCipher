import { exportResearchCasebookMarkdown, getResearchCasebookEntry } from "@/lib/research-casebook";

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const entry = getResearchCasebookEntry(caseId);
  const note = entry && exportResearchCasebookMarkdown(entry.id);
  if (!entry || !note) return new Response("Case not found.", { status: 404, headers: { "Content-Type": "text/plain;charset=utf-8", "Cache-Control": "no-store" } });
  return new Response(note, { headers: { "Content-Type": "text/markdown;charset=utf-8", "Content-Disposition": `attachment; filename="nestcipher-casebook-${entry.id}.md"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
}
