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
