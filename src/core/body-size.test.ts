import { afterEach, describe, expect, it, vi } from "vitest";
import { ALWAYS_WARN_LINES_DEFAULT, alwaysWarnLines, bodyLineCount } from "./body-size.js";

describe("bodyLineCount", () => {
  it("counts content lines, ignoring trailing whitespace", () => {
    expect(bodyLineCount("a\nb\nc\n")).toBe(3);
    expect(bodyLineCount("a\nb\nc")).toBe(3);
    expect(bodyLineCount("a\nb\nc\n\n\n")).toBe(3);
  });
  it("returns 0 for empty / whitespace-only bodies", () => {
    expect(bodyLineCount("")).toBe(0);
    expect(bodyLineCount("\n\n  \n")).toBe(0);
  });
  it("counts blank interior lines", () => {
    expect(bodyLineCount("a\n\nb")).toBe(3);
  });
});

describe("alwaysWarnLines", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 80 when env is unset", () => {
    vi.stubEnv("SKILLSET_ALWAYS_WARN_LINES", "");
    expect(alwaysWarnLines()).toBe(ALWAYS_WARN_LINES_DEFAULT);
    expect(ALWAYS_WARN_LINES_DEFAULT).toBe(80);
  });
  it("honors a positive env override", () => {
    vi.stubEnv("SKILLSET_ALWAYS_WARN_LINES", "10");
    expect(alwaysWarnLines()).toBe(10);
  });
  it("falls back to default on garbage / non-positive values", () => {
    vi.stubEnv("SKILLSET_ALWAYS_WARN_LINES", "nope");
    expect(alwaysWarnLines()).toBe(ALWAYS_WARN_LINES_DEFAULT);
    vi.stubEnv("SKILLSET_ALWAYS_WARN_LINES", "0");
    expect(alwaysWarnLines()).toBe(ALWAYS_WARN_LINES_DEFAULT);
    vi.stubEnv("SKILLSET_ALWAYS_WARN_LINES", "-5");
    expect(alwaysWarnLines()).toBe(ALWAYS_WARN_LINES_DEFAULT);
  });
});
