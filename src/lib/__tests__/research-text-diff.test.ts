import { describe, expect, it } from "vitest";
import { compareResearchText, showHiddenCharacters } from "../research-text-diff";

describe("bounded research text differences", () => {
  it("recognizes exact equality, including empty values", () => {
    expect(compareResearchText("", "").status).toBe("identical");
    expect(compareResearchText("α\r\n\u200b", "α\r\n\u200b").status).toBe("identical");
  });

  it.each([
    ["", "new\n"], ["removed\n", ""], ["same\na\nsame\n", "same\nb\nsame\n"],
    ["line\r\n", "line\n"], ["a\r\rb", "a\r\nb"], ["a", "a\n"],
    ["α\t\u200b\n```\n<script>fake()</script>", "α\u00a0\u202e\r\n```\n<script>fake()</script>"],
  ])("can reconstruct both complete originals exactly", (baseline, variant) => {
    const diff = compareResearchText(baseline, variant);
    expect(diff.status).toBe("changed");
    expect(diff.rows.filter((row) => row.kind !== "added").map((row) => row.text + row.ending).join("")).toBe(baseline);
    expect(diff.rows.filter((row) => row.kind !== "removed").map((row) => row.text + row.ending).join("")).toBe(variant);
  });

  it("retains unchanged context and marks a replacement without scoring it", () => {
    const diff = compareResearchText("keep\nold\nend", "keep\nnew\nend");
    expect(diff.status).toBe("changed");
    expect(diff.rows.map((row) => row.kind)).toEqual(["unchanged", "removed", "added", "unchanged"]);
    expect(diff.removed).toBe(1); expect(diff.added).toBe(1);
  });

  it("reports line-ending-only edits as an actual difference", () => {
    const diff = compareResearchText("a\r\n", "a\n");
    expect(diff.rows.map((row) => row.ending)).toEqual(["\r\n", "\n"]);
    expect(diff.removed).toBe(1); expect(diff.added).toBe(1);
  });

  it("bounds work before allocating a large line matrix", () => {
    expect(compareResearchText("a".repeat(20_001), "x").status).toBe("skipped");
    expect(compareResearchText("a\n".repeat(251), "b\n".repeat(251)).status).toBe("skipped");
    expect(compareResearchText("a\n".repeat(250), "b\n".repeat(250)).status).toBe("changed");
  });

  it("makes hidden/control characters inspectable without normalizing Unicode", () => {
    expect(showHiddenCharacters(" α\t\u200b\u00a0\u202e\u2066\ufeff\u0000"))
      .toBe("·α⟦TAB⟧⟦U+200B⟧⟦NBSP⟧⟦U+202E⟧⟦U+2066⟧⟦U+FEFF⟧⟦U+0000⟧");
    expect(showHiddenCharacters("e\u0301😀")).toBe("e\u0301😀");
  });
});
