import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { researchCatalogIds, isUnknownCatalogPath } from "../research-catalog-routes";
import { researchLabs } from "../research-labs";
import { researchCasebook } from "../research-casebook";

describe("closed public catalog routing", () => {
  it("shares exact catalog identifiers with the authored content", () => {
    expect(researchCasebook.map((entry) => entry.id)).toEqual(researchCatalogIds.casebook);
    expect(researchLabs.map((entry) => entry.id)).toEqual(researchCatalogIds.labs);
  });
  it.each([...researchCatalogIds.casebook.map((id) => `/casebook/${id}`), ...researchCatalogIds.labs.map((id) => `/labs/${id}`)])("keeps a known path %s", (path) => {
    expect(isUnknownCatalogPath(path)).toBe(false);
    expect(isUnknownCatalogPath(`${path}/`)).toBe(false);
  });
  it.each(["/casebook/not-a-case", "/labs/not-a-lab", "/casebook/LABELS-AND-AUTHORITY", "/casebook/%3Cscript%3Ex%3C%2Fscript%3E", "/labs/%ZZ"])("rejects an unknown identifier %s", (path) => {
    expect(isUnknownCatalogPath(path)).toBe(true);
  });
  it.each(["/casebook", "/labs", "/casebook/not-a-case/note", "/api/research/backup", "/tools/research-workbench", "/auth/callback"])("leaves other route handling intact: %s", (path) => {
    expect(isUnknownCatalogPath(path)).toBe(false);
  });
  it("rewrites a missing case with 404, nonced CSP and no copied query", () => {
    const response = proxy(new NextRequest("https://nestcipher.com/casebook/not-a-case?private-marker=unused", { headers: { "x-nestcipher-workbench": "1" } }));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://nestcipher.com/404");
    expect(response.headers.get("Content-Security-Policy")).toMatch(/script-src 'self' 'nonce-[^']+'/);
  });
  it("preserves the private workbench nonce and analytics boundary", () => {
    const response = proxy(new NextRequest("https://nestcipher.com/tools/research-workbench"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).not.toContain("plausible.io");
  });
});
