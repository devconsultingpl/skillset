import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentName, Mode, Scope } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

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

/**
 * The directory a skill's declared sibling files install into, or null when this
 * (agent, mode) writes no per-skill directory: slash mode drops a single prompt
 * file into a shared directory, and a marker block appends to a file the user
 * owns. Siblings travel only where there is a skill directory to put them in.
 *
 * claude-code `always` is the one exception, and it is derived from what that
 * target actually does: it writes a skill file beside the settings hook, so it
 * has a directory to fill.
 */
export function skillDirectoryFor(opts: {
  agent: AgentName;
  mode: Mode;
  name: string;
  scope: Scope;
  projectRoot: string;
}): string | null {
  const layout = layoutFor(opts.agent);
  if (!layout.auto) return null;
  const writesSkillDir =
    opts.mode === "auto" || (opts.agent === "claude-code" && opts.mode === "always");
  if (!writesSkillDir) return null;
  return dirname(layout.auto(opts.name, opts.scope, opts.projectRoot));
}

/** Path of skillset's own state file (~/.skillset/state.json). */
export function stateFilePath(): string {
  return join(homedir(), ".skillset", "state.json");
}

/**
 * Path of the repository-level install declarations (`skillset.config.json`).
 * Resolved next to `skillsRoot`, so it is the package root in both `src/` (dev)
 * and `dist/` (installed).
 */
export function declarationsFilePath(): string {
  // A test or CI run can point at a scratch declarations file instead; the same
  // seam `SKILLSET_ALWAYS_WARN_LINES` uses for the same reason. Without it the
  // path is fixed next to the bundle, in both `src/` and `dist/`.
  const override = process.env.SKILLSET_CONFIG?.trim();
  if (override) return resolve(override);
  return resolve(here, "..", "..", "skillset.config.json");
}
