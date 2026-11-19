/**
 * lens-contracts.test.ts — the rendered artifact, not the source frontmatter.
 *
 * `supervise-contract.test.ts` asserts that the four review lenses *declare* a
 * contract. This asserts what pi actually writes: a contract reaches flow only
 * through the skill directory `loadSkills` enumerates, and it reaches it as the
 * renderer flattened it. A `requires` declaration cannot guard this — `requires`
 * is mode-blind and `always` renders no frontmatter, so declaring one makes an
 * `always` install of the same skill fail. The rendered bytes are the surface, so
 * the rendered bytes are what the suite pins.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBundledSkill } from "../../core/bundle.js";
import { piBridge } from "../index.js";

const LENSES = ["appsec-review", "declutter", "convention"] as const;

interface ReviewContract {
  produces: {
    kind: string;
    meta: { artifactKind: string };
    data: {
      type: string;
      required: string[];
      properties: {
        status: { enum: string[] };
        blockers_count: { minimum?: number; maximum?: number };
      };
    };
  };
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skillset-lens-contracts-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function renderedContract(name: string): Promise<ReviewContract> {
  const skill = await loadBundledSkill(name);
  const record = await piBridge.install({ skill, scope: "local", mode: "auto", projectRoot: root });
  const file = record.files[0];
  expect(file, `${name} renders one skill file`).toBeDefined();
  const written = await readFile(join(record.location, file as string), "utf8");
  const contract = (matter(written).data as { contract?: ReviewContract }).contract;
  expect(contract, `${name} renders a contract into its pi skill file`).toBeDefined();
  return contract as ReviewContract;
}

describe("the review lenses as pi renders them", () => {
  it("renders code-review's contract shape, not a plausible look-alike", async () => {
    const reference = await renderedContract("code-review");
    expect(reference.produces.meta.artifactKind).toBe("review");
    expect(reference.produces.data.required).toContain("blockers_count");
    expect(Object.keys(reference.produces.data.properties).sort()).toEqual([
      "blockers_count",
      "status",
    ]);
    expect(reference.produces.data.properties.status.enum).toEqual([
      "in-progress",
      "in-review",
      "ready",
    ]);
  });

  it("renders the same artifactKind, required list and key names for all three lenses", async () => {
    const reference = await renderedContract("code-review");
    for (const lens of LENSES) {
      const contract = await renderedContract(lens);
      expect(contract.produces.kind, lens).toBe(reference.produces.kind);
      expect(contract.produces.meta.artifactKind, lens).toBe("review");
      expect(contract.produces.data.required, lens).toEqual(reference.produces.data.required);
      expect(Object.keys(contract.produces.data.properties).sort(), lens).toEqual(
        Object.keys(reference.produces.data.properties).sort(),
      );
      expect(contract.produces.data.properties.status.enum, lens).toEqual(
        reference.produces.data.properties.status.enum,
      );
    }
  });

  it("renders declutter's blockers_count capped at zero, so bloat cannot gate a run", async () => {
    const contract = await renderedContract("declutter");
    expect(contract.produces.data.properties.blockers_count.minimum).toBe(0);
    expect(contract.produces.data.properties.blockers_count.maximum).toBe(0);
    for (const lens of ["code-review", "appsec-review", "convention"] as const) {
      const other = await renderedContract(lens);
      expect(other.produces.data.properties.blockers_count.maximum, lens).toBeUndefined();
    }
  });
});
