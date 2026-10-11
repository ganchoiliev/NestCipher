import type { Experiment } from "./research-workbench";
import type { SavedExperimentSummary } from "./research-vault";
import { getResearchReview, type ResearchReview } from "./research-review";

/** Decrypted saved copies only. A working draft is deliberately not a library record. */
export type SavedResearchRecord = { experiment: Experiment; summary: SavedExperimentSummary };

export interface ResearchLibraryOptions {
  query?: string;
  tag?: string;
  target?: string;
  needsReview?: boolean;
}

export interface ResearchLibraryEntry {
  record: SavedResearchRecord;
  tags: string[];
  targets: string[];
  challengeName: string;
  counts: ResearchReview["counts"];
  needsReview: boolean;
}

export interface ResearchLibraryIndex {
  /** Private derived text lives only alongside the unlocked saved copies. */
  entries: readonly { entry: ResearchLibraryEntry; strings: readonly string[] }[];
}

function distinctLabels(values: string[]): string[] {
  // Ignore blank labels for filters, without rewriting stored metadata or evidence.
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value.toLowerCase()];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(textValues);
  return [];
}

/** Build once when the unlocked saved copies change, then discard on lock. */
export function buildResearchLibraryIndex(records: readonly SavedResearchRecord[]): ResearchLibraryIndex {
  return { entries: records.map((record) => {
    const { experiment } = record;
    const counts = getResearchReview(experiment).counts;
    return {
      entry: {
        record,
        tags: distinctLabels(experiment.tags),
        targets: distinctLabels([experiment.defaults.target, ...experiment.attempts.map((attempt) => attempt.conditions.target)]),
        challengeName: experiment.disclosure.challenge.name,
        counts,
        needsReview: counts.total === 0 || counts.notTested > 0 || counts.errors > 0
          || counts.unassessed > 0 || counts.needsContext > 0,
      },
      strings: textValues(experiment),
    };
  }) };
}

/**
 * Filters an existing local index, retaining the caller's saved order.
 * Search terms are case-insensitive and all must occur in string values somewhere in
 * the record, including historical conditions, exact evidence and attached reports.
 * Property names, outcome scores and inferred assessments are not a search index.
 * This helper neither persists an index nor changes any record.
 */
export function filterResearchLibraryIndex(
  index: ResearchLibraryIndex, options: ResearchLibraryOptions = {},
): ResearchLibraryEntry[] {
  const terms = options.query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  return index.entries.flatMap(({ entry, strings }) => {
    if (options.tag && !entry.tags.includes(options.tag)) return [];
    if (options.target && !entry.targets.includes(options.target)) return [];
    if (options.needsReview !== undefined && entry.needsReview !== options.needsReview) return [];
    if (!terms.every((term) => strings.some((value) => value.includes(term)))) return [];
    return [entry];
  });
}

/** Convenience for a one-off read; interactive search should reuse an index. */
export function getResearchLibrary(
  records: readonly SavedResearchRecord[], options: ResearchLibraryOptions = {},
): ResearchLibraryEntry[] {
  return filterResearchLibraryIndex(buildResearchLibraryIndex(records), options);
}
