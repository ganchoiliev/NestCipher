import { restoreExperiment, validateExperiment, LIMITS, type Experiment } from "./research-workbench";
import {
  parseEncryptedResearchVaultBackup, encodeVaultBackupBytes, decodeVaultBackupBytes,
  type EncryptedResearchVaultBackup, type EncryptedVaultCipher,
} from "./encrypted-vault-backup";

/** Local encryption at rest, not isolation from other scripts on this origin. */
export const RESEARCH_VAULT_LIMITS = {
  maxRecords: 25,
  maxPlaintextBytes: 50 * 1024 * 1024,
  minPassphraseLength: 16,
  maxPassphraseBytes: 1024,
} as const;

export type ResearchVaultErrorCode =
  | "unavailable" | "blocked" | "invalid-vault" | "unlock-failed"
  | "locked" | "cancelled" | "conflict" | "limit" | "storage";

export class ResearchVaultError extends Error {
  constructor(readonly code: ResearchVaultErrorCode, message: string) {
    super(message);
    this.name = "ResearchVaultError";
  }
}

export interface SavedExperimentSummary {
  id: string;
  title: string;
  attemptCount: number;
  savedAt: string;
  updatedAt: string;
  revision: number;
}

export interface ResearchVaultSession {
  list(): Promise<SavedExperimentSummary[]>;
  save(experiment: Experiment, expectedRevision: number | null): Promise<SavedExperimentSummary>;
  open(id: string): Promise<{ experiment: Experiment; summary: SavedExperimentSummary }>;
  remove(id: string, expectedRevision: number): Promise<void>;
  exportEncryptedBackup(): Promise<EncryptedResearchVaultBackup>;
  lock(): void;
}

const DATABASE = "nestcipher-research-vault";
const DATABASE_VERSION = 1;
const FORMAT_VERSION = 1;
const META = "meta";
const RECORDS = "records";
const HEADER_KEY = "header";
const ITERATIONS = 600_000;
const PAYLOAD_OVERHEAD = 8192;
const MAX_PAYLOAD = LIMITS.maxEncodedBytes + PAYLOAD_OVERHEAD;
const MAX_CIPHERTEXT = MAX_PAYLOAD + 16;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type Cipher = { iv: ArrayBuffer; ciphertext: ArrayBuffer };
type VaultHeader = {
  format: 1;
  vaultId: string;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: ArrayBuffer };
  check: Cipher;
};
// IDs and a random compare-and-swap token are the only clear record metadata.
// The title, times, revision, content and disclosure policy are encrypted.
type RecordEnvelope = Cipher & { id: string; writeToken: string };
type StoredPayload = { format: 1; experiment: Experiment; summary: SavedExperimentSummary };
type DecryptedRecord = StoredPayload & { envelope: RecordEnvelope; plaintextBytes: number };
type Snapshot = { header: VaultHeader | undefined; envelopes: RecordEnvelope[] };

function fail(code: ResearchVaultErrorCode, message: string): never {
  throw new ResearchVaultError(code, message);
}

function storageError(reason: unknown): ResearchVaultError {
  if (reason instanceof ResearchVaultError) return reason;
  if (reason instanceof Error && reason.name === "VersionError") {
    return new ResearchVaultError("invalid-vault", "This browser vault uses an unsupported database version. Nothing was changed.");
  }
  if (reason instanceof Error && reason.name === "QuotaExceededError") {
    return new ResearchVaultError("storage", "Browser storage is full. The saved copy was not replaced; keep or download your current draft.");
  }
  return new ResearchVaultError("storage", "Browser storage could not complete this operation. Your working draft is unchanged.");
}

function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function buffer(value: unknown, minimum: number, maximum = minimum): value is ArrayBuffer {
  return value instanceof ArrayBuffer && value.byteLength >= minimum && value.byteLength <= maximum;
}

function sameBuffer(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const right = new Uint8Array(b);
  return new Uint8Array(a).every((value, index) => value === right[index]);
}

function validateCipher(value: unknown, maxBytes: number): value is Cipher {
  return object(value, ["iv", "ciphertext"]) && buffer(value.iv, 12)
    && buffer(value.ciphertext, 16, maxBytes);
}

