import {
  getDisclosureStatus,
  LIMITS,
  validateExperiment,
  type Attempt,
  type Experiment,
} from "./research-workbench";

export type ResultCounts = {
  total: number;
  notTested: number;
  recorded: number;
  errors: number;
  recordedAssessments: { unassessed: number; met: number; notMet: number; inconclusive: number };
  /** Non-recorded attempts with an assessment other than unassessed. */
  nonRecordedAssessments: number;
};

export type MapNode = {
  id: string;
  /** Position in the original experiment, independent of map display order. */
  index: number;
  parentId: string | null;
  depth: number;
  rootId: string;
  childIds: string[];
};

export type CapturedInputGroup = {
  /** The first member's stable ID; not a hash of research text. */
  id: string;
  attemptIds: string[];
  indexes: number[];
  missingFields: string[];
  counts: ResultCounts;
};

export type ExperimentMap = { nodes: MapNode[]; groups: CapturedInputGroup[]; counts: ResultCounts };

const capturedFields: { label: string; read: (attempt: Attempt) => string }[] = [
  { label: "Prompt input", read: (attempt) => attempt.input },
  { label: "Input placement", read: (attempt) => attempt.inputPlacement },
  { label: "Research question", read: (attempt) => attempt.conditions.question },
  { label: "Authorized scope", read: (attempt) => attempt.conditions.scope },
  { label: "Target", read: (attempt) => attempt.conditions.target },
  { label: "Model / version", read: (attempt) => attempt.conditions.modelVersion },
  { label: "Observable criterion", read: (attempt) => attempt.conditions.criterion },
  { label: "Settings", read: (attempt) => attempt.conditions.settings },
  { label: "System / context", read: (attempt) => attempt.conditions.context },
];

function requireExperiment(experiment: Experiment): Experiment {
  const validation = validateExperiment(experiment);
  if (!validation.ok) throw new Error(validation.error);
  return validation.experiment;
}

function emptyCounts(): ResultCounts {
  return {
    total: 0, notTested: 0, recorded: 0, errors: 0,
    recordedAssessments: { unassessed: 0, met: 0, notMet: 0, inconclusive: 0 },
    nonRecordedAssessments: 0,
  };
}

function countAttempt(counts: ResultCounts, attempt: Attempt): void {
  counts.total += 1;
  if (attempt.executionState === "recorded") {
    counts.recorded += 1;
    if (attempt.assessment === "not-met") counts.recordedAssessments.notMet += 1;
    else counts.recordedAssessments[attempt.assessment] += 1;
  } else {
    if (attempt.executionState === "not-tested") counts.notTested += 1;
    else counts.errors += 1;
    if (attempt.assessment !== "unassessed") counts.nonRecordedAssessments += 1;
  }
}

function mapCheckedExperiment(experiment: Experiment): ExperimentMap {
  const byId = new Map(experiment.attempts.map((attempt, index) => [attempt.id, { attempt, index }]));
  const children = new Map(experiment.attempts.map((attempt) => [attempt.id, [] as string[]]));
  const roots: string[] = [];
  for (const attempt of experiment.attempts) {
    if (attempt.parentId === null) roots.push(attempt.id);
    else children.get(attempt.parentId)!.push(attempt.id);
  }
  const nodes: MapNode[] = [];
  const stack = roots.slice().reverse().map((id) => ({ id, depth: 0, rootId: id }));
  // Validation bounds this acyclic graph to 100 nodes. Iteration avoids recursive
  // render/traversal assumptions when a parent is later in the source array.
  while (stack.length > 0) {
    const entry = stack.pop()!;
    const { attempt, index } = byId.get(entry.id)!;
    const childIds = children.get(entry.id)!;
    nodes.push({ ...entry, index, parentId: attempt.parentId, childIds: [...childIds] });
    for (let index = childIds.length - 1; index >= 0; index -= 1) {
      stack.push({ id: childIds[index], depth: entry.depth + 1, rootId: entry.rootId });
    }
  }

  const counts = emptyCounts();
  const groups: CapturedInputGroup[] = [];
  const groupsByCapture = new Map<string, CapturedInputGroup>();
  for (const [index, attempt] of experiment.attempts.entries()) {
    const values = capturedFields.map((field) => field.read(attempt));
    // A JSON tuple preserves field boundaries and exact Unicode/line endings.
    // It exists only during this local derivation and never becomes an ID/export.
    const key = JSON.stringify(values);
    let group = groupsByCapture.get(key);
    if (!group) {
      group = {
        id: attempt.id, attemptIds: [], indexes: [],
        missingFields: capturedFields.filter((_, fieldIndex) => values[fieldIndex].trim().length === 0).map((field) => field.label),
        counts: emptyCounts(),
      };
      groups.push(group);
      groupsByCapture.set(key, group);
    }
    group.attemptIds.push(attempt.id);
    group.indexes.push(index);
    countAttempt(group.counts, attempt);
    countAttempt(counts, attempt);
  }
  return { nodes, groups, counts };
}

/**
 * Describe parent links, exact captured-input groups and researcher-reported
 * states. This neither changes evidence nor establishes independent trials,
 * actual matched environments, causality, reliability or successful execution.
 */
export function getExperimentMap(experiment: Experiment): ExperimentMap {
  return mapCheckedExperiment(requireExperiment(experiment));
}

