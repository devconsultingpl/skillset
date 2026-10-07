import { describe, expect, it } from "vitest";
import { declarationCoverage, declaredModes, parseDeclarations } from "./declarations.js";

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

describe("declarationCoverage", () => {
  it("flags a skill declared but not bundled", async () => {
    const problems = await declarationCoverage([
      { skill: "no-such-skill", agent: "pi", mode: "slash", scope: "global" },
    ]);
    expect(problems.some((p) => p.includes("declared but not present"))).toBe(true);
  });

  it("flags a bundled skill that declares nothing", async () => {
    // Only one real skill is declared, so every other bundled skill is uncovered.
    const problems = await declarationCoverage([
      { skill: "architect", agent: "pi", mode: "slash", scope: "global" },
    ]);
    expect(problems.some((p) => p.includes("bundled but declares no install"))).toBe(true);
    expect(problems.some((p) => p.includes("architect"))).toBe(false);
  });
});
