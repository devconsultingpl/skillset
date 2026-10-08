import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listBundledSkills, loadBundledSkill } from "../core/bundle.js";
import { loadDeclarations } from "../core/declarations.js";
import { fileExists } from "../core/fs.js";
import { parseSkill } from "../core/parse.js";
import {
  AGENT_BRIDGE_NAMES,
  claudeCodeBridge,
  copilotBridge,
  opencodeBridge,
  piBridge,
} from "./index.js";

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
    const rec = await piBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".pi", "prompts", "confidence.md");
    expect(await fileExists(p)).toBe(true);
    await piBridge.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("auto → .pi/skills/<name>/SKILL.md", async () => {
    const rec = await piBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const p = join(projectRoot, ".pi", "skills", "confidence", "SKILL.md");
    expect(await fileExists(p)).toBe(true);
    const body = await readFile(p, "utf8");
    expect(body).toContain("name: confidence");
    await piBridge.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → marker block in APPEND_SYSTEM.md, removed cleanly", async () => {
    const rec = await piBridge.install({
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
    await piBridge.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });
});

describe("opencode target", () => {
  it("slash → .opencode/commands/<slug>.md", async () => {
    const rec = await opencodeBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".opencode", "commands", "confidence.md");
    expect(await fileExists(p)).toBe(true);
    await opencodeBridge.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("auto → .opencode/skills/<name>/SKILL.md", async () => {
    const rec = await opencodeBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "auto",
      projectRoot,
    });
    const p = join(projectRoot, ".opencode", "skills", "confidence", "SKILL.md");
    expect(await fileExists(p)).toBe(true);
    await opencodeBridge.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → AGENTS.md marker block", async () => {
    const rec = await opencodeBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const anchor = join(projectRoot, "AGENTS.md");
    expect(await fileExists(anchor)).toBe(true);
    const body = await readFile(anchor, "utf8");
    expect(body).toContain("skillset:begin confidence");
    await opencodeBridge.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });
});

describe("copilot target", () => {
  it("slash → .github/prompts/<slug>.prompt.md with mode: agent default", async () => {
    const rec = await copilotBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "slash",
      projectRoot,
    });
    const p = join(projectRoot, ".github", "prompts", "confidence.prompt.md");
    expect(await fileExists(p)).toBe(true);
    const body = await readFile(p, "utf8");
    expect(body).toContain("mode: agent");
    await copilotBridge.uninstall(rec);
    expect(await fileExists(p)).toBe(false);
  });

  it("always → .github/copilot-instructions.md marker block", async () => {
    const rec = await copilotBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const anchor = join(projectRoot, ".github", "copilot-instructions.md");
    expect(await fileExists(anchor)).toBe(true);
    const body = await readFile(anchor, "utf8");
    expect(body).toContain("skillset:begin confidence");
    await copilotBridge.uninstall(rec);
    expect(await fileExists(anchor)).toBe(false);
  });

  it("rejects auto", async () => {
    await expect(
      copilotBridge.install({
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
    const rec = await copilotBridge.install({
      skill: parseSkill(SKILL_SRC),
      scope: "local",
      mode: "always",
      projectRoot,
    });
    const afterInstall = await readFile(anchor, "utf8");
    expect(afterInstall).toContain("user content");
    expect(afterInstall).toContain("important rules");
    expect(afterInstall).toContain("skillset:begin confidence");
    await copilotBridge.uninstall(rec);
    const afterUninstall = await readFile(anchor, "utf8");
    expect(afterUninstall).toContain("user content");
    expect(afterUninstall).toContain("important rules");
    expect(afterUninstall).not.toContain("skillset:begin confidence");
  });
});

// Local helper to avoid an extra import line at the top.
import { dirname } from "node:path";

/**
 * The capability matrix (0023 slice 2c): each target declares, in one place,
 * which harness frontmatter it can carry per mode and which native commands it
 * must not shadow. These tests are what keep the declarations honest data — a
 * mode without a declared set, a slug that no longer carries the `sk-` prefix,
 * or one that shadows a harness built-in all fail here.
 */
describe("frontmatter capability matrix", () => {
  const targets = [claudeCodeBridge, piBridge, opencodeBridge, copilotBridge];

  it("declares a field set for every mode the target supports", () => {
    for (const target of targets) {
      for (const mode of target.supportedModes) {
        expect(target.frontmatter.expresses[mode], `${target.name} ${mode}`).toBeDefined();
      }
    }
  });

  it("declares the context anchor for pi alone, at the paths pi actually loads", () => {
    const declaring = targets.filter((target) => target.supportedModes.includes("context"));
    expect(declaring.map((target) => target.name)).toEqual(["pi"]);

    const artifact = { mode: "context" as const, slug: "sk-probe", name: "probe" };
    expect(piBridge.artifactPath({ ...artifact, scope: "local", projectRoot: "/proj" })).toBe(
      "/proj/AGENTS.md",
    );
    expect(piBridge.artifactPath({ ...artifact, scope: "global", projectRoot: "/proj" })).toBe(
      join(homedir(), ".pi", "agent", "AGENTS.md"),
    );
    for (const target of targets.filter((t) => t.name !== "pi")) {
      expect(() =>
        target.artifactPath({ ...artifact, scope: "global", projectRoot: "/proj" }),
      ).toThrow();
    }
  });

  it("declares an agent vocabulary only where the bridge can install agents", () => {
    const withAgents = targets.filter((target) => target.agents !== undefined);
    expect(withAgents.map((t) => t.name)).toEqual([...AGENT_BRIDGE_NAMES]);
    for (const target of withAgents) {
      expect(target.agents?.expresses.length, `${target.name} agent fields`).toBeGreaterThan(0);
    }
  });

  it("installs no agent whose name shadows a native command", async () => {
    // The same invariant the `sk-` slug rule gives skills, checked here for the
    // agent kind rather than enforced at runtime (slice-3a decision 6): an agent
    // file is addressed by its name, so a name that collides with a harness
    // built-in would make the built-in unreachable.
    const { declarations } = await loadDeclarations();
    const agentDeclarations = declarations.filter((d) => d.kind === "agent");
    const agentNames = [...new Set(agentDeclarations.map((d) => d.skill))];
    expect(agentNames.length).toBe(15);
    for (const declaration of agentDeclarations) {
      expect(AGENT_BRIDGE_NAMES, `${declaration.skill} on ${declaration.agent}`).toContain(
        declaration.agent,
      );
    }
    for (const target of targets) {
      for (const native of target.frontmatter.native ?? []) {
        expect(
          agentNames,
          `${target.name} agent named after the built-in /${native}`,
        ).not.toContain(native);
      }
    }
  });

  it("ships only sk- slugs, and none that shadows a native command", async () => {
    const { declarations, problems } = await loadDeclarations();
    expect(problems).toEqual([]);

    const slugs = new Map<string, string>();
    for (const skill of await listBundledSkills()) {
      const { frontmatter } = await loadBundledSkill(skill);
      expect(frontmatter.slug, `${skill} must declare an sk- slug`).toMatch(/^sk-/);
      slugs.set(skill, frontmatter.slug ?? skill);
    }

    for (const target of targets) {
      for (const native of target.frontmatter.native ?? []) {
        for (const declaration of declarations.filter((d) => d.agent === target.name)) {
          expect(
            slugs.get(declaration.skill),
            `${declaration.skill} → ${target.name} would shadow the built-in /${native}`,
          ).not.toBe(native);
        }
      }
    }
  });
});
