import { z } from "zod";
import { exportExperimentMarkdown, validateExperiment, LIMITS, type MarkdownOptions } from "./research-workbench";
import { RESEARCH_VAULT_LIMITS } from "./research-vault";
import type { SavedResearchRecord } from "./research-library";

export const OBSIDIAN_RESEARCH_PACK_LIMITS = {
  maxRecords: RESEARCH_VAULT_LIMITS.maxRecords,
  maxSourceBytes: RESEARCH_VAULT_LIMITS.maxPlaintextBytes,
  maxOutputBytes: 64 * 1024 * 1024,
  maxFiles: RESEARCH_VAULT_LIMITS.maxRecords + 2,
} as const;

export interface ResearchPackFile { path: string; content: string }
export interface ObsidianResearchPack { files: ResearchPackFile[]; recordCount: number }
export type ObsidianResearchPackErrorCode = "empty" | "invalid-record" | "duplicate-record" | "limit" | "invalid-options" | "invalid-pack";
export class ObsidianResearchPackError extends Error {
  constructor(readonly code: ObsidianResearchPackErrorCode, message: string) {
    super(message);
    this.name = "ObsidianResearchPackError";
  }
}
export type ObsidianResearchPackEligibility = { eligible: true } | { eligible: false; error: string };

const encoder = new TextEncoder();
const isoTimestamp = z.iso.datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)));
const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const notePath = new RegExp(`^experiments/${uuidPattern}\\.md$`);
const evidenceFields = ["input", "context", "response", "actions", "notes", "assessmentReason", "executionError"];

function fail(code: ObsidianResearchPackErrorCode, message: string): never {
  throw new ObsidianResearchPackError(code, message);
}

function checkedOptions(options: MarkdownOptions): MarkdownOptions & { exportedAt: string } {
  if ((options.omittedFields !== undefined && (!Array.isArray(options.omittedFields)
    || options.omittedFields.some((field) => !evidenceFields.includes(field))))
    || (options.includeReportSnapshots !== undefined && typeof options.includeReportSnapshots !== "boolean")) {
    fail("invalid-options", "Choose supported evidence fields and a report inclusion option.");
  }
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  if (!isoTimestamp.safeParse(exportedAt).success) fail("invalid-options", "Use a valid export timestamp with an explicit timezone.");
  return { ...options, exportedAt };
}

function prepareRecord(record: SavedResearchRecord, options: MarkdownOptions): { note: string; sourceBytes: number } {
  const checked = validateExperiment(record?.experiment);
  if (!checked.ok) fail("invalid-record", "A selected saved experiment has unsupported data or exceeds its 5 MiB limit.");
  const experiment = checked.experiment;
  const summary = record.summary;
  if (!summary || Object.keys(summary).length !== 6 || summary.id !== experiment.id
    || summary.title !== experiment.title || summary.attemptCount !== experiment.attempts.length
    || summary.updatedAt !== experiment.updatedAt || !Number.isSafeInteger(summary.revision) || summary.revision < 1
    || !isoTimestamp.safeParse(summary.savedAt).success) {
    fail("invalid-record", "A selected saved record has inconsistent saved-copy metadata. Refresh the library before exporting.");
  }
  if (!experiment.title.trim()) fail("invalid-record", "Add an experiment title before including this saved record in an Obsidian pack.");
  if (!experiment.attempts.some((attempt) => attempt.input.trim())) {
    fail("invalid-record", "Add at least one attempt with input before including this saved record in an Obsidian pack.");
  }
  let note: string;
  try { note = exportExperimentMarkdown(experiment, options); }
  catch { fail("limit", "A selected Markdown note exceeds its supported limit. Omit evidence fields or attached reports and try again."); }
  // Count the same plaintext payload shape used by the local vault's quota.
  const sourceBytes = encoder.encode(JSON.stringify({ format: 1, experiment, summary })).byteLength;
  return { note: `${note}\n[Back to the research index](../index.md)\n`, sourceBytes };
}