function parseHeader(value: unknown): VaultHeader {
  if (!object(value, ["format", "vaultId", "kdf", "check"]) || value.format !== FORMAT_VERSION
    || typeof value.vaultId !== "string" || !uuid.test(value.vaultId)
    || !object(value.kdf, ["name", "hash", "iterations", "salt"])
    || value.kdf.name !== "PBKDF2" || value.kdf.hash !== "SHA-256"
    || value.kdf.iterations !== ITERATIONS || !buffer(value.kdf.salt, 16)
    || !validateCipher(value.check, 512)) {
    fail("invalid-vault", "The saved vault header is invalid or unsupported. Nothing was changed.");
  }
  return value as unknown as VaultHeader;
}

function parseEnvelope(value: unknown): RecordEnvelope {
  if (!object(value, ["id", "writeToken", "iv", "ciphertext"])
    || typeof value.id !== "string" || !uuid.test(value.id)
    || typeof value.writeToken !== "string" || !uuid.test(value.writeToken)
    || !buffer(value.iv, 12) || !buffer(value.ciphertext, 16, MAX_CIPHERTEXT)) {
    fail("invalid-vault", "A saved record is invalid or exceeds the supported size. Nothing was changed.");
  }
  return value as unknown as RecordEnvelope;
}

function cryptography(): Crypto {
  try {
    const provider = globalThis.crypto;
    if (provider?.subtle && typeof provider.getRandomValues === "function" && typeof provider.randomUUID === "function") return provider;
  } catch { /* A denied API is unavailable. */ }
  fail("unavailable", "Browser encryption is unavailable. Use an HTTPS page in a supported browser; your draft remains in memory.");
}

function validatePassphrase(passphrase: string): Uint8Array<ArrayBuffer> {
  if (typeof passphrase !== "string" || passphrase.length < RESEARCH_VAULT_LIMITS.minPassphraseLength || !passphrase.trim()) {
    fail("limit", "Use a unique passphrase of at least 16 characters, including a non-space character.");
  }
  const bytes = encoder.encode(passphrase);
  if (bytes.byteLength > RESEARCH_VAULT_LIMITS.maxPassphraseBytes) {
    fail("limit", "The passphrase exceeds the 1024-byte UTF-8 limit.");
  }
  return bytes;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer, check?: () => void): Promise<CryptoKey> {
  check?.();
  const provider = cryptography();
  const bytes = validatePassphrase(passphrase);
  try {
    const material = await provider.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveKey"]);
    check?.();
    const key = await provider.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
    check?.();
    return key;
  } catch (error) {
    if (error instanceof ResearchVaultError) throw error;
    fail("unavailable", "Browser encryption could not derive the vault key. Your working draft and saved copies are unchanged.");
  } finally {
    // Best effort for this temporary byte buffer. JavaScript cannot guarantee
    // erasure of the original string or all runtime copies.
    bytes.fill(0);
  }
}

function associatedData(header: VaultHeader, id: string, token: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(["nestcipher-research-vault", FORMAT_VERSION, header.vaultId, id, token]));
}

async function encrypt(key: CryptoKey, text: string, additionalData: Uint8Array<ArrayBuffer>): Promise<Cipher> {
  const provider = cryptography();
  try {
    const iv = provider.getRandomValues(new Uint8Array(12));
    const ciphertext = await provider.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, encoder.encode(text));
    return { iv: iv.buffer, ciphertext };
  } catch {
    fail("unavailable", "Browser encryption could not prepare the saved copy. Your working draft and saved copies are unchanged.");
  }
}

async function decrypt(key: CryptoKey, cipher: Cipher, additionalData: Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = await cryptography().subtle.decrypt({ name: "AES-GCM", iv: cipher.iv, additionalData, tagLength: 128 }, key, cipher.ciphertext);
  return decoder.decode(bytes);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let factory: IDBFactory | undefined;
    try { factory = globalThis.indexedDB; } catch { /* Browser privacy settings can deny access. */ }
    if (!factory) {
      reject(new ResearchVaultError("unavailable", "Browser storage is unavailable. You can continue in memory and download a private backup."));
      return;
    }
    let settled = false;
    let request: IDBOpenDBRequest;
    try { request = factory.open(DATABASE, DATABASE_VERSION); }
    catch (reason) { reject(storageError(reason)); return; }
    request.onblocked = () => {
      settled = true;
      reject(new ResearchVaultError("blocked", "Another tab is blocking the vault database. Close that tab and retry; your draft is unchanged."));
    };
    request.onupgradeneeded = (event) => {
      if (settled) { request.transaction?.abort(); return; }
      if (event.oldVersion === 0) {
        request.result.createObjectStore(META);
        request.result.createObjectStore(RECORDS, { keyPath: "id" });
      }
    };
    request.onerror = () => { settled = true; reject(storageError(request.error)); };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      if (!database.objectStoreNames.contains(META) || !database.objectStoreNames.contains(RECORDS)) {
        database.close();
        settled = true;
        reject(new ResearchVaultError("invalid-vault", "The saved vault database is unsupported. Nothing was changed."));
        return;
      }
      database.onversionchange = () => database.close();
      settled = true;
      resolve(database);
    };
  });
}

