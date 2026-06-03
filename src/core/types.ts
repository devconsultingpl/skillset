export type AgentName = "claude-code" | "pi" | "opencode" | "copilot";

export const AGENTS: readonly AgentName[] = ["claude-code", "pi", "opencode", "copilot"] as const;

export type Mode = "slash" | "auto" | "always";

export const MODES: readonly Mode[] = ["slash", "auto", "always"] as const;

export type Scope = "global" | "local";

export interface SkillFrontmatter {
  name: string;
  version: string;
  description: string;
  /** Optional explicit slug for slash/command file names (defaults to `name`). */
  slug?: string;
  /** Marks the one bundled reader skill (`skillset-status`): its slash command
   * reports the active set instead of recording itself as an active mode. */
  statusReader?: boolean;
  config?: Record<string, unknown>;
  targets?: Partial<Record<AgentName, Record<string, unknown>>>;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  source: string;
}

export interface TargetArtifact {
  /** Path of the file relative to the install root (`location`). */
  path: string;
  contents: string;
}

export interface InstallRecord {
  skill: string;
  /** Slug used as the slash-command filename. May differ from `skill` (e.g. the
   * `sk-` prefix convention). Optional for backward compatibility with state
   * written before this field existed. */
  slug?: string;
  version: string;
  agent: AgentName;
  scope: Scope;
  mode: Mode;
  /** Install root — directory the artifacts were written under. */
  location: string;
  /** Files written (paths relative to `location`). */
  files: string[];
  /** Marker-wrapped insertions made into shared files (absolute paths). */
  insertions?: string[];
  /** Hook entries added to settings/config (agent-defined opaque identifier). */
  hooks?: string[];
  /** The exact statusLine command this install wrote into settings (decision 9).
   * Uninstall removes the statusLine only if it still equals this — so a user
   * who later set their own statusLine is never clobbered. */
  statusLine?: string;
  /** Absolute path of the settings file holding our statusLine, so uninstall
   * removes it without re-deriving an agent-specific path. */
  statusLinePath?: string;
  /** Absolute paths to standalone executable artifacts (opencode plugin, pi
   * extension, Copilot CLI hook). Removed verbatim on uninstall (decision 8). */
  assets?: string[];
  projectPath?: string;
  installedAt: string;
}

export interface SkillsetState {
  version: 1;
  installs: InstallRecord[];
}
