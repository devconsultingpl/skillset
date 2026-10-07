import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifySiblings,
  configPlaceholdersIn,
  declarationCoverage,
  declaredModes,
  parseDeclarations,
} from "./declarations.js";
import type { SiblingFile } from "./types.js";

describe("parseDeclarations", () => {
  it("defaults scope to global and keeps every declared entry", () => {
    const { declarations, problems } = parseDeclarations({
      version: 1,
      installs: {
        architect: [
          { agent: "pi", mode: "slash" },
          { agent: "pi", mode: "auto" },
          { agent: "claude-code", mode: "slash" },
        ],
      },
    });

    expect(problems).toEqual([]);
    expect(declarations).toHaveLength(3);
    expect(declarations.every((d) => d.scope === "global")).toBe(true);
    expect(declaredModes(declarations, "architect", "pi", "global")).toEqual(["slash", "auto"]);
  });

  it("rejects unknown agents and modes by name", () => {
    const { problems } = parseDeclarations({
      version: 1,
      installs: {
        architect: [
          { agent: "cursor", mode: "slash" },
          { agent: "pi", mode: "sometimes" },
        ],
      },
    });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('unknown agent "cursor"');
    expect(problems[1]).toContain('unknown mode "sometimes"');
  });

  it("requires a projectPath for a local declaration", () => {
    const { declarations, problems } = parseDeclarations({
      version: 1,
      installs: { architect: [{ agent: "pi", mode: "slash", scope: "local" }] },
    });

    expect(declarations).toEqual([]);
    expect(problems.some((p) => p.includes("projectPath"))).toBe(true);
  });

  it("carries a local declaration's projectPath through", () => {
    const { declarations } = parseDeclarations({
      version: 1,
      installs: {
        architect: [{ agent: "pi", mode: "slash", scope: "local", projectPath: "/work/p" }],
      },
    });

    expect(declarations).toEqual([
      { skill: "architect", agent: "pi", mode: "slash", scope: "local", projectPath: "/work/p" },
    ]);
  });

  it("reports a wrong version and a malformed installs block", () => {
    expect(parseDeclarations({ version: 2, installs: {} }).problems[0]).toContain("version");
    expect(parseDeclarations({ version: 1, installs: [] }).problems[0]).toContain("keyed by skill");
    expect(parseDeclarations({ version: 1, installs: { architect: [] } }).problems[0]).toContain(
      "at least one install",
    );
  });
});

describe("parseDeclarations — sibling files", () => {
  it("keeps a declared list and resolves each entry against the bundle", () => {
    const { siblings, problems } = parseDeclarations({
      version: 1,
      installs: { "code-review": [{ agent: "pi", mode: "auto" }] },
      siblings: { "code-review": ["_helpers/review-range.mjs"] },
    });

    expect(problems).toEqual([]);
    expect(siblings["code-review"]).toHaveLength(1);
    expect(siblings["code-review"]?.[0]?.rel).toBe("_helpers/review-range.mjs");
    // The source is resolved, not copied into the declaration: one source of bytes.
    expect(siblings["code-review"]?.[0]?.source).toMatch(
      /skills\/code-review\/_helpers\/review-range\.mjs$/,
    );
  });

  it("rejects an absolute path, an escape, SKILL.md and a duplicate by name", () => {
    const { siblings, problems } = parseDeclarations({
      version: 1,
      installs: {},
      siblings: { architect: ["/etc/passwd", "../escape.mjs", "SKILL.md", "a.mjs", "a.mjs"] },
    });

    expect(problems).toHaveLength(4);
    expect(problems[0]).toContain("absolute");
    expect(problems[1]).toContain("outside the skill directory");
    expect(problems[2]).toContain("SKILL.md is rendered, not copied");
    expect(problems[3]).toContain("declared twice");
    // The valid entry survives, as with a malformed install entry.
    expect(siblings.architect?.map((s) => s.rel)).toEqual(["a.mjs"]);
  });

  it("reports a malformed siblings block", () => {
    expect(parseDeclarations({ version: 1, installs: {}, siblings: [] }).problems[0]).toContain(
      "`siblings` must be an object keyed by skill name",
    );
    expect(
      parseDeclarations({ version: 1, installs: {}, siblings: { architect: "x.mjs" } }).problems[0],
    ).toContain("architect: sibling files must be an array");
    expect(
      parseDeclarations({ version: 1, installs: {}, siblings: { architect: [""] } }).problems[0],
    ).toContain("must be a non-empty relative path");
  });

  it("treats an absent siblings block as no siblings", () => {
    const { siblings, problems } = parseDeclarations({ version: 1, installs: {} });
    expect(problems).toEqual([]);
    expect(siblings).toEqual({});
  });
});

