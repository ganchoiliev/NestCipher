import { NextRequest, NextResponse } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), signInWithOtp: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn(),
  select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), rpc: vi.fn(), single: vi.fn(),
  createClient: vi.fn(), limit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../limits", () => ({ checkRouteLimit: mocks.limit }));
vi.mock("../supabase/server", () => ({ createResearchCloudClient: mocks.createClient }));

import { GET as account } from "@/app/api/research/account/route";
import { POST as signIn } from "@/app/api/research/account/sign-in/route";
import { POST as signOut } from "@/app/api/research/account/sign-out/route";
import { GET as callback } from "@/app/auth/callback/route";
import { GET as readBackup, PUT as saveBackup, DELETE as deleteBackup } from "@/app/api/research/backup/route";
import { CLOUD_BACKUP_MAX_WIRE_BYTES } from "../research-cloud-http";

const origin = "https://nestcipher.com";
const uid = "11111111-1111-4111-8111-111111111111";
const revision = "22222222-2222-4222-8222-222222222222";
const vaultId = "33333333-3333-4333-8333-333333333333";
const snapshot = {
  format: "nestcipher-encrypted-research-vault", version: 1,
  backupId: "44444444-4444-4444-8444-444444444444",
  header: { format: 1, vaultId, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: Buffer.alloc(16).toString("base64") },
    check: { iv: Buffer.alloc(12).toString("base64"), ciphertext: Buffer.alloc(32).toString("base64") } },
  manifest: { iv: Buffer.alloc(12).toString("base64"), ciphertext: Buffer.alloc(32).toString("base64") }, records: [],
};
const row = { revision, vault_id: vaultId, updated_at: "2026-10-10T12:00:00+00:00", size_bytes: 900, record_count: 0 };
function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  if (path.startsWith("/api/research/backup") && method === "GET") {
    const url = new URL(`${origin}${path}`);
    if (!url.searchParams.has("expectedUserId")) url.searchParams.set("expectedUserId", uid);
    path = url.pathname + url.search;
  }
  if ((path.startsWith("/api/research/backup") || path.endsWith("/sign-out")) && method !== "GET"
    && body !== null && typeof body === "object") body = { expectedUserId: uid, ...body };
  return new NextRequest(`${origin}${path}`, {
    method, headers: { "sec-fetch-site": "same-origin", ...(method === "GET" ? {} : { origin, "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const apply = (response: NextResponse) => response;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abcdefghijklmnopqrstuvwx");
  vi.stubEnv("NESTCIPHER_APP_URL", origin);
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.getUser.mockResolvedValue({ data: { user: { id: uid, email: "researcher@example.test" } }, error: null });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: row, error: null });
  mocks.rpc.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: row, error: null });
  mocks.createClient.mockReturnValue({ apply, client: {
    auth: { getUser: mocks.getUser, signInWithOtp: mocks.signInWithOtp, signOut: mocks.signOut, exchangeCodeForSession: mocks.exchangeCodeForSession },
    from: () => ({ select: mocks.select }), rpc: mocks.rpc,
  } });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("optional account routes", () => {
  it("logs failed auth responses without exposing private provider or request content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.signInWithOtp.mockResolvedValue({ error: {
        __isAuthError: true, name: "AuthApiError", status: 500, code: "unexpected_failure",
        message: "PRIVATE_PROVIDER_MESSAGE", cookies: "PRIVATE_COOKIE", url: "https://PRIVATE_HOST.test",
      } });
      const response = await signIn(request("/api/research/account/sign-in", "POST", { email: "PRIVATE_EMAIL@example.test" }));
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: "sign-in-unavailable" });
      expect(warn).toHaveBeenCalledExactlyOnceWith("[research-auth] sign-in failed",
        '{"category":"auth-api","status":500,"code":"unexpected_failure"}');
      expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_");
    } finally { warn.mockRestore(); }
  });
  it("logs unexpected sign-in exceptions through the same bounded sanitizer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.signInWithOtp.mockRejectedValue(new Error("PRIVATE_REQUEST_BODY", { cause: { code: "ECONNRESET", url: "PRIVATE_URL" } }));
      expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "PRIVATE_EMAIL@example.test" }))).status).toBe(502);
      expect(warn).toHaveBeenCalledExactlyOnceWith("[research-auth] sign-in failed",
        '{"category":"network","status":null,"code":"ECONNRESET"}');
      expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_");
    } finally { warn.mockRestore(); }
  });
  it("reports unconfigured without creating a client or checking any session", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const response = await account(request("/api/research/account"));
    expect(await response.json()).toEqual({ configured: false, user: null });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("exposes only a freshly verified user id and email", async () => {
    expect(await (await account(request("/api/research/account"))).json()).toEqual({ configured: true, user: { id: uid, email: "researcher@example.test" } });
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("treats missing or forged sessions as signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await (await account(request("/api/research/account"))).json()).toEqual({ configured: true, user: null });
  });
  it("reports Auth outages without silently replacing account state", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    expect((await account(request("/api/research/account"))).status).toBe(502);
  });
  it("rejects account reads from other browser sites", async () => {
    expect((await account(request("/api/research/account", "GET", undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("initiates email PKCE with a fixed callback and no input redirect", async () => {
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }))).status).toBe(200);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({ email: "researcher@example.test", options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true } });
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test", redirectTo: "https://evil.test" }))).status).toBe(400);
  });
  it("refuses invalid or oversized sign-in payloads", async () => {
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "invalid" }))).status).toBe(400);
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "a".repeat(2000) }))).status).toBe(413);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("returns a resend interval only after a successful sign-in request", async () => {
    const response = await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }));
    expect(await response.json()).toEqual({ sent: true, retryAfterSeconds: 60 });
  });
  it("maps restricted email delivery to useful safe service feedback", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 400, code: "email_address_not_authorized", message: "PRIVATE_PROVIDER_MESSAGE" } });
    const response = await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("email-delivery-limited");
    expect(JSON.stringify(body)).not.toContain("PRIVATE_PROVIDER_MESSAGE");
  });
  it("maps provider rate limits without leaking raw provider details", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit", message: "PRIVATE_PROVIDER_MESSAGE" } });
    const response = await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "sign-in-rate-limited", retryAfterSeconds: 60 });
  });
  it("fails closed on CSRF and unavailable rate limits", async () => {
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }, { origin: "https://evil.test" }))).status).toBe(403);
    mocks.limit.mockResolvedValue({ ok: false, status: 503, error: "Rate limiting unavailable." });
    expect((await signIn(request("/api/research/account/sign-in", "POST", { email: "researcher@example.test" }))).status).toBe(503);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("signs out only this browser session", async () => {
    expect(await (await signOut(request("/api/research/account/sign-out", "POST", {}))).json()).toEqual({ signedOut: true });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("encrypted cloud snapshot routes", () => {
  it("requires a verified session before any backup query or write", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await readBackup(request("/api/research/backup"))).status).toBe(401);
    expect((await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: null, snapshot }))).status).toBe(401);
    expect((await deleteBackup(request("/api/research/backup", "DELETE", { expectedRevision: revision }))).status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("defaults to metadata only and filters by the verified owner", async () => {
    const response = await readBackup(request("/api/research/backup"));
    expect(mocks.select).toHaveBeenCalledWith("revision,vault_id,updated_at,size_bytes,record_count");
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", uid);
    expect(await response.json()).toEqual({ backup: { revision, vaultId, updatedAt: row.updated_at, sizeBytes: 900, recordCount: 0 } });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns no backup for an empty owner scope", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await (await readBackup(request("/api/research/backup"))).json()).toEqual({ backup: null });
  });
  it("downloads only explicitly requested validated ciphertext", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...row, snapshot }, error: null });
    const result = await (await readBackup(request("/api/research/backup?include=payload"))).json();
    expect(result.backup.snapshot).toEqual(snapshot);
    expect(mocks.select).toHaveBeenCalledWith("revision,vault_id,updated_at,size_bytes,record_count,snapshot");
  });
  it("rejects conflicting database metadata or malformed stored ciphertext", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...row, record_count: 1, snapshot }, error: null });
    expect((await readBackup(request("/api/research/backup?include=payload"))).status).toBe(502);
    mocks.maybeSingle.mockResolvedValue({ data: { ...row, snapshot: { passphrase: "never accepted" } }, error: null });
    expect((await readBackup(request("/api/research/backup?include=payload"))).status).toBe(502);
  });
  it("rejects unknown and duplicate read parameters", async () => {
    for (const query of ["?owner_id=other", "?include=payload&include=payload", "?include=plaintext"]) {
      expect((await readBackup(request(`/api/research/backup${query}`))).status).toBe(400);
    }
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("saves through the owner-scoped RPC with the exact expected revision", async () => {
    const response = await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: null, snapshot }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_encrypted_research_backup", { p_snapshot: snapshot, p_expected_revision: null });
  });
  it("never accepts plaintext, a passphrase, owner ids or additional fields", async () => {
    for (const body of [
      { expectedRevision: null, snapshot: { ...snapshot, passphrase: "secret" } },
      { expectedRevision: null, snapshot, ownerId: uid },
      { expectedRevision: null, snapshot, passphrase: "secret" },
      { expectedRevision: null, snapshot: { title: "private", attempts: [] } },
      { expectedRevision: null, snapshot: JSON.stringify(snapshot) },
    ]) expect((await saveBackup(request("/api/research/backup", "PUT", body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces the remote wire bound before any database mutation", async () => {
    expect((await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: null, snapshot }, { "content-length": String(CLOUD_BACKUP_MAX_WIRE_BYTES + 1) }))).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports stale saves and a different vault without overwriting", async () => {
    for (const code of ["conflict", "vault-mismatch"]) {
      mocks.single.mockResolvedValue({ data: null, error: { code: "PT409", details: code } });
      const response = await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: revision, snapshot }));
      expect(response.status).toBe(409); expect((await response.json()).code).toBe(code);
    }
  });
  it("fails closed when database operations fail without leaking provider errors", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "provider secret details" } });
    const response = await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: revision, snapshot }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("provider secret details");
  });
  it("deletes only with a revision and owner-derived RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await (await deleteBackup(request("/api/research/backup", "DELETE", { expectedRevision: revision }))).json()).toEqual({ deleted: true, backup: null });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_encrypted_research_backup", { p_expected_revision: revision });
  });
  it("refuses stale deletes, missing revisions and owner injection", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", details: "conflict" } });
    expect((await deleteBackup(request("/api/research/backup", "DELETE", { expectedRevision: revision }))).status).toBe(409);
    mocks.rpc.mockClear();
    for (const body of [{}, { expectedRevision: null }, { expectedRevision: revision, ownerId: uid }]) {
      expect((await deleteBackup(request("/api/research/backup", "DELETE", body))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses cross-origin writes and deletes before Auth or database access", async () => {
    expect((await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: null, snapshot }, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await deleteBackup(request("/api/research/backup", "DELETE", { expectedRevision: revision }, { origin: "https://evil.test" }))).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("binds every operation to the account the user checked", async () => {
    const other = "55555555-5555-4555-8555-555555555555";
    for (const response of [
      await readBackup(request(`/api/research/backup?expectedUserId=${other}`)),
      await saveBackup(request("/api/research/backup", "PUT", { expectedUserId: other, expectedRevision: null, snapshot })),
      await deleteBackup(request("/api/research/backup", "DELETE", { expectedUserId: other, expectedRevision: revision })),
      await signOut(request("/api/research/account/sign-out", "POST", { expectedUserId: other })),
    ]) {
      expect(response.status).toBe(409); expect((await response.json()).code).toBe("account-changed");
    }
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("requires an explicit account assertion even on metadata reads", async () => {
    expect((await readBackup(new NextRequest(`${origin}/api/research/backup`))).status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("returns unavailable for every backup operation when cloud is unconfigured", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect((await readBackup(request("/api/research/backup"))).status).toBe(503);
    expect((await saveBackup(request("/api/research/backup", "PUT", { expectedRevision: null, snapshot }))).status).toBe(503);
    expect((await deleteBackup(request("/api/research/backup", "DELETE", { expectedRevision: revision }))).status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("fixed PKCE callback", () => {
  it("keeps the configured127.0.0.1 callback and redirect despite Next normalization", async () => {
    const localOrigin = "http://127.0.0.1:3001";
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NESTCIPHER_APP_URL", localOrigin);
    const incoming = new NextRequest(`${localOrigin}/auth/callback?code=${revision}`, {
      headers: { host: "127.0.0.1:3001", "sec-fetch-site": "cross-site" },
    });
    expect(incoming.nextUrl.origin).toBe("http://localhost:3001");
    const response = await callback(incoming);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${localOrigin}/tools/research-workbench?account=connected`);
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith(revision);
  });
  it("exchanges the code and navigates to a fresh Workbench document", async () => {
    const response = await callback(request(`/auth/callback?code=${revision}`, "GET", undefined, { "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/tools/research-workbench?account=connected`);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith(revision);
  });
  it("ignores arbitrary redirects and refuses ambiguous or missing codes", async () => {
    for (const query of ["", `?code=${revision}&next=https://evil.test`, `?code=${revision}&code=${revision}`, "?error=access_denied", "?code=invalid!code"]) {
      const response = await callback(request(`/auth/callback${query}`));
      expect(response.headers.get("location")).toBe(`${origin}/tools/research-workbench?account=error`);
    }
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("uses the fixed origin and returns failed exchange without raw Auth errors", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { message: "private provider details" } });
    const response = await callback(request(`/auth/callback?code=${revision}`));
    expect(response.headers.get("location")).toBe(`${origin}/tools/research-workbench?account=error`);
    expect((await callback(new NextRequest(`https://evil.test/auth/callback?code=${revision}`))).status).toBe(403);
  });
});
