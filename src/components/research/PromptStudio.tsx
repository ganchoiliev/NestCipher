"use client";

import { useEffect, useRef, useState } from "react";
import { exportExperimentJson, LIMITS, type Conditions, type Experiment } from "@/lib/research-workbench";
import {
  buildPlannedExperiment,
  buildPromptBrainstormingBrief,
  createEmptyPromptPlan,
  createSyntheticPromptPlan,
  validatePromptPlan,
  type BriefingDraft,
  type PromptPlan,
} from "@/lib/prompt-studio";
import styles from "./PromptStudio.module.css";

export interface PromptStudioProps {
  onPrepare: (experiment: Experiment) => void;
  onDirtyChange: (dirty: boolean) => void;
  busy?: boolean;
}

type ReviewedPlan = { plan: PromptPlan; experiment: Experiment };
const emptyBriefing = (): BriefingDraft => ({ goal: "", constraints: "" });
const knownConditions: { key: keyof Conditions; label: string; multiline?: boolean }[] = [
  { key: "target", label: "Target" },
  { key: "modelVersion", label: "Model / version" },
  { key: "settings", label: "Known settings", multiline: true },
  { key: "context", label: "Known context", multiline: true },
];

function hasDraftContent(plan: PromptPlan, briefing: BriefingDraft): boolean {
  return Boolean(plan.title.length || plan.inputPlacement.length || plan.baselineInput.length ||
    Object.values(plan.conditions).some((value) => value.length) || plan.variants.length ||
    briefing.goal.length || briefing.constraints.length);
}

