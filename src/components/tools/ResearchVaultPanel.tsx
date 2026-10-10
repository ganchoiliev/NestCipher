"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createResearchVault,
  inspectResearchVault,
  unlockResearchVault,
  type ResearchVaultSession,
  type SavedExperimentSummary,
} from "@/lib/research-vault";
import type { Experiment } from "@/lib/research-workbench";
import { CloudVaultPanel } from "@/components/research/CloudVaultPanel";
import { researchAccountReturnNotice, type ResearchAccountReturnStatus } from "@/lib/research-auth-feedback";
import styles from "./ResearchVaultPanel.module.css";

interface Props {
  open: boolean;
  session: ResearchVaultSession | null;
  refresh: number;
  onClose: () => void;
  onUnlocked: (session: ResearchVaultSession) => void;
  onOpenExperiment: (experiment: Experiment, summary: SavedExperimentSummary) => void;
  onDeleted: (id: string) => void;
  onLock: () => void;
  initialAccountStatus?: ResearchAccountReturnStatus;
}

export function ResearchVaultPanel({ open, session, refresh, onClose, onUnlocked, onOpenExperiment, onDeleted, onLock, initialAccountStatus }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [records, setRecords] = useState<SavedExperimentSummary[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<SavedExperimentSummary | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [accountReturnResolved, setAccountReturnResolved] = useState(false);
  const [search, setSearch] = useState("");
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? records.filter((record) => (record.title || "Untitled experiment").toLocaleLowerCase().includes(query)) : records;
  }, [records, search]);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const request = session ? session.list().then((rows) => {
      if (live) setRecords(rows);
    }) : inspectResearchVault().then((state) => {
      if (live) setExists(state.exists);
    });
    void request.catch((reason) => {
      if (live) setError(reason instanceof Error ? reason.message : "The local vault could not be read. Your working draft is unchanged.");
    });
    return () => { live = false; };
  }, [open, session, refresh]);

  function close() {
    if (busy) return;
    setPassphrase("");
    setConfirmation("");
    setDeleting(null);
    setError("");
    setStatus("");
    onClose();
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cloudBusy || exists === null) return;
    const entered = passphrase;
    const matches = entered === confirmation;
    setPassphrase("");
    setConfirmation("");
    setError("");
    if (!exists && !matches) { setError("The passphrases did not match. Enter both again; the draft is unchanged."); return; }
    if (entered.length < 16 || new TextEncoder().encode(entered).byteLength > 1024 || !entered.trim().length) {
      setError("Use a passphrase of at least 16 characters and no more than 1,024 UTF-8 bytes. It cannot contain only whitespace.");
      return;
    }
    setBusy(true);
    try {
      const unlocked = exists ? await unlockResearchVault(entered) : await createResearchVault(entered);
      onUnlocked(unlocked);
      setExists(true);
      setRecords(await unlocked.list());
      setStatus("Vault unlocked for this page. Saving an experiment is a separate action.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The vault could not be unlocked. Your draft is unchanged.");
    } finally { setBusy(false); }
  }

  async function openRecord(id: string) {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const record = await session.open(id);
      onOpenExperiment(record.experiment, record.summary);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The saved experiment could not be opened. Your draft is unchanged.");
    } finally { setBusy(false); }
  }

  async function deleteRecord() {
    if (!session || !deleting || busy || cloudBusy) return;
    setBusy(true);
    setError("");
    try {
      await session.remove(deleting.id, deleting.revision);
      onDeleted(deleting.id);
      setDeleting(null);
      setRecords(await session.list());
      setStatus("Saved copy deleted. An open working draft is retained.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The saved copy could not be deleted. No working draft was removed.");
    } finally { setBusy(false); }
  }

  function cloudRestored(restored: ResearchVaultSession) {
    setPassphrase("");
    setConfirmation("");
    setExists(true);
    onUnlocked(restored);
  }

  return <dialog ref={dialog} className={styles.panel} aria-labelledby="vault-heading" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className={styles.header}><div><p className="eyebrow">Private / this browser</p><h2 id="vault-heading">Local vault.</h2></div><button type="button" className="button-secondary" onClick={close} disabled={busy}>Close library</button></div>
    <p className={styles.intro}>Save selected experiments in this browser, encrypted with your passphrase. Keep downloaded copies, or opt into a separate encrypted cloud backup below.</p>
    {initialAccountStatus && !accountReturnResolved && <p role={initialAccountStatus === "error" ? "alert" : "status"} className={initialAccountStatus === "error" ? styles.error : styles.status}>{researchAccountReturnNotice(initialAccountStatus)}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
    {session ? <>
      <div className={styles.libraryBar}><span>Unlocked · {records.length} saved {records.length === 1 ? "experiment" : "experiments"}</span><button type="button" className="button-secondary" onClick={() => { if (!busy) { onClose(); onLock(); } }} disabled={busy}>Lock vault</button></div>
      {deleting ? <section className={styles.confirm} aria-labelledby="delete-saved-heading"><h3 id="delete-saved-heading">Delete this saved copy?</h3><p>{deleting.title || "Untitled experiment"}</p><p>This permanently removes its saved record from this browser. An open draft remains in memory. Download a private experiment JSON backup before deleting a copy you need to keep.</p><div className={styles.actions}><button type="button" className="button-secondary" onClick={() => setDeleting(null)} disabled={busy}>Keep saved copy</button><button type="button" className="button-primary" onClick={() => void deleteRecord()} disabled={busy || cloudBusy}>Delete saved copy</button></div></section> : null}
      {records.length > 0 && <div className={styles.search}><label htmlFor="vault-library-search">Find a saved experiment by title</label><div><input id="vault-library-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" spellCheck={false} /><button type="button" className="button-secondary" onClick={() => setSearch("")} disabled={!search}>Clear</button></div></div>}
      {visibleRecords.length ? <ul className={styles.records}>{visibleRecords.map((record) => <li key={record.id}><div><h3>{record.title || "Untitled experiment"}</h3><p>{record.attemptCount} {record.attemptCount === 1 ? "attempt" : "attempts"} · Saved {record.savedAt.replace("T", " ").replace(".000Z", " UTC")} · Revision {record.revision}</p></div><div className={styles.actions}><button type="button" className="button-secondary" onClick={() => void openRecord(record.id)} disabled={busy} aria-label={`Open saved experiment ${record.title || "Untitled experiment"}`}>Open</button><button type="button" className={styles.delete} onClick={() => setDeleting(record)} disabled={busy || cloudBusy} aria-label={`Delete saved experiment ${record.title || "Untitled experiment"}`}>Delete</button></div></li>)}</ul> : <p className={styles.empty}>{records.length ? "No saved titles match this search. Clear the search to see every saved experiment." : "No saved experiments yet. Close the library, then choose Save locally on your working draft."}</p>}
    </> : exists === null ? <p className={styles.empty}>Checking local storage…</p> : <form onSubmit={(event) => void unlock(event)} className={styles.form}>
      <h3>{exists ? "Unlock your vault" : "Create a local vault"}</h3>
      <p>{exists ? "Saved titles and contents remain hidden until you enter the passphrase." : "Choose a passphrase you can keep safely. A forgotten passphrase cannot be recovered; there is no reset or recovery service."}</p>
      <label htmlFor="vault-passphrase">{exists ? "Vault passphrase" : "New vault passphrase"}</label><input id="vault-passphrase" type="password" autoComplete={exists ? "current-password" : "new-password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} disabled={busy || cloudBusy} aria-describedby="vault-passphrase-help" />
      {!exists && <><label htmlFor="vault-confirmation">Confirm vault passphrase</label><input id="vault-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy || cloudBusy} /></>}
      <p id="vault-passphrase-help" className={styles.help}>At least 16 characters, up to 1,024 UTF-8 bytes. Spaces are preserved. This protects stored content; it does not protect an unlocked page or compromised device.</p>
      <button type="submit" className="button-primary" disabled={busy || cloudBusy || !passphrase.length}>{busy ? "Working…" : exists ? "Unlock vault" : "Create vault"}</button>
    </form>}
    <p className={styles.help}>Browser data can be cleared or evicted. Vault saving is explicit; typing, unlocking and opening records do not save changes automatically.</p>
    {open && <CloudVaultPanel session={session} localVaultExists={session ? true : exists} onRestored={cloudRestored} onBusy={setCloudBusy} onAccountVerified={() => setAccountReturnResolved(true)} />}
  </dialog>;
}
