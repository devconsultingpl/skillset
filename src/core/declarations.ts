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
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { targetFor } from "../targets/index.js";
import { listBundledSkills, loadBundledSkill } from "./bundle.js";
import { readMaybe } from "./fs.js";
import { artifactPath, declarationsFilePath } from "./locations.js";
import { MD, extract } from "./markers.js";
import { applyConfigToSkill } from "./template.js";
import type {
  AgentName,
  InstallDeclaration,
  InstallRecord,
  Mode,
  ParsedSkill,
  Scope,
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
}

export interface DeclarationParseResult {
  declarations: InstallDeclaration[];
  problems: string[];
}

function isKnown<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/** Parse the declarations file. Pure, so the shape rules are unit-testable. */
export function parseDeclarations(raw: unknown): DeclarationParseResult {
  const problems: string[] = [];
  const declarations: InstallDeclaration[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { declarations, problems: ["declarations file must contain a JSON object"] };
  }
  const { version, installs } = raw as { version?: unknown; installs?: unknown };
  if (version !== 1) {
    problems.push(`unsupported declarations version: ${String(version)}`);
  }
  if (typeof installs !== "object" || installs === null || Array.isArray(installs)) {
    problems.push("`installs` must be an object keyed by skill name");
    return { declarations, problems };
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

  return { declarations, problems };
}

/** Read and parse `skillset.config.json`. */
export async function loadDeclarations(
  path = declarationsFilePath(),
): Promise<DeclarationParseResult> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { declarations: [], problems: [`no declarations file at ${path}`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { declarations: [], problems: [`${path} is not valid JSON: ${(err as Error).message}`] };
  }
  return parseDeclarations(parsed);
}

/**
 * Cross-check declarations against the bundled skills in both directions: a
 * declared skill that does not exist is a typo or a rename, and a bundled skill
 * that declares nothing is a skill that silently never installs.
 */
export async function declarationCoverage(
  declarations: readonly InstallDeclaration[],
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
  return problems;
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

/** Classify one declaration against state and disk. */
export async function classifyInstall(
  declaration: InstallDeclaration,
  state: SkillsetState,
): Promise<ClassifiedInstall> {
  // Render through the same path an install takes: a skill whose frontmatter
  // carries `config:` placeholders must compare against its *substituted* bytes,
  // or a correctly configured file reports as drifted and gets "repaired" back
  // to its placeholders.
  const skill = applyConfigToSkill(await loadBundledSkill(declaration.skill));
  const target = targetFor(declaration.agent);
  const record = findRecord(state, declaration);
  const path = primaryPath(declaration, skill);

  if (record) {
    const { current, next } = await target.preview(
      {
        skill,
        scope: declaration.scope,
        mode: declaration.mode,
        projectRoot: declaration.projectPath ?? process.cwd(),
      },
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
  const { next } = await target.preview(
    {
      skill,
      scope: declaration.scope,
      mode: declaration.mode,
      projectRoot: declaration.projectPath ?? process.cwd(),
    },
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
): Promise<ClassifiedInstall[]> {
  const classified: ClassifiedInstall[] = [];
  for (const declaration of declarations) {
    classified.push(await classifyInstall(declaration, state));
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
