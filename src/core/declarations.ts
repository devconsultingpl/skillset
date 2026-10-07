/**
 * declarations.ts — the repository's install declarations, and the drift
 * classification that keeps installed copies honest.
 *
 * `skillset.config.json` declares which skills belong in which harness
 * directories. Classification compares each declaration against both the state
 * file and what is actually on disk, so three failures that were previously
 * invisible become reportable: an installed copy that was edited locally
 * (`drifted`), a declared install that is absent (`missing`), and a file at an
 * owned destination that skillset never wrote (`foreign`) — the last being the
 * case `scripts/sync-pi-auto.mjs` created by writing four auto skills that could
 * not be recorded (docs/decisions/0005).
 *
 * Comparison reuses each target's `preview`, which already returns comparable
 * on-disk vs would-write bytes for the mode's primary artifact. For an
 * unrecorded destination there is no record to preview against, so a
 * record-shaped stand-in supplies the path its renderer needs; the bytes
 * themselves still come from the target, never from a second renderer here.
 */
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";
import { targetFor } from "../targets/index.js";
import { listBundledSkills, loadBundledSkill, skillSourcePath } from "./bundle.js";
import { fileExists, readMaybe, readMaybeBytes } from "./fs.js";
import { artifactPath, declarationsFilePath, skillDirectoryFor } from "./locations.js";
import { MD, extract } from "./markers.js";
import { applyConfigToSkill } from "./template.js";
import type {
  AgentName,
  InstallDeclaration,
  InstallRecord,
  Mode,
  ParsedSkill,
  Scope,
  SiblingFile,
  SkillsetState,
} from "./types.js";
import { AGENTS, MODES } from "./types.js";

export type InstallStatus =
  /** Recorded, and the on-disk bytes match what we would write. */
  | "in-sync"
  /** Recorded, but the on-disk bytes differ — local edits. */
  | "drifted"
  /** Declared, nothing installed, nothing in the way. */
  | "missing"
  /** On disk with no record, and byte-identical to what we would write: safe to record. */
  | "adoptable"
  /** On disk with no record and different content: never overwritten silently. */
  | "foreign"
  /** Recorded but no longer declared. */
  | "undeclared";

export interface ClassifiedInstall {
  declaration: InstallDeclaration;
  status: InstallStatus;
  /** The artifact compared, absolute. `null` when nothing could be derived. */
  path: string | null;
  /** The existing record, when the declaration is installed. */
  record?: InstallRecord;
  /** Present for `drifted` and `foreign`: what an install would replace. */
  currentBytes?: string | null;
  /** Present for `drifted`: what an install would write instead. */
  nextBytes?: string;
  /** Per-file state of the skill's declared siblings, when this (agent, mode)
   * has a skill directory to hold them. `status` above is the worst of these
   * and the primary artifact's. */
  siblings?: SiblingState[];
}

/** One declared sibling file, classified the same way a skill artifact is. */
export interface SiblingState {
  rel: string;
  /** Absolute path the sibling occupies in the install directory. */
  path: string;
  status: InstallStatus;
  /** Present when something is on disk: what an install would replace. */
  currentBytes?: string;
  /** Present for `drifted` and `foreign`: what an install would write instead. */
  nextBytes?: string;
}

/**
 * Report order — and therefore the rank a rolled-up install takes: a foreign
 * sibling makes the whole install `foreign`, an in-sync one is invisible.
 */
export const STATUS_ORDER: readonly InstallStatus[] = [
  "foreign",
  "drifted",
  "missing",
  "adoptable",
  "undeclared",
  "in-sync",
];

export interface DeclarationParseResult {
  declarations: InstallDeclaration[];
  /** Declared sibling files per skill, with absolute bundle source paths. */
  siblings: Record<string, SiblingFile[]>;
  problems: string[];
}

function isKnown<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/**
 * Parse the `siblings` block: which files a skill ships beside its `SKILL.md`.
 * Pure shape rules only — whether the file exists is coverage's job — but the
 * shape rules are the safety ones: a sibling is copied byte-for-byte into the
 * install directory, so an absolute path or an escape would write outside it.
 */
