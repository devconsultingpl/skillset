export type AgentName = "claude-code" | "pi" | "opencode" | "copilot";

export const AGENTS: readonly AgentName[] = ["claude-code", "pi", "opencode", "copilot"] as const;

export type Mode = "slash" | "auto" | "always";

export const MODES: readonly Mode[] = ["slash", "auto", "always"] as const;

export type Scope = "global" | "local";

export interface SkillFrontmatter {
  name: string;
  version: string;
  description: string;
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
  projectPath?: string;
  installedAt: string;
}

export interface SkillsetState {
  version: 1;
  installs: InstallRecord[];
}