describe("declarationCoverage", () => {
  it("flags a skill declared but not bundled", async () => {
    const problems = await declarationCoverage(
      [{ skill: "no-such-skill", agent: "pi", mode: "slash", scope: "global" }],
      {},
    );
    expect(problems.some((p) => p.includes("declared but not present"))).toBe(true);
  });

  it("flags a bundled skill that declares nothing", async () => {
    // Only one real skill is declared, so every other bundled skill is uncovered.
    const problems = await declarationCoverage(
      [{ skill: "architect", agent: "pi", mode: "slash", scope: "global" }],
      {},
    );
    expect(problems.some((p) => p.includes("bundled but declares no install"))).toBe(true);
    expect(problems.some((p) => p.includes("architect"))).toBe(false);
  });

  it("flags a declared sibling that is not in the bundle", async () => {
    const problems = await declarationCoverage(
      [{ skill: "architect", agent: "pi", mode: "slash", scope: "global" }],
      {
        architect: [
          { rel: "_helpers/nope.mjs", source: "/nonexistent/skills/architect/_helpers/nope.mjs" },
        ],
      },
    );
    expect(problems.some((p) => p.includes("declared sibling _helpers/nope.mjs is not in"))).toBe(
      true,
    );
  });

  it("flags sibling files declared for a skill that declares no install", async () => {
    const problems = await declarationCoverage([], {
      "code-review": [{ rel: "a.mjs", source: "/nonexistent/skills/code-review/a.mjs" }],
    });
    expect(problems.some((p) => p.includes("declares sibling files but no install"))).toBe(true);
  });

  it("flags a sibling carrying a config placeholder that a copy cannot substitute", () => {
    // Siblings are copied byte-for-byte, so a key of the skill's own `config:`
    // block would ship unsubstituted and break the helper at its point of use.
    expect(configPlaceholdersIn("# {{start}}% resume at {{resume}}", ["start", "resume"])).toEqual([
      "start",
      "resume",
    ]);
    // Braces a skill never declared are the template's own business.
    expect(configPlaceholdersIn("{{startTime}} and {{other}}", ["start"])).toEqual([]);
  });
});

describe("classifySiblings", () => {
  let dir: string;
  const rel = "_helpers/helper.mjs";
  let sibling: SiblingFile;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "skillset-sibling-"));
    await mkdir(join(dir, "source"), { recursive: true });
    await writeFile(join(dir, "source", "helper.mjs"), "export const v = 1;\n", "utf8");
    sibling = { rel, source: join(dir, "source", "helper.mjs") };
    await mkdir(join(dir, "install", "_helpers"), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const installed = () => join(dir, "install", rel);
  const classify = (recorded: string[]) =>
    classifySiblings([sibling], join(dir, "install"), new Set(recorded));

  it("labels a recorded copy that still matches the source in-sync", async () => {
    await writeFile(installed(), "export const v = 1;\n", "utf8");
    const [state] = await classify([rel]);
    expect(state?.status).toBe("in-sync");
    expect(state?.path).toBe(installed());
  });

  it("labels a recorded copy that was edited drifted, carrying both sides", async () => {
    await writeFile(installed(), "export const v = 2;\n", "utf8");
    const [state] = await classify([rel]);
    expect(state?.status).toBe("drifted");
    expect(state?.currentBytes).toContain("v = 2");
    expect(state?.nextBytes).toContain("v = 1");
  });

  it("labels an unrecorded byte-identical copy adoptable", async () => {
    await writeFile(installed(), "export const v = 1;\n", "utf8");
    const [state] = await classify([]);
    expect(state?.status).toBe("adoptable");
  });

  it("labels an unrecorded different file foreign — never silently replaced", async () => {
    await writeFile(installed(), "someone else's helper\n", "utf8");
    const [state] = await classify([]);
    expect(state?.status).toBe("foreign");
    expect(state?.currentBytes).toContain("someone else's");
  });

  it("labels a declared sibling that is absent missing", async () => {
    const [state] = await classify([rel]);
    expect(state?.status).toBe("missing");
    expect(state?.currentBytes).toBeUndefined();
  });
});