type TransactionGuard = { check(): void; track(transaction: IDBTransaction): () => void };

/** Resolve only on transaction completion, never a single request's success. */
function transaction<T>(
  database: IDBDatabase, mode: IDBTransactionMode,
  work: (tx: IDBTransaction, setResult: (result: T) => void, abort: (reason: unknown) => void) => void,
  guard?: TransactionGuard,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    let untrack = () => {};
    let result: T;
    let failure: unknown;
    try {
      guard?.check();
      tx = database.transaction([META, RECORDS], mode);
      untrack = guard?.track(tx) ?? untrack;
    } catch (reason) { reject(storageError(reason)); return; }
    const abort = (reason: unknown) => {
      failure = reason;
      try { tx.abort(); } catch { /* The transaction already finished. */ }
    };
    tx.onabort = () => {
      untrack();
      try { guard?.check(); reject(storageError(failure ?? tx.error)); }
      catch (reason) { reject(storageError(reason)); }
    };
    tx.onerror = () => { failure ??= tx.error; };
    tx.oncomplete = () => {
      untrack();
      try { guard?.check(); resolve(result); } catch (reason) { reject(storageError(reason)); }
    };
    try { work(tx, (value) => { result = value; }, abort); }
    catch (reason) { abort(reason); }
  });
}

function readSnapshot(database: IDBDatabase, guard?: TransactionGuard): Promise<Snapshot> {
  return transaction(database, "readonly", (tx, setResult, abort) => {
    let header: VaultHeader | undefined;
    let envelopes: RecordEnvelope[] = [];
    let complete = 0;
    const finish = () => { if (++complete === 2) setResult({ header, envelopes }); };
    const headerRequest = tx.objectStore(META).get(HEADER_KEY);
    headerRequest.onsuccess = () => {
      try { header = headerRequest.result === undefined ? undefined : parseHeader(headerRequest.result); finish(); }
      catch (reason) { abort(reason); }
    };
    const recordsRequest = tx.objectStore(RECORDS).getAll(undefined, RESEARCH_VAULT_LIMITS.maxRecords + 1);
    recordsRequest.onsuccess = () => {
      try {
        if (recordsRequest.result.length > RESEARCH_VAULT_LIMITS.maxRecords) fail("invalid-vault", "The saved vault exceeds the 25-record limit. Nothing was changed.");
        envelopes = recordsRequest.result.map(parseEnvelope);
        const total = envelopes.reduce((sum, record) => sum + record.ciphertext.byteLength, 0);
        if (total > RESEARCH_VAULT_LIMITS.maxPlaintextBytes + RESEARCH_VAULT_LIMITS.maxRecords * (PAYLOAD_OVERHEAD + 16)) {
          fail("invalid-vault", "The saved vault exceeds the supported storage limit. Nothing was changed.");
        }
        finish();
      } catch (reason) { abort(reason); }
    };
  }, guard);
}

function sameHeader(actual: VaultHeader | undefined, expected: VaultHeader): boolean {
  return actual !== undefined && actual.vaultId === expected.vaultId
    && sameBuffer(actual.kdf.salt, expected.kdf.salt)
    && sameBuffer(actual.check.iv, expected.check.iv)
    && sameBuffer(actual.check.ciphertext, expected.check.ciphertext);
}

