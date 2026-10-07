/**
 * The name of one harness bridge. A plain string on purpose: which harnesses
 * exist is registry data (`src/bridges/index.ts`), not a closed union the core
 * holds. The core must not know that any particular harness exists — that is
 * slice 2e's rule, and a test enforces it.
 */
export type BridgeName = string;

export type Mode = "slash" | "auto" | "always";

export const MODES: readonly Mode[] = ["slash", "auto", "always"] as const;

export type ArtifactKind = "skill" | "agent";

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
  targets?: Partial<Record<BridgeName, Record<string, unknown>>>;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  source: string;
}

export interface AgentFrontmatter {
  name: string;
  description: string;
  targets?: Partial<Record<BridgeName, Record<string, unknown>>>;
}

export interface ParsedAgent {
  frontmatter: AgentFrontmatter;
  body: string;
  source: string;
}

export interface TargetArtifact {
  /** Path of the file relative to the install root (`location`). */
  path: string;
  contents: string;
}

/**
 * A file a skill ships beside its `SKILL.md` — a helper script, a template, a
 * reference — copied verbatim into the install directory rather than rendered.
 * Declared per skill in `skillset.config.json`, because shipping a 439-line
 * helper must be a deliberate, reviewable statement, not "whatever sits in the
 * directory".
 */
export interface SiblingFile {
  /** Path relative to the skill's source directory — and to the install
   * directory it is copied into. */
  rel: string;
  /** Absolute path of the bundled source file. */
  source: string;
}

export interface InstallRecord {
  skill: string;
  kind?: ArtifactKind;
  /** Slug used as the slash-command filename. May differ from `skill` (e.g. the
   * `sk-` prefix convention). Optional for backward compatibility with state
   * written before this field existed. */
  slug?: string;
  version: string;
  agent: BridgeName;
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
  /** Absolute paths to standalone executable artifacts shipped by a skill (an
   * editor plugin, a harness extension, a hook config). Removed verbatim on
   * uninstall (decision 8). */
  assets?: string[];
  projectPath?: string;
  installedAt: string;
}

export interface SkillsetState {
  version: 1;
  installs: InstallRecord[];
}

/**
 * One install the repository declares for a skill, read from
 * `skillset.config.json`. A skill may declare several: the deliberate setup is
 * that `architect`, `caveman`, `ponytail` and `commit-suggestion` are installed
 * as *both* a slash prompt and an auto skill (ADR 0005), which the state model
 * could not represent until records became mode-scoped.
 */
export interface InstallDeclaration {
  skill: string;
  kind?: ArtifactKind;
  agent: BridgeName;
  mode: Mode;
  scope: Scope;
  /** Required for `local` declarations; absent for `global`. */
  projectPath?: string;
}

/** Shape of the repository-level declarations file. */
export interface Declarations {
  version: 1;
  installs: InstallDeclaration[];
  /** Declared sibling files per skill, with their resolved bundle sources. */
  siblings: Record<string, SiblingFile[]>;
}

/**
 * Per skill and harness, the frontmatter fields that harness must be able to
 * carry. A capability, not a value — the value lives under `targets.<agent>` in
 * the skill itself. A requirement no renderer can satisfy is an error rather
 * than a degraded install (slice 2c criterion 3).
 */
export type RequiredFields = Record<string, Partial<Record<BridgeName, readonly string[]>>>;

/**
 * What one harness can actually carry, declared once per target so the matrix is
 * reviewable data rather than conditionals scattered across four renderers.
 * "Express" means both halves: the renderer forwards the field *and* the harness
 * reads it — a field the harness ignores is exactly what the report exists to
 * name.
 */
export interface TargetFrontmatter {
  /** Per mode, the harness-facing fields this target can carry. A mode the
   * target does not support is absent. The sets differ per mode because the
   * artifact kinds differ: a slash command and a skill have different
   * vocabularies on the same harness. */
  expresses: Partial<Record<Mode, readonly string[]>>;
  /** Field → what the user loses when this harness ignores it. The report's
   * second half, so a known loss is stated in the harness's own terms; a field
   * with no entry falls back to a generic sentence. */
  consequence?: Readonly<Record<string, string>>;
  /** Native commands and aliases an install must not shadow. The mandatory
   * `sk-` slug prefix is what keeps our installs clear of them. */
  native?: readonly string[];
}

/**
 * Frontmatter keys skillset itself owns. Every other key a skill declares is
 * harness-facing: a target that cannot express it must say so rather than drop
 * it silently.
 */
export const SKILLSET_FIELDS: readonly string[] = [
  "name",
  "version",
  "description",
  "slug",
  "statusReader",
  "config",
  "targets",
];

export const SKILLSET_AGENT_FIELDS: readonly string[] = ["name", "description", "targets"];