function safeFence(value: string): string {
  let longest = 0;
  for (const match of value.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${value}${value.endsWith("\n") ? "" : "\n"}${fence}`;
}

function attemptLabel(index: number): string {
  return `Attempt ${String(index + 1).padStart(2, "0")}`;
}

function countLines(counts: ResultCounts): string[] {
  return [
    `- Total attempts: ${counts.total}`,
    `- Not tested (reported): ${counts.notTested}`,
    `- Recorded-state attempts (reported): ${counts.recorded}`,
    `- Execution / provider errors (reported): ${counts.errors}`,
    `- Among recorded-state attempts only: ${counts.recordedAssessments.met} met criterion; ${counts.recordedAssessments.notMet} did not meet criterion; ${counts.recordedAssessments.inconclusive} inconclusive; ${counts.recordedAssessments.unassessed} unassessed.`,
    `- Assessments attached to not-tested/error states, excluded from recorded-state assessment counts: ${counts.nonRecordedAssessments}`,
  ];
}

/**
 * A readable private summary of this exact working snapshot, with research text
 * excluded apart from its title and challenge name. It is not a restore format.
 * Export never saves, copies to a service, publishes or changes disclosure.
 */
export function exportExperimentResultsMarkdown(experiment: Experiment): string {
  const checked = requireExperiment(experiment);
  const map = mapCheckedExperiment(checked);
  const { challenge } = checked.disclosure;
  const disclosure = getDisclosureStatus(challenge, checked.updatedAt);
  const indexById = new Map(checked.attempts.map((attempt, index) => [attempt.id, index]));
  const lines = [
    "---",
    "nestcipher_summary: experiment-results",
    `nestcipher_id: ${checked.id}`,
    `nestcipher_schema: ${checked.schemaVersion}`,
    "visibility: private",
    "publish: false",
    `nestcipher_snapshot_updated_at: ${JSON.stringify(checked.updatedAt)}`,
    `nestcipher_public_not_before: ${disclosure.publicNotBefore === null ? "null" : JSON.stringify(disclosure.publicNotBefore)}`,
    "---", "",
    "# Private experiment results", "",
    "## Experiment title", "", safeFence(checked.title), "",
    `Experiment ID: ${checked.id}. Snapshot updated: ${checked.updatedAt}.`, "",
    "This describes the current working snapshot, which may contain unsaved changes. It does not save or verify the record.", "",
    "## Disclosure restriction", "",
    "### Challenge name", "", safeFence(challenge.name), "",
    `Recorded challenge end: ${challenge.endsAt ?? "unknown"}. End confirmed by researcher: ${challenge.endConfirmed ? "yes" : "no"}.`,
    disclosure.publicNotBefore === null
      ? "The actual challenge end is unknown or unconfirmed. No public disclosure date is established; keep challenge break details private."
      : `Earliest disclosure date under the recorded 30-full-day rule: ${disclosure.publicNotBefore}. This summary remains private.`,
    "A date never authorizes publication or publishes a record. Live challenge break details must remain private until at least 30 full days after the actual confirmed end; later sharing needs explicit review.", "",
    "## Reported results", "", ...countLines(map.counts), "",
    "Assessment counts include only recorded-state attempts. A recorded state can coexist with missing observations; the state and assessment are researcher-reported, not verified. Not-tested and error entries retain their states even when an assessment or observation is present.", "",
    "## Parent map", "",
    "Parent links are researcher-entered variant relationships. Display order is preorder; attempt numbers remain their original experiment positions.", "",
  ];
  if (map.nodes.length === 0) lines.push("No attempts in this snapshot.", "");
  for (const node of map.nodes) {
    const parent = node.parentId === null ? "none" : `${attemptLabel(indexById.get(node.parentId)!)} (${node.parentId})`;
    lines.push(`- ${attemptLabel(node.index)} (${node.id}); parent: ${parent}; depth: ${node.depth}; root: ${node.rootId}.`);
  }
  lines.push("", "## Exact captured-input groups", "",
    "Groups use strict equality of prompt input, input placement and all seven captured condition fields. Group membership does not establish independent trials or actual matched environments. Blank or whitespace-only fields are listed as missing; their exact stored strings remain distinct.", "");
  if (map.groups.length === 0) lines.push("No captured-input groups in this snapshot.", "");
  for (const [index, group] of map.groups.entries()) {
    lines.push(`### Group ${String(index + 1).padStart(2, "0")}`, "",
      `Representative ID: ${group.id}.`,
      `Members: ${group.attemptIds.map((id, memberIndex) => `${attemptLabel(group.indexes[memberIndex])} (${id})`).join("; ")}.`,
      group.missingFields.length > 0 ? `Missing captured fields: ${group.missingFields.join("; ")}.` : "No blank captured fields. Known captured values still do not verify the actual environment.",
      "", ...countLines(group.counts), "");
  }
  lines.push("## Excluded content", "",
    "Prompt input, condition values, input placement text, transcripts, actions, errors, research notes, assessment reasoning, change notes, attached reports, tags and briefing text are excluded. The title, challenge metadata, stable identifiers, parent links, group membership and descriptive counts remain private research metadata.", "",
    "## Limitations", "",
    "All execution states and assessments are reported entries. NestCipher did not run a model, verify a target, authenticate evidence, grade a result or infer causality. Identical captured strings are not proof of matched live conditions or independent repeated trials. These counts do not estimate reliability or establish a benchmark. The record is editable; unknown conditions remain unknown. This readable summary is not encrypted and is not a lossless backup or restore archive.", "");
  const markdown = lines.join("\n");
  if (new TextEncoder().encode(markdown).byteLength > LIMITS.maxEncodedBytes) {
    throw new Error("The private results summary exceeds the 5 MiB encoded-document limit.");
  }
  return markdown;
}
