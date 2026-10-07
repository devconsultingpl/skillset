import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as claudeCode from "./claude-code/paths.js";
import * as copilot from "./copilot/paths.js";
import * as opencode from "./opencode/paths.js";
import * as pi from "./pi/paths.js";

/**
 * Path assertions live beside the bridge that owns them (slice 2e): a harness's
 * locations are its business, and the core has no opinion to test.
 */
const at = {
  "claude-code": claudeCode,
  pi,
  opencode,
  copilot,
} as const;

describe("each bridge's slash path", () => {
  it("claude-code global → ~/.claude/commands/<slug>.md", () => {
    expect(at["claude-code"].layout.slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".claude", "commands", "confidence.md"),
    );
  });
  it("pi global → ~/.pi/agent/prompts/<slug>.md", () => {
    expect(at.pi.layout.slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".pi", "agent", "prompts", "confidence.md"),
    );
  });
  it("opencode global → ~/.config/opencode/commands/<slug>.md", () => {
    expect(at.opencode.layout.slash("confidence", "global", "/p")).toBe(
      join(homedir(), ".config", "opencode", "commands", "confidence.md"),
    );
  });
  it("copilot local → .github/prompts/<slug>.prompt.md", () => {
    expect(at.copilot.layout.slash("confidence", "local", "/p")).toBe(
      join("/p", ".github", "prompts", "confidence.prompt.md"),
    );
  });
});

describe("each bridge's auto path", () => {
  it("claude-code → skills/<name>/SKILL.md", () => {
    expect(at["claude-code"].layout.auto?.("confidence", "local", "/p")).toBe(
      join("/p", ".claude", "skills", "confidence", "SKILL.md"),
    );
  });
  it("pi global → ~/.pi/agent/skills/<name>/SKILL.md", () => {
    expect(at.pi.layout.auto?.("confidence", "global", "/p")).toBe(
      join(homedir(), ".pi", "agent", "skills", "confidence", "SKILL.md"),
    );
  });
  it("opencode local → .opencode/skills/<name>/SKILL.md", () => {
    expect(at.opencode.layout.auto?.("confidence", "local", "/p")).toBe(
      join("/p", ".opencode", "skills", "confidence", "SKILL.md"),
    );
  });
  it("copilot has no auto", () => {
    expect(at.copilot.layout.auto).toBeUndefined();
  });
});

describe("each bridge's always anchor", () => {
  it("claude-code local → .claude/settings.json", () => {
    expect(at["claude-code"].layout.always("local", "/p")).toBe(
      join("/p", ".claude", "settings.json"),
    );
  });
  it("pi local → .pi/APPEND_SYSTEM.md", () => {
    expect(at.pi.layout.always("local", "/p")).toBe(join("/p", ".pi", "APPEND_SYSTEM.md"));
  });
  it("opencode local → AGENTS.md at project root", () => {
    expect(at.opencode.layout.always("local", "/p")).toBe(join("/p", "AGENTS.md"));
  });
  it("copilot local → .github/copilot-instructions.md", () => {
    expect(at.copilot.layout.always("local", "/p")).toBe(
      join("/p", ".github", "copilot-instructions.md"),
    );
  });
});

describe("artifactPath", () => {
  it("rejects auto for a bridge that has none", () => {
    expect(() =>
      copilot.artifactPath({
        mode: "auto",
        scope: "local",
        slug: "c",
        name: "c",
        projectRoot: "/p",
      }),
    ).toThrow(/auto/);
  });
});

describe("skillDirectory — where declared siblings can go", () => {
  const at2 = (bridge: string, mode: "slash" | "auto" | "always") =>
    at[bridge as keyof typeof at].skillDirectory({
      mode,
      name: "x",
      scope: "local",
      projectRoot: "/p",
    });

  it("auto writes a per-skill directory in every bridge that has one", () => {
    expect(at2("pi", "auto")).toBe(join("/p", ".pi", "skills", "x"));
    expect(at2("claude-code", "auto")).toBe(join("/p", ".claude", "skills", "x"));
    expect(at2("opencode", "auto")).toBe(join("/p", ".opencode", "skills", "x"));
  });

  it("claude-code always writes one too — that is this harness's own behaviour", () => {
    // Formerly a `agent === "claude-code"` test inside the core installer; it
    // belongs here because it is derived from what this harness does (it writes
    // a skill file beside the settings hook), not from a rule the core holds.
    expect(at2("claude-code", "always")).toBe(join("/p", ".claude", "skills", "x"));
  });

  it("slash and always have nowhere to put a sibling elsewhere", () => {
    expect(at2("pi", "slash")).toBeNull();
    expect(at2("pi", "always")).toBeNull();
    expect(at2("opencode", "slash")).toBeNull();
    expect(at2("opencode", "always")).toBeNull();
    expect(at2("claude-code", "slash")).toBeNull();
  });

  it("a bridge with no auto mode never has one", () => {
    expect(at2("copilot", "slash")).toBeNull();
    expect(at2("copilot", "always")).toBeNull();
  });
});
