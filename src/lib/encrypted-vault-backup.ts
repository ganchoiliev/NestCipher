/** Portable ciphertext only. Validation here does not authenticate or decrypt it. */
export const ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS = {
  maxEncodedBytes: 72 * 1024 * 1024,
  maxRecords: 25,
  maxRecordCiphertextBytes: 5 * 1024 * 1024 + 8192 + 16,
  maxTotalCiphertextBytes: 50 * 1024 * 1024 + 25 * (8192 + 16),
  maxManifestCiphertextBytes: 16 * 1024,
} as const;

export type EncryptedVaultCipher = { iv: string; ciphertext: string };
export interface EncryptedResearchVaultBackup {
  format: "nestcipher-encrypted-research-vault";
  version: 1;
  backupId: string;
  header: {
    format: 1;
    vaultId: string;
    kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: 600000; salt: string };
    check: EncryptedVaultCipher;
  };
  manifest: EncryptedVaultCipher;
  records: Array<EncryptedVaultCipher & { id: string; writeToken: string }>;
}

export class EncryptedResearchVaultBackupError extends Error {
  constructor(message = "The encrypted vault backup is invalid or unsupported.") {
    super(message);
    this.name = "EncryptedResearchVaultBackupError";
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function invalid(): never { throw new EncryptedResearchVaultBackupError(); }
function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) invalid();
  return value;
}

/** Strict canonical base64, checked without allocating its decoded bytes. */
function base64(value: unknown, minimum: number, maximum = minimum): { text: string; bytes: number } {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0
    || value.length > Math.ceil(maximum / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) invalid();
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const bytes = value.length / 4 * 3 - padding;
  if (bytes < minimum || bytes > maximum) invalid();
  const final = alphabet.indexOf(value[value.length - padding - 1]);
  if ((padding === 2 && (final & 15) !== 0) || (padding === 1 && (final & 3) !== 0)) invalid();
  return { text: value, bytes };
}
function cipher(value: unknown, maximum: number): { value: EncryptedVaultCipher; bytes: number } {
  if (!object(value, ["iv", "ciphertext"])) invalid();
  const iv = base64(value.iv, 12);
  const ciphertext = base64(value.ciphertext, 16, maximum);
  return { value: { iv: iv.text, ciphertext: ciphertext.text }, bytes: ciphertext.bytes };
}

/** Accept JSON text or an already parsed value; return a detached, bounded wire object. */
export function parseEncryptedResearchVaultBackup(input: unknown): EncryptedResearchVaultBackup {
  let value: unknown = input;
  if (typeof input === "string") {
    if (input.length > ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxEncodedBytes
      || new TextEncoder().encode(input).byteLength > ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxEncodedBytes) invalid();
    try { value = JSON.parse(input); } catch { invalid(); }
  }
  if (!object(value, ["format", "version", "backupId", "header", "manifest", "records"])
    || value.format !== "nestcipher-encrypted-research-vault" || value.version !== 1
    || !object(value.header, ["format", "vaultId", "kdf", "check"]) || value.header.format !== 1
    || !object(value.header.kdf, ["name", "hash", "iterations", "salt"])
    || value.header.kdf.name !== "PBKDF2" || value.header.kdf.hash !== "SHA-256" || value.header.kdf.iterations !== 600000
    || !Array.isArray(value.records) || value.records.length > ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxRecords) invalid();
  const backupId = identifier(value.backupId);
  const vaultId = identifier(value.header.vaultId);
  const salt = base64(value.header.kdf.salt, 16).text;
  const check = cipher(value.header.check, 512).value;
  const manifest = cipher(value.manifest, ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxManifestCiphertextBytes).value;
  const ids = new Set<string>();
  let total = 0;
  const records = value.records.map((record: unknown) => {
    if (!object(record, ["id", "writeToken", "iv", "ciphertext"])) invalid();
    const id = identifier(record.id);
    const writeToken = identifier(record.writeToken);
    if (ids.has(id)) invalid();
    ids.add(id);
    const checked = cipher({ iv: record.iv, ciphertext: record.ciphertext }, ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxRecordCiphertextBytes);
    total += checked.bytes;
    if (total > ENCRYPTED_RESEARCH_VAULT_BACKUP_LIMITS.maxTotalCiphertextBytes) invalid();
    return { id, writeToken, ...checked.value };
  });
  return {
    format: "nestcipher-encrypted-research-vault", version: 1, backupId,
    header: { format: 1, vaultId, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt }, check },
    manifest, records,
  };
}

export function encodeVaultBackupBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

/** Call only with base64 accepted by parseEncryptedResearchVaultBackup. */
export function decodeVaultBackupBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}
