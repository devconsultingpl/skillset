import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "./helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-cli");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("cli — cross-cutting", () => {
  it("init convention scaffolds docs/ idempotently", async () => {
    const first = run(["init", "convention"], sb.projectRoot, sb.env);
    expect(first.status).toBe(0);
    expect(await exists(join(sb.projectRoot, "docs", "goals.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "docs", "conventions.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "docs", "plans", ".gitkeep"))).toBe(true);

    // Mutate a file and re-init — must not overwrite.
    await writeFile(join(sb.projectRoot, "docs", "goals.md"), "MY GOALS\n");
    const second = run(["init", "convention"], sb.projectRoot, sb.env);
    expect(second.status).toBe(0);
    expect(await readFile(join(sb.projectRoot, "docs", "goals.md"), "utf8")).toBe("MY GOALS\n");
  });

  it("emit confidence prints additionalContext JSON", () => {
    const out = run(["emit", "confidence"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    const parsed = JSON.parse(out.stdout);
    expect(typeof parsed.additionalContext).toBe("string");
    expect(parsed.additionalContext).toContain("# confidence");
  });
});

describe("cli — cross-mode reinstall guard", () => {
  const installArgs = (mode: string, extra: string[] = []) => [
    "install",
    "confidence",
    "--agent",
    "claude-code",
    "--mode",
    mode,
    "--local",
    ...extra,
  ];

  const readStateInstalls = async () => {
    const statePath = join(sb.home, ".skillset", "state.json");
    if (!(await exists(statePath))) return [];
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    return raw.installs as Array<{ skill: string; agent: string; scope: string; mode: string }>;
  };

  it("same-mode reinstall is idempotent (one state record)", async () => {
    expect(run(installArgs("slash"), sb.projectRoot, sb.env).status).toBe(0);
    expect(run(installArgs("slash"), sb.projectRoot, sb.env).status).toBe(0);
    const installs = await readStateInstalls();
    expect(installs).toHaveLength(1);
    expect(installs[0]).toMatchObject({ skill: "confidence", agent: "claude-code", mode: "slash" });
  });

  it("conflicting mode without --force errors with a helpful message", async () => {
    expect(run(installArgs("slash"), sb.projectRoot, sb.env).status).toBe(0);
    const out = run(installArgs("always"), sb.projectRoot, sb.env);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("already installed");
    expect(out.stderr).toContain("--force");
    expect(out.stderr).toContain("set-mode");
    // Prior artifact must still exist; nothing changed.
    expect(await exists(join(sb.projectRoot, ".claude", "commands", "confidence.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, ".claude", "settings.json"))).toBe(false);
    const installs = await readStateInstalls();
    expect(installs).toHaveLength(1);
    expect(installs[0].mode).toBe("slash");
  });

  it("conflicting mode with --force cleans up prior artifact and replaces the record", async () => {
    expect(run(installArgs("slash"), sb.projectRoot, sb.env).status).toBe(0);
    expect(run(installArgs("always", ["--force"]), sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(join(sb.projectRoot, ".claude", "commands", "confidence.md"))).toBe(false);
    expect(await exists(join(sb.projectRoot, ".claude", "settings.json"))).toBe(true);
    const installs = await readStateInstalls();
    expect(installs).toHaveLength(1);
    expect(installs[0].mode).toBe("always");
  });
});

describe("cli — list across agents and skills", () => {
  it("shows every installed (skill, agent) pair", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code,pi", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect(
      run(
        ["install", "convention", "--agent", "opencode", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);

    const out = run(["list"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("confidence");
    expect(out.stdout).toContain("convention");
    expect(out.stdout).toContain("claude-code");
    expect(out.stdout).toContain("pi");
    expect(out.stdout).toContain("opencode");
    expect(out.stdout).toMatch(/slash/);
    expect(out.stdout).toMatch(/always/);
  });
});

describe("cli — update re-syncs installed artifacts", () => {
  it("overwrites a manually edited install with the bundled source", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const path = join(sb.projectRoot, ".claude", "commands", "confidence.md");
    const original = await readFile(path, "utf8");
    expect(original).toContain("# confidence");

    await writeFile(path, "TAMPERED\n", "utf8");
    expect(await readFile(path, "utf8")).toBe("TAMPERED\n");

    expect(run(["update"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await readFile(path, "utf8")).toBe(original);
  });
});

describe("cli — set-mode round-trips on every agent", () => {
  const cases: Array<{
    agent: string;
    slashPath: (sb: Sandbox) => string;
    alwaysPath: (sb: Sandbox) => string;
  }> = [
    {
      agent: "pi",
      slashPath: (s) => join(s.projectRoot, ".pi", "prompts", "confidence.md"),
      alwaysPath: (s) => join(s.projectRoot, ".pi", "APPEND_SYSTEM.md"),
    },
    {
      agent: "opencode",
      slashPath: (s) => join(s.projectRoot, ".opencode", "commands", "confidence.md"),
      alwaysPath: (s) => join(s.projectRoot, "AGENTS.md"),
    },
    {
      agent: "copilot",
      slashPath: (s) => join(s.projectRoot, ".github", "prompts", "confidence.prompt.md"),
      alwaysPath: (s) => join(s.projectRoot, ".github", "copilot-instructions.md"),
    },
  ];

  for (const tc of cases) {
    it(`${tc.agent}: slash → always → slash`, async () => {
      expect(
        run(
          ["install", "confidence", "--agent", tc.agent, "--mode", "slash", "--local"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(await exists(tc.slashPath(sb))).toBe(true);

      expect(
        run(
          ["set-mode", "confidence", "always", "--agent", tc.agent, "--local"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(await exists(tc.slashPath(sb))).toBe(false);
      expect(await exists(tc.alwaysPath(sb))).toBe(true);

      expect(
        run(
          ["set-mode", "confidence", "slash", "--agent", tc.agent, "--local"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(await exists(tc.slashPath(sb))).toBe(true);
      expect(await exists(tc.alwaysPath(sb))).toBe(false);
    });
  }
});