function readPayload(text: string, envelope: RecordEnvelope): StoredPayload {
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail("invalid-vault", "A saved record is not a supported private experiment. Nothing was changed."); }
  if (!object(value, ["format", "experiment", "summary"]) || value.format !== FORMAT_VERSION
    || !object(value.summary, ["id", "title", "attemptCount", "savedAt", "updatedAt", "revision"])) {
    fail("invalid-vault", "A saved record has an unsupported structure. Nothing was changed.");
  }
  const restored = restoreExperiment(JSON.stringify(value.experiment));
  if (!restored.ok) fail("invalid-vault", "A saved experiment is invalid or unsupported. Nothing was changed.");
  const summary = value.summary;
  if (summary.id !== envelope.id || restored.experiment.id !== envelope.id
    || summary.title !== restored.experiment.title || summary.attemptCount !== restored.experiment.attempts.length
    || summary.updatedAt !== restored.experiment.updatedAt
    || typeof summary.savedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(summary.savedAt)
    || !Number.isFinite(Date.parse(summary.savedAt)) || new Date(summary.savedAt).toISOString() !== summary.savedAt
    || !Number.isSafeInteger(summary.revision) || (summary.revision as number) < 1) {
    fail("invalid-vault", "A saved record has inconsistent metadata. Nothing was changed.");
  }
  return { format: FORMAT_VERSION, experiment: restored.experiment, summary: summary as unknown as SavedExperimentSummary };
}

function encodedCipher(value: Cipher): EncryptedVaultCipher {
  return { iv: encodeVaultBackupBytes(value.iv), ciphertext: encodeVaultBackupBytes(value.ciphertext) };
}

function decodedCipher(value: EncryptedVaultCipher): Cipher {
  return { iv: decodeVaultBackupBytes(value.iv), ciphertext: decodeVaultBackupBytes(value.ciphertext) };
}

function manifestPayload(envelopes: RecordEnvelope[]) {
  return {
    format: "nestcipher-encrypted-vault-manifest", version: FORMAT_VERSION,
    records: envelopes.map(({ id, writeToken }) => ({ id, writeToken })),
  };
}

function checkManifest(text: string, envelopes: RecordEnvelope[]): void {
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail("invalid-vault", "The encrypted backup manifest is invalid. Nothing was changed."); }
  if (!object(value, ["format", "version", "records"]) || value.format !== "nestcipher-encrypted-vault-manifest"
    || value.version !== FORMAT_VERSION || !Array.isArray(value.records) || value.records.length !== envelopes.length
    || value.records.some((record: unknown, index: number) => !object(record, ["id", "writeToken"])
      || record.id !== envelopes[index].id || record.writeToken !== envelopes[index].writeToken)) {
    fail("invalid-vault", "The encrypted backup record set is incomplete or changed. Nothing was changed.");
  }
}