/** Uses the same eligibility rules as the final pack; never silently excludes a selection. */
export function getObsidianResearchPackEligibility(
  record: SavedResearchRecord, options: MarkdownOptions = {},
): ObsidianResearchPackEligibility {
  try {
    prepareRecord(record, checkedOptions(options));
    return { eligible: true };
  } catch (error) {
    return { eligible: false, error: error instanceof ObsidianResearchPackError
      ? error.message : "This saved record cannot be included in an Obsidian pack." };
  }
}

function linkLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/[\\`*_{}\[\]()#+.!|><~\-]/g, "\\$&");
}

function frontmatter(exportedAt: string): string[] {
  return ["---", "visibility: private", "publish: false", `nestcipher_exported_at: ${JSON.stringify(exportedAt)}`, "---", ""];
}

/**
 * Explicit readable export of selected SAVED copies. Nothing is persisted, uploaded
 * or published. Whole-field omissions and report policy are delegated to the
 * existing Markdown serializer; each note retains its own disclosure metadata.
 */
export function buildObsidianResearchPack(
  records: readonly SavedResearchRecord[], options: MarkdownOptions = {},
): ObsidianResearchPack {
  if (!Array.isArray(records) || records.length === 0) fail("empty", "Select at least one saved experiment for the Obsidian pack.");
  if (records.length > OBSIDIAN_RESEARCH_PACK_LIMITS.maxRecords) fail("limit", "An Obsidian pack can contain at most 25 saved experiments.");
  const checked = checkedOptions(options);
  const ids = new Set<string>();
  const notes: ResearchPackFile[] = [];
  let sourceBytes = 0;
  for (const record of records) {
    const prepared = prepareRecord(record, checked);
    if (ids.has(record.experiment.id)) fail("duplicate-record", "Select each saved experiment only once for the Obsidian pack.");
    ids.add(record.experiment.id);
    sourceBytes += prepared.sourceBytes;
    if (sourceBytes > OBSIDIAN_RESEARCH_PACK_LIMITS.maxSourceBytes) fail("limit", "The selected saved research exceeds the 50 MiB source limit.");
    notes.push({ path: `experiments/${record.experiment.id}.md`, content: prepared.note });
  }
  const index = [
    ...frontmatter(checked.exportedAt), "# Research index", "",
    "Private, readable copies of selected saved experiments. Working drafts are not included.", "",
    "Live challenge breaks must not be shared before 30 full days after the confirmed challenge end. Each note records its own challenge status. Reaching a recorded date never publishes a note or grants publication permission; any later sharing needs an explicit review.", "",
    ...records.flatMap(({ experiment, summary }) => [
      `- [${linkLabel(experiment.title)}](experiments/${experiment.id}.md)`,
      `  - ${summary.attemptCount} attempt${summary.attemptCount === 1 ? "" : "s"}; saved ${summary.savedAt}; local revision ${summary.revision}.`,
    ]), "", "[Pack instructions](README.md)", "",
  ].join("\n");
  const readme = [
    ...frontmatter(checked.exportedAt), "# NestCipher private research pack", "",
    "1. Extract the ZIP into a private folder inside your Obsidian vault, preserving its folders.",
    "2. Open [the research index](index.md) to follow links to the selected experiments.",
    "3. Keep the extracted folder private. This ZIP contains readable research and is not encrypted.", "",
    "Only the selected saved copies are included. Unsaved working drafts are excluded. UUID filenames remain stable when titles change; a fresh export does not update an existing Obsidian folder automatically. Review files before replacing earlier notes.", "",
    "Each experiment retains its metadata, historical attempt conditions and private disclosure record. Evidence fields and attached reports follow the options chosen for this export. Omissions are stated in each note and leave the original saved records unchanged.", "",
    "Live challenge breaks must not be shared before 30 full days after a confirmed challenge end. Unknown or unconfirmed ends establish no public disclosure date. Reaching a recorded date grants no permission and triggers no publication; any later sharing needs an explicit review.", "",
    "Markdown is readable output, not a lossless restore format. Keep a separate encrypted vault backup for restoration. ZIP file timestamps are a fixed archive convention; research capture and saved times remain inside the notes and index.", "",
  ].join("\n");
  const pack = { files: [{ path: "README.md", content: readme }, { path: "index.md", content: index }, ...notes], recordCount: records.length };
  validatePackFiles(pack);
  return pack;
}

type EncodedPackFile = { name: Uint8Array<ArrayBuffer>; content: Uint8Array<ArrayBuffer> };
function validatePackFiles(pack: ObsidianResearchPack): { files: EncodedPackFile[]; byteLength: number } {
  if (!pack || !Array.isArray(pack.files) || !Number.isSafeInteger(pack.recordCount)
    || pack.recordCount < 1 || pack.recordCount > OBSIDIAN_RESEARCH_PACK_LIMITS.maxRecords
    || pack.files.length !== pack.recordCount + 2 || pack.files.length > OBSIDIAN_RESEARCH_PACK_LIMITS.maxFiles) {
    fail("invalid-pack", "Choose a supported Obsidian research pack.");
  }
  const paths = new Set<string>();
  const files: EncodedPackFile[] = [];
  let byteLength = 22; // End of central directory, with no comment.
  for (const file of pack.files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string"
      || (file.path !== "README.md" && file.path !== "index.md" && !notePath.test(file.path)) || paths.has(file.path)) {
      fail("invalid-pack", "The research pack contains an unsupported or duplicate file path.");
    }
    paths.add(file.path);
    // Bound individual encoding before allocating its UTF-8 buffer.
    if (file.content.length > LIMITS.maxEncodedBytes + 1024) fail("limit", "A research pack file exceeds the supported output limit.");
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    if (content.byteLength > LIMITS.maxEncodedBytes + 1024) fail("limit", "A research pack file exceeds the supported output limit.");
    byteLength += 30 + name.byteLength + content.byteLength + 46 + name.byteLength;
    if (byteLength > OBSIDIAN_RESEARCH_PACK_LIMITS.maxOutputBytes) fail("limit", "The readable research pack exceeds the 64 MiB output limit. Export fewer records.");
    files.push({ name, content });
  }
  if (!paths.has("README.md") || !paths.has("index.md")) fail("invalid-pack", "The research pack needs its instructions and linked index.");
  return { files, byteLength };
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  crcTable[index] = value >>> 0;
}
function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Portable UTF-8 STORE ZIP: explicit CRC-32, local headers, directory and EOCD. */
export function encodeResearchPackZip(pack: ObsidianResearchPack): Uint8Array<ArrayBuffer> {
  const { files, byteLength } = validatePackFiles(pack);
  const zip = new Uint8Array(new ArrayBuffer(byteLength));
  const view = new DataView(zip.buffer);
  const directory: { file: EncodedPackFile; crc: number; offset: number }[] = [];
  let offset = 0;
  for (const file of files) {
    const crc = crc32(file.content);
    directory.push({ file, crc, offset });
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 names and content; not encrypted.
    view.setUint16(offset + 12, 0x0021, true); // DOS date 1980-01-01, time 00:00.
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, file.content.byteLength, true);
    view.setUint32(offset + 22, file.content.byteLength, true);
    view.setUint16(offset + 26, file.name.byteLength, true);
    zip.set(file.name, offset + 30);
    zip.set(file.content, offset + 30 + file.name.byteLength);
    offset += 30 + file.name.byteLength + file.content.byteLength;
  }
  const directoryOffset = offset;
  for (const { file, crc, offset: localOffset } of directory) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 14, 0x0021, true);
    view.setUint32(offset + 16, crc, true);
    view.setUint32(offset + 20, file.content.byteLength, true);
    view.setUint32(offset + 24, file.content.byteLength, true);
    view.setUint16(offset + 28, file.name.byteLength, true);
    view.setUint32(offset + 42, localOffset, true);
    zip.set(file.name, offset + 46);
    offset += 46 + file.name.byteLength;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, offset - directoryOffset, true);
  view.setUint32(offset + 16, directoryOffset, true);
  return zip;
}