function parseSiblings(raw: unknown, problems: string[]): Record<string, SiblingFile[]> {
  const siblings: Record<string, SiblingFile[]> = {};
  if (raw === undefined) return siblings;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problems.push("`siblings` must be an object keyed by skill name");
    return siblings;
  }

  for (const [skill, entries] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      problems.push(`${skill}: sibling files must be an array of relative paths`);
      continue;
    }
    const kept: SiblingFile[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      if (typeof entry !== "string" || entry.length === 0) {
        problems.push(`${skill}: a sibling file must be a non-empty relative path`);
        continue;
      }
      if (isAbsolute(entry)) {
        problems.push(`${skill}: sibling file must be relative, not absolute: ${entry}`);
        continue;
      }
      const rel = normalize(entry);
      if (rel.startsWith("..")) {
        problems.push(`${skill}: sibling file points outside the skill directory: ${entry}`);
        continue;
      }
      if (rel === "SKILL.md") {
        problems.push(`${skill}: SKILL.md is rendered, not copied — remove it from siblings`);
        continue;
      }
      if (seen.has(rel)) {
        problems.push(`${skill}: sibling file declared twice: ${rel}`);
        continue;
      }
      seen.add(rel);
      kept.push({ rel, source: skillSourcePath(skill, rel) });
    }
    if (kept.length > 0) siblings[skill] = kept;
  }
  return siblings;
}

/** Parse the declarations file. Pure, so the shape rules are unit-testable. */
export function parseDeclarations(raw: unknown): DeclarationParseResult {
  const problems: string[] = [];
  const declarations: InstallDeclaration[] = [];
  const empty: DeclarationParseResult = { declarations, siblings: {}, problems };

  if (typeof raw !== "object" || raw === null) {
    return { ...empty, problems: ["declarations file must contain a JSON object"] };
  }
  const {
    version,
    installs,
    siblings: siblingBlock,
  } = raw as {
    version?: unknown;
    installs?: unknown;
    siblings?: unknown;
  };
  const siblings = parseSiblings(siblingBlock, problems);
  if (version !== 1) {
    problems.push(`unsupported declarations version: ${String(version)}`);
  }
  if (typeof installs !== "object" || installs === null || Array.isArray(installs)) {
    problems.push("`installs` must be an object keyed by skill name");
    return { declarations, siblings, problems };
  }

  for (const [skill, entries] of Object.entries(installs as Record<string, unknown>)) {
    if (!Array.isArray(entries) || entries.length === 0) {
      problems.push(`${skill}: must declare at least one install`);
      continue;
    }
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) {
        problems.push(`${skill}: each install must be an object`);
        continue;
      }
      const { agent, mode, scope, projectPath } = entry as Record<string, unknown>;
      if (!isKnown(AGENTS, agent)) {
        problems.push(`${skill}: unknown agent ${JSON.stringify(agent)}`);
        continue;
      }
      if (!isKnown(MODES, mode)) {
        problems.push(`${skill}: unknown mode ${JSON.stringify(mode)}`);
        continue;
      }
      const resolvedScope: Scope = scope === undefined || scope === "global" ? "global" : "local";
      if (scope !== undefined && !isKnown(["global", "local"] as const, scope)) {
        problems.push(`${skill}: unknown scope ${JSON.stringify(scope)}`);
        continue;
      }
      if (resolvedScope === "local" && typeof projectPath !== "string") {
        problems.push(`${skill}: a local install must declare \`projectPath\``);
        continue;
      }
      declarations.push({
        skill,
        agent,
        mode,
        scope: resolvedScope,
        ...(resolvedScope === "local" ? { projectPath: projectPath as string } : {}),
      });
    }
  }

  return { declarations, siblings, problems };
}

/** Read and parse `skillset.config.json`. */
export async function loadDeclarations(
  path = declarationsFilePath(),
): Promise<DeclarationParseResult> {
  const none: DeclarationParseResult = { declarations: [], siblings: {}, problems: [] };
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { ...none, problems: [`no declarations file at ${path}`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ...none, problems: [`${path} is not valid JSON: ${(err as Error).message}`] };
  }
  return parseDeclarations(parsed);
}

/**
 * Cross-check declarations against the bundled skills in both directions: a
 * declared skill that does not exist is a typo or a rename, and a bundled skill
 * that declares nothing is a skill that silently never installs. Declared
 * sibling files get the same treatment: a path that is not a file in the bundle
 * is a declaration that would install nothing (or throw), so it is reported
 * before anything is written.
 */