function createSession(database: IDBDatabase, header: VaultHeader, initialKey: CryptoKey): ResearchVaultSession {
  let key: CryptoKey | null = initialKey;
  let epoch = 0;
  let queue: Promise<void> = Promise.resolve();
  const transactions = new Set<IDBTransaction>();
  const check = () => { if (!key) fail("locked", "The vault is locked. Unlock it again; your working draft was not changed."); };
  const guard: TransactionGuard = {
    check,
    track(tx) { transactions.add(tx); return () => transactions.delete(tx); },
  };
  function schedule<T>(work: () => Promise<T>): Promise<T> {
    const startedAt = epoch;
    const task = queue.then(async () => {
      check();
      if (startedAt !== epoch) fail("locked", "The vault was locked before this operation completed.");
      try {
        const result = await work();
        check();
        if (startedAt !== epoch) fail("locked", "The vault was locked before this operation completed.");
        return result;
      } catch (reason) { throw storageError(reason); }
    });
    queue = task.then(() => {}, () => {});
    return task;
  }
  async function decryptedSnapshot(): Promise<{ snapshot: Snapshot; records: DecryptedRecord[] }> {
    const snapshot = await readSnapshot(database, guard);
    check();
    if (!sameHeader(snapshot.header, header)) fail("invalid-vault", "The saved vault changed unexpectedly. Lock it and retry; nothing was overwritten.");
    const records: DecryptedRecord[] = [];
    let total = 0;
    for (const envelope of snapshot.envelopes) {
      check();
      let text: string;
      try { text = await decrypt(key!, envelope, associatedData(header, envelope.id, envelope.writeToken)); }
      catch { check(); fail("invalid-vault", "A saved record could not be authenticated. Nothing was changed."); }
      check();
      const plaintextBytes = encoder.encode(text).byteLength;
      total += plaintextBytes;
      if (plaintextBytes > MAX_PAYLOAD || total > RESEARCH_VAULT_LIMITS.maxPlaintextBytes) {
        fail("invalid-vault", "The saved vault exceeds the supported plaintext limit. Nothing was changed.");
      }
      records.push({ ...readPayload(text, envelope), envelope, plaintextBytes });
    }
    return { snapshot, records };
  }

  async function writeChange(snapshot: Snapshot, work: (store: IDBObjectStore) => void): Promise<void> {
    await transaction<void>(database, "readwrite", (tx, setResult, abort) => {
      const currentHeader = tx.objectStore(META).get(HEADER_KEY);
      currentHeader.onsuccess = () => {
        try {
          check();
          const parsed = currentHeader.result === undefined ? undefined : parseHeader(currentHeader.result);
          if (!sameHeader(parsed, header)) fail("conflict", "The vault changed in another tab. Lock and unlock it before trying again.");
          const store = tx.objectStore(RECORDS);
          const request = store.getAll(undefined, RESEARCH_VAULT_LIMITS.maxRecords + 1);
          request.onsuccess = () => {
            try {
              check();
              const current = request.result.map(parseEnvelope);
              const before = new Map(snapshot.envelopes.map((record) => [record.id, record]));
              if (current.length !== before.size || current.some((record) => {
                const previous = before.get(record.id);
                return !previous || previous.writeToken !== record.writeToken
                  || !sameBuffer(previous.iv, record.iv) || !sameBuffer(previous.ciphertext, record.ciphertext);
              })) {
                fail("conflict", "Saved records changed in another tab. Refresh the saved list and review the latest copy before saving again.");
              }
              work(store);
              setResult(undefined);
            } catch (reason) { abort(reason); }
          };
        } catch (reason) { abort(reason); }
      };
    }, guard);
  }

  return {
    list() {
      return schedule(async () => {
        const { records } = await decryptedSnapshot();
        return records.map((record) => ({ ...record.summary })).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      });
    },
    async save(experiment, expectedRevision) {
      check();
      const checked = validateExperiment(experiment);
      if (!checked.ok) fail("limit", "The experiment is invalid or exceeds the supported limits. Your draft and saved copy are unchanged.");
      if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
        fail("conflict", "A valid saved revision is required to replace an existing record.");
      }
      const captured = checked.experiment;
      return schedule(async () => {
        const { snapshot, records } = await decryptedSnapshot();
        const existing = records.find((record) => record.summary.id === captured.id);
        if (expectedRevision === null ? existing !== undefined : existing?.summary.revision !== expectedRevision) {
          fail("conflict", "The saved revision differs from this draft. Open the latest copy or save a new experiment; nothing was overwritten.");
        }
        if (!existing && records.length >= RESEARCH_VAULT_LIMITS.maxRecords) fail("limit", "The vault holds up to 25 saved experiments. Download or remove a saved copy before adding another.");
        const revision = (existing?.summary.revision ?? 0) + 1;
        if (!Number.isSafeInteger(revision)) fail("limit", "The saved revision limit has been reached. Save this as a new experiment.");
        const summary: SavedExperimentSummary = {
          id: captured.id, title: captured.title, attemptCount: captured.attempts.length,
          savedAt: new Date().toISOString(), updatedAt: captured.updatedAt, revision,
        };
        const text = JSON.stringify({ format: FORMAT_VERSION, experiment: captured, summary } satisfies StoredPayload);
        const bytes = encoder.encode(text).byteLength;
        if (bytes > MAX_PAYLOAD || records.reduce((total, record) => total + record.plaintextBytes, 0) - (existing?.plaintextBytes ?? 0) + bytes > RESEARCH_VAULT_LIMITS.maxPlaintextBytes) {
          fail("limit", "The vault's 50 MiB plaintext limit would be exceeded. Your saved copy is unchanged; download a backup or remove another saved copy.");
        }
        const writeToken = cryptography().randomUUID();
        const cipher = await encrypt(key!, text, associatedData(header, captured.id, writeToken));
        check();
        const envelope: RecordEnvelope = { id: captured.id, writeToken, ...cipher };
        await writeChange(snapshot, (store) => { store.put(envelope); });
        return { ...summary };
      });
    },
    open(id) {
      return schedule(async () => {
        if (!uuid.test(id)) fail("conflict", "Choose a saved experiment from the vault list.");
        const { records } = await decryptedSnapshot();
        const record = records.find((item) => item.summary.id === id);
        if (!record) fail("conflict", "This saved experiment is no longer available. Refresh the saved list.");
        return { experiment: record.experiment, summary: { ...record.summary } };
      });
    },
    remove(id, expectedRevision) {
      return schedule(async () => {
        const { snapshot, records } = await decryptedSnapshot();
        const record = records.find((item) => item.summary.id === id);
        if (!uuid.test(id) || !Number.isSafeInteger(expectedRevision) || record?.summary.revision !== expectedRevision) {
          fail("conflict", "The saved revision changed or is no longer available. Refresh the saved list before removing it.");
        }
        await writeChange(snapshot, (store) => { store.delete(id); });
      });
    },
    exportEncryptedBackup() {
      return schedule(async () => {
        // Authenticate the saved snapshot before transporting any ciphertext.
        const { snapshot } = await decryptedSnapshot();
        const backupId = cryptography().randomUUID();
        const manifest = await encrypt(key!, JSON.stringify(manifestPayload(snapshot.envelopes)), associatedData(header, "backup-manifest", backupId));
        check();
        return parseEncryptedResearchVaultBackup({
          format: "nestcipher-encrypted-research-vault", version: 1, backupId,
          header: {
            format: header.format, vaultId: header.vaultId,
            kdf: { ...header.kdf, salt: encodeVaultBackupBytes(header.kdf.salt) },
            check: encodedCipher(header.check),
          },
          manifest: encodedCipher(manifest),
          records: snapshot.envelopes.map(({ id, writeToken, ...cipher }) => ({ id, writeToken, ...encodedCipher(cipher) })),
        });
      });
    },
    lock() {
      key = null;
      epoch++;
      for (const tx of transactions) { try { tx.abort(); } catch { /* Already completed. */ } }
      transactions.clear();
      database.close();
    },
  };
}

