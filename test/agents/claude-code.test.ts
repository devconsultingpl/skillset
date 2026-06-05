import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "../helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-cc");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("claude-code", () => {
  it("installs confidence (slash, local) and uninstalls it", async () => {
    const install = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
    expect(install.status).toBe(0);
    const cmdPath = join(sb.projectRoot, ".claude", "commands", "sk-confidence.md");
    expect(await exists(cmdPath)).toBe(true);

    const list = run(["list"], sb.projectRoot, sb.env);
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("confidence");
    expect(list.stdout).toContain("claude-code");

    const uninstall = run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env);
    expect(uninstall.status).toBe(0);
    expect(await exists(cmdPath)).toBe(false);
  });

  it("wires SessionStart hook into local settings.json on always mode", async () => {
    const install = run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "always", "--local"],
      sb.projectRoot,
      sb.env,
    );
    expect(install.status).toBe(0);
    const settingsPath = join(sb.projectRoot, ".claude", "settings.json");
    const settings = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("skillset emit confidence");

    const uninstall = run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env);
    expect(uninstall.status).toBe(0);
    expect(await exists(settingsPath)).toBe(false);
  });

  it("set-mode swaps slash → always", async () => {
    run(
      ["install", "confidence", "--agent", "claude-code", "--mode", "slash", "--local"],
      sb.projectRoot,
      sb.env,
    );
    expect(await exists(join(sb.projectRoot, ".claude", "commands", "sk-confidence.md"))).toBe(
      true,
    );

    const swap = run(
      ["set-mode", "confidence", "always", "--agent", "claude-code", "--local"],
      sb.projectRoot,
      sb.env,
    );
    expect(swap.status).toBe(0);
    expect(await exists(join(sb.projectRoot, ".claude", "commands", "sk-confidence.md"))).toBe(
      false,
    );
    expect(await exists(join(sb.projectRoot, ".claude", "settings.json"))).toBe(true);
  });
});
