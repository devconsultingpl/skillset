import type {
  BridgeName,
  InstallRecord,
  Mode,
  ParsedSkill,
  Scope,
  SiblingFile,
  TargetFrontmatter,
} from "./types.js";

/**
 * The bridge contract (slice 2e).
 *
 * A **bridge** is everything that knows one harness: where its files live, what
 * frontmatter it reads, how it wires hooks and settings. This file is the whole
 * of what the core knows about that — an interface, with no harness named, no
 * path, and no field list. The implementations live in `src/bridges/<harness>/`
 * and the core never imports them; the composition root (the commands and the
 * CLI) resolves a name through the registry and passes the bridge in.
 *
 * Dependency direction, and the rule that keeps it: `commands → bridges → core`.
 */

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

/** Which artifact a path is being resolved for: the file form that names a
 * skill, or the agent definition that names an agent. An agent has exactly one
 * delivery shape, so `mode` is absent for it. */
export interface ArtifactPathOptions {
  mode: Mode;
  scope: Scope;
  /** The slash-command file name (skills only; defaults to `name`). */
  slug: string;
  name: string;
  projectRoot: string;
}

export interface SkillDirectoryOptions {
  mode: Mode;
  name: string;
  scope: Scope;
  projectRoot: string;
}

/** One harness, as far as the core is concerned. */
export interface Bridge {
  /** The harness's name, as the config and the CLI spell it. A plain string:
   * the set of harnesses is registry data, not a closed union the core holds. */
  readonly name: BridgeName;
  /** Delivery modes this harness supports. The installer rejects the rest. */
  readonly supportedModes: readonly Mode[];
  /** The harness frontmatter skills can carry, and the native commands an
   * install must not shadow (slice 2c). Declared data, checked by
   * `fieldSupport`. */
  readonly frontmatter: TargetFrontmatter;

  install(ctx: InstallContext): Promise<InstallRecord>;
  uninstall(record: InstallRecord): Promise<void>;
  /** Comparable on-disk vs would-write bytes for a recorded install. */
  preview(ctx: InstallContext, record: InstallRecord): Promise<InstalledPreview>;

  /** Where this harness keeps the artifact for one (mode, scope). Resolution
   * only: nothing is written. */
  artifactPath(opts: ArtifactPathOptions): string;
  /** The directory a skill's declared sibling files install into, or null when
   * this mode writes no per-skill directory (a slash prompt is a single file in
   * a shared directory; a marker block appends to a file the user owns). */
  skillDirectory(opts: SkillDirectoryOptions): string | null;
  /** A session id this harness hands to a child process through the
   * environment, if it has such a convention. The env var's *name* is the
   * harness's business, so core asks rather than reading it. */
  sessionKeyFromEnv?(): string | undefined;
}

/**
 * Resolve a bridge by the name a declaration, a record or the CLI used. Callers
 * own the registry; the core only ever receives this function.
 */
export type BridgeLookup = (name: BridgeName) => Bridge | undefined;