export async function inspectResearchVault(): Promise<{ exists: boolean }> {
  const database = await openDatabase();
  try {
    const { header, envelopes } = await readSnapshot(database);
    if (!header && envelopes.length) fail("invalid-vault", "Saved records exist without a supported vault header. Nothing was changed.");
    return { exists: header !== undefined };
  } finally { database.close(); }
}

export async function createResearchVault(passphrase: string): Promise<ResearchVaultSession> {
  validatePassphrase(passphrase).fill(0);
  const provider = cryptography();
  let salt: ArrayBuffer;
  let vaultId: string;
  try {
    salt = provider.getRandomValues(new Uint8Array(16)).buffer;
    vaultId = provider.randomUUID();
  } catch { fail("unavailable", "Browser encryption could not generate vault randomness. Your draft and saved copies are unchanged."); }
  const key = await deriveKey(passphrase, salt);
  const header: VaultHeader = {
    format: FORMAT_VERSION, vaultId,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt },
    check: { iv: new ArrayBuffer(12), ciphertext: new ArrayBuffer(16) },
  };
  header.check = await encrypt(key, "nestcipher-private-research-vault", associatedData(header, "check", "check"));
  const database = await openDatabase();
  try {
    await transaction<void>(database, "readwrite", (tx, setResult, abort) => {
      const request = tx.objectStore(META).get(HEADER_KEY);
      request.onsuccess = () => {
        try {
          if (request.result !== undefined) { abort(new ResearchVaultError("conflict", "A vault already exists in this browser. Unlock it; it was not replaced.")); return; }
          const records = tx.objectStore(RECORDS).count();
          records.onsuccess = () => {
            try {
              if (records.result) { abort(new ResearchVaultError("invalid-vault", "Saved records already exist without a supported header. Nothing was changed.")); return; }
              tx.objectStore(META).add(header, HEADER_KEY);
              setResult(undefined);
            } catch (reason) { abort(reason); }
          };
        } catch (reason) { abort(reason); }
      };
    });
    return createSession(database, header, key);
  } catch (reason) { database.close(); throw storageError(reason); }
}

export async function unlockResearchVault(passphrase: string): Promise<ResearchVaultSession> {
  validatePassphrase(passphrase).fill(0);
  cryptography();
  const database = await openDatabase();
  try {
    const { header } = await readSnapshot(database);
    if (!header) fail("invalid-vault", "There is no supported vault in this browser yet. Your draft is unchanged.");
    const key = await deriveKey(passphrase, header.kdf.salt);
    try {
      const check = await decrypt(key, header.check, associatedData(header, "check", "check"));
      if (check !== "nestcipher-private-research-vault") throw new Error("Invalid check");
    } catch { fail("unlock-failed", "The passphrase could not unlock this vault, or its saved header was damaged. Nothing was changed."); }
    return createSession(database, header, key);
  } catch (reason) { database.close(); throw storageError(reason); }
}

