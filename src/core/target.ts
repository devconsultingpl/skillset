import type {
  InstallRecord,
  Mode,
  ParsedSkill,
  Scope,
  SiblingFile,
  TargetFrontmatter,
} from "./types.js";

export interface InstallContext {
  skill: ParsedSkill;
  scope: Scope;
  mode: Mode;
  projectRoot: string;
  /** The skill's declared sibling files (2a): copied verbatim into the install
   * directory when this (agent, mode) has one. Absent means none were declared. */
  siblings?: SiblingFile[];
}

/**
 * Comparable bytes for an existing install: what is on disk now vs what an
 * update would write. The unit is the whole file for per-file modes and the
 * marker-block interior for marker-block modes. `update` compares these to
 * detect local edits before overwriting.
 */
export interface InstalledPreview {
  /** Comparable on-disk bytes, or null if the artifact is missing. */
  current: string | null;
  /** Comparable bytes an update would write. */
  next: string;
}

/**
 * Each agent implements this. `install` writes files and modifies anchor files
 * (with markers) to wire the chosen mode. `uninstall` removes only what was
 * recorded — never touches surrounding user content.
 */
export interface AgentTarget {
  readonly name: InstallRecord["agent"];
  /** Modes this agent supports. Installer rejects unsupported requests. */
  readonly supportedModes: readonly Mode[];
  /** The harness frontmatter this target can carry, and the native commands it
   * must not shadow (slice 2c). Declared data, checked by `fieldSupport`. */
  readonly frontmatter: TargetFrontmatter;
  install(ctx: InstallContext): Promise<InstallRecord>;
  uninstall(record: InstallRecord): Promise<void>;
  /** Comparable on-disk vs would-write bytes for a recorded install. */
  preview(ctx: InstallContext, record: InstallRecord): Promise<InstalledPreview>;
}
