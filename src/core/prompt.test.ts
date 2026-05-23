import { describe, expect, it, vi } from "vitest";
import { type Asker, resolveDivergence } from "./prompt.js";

/** Build an asker that returns the queued answers in order. */
function scriptedAsker(answers: string[]): Asker {
  let i = 0;
  return async () => answers[i++] ?? "";
}

describe("resolveDivergence", () => {
  it("empty input defaults to skip", async () => {
    expect(await resolveDivergence(scriptedAsker([""]), () => {})).toBe("skip");
  });

  it("'s' skips, 'o' overwrites, 'a' aborts", async () => {
    expect(await resolveDivergence(scriptedAsker(["s"]), () => {})).toBe("skip");
    expect(await resolveDivergence(scriptedAsker(["o"]), () => {})).toBe("overwrite");
    expect(await resolveDivergence(scriptedAsker(["a"]), () => {})).toBe("abort");
  });

  it("is case- and whitespace-insensitive", async () => {
    expect(await resolveDivergence(scriptedAsker(["  O  "]), () => {})).toBe("overwrite");
  });

  it("'d' shows the diff then re-prompts", async () => {
    const onDiff = vi.fn();
    const decision = await resolveDivergence(scriptedAsker(["d", "s"]), onDiff);
    expect(onDiff).toHaveBeenCalledOnce();
    expect(decision).toBe("skip");
  });

  it("unrecognized input re-prompts", async () => {
    const decision = await resolveDivergence(scriptedAsker(["huh?", "o"]), () => {});
    expect(decision).toBe("overwrite");
  });
});
