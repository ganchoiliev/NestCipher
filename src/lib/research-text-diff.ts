/** A display-only, bounded comparison. Stored evidence is never rewritten. */
export const TEXT_DIFF_LIMITS = { characters: 20_000, lines: 250, cells: 62_500 } as const;

export type DiffLine = { kind: "unchanged" | "removed" | "added"; text: string; ending: "" | "\n" | "\r" | "\r\n" };
export type TextDifference =
  | { status: "identical"; rows: []; removed: 0; added: 0 }
  | { status: "skipped"; reason: string; rows: []; removed: 0; added: 0 }
  | { status: "changed"; rows: DiffLine[]; removed: number; added: number };

function lines(value: string): Omit<DiffLine, "kind">[] {
  const result: Omit<DiffLine, "kind">[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== "\n" && value[index] !== "\r") continue;
    const ending = value[index] === "\r" && value[index + 1] === "\n" ? "\r\n" : value[index] as "\r" | "\n";
    result.push({ text: value.slice(start, index), ending });
    if (ending === "\r\n") index++;
    start = index + 1;
  }
  if (start < value.length) result.push({ text: value.slice(start), ending: "" });
  return result;
}

export function compareResearchText(baseline: string, variant: string): TextDifference {
  if (baseline === variant) return { status: "identical", rows: [], removed: 0, added: 0 };
  if (baseline.length > TEXT_DIFF_LIMITS.characters || variant.length > TEXT_DIFF_LIMITS.characters) {
    return { status: "skipped", reason: "The change view supports up to 20,000 characters per value. Read the complete originals instead.", rows: [], removed: 0, added: 0 };
  }
  const before = lines(baseline);
  const after = lines(variant);
  if (before.length > TEXT_DIFF_LIMITS.lines || after.length > TEXT_DIFF_LIMITS.lines || before.length * after.length > TEXT_DIFF_LIMITS.cells) {
    return { status: "skipped", reason: "The change view supports up to 250 lines per value. Read the complete originals instead.", rows: [], removed: 0, added: 0 };
  }
  const width = after.length + 1;
  const table = new Uint16Array((before.length + 1) * width);
  const same = (i: number, j: number) => before[i].text === after[j].text && before[i].ending === after[j].ending;
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = same(i, j) ? 1 + table[(i + 1) * width + j + 1]
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const rows: DiffLine[] = [];
  let i = 0, j = 0, removed = 0, added = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && same(i, j)) {
      rows.push({ ...before[i++], kind: "unchanged" }); j++;
    } else if (i < before.length && (j === after.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      rows.push({ ...before[i++], kind: "removed" }); removed++;
    } else {
      rows.push({ ...after[j++], kind: "added" }); added++;
    }
  }
  return { status: "changed", rows, removed, added };
}

/** Visible labels are presentation only; they never enter a record or export. */
export function showHiddenCharacters(value: string): string {
  return [...value].map((character) => {
    const code = character.codePointAt(0)!;
    if (character === "\t") return "⟦TAB⟧";
    if (character === " ") return "·";
    if (code === 0xa0) return "⟦NBSP⟧";
    if ((code < 0x20 || code === 0x7f) || (code >= 0x200b && code <= 0x200f)
      || (code >= 0x202a && code <= 0x202e) || (code >= 0x2060 && code <= 0x2069) || code === 0xfeff) {
      return `⟦U+${code.toString(16).toUpperCase().padStart(4, "0")}⟧`;
    }
    return character;
  }).join("");
}
