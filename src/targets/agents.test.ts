import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileExists } from "../core/fs.js";
import { parseSkill } from "../core/parse.js";
import { copilotTarget, opencodeTarget, piTarget } from "./index.js";

const SKILL_SRC = `---
name: confidence
version: "0.1.0"
description: planning loop
slug: confidence
---
Body text.
`;

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "skillset-targets-"));
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe("pi target", () => {
  it("slash → .pi/prompts/<slug>.md", async () => {
    const rec = await piTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".pi", "prompts", "confidence.md");
    expect(await fileExists(p)).toBe(true);
    await piTarget.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("auto → .pi/skills/<name>/SKILL.md", async () => {
    const rec = await piTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const p = join(projectRoot, ".pi", "skills", "confidence", "SKILL.md");
    expect(await fileExists(p)).toBe(true);
    const body = await readFile(p, "utf8");
    expect(body).toContain("name: confidence");
    await piTarget.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → marker block in APPEND_SYSTEM.md, removed cleanly", async () => {
    const rec = await piTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const anchor = join(projectRoot, ".pi", "APPEND_SYSTEM.md");
    expect(await fileExists(anchor)).toBe(true);
    const body = await readFile(anchor, "utf8");
    expect(body).toContain("skillset:begin confidence");
    expect(body).toContain("Body text.");
    await piTarget.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });
});

describe("opencode target", () => {
  it("slash → .opencode/commands/<slug>.md", async () => {
    const rec = await opencodeTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".opencode", "commands", "confidence.md");
    expect(await fileExists(p)).toBe(true);
    await opencodeTarget.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("auto → .opencode/skills/<name>/SKILL.md", async () => {
    const rec = await opencodeTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const p = join(projectRoot, ".opencode", "skills", "confidence", "SKILL.md");
    expect(await fileExists(p)).toBe(true);
    await opencodeTarget.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → AGENTS.md marker block", async () => {
    const rec = await opencodeTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const anchor = join(projectRoot, "AGENTS.md");
    expect(await fileExists(anchor)).toBe(true);
    const body = await readFile(anchor, "utf8");
    expect(body).toContain("skillset:begin confidence");
    await opencodeTarget.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });
});

describe("copilot target", () => {
  it("slash → .github/prompts/<slug>.prompt.md with mode: agent default", async () => {
    const rec = await copilotTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".github", "prompts", "confidence.prompt.md");
    expect(await fileExists(p)).toBe(true);
    const body = await readFile(p, "utf8");
    expect(body).toContain("mode: agent");
    await copilotTarget.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → .github/copilot-instructions.md marker block", async () => {
    const rec = await copilotTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const anchor = join(projectRoot, ".github", "copilot-instructions.md");
    expect(await fileExists(anchor)).toBe(true);
    const body = await readFile(anchor, "utf8");
    expect(body).toContain("skillset:begin confidence");
    await copilotTarget.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });

  it("rejects auto", async () => {
    await expect(
      copilotTarget.install({
        skill: parseSkill(SKILL_SRC),
        scope: "local",
        mode: "auto",
        projectRoot,
      }),
    ).rejects.toThrow(/auto/);
  });

  it("preserves surrounding content in copilot-instructions.md", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const anchor = join(projectRoot, ".github", "copilot-instructions.md");
    await mkdir(dirname(anchor), { recursive: true });
    await writeFile(anchor, "# user content\n\nimportant rules\n");
    const rec = await copilotTarget.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const afterInstall = await readFile(anchor, "utf8");
    expect(afterInstall).toContain("user content");
    expect(afterInstall).toContain("important rules");
    expect(afterInstall).toContain("skillset:begin confidence");
    await copilotTarget.uninstall(rec);
    const afterUninstall = await readFile(anchor, "utf8");
    expect(afterUninstall).toContain("user content");
    expect(afterUninstall).toContain("important rules");
    expect(afterUninstall).not.toContain("skillset:begin confidence");
  });
});

// Local helper to avoid an extra import line at the top.
import { dirname } from "node:path";
