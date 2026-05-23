import { readFile, rm, writeFile } from "node:fs/promises";
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

describe("cli — update protects local edits", () => {
  const installSlash = () =>
    run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
  const cmdPath = () => join(sb.projectRoot, ".claude", "commands", "confidence.md");

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
    const conventionPath = join(sb.projectRoot, ".claude", "commands", "convention.md");
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
    expect(out.stderr).toContain("always-mode");
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

describe("cli — caveman bundled skill", () => {
  const slashPaths: Array<[string, (sb: Sandbox) => string]> = [
    ["claude-code", (s) => join(s.projectRoot, ".claude", "commands", "caveman.md")],
    ["pi", (s) => join(s.projectRoot, ".pi", "prompts", "caveman.md")],
    ["opencode", (s) => join(s.projectRoot, ".opencode", "commands", "caveman.md")],
    ["copilot", (s) => join(s.projectRoot, ".github", "prompts", "caveman.prompt.md")],
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
    expect(body).toContain("/caveman off");
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

describe("cli — uninstall fan-out", () => {
  const installsOf = async (skill: string) => {
    const statePath = join(sb.home, ".skillset", "state.json");
    if (!(await exists(statePath))) return [];
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    return (raw.installs as Array<{ skill: string; agent: string; scope: string }>).filter(
      (r) => r.skill === skill,
    );
  };
  const ccLocal = () => join(sb.projectRoot, ".claude", "commands", "confidence.md");
  const ccGlobal = () => join(sb.home, ".claude", "commands", "confidence.md");
  const piLocal = () => join(sb.projectRoot, ".pi", "prompts", "confidence.md");

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
