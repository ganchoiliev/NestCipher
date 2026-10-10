import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { createAttempt, createExperiment, createSyntheticExperiment, withChallenge } from "../research-workbench";
import {
  createResearchVault, inspectResearchVault, unlockResearchVault,
  ResearchVaultError, RESEARCH_VAULT_LIMITS, type ResearchVaultSession,
} from "../research-vault";

const PASSPHRASE = "four uncommon words for this local vault";
const OTHER_PASSPHRASE = "a different long private vault phrase";
const DATABASE = "nestcipher-research-vault";
const sessions: ResearchVaultSession[] = [];
const connections: IDBDatabase[] = [];
const encoder = new TextEncoder();
const keep = (session: ResearchVaultSession) => { sessions.push(session); return session; };
const fixture = () => {
  const experiment = createSyntheticExperiment();
  experiment.title = "CONFIDENTIAL TITLE — no clear metadata";
  experiment.attempts[0].input = "Private evidence\r\n  \u200B<script>doNotExecute()</script>\uD800";
  return withChallenge(experiment, { name: "PRIVATE CHALLENGE", endsAt: "2026-10-10T12:00:00.000Z", endConfirmed: true });
};

async function rawDatabase() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  connections.push(database);
  return database;
}

async function rawRead(store: string, key?: string) {
  const database = await rawDatabase();
  return new Promise<unknown>((resolve, reject) => {
    const tx = database.transaction(store);
    const request = key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
    let value: unknown;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(tx.error);
  });
}

async function rawWrite(store: string, value: unknown, key?: string) {
  const database = await rawDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

type RawRecord = { id: string; writeToken: string; iv: ArrayBuffer; ciphertext: ArrayBuffer };
type RawHeader = { format: number; vaultId: string; kdf: { iterations: number; salt: ArrayBuffer }; check: { iv: ArrayBuffer; ciphertext: ArrayBuffer } };

beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => {
  vi.restoreAllMocks();
  for (const session of sessions.splice(0)) session.lock();
  for (const database of connections.splice(0)) database.close();
  vi.unstubAllGlobals();
});

