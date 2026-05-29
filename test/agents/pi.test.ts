import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "../helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-pi");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("pi target", () => {
  describe("slash mode", () => {
    it("local: writes a prompt file and uninstall removes it", async () => {
      const out = run(
        ["install", "confidence", "--agent", "pi", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const promptPath = join(sb.projectRoot, ".pi", "prompts", "confidence.md");
      expect(await exists(promptPath)).toBe(true);

      const body = await readFile(promptPath, "utf8");
      // Prompt frontmatter exposes description, never the bare `name`.
      expect(body).toMatch(/^---\n/);
      expect(body).toMatch(/^description:/m);
      expect(body).not.toMatch(/^name:/m);
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(promptPath)).toBe(false);
    });

    it("global: writes under ~/.pi/agent/prompts/", async () => {
      const out = run(
        ["install", "confidence", "--agent", "pi", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const promptPath = join(sb.home, ".pi", "agent", "prompts", "confidence.md");
      expect(await exists(promptPath)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(promptPath)).toBe(false);
    });
  });

  describe("skillset-status extension", () => {
    it("installs the tracking extension alongside the status prompt and removes it on uninstall", async () => {
      expect(
        run(
          ["install", "skillset-status", "--agent", "pi", "--mode", "slash", "--local"],
          sb.projectRoot,
          sb.env,
        ).status,
      ).toBe(0);
      const ext = join(sb.projectRoot, ".pi", "extensions", "skillset.ts");
      expect(await exists(ext)).toBe(true);
      const body = await readFile(ext, "utf8");
      expect(body).toContain('pi.on("input"');
      expect(body).toContain("setStatus");
      // Resets the active set on compaction and session end.
      expect(body).toContain('pi.on("session_compact"');
      expect(body).toContain('pi.on("session_shutdown"');

      expect(run(["uninstall", "skillset-status", "--local"], sb.projectRoot, sb.env).status).toBe(
        0,
      );
      expect(await exists(ext)).toBe(false);
    });
  });

  describe("auto mode", () => {
    it("local: writes SKILL.md and uninstall removes the skill dir", async () => {
      const out = run(
        ["install", "confidence", "--agent", "pi", "--mode", "auto", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const skillPath = join(sb.projectRoot, ".pi", "skills", "confidence", "SKILL.md");
      expect(await exists(skillPath)).toBe(true);

      const body = await readFile(skillPath, "utf8");
      expect(body).toMatch(/^name: confidence/m);
      expect(body).toMatch(/^description:/m);

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(skillPath)).toBe(false);
      expect(await exists(join(sb.projectRoot, ".pi", "skills", "confidence"))).toBe(false);
    });
  });

  describe("always mode", () => {
    it("local: writes a marker block to APPEND_SYSTEM.md; uninstall removes the file when empty", async () => {
      const out = run(
        ["install", "confidence", "--agent", "pi", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.projectRoot, ".pi", "APPEND_SYSTEM.md");
      const body = await readFile(anchor, "utf8");
      expect(body).toContain("<!-- skillset:begin confidence -->");
      expect(body).toContain("<!-- skillset:end confidence -->");
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });

    it("global: writes to $HOME/.pi/agent/APPEND_SYSTEM.md", async () => {
      const out = run(
        ["install", "confidence", "--agent", "pi", "--mode", "always", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.home, ".pi", "agent", "APPEND_SYSTEM.md");
      expect(await exists(anchor)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });
  });
});
