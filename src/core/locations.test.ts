import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { declarationsFilePath, stateFilePath } from "./locations.js";

/** Core knows where *skillset* keeps things, and nothing about a harness: the
 * harness paths are asserted beside each bridge (`src/bridges/paths.test.ts`). */
describe("skillset's own paths", () => {
  it("state lives under ~/.skillset", () => {
    expect(stateFilePath()).toBe(join(homedir(), ".skillset", "state.json"));
  });

  it("declarations resolve to the package root", () => {
    expect(declarationsFilePath()).toMatch(/skillset\.config\.json$/);
  });
});
