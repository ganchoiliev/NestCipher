// Small, shared identifiers keep closed public catalogs out of arbitrary routing.
export const researchCatalogIds = {
  casebook: ["labels-and-authority", "reply-and-effect", "criterion-and-fidelity"],
  labs: ["source-authority", "action-evidence", "controlled-comparison"],
} as const;

export function isUnknownCatalogPath(pathname: string): boolean {
  const match = /^\/(casebook|labs)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return false;
  let id: string;
  try { id = decodeURIComponent(match[2]); }
  catch { return true; }
  return !(researchCatalogIds[match[1] as keyof typeof researchCatalogIds] as readonly string[]).includes(id);
}
