import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileExists } from "../core/fs.js";
import { parseSkill } from "../core/parse.js";
import { claudeCodeTarget } from "./claude-code.js";

const SKILL = `---
name: confidence
version: "0.1.0"
description: drives planning loop
slug: confidence
---
# Confidence

Body text.
`;

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "skillset-cc-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe("claude-code target — slash", () => {
  it("writes .claude/commands/<slug>.md and removes on uninstall", async () => {
    const record = await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const cmdPath = join(projectRoot, ".claude", "commands", "confidence.md");
    expect(await fileExists(cmdPath)).toBe(true);
    const contents = await readFile(cmdPath, "utf8");
    expect(contents).toContain("description: drives planning loop");
    expect(contents).toContain("# Confidence");

    await claudeCodeTarget.uninstall(record);
    expect(await fileExists(cmdPath)).toBe(false);
  });
});

describe("claude-code target — auto", () => {
  it("writes SKILL.md under .claude/skills/<name>/ and cleans up dir on uninstall", async () => {
    const record = await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const skillPath = join(projectRoot, ".claude", "skills", "confidence", "SKILL.md");
    expect(await fileExists(skillPath)).toBe(true);
    const contents = await readFile(skillPath, "utf8");
    expect(contents).toContain("name: confidence");
    expect(contents).toContain("description: drives planning loop");

    await claudeCodeTarget.uninstall(record);
    expect(await fileExists(skillPath)).toBe(false);
    expect(await fileExists(join(projectRoot, ".claude", "skills", "confidence"))).toBe(false);
  });
});

describe("claude-code target — always", () => {
  it("writes SKILL.md and adds a SessionStart hook tagged for the skill", async () => {
    const record = await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const settingsPath = join(projectRoot, ".claude", "settings.json");
    expect(await fileExists(settingsPath)).toBe(true);
    const settings = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("# skillset:confidence");
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain("skillset emit confidence");

    await claudeCodeTarget.uninstall(record);
    expect(await fileExists(settingsPath)).toBe(false);
  });

  it("preserves unrelated SessionStart hooks on uninstall", async () => {
    // Seed an unrelated hook before installing.
    const settingsPath = join(projectRoot, ".claude", "settings.json");
    const existing = {
      hooks: {
        SessionStart: [{ matcher: "", hooks: [{ type: "command", command: "echo other" }] }],
      },
    };
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(existing, null, 2));

    const record = await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const after = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(after.hooks.SessionStart).toHaveLength(2);

    await claudeCodeTarget.uninstall(record);
    const final = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(final.hooks.SessionStart).toHaveLength(1);
    expect(final.hooks.SessionStart[0].hooks[0].command).toBe("echo other");
  });
});