/** Authenticate first, then atomically install only into an absent local vault. No merge or replacement. */
export async function restoreEncryptedResearchVaultBackup(
  backup: unknown, passphrase: string, options: { signal?: AbortSignal } = {},
): Promise<ResearchVaultSession> {
  const signal = options.signal;
  const checkCancelled = () => {
    if (signal?.aborted) fail("cancelled", "Encrypted backup restoration was cancelled before installation completed.");
  };
  checkCancelled();
  let checked: EncryptedResearchVaultBackup;
  try { checked = parseEncryptedResearchVaultBackup(backup); }
  catch { fail("invalid-vault", "The encrypted vault backup is invalid, unsupported or too large. Nothing was changed."); }
  validatePassphrase(passphrase).fill(0);
  const header: VaultHeader = {
    format: checked.header.format, vaultId: checked.header.vaultId,
    kdf: { ...checked.header.kdf, salt: decodeVaultBackupBytes(checked.header.kdf.salt) },
    check: decodedCipher(checked.header.check),
  };
  const envelopes: RecordEnvelope[] = checked.records.map(({ id, writeToken, ...cipher }) => ({ id, writeToken, ...decodedCipher(cipher) }));
  checkCancelled();
  const key = await deriveKey(passphrase, header.kdf.salt, checkCancelled);
  try {
    const check = await decrypt(key, header.check, associatedData(header, "check", "check"));
    checkCancelled();
    if (check !== "nestcipher-private-research-vault") throw new Error("Invalid check");
  } catch { checkCancelled(); fail("unlock-failed", "The passphrase could not unlock this encrypted backup, or its header was damaged. Nothing was changed."); }
  let manifest: string;
  try { manifest = await decrypt(key, decodedCipher(checked.manifest), associatedData(header, "backup-manifest", checked.backupId)); checkCancelled(); }
  catch { checkCancelled(); fail("invalid-vault", "The encrypted backup manifest could not be authenticated. Nothing was changed."); }
  checkManifest(manifest, envelopes);
  let total = 0;
  for (const envelope of envelopes) {
    let text: string;
    checkCancelled();
    try { text = await decrypt(key, envelope, associatedData(header, envelope.id, envelope.writeToken)); checkCancelled(); }
    catch { checkCancelled(); fail("invalid-vault", "An encrypted backup record could not be authenticated. Nothing was changed."); }
    const bytes = encoder.encode(text).byteLength;
    total += bytes;
    if (bytes > MAX_PAYLOAD || total > RESEARCH_VAULT_LIMITS.maxPlaintextBytes) fail("invalid-vault", "The encrypted backup exceeds the supported plaintext limit. Nothing was changed.");
    readPayload(text, envelope);
  }
  checkCancelled();
  const database = await openDatabase();
  try {
    checkCancelled();
    let committed = false;
    const guard: TransactionGuard = {
      check() { if (!committed) checkCancelled(); },
      track(tx) {
        const abort = () => { try { tx.abort(); } catch { /* An already committed transaction cannot be undone. */ } };
        const complete = () => { committed = true; };
        signal?.addEventListener("abort", abort, { once: true });
        tx.addEventListener("complete", complete, { once: true });
        return () => { signal?.removeEventListener("abort", abort); tx.removeEventListener("complete", complete); };
      },
    };
    await transaction<void>(database, "readwrite", (tx, setResult, abort) => {
      const request = tx.objectStore(META).get(HEADER_KEY);
      request.onsuccess = () => {
        try {
          checkCancelled();
          if (request.result !== undefined) { abort(new ResearchVaultError("conflict", "A vault already exists in this browser. It was not replaced or merged.")); return; }
          const records = tx.objectStore(RECORDS).count();
          records.onsuccess = () => {
            try {
              checkCancelled();
              if (records.result) { abort(new ResearchVaultError("invalid-vault", "Saved records already exist in this browser. Nothing was changed.")); return; }
              tx.objectStore(META).add(header, HEADER_KEY);
              for (const envelope of envelopes) tx.objectStore(RECORDS).add(envelope);
              setResult(undefined);
            } catch (reason) { abort(reason); }
          };
        } catch (reason) { abort(reason); }
      };
    }, guard);
    return createSession(database, header, key);
  } catch (reason) { database.close(); throw storageError(reason); }
}