describe("encrypted local research vault", () => {
  it("starts without a vault and restores exact private evidence after a lock and unlock", async () => {
    expect(await inspectResearchVault()).toEqual({ exists: false });
    const session = keep(await createResearchVault(PASSPHRASE));
    expect(await inspectResearchVault()).toEqual({ exists: true });
    const experiment = fixture();
    const summary = await session.save(experiment, null);
    expect(summary).toMatchObject({ id: experiment.id, title: experiment.title, attemptCount: 2, revision: 1, updatedAt: experiment.updatedAt });
    session.lock();
    const restored = keep(await unlockResearchVault(PASSPHRASE));
    expect(await restored.open(experiment.id)).toEqual({ experiment, summary });
    expect(await restored.list()).toEqual([summary]);
    expect((await restored.open(experiment.id)).experiment.disclosure).toEqual({
      visibility: "private", publish: false,
      challenge: experiment.disclosure.challenge, publicNotBefore: "2026-11-09T12:00:00.000Z",
    });
  });

  it("stores no plaintext title, timestamps, evidence, embargo metadata, revision, passphrase or key", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const [envelope] = await rawRead("records") as RawRecord[];
    const header = await rawRead("meta", "header") as RawHeader;
    expect(Object.keys(envelope).sort()).toEqual(["ciphertext", "id", "iv", "writeToken"]);
    expect(Object.keys(header).sort()).toEqual(["check", "format", "kdf", "vaultId"]);
    const persisted = JSON.stringify({ header, envelope }, (_, value) => value instanceof ArrayBuffer ? [...new Uint8Array(value)] : value);
    for (const privateValue of [experiment.title, experiment.attempts[0].input, "PRIVATE CHALLENGE", PASSPHRASE, experiment.updatedAt, "publicNotBefore", "revision"]) {
      expect(persisted).not.toContain(privateValue);
    }
    expect(header.kdf.iterations).toBe(600_000);
    expect(header.kdf.salt.byteLength).toBe(16);
    expect(envelope.iv.byteLength).toBe(12);
    const derive = vi.spyOn(crypto.subtle, "deriveKey");
    keep(await unlockResearchVault(PASSPHRASE));
    const key = await derive.mock.results[0].value;
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
  });

  it("generates a fresh IV and opaque token for every record and replacement", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const first = fixture();
    const second = fixture();
    await session.save(first, null);
    const [before] = await rawRead("records") as RawRecord[];
    await session.save(first, 1);
    await session.save(second, null);
    const records = await rawRead("records") as RawRecord[];
    const revised = records.find((record) => record.id === first.id)!;
    expect(new Uint8Array(revised.iv)).not.toEqual(new Uint8Array(before.iv));
    expect(revised.writeToken).not.toBe(before.writeToken);
    expect(new Set(records.map((record) => [...new Uint8Array(record.iv)].join(","))).size).toBe(2);
    expect((await session.open(first.id)).summary.revision).toBe(2);
  });

  it("rejects the wrong passphrase and never overwrites an existing vault on create", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const before = await rawRead("meta", "header");
    await expect(unlockResearchVault(OTHER_PASSPHRASE)).rejects.toMatchObject({ code: "unlock-failed" });
    await expect(createResearchVault(OTHER_PASSPHRASE)).rejects.toMatchObject({ code: "conflict" });
    expect(await rawRead("meta", "header")).toEqual(before);
    expect((await session.open(experiment.id)).experiment).toEqual(experiment);
  });

  it("creates atomically when two tabs race with different passphrases", async () => {
    const result = await Promise.allSettled([createResearchVault(PASSPHRASE), createResearchVault(OTHER_PASSPHRASE)]);
    expect(result.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    result.forEach((entry) => { if (entry.status === "fulfilled") keep(entry.value); else expect(entry.reason).toMatchObject({ code: "conflict" }); });
    expect(await inspectResearchVault()).toEqual({ exists: true });
  });

  it("keeps spaces in the actual passphrase and enforces only the documented length limits", async () => {
    const passphrase = "  spaced long passphrase  ";
    keep(await createResearchVault(passphrase));
    await expect(unlockResearchVault(passphrase.trim())).rejects.toMatchObject({ code: "unlock-failed" });
    keep(await unlockResearchVault(passphrase));
    await expect(unlockResearchVault(" ".repeat(20))).rejects.toMatchObject({ code: "limit" });
    await expect(unlockResearchVault("short" )).rejects.toMatchObject({ code: "limit" });
    await expect(unlockResearchVault("🧪".repeat(257))).rejects.toMatchObject({ code: "limit" });
  });

  it("rejects stale saves/deletions and a null revision cannot overwrite a saved ID", async () => {
    const one = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await one.save(experiment, null);
    const two = keep(await unlockResearchVault(PASSPHRASE));
    const changed = structuredClone(experiment);
    changed.title = "A newer saved copy";
    await one.save(changed, 1);
    await expect(two.save(experiment, 1)).rejects.toMatchObject({ code: "conflict" });
    await expect(two.save(experiment, null)).rejects.toMatchObject({ code: "conflict" });
    await expect(two.remove(experiment.id, 1)).rejects.toMatchObject({ code: "conflict" });
    expect((await two.open(experiment.id)).experiment).toEqual(changed);
    await two.remove(experiment.id, 2);
    expect(await two.list()).toEqual([]);
    await expect(one.open(experiment.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("checks the opaque token inside a transaction when two saves start from the same revision", async () => {
    const one = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await one.save(experiment, null);
    const two = keep(await unlockResearchVault(PASSPHRASE));
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(crypto.subtle, "encrypt").mockImplementation(async (algorithm, key, data) => {
      const result = await encrypt(algorithm, key, data);
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
      return result;
    });
    const changed = structuredClone(experiment);
    changed.title = "Concurrent variant";
    const results = await Promise.allSettled([one.save(experiment, 1), two.save(changed, 1)]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((entry) => entry.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe("conflict");
    expect((await one.open(experiment.id)).summary.revision).toBe(2);
  });

  it.each(["ciphertext", "iv", "writeToken", "id"] as const)("authenticates the record's %s and refuses swapped or altered envelopes", async (field) => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const [record] = await rawRead("records") as RawRecord[];
    if (field === "ciphertext" || field === "iv") new Uint8Array(record[field])[0] ^= 1;
    else if (field === "writeToken") record.writeToken = crypto.randomUUID();
    else {
      record.id = crypto.randomUUID();
      const database = await rawDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction("records", "readwrite");
        tx.objectStore("records").clear();
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    }
    await rawWrite("records", record);
    await expect(session.list()).rejects.toMatchObject({ code: "invalid-vault" });
    await expect(session.save(experiment, 1)).rejects.toMatchObject({ code: "invalid-vault" });
  });

  it("cannot swap authenticated ciphertext between two saved records", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    await session.save(fixture(), null);
    await session.save(fixture(), null);
    const [first, second] = await rawRead("records") as RawRecord[];
    await rawWrite("records", { ...first, iv: second.iv, ciphertext: second.ciphertext });
    await expect(session.open(first.id)).rejects.toMatchObject({ code: "invalid-vault" });
  });

  it("bounds hostile header parameters before invoking the expensive KDF", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    session.lock();
    const header = await rawRead("meta", "header") as RawHeader;
    header.kdf.iterations = 1_000_000_000;
    await rawWrite("meta", header, "header");
    const derive = vi.spyOn(crypto.subtle, "deriveKey");
    await expect(unlockResearchVault(PASSPHRASE)).rejects.toMatchObject({ code: "invalid-vault" });
    expect(derive).not.toHaveBeenCalled();
    await expect(inspectResearchVault()).rejects.toMatchObject({ code: "invalid-vault" });
  });

  it("rejects oversize/unsupported experiments without changing the saved record", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const invalid = structuredClone(experiment);
    invalid.attempts[0].input = "x".repeat(100_001);
    await expect(session.save(invalid, 1)).rejects.toMatchObject({ code: "limit" });
    expect((await session.open(experiment.id)).experiment).toEqual(experiment);
    const [record] = await rawRead("records") as RawRecord[];
    await rawWrite("records", { ...record, ciphertext: new ArrayBuffer(6 * 1024 * 1024) });
    await expect(session.list()).rejects.toMatchObject({ code: "invalid-vault" });
  });

  it("limits the number of saved experiments without silently replacing another ID", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    for (let index = 0; index < RESEARCH_VAULT_LIMITS.maxRecords; index++) await session.save(createExperiment(), null);
    await expect(session.save(createExperiment(), null)).rejects.toMatchObject({ code: "limit" });
    expect(await session.list()).toHaveLength(25);
  });

  it("limits total plaintext across individually valid large experiments", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = createExperiment();
    const evidence = "x".repeat(100_000);
    experiment.attempts = Array.from({ length: 7 }, () => {
      const attempt = createAttempt(experiment.defaults);
      return { ...attempt, input: evidence, response: evidence, actions: evidence, notes: evidence,
        assessmentReason: evidence, executionError: evidence, conditions: { ...attempt.conditions, context: evidence } };
    });
    expect(encoder.encode(JSON.stringify(experiment)).byteLength).toBeLessThan(5 * 1024 * 1024);
    for (let index = 0; index < 10; index++) await session.save({ ...experiment, id: crypto.randomUUID() }, null);
    await expect(session.save({ ...experiment, id: crypto.randomUUID() }, null)).rejects.toMatchObject({ code: "limit" });
    expect(await session.list()).toHaveLength(10);
  }, 30_000);

  it("does not report a save when its transaction aborts after the put request", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const changed = { ...experiment, title: "Must not persist" };
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      this.transaction.abort();
      return request;
    });
    await expect(session.save(changed, 1)).rejects.toMatchObject({ code: "storage" });
    spy.mockRestore();
    expect((await session.open(experiment.id)).experiment).toEqual(experiment);
    expect((await session.open(experiment.id)).summary.revision).toBe(1);
  });

  it("handles a quota exception without echoing external error text or overwriting the saved copy", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("PRIVATE PAYLOAD OR PASSPHRASE", "QuotaExceededError");
    });
    let error: unknown;
    try { await session.save({ ...experiment, title: "Unsaved edit" }, 1); } catch (reason) { error = reason; }
    expect(error).toBeInstanceOf(ResearchVaultError);
    expect(error).toMatchObject({ code: "storage" });
    expect((error as Error).message).not.toContain("PRIVATE PAYLOAD OR PASSPHRASE");
    spy.mockRestore();
    expect((await session.open(experiment.id)).experiment).toEqual(experiment);
  });

  it("invalidates operations that were pending when locked and never writes their draft", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let signal!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { signal = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(crypto.subtle, "encrypt").mockImplementation(async (algorithm, key, data) => {
      const cipher = await encrypt(algorithm, key, data);
      signal();
      await pending;
      return cipher;
    });
    const saving = session.save({ ...experiment, title: "Do not save after locking" }, 1);
    const rejected = expect(saving).rejects.toMatchObject({ code: "locked" });
    await entered;
    session.lock();
    release();
    await rejected;
    vi.restoreAllMocks();
    const unlocked = keep(await unlockResearchVault(PASSPHRASE));
    expect((await unlocked.open(experiment.id)).experiment).toEqual(experiment);
    await expect(session.list()).rejects.toMatchObject({ code: "locked" });
    await expect(session.save(experiment, 1)).rejects.toMatchObject({ code: "locked" });
  });

  it("aborts an active write transaction when locked, keeping the last committed revision", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      session.lock();
      return request;
    });
    await expect(session.save({ ...experiment, title: "Uncommitted copy" }, 1)).rejects.toMatchObject({ code: "locked" });
    spy.mockRestore();
    const unlocked = keep(await unlockResearchVault(PASSPHRASE));
    expect((await unlocked.open(experiment.id)).experiment).toEqual(experiment);
    expect((await unlocked.open(experiment.id)).summary.revision).toBe(1);
  });

  it("does not return decrypted content after a pending read was locked", async () => {
    const session = keep(await createResearchVault(PASSPHRASE));
    const experiment = fixture();
    await session.save(experiment, null);
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    let signal!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { signal = resolve; });
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(crypto.subtle, "decrypt").mockImplementation(async (algorithm, key, data) => {
      const result = await decrypt(algorithm, key, data);
      signal();
      await barrier;
      return result;
    });
    const opening = session.open(experiment.id);
    const rejected = expect(opening).rejects.toMatchObject({ code: "locked" });
    await entered;
    session.lock();
    release();
    await rejected;
  });

  it("reports a blocked database open and abandons its delayed upgrade", async () => {
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    const open = factory.open.bind(factory);
    const spy = vi.spyOn(factory, "open").mockImplementation((name, version) => {
      const request = open(name, version);
      queueMicrotask(() => request.onblocked?.call(request, new Event("blocked") as IDBVersionChangeEvent));
      return request;
    });
    await expect(inspectResearchVault()).rejects.toMatchObject({ code: "blocked" });
    spy.mockRestore();
    // Let the abandoned open finish/abort before trying again.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("does not echo WebCrypto failures and never creates a half-initialized vault", async () => {
    vi.spyOn(crypto.subtle, "deriveKey").mockRejectedValue(new DOMException("PRIVATE KEY MATERIAL", "OperationError"));
    let error: unknown;
    try { await createResearchVault(PASSPHRASE); } catch (reason) { error = reason; }
    expect(error).toMatchObject({ code: "unavailable" });
    expect((error as Error).message).not.toContain("PRIVATE KEY MATERIAL");
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("maps a quota failure during atomic header creation and leaves no half-created vault", async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(() => {
      throw new DOMException("PRIVATE VAULT HEADER", "QuotaExceededError");
    });
    let error: unknown;
    try { await createResearchVault(PASSPHRASE); } catch (reason) { error = reason; }
    expect(error).toMatchObject({ code: "storage" });
    expect((error as Error).message).not.toContain("PRIVATE VAULT HEADER");
    spy.mockRestore();
    expect(await inspectResearchVault()).toEqual({ exists: false });
    expect(await rawRead("records")).toEqual([]);
    keep(await createResearchVault(PASSPHRASE));
    expect(await inspectResearchVault()).toEqual({ exists: true });
  });

  it("requires randomUUID before creating a vault and returns a stable unavailable error", async () => {
    const provider = crypto;
    vi.stubGlobal("crypto", {
      subtle: provider.subtle,
      getRandomValues: provider.getRandomValues.bind(provider),
      randomUUID: undefined,
    });
    await expect(createResearchVault(PASSPHRASE)).rejects.toMatchObject({ code: "unavailable" });
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("does not echo an exception from denied vault randomness", async () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new DOMException("PRIVATE RNG CONTEXT", "SecurityError"); });
    let error: unknown;
    try { await createResearchVault(PASSPHRASE); } catch (reason) { error = reason; }
    expect(error).toMatchObject({ code: "unavailable" });
    expect((error as Error).message).not.toContain("PRIVATE RNG CONTEXT");
    expect(await inspectResearchVault()).toEqual({ exists: false });
  });

  it("fails explicitly when IndexedDB or WebCrypto is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(inspectResearchVault()).rejects.toMatchObject({ code: "unavailable" });
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("crypto", undefined);
    await expect(createResearchVault(PASSPHRASE)).rejects.toMatchObject({ code: "unavailable" });
  });
});
