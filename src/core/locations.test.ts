import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath, layoutFor, stateFilePath } from "./locations.js";

describe("layouts: slash", () => {
  it("claude-code global → ~/.claude/commands/<slug>.md", () => {
    expect(layoutFor("claude-code").slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".claude", "commands", "confidence.md"),
    );
  });
  it("pi global → ~/.pi/agent/prompts/<slug>.md", () => {
    expect(layoutFor("pi").slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".pi", "agent", "prompts", "confidence.md"),
    );
  });
  it("opencode global → ~/.config/opencode/commands/<slug>.md", () => {
    expect(layoutFor("opencode").slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".config", "opencode", "commands", "confidence.md"),
    );
  });
  it("copilot local → .github/prompts/<slug>.prompt.md", () => {
    expect(layoutFor("copilot").slash("confidence", "local", "/p")).toBe(
      join("/p", ".github", "prompts", "confidence.prompt.md"),
    );
  });
});

describe("layouts: auto", () => {
  it("claude-code → skills/<name>/SKILL.md", () => {
    expect(layoutFor("claude-code").auto?.("confidence", "local", "/p")).toBe(
      join("/p", ".claude", "skills", "confidence", "SKILL.md"),
    );
  });
  it("pi global → ~/.pi/agent/skills/<name>/SKILL.md", () => {
    expect(layoutFor("pi").auto?.("confidence", "global", "/p")).toBe(
      join(homedir(), ".pi", "agent", "skills", "confidence", "SKILL.md"),
    );
  });
  it("opencode local → .opencode/skills/<name>/SKILL.md", () => {
    expect(layoutFor("opencode").auto?.("confidence", "local", "/p")).toBe(
      join("/p", ".opencode", "skills", "confidence", "SKILL.md"),
    );
  });
  it("copilot has no auto", () => {
    expect(layoutFor("copilot").auto).toBeUndefined();
  });
});

describe("layouts: always anchors", () => {
  it("claude-code local → .claude/settings.json", () => {
    expect(layoutFor("claude-code").always("local", "/p")).toBe(
      join("/p", ".claude", "settings.json"),
    );
  });
  it("pi local → .pi/APPEND_SYSTEM.md", () => {
    expect(layoutFor("pi").always("local", "/p")).toBe(join("/p", ".pi", "APPEND_SYSTEM.md"));
  });
  it("opencode local → AGENTS.md at project root", () => {
    expect(layoutFor("opencode").always("local", "/p")).toBe(join("/p", "AGENTS.md"));
  });
  it("copilot local → .github/copilot-instructions.md", () => {
    expect(layoutFor("copilot").always("local", "/p")).toBe(
      join("/p", ".github", "copilot-instructions.md"),
    );
  });
});

describe("artifactPath", () => {
  it("rejects auto for copilot", () => {
    expect(() =>
      artifactPath({
        agent: "copilot",
        mode: "auto",
        scope: "local",
        slug: "c",
        name: "c",
        projectRoot: "/p",
      }),
    ).toThrow(/auto/);
  });
});

describe("stateFilePath", () => {
  it("lives under ~/.skillset", () => {
    expect(stateFilePath()).toBe(join(homedir(), ".skillset", "state.json"));
  });
});