export async function declarationCoverage(
  declarations: readonly InstallDeclaration[],
  siblings: Record<string, SiblingFile[]> = {},
): Promise<string[]> {
  const problems: string[] = [];
  const bundled = new Set(await listBundledSkills());
  const declared = new Set(declarations.map((d) => d.skill));
  for (const skill of declared) {
    if (!bundled.has(skill)) {
      problems.push(`${skill}: declared but not present in src/skills/`);
    }
  }
  for (const skill of bundled) {
    if (!declared.has(skill)) {
      problems.push(`${skill}: bundled but declares no install`);
    }
  }
  for (const [skill, files] of Object.entries(siblings)) {
    if (!declared.has(skill)) {
      problems.push(`${skill}: declares sibling files but no install`);
    }
    const config = bundled.has(skill)
      ? (await loadBundledSkill(skill)).frontmatter.config
      : undefined;
    const keys = config ? Object.keys(config) : [];
    for (const file of files) {
      if (!(await isFile(file.source))) {
        problems.push(`${skill}: declared sibling ${file.rel} is not in src/skills/${skill}/`);
        continue;
      }
      if (keys.length === 0) continue;
      const bytes = await readFile(file.source, "utf8");
      for (const key of configPlaceholdersIn(bytes, keys)) {
        problems.push(
          `${skill}: sibling ${file.rel} contains {{${key}}} — siblings are copied verbatim, not substituted`,
        );
      }
    }
  }
  return problems;
}

