import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, repoRoot, run } from "./helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-cli");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("cli — harness field support (0023 slice 2c)", () => {
  type ScratchConfig = {
    installs: Record<string, Array<{ agent: string; mode: string }>>;
    requires?: Record<string, Record<string, string[]>>;
  };

  /** The repository's own declarations, one edit applied, in a scratch file. */
  async function scratchConfig(
    mutate: (config: ScratchConfig) => void,
  ): Promise<NodeJS.ProcessEnv> {
    const config = JSON.parse(await readFile(join(repoRoot, "skillset.config.json"), "utf8"));
    mutate(config);
    const path = join(sb.projectRoot, "scratch-skillset.config.json");
    await writeFile(path, JSON.stringify(config, null, 2));
    return { SKILLSET_CONFIG: path };
  }

  /** Records this sandbox wrote, if any — `writeState` always leaves a file. */
  async function recordedSkills(): Promise<string[]> {
    const path = join(sb.home, ".skillset", "state.json");
    if (!(await exists(path))) return [];
    const state = JSON.parse(await readFile(path, "utf8"));
    return (state.installs ?? []).map((record: { skill: string }) => record.skill);
  }

  const opencodeCommand = () =>
    join(sb.home, ".config", "opencode", "commands", "sk-code-review.md");

  it("refuses a required field no renderer can express, and installs nothing", async () => {
    const env = await scratchConfig((config) => {
      config.installs["code-review"].push({ agent: "opencode", mode: "slash" });
      config.requires = { "code-review": { opencode: ["disable-model-invocation"] } };
    });

    const out = run(
      ["install", "code-review", "--agent", "opencode", "--mode", "slash", "--global"],
      sb.projectRoot,
      { ...sb.env, ...env },
    );

    expect(out.status).toBe(1);
    expect(out.stderr).toContain(
      "required field `disable-model-invocation` has no renderer for opencode",
    );
    expect(out.stderr).toContain("refusing a partial install");
    expect(await exists(opencodeCommand())).toBe(false);
    expect(await recordedSkills()).toEqual([]);
  });

  it("installs the same skill when nothing requires the unsupported field", async () => {
    const out = run(
      ["install", "code-review", "--agent", "opencode", "--mode", "slash", "--global"],
      sb.projectRoot,
      sb.env,
    );

    expect(out.status).toBe(0);
    expect(await exists(opencodeCommand())).toBe(true);
    expect(await recordedSkills()).toEqual(["code-review"]);
  });

  it("sync refuses the whole run when a requirement has no renderer", async () => {
    const env = await scratchConfig((config) => {
      config.installs["code-review"].push({ agent: "opencode", mode: "slash" });
      config.requires = { "code-review": { opencode: ["disable-model-invocation"] } };
    });

    const out = run(["sync"], sb.projectRoot, { ...sb.env, ...env });

    expect(out.status).toBe(2);
    expect(out.stderr).toContain("required field `disable-model-invocation` has no renderer");
    expect(await exists(opencodeCommand())).toBe(false);
    expect(await recordedSkills()).toEqual([]);
    // Not even the installs that are perfectly fine: sync writes all or nothing.
    expect(await exists(join(sb.home, ".pi", "agent", "prompts", "sk-architect.md"))).toBe(false);
  });

  it("reports no unsupported field for the repository's own declarations", async () => {
    // The honest current state: no shipped skill declares a harness field its
    // target cannot express, so a healthy sync is silent about the matrix. Since
    // 2b the review declares `contract` for pi — expressible there through the
    // `auto` install, which is why the check judges a field across the modes an
    // agent is installed in rather than per artifact.
    const out = run(["sync", "--dry-run"], sb.projectRoot, sb.env);

    expect(out.status).toBe(0);
    expect(out.stderr).not.toContain("cannot express");
    // Neither the capability report nor the sibling note: both gaps are closed.
    expect(out.stderr).not.toContain("declared sibling file(s)");
  });
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

  it("init convention scaffolds monorepo apps (non-TTY default: every app + root)", async () => {
    await mkdir(join(sb.projectRoot, "apps", "web"), { recursive: true });
    await mkdir(join(sb.projectRoot, "apps", "api"), { recursive: true });
    await writeFile(join(sb.projectRoot, "package.json"), '{"workspaces": ["apps/*"]}');
    await writeFile(join(sb.projectRoot, "apps", "web", "package.json"), "{}");
    await writeFile(join(sb.projectRoot, "apps", "api", "package.json"), "{}");

    const out = run(["init", "convention"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(await exists(join(sb.projectRoot, "docs", "goals.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "apps", "web", "docs", "goals.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "apps", "api", "docs", "goals.md"))).toBe(true);
  });

  it("init convention --no-apps scaffolds root only", async () => {
    await mkdir(join(sb.projectRoot, "apps", "web"), { recursive: true });
    await writeFile(join(sb.projectRoot, "package.json"), '{"workspaces": ["apps/*"]}');
    await writeFile(join(sb.projectRoot, "apps", "web", "package.json"), "{}");

    const out = run(["init", "convention", "--no-apps"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(await exists(join(sb.projectRoot, "docs", "goals.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "apps", "web", "docs", "goals.md"))).toBe(false);
  });

  it("init convention --yes accepts the flag (agent-safe) and scaffolds", async () => {
    await mkdir(join(sb.projectRoot, "apps", "web"), { recursive: true });
    await writeFile(join(sb.projectRoot, "package.json"), '{"workspaces": ["apps/*"]}');
    await writeFile(join(sb.projectRoot, "apps", "web", "package.json"), "{}");

    const out = run(["init", "convention", "--yes"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(await exists(join(sb.projectRoot, "docs", "goals.md"))).toBe(true);
    expect(await exists(join(sb.projectRoot, "apps", "web", "docs", "goals.md"))).toBe(true);
  });

  it("init convention reports created vs nothing-to-create", async () => {
    const first = run(["init", "convention"], sb.projectRoot, sb.env);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("created");

    const second = run(["init", "convention"], sb.projectRoot, sb.env);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("nothing to create");
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

  it("records a second mode beside the first instead of replacing it", async () => {
    expect(run(installArgs("slash"), sb.projectRoot, sb.env).status).toBe(0);
    expect(run(installArgs("auto"), sb.projectRoot, sb.env).status).toBe(0);
    // Both artifacts survive, and both records exist: this is the deliberate
    // dual slash+auto setup the old state model could not represent (ADR 0005).
    expect(await exists(join(sb.projectRoot, ".claude", "commands", "sk-confidence.md"))).toBe(
      true,
    );
    expect(await exists(join(sb.projectRoot, ".claude", "skills", "confidence", "SKILL.md"))).toBe(
      true,
    );
    const installs = await readStateInstalls();
    expect(installs.map((i) => i.mode).sort()).toEqual(["auto", "slash"]);
  });

  it("refuses an unrecorded file at an owned destination, and --force replaces it", async () => {
    const promptPath = join(sb.projectRoot, ".claude", "commands", "sk-confidence.md");
    await mkdir(dirname(promptPath), { recursive: true });
    await writeFile(promptPath, "my own file\n", "utf8");

    const refused = run(installArgs("slash"), sb.projectRoot, sb.env);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("not written by skillset");
    // The user's file is untouched, and nothing was recorded for it.
    expect(await readFile(promptPath, "utf8")).toBe("my own file\n");
    expect(await readStateInstalls()).toHaveLength(0);

    expect(run(installArgs("slash", ["--force"]), sb.projectRoot, sb.env).status).toBe(0);
    expect(await readFile(promptPath, "utf8")).toContain("confidence");
    expect(await readStateInstalls()).toHaveLength(1);
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

describe("cli — update protects local edits", () => {
  const installSlash = () =>
    run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
  const cmdPath = () => join(sb.projectRoot, ".claude", "commands", "sk-confidence.md");

  it("non-interactively skips a diverged install and warns", async () => {
    expect(installSlash().status).toBe(0);
    await writeFile(cmdPath(), "TAMPERED\n", "utf8");

    const out = run(["update"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stderr).toContain("skip");
    expect(out.stderr).toContain("--force");
    // Local edit survives.
    expect(await readFile(cmdPath(), "utf8")).toBe("TAMPERED\n");
  });

  it("restores a missing install without prompting (not a divergence)", async () => {
    expect(installSlash().status).toBe(0);
    const original = await readFile(cmdPath(), "utf8");
    await rm(cmdPath());

    expect(run(["update"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await readFile(cmdPath(), "utf8")).toBe(original);
  });

  it("--force overwrites a diverged install", async () => {
    expect(installSlash().status).toBe(0);
    const original = await readFile(cmdPath(), "utf8");
    await writeFile(cmdPath(), "TAMPERED\n", "utf8");

    expect(run(["update", "--force"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await readFile(cmdPath(), "utf8")).toBe(original);
  });

  it("--dry-run reports divergence and writes nothing", async () => {
    expect(installSlash().status).toBe(0);
    await writeFile(cmdPath(), "TAMPERED\n", "utf8");

    const out = run(["update", "--dry-run"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("diverged");
    // Nothing written: the tamper stays exactly as-is.
    expect(await readFile(cmdPath(), "utf8")).toBe("TAMPERED\n");
  });

  it("--skip-customized leaves diverged files untouched", async () => {
    expect(installSlash().status).toBe(0);
    await writeFile(cmdPath(), "TAMPERED\n", "utf8");

    expect(run(["update", "--skip-customized"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await readFile(cmdPath(), "utf8")).toBe("TAMPERED\n");
  });

  it("ignores edits outside a marker block but protects edits inside it", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "opencode", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const anchor = join(sb.projectRoot, "AGENTS.md");

    // Edit only OUTSIDE the marker block — not a divergence; update rewrites silently.
    const withSurround = `# my own heading\n\n${await readFile(anchor, "utf8")}\ntrailing note\n`;
    await writeFile(anchor, withSurround, "utf8");
    const outside = run(["update"], sb.projectRoot, sb.env);
    expect(outside.status).toBe(0);
    expect(outside.stderr).not.toContain("skip");
    const afterOutside = await readFile(anchor, "utf8");
    expect(afterOutside).toContain("my own heading");
    expect(afterOutside).toContain("trailing note");

    // Now edit INSIDE the marker interior — that is a divergence; skipped non-interactively.
    const beginMarker = "<!-- skillset:begin confidence -->";
    const tampered = afterOutside.replace(beginMarker, `${beginMarker}\nHAND EDITED`);
    expect(tampered).not.toBe(afterOutside);
    await writeFile(anchor, tampered, "utf8");
    const inside = run(["update"], sb.projectRoot, sb.env);
    expect(inside.status).toBe(0);
    expect(inside.stderr).toContain("skip");
    expect(await readFile(anchor, "utf8")).toContain("HAND EDITED");
  });

  it("mixes a diverged and a clean install in one run", async () => {
    expect(installSlash().status).toBe(0);
    expect(
      run(
        ["install", "convention", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const conventionPath = join(sb.projectRoot, ".claude", "commands", "sk-convention.md");
    const conventionOriginal = await readFile(conventionPath, "utf8");
    await writeFile(cmdPath(), "TAMPERED\n", "utf8");

    const out = run(["update"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    // Diverged one skipped; clean one rewritten to match the bundle.
    expect(await readFile(cmdPath(), "utf8")).toBe("TAMPERED\n");
    expect(await readFile(conventionPath, "utf8")).toBe(conventionOriginal);
  });
});

describe("cli — always-mode body-size warning", () => {
  it("warns on install when rendered body exceeds the threshold", () => {
    const out = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "always", "--local"],
      sb.projectRoot,
      { ...sb.env, SKILLSET_ALWAYS_WARN_LINES: "5" },
    );
    expect(out.status).toBe(0);
    expect(out.stderr).toContain("warning: confidence body is");
    expect(out.stderr).toContain("lines (>5)");
    expect(out.stderr).toContain("anchor-mode");
  });

  it("stays quiet on install below threshold", () => {
    const out = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "always", "--local"],
      sb.projectRoot,
      { ...sb.env, SKILLSET_ALWAYS_WARN_LINES: "10000" },
    );
    expect(out.status).toBe(0);
    expect(out.stderr).not.toContain("warning:");
  });

  it("stays quiet for non-always installs even with a tiny threshold", () => {
    const out = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      { ...sb.env, SKILLSET_ALWAYS_WARN_LINES: "1" },
    );
    expect(out.status).toBe(0);
    expect(out.stderr).not.toContain("warning:");
  });

  it("warns when set-mode switches into always above threshold", () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const out = run(
      ["set-mode", "confidence", "always", "--agent", "claude-code", "--local"],
      sb.projectRoot,
      { ...sb.env, SKILLSET_ALWAYS_WARN_LINES: "5" },
    );
    expect(out.status).toBe(0);
    expect(out.stderr).toContain("warning: confidence body is");
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
      slashPath: (s) => join(s.projectRoot, ".pi", "prompts", "sk-confidence.md"),
      alwaysPath: (s) => join(s.projectRoot, ".pi", "APPEND_SYSTEM.md"),
    },
    {
      agent: "opencode",
      slashPath: (s) => join(s.projectRoot, ".opencode", "commands", "sk-confidence.md"),
      alwaysPath: (s) => join(s.projectRoot, "AGENTS.md"),
    },
    {
      agent: "copilot",
      slashPath: (s) => join(s.projectRoot, ".github", "prompts", "sk-confidence.prompt.md"),
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

describe("cli — set-mode leaves one record", () => {
  const readInstalls = async () => {
    const statePath = join(sb.home, ".skillset", "state.json");
    if (!(await exists(statePath))) return [];
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    return raw.installs as Array<{ skill: string; agent: string; mode: string }>;
  };

  const forPi = async () =>
    (await readInstalls()).filter((i) => i.skill === "confidence" && i.agent === "pi");

  it("swaps the record instead of leaving the abandoned mode beside it", async () => {
    const slashPrompt = join(sb.projectRoot, ".pi", "prompts", "sk-confidence.md");
    const anchor = join(sb.projectRoot, ".pi", "APPEND_SYSTEM.md");
    const setMode = (mode: string) =>
      run(["set-mode", "confidence", mode, "--agent", "pi", "--local"], sb.projectRoot, sb.env);

    expect(
      run(
        ["install", "confidence", "--agent", "pi", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect((await forPi()).map((i) => i.mode)).toEqual(["slash"]);

    expect(setMode("always").status).toBe(0);
    // Identity includes the mode, so a switch must remove the record it replaced:
    // leaving it behind means the artifact is gone while the record survives, and
    // the next `sync` reinstalls the mode the developer switched away from.
    expect((await forPi()).map((i) => i.mode)).toEqual(["always"]);
    expect(await exists(slashPrompt)).toBe(false);
    expect(await exists(anchor)).toBe(true);

    expect(setMode("slash").status).toBe(0);
    expect((await forPi()).map((i) => i.mode)).toEqual(["slash"]);
    expect(await exists(slashPrompt)).toBe(true);
    expect(await exists(anchor)).toBe(false);
  });
});

describe("cli — caveman bundled skill", () => {
  const slashPaths: Array<[string, (sb: Sandbox) => string]> = [
    ["claude-code", (s) => join(s.projectRoot, ".claude", "commands", "sk-caveman.md")],
    ["pi", (s) => join(s.projectRoot, ".pi", "prompts", "sk-caveman.md")],
    ["opencode", (s) => join(s.projectRoot, ".opencode", "commands", "sk-caveman.md")],
    ["copilot", (s) => join(s.projectRoot, ".github", "prompts", "sk-caveman.prompt.md")],
  ];

  it("is listed among bundled skills", () => {
    const out = run(["list"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("caveman");
  });

  it("installs slash on claude-code with description and body", async () => {
    expect(
      run(
        ["install", "caveman", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const body = await readFile(slashPaths[0][1](sb), "utf8");
    expect(body).toContain("description:");
    expect(body).toContain("telegraphic");
    expect(body).toContain("/sk-caveman off");
  });

  it("installs slash on every agent", async () => {
    expect(
      run(
        ["install", "caveman", "--agent", "all", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    for (const [, path] of slashPaths) {
      expect(await exists(path(sb))).toBe(true);
    }
  });
});

describe("cli — ponytail bundled skill", () => {
  const slashPaths: Array<[string, (sb: Sandbox) => string]> = [
    ["claude-code", (s) => join(s.projectRoot, ".claude", "commands", "sk-ponytail.md")],
    ["pi", (s) => join(s.projectRoot, ".pi", "prompts", "sk-ponytail.md")],
    ["opencode", (s) => join(s.projectRoot, ".opencode", "commands", "sk-ponytail.md")],
    ["copilot", (s) => join(s.projectRoot, ".github", "prompts", "sk-ponytail.prompt.md")],
  ];

  it("is listed among bundled skills", () => {
    const out = run(["list"], sb.projectRoot, sb.env);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("ponytail");
  });

  it("installs slash on claude-code with description and body", async () => {
    expect(
      run(
        ["install", "ponytail", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    const body = await readFile(slashPaths[0][1](sb), "utf8");
    expect(body).toContain("description:");
    expect(body).toContain("reuse ladder");
    expect(body).toContain("/sk-ponytail off");
    expect(body).toContain("shortens code, not requested reports");
  });

  it("installs slash on every agent", async () => {
    expect(
      run(
        ["install", "ponytail", "--agent", "all", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    for (const [, path] of slashPaths) {
      expect(await exists(path(sb))).toBe(true);
    }
  });
});

describe("cli — uninstall fan-out", () => {
  const installsOf = async (skill: string) => {
    const statePath = join(sb.home, ".skillset", "state.json");
    if (!(await exists(statePath))) return [];
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    return (raw.installs as Array<{ skill: string; agent: string; scope: string }>).filter(
      (r) => r.skill === skill,
    );
  };
  const ccLocal = () => join(sb.projectRoot, ".claude", "commands", "sk-confidence.md");
  const ccGlobal = () => join(sb.home, ".claude", "commands", "sk-confidence.md");
  const piLocal = () => join(sb.projectRoot, ".pi", "prompts", "sk-confidence.md");

  it("bare uninstall removes installs across every agent", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code,pi", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect(await exists(ccLocal())).toBe(true);
    expect(await exists(piLocal())).toBe(true);

    expect(run(["uninstall", "confidence"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(ccLocal())).toBe(false);
    expect(await exists(piLocal())).toBe(false);
    expect(await installsOf("confidence")).toHaveLength(0);
  });

  it("bare uninstall removes installs across every scope", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect(await exists(ccLocal())).toBe(true);
    expect(await exists(ccGlobal())).toBe(true);

    expect(run(["uninstall", "confidence"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(ccLocal())).toBe(false);
    expect(await exists(ccGlobal())).toBe(false);
    expect(await installsOf("confidence")).toHaveLength(0);
  });

  it("--agent filter leaves other agents' installs untouched", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code,pi", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);

    expect(
      run(["uninstall", "confidence", "--agent", "claude-code"], sb.projectRoot, sb.env).status,
    ).toBe(0);
    expect(await exists(ccLocal())).toBe(false);
    expect(await exists(piLocal())).toBe(true);
    const left = await installsOf("confidence");
    expect(left).toHaveLength(1);
    expect(left[0].agent).toBe("pi");
  });

  it("--global filter leaves local installs untouched (and vice versa)", async () => {
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);

    expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(ccGlobal())).toBe(false);
    expect(await exists(ccLocal())).toBe(true);
    const left = await installsOf("confidence");
    expect(left).toHaveLength(1);
    expect(left[0].scope).toBe("local");

    expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(ccLocal())).toBe(false);
    expect(await installsOf("confidence")).toHaveLength(0);
  });
});
