import { describe, expect, it } from "vitest";
import { lineDiff } from "./diff.js";

describe("lineDiff", () => {
  it("marks unchanged lines as context", () => {
    expect(lineDiff("a\nb", "a\nb")).toBe("  a\n  b");
  });

  it("marks removed and added lines", () => {
    const out = lineDiff("a\nold\nc", "a\nnew\nc");
    expect(out).toContain("  a");
    expect(out).toContain("- old");
    expect(out).toContain("+ new");
    expect(out).toContain("  c");
  });

  it("handles pure insertion", () => {
    expect(lineDiff("", "x")).toBe("- \n+ x");
  });

  it("preserves shared prefix and suffix around an edit", () => {
    const out = lineDiff("keep\ndrop\ntail", "keep\ntail").split("\n");
    expect(out).toEqual(["  keep", "- drop", "  tail"]);
  });
});
