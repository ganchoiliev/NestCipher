import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { createSyntheticExperiment, withChallenge } from "../research-workbench";
import {
  createResearchVault, inspectResearchVault, restoreEncryptedResearchVaultBackup,
  type ResearchVaultSession,
} from "../research-vault";
import {
  ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS, EncryptedResearchVaultBackupError,
  parseEncryptedResearchVaultBackup, encodeVaultBackupBytes, decodeVaultBackupBytes,
  type EncryptedResearchVaultBackup,
} from "../encrypted-vault-backup";

const PASSPHRASE = "four uncommon words for this portable vault";
const sessions: ResearchVaultSession[] = [];
const keep = (session: ResearchVaultSession) => { sessions.push(session); return session; };
const newDevice = () => { for (const session of sessions.splice(0)) session.lock(); vi.stubGlobal("indexedDB", new IDBFactory()); };
const fixture = () => {
  const experiment = createSyntheticExperiment();
  experiment.title = "PRIVATE PORTABLE TITLE";
  experiment.attempts[0].input = "Private prompt\r\n  \u200B\uD800<script>untouched</script>";
  return withChallenge(experiment, { name: "PRIVATE LIVE CHALLENGE", endsAt: null, endConfirmed: false });
};
async function savedBackup() {
  const session = keep(await createResearchVault(PASSPHRASE));
  const experiment = fixture();
  const summary = await session.save(experiment, null);
  return { session, experiment, summary, backup: await session.exportEncryptedBackup() };
}

beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { for (const session of sessions.splice(0)) session.lock(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("portable encrypted research vault backups", () => {
  it("round-trips exact saved records and revisions on a fresh device without exposing private metadata", async () => {
    const { session, experiment, summary, backup } = await savedBackup();
    const serialized = JSON.stringify(backup);
    for (const privateValue of [experiment.title, "PRIVATE LIVE CHALLENGE", "Private prompt", PASSPHRASE, summary.savedAt, "publicNotBefore", "revision", "attemptCount"]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(backup.records).toHaveLength(1);
    expect(await session.open(experiment.id)).toEqual({ experiment, summary });
    newDevice();
    const restored = keep(await restoreEncryptedResearchVaultBackup(serialized, PASSPHRASE));
    expect(await restored.open(experiment.id)).toEqual({ experiment, summary });
    expect(await restored.list()).toEqual([summary]);
    expect((await restored.open(experiment.id)).experiment.disclosure).toMatchObject({ visibility: "private", publish: false, publicNotBefore: null });
    const updated = await restored.save(experiment, summary.revision);
    expect(updated.revision).toBe(2);
  });

  it("can restore an authenticated empty vault", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const backup = await session.exportEncryptedBackup();
    newDevice();
    const restored = keep(await restoreEncryptedResearchVaultBackup(backup, PASSPHRASE));
    expect(await inspectResearchVault()).toEqual({ exists: true });
    expect(await restored.list()).toEqual([]);
  });

  it("exports a fresh authenticated manifest without changing stored ciphertext or saved revisions", async () => {
    const { session, experiment, backup } = await savedBackup();
    const second = await session.exportEncryptedBackup();
    expect(second.backupId).not.toBe(backup.backupId);
    expect(second.manifest.iv).not.toBe(backup.manifest.iv);
    expect(second.records).toEqual(backup.records);
    expect(second.header).toEqual(backup.header);
    expect((await session.open(experiment.id)).summary.revision).toBe(1);
  });

  it("requires an unlocked session and an export pending during lock cannot return data", async () => {
    const { session } = await savedBackup();
    const pending = session.exportEncryptedBackup();
    session.lock();
    await expect(pending).rejects.toMatchObject({ code: "locked" });
    await expect(session.exportEncryptedBackup()).rejects.toMatchObject({ code: "locked" });
  });

  it("rejects a wrong passphrase without creating a local vault", async () => {
    const { backup } = await savedBackup();
    newDevice();
    await expect(restoreEncryptedResearchVaultBackup(backup, "another incorrect long portable phrase")).rejects.toMatchObject({ code: "unlock-failed" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it.each(["manifest", "backupId", "vaultId", "ciphertext", "recordId", "writeToken", "omittedRecord"] as const)("authenticates %s and refuses any altered snapshot before storage", async (field) => {
    const { backup } = await savedBackup();
    const changed = structuredClone(backup);
    if (field === "manifest" || field === "ciphertext") {
      const cipher = field === "manifest" ? changed.manifest : changed.records[0];
      const bytes = decodeVaultBackupBytes(cipher.ciphertext);
      new Uint8Array(bytes)[0] ^= 1;
      cipher.ciphertext = encodeVaultBackupBytes(bytes);
    } else if (field === "backupId") changed.backupId = crypto.randomUUID();
    else if (field === "vaultId") changed.header.vaultId = crypto.randomUUID();
    else if (field === "recordId") changed.records[0].id = crypto.randomUUID();
    else if (field === "writeToken") changed.records[0].writeToken = crypto.randomUUID();
    else changed.records = [];
    newDevice();
    await expect(restoreEncryptedResearchVaultBackup(changed, PASSPHRASE)).rejects.toMatchObject({ code: field === "vaultId" ? "unlock-failed" : "invalid-vault" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("rejects reordered records and a splice of a valid older revision", async () => {
    const { session, experiment, backup: previous } = await savedBackup();
    const other = fixture();
    await session.save(other, null);
    await session.save({ ...experiment, title: "A revised private title" }, 1);
    const latest = await session.exportEncryptedBackup();
    const older = structuredClone(latest);
    older.records[older.records.findIndex((record) => record.id === experiment.id)] = previous.records[0];
    const reordered = structuredClone(latest);
    reordered.records.reverse();
    newDevice();
    await expect(restoreEncryptedResearchVaultBackup(older, PASSPHRASE)).rejects.toMatchObject({ code: "invalid-vault" });
    await expect(restoreEncryptedResearchVaultBackup(reordered, PASSPHRASE)).rejects.toMatchObject({ code: "invalid-vault" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("refuses to replace even an existing empty local vault and preserves saved data", async () => {
    const { session, experiment, summary, backup } = await savedBackup();
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE)).rejects.toMatchObject({ code: "conflict" });
    expect(await session.open(experiment.id)).toEqual({ experiment, summary });
    newDevice();
    const existing = keep(await createResearchVault("a different long local vault passphrase"));
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE)).rejects.toMatchObject({ code: "conflict" });
    expect(await existing.list()).toEqual([]);
  });

  it("restores atomically when two devices' restore requests race", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const results = await Promise.allSettled([
      restoreEncryptedResearchVaultBackup(backup, PASSPHRASE), restoreEncryptedResearchVaultBackup(backup, PASSPHRASE),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "fulfilled") { keep(result.value); expect(await result.value.list()).toHaveLength(1); }
      else expect(result.reason).toMatchObject({ code: "conflict" });
    }
  });

  it("does not leave a partial header or records if the install transaction aborts", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === "records") throw new DOMException("Simulated quota failure", "QuotaExceededError");
      return add.apply(this, args);
    });
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE)).rejects.toMatchObject({ code: "storage" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("validates authenticated plaintext as a supported private experiment before installation", async () => {
    const { backup } = await savedBackup();
    const changed = structuredClone(backup);
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(PASSPHRASE), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: decodeVaultBackupBytes(changed.header.kdf.salt) }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const record = changed.records[0];
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(JSON.stringify(["nestcipher-research-vault", 1, changed.header.vaultId, record.id, record.writeToken])), tagLength: 128 }, key, new TextEncoder().encode('{"publish":true,"unsupported":"record"}'));
    record.iv = encodeVaultBackupBytes(iv.buffer);
    record.ciphertext = encodeVaultBackupBytes(ciphertext);
    newDevice();
    await expect(restoreEncryptedResearchVaultBackup(changed, PASSPHRASE)).rejects.toMatchObject({ code: "invalid-vault" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("rejects a previously cancelled restore before key import or derivation", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    controller.abort();
    const imported = vi.spyOn(crypto.subtle, "importKey");
    const derived = vi.spyOn(crypto.subtle, "deriveKey");
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(imported).not.toHaveBeenCalled();
    expect(derived).not.toHaveBeenCalled();
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("checks cancellation after key import before starting the expensive KDF", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const imported = crypto.subtle.importKey.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "importKey").mockImplementation(async (...args: Parameters<typeof imported>) => {
      const key = await imported(...args);
      controller.abort();
      return key;
    });
    const derived = vi.spyOn(crypto.subtle, "deriveKey");
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(derived).not.toHaveBeenCalled();
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("cancels a restore during key derivation without opening or writing a local vault", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const derive = crypto.subtle.deriveKey.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "deriveKey").mockImplementation(async (...args) => {
      const key = await derive(...args);
      controller.abort();
      return key;
    });
    const open = vi.spyOn(IDBFactory.prototype, "open");
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(open).not.toHaveBeenCalled();
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it.each([1, 2, 3])("cancels after decrypt phase %i without creating a partial vault", async (phase) => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    let calls = 0;
    vi.spyOn(crypto.subtle, "decrypt").mockImplementation(async (...args) => {
      const bytes = await decrypt(...args);
      if (++calls === phase) controller.abort();
      return bytes;
    });
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(calls).toBe(phase);
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("checks cancellation after database opening immediately before installation", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const open = IDBFactory.prototype.open;
    vi.spyOn(IDBFactory.prototype, "open").mockImplementation(function (this: IDBFactory, ...args) {
      const request = open.apply(this, args);
      request.addEventListener("success", () => controller.abort(), { once: true });
      return request;
    });
    const add = vi.spyOn(IDBObjectStore.prototype, "add");
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(add).not.toHaveBeenCalled();
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("aborts the active install transaction and rolls back its header and records", async () => {
    const { backup } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = add.apply(this, args);
      if (this.name === "records") controller.abort();
      return request;
    });
    await expect(restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("does not report rollback when cancellation arrives after the atomic commit", async () => {
    const { backup, experiment } = await savedBackup();
    newDevice();
    const controller = new AbortController();
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = add.apply(this, args);
      if (this.name === "records") this.transaction.addEventListener("complete", () => controller.abort(), { once: true });
      return request;
    });
    const restored = keep(await restoreEncryptedResearchVaultBackup(backup, PASSPHRASE, { signal: controller.signal }));
    expect(controller.signal.aborted).toBe(true);
    expect(await inspectResearchVault()).toEqual({ exists: true });
    expect((await restored.open(experiment.id)).experiment).toEqual(experiment);
  });
});

describe("bounded ciphertext wire validation", () => {
  let backup: EncryptedResearchVaultBackup;
  beforeEach(async () => { backup = (await savedBackup()).backup; });

  it("accepts JSON and object forms, returns a detached object, and requires no browser database", () => {
    vi.stubGlobal("indexedDB", undefined);
    const parsed = parseEncryptedResearchVaultBackup(JSON.stringify(backup));
    expect(parsed).toEqual(backup);
    expect(parsed).not.toBe(backup);
    const cloned = parseEncryptedResearchVaultBackup(backup);
    cloned.records[0].ciphertext = "changed";
    expect(backup.records[0].ciphertext).not.toBe("changed");
  });

  it.each(["version", "extraPlaintext", "iterations", "duplicateIds", "tooManyRecords", "noncanonicalBase64", "invalidIv", "invalidSalt", "missingManifest", "unsupportedIdentifier"] as const)("rejects %s before an expensive KDF", async (field) => {
    const changed = structuredClone(backup) as unknown as Record<string, unknown>;
    const typed = changed as unknown as EncryptedResearchVaultBackup;
    if (field === "version") changed.version = 2;
    else if (field === "extraPlaintext") changed.title = "Private title";
    else if (field === "iterations") (typed.header.kdf as { iterations: number }).iterations = 1_000_000_000;
    else if (field === "duplicateIds") typed.records.push(structuredClone(typed.records[0]));
    else if (field === "tooManyRecords") typed.records = Array.from({ length: 26 }, () => ({ ...typed.records[0], id: crypto.randomUUID() }));
    else if (field === "noncanonicalBase64") typed.header.kdf.salt = typed.header.kdf.salt.slice(0, -3) + "B==";
    else if (field === "invalidIv") typed.manifest.iv = encodeVaultBackupBytes(new ArrayBuffer(13));
    else if (field === "invalidSalt") typed.header.kdf.salt = encodeVaultBackupBytes(new ArrayBuffer(15));
    else if (field === "missingManifest") delete changed.manifest;
    else typed.backupId = "not-a-supported-uuid";
    const derive = vi.spyOn(crypto.subtle, "deriveKey");
    expect(() => parseEncryptedResearchVaultBackup(changed)).toThrow(EncryptedResearchVaultBackupError);
    await expect(restoreEncryptedResearchVaultBackup(changed, PASSPHRASE)).rejects.toMatchObject({ code: "invalid-vault" });
    expect(derive).not.toHaveBeenCalled();
  });

  it("bounds JSON text before parsing and bounds ciphertext before decoding", () => {
    expect(() => parseEncryptedResearchVaultBackup("x".repeat(ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxEncodedBytes + 1))).toThrow(EncryptedResearchVaultBackupError);
    const changed = structuredClone(backup);
    changed.records[0].ciphertext = "A".repeat(Math.ceil(ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxRecordCiphertextBytes / 3) * 4 + 4);
    expect(() => parseEncryptedResearchVaultBackup(changed)).toThrow(EncryptedResearchVaultBackupError);
  });
});