export function PromptStudio({ onPrepare, onDirtyChange, busy = false }: PromptStudioProps) {
  const [plan, setPlan] = useState<PromptPlan>(createEmptyPromptPlan);
  const [reviewed, setReviewed] = useState<ReviewedPlan | null>(null);
  const [replaceWithExample, setReplaceWithExample] = useState(false);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefing, setBriefing] = useState<BriefingDraft>(emptyBriefing);
  const [briefingPreview, setBriefingPreview] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const briefHeadingRef = useRef<HTMLHeadingElement>(null);
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  const copyGeneration = useRef(0);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    headingRef.current?.focus();
    return () => { alive.current = false; copyGeneration.current += 1; previewRef.current = null; };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (reviewed) reviewHeadingRef.current?.focus(); }, [reviewed]);
  useEffect(() => { if (briefingPreview) briefHeadingRef.current?.focus(); }, [briefingPreview]);
  useEffect(() => {
    if (manualCopy) { manualCopyRef.current?.focus(); manualCopyRef.current?.select(); }
  }, [manualCopy]);

  function rejectLongEdit(value: string, limit: number, label: string): boolean {
    if (value.length <= limit) return false;
    setError(`${label} accepts at most ${limit.toLocaleString("en-US")} characters. The whole edit was rejected; the previous value is preserved.`);
    return true;
  }

  function commitPlan(next: PromptPlan) {
    setPlan(next);
    setReviewed(null);
    setReplaceWithExample(false);
    setError("");
    setStatus("");
    onDirtyChange(hasDraftContent(next, briefing));
  }

  function editPlan(key: "title" | "inputPlacement" | "baselineInput", value: string, label: string) {
    const limit = key === "baselineInput" ? LIMITS.maxEvidenceLength : LIMITS.maxMetadataLength;
    if (!rejectLongEdit(value, limit, label)) commitPlan({ ...plan, [key]: value });
  }

  function editCondition(key: keyof Conditions, value: string, label: string) {
    const limit = key === "context" ? LIMITS.maxEvidenceLength : LIMITS.maxMetadataLength;
    if (!rejectLongEdit(value, limit, label)) commitPlan({ ...plan, conditions: { ...plan.conditions, [key]: value } });
  }

  function editVariant(index: number, key: "input" | "changeNote", value: string, label: string) {
    const limit = key === "input" ? LIMITS.maxEvidenceLength : LIMITS.maxMetadataLength;
    if (!rejectLongEdit(value, limit, label)) commitPlan({ ...plan, variants: plan.variants.map((variant, position) => position === index ? { ...variant, [key]: value } : variant) });
  }

  function invalidateBriefing() {
    copyGeneration.current += 1;
    previewRef.current = null;
    setBriefingPreview(null);
    setManualCopy(false);
    setCopying(false);
    setStatus("");
  }

  function editBriefing(key: keyof BriefingDraft, value: string, label: string) {
    if (rejectLongEdit(value, LIMITS.maxMetadataLength, label)) return;
    const next = { ...briefing, [key]: value };
    setBriefing(next);
    invalidateBriefing();
    setError("");
    onDirtyChange(hasDraftContent(plan, next));
  }

  function changeBriefingPermission(enabled: boolean) {
    setBriefingEnabled(enabled);
    invalidateBriefing();
    setError("");
    if (!enabled) {
      const next = emptyBriefing();
      setBriefing(next);
      onDirtyChange(hasDraftContent(plan, next));
    }
  }

  function loadExample() {
    const next = createSyntheticPromptPlan();
    setPlan(next);
    setReviewed(null);
    setReplaceWithExample(false);
    setBriefingEnabled(false);
    setBriefing(emptyBriefing());
    invalidateBriefing();
    setError("");
    setStatus("Synthetic plan loaded. All content is invented; review it before preparing untested attempts.");
    onDirtyChange(true);
    window.requestAnimationFrame(() => { if (alive.current) titleRef.current?.focus(); });
  }

  function editReviewedPlan() {
    setReviewed(null);
    setError("");
    setStatus("");
    window.requestAnimationFrame(() => { if (alive.current) titleRef.current?.focus(); });
  }

  function reviewPlan() {
    if (busy) return;
    setError("");
    setStatus("");
    const checked = validatePromptPlan(plan);
    if (!checked.ok) { setError(checked.error); return; }
    try {
      setReviewed({ plan: checked.plan, experiment: buildPlannedExperiment(checked.plan) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The plan could not be prepared. Your entries are preserved.");
    }
  }

  function prepareAttempts() {
    if (!reviewed || busy) return;
    try { onPrepare(structuredClone(reviewed.experiment)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The reviewed plan could not be opened. Your entries are preserved."); }
  }

  function downloadReviewedPlan() {
    if (!reviewed || busy) return;
    try {
      const contents = exportExperimentJson(reviewed.experiment);
      const url = URL.createObjectURL(new Blob([contents], { type: "application/json;charset=utf-8" }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "nestcipher-private-planned-research.json";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError("");
      setStatus("Reviewed research JSON download started. It is a readable private file containing the planned inputs and conditions. Check your downloads.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reviewed research JSON could not be downloaded. Your entries are preserved.");
    }
  }

  function previewBriefing() {
    if (!briefingEnabled || busy) return;
    invalidateBriefing();
    setError("");
    try {
      const text = buildPromptBrainstormingBrief(briefing);
      previewRef.current = text;
      setBriefingPreview(text);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The briefing could not be prepared. Your entries are preserved.");
    }
  }

  async function copyBriefing() {
    if (!briefingEnabled || !briefingPreview || copying || busy) return;
    const text = briefingPreview;
    const generation = ++copyGeneration.current;
    const current = () => alive.current && generation === copyGeneration.current && previewRef.current === text;
    setCopying(true);
    setManualCopy(false);
    setError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (current()) setStatus("Reviewed AI briefing copied. Choose where to paste it in your own AI tool.");
    } catch {
      if (current()) {
        setManualCopy(true);
        setStatus("Automatic copy is unavailable. The reviewed text is selected below; copy it manually.");
      }
    } finally { if (current()) setCopying(false); }
  }

  const reviewedConditions = reviewed?.plan.conditions;

  return <section className={styles.studio} aria-labelledby="prompt-studio-heading">
    <header className={styles.heading}>
      <div><p className="eyebrow">Plan / vary / observe</p><h2 id="prompt-studio-heading" ref={headingRef} tabIndex={-1}>Prompt Studio</h2><p>Give an idea a testable shape.</p></div>
      <span className={styles.privateBadge}>Private / in memory</span>
    </header>
    <p className={styles.introduction}>Define the question, hold a baseline, then change one thing at a time. Preparing a plan creates untested attempts for manual testing. Save explicitly in the workbench to keep them.</p>
    <div className={styles.utilityRow}><span>{plan.origin === "synthetic-example" ? "Started from synthetic example" : "Researcher plan"}</span><button type="button" className={styles.textButton} disabled={busy} onClick={() => hasDraftContent(plan, briefing) ? setReplaceWithExample(true) : loadExample()}>Load synthetic plan <span aria-hidden="true">↗</span></button></div>
    {replaceWithExample && <div className={styles.replaceWarning} role="group" aria-label="Replace planner with synthetic example"><h3>Replace the current planner?</h3><p>Your plan and optional briefing exist only in this page. Loading the invented example discards both. Keep this plan or review and download it first.</p><div className={styles.actions}><button type="button" className="button-secondary" disabled={busy} onClick={() => setReplaceWithExample(false)}>Keep current plan</button><button type="button" className="button-secondary" disabled={busy} onClick={loadExample}>Replace with synthetic plan</button></div></div>}
    {error && <p ref={errorRef} tabIndex={-1} className={styles.error} role="alert">{error}</p>}
    <p className={styles.status} role="status" aria-live="polite" aria-atomic="true">{status}</p>

    {!reviewed ? <>
      <fieldset className={styles.step} disabled={busy}><legend><span aria-hidden="true">01</span> Set the experiment</legend><div className={styles.stepContent}><p className={styles.stepHelp}>State an observable question within your authorized scope. A criterion describes what you will check, without predicting a result.</p><div className={styles.field}><label htmlFor="plan-title">Plan title <span>Required</span></label><input id="plan-title" ref={titleRef} value={plan.title} autoComplete="off" onChange={(event) => editPlan("title", event.target.value, "Plan title")} /></div><div className={styles.field}><label htmlFor="plan-question">Research question <span>Required</span></label><textarea id="plan-question" rows={3} value={plan.conditions.question} onChange={(event) => editCondition("question", event.target.value, "Research question")} /></div><div className={styles.twoColumns}><div className={styles.field}><label htmlFor="plan-criterion">Observable criterion <span>Required</span></label><textarea id="plan-criterion" rows={4} value={plan.conditions.criterion} onChange={(event) => editCondition("criterion", event.target.value, "Observable criterion")} /></div><div className={styles.field}><label htmlFor="plan-scope">Authorized scope <span>Required</span></label><textarea id="plan-scope" rows={4} value={plan.conditions.scope} onChange={(event) => editCondition("scope", event.target.value, "Authorized scope")} /></div></div></div></fieldset>

      <fieldset className={styles.step} disabled={busy}><legend><span aria-hidden="true">02</span> Hold a baseline</legend><div className={styles.stepContent}><p className={styles.stepHelp}>Capture the input as you intend to submit it. Record only conditions you know; blank fields remain unspecified.</p><div className={styles.field}><label htmlFor="plan-baseline">Baseline input <span>Required / exact text</span></label><textarea id="plan-baseline" className={styles.evidence} rows={7} spellCheck={false} value={plan.baselineInput} onChange={(event) => editPlan("baselineInput", event.target.value, "Baseline input")} /></div><div className={styles.field}><label htmlFor="plan-placement">Input placement <span>Optional</span></label><input id="plan-placement" value={plan.inputPlacement} autoComplete="off" placeholder="For example, a user message" onChange={(event) => editPlan("inputPlacement", event.target.value, "Input placement")} /></div><details className={styles.conditions}><summary>Record known conditions</summary><div className={styles.twoColumns}>{knownConditions.map(({ key, label, multiline }) => <div className={styles.field} key={key}><label htmlFor={`plan-${key}`}>{label} <span>Optional</span></label>{multiline ? <textarea id={`plan-${key}`} rows={key === "context" ? 5 : 3} className={key === "context" ? styles.evidence : undefined} spellCheck={key === "context" ? false : undefined} value={plan.conditions[key]} onChange={(event) => editCondition(key, event.target.value, label)} /> : <input id={`plan-${key}`} value={plan.conditions[key]} autoComplete="off" onChange={(event) => editCondition(key, event.target.value, label)} />}</div>)}</div></details></div></fieldset>

      <fieldset className={styles.step} disabled={busy}><legend><span aria-hidden="true">03</span> Make a deliberate variation</legend><div className={styles.stepContent}><p className={styles.stepHelp}>Add up to three candidates linked to the baseline. Write the complete candidate input and name its change; the baseline conditions carry into each one.</p>{!plan.variants.length && <p className={styles.emptyVariants}>A baseline alone is a complete plan. Add a variant when you have a specific change to test.</p>}<ol className={styles.variants}>{plan.variants.map((variant, index) => <li key={index}><div className={styles.variantHeading}><h3>Variant {index + 1}</h3><span>Parent / baseline</span><button type="button" className={styles.textButton} aria-label={`Remove variant ${index + 1}`} onClick={() => commitPlan({ ...plan, variants: plan.variants.filter((_, position) => position !== index) })}>Remove</button></div><div className={styles.field}><label htmlFor={`plan-variant-${index}`}>Variant {index + 1} input <span>Required / exact text</span></label><textarea id={`plan-variant-${index}`} className={styles.evidence} rows={6} spellCheck={false} value={variant.input} onChange={(event) => editVariant(index, "input", event.target.value, `Variant ${index + 1} input`)} /></div><div className={styles.field}><label htmlFor={`plan-change-${index}`}>Variant {index + 1} change <span>Required</span></label><textarea id={`plan-change-${index}`} rows={2} value={variant.changeNote} onChange={(event) => editVariant(index, "changeNote", event.target.value, `Variant ${index + 1} change`)} /></div></li>)}</ol><button type="button" className="button-secondary" disabled={busy || plan.variants.length >= 3} onClick={() => commitPlan({ ...plan, variants: [...plan.variants, { input: "", changeNote: "" }] })}>Add variant <span aria-hidden="true">+</span></button><div className={styles.reviewAction}><p>Review the complete plan before creating attempts. No prompts run here.</p><button type="button" className="button-primary" disabled={busy} onClick={reviewPlan}>Review plan <span aria-hidden="true">↗</span></button></div></div></fieldset>
    </> : <section className={styles.review} aria-labelledby="reviewed-plan-heading"><header className={styles.reviewHeading}><div><p className="eyebrow">Reviewed snapshot / ready for manual testing</p><h3 id="reviewed-plan-heading" ref={reviewHeadingRef} tabIndex={-1}>Review the experiment plan</h3></div><button type="button" className="button-secondary" disabled={busy} onClick={editReviewedPlan}>Edit plan</button></header><h4 className={styles.planTitle}>{reviewed.plan.title}</h4><dl className={styles.reviewConditions}><div><dt>Research question</dt><dd>{reviewedConditions?.question}</dd></div><div><dt>Observable criterion</dt><dd>{reviewedConditions?.criterion}</dd></div><div><dt>Authorized scope</dt><dd>{reviewedConditions?.scope}</dd></div><div><dt>Input placement</dt><dd>{reviewed.plan.inputPlacement || "Unspecified"}</dd></div>{knownConditions.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{reviewedConditions?.[key] || "Unspecified"}</dd></div>)}</dl><div className={styles.reviewInput}><h4>Baseline</h4><span>Not tested / unassessed</span><pre tabIndex={0} aria-label="Reviewed baseline input">{reviewed.plan.baselineInput}</pre></div>{reviewed.plan.variants.map((variant, index) => <div className={styles.reviewInput} key={index}><h4>Variant {index + 1}</h4><span>Parent / baseline · Not tested / unassessed</span><p className={styles.changeNote}>{variant.changeNote}</p><pre tabIndex={0} aria-label={`Reviewed variant ${index + 1} input`}>{variant.input}</pre></div>)}<div className={styles.handoff}><div><strong>{reviewed.experiment.attempts.length} untested {reviewed.experiment.attempts.length === 1 ? "attempt" : "attempts"}</strong><p>No responses, observations or assessments are invented. This starts a private experiment with no confirmed challenge end; any live findings remain restricted.</p></div><div className={styles.actions}><button type="button" className="button-primary" disabled={busy} onClick={prepareAttempts}>Prepare untested attempts <span aria-hidden="true">↗</span></button><button type="button" className="button-secondary" disabled={busy} onClick={downloadReviewedPlan}>Download reviewed research JSON <span aria-hidden="true">↓</span></button></div><p className={styles.help}>The JSON contains this reviewed research snapshot as readable private text. It is not an encrypted vault backup. Save explicitly after opening the experiment.</p></div></section>}

    <section className={styles.briefing} aria-labelledby="ai-briefing-heading"><div className={styles.briefingHeading}><p className="eyebrow">Optional / your own AI tool</p><h3 id="ai-briefing-heading">A separate brainstorming brief.</h3><p>Use AI drafting only where the event permits it. Enter generic context you are comfortable sending; the planner and saved research are never included automatically.</p></div><label className={styles.checkbox}><input type="checkbox" checked={briefingEnabled} disabled={busy} onChange={(event) => changeBriefingPermission(event.target.checked)} /><span>This event allows AI-assisted drafting</span></label>{briefingEnabled && <div className={styles.briefingBody}><div className={styles.twoColumns}><div className={styles.field}><label htmlFor="briefing-goal">Briefing goal <span>Required / generic context</span></label><textarea id="briefing-goal" rows={4} disabled={busy} value={briefing.goal} onChange={(event) => editBriefing("goal", event.target.value, "Briefing goal")} /></div><div className={styles.field}><label htmlFor="briefing-constraints">Briefing constraints <span>Optional</span></label><textarea id="briefing-constraints" rows={4} disabled={busy} value={briefing.constraints} onChange={(event) => editBriefing("constraints", event.target.value, "Briefing constraints")} /></div></div><p className={styles.help}>Preview exactly what you will copy. Keep restricted challenge details out of the brief. Turning off AI drafting clears these fields and their preview.</p><button type="button" className="button-secondary" disabled={busy} onClick={previewBriefing}>Preview briefing</button>{briefingPreview && <div className={styles.briefingPreview}><h3 ref={briefHeadingRef} tabIndex={-1}>Reviewed AI briefing</h3><p className={styles.help}>This is inert text. Copying places only this reviewed brief on your clipboard.</p><pre tabIndex={0} aria-label="Reviewed AI briefing text">{briefingPreview}</pre><button type="button" className="button-primary" disabled={busy || copying} onClick={() => void copyBriefing()}>{copying ? "Copying…" : "Copy reviewed briefing"}</button>{manualCopy && <div className={styles.field}><label htmlFor="briefing-manual-copy">Manual copy of reviewed briefing</label><textarea id="briefing-manual-copy" ref={manualCopyRef} rows={8} readOnly value={briefingPreview} spellCheck={false} /></div>}</div>}</div>}</section>
    <p className={styles.footerNote}>Plans and briefings stay in this page until you prepare, download or discard them. Nothing is saved or sent automatically.</p>
  </section>;
}
