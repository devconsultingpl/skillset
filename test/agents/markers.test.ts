import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "../helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-markers");
});

afterEach(async () => {
  await sb.cleanup();
});

async function seed(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

const USER_BLOCK = "# user notes\n\nthis came before skillset and must survive.\n";

interface MarkdownCase {
  agent: string;
  anchor: (sb: Sandbox) => string;
}

const markdownCases: MarkdownCase[] = [
  { agent: "pi", anchor: (s) => join(s.projectRoot, ".pi", "APPEND_SYSTEM.md") },
  { agent: "opencode", anchor: (s) => join(s.projectRoot, "AGENTS.md") },
  {
    agent: "copilot",
    anchor: (s) => join(s.projectRoot, ".github", "copilot-instructions.md"),
  },
];

describe("marker safety — markdown anchors", () => {
  for (const tc of markdownCases) {
    describe(tc.agent, () => {
      it("preserves user content through install/uninstall lifecycle of two skills", async () => {
        const anchor = tc.anchor(sb);
        await seed(anchor, USER_BLOCK);

        // Install confidence + convention as always-mode. User block must survive both.
        expect(
          run(
            ["install", "confidence", "--agent", tc.agent, "--mode", "always", "--local"],
            sb.projectRoot,
            sb.env,
          ).status,
        ).toBe(0);
        expect(
          run(
            ["install", "convention", "--agent", tc.agent, "--mode", "always", "--local"],
            sb.projectRoot,
            sb.env,
          ).status,
        ).toBe(0);

        let body = await readFile(anchor, "utf8");
        expect(body).toContain(USER_BLOCK.trim());
        expect(body).toContain("<!-- skillset:begin confidence -->");
        expect(body).toContain("<!-- skillset:end confidence -->");
        expect(body).toContain("<!-- skillset:begin convention -->");
        expect(body).toContain("<!-- skillset:end convention -->");

        // Uninstall confidence. User block + convention block remain.
        expect(
          run(["uninstall", "confidence", "--agent", tc.agent, "--local"], sb.projectRoot, sb.env)
            .status,
        ).toBe(0);
        body = await readFile(anchor, "utf8");
        expect(body).toContain(USER_BLOCK.trim());
        expect(body).not.toContain("<!-- skillset:begin confidence -->");
        expect(body).toContain("<!-- skillset:begin convention -->");

        // Uninstall convention. Anchor returns to user-only content (file kept).
        expect(
          run(["uninstall", "convention", "--agent", tc.agent, "--local"], sb.projectRoot, sb.env)
            .status,
        ).toBe(0);
        expect(await exists(anchor)).toBe(true);
        body = await readFile(anchor, "utf8");
        expect(body).toContain(USER_BLOCK.trim());
        expect(body).not.toContain("<!-- skillset:begin");
      });
    });
  }
});

describe("marker safety — claude-code settings.json", () => {
  it("preserves user-defined hooks and other top-level keys through install/uninstall", async () => {
    const settingsPath = join(sb.projectRoot, ".claude", "settings.json");
    const userSettings = {
      model: "claude-opus-4-7",
      hooks: {
        SessionStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "echo user-own-hook",
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [{ type: "command", command: "echo user-prompt-hook" }],
          },
        ],
      },
    };
    await seed(settingsPath, `${JSON.stringify(userSettings, null, 2)}\n`);

    // Install confidence in always — adds our SessionStart hook alongside theirs.
    expect(
      run(
        ["install", "confidence", "--agent", "claude-code", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);

    let parsed = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(parsed.model).toBe("claude-opus-4-7");
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe("echo user-own-hook");
    expect(parsed.hooks.SessionStart[1].hooks[0].command).toContain("skillset emit confidence");
    expect(parsed.hooks.UserPromptSubmit).toHaveLength(1);

    // Install convention as a second always-mode skill — three SessionStart hooks now.
    expect(
      run(
        ["install", "convention", "--agent", "claude-code", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      ).status,
    ).toBe(0);
    parsed = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(parsed.hooks.SessionStart).toHaveLength(3);

    // Uninstall confidence — user hook + convention hook remain.
    expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
    parsed = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    const commands = parsed.hooks.SessionStart.map(
      (e: { hooks: Array<{ command: string }> }) => e.hooks[0].command,
    );
    expect(commands).toContain("echo user-own-hook");
    expect(commands.some((c: string) => c.includes("convention"))).toBe(true);
    expect(commands.some((c: string) => c.includes("confidence"))).toBe(false);

    // Uninstall convention — file remains because user hooks are still present.
    expect(run(["uninstall", "convention", "--local"], sb.projectRoot, sb.env).status).toBe(0);
    expect(await exists(settingsPath)).toBe(true);
    parsed = JSON.parse(await readFile(settingsPath, "utf8"));
    expect(parsed.model).toBe("claude-opus-4-7");
    expect(parsed.hooks.SessionStart).toHaveLength(1);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe("echo user-own-hook");
    expect(parsed.hooks.UserPromptSubmit).toHaveLength(1);
  });
});
