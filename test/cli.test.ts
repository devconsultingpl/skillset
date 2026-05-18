import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "..", "dist", "cli.js");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync("node", [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

let projectRoot: string;
let stateRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "skillset-cli-"));
  stateRoot = await mkdtemp(join(tmpdir(), "skillset-home-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(stateRoot, { recursive: true, force: true });
});

// Re-route HOME so state.json lands in our temp dir, not the developer's
// real ~/.skillset.
const sandbox = () => ({ HOME: stateRoot, USERPROFILE: stateRoot });

describe("cli end-to-end", () => {
  it("installs confidence into claude-code (slash) and uninstalls it", async () => {
    const install = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      projectRoot,
      sandbox(),
    );
    expect(install.status).toBe(0);
    const cmdPath = join(projectRoot, ".claude", "commands", "confidence.md");
    expect(await exists(cmdPath)).toBe(true);

    const list = run(["list"], projectRoot, sandbox());
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("confidence");
    expect(list.stdout).toContain("claude-code");

    const uninstall = run(["uninstall", "confidence", "--local"], projectRoot, sandbox());
    expect(uninstall.status).toBe(0);
    expect(await exists(cmdPath)).toBe(false);
  });

  it("init convention scaffolds docs/ idempotently", async () => {
    const first = run(["init", "convention"], projectRoot, sandbox());
    expect(first.status).toBe(0);
    expect(await exists(join(projectRoot, "docs", "goals.md"))).toBe(true);
    expect(await exists(join(projectRoot, "docs", "conventions.md"))).toBe(true);
    expect(await exists(join(projectRoot, "docs", "plans", ".gitkeep"))).toBe(true);

    // Mutate a file and re-init — must not overwrite.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(projectRoot, "docs", "goals.md"), "MY GOALS\n");
    const second = run(["init", "convention"], projectRoot, sandbox());
    expect(second.status).toBe(0);
    expect(await readFile(join(projectRoot, "docs", "goals.md"), "utf8")).toBe("MY GOALS\n");
  });

  it("emit confidence prints additionalContext JSON", async () => {
    const out = run(["emit", "confidence"], projectRoot, sandbox());
    expect(out.status).toBe(0);
    const parsed = JSON.parse(out.stdout);
    expect(typeof parsed.additionalContext).toBe("string");
    expect(parsed.additionalContext).toContain("# confidence");
  });

  it("always mode wires SessionStart hook into local settings.json", async () => {
    const install = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "always", "--local"],
      projectRoot,
      sandbox(),
    );
    expect(install.status).toBe(0);
    const settingsPath = join(projectRoot, ".claude", "settings.json");
    const settings = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("skillset emit confidence");

    const uninstall = run(["uninstall", "confidence", "--local"], projectRoot, sandbox());
    expect(uninstall.status).toBe(0);
    expect(await exists(settingsPath)).toBe(false);
  });

  it("set-mode switches an install's mode", async () => {
    run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      projectRoot,
      sandbox(),
    );
    expect(await exists(join(projectRoot, ".claude", "commands", "confidence.md"))).toBe(true);

    const swap = run(
      ["set-mode", "confidence", "always", "--agent", "claude-code", "--local"],
      projectRoot,
      sandbox(),
    );
    expect(swap.status).toBe(0);
    expect(await exists(join(projectRoot, ".claude", "commands", "confidence.md"))).toBe(false);
    expect(await exists(join(projectRoot, ".claude", "settings.json"))).toBe(true);
  });

  it("rejects auto mode for copilot with a helpful message", async () => {
    const out = run(
      ["install", "confidence", "--agent", "copilot", "--mode", "auto", "--local"],
      projectRoot,
      sandbox(),
    );
    // Install command skips unsupported modes with a warning rather than erroring.
    expect(out.status).toBe(0);
    expect(out.stderr).toContain("not supported");
  });
});
