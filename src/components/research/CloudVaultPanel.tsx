"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { restoreEncryptedResearchVaultBackup, type ResearchVaultSession } from "@/lib/research-vault";
import { parseEncryptedResearchVaultBackup } from "@/lib/encrypted-vault-backup";
import { RESEARCH_SIGN_IN_COOLDOWN_SECONDS, researchSignInCooldownSeconds } from "@/lib/research-auth-feedback";
import styles from "./CloudVaultPanel.module.css";

type Account = { configured: boolean; user: { id: string; email: string | null } | null };
type BackupMetadata = { revision: string; vaultId: string; updatedAt: string; sizeBytes: number; recordCount: number };
type Operation = "account" | "email" | "sign-out" | "backup" | "restore" | "download" | "delete";
type Props = {
  session: ResearchVaultSession | null;
  localVaultExists: boolean | null;
  onRestored: (session: ResearchVaultSession) => void;
  onBusy: (busy: boolean) => void;
  onAccountVerified?: () => void;
};
const MAX_BYTES = 3 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class CloudRequestError extends Error {
  constructor(message: string, readonly code = "request") { super(message); }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function accountResponse(value: unknown): Account {
  if (!object(value) || typeof value.configured !== "boolean") throw new CloudRequestError("The account response could not be read. Nothing was uploaded.");
  if (value.user === null) return { configured: value.configured, user: null };
  if (!object(value.user) || typeof value.user.id !== "string" || !uuid.test(value.user.id)
    || !(value.user.email === null || typeof value.user.email === "string")) {
    throw new CloudRequestError("The account response could not be read. Nothing was uploaded.");
  }
  return { configured: value.configured, user: { id: value.user.id, email: value.user.email } };
}

function backupResponse(value: unknown): BackupMetadata | null {
  if (!object(value) || !("backup" in value)) throw new CloudRequestError("The cloud backup response could not be read. Your local vault is unchanged.");
  if (value.backup === null) return null;
  const backup = value.backup;
  if (!object(backup) || typeof backup.revision !== "string" || !uuid.test(backup.revision)
    || typeof backup.vaultId !== "string" || !uuid.test(backup.vaultId)
    || typeof backup.updatedAt !== "string" || !Number.isFinite(Date.parse(backup.updatedAt))
    || typeof backup.sizeBytes !== "number" || !Number.isSafeInteger(backup.sizeBytes) || backup.sizeBytes < 1 || backup.sizeBytes > MAX_BYTES
    || typeof backup.recordCount !== "number" || !Number.isSafeInteger(backup.recordCount) || backup.recordCount < 0 || backup.recordCount > 25) {
    throw new CloudRequestError("The cloud backup metadata is invalid or unsupported. Your local vault is unchanged.");
  }
  return { revision: backup.revision, vaultId: backup.vaultId, updatedAt: backup.updatedAt, sizeBytes: backup.sizeBytes, recordCount: backup.recordCount };
}

function dateLabel(value: string) { return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC"); }

export function CloudVaultPanel({ session, localVaultExists, onRestored, onBusy, onAccountVerified }: Props) {
  const [account, setAccount] = useState<Account | null>(null);
  const [backup, setBackup] = useState<BackupMetadata | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [confirmBackup, setConfirmBackup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const resendUntil = useRef(0);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const live = useRef(true);
  const sessionRef = useRef(session);
  const callbacks = useRef({ onRestored, onBusy, onAccountVerified });
  useLayoutEffect(() => {
    sessionRef.current = session;
    callbacks.current = { onRestored, onBusy, onAccountVerified };
  }, [session, onRestored, onBusy, onAccountVerified]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current += 1;
      controller.current?.abort();
      callbacks.current.onBusy(false);
    };
  }, []);

  useEffect(() => {
    return () => {
      generation.current += 1;
      controller.current?.abort();
      callbacks.current.onBusy(false);
    };
  }, [session]);

  useEffect(() => {
    if (resendSeconds === 0) return;
    const timer = window.setTimeout(() => setResendSeconds(researchSignInCooldownSeconds(resendUntil.current, Date.now())), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function start(next: Operation) {
    controller.current?.abort();
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setOperation(next);
    setError("");
    setStatus("");
    setConfirmBackup(false);
    setConfirmDelete(false);
    callbacks.current.onBusy(true);
    return { current, abort, valid: () => live.current && current === generation.current };
  }

  function finish(current: number) {
    if (!live.current || current !== generation.current) return;
    setOperation(null);
    controller.current = null;
    callbacks.current.onBusy(false);
  }

  async function request(path: string, signal: AbortSignal, body?: unknown, method = "POST"): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(path, {
        method: body === undefined ? "GET" : method, signal, cache: "no-store", credentials: "same-origin",
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (reason) {
      if (signal.aborted) throw reason;
      throw new CloudRequestError("The cloud service could not be reached. Your local vault is unchanged. Check cloud status before retrying a backup.");
    }
    let value: unknown;
    try {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BYTES + 32_768) throw new Error("Oversize response");
      value = JSON.parse(text);
    } catch { throw new CloudRequestError("The cloud response could not be read. Your local vault is unchanged. Check cloud status before retrying."); }
    if (!response.ok) {
      const code = object(value) && typeof value.code === "string" ? value.code : "request";
      const message = code === "email-delivery-limited" ? "Email sign-in is not ready for general use on this instance. You can keep working locally."
        : code === "email-delivery-unavailable" ? "Email sign-in is temporarily unavailable. You can keep working locally."
          : code === "sign-in-rate-limited" ? "Too many sign-in links were requested. Wait before trying again, or use the latest email in this browser."
            : code === "sign-in-unavailable" ? "Email sign-in is currently unavailable on this instance. You can keep working locally."
        : response.status === 401 ? "Your sign-in has expired. Check account and sign in again; your local vault is unchanged."
        : response.status === 409 && code === "account-changed" ? "The signed-in account changed in another tab. Check account again before continuing. Your local vault is unchanged."
          : response.status === 409 && code === "vault-mismatch" ? "This account already holds a different vault. It was not replaced. Use its original browser or restore that backup in a browser without a vault."
          : response.status === 409 ? "The cloud backup changed after you checked it. Nothing was overwritten. Refresh cloud status before deciding which copy to keep."
            : response.status === 413 ? "This encrypted snapshot exceeds the 3 MiB cloud limit. Your larger local vault is unchanged."
              : response.status === 429 ? "Too many cloud requests. Try again later. Your local vault is unchanged."
                : response.status === 503 ? "Cloud backup is temporarily unavailable. Your local vault and working draft remain available."
                  : "The cloud request was not accepted. Your local vault is unchanged. Check account and cloud status before trying again.";
      throw new CloudRequestError(message, response.status === 401 ? "signed-out" : code);
    }
    return value;
  }

  function report(reason: unknown) {
    if (reason instanceof CloudRequestError) {
      setError(reason.message);
      if (reason.code === "signed-out") { setAccount((current) => current ? { ...current, user: null } : null); setBackup(undefined); }
      if (reason.code === "account-changed") { setAccount(null); setBackup(undefined); setLastUploaded(null); setPassphrase(""); setEmail(""); }
      if (reason.code === "conflict" || reason.code === "vault-mismatch") setBackup(undefined);
    } else {
      setError(reason instanceof Error && reason.name === "ResearchVaultError" ? reason.message : "This operation could not be completed. Your working draft is unchanged.");
    }
  }

  async function checkAccount() {
    const task = start("account");
    setBackup(undefined);
    setLastUploaded(null);
    try {
      const checked = accountResponse(await request("/api/research/account", task.abort.signal));
      if (!task.valid()) return;
      setAccount(checked);
      if (checked.user) {
        callbacks.current.onAccountVerified?.();
        const metadata = backupResponse(await request(`/api/research/backup?expectedUserId=${encodeURIComponent(checked.user.id)}`, task.abort.signal));
        if (!task.valid()) return;
        setBackup(metadata);
        setStatus(metadata ? "Cloud status refreshed. No research was uploaded." : "No cloud backup yet. Uploading is a separate action.");
      } else setStatus(checked.configured ? "Sign in to use optional encrypted backup. Your local vault works independently." : "Cloud backup has not been configured on this instance. Local research remains available.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (researchSignInCooldownSeconds(resendUntil.current, Date.now()) > 0) return;
    resendUntil.current = Date.now() + RESEARCH_SIGN_IN_COOLDOWN_SECONDS * 1000;
    setResendSeconds(RESEARCH_SIGN_IN_COOLDOWN_SECONDS);
    const task = start("email");
    try {
      const result = await request("/api/research/account/sign-in", task.abort.signal, { email: email.trim() });
      if (!object(result) || result.sent !== true) throw new CloudRequestError("The sign-in request could not be confirmed. Try checking account again.");
      if (!task.valid()) return;
      setEmail("");
      setStatus("Check your email and open the latest sign-in link in this same browser. After returning here, choose Check account. Signing in does not unlock or upload your vault.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function signOut() {
    if (!account?.user) return;
    const expectedUserId = account.user.id;
    const task = start("sign-out");
    setPassphrase("");
    try {
      const result = await request("/api/research/account/sign-out", task.abort.signal, { expectedUserId });
      if (!object(result) || result.signedOut !== true) throw new CloudRequestError("Sign-out could not be confirmed. Check account before leaving this device.");
      if (!task.valid()) return;
      setAccount((current) => current ? { ...current, user: null } : null);
      setBackup(undefined);
      setLastUploaded(null);
      setStatus("Signed out of cloud backup. Your local vault and working draft remain on this page.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function upload() {
    const source = sessionRef.current;
    if (!source || !account?.user || backup === undefined) return;
    const expectedUserId = account.user.id;
    const expectedRevision = backup?.revision ?? null;
    const task = start("backup");
    try {
      const snapshot = await source.exportEncryptedBackup();
      if (!task.valid() || sessionRef.current !== source) return;
      if (backup && backup.vaultId !== snapshot.header.vaultId) throw new CloudRequestError("This account already holds a different vault. Nothing was uploaded or replaced.", "vault-mismatch");
      const body = { expectedUserId, expectedRevision, snapshot };
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_BYTES) throw new CloudRequestError("This encrypted snapshot exceeds the 3 MiB cloud limit. Your larger local vault is unchanged.");
      const metadata = backupResponse(await request("/api/research/backup", task.abort.signal, body, "PUT"));
      if (!metadata || metadata.vaultId !== snapshot.header.vaultId) throw new CloudRequestError("The upload response could not be confirmed. Check cloud status before retrying.");
      if (!task.valid() || sessionRef.current !== source) return;
      setBackup(metadata);
      setLastUploaded(metadata.updatedAt);
      setStatus("Saved vault snapshot backed up. Unsaved working drafts were not included. Later local changes need another explicit backup.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function retrieve(signal: AbortSignal, expected: BackupMetadata, expectedUserId: string) {
    const value = await request(`/api/research/backup?include=payload&expectedUserId=${encodeURIComponent(expectedUserId)}`, signal);
    const metadata = backupResponse(value);
    if (!metadata || metadata.revision !== expected.revision || metadata.vaultId !== expected.vaultId) {
      throw new CloudRequestError("The cloud backup changed after you checked it. Refresh cloud status before restoring or downloading it.", "conflict");
    }
    if (!object(value) || !object(value.backup)) throw new CloudRequestError("The encrypted cloud snapshot is missing.");
    const snapshot = parseEncryptedResearchVaultBackup(value.backup.snapshot);
    if (snapshot.header.vaultId !== metadata.vaultId || snapshot.records.length !== metadata.recordCount) throw new CloudRequestError("The encrypted snapshot does not match its cloud metadata. Your local vault is unchanged.");
    return snapshot;
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!backup || !account?.user || sessionRef.current || localVaultExists !== false) return;
    const expectedUserId = account.user.id;
    const entered = passphrase;
    setPassphrase("");
    const task = start("restore");
    try {
      const snapshot = await retrieve(task.abort.signal, backup, expectedUserId);
      if (!task.valid() || sessionRef.current) return;
      const restored = await restoreEncryptedResearchVaultBackup(snapshot, entered, { signal: task.abort.signal });
      if (!task.valid() || sessionRef.current) { restored.lock(); return; }
      callbacks.current.onRestored(restored);
      setStatus("Encrypted backup restored into this browser and unlocked. Choose a saved experiment to open it; your working draft is unchanged.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function downloadCloud() {
    if (!backup || !account?.user) return;
    const expectedUserId = account.user.id;
    const task = start("download");
    try {
      const snapshot = await retrieve(task.abort.signal, backup, expectedUserId);
      if (!task.valid()) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `nestcipher-encrypted-vault-${snapshot.backupId}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setStatus("Encrypted cloud archive download started. Keep its vault passphrase separately; this file does not contain the key.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  async function deleteCloud() {
    if (!backup || !account?.user) return;
    const expectedUserId = account.user.id;
    const task = start("delete");
    try {
      const result = await request("/api/research/backup", task.abort.signal, { expectedUserId, expectedRevision: backup.revision }, "DELETE");
      if (!object(result) || result.deleted !== true) throw new CloudRequestError("Deletion could not be confirmed. Check cloud status before trying again.");
      if (!task.valid()) return;
      setBackup(null);
      setLastUploaded(null);
      setStatus("Cloud backup deleted. Your local vault, working draft and any downloaded copies remain unchanged.");
    } catch (reason) { if (task.valid()) report(reason); }
    finally { finish(task.current); }
  }

  const busy = operation !== null;
  return <section className={styles.panel} aria-labelledby="cloud-backup-heading">
    <div className={styles.heading}><div><p className="eyebrow">Optional / encrypted backup</p><h3 id="cloud-backup-heading">Carry your vault.</h3></div><span className={styles.badge}>Explicit upload</span></div>
    <p className={styles.intro}>Back up saved vault records to your account. Encryption happens in this browser. Your vault passphrase and unsaved working draft stay on this device.</p>
    <div className={styles.actions}><button type="button" className="button-secondary" onClick={() => void checkAccount()} disabled={busy}>{operation === "account" ? "Checking…" : account?.user ? "Refresh cloud status" : "Check account"}</button>{account?.user && <button type="button" className={styles.textButton} onClick={() => void signOut()} disabled={operation === "sign-out"}>{operation === "sign-out" ? "Signing out…" : "Sign out"}</button>}</div>
    {account?.configured === false && <p className={styles.note}>This instance is not connected to cloud backup. You can still save locally and download private experiment files.</p>}
    {account?.configured && !account.user && <form className={styles.form} onSubmit={(event) => void sendLink(event)}>
      <label htmlFor="cloud-account-email">Account email</label><div className={styles.inputRow}><input id="cloud-account-email" type="email" autoComplete="email" value={email} maxLength={254} required disabled={busy} onChange={(event) => setEmail(event.target.value)} /><button type="submit" className="button-primary" disabled={busy || resendSeconds > 0 || !email.trim()}>{operation === "email" ? "Sending…" : resendSeconds > 0 ? `Request again in ${resendSeconds}s` : "Email sign-in link"}</button></div>
      {resendSeconds > 0 && <p className={styles.help} aria-live="polite">Wait before requesting another link, even if you change the address. A new request can make an earlier link unusable.</p>}
      <p className={styles.help}>Save any unsaved work before opening the link. Open the latest email link in the same browser that requested it. No account is needed for local research or public tools. Account recovery does not recover a forgotten vault passphrase.</p>
    </form>}
    {account?.user && <>
      <p className={styles.account}>Signed in · {account.user.email ?? "Research account"}</p>
      {backup === undefined ? <p className={styles.note}>Refresh cloud status before backing up or restoring.</p> : <div className={styles.snapshot}><span>Cloud copy</span><p>{backup ? `${backup.recordCount} saved ${backup.recordCount === 1 ? "experiment" : "experiments"} · ${dateLabel(backup.updatedAt)} · ${(backup.sizeBytes / 1024).toFixed(1)} KiB` : "No snapshot saved"}</p>{lastUploaded && <p className={styles.help}>Upload confirmed {dateLabel(lastUploaded)}. Local edits are saved separately.</p>}</div>}
      {session ? <div className={styles.backupActions}>
        {confirmBackup ? <div className={styles.confirm}><h4>Replace the cloud snapshot?</h4><p>The saved records currently in this browser will replace the backup from {backup ? dateLabel(backup.updatedAt) : "your account"}. This is a snapshot, so newer records from another device are not merged.</p><div className={styles.actions}><button type="button" className="button-secondary" onClick={() => setConfirmBackup(false)} disabled={busy}>Keep cloud copy</button><button type="button" className="button-primary" onClick={() => void upload()} disabled={busy}>Replace with saved local vault</button></div></div>
          : <button type="button" className="button-primary" disabled={busy || backup === undefined} onClick={() => backup ? setConfirmBackup(true) : void upload()}>{operation === "backup" ? "Backing up…" : "Back up saved vault"}</button>}
        <p className={styles.help}>Save your experiment locally first. One vault snapshot per account, up to 3 MiB. Full local vaults can be larger.</p>
      </div> : <p className={styles.note}>{localVaultExists ? "Unlock your local vault above to back it up. Restoring never replaces an existing browser vault." : "Create a local vault to begin saving, or restore your cloud snapshot below."}</p>}
      {backup && <div className={styles.actions}><button type="button" className="button-secondary" onClick={() => void downloadCloud()} disabled={busy}>{operation === "download" ? "Downloading…" : "Download encrypted cloud archive"}</button><button type="button" className={styles.deleteButton} onClick={() => { setConfirmDelete(true); setConfirmBackup(false); }} disabled={busy}>{operation === "delete" ? "Deleting…" : "Delete cloud backup"}</button></div>}
      {backup && confirmDelete && <div className={styles.confirm}><h4>Delete cloud backup?</h4><p>This removes the encrypted snapshot from your account. Your local vault and working draft are retained. Download an encrypted archive first if you need another copy.</p><div className={styles.actions}><button type="button" className="button-secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep cloud backup</button><button type="button" className={styles.deleteButton} onClick={() => void deleteCloud()} disabled={busy}>Delete this cloud snapshot</button></div></div>}
      {backup && !session && localVaultExists === false && <form className={styles.restore} onSubmit={(event) => void restore(event)}><h4>Restore on this device</h4><p>This creates a local vault only when none exists. The downloaded snapshot is authenticated and decrypted here.</p><label htmlFor="cloud-restore-passphrase">Original vault passphrase</label><input id="cloud-restore-passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} disabled={busy} required aria-describedby="cloud-restore-help" /><p id="cloud-restore-help" className={styles.help}>Your passphrase is used locally and never sent with the request.</p><button type="submit" className="button-primary" disabled={busy || passphrase.length < 16}>{operation === "restore" ? "Restoring…" : "Restore encrypted backup"}</button></form>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
    <p className={styles.help}>Cloud backup does not publish research. All saved experiments retain their private disclosure policy. An unlocked page can access decrypted research; keep account and device access secure.</p>
  </section>;
}
