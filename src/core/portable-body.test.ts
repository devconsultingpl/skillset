import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { listBundledSkills, loadBundledSkill, skillSourcePath } from "./bundle.js";
import { loadDeclarations } from "./declarations.js";
import { fileExists } from "./fs.js";
import type { ParsedSkill } from "./types.js";

/** Tokens a workspace extension expands and no harness does. ADR 0009. */
const EXTENSION_TOKENS: ReadonlyArray<{ readonly pattern: RegExp; readonly why: string }> = [
  { pattern: /\$ARGUMENTS/, why: "flow-args substitutes it; no harness does" },
  { pattern: /\$\{SKILL_DIR\}\//, why: "flow-args substitutes it; no harness does" },
  { pattern: /^```!/m, why: "flow-args executes the fence; no harness does" },
  { pattern: /shell-timeout:/, why: "read by flow-args alone" },
  { pattern: /\$\{CWD\}/, why: "expanded by nothing at all" },
  { pattern: /ask_user_question/, why: "a pi extension tool, not a capability" },
  { pattern: /MAX_HEADER_LENGTH/, why: "that tool's dialog cap, not a method" },
];

/** The bodies that moved out of the FLOW package in 0023 slice 3d. */
const MOVED = [
  "annotate-guidance",
  "annotate-inline",
  "changelog",
  "create-handoff",
  "discover",
  "frontend-design",
  "resume-handoff",
] as const;

const SIBLINGS: Record<string, readonly string[]> = {
  "annotate-guidance": [
    "examples/root-dotnet-clean-arch.md",
    "examples/root-nodejs-monorepo.md",
    "examples/subfolder-database-layer.md",
    "examples/subfolder-dotnet-application.md",
    "examples/subfolder-schemas-layer.md",
    "templates/root-architecture.md",
    "templates/subfolder-architecture.md",
  ],
  "annotate-inline": [
    "examples/root-dotnet-clean-arch.md",
    "examples/root-nodejs-monorepo.md",
    "examples/subfolder-database-layer.md",
    "examples/subfolder-dotnet-application.md",
    "examples/subfolder-schemas-layer.md",
    "templates/root-claude-md.md",
    "templates/subfolder-claude-md.md",
  ],
  changelog: ["_helpers/changelog-bootstrap.mjs"],
  "create-handoff": [],
  discover: ["templates/frd.md"],
  "frontend-design": [],
  "resume-handoff": [],
};

function rawFrontmatter(skill: ParsedSkill): Record<string, unknown> {
  return skill.frontmatter as unknown as Record<string, unknown>;
}

describe("portable bodies (ADR 0009)", () => {
  it("no bundled body carries a token only a workspace extension expands", async () => {
    for (const name of await listBundledSkills()) {
      const source = await readFile(skillSourcePath(name, "SKILL.md"), "utf8");
      for (const { pattern, why } of EXTENSION_TOKENS) {
        expect(pattern.test(source), `${name} carries ${pattern.source} — ${why}`).toBe(false);
      }
    }
  });

  it("each moved body installs where a workflow command resolves and where siblings can land", async () => {
    const { declarations, problems } = await loadDeclarations();
    expect(problems).toEqual([]);
    for (const name of MOVED) {
      const installs = declarations
        .filter((d) => d.skill === name)
        .map((d) => `${d.agent}/${d.mode}`)
        .sort();
      expect(installs, name).toEqual(["claude-code/auto", "pi/auto"]);
    }
  });

  it("each moved body keeps what pi reads under targets.pi and nothing pi cannot carry", async () => {
    for (const name of MOVED) {
      const fm = rawFrontmatter(await loadBundledSkill(name));
      expect(fm.contract, `${name} must not carry a top-level contract`).toBeUndefined();
      expect(
        fm["argument-hint"],
        `${name} must not carry a top-level argument-hint`,
      ).toBeUndefined();

      const targets = fm.targets as Record<string, Record<string, unknown>>;
      expect(targets.pi["disable-model-invocation"], `${name} → pi`).toBe(true);
      expect(targets.pi.contract, `${name} → pi contract`).toBeDefined();
      expect(targets.pi["argument-hint"], `${name} → pi auto cannot express it`).toBeUndefined();
      expect(targets["claude-code"], `${name} → claude-code`).toBeDefined();
    }
  });

  it("declares exactly the payload each moved body resolves, and every file exists", async () => {
    const { siblings } = await loadDeclarations();
    for (const name of MOVED) {
      expect(siblings[name]?.map((s) => s.rel).sort() ?? [], name).toEqual(
        [...SIBLINGS[name]].sort(),
      );
      for (const rel of SIBLINGS[name]) {
        expect(await fileExists(skillSourcePath(name, rel)), `${name}/${rel}`).toBe(true);
      }
    }
  });
});
