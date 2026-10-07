import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Sandbox, exists, makeSandbox, repoRoot, run } from "../helpers.js";

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
      const promptPath = join(sb.projectRoot, ".pi", "prompts", "sk-confidence.md");
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
      const promptPath = join(sb.home, ".pi", "agent", "prompts", "sk-confidence.md");
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
      // Resets the active set on compaction (transcript gone) but not on
      // shutdown — reload/resume keep the bodies, so the set stays valid.
      expect(body).toContain('pi.on("session_compact"');
      expect(body).not.toContain('pi.on("session_shutdown"');

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

  describe("sibling files", () => {
    const helperSource = join(
      repoRoot,
      "src",
      "skills",
      "code-review",
      "_helpers",
      "review-range.mjs",
    );
    const skillDir = () => join(sb.home, ".pi", "agent", "skills", "code-review");
    const installed = () => join(skillDir(), "_helpers", "review-range.mjs");

    it("copies a declared sibling beside SKILL.md, records it, and removes it on uninstall", async () => {
      const out = run(
        ["install", "code-review", "--agent", "pi", "--mode", "auto", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      expect(await exists(installed())).toBe(true);
      // Copied verbatim: a sibling is never rendered or substituted.
      expect(await readFile(installed(), "utf8")).toBe(await readFile(helperSource, "utf8"));

      // Recorded per file, relative to the skill directory — that is what makes
      // the copy ours to repair rather than a foreign file to protect.
      const state = JSON.parse(await readFile(join(sb.home, ".skillset", "state.json"), "utf8"));
      const record = state.installs.find(
        (i: { skill: string; agent: string; mode: string }) =>
          i.skill === "code-review" && i.agent === "pi" && i.mode === "auto",
      );
      expect(record.files).toEqual(["SKILL.md", "_helpers/review-range.mjs"]);

      expect(run(["uninstall", "code-review", "--global"], sb.projectRoot, sb.env).status).toBe(0);
      expect(await exists(installed())).toBe(false);
      expect(await exists(skillDir())).toBe(false);
    });

    it("runs from the installed location, not from the bundle", async () => {
      run(
        ["install", "code-review", "--agent", "pi", "--mode", "auto", "--global"],
        sb.projectRoot,
        sb.env,
      );
      // The payload proof: the installed helper is executed where the harness
      // would execute it, against a real git tree, and labels the scope itself.
      const out = spawnSync("node", [installed(), "file:README.md"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect(out.status).toBe(0);
      expect(out.stdout).toContain("strategy:       tree");
      expect(out.stdout).toContain("---changed-files---");
      expect(out.stdout).toContain("README.md");
    });

    it("says so when the mode has no directory for the skill's tools", async () => {
      // `code-review` is declared for pi in slash mode, which writes one prompt
      // file into a shared directory. A declared helper cannot travel there, and
      // the gap is reported rather than left silent.
      const out = run(
        ["install", "code-review", "--agent", "pi", "--global"],
        sb.projectRoot,
        sb.env,
      );
      expect(out.status).toBe(0);
      expect(out.stderr).toContain("sibling file(s), which install only beside SKILL.md");
      expect(await exists(join(sb.home, ".pi", "agent", "prompts", "sk-code-review.md"))).toBe(
        true,
      );
      expect(await exists(join(sb.home, ".pi", "agent", "prompts", "_helpers"))).toBe(false);
    });
  });
});