async function isFile(path: string): Promise<boolean> {
  if (!(await fileExists(path))) return false;
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Config placeholders a verbatim copy cannot substitute. Siblings are copied,
 * not rendered, so a `{{key}}` naming one of the skill's own config keys would
 * ship unsubstituted — a helper that is broken at the point of use. Report it
 * here instead. Keys the skill does not declare are left alone: a template may
 * legitimately carry braces of its own.
 */
export function configPlaceholdersIn(bytes: string, keys: readonly string[]): string[] {
  return keys.filter((key) => bytes.includes(`{{${key}}}`));
}

export function findRecord(
  state: SkillsetState,
  declaration: InstallDeclaration,
): InstallRecord | undefined {
  return state.installs.find(
    (record) =>
      record.skill === declaration.skill &&
      record.agent === declaration.agent &&
      record.mode === declaration.mode &&
      record.scope === declaration.scope &&
      (record.projectPath ?? null) === (declaration.projectPath ?? null),
  );
}

/** The path a declaration's primary artifact occupies, from `artifactPath`. */
function primaryPath(declaration: InstallDeclaration, skill: ParsedSkill): string {
  return artifactPath({
    agent: declaration.agent,
    mode: declaration.mode,
    scope: declaration.scope,
    slug: skill.frontmatter.slug ?? skill.frontmatter.name,
    name: skill.frontmatter.name,
    projectRoot: declaration.projectPath ?? process.cwd(),
  });
}

/**
 * A record-shaped stand-in for an unrecorded destination, so `preview` can
 * render what we would write without a second renderer living here.
 */
function standInRecord(
  declaration: InstallDeclaration,
  skill: ParsedSkill,
  path: string,
): InstallRecord {
  return {
    skill: skill.frontmatter.name,
    slug: skill.frontmatter.slug ?? skill.frontmatter.name,
    version: skill.frontmatter.version,
    agent: declaration.agent,
    scope: declaration.scope,
    mode: declaration.mode,
    location: dirname(path),
    files: [basename(path)],
    insertions: declaration.mode === "always" ? [path] : undefined,
    projectPath: declaration.projectPath,
    installedAt: "",
  };
}

/**
 * Classify one skill's declared sibling files against the install directory and
 * the record. Same rule as the primary artifact, per file: a recorded file that
 * diverges is ours to repair (`drifted`), an unrecorded one that diverges is
 * not (`foreign`), an unrecorded one that matches is `adoptable`, and a declared
 * file that is absent is `missing`.
 */
export async function classifySiblings(
  siblings: readonly SiblingFile[],
  directory: string,
  recorded: ReadonlySet<string>,
): Promise<SiblingState[]> {
  const states: SiblingState[] = [];
  for (const sibling of siblings) {
    const path = join(directory, sibling.rel);
    const [current, next] = await Promise.all([readMaybeBytes(path), readFile(sibling.source)]);
    const ours = recorded.has(sibling.rel);
    if (current === null) {
      states.push({ rel: sibling.rel, path, status: "missing" });
      continue;
    }
    if (current.equals(next)) {
      states.push({
        rel: sibling.rel,
        path,
        status: ours ? "in-sync" : "adoptable",
        currentBytes: current.toString("utf8"),
      });
      continue;
    }
    states.push({
      rel: sibling.rel,
      path,
      status: ours ? "drifted" : "foreign",
      currentBytes: current.toString("utf8"),
      nextBytes: next.toString("utf8"),
    });
  }
  return states;
}

/** A rolled-up install takes the most urgent of its files' statuses. */
function worstStatus(statuses: readonly InstallStatus[]): InstallStatus {
  return statuses.reduce((worst, status) =>
    STATUS_ORDER.indexOf(status) < STATUS_ORDER.indexOf(worst) ? status : worst,
  );
}

/** Classify one declaration against state and disk. */
export async function classifyInstall(
  declaration: InstallDeclaration,
  state: SkillsetState,
  siblings: Record<string, SiblingFile[]> = {},
): Promise<ClassifiedInstall> {
  // Render through the same path an install takes: a skill whose frontmatter
  // carries `config:` placeholders must compare against its *substituted* bytes,
  // or a correctly configured file reports as drifted and gets "repaired" back
  // to its placeholders.
  const skill = applyConfigToSkill(await loadBundledSkill(declaration.skill));
  const record = findRecord(state, declaration);
  const path = primaryPath(declaration, skill);
  const primary = await classifyPrimary(declaration, skill, record, path);

  // Siblings only travel where the mode writes a per-skill directory, so a
  // slash prompt or a marker block has none to classify.
  const directory = skillDirectoryFor({
    agent: declaration.agent,
    mode: declaration.mode,
    name: skill.frontmatter.name,
    scope: declaration.scope,
    projectRoot: declaration.projectPath ?? process.cwd(),
  });
  const declared = siblings[declaration.skill] ?? [];
  if (!directory || declared.length === 0) return primary;

  const states = await classifySiblings(declared, directory, new Set(record?.files ?? []));
  return {
    ...primary,
    status: worstStatus([primary.status, ...states.map((s) => s.status)]),
    siblings: states,
  };
}

/** The primary artifact's status — the whole install before siblings existed. */
async function classifyPrimary(
  declaration: InstallDeclaration,
  skill: ParsedSkill,
  record: InstallRecord | undefined,
  path: string,
): Promise<ClassifiedInstall> {
  const { agent, scope, mode } = declaration;
  if (record) {
    const { current, next } = await targetFor(agent).preview(
      { skill, scope, mode, projectRoot: declaration.projectPath ?? process.cwd() },
      record,
    );
    if (current === null) {
      return { declaration, status: "missing", path, record };
    }
    return current === next
      ? { declaration, status: "in-sync", path, record }
      : { declaration, status: "drifted", path, record, currentBytes: current, nextBytes: next };
  }

  if (declaration.mode === "always") {
    // The anchor file belongs to the user as much as to us; only our own marker
    // block being present without a record is a conflict.
    const existing = (await readMaybe(path)) ?? "";
    if (existing.length === 0) {
      return { declaration, status: "missing", path };
    }
    return extract(existing, skill.frontmatter.name, MD) === null
      ? { declaration, status: "missing", path }
      : { declaration, status: "foreign", path, currentBytes: existing };
  }

  const current = await readMaybe(path);
  if (current === null) {
    return { declaration, status: "missing", path };
  }
  const { next } = await targetFor(agent).preview(
    { skill, scope, mode, projectRoot: declaration.projectPath ?? process.cwd() },
    standInRecord(declaration, skill, path),
  );
  return current === next
    ? { declaration, status: "adoptable", path, currentBytes: current }
    : { declaration, status: "foreign", path, currentBytes: current, nextBytes: next };
}

/** Classify every declaration, plus recorded installs nothing declares. */
export async function classifyAll(
  declarations: readonly InstallDeclaration[],
  state: SkillsetState,
  siblings: Record<string, SiblingFile[]> = {},
): Promise<ClassifiedInstall[]> {
  const classified: ClassifiedInstall[] = [];
  for (const declaration of declarations) {
    classified.push(await classifyInstall(declaration, state, siblings));
  }
  for (const record of state.installs) {
    const stillDeclared = declarations.some(
      (d) =>
        d.skill === record.skill &&
        d.agent === record.agent &&
        d.mode === record.mode &&
        d.scope === record.scope &&
        (d.projectPath ?? null) === (record.projectPath ?? null),
    );
    if (stillDeclared) continue;
    classified.push({
      declaration: {
        skill: record.skill,
        agent: record.agent,
        mode: record.mode,
        scope: record.scope,
        projectPath: record.projectPath,
      },
      status: "undeclared",
      path: record.files[0] ? `${record.location}/${record.files[0]}` : null,
      record,
    });
  }
  return classified;
}

/** Agents a skill declares for a scope — used when `--mode` is omitted. */
export function declaredModes(
  declarations: readonly InstallDeclaration[],
  skill: string,
  agent: AgentName,
  scope: Scope,
): Mode[] {
  return declarations
    .filter((d) => d.skill === skill && d.agent === agent && d.scope === scope)
    .map((d) => d.mode);
}
