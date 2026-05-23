import { describe, expect, it } from "vitest";
import { JS, MD, extract, remove, upsert, wrap } from "./markers.js";

describe("markers", () => {
  it("wraps in html-style markers by default", () => {
    const out = wrap("confidence", "content");
    expect(out).toContain("<!-- skillset:begin confidence -->");
    expect(out).toContain("<!-- skillset:end confidence -->");
    expect(out).toContain("content");
  });

  it("supports line-comment style", () => {
    const out = wrap("confidence", "x", JS);
    expect(out).toContain("// skillset:begin confidence");
    expect(out).toContain("// skillset:end confidence");
  });

  it("upsert appends when no existing block", () => {
    const base = "user content here\n";
    const after = upsert(base, "confidence", "skill body");
    expect(after).toContain("user content here");
    expect(after).toContain("skillset:begin confidence");
  });

  it("upsert replaces an existing block in place, leaving surrounding text", () => {
    const base = `before\n${wrap("confidence", "old", MD)}after\n`;
    const after = upsert(base, "confidence", "new", MD);
    expect(after).toContain("before");
    expect(after).toContain("after");
    expect(after).toContain("new");
    expect(after).not.toContain("old");
  });

  it("remove strips only its own block, leaving other content intact", () => {
    const base = `pre\n${wrap("a", "AA", MD)}mid\n${wrap("b", "BB", MD)}post\n`;
    const after = remove(base, "a", MD);
    expect(after).not.toContain("AA");
    expect(after).toContain("BB");
    expect(after).toContain("pre");
    expect(after).toContain("mid");
    expect(after).toContain("post");
  });

  it("remove is a no-op if marker absent", () => {
    const base = "no markers here\n";
    expect(remove(base, "x")).toBe(base);
  });

  it("extract returns the block interior (the trimmed body wrap stored)", () => {
    const base = `before\n${wrap("confidence", "line one\nline two", MD)}after\n`;
    expect(extract(base, "confidence", MD)).toBe("line one\nline two");
  });

  it("extract returns null when the block is absent", () => {
    expect(extract("just user content\n", "confidence", MD)).toBeNull();
  });

  it("extract targets only the named block among several", () => {
    const base = `${wrap("a", "AA", MD)}${wrap("b", "BB", MD)}`;
    expect(extract(base, "b", MD)).toBe("BB");
  });
});
