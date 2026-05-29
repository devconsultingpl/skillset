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

describe("claude-code target — write-on-invoke trailer", () => {
  const STATUS = `---
name: skillset-status
version: "0.1.0"
description: show active skills
slug: skillset-status
statusReader: true
---
# skillset-status

Report active skills.
`;

  it("appends a track line + allowed-tools for a slash skill", async () => {
    await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const contents = await readFile(
      join(projectRoot, ".claude", "commands", "confidence.md"),
      "utf8",
    );
    expect(contents).toContain('allowed-tools: "Bash(skillset *)"');
    expect(contents).toContain("!`skillset track confidence $ARGUMENTS`");
    // Trailer must not embed `${…}`: Claude Code's permission gate rejects any
    // `!`-command with shell expansion (plan 0018). `skillset` reads the env
    // var in-process instead.
    expect(contents).not.toContain("${CLAUDE_CODE_SESSION_ID}");
  });

  it("the status reader prints status and never tracks itself", async () => {
    await claudeCodeTarget.install({
      skill: parseSkill(STATUS),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const contents = await readFile(
      join(projectRoot, ".claude", "commands", "skillset-status.md"),
      "utf8",
    );
    expect(contents).toContain("!`skillset status`");
    expect(contents).not.toContain("${CLAUDE_CODE_SESSION_ID}");
    expect(contents).not.toContain("skillset track");
  });

  it("does not append a trailer for auto mode", async () => {
    await claudeCodeTarget.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const contents = await readFile(
      join(projectRoot, ".claude", "skills", "confidence", "SKILL.md"),
      "utf8",
    );
    expect(contents).not.toContain("skillset track");
    expect(contents).not.toContain("allowed-tools");
  });
});

describe("claude-code target — statusLine (decision 9 no-clobber)", () => {
  const STATUS = `---
name: skillset-status
version: "0.1.0"
description: show active skills
slug: skillset-status
statusReader: true
---
# skillset-status

Report active skills.
`;
  const settingsPath = () => join(projectRoot, ".claude", "settings.json");
  const readSettings = async () => JSON.parse(await readFile(settingsPath(), "utf8"));
  const installStatus = () =>
    claudeCodeTarget.install({
      skill: parseSkill(STATUS),
      scope: "local",
      mode: "slash",
      projectRoot,
    });

  it("installs the statusLine when the slot is empty, and removes it on uninstall", async () => {
    const record = await installStatus();
    expect(record.statusLine).toBe("skillset status --stdin-json");
    expect((await readSettings()).statusLine).toEqual({
      type: "command",
      command: "skillset status --stdin-json",
    });

    await claudeCodeTarget.uninstall(record);
    // Nothing else in settings → file removed entirely.
    expect(await fileExists(settingsPath())).toBe(false);
  });

  it("wires a SessionStart clear|compact reset hook, removed on uninstall", async () => {
    const record = await installStatus();
    const entry = (await readSettings()).hooks.SessionStart.find(
      (e: { matcher: string }) => e.matcher === "clear|compact",
    );
    expect(entry).toBeDefined();
    expect(entry.hooks[0].command).toContain("skillset reset --stdin-json");

    await claudeCodeTarget.uninstall(record);
    expect(await fileExists(settingsPath())).toBe(false);
  });

  it("adds the reset hook even when the user has their own statusLine", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(
      settingsPath(),
      JSON.stringify({ statusLine: { command: "mine.sh" } }, null, 2),
    );

    await installStatus();
    const settings = await readSettings();
    expect(settings.statusLine.command).toBe("mine.sh"); // not clobbered
    expect(
      settings.hooks.SessionStart.some((e: { matcher: string }) => e.matcher === "clear|compact"),
    ).toBe(true);
  });

  it("never clobbers a user's existing statusLine, and records nothing", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    const mine = { type: "command", command: "my-statusline.sh" };
    await writeFile(settingsPath(), JSON.stringify({ statusLine: mine }, null, 2));

    const record = await installStatus();
    expect(record.statusLine).toBeUndefined();
    expect((await readSettings()).statusLine).toEqual(mine);

    // Uninstall must leave the user's statusLine alone.
    await claudeCodeTarget.uninstall(record);
    expect((await readSettings()).statusLine).toEqual(mine);
  });

  it("uninstall leaves a statusLine the user replaced after install", async () => {
    const record = await installStatus();
    // User swaps in their own afterwards.
    const { writeFile } = await import("node:fs/promises");
    const mine = { type: "command", command: "my-own.sh" };
    await writeFile(settingsPath(), JSON.stringify({ statusLine: mine }, null, 2));

    await claudeCodeTarget.uninstall(record);
    expect((await readSettings()).statusLine).toEqual(mine);
  });

  it("preserves unrelated settings keys when removing the statusLine", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(settingsPath(), JSON.stringify({ theme: "dark" }, null, 2));

    const record = await installStatus();
    await claudeCodeTarget.uninstall(record);
    expect(await readSettings()).toEqual({ theme: "dark" });
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
