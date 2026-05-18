import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentName, Mode, Scope } from "./types.js";

/**
 * Layout per agent — one path per (mode, scope). `always` returns the anchor
 * file that gets a marker block; the other modes return a per-skill destination
 * built from a slug provided by the caller.
 */
export interface AgentLayout {
  /** Path to the file/dir we write for slash mode. */
  slash(slug: string, scope: Scope, projectRoot: string): string;
  /** Path to the SKILL.md file for auto mode. (undefined → agent has no auto). */
  auto?(name: string, scope: Scope, projectRoot: string): string;
  /** Path to the anchor file we append a marker block to for always mode. */
  always(scope: Scope, projectRoot: string): string;
}

const claudeCode: AgentLayout = {
  slash(slug, scope, root) {
    const base = scope === "global" ? join(homedir(), ".claude") : join(root, ".claude");
    return join(base, "commands", `${slug}.md`);
  },
  auto(name, scope, root) {
    const base = scope === "global" ? join(homedir(), ".claude") : join(root, ".claude");
    return join(base, "skills", name, "SKILL.md");
  },
  always(scope, root) {
    const base = scope === "global" ? join(homedir(), ".claude") : join(root, ".claude");
    return join(base, "settings.json");
  },
};

const pi: AgentLayout = {
  slash(slug, scope, root) {
    const base = scope === "global" ? join(homedir(), ".pi", "agent") : join(root, ".pi");
    return join(base, "prompts", `${slug}.md`);
  },
  auto(name, scope, root) {
    const base = scope === "global" ? join(homedir(), ".pi", "agent") : join(root, ".pi");
    return join(base, "skills", name, "SKILL.md");
  },
  always(scope, root) {
    const base = scope === "global" ? join(homedir(), ".pi", "agent") : join(root, ".pi");
    return join(base, "APPEND_SYSTEM.md");
  },
};

const opencode: AgentLayout = {
  slash(slug, scope, root) {
    const base =
      scope === "global" ? join(homedir(), ".config", "opencode") : join(root, ".opencode");
    return join(base, "commands", `${slug}.md`);
  },
  auto(name, scope, root) {
    const base =
      scope === "global" ? join(homedir(), ".config", "opencode") : join(root, ".opencode");
    return join(base, "skills", name, "SKILL.md");
  },
  always(scope, root) {
    if (scope === "global") return join(homedir(), ".config", "opencode", "AGENTS.md");
    return join(root, "AGENTS.md");
  },
};

const copilot: AgentLayout = {
  slash(slug, scope, root) {
    // Copilot prompt files live at .github/prompts/<slug>.prompt.md (repo-scoped).
    // No standard user-global location, so we mirror under .skillset/ and let
    // the user copy/symlink into their IDE settings if they want global.
    const base =
      scope === "global" ? join(homedir(), ".skillset", "copilot") : join(root, ".github");
    return join(base, "prompts", `${slug}.prompt.md`);
  },
  // copilot has no auto-trigger concept — install pipeline degrades to always.
  always(scope, root) {
    if (scope === "global") {
      return join(homedir(), ".skillset", "copilot", "copilot-instructions.md");
    }
    return join(root, ".github", "copilot-instructions.md");
  },
};

const LAYOUTS: Record<AgentName, AgentLayout> = {
  "claude-code": claudeCode,
  pi,
  opencode,
  copilot,
};

export function layoutFor(agent: AgentName): AgentLayout {
  return LAYOUTS[agent];
}

/** Resolve the artifact path for a specific (agent, mode, scope) combination. */
export function artifactPath(opts: {
  agent: AgentName;
  mode: Mode;
  scope: Scope;
  slug: string;
  name: string;
  projectRoot?: string;
}): string {
  const root = opts.projectRoot ?? process.cwd();
  const layout = layoutFor(opts.agent);
  switch (opts.mode) {
    case "slash":
      return layout.slash(opts.slug, opts.scope, root);
    case "auto":
      if (!layout.auto) {
        throw new Error(`agent ${opts.agent} does not support mode "auto"`);
      }
      return layout.auto(opts.name, opts.scope, root);
    case "always":
      return layout.always(opts.scope, root);
  }
}

/** Path of skillset's own state file (~/.skillset/state.json). */
export function stateFilePath(): string {
  return join(homedir(), ".skillset", "state.json");
}
