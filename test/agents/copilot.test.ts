import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "../helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-copilot");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("copilot target", () => {
  it("rejects auto mode with a helpful message", () => {
    const out = run(
      ["install", "confidence", "--agent", "copilot", "--mode", "auto", "--local"],
      sb.projectRoot,
      sb.env,
    );
    // Install command skips unsupported modes with a warning rather than erroring.
    expect(out.status).toBe(0);
    expect(out.stderr).toContain("not supported");
  });

  describe("slash mode", () => {
    it("local: writes .github/prompts/<slug>.prompt.md with mode:agent frontmatter", async () => {
      const out = run(
        ["install", "confidence", "--agent", "copilot", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const promptPath = join(sb.projectRoot, ".github", "prompts", "confidence.prompt.md");
      expect(await exists(promptPath)).toBe(true);

      const body = await readFile(promptPath, "utf8");
      expect(body).toMatch(/^---\n/);
      expect(body).toMatch(/^mode: agent$/m);
      expect(body).toMatch(/^description:/m);
      expect(body).not.toMatch(/^name:/m);
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(promptPath)).toBe(false);
    });

    it("global: writes under ~/.skillset/copilot/prompts/", async () => {
      const out = run(
        ["install", "confidence", "--agent", "copilot", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const promptPath = join(sb.home, ".skillset", "copilot", "prompts", "confidence.prompt.md");
      expect(await exists(promptPath)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(promptPath)).toBe(false);
    });
  });

  describe("skillset-status CLI surface (global only)", () => {
    const hookPath = (sb: Sandbox) => join(sb.home, ".copilot", "hooks", "skillset.json");
    const settingsPath = (sb: Sandbox) => join(sb.home, ".copilot", "settings.json");

    it("global: writes the userPromptSubmitted hook + statusLine, and uninstall removes both", async () => {
      expect(
        run(
          ["install", "skillset-status", "--agent", "copilot", "--mode", "slash", "--global"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(await exists(hookPath(sb))).toBe(true);
      const hookJson = JSON.parse(await readFile(hookPath(sb), "utf8"));
      expect(hookJson.hooks.userPromptSubmitted[0].command).toBe("skillset scan-prompt");
      // Resets the active set before compaction.
      expect(hookJson.hooks.preCompact[0].command).toBe("skillset reset --stdin-json");
      expect(JSON.parse(await readFile(settingsPath(sb), "utf8")).statusLine.command).toBe(
        "skillset status --stdin-json",
      );

      expect(run(["uninstall", "skillset-status", "--global"], sb.projectRoot, sb.env).status).toBe(
        0,
      );
      expect(await exists(hookPath(sb))).toBe(false);
      // settings.json held only our statusLine → removed.
      expect(await exists(settingsPath(sb))).toBe(false);
    });

    it("local: does NOT touch ~/.copilot (CLI config is user-global)", async () => {
      expect(
        run(
          ["install", "skillset-status", "--agent", "copilot", "--mode", "slash", "--local"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(await exists(hookPath(sb))).toBe(false);
      expect(await exists(settingsPath(sb))).toBe(false);
    });

    it("global: never clobbers a user's existing Copilot statusLine", async () => {
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(join(sb.home, ".copilot"), { recursive: true });
      const mine = { statusLine: { type: "command", command: "my-line.sh" } };
      await writeFile(settingsPath(sb), JSON.stringify(mine, null, 2));

      expect(
        run(
          ["install", "skillset-status", "--agent", "copilot", "--mode", "slash", "--global"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      expect(JSON.parse(await readFile(settingsPath(sb), "utf8")).statusLine.command).toBe(
        "my-line.sh",
      );

      // Uninstall leaves the user's statusLine intact.
      run(["uninstall", "skillset-status", "--global"], sb.projectRoot, sb.env);
      expect(JSON.parse(await readFile(settingsPath(sb), "utf8")).statusLine.command).toBe(
        "my-line.sh",
      );
    });
  });

  describe("always mode", () => {
    it("local: writes marker block to .github/copilot-instructions.md", async () => {
      const out = run(
        ["install", "confidence", "--agent", "copilot", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.projectRoot, ".github", "copilot-instructions.md");
      expect(await exists(anchor)).toBe(true);
      const body = await readFile(anchor, "utf8");
      expect(body).toContain("<!-- skillset:begin confidence -->");
      expect(body).toContain("<!-- skillset:end confidence -->");
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });

    it("global: writes to ~/.skillset/copilot/copilot-instructions.md", async () => {
      const out = run(
        ["install", "confidence", "--agent", "copilot", "--mode", "always", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.home, ".skillset", "copilot", "copilot-instructions.md");
      expect(await exists(anchor)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });
  });
});
