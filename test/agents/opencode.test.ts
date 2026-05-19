import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, run } from "../helpers.js";

let sb: Sandbox;

beforeEach(async () => {
  sb = await makeSandbox("skillset-opencode");
});

afterEach(async () => {
  await sb.cleanup();
});

describe("opencode target", () => {
  describe("slash mode", () => {
    it("local: writes a command file and uninstall removes it", async () => {
      const out = run(
        ["install", "confidence", "--agent", "opencode", "--mode", "slash", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const cmdPath = join(sb.projectRoot, ".opencode", "commands", "confidence.md");
      expect(await exists(cmdPath)).toBe(true);

      const body = await readFile(cmdPath, "utf8");
      expect(body).toMatch(/^---\n/);
      expect(body).toMatch(/^description:/m);
      expect(body).not.toMatch(/^name:/m);
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(cmdPath)).toBe(false);
    });

    it("global: writes under ~/.config/opencode/commands/", async () => {
      const out = run(
        ["install", "confidence", "--agent", "opencode", "--mode", "slash", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const cmdPath = join(sb.home, ".config", "opencode", "commands", "confidence.md");
      expect(await exists(cmdPath)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(cmdPath)).toBe(false);
    });
  });

  describe("auto mode", () => {
    it("local: writes SKILL.md and uninstall removes the skill dir", async () => {
      const out = run(
        ["install", "confidence", "--agent", "opencode", "--mode", "auto", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const skillPath = join(sb.projectRoot, ".opencode", "skills", "confidence", "SKILL.md");
      expect(await exists(skillPath)).toBe(true);

      const body = await readFile(skillPath, "utf8");
      expect(body).toMatch(/^name: confidence/m);
      expect(body).toMatch(/^description:/m);

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(skillPath)).toBe(false);
      expect(await exists(join(sb.projectRoot, ".opencode", "skills", "confidence"))).toBe(false);
    });
  });

  describe("always mode", () => {
    it("local: writes marker block to <root>/AGENTS.md (project root, not under .opencode/)", async () => {
      const out = run(
        ["install", "confidence", "--agent", "opencode", "--mode", "always", "--local"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.projectRoot, "AGENTS.md");
      expect(await exists(anchor)).toBe(true);
      const body = await readFile(anchor, "utf8");
      expect(body).toContain("<!-- skillset:begin confidence -->");
      expect(body).toContain("<!-- skillset:end confidence -->");
      expect(body).toContain("# confidence");

      expect(run(["uninstall", "confidence", "--local"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });

    it("global: writes to $HOME/.config/opencode/AGENTS.md", async () => {
      const out = run(
        ["install", "confidence", "--agent", "opencode", "--mode", "always", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      const anchor = join(sb.home, ".config", "opencode", "AGENTS.md");
      expect(await exists(anchor)).toBe(true);

      expect(run(["uninstall", "confidence", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(anchor)).toBe(false);
    });
  });
});
