import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseEncryptedResearchVaultBackup } from "@/lib/encrypted-vault-backup";
import {
  CLOUD_BACKUP_MAX_WIRE_BYTES, CloudRequestBodyError, privateResponse, readBoundedCloudJson,
} from "@/lib/research-cloud-http";
import { prepareCloudRoute, requireCloudUser } from "@/lib/research-cloud-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const metadataSchema = z.object({
  revision: uuid, vault_id: uuid, updated_at: z.iso.datetime({ offset: true }),
  size_bytes: z.number().int().min(1).max(CLOUD_BACKUP_MAX_WIRE_BYTES),
  record_count: z.number().int().min(0).max(25),
});
const putSchema = z.object({ expectedUserId: uuid, expectedRevision: uuid.nullable(), snapshot: z.unknown() }).strict();
const accountChanged = () => privateResponse({
  error: "Your signed-in account changed. Check your account before continuing.", code: "account-changed",
}, 409);

function metadata(input: unknown) {
  const row = metadataSchema.parse(input);
  return { revision: row.revision, vaultId: row.vault_id, updatedAt: row.updated_at, sizeBytes: row.size_bytes, recordCount: row.record_count };
}

export async function GET(request: NextRequest) {
  const context = await prepareCloudRoute(request, "research-backup-read");
  if ("response" in context) return context.response;
  try {
    const auth = await requireCloudUser(context);
    if ("response" in auth) return auth.response;
    const params = request.nextUrl.searchParams;
    if (Array.from(params.keys()).some((key) => key !== "include" && key !== "expectedUserId")
      || params.getAll("expectedUserId").length !== 1 || !uuid.safeParse(params.get("expectedUserId")).success
      || params.getAll("include").length > 1 || (params.has("include") && params.get("include") !== "payload")) {
      return context.apply(privateResponse({ error: "Invalid backup request." }, 400));
    }
    if (params.get("expectedUserId") !== auth.user.id) return context.apply(accountChanged());
    const includePayload = params.get("include") === "payload";
    const fields = `revision,vault_id,updated_at,size_bytes,record_count${includePayload ? ",snapshot" : ""}`;
    // Both the explicit owner filter and PostgreSQL RLS use the verified account.
    const { data, error } = await context.client.from("encrypted_research_backups")
      .select(fields).eq("owner_id", auth.user.id).maybeSingle();
    if (error) return context.apply(privateResponse({ error: "Your cloud backup could not be loaded." }, 502));
    if (!data) return context.apply(privateResponse({ backup: null }));
    const backup = metadata(data);
    if (!includePayload) return context.apply(privateResponse({ backup }));
    const snapshot = parseEncryptedResearchVaultBackup(z.object({ snapshot: z.unknown() }).parse(data).snapshot);
    if (snapshot.header.vaultId !== backup.vaultId || snapshot.records.length !== backup.recordCount) {
      return context.apply(privateResponse({ error: "The cloud backup could not be validated." }, 502));
    }
    return context.apply(privateResponse({ backup: { ...backup, snapshot } }));
  } catch {
    return context.apply(privateResponse({ error: "Your cloud backup could not be loaded." }, 502));
  }
}

export async function PUT(request: NextRequest) {
  const context = await prepareCloudRoute(request, "research-backup-write", true);
  if ("response" in context) return context.response;
  try {
    const auth = await requireCloudUser(context);
    if ("response" in auth) return auth.response;
    const parsed = putSchema.safeParse(await readBoundedCloudJson(request, CLOUD_BACKUP_MAX_WIRE_BYTES));
    if (!parsed.success || typeof parsed.data.snapshot !== "object" || parsed.data.snapshot === null) {
      return context.apply(privateResponse({ error: "Send a valid encrypted vault backup and its expected revision." }, 400));
    }
    if (parsed.data.expectedUserId !== auth.user.id) return context.apply(accountChanged());
    let snapshot;
    try { snapshot = parseEncryptedResearchVaultBackup(parsed.data.snapshot); }
    catch { return context.apply(privateResponse({ error: "The encrypted vault backup is invalid or unsupported." }, 400)); }
    const { data, error } = await context.client.rpc("save_encrypted_research_backup", {
      p_snapshot: snapshot, p_expected_revision: parsed.data.expectedRevision,
    }).single();
    if (error?.code === "PT409") {
      const code = error.details === "vault-mismatch" ? "vault-mismatch" : "conflict";
      return context.apply(privateResponse({
        error: code === "vault-mismatch"
          ? "This account already backs up a different vault. Restore that vault to continue."
          : "Your remote backup changed. Check the latest backup before saving again.",
        code,
      }, 409));
    }
    if (error?.code === "PT413") return context.apply(privateResponse({ error: "The encrypted backup is too large for cloud storage." }, 413));
    if (error) return context.apply(privateResponse({ error: "Your cloud backup could not be saved." }, 502));
    const backup = metadata(data);
    if (backup.vaultId !== snapshot.header.vaultId || backup.recordCount !== snapshot.records.length) {
      return context.apply(privateResponse({ error: "The cloud backup confirmation could not be validated." }, 502));
    }
    return context.apply(privateResponse({ backup }));
  } catch (error) {
    if (error instanceof CloudRequestBodyError) return context.apply(privateResponse({ error: error.message }, error.status));
    return context.apply(privateResponse({ error: "Your cloud backup could not be saved." }, 502));
  }
}

export async function DELETE(request: NextRequest) {
  const context = await prepareCloudRoute(request, "research-backup-delete", true);
  if ("response" in context) return context.response;
  try {
    const auth = await requireCloudUser(context);
    if ("response" in auth) return auth.response;
    const parsed = z.object({ expectedUserId: uuid, expectedRevision: uuid }).strict().safeParse(await readBoundedCloudJson(request, 256));
    if (!parsed.success) return context.apply(privateResponse({ error: "The backup revision is required for deletion." }, 400));
    if (parsed.data.expectedUserId !== auth.user.id) return context.apply(accountChanged());
    const { error } = await context.client.rpc("delete_encrypted_research_backup", {
      p_expected_revision: parsed.data.expectedRevision,
    });
    if (error?.code === "PT409") {
      return context.apply(privateResponse({ error: "Your remote backup changed. Check the latest backup before deleting it.", code: "conflict" }, 409));
    }
    if (error) return context.apply(privateResponse({ error: "Your cloud backup could not be deleted." }, 502));
    return context.apply(privateResponse({ deleted: true, backup: null }));
  } catch (error) {
    if (error instanceof CloudRequestBodyError) return context.apply(privateResponse({ error: error.message }, error.status));
    return context.apply(privateResponse({ error: "Your cloud backup could not be deleted." }, 502));
  }
}
