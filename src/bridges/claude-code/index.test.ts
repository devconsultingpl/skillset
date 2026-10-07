import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileExists } from "../../core/fs.js";
import { parseSkill } from "../../core/parse.js";
import { claudeCodeBridge } from "./index.js";

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
    const record = await claudeCodeBridge.install({
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

    await claudeCodeBridge.uninstall(record);
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
    await claudeCodeBridge.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const contents = await readFile(
      join(projectRoot, ".claude", "commands", "confidence.md"),
      "utf8",
    );
    // Byte-stable undeclared case (0023 (b), AC-1): the target's own pattern is
    // the whole value, exactly as it was before the merge rule. Anchored on the
    // newline so a merged value (`… Bash(skillset *) Bash(git *)`) cannot pass.
    expect(contents).toContain('allowed-tools: "Bash(skillset *)"\n');
    expect(contents).toContain("!`skillset track confidence`");
    // Trailer must not embed `${…}`: Claude Code's permission gate rejects any
    // `!`-command with shell expansion (plan 0018). `skillset` reads the env
    // var in-process instead.
    expect(contents).not.toContain("${CLAUDE_CODE_SESSION_ID}");
    // Trailer must not forward `$ARGUMENTS`: Claude Code substitutes it as raw
    // text into the backticked command, so a backtick or newline in slash args
    // closes the outer backticks and breaks the permission-gate parser.
    expect(contents).not.toContain("$ARGUMENTS");
  });

  it("the status reader prints status and never tracks itself", async () => {
    await claudeCodeBridge.install({
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
    await claudeCodeBridge.install({
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

describe("claude-code target — a skill's own allowed-tools (0023 (b))", () => {
  // The target pre-approves the `!`skillset track` trailer it appends, and the
  // trailer is what the pattern is for. A skill declaring its own set must not
  // be able to delete it: the field is one value with two owners, and before
  // the merge rule the skill's spread won outright (`claude-code.ts:66`).
  const withTools = (value: string) => `---
name: confidence
version: "0.1.0"
description: drives planning loop
slug: confidence
targets:
  claude-code:
    allowed-tools: ${value}
---
# Confidence

Body text.
`;

  const allowedToolsLine = async (skill: ReturnType<typeof parseSkill>) => {
    await claudeCodeBridge.install({ skill, scope: "local", mode: "slash", projectRoot });
    const contents = await readFile(
      join(projectRoot, ".claude", "commands", "confidence.md"),
      "utf8",
    );
    // The trailer still travels: it is appended whatever the frontmatter says.
    expect(contents).toContain("!`skillset track confidence`");
    return contents.split("\n").find((line) => line.startsWith("allowed-tools: "));
  };

  it("keeps the target's pattern alongside a declared string", async () => {
    expect(await allowedToolsLine(parseSkill(withTools('"Bash(git *) Bash(date *)"')))).toBe(
      'allowed-tools: "Bash(skillset *) Bash(git *) Bash(date *)"',
    );
  });

  it("keeps the target's pattern alongside a declared array, as an element", async () => {
    expect(await allowedToolsLine(parseSkill(withTools('["Bash(git *)", "Read"]')))).toBe(
      'allowed-tools: ["Bash(skillset *)", "Bash(git *)", Read]',
    );
  });

  it("does not duplicate a pattern the declaration already names", async () => {
    expect(await allowedToolsLine(parseSkill(withTools('"Bash(git *) Bash(skillset *)"')))).toBe(
      'allowed-tools: "Bash(git *) Bash(skillset *)"',
    );
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
    claudeCodeBridge.install({
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

    await claudeCodeBridge.uninstall(record);
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

    await claudeCodeBridge.uninstall(record);
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
    await claudeCodeBridge.uninstall(record);
    expect((await readSettings()).statusLine).toEqual(mine);
  });

  it("uninstall leaves a statusLine the user replaced after install", async () => {
    const record = await installStatus();
    // User swaps in their own afterwards.
    const { writeFile } = await import("node:fs/promises");
    const mine = { type: "command", command: "my-own.sh" };
    await writeFile(settingsPath(), JSON.stringify({ statusLine: mine }, null, 2));

    await claudeCodeBridge.uninstall(record);
    expect((await readSettings()).statusLine).toEqual(mine);
  });

  it("preserves unrelated settings keys when removing the statusLine", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(settingsPath(), JSON.stringify({ theme: "dark" }, null, 2));

    const record = await installStatus();
    await claudeCodeBridge.uninstall(record);
    expect(await readSettings()).toEqual({ theme: "dark" });
  });
});

describe("claude-code target — auto", () => {
  it("writes SKILL.md under .claude/skills/<name>/ and cleans up dir on uninstall", async () => {
    const record = await claudeCodeBridge.install({
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

    await claudeCodeBridge.uninstall(record);
    expect(await fileExists(skillPath)).toBe(false);
    expect(await fileExists(join(projectRoot, ".claude", "skills", "confidence"))).toBe(false);
  });
});

describe("claude-code target — always", () => {
  it("writes SKILL.md and adds a SessionStart hook tagged for the skill", async () => {
    const record = await claudeCodeBridge.install({
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

    await claudeCodeBridge.uninstall(record);
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

    const record = await claudeCodeBridge.install({
      skill: parseSkill(SKILL),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const after = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(after.hooks.SessionStart).toHaveLength(2);

    await claudeCodeBridge.uninstall(record);
    const final = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(final.hooks.SessionStart).toHaveLength(1);
    expect(final.hooks.SessionStart[0].hooks[0].command).toBe("echo other");
  });
});

describe("claude-code bridge — session identity", () => {
  it("reads its own environment variable, and only its own", () => {
    const bridge = claudeCodeBridge;
    const previous = process.env.CLAUDE_CODE_SESSION_ID;
    try {
      process.env.CLAUDE_CODE_SESSION_ID = "sess-123";
      expect(bridge.sessionKeyFromEnv?.()).toBe("sess-123");
      process.env.CLAUDE_CODE_SESSION_ID = "   ";
      expect(bridge.sessionKeyFromEnv?.()).toBeUndefined();
    } finally {
      if (previous === undefined) {
        // The variable must be *absent*, not the string "undefined", for the CLI
        // tests that spawn children.
        // biome-ignore lint/performance/noDelete: absence is what the child needs
        delete process.env.CLAUDE_CODE_SESSION_ID;
      } else {
        process.env.CLAUDE_CODE_SESSION_ID = previous;
      }
    }
  });
});
