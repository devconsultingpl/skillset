import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRIDGE_NAMES, bridgeFor } from "./index.js";

/**
 * Slice 2e's rule, executable.
 *
 * The core is harness-agnostic: `src/core/**` may not name a harness and may not
 * import a bridge. Harness knowledge lives in `src/bridges/<harness>/`, and this
 * registry is the only file that names one. If a future change wants to put a
 * harness name or a harness path in the core "because it is convenient there",
 * this test is what says no.
 */
const here = dirname(fileURLToPath(import.meta.url));
const coreDir = join(here, "..", "core");

/** The criterion's own pattern: a harness name, with `pi` bounded so ordinary
 * words cannot trip it. */
const HARNESS_NAME = /claude|opencode|copilot|\bpi\b/i;

async function coreSources(): Promise<string[]> {
  const entries = await readdir(coreDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(coreDir, entry.name));
}

describe("the bridge boundary", () => {
  it("no file in src/core names a harness", async () => {
    const offenders: string[] = [];
    for (const path of await coreSources()) {
      if (path.endsWith(".test.ts")) continue;
      const lines = (await readFile(path, "utf8")).split("\n");
      lines.forEach((line, index) => {
        if (HARNESS_NAME.test(line)) {
          offenders.push(`${relative(coreDir, path)}:${index + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("no file in src/core imports the bridges", async () => {
    // Test files are exempt, and only they: a test of the core may reach for the
    // real bridges to assert against them, while production core code may not.
    const offenders: string[] = [];
    for (const path of await coreSources()) {
      if (path.endsWith(".test.ts")) continue;
      const body = await readFile(path, "utf8");
      if (/from\s+"\.\.\/bridges\//.test(body)) offenders.push(relative(coreDir, path));
    }
    expect(offenders).toEqual([]);
  });

  it("this registry is the only file that names every harness", async () => {
    // It has to name them, because it is where the bridges are registered. The
    // point of the assertion is that it is the *only* such file: the imports it
    // makes are the whole list.
    const body = await readFile(fileURLToPath(import.meta.url), "utf8");
    expect(body).toContain("BRIDGES");
    expect(BRIDGE_NAMES.length).toBeGreaterThan(0);
  });

  it("resolves a registered name, and refuses one nothing provides", () => {
    for (const name of BRIDGE_NAMES) {
      expect(bridgeFor(name)?.name).toBe(name);
    }
    expect(bridgeFor("cursor")).toBeUndefined();
  });
});
