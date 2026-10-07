/**
 * sync.ts — reconcile every declared install to the repository's sources.
 *
 * The single entry point that makes "change it in skillset, everywhere follows"
 * true: it derives the whole set from `skillset.config.json`, reports each
 * install's drift classification, adopts or installs what is missing, repairs
 * what was edited, and refuses to touch a destination file skillset never wrote.
 *
 * It is also the read-only report: `--dry-run` classifies and changes nothing.
 */
import { homedir } from "node:os";
import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import {
  type ClassifiedInstall,
  type InstallStatus,
  classifyAll,
  declarationCoverage,
  loadDeclarations,
} from "../core/declarations.js";
import { lineDiff } from "../core/diff.js";
import { readState, removeInstall, upsertInstall, writeState } from "../core/state.js";
import { applyConfigToSkill } from "../core/template.js";
import type { SkillsetState } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface SyncOptions {
  dryRun?: boolean;
  /** Remove recorded installs that the declarations no longer mention. */
  prune?: boolean;
  projectRoot?: string;
}

/** Report order: what needs attention first, what is healthy last. */
const STATUS_ORDER: readonly InstallStatus[] = [
  "foreign",
  "drifted",
  "missing",
  "adoptable",
  "undeclared",
  "in-sync",
];

const STATUS_LABEL: Record<InstallStatus, (text: string) => string> = {
  foreign: (t) => pc.red(t),
  drifted: (t) => pc.yellow(t),
  missing: (t) => pc.cyan(t),
  adoptable: (t) => pc.cyan(t),
  undeclared: (t) => pc.magenta(t),
  "in-sync": (t) => pc.green(t),
};

const ACTION: Record<ClassifiedInstall["status"], string> = {
  foreign: "— not written by skillset; refusing to overwrite (--force on install to replace)",
  drifted: "— edited locally; rewriting from source",
  missing: "— installing",
  adoptable: "— on disk already, byte-identical; recording it",
  undeclared: "— recorded but no longer declared",
  "in-sync": "",
};

const inDryRun: Record<ClassifiedInstall["status"], string> = {
  foreign: "— not written by skillset (would refuse)",
  drifted: "— edited locally (would rewrite)",
  missing: "— not installed (would install)",
  adoptable: "— on disk, byte-identical (would record)",
  undeclared: "— recorded but no longer declared",
  "in-sync": "",
};

/** Shorten the home prefix so reports stay readable. */
function displayPath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function describe(item: ClassifiedInstall): string {
  const { declaration } = item;
  const scope =
    declaration.scope === "local" ? `local:${declaration.projectPath ?? "?"}` : "global";
  return `${declaration.skill} → ${declaration.agent} (${declaration.mode}, ${scope})`;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

/** A prior-content report, bounded so a large rewrite cannot flood a terminal. */
function reportPriorContent(current: string, next: string, maxLines = 60): string {
  const diff = lineDiff(current, next).trimEnd();
  if (diff.length === 0) {
    return "";
  }
  const lines = diff.split("\n");
  const shown = lines.slice(0, maxLines);
  const truncated =
    lines.length > maxLines ? `\n    … ${lines.length - maxLines} more diff lines` : "";
  return indent(`${shown.join("\n")}${truncated}`);
}

export async function sync(opts: SyncOptions = {}): Promise<number> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const { declarations, problems } = await loadDeclarations();
  const coverage = declarations.length > 0 ? await declarationCoverage(declarations) : [];
  const allProblems = [...problems, ...coverage];
  if (allProblems.length > 0) {
    for (const problem of allProblems) {
      console.error(pc.red("problem"), problem);
    }
    return 2;
  }

  let state = await readState();
  const classified = await classifyAll(declarations, state);
  classified.sort((a, b) => {
    const order = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return order !== 0 ? order : describe(a).localeCompare(describe(b));
  });

  const counts = new Map<InstallStatus, number>();
  let foreign = 0;
  let changed = 0;

  for (const item of classified) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    const where = item.path ? pc.dim(displayPath(item.path)) : "";
    const note = opts.dryRun ? inDryRun[item.status] : ACTION[item.status];
    console.log(
      STATUS_LABEL[item.status](item.status.padEnd(10)),
      describe(item),
      where,
      pc.dim(note),
    );

    if (item.status === "foreign") {
      foreign += 1;
      // Report what is being protected: the prior content is the only record of it.
      if (item.currentBytes != null && item.nextBytes !== undefined) {
        const report = reportPriorContent(item.currentBytes, item.nextBytes);
        if (report) console.log(report);
      }
      continue;
    }
    if (item.status === "drifted" && item.currentBytes != null && item.nextBytes !== undefined) {
      const report = reportPriorContent(item.currentBytes, item.nextBytes);
      if (report) console.log(report);
    }
    if (opts.dryRun || item.status === "in-sync") {
      continue;
    }
    if (item.status === "undeclared") {
      if (!opts.prune) continue;
      if (item.record) {
        await targetFor(item.record.agent).uninstall(item.record);
        state = removeInstall(state, item.record);
        changed += 1;
      }
      continue;
    }

    const declaration = item.declaration;
    // Same render path as `install`: config placeholders are substituted at
    // write time, so sync must not write the raw bundle.
    const skill = applyConfigToSkill(await loadBundledSkill(declaration.skill));
    const record = await targetFor(declaration.agent).install({
      skill,
      scope: declaration.scope,
      mode: declaration.mode,
      projectRoot: declaration.projectPath ?? projectRoot,
    });
    state = upsertInstall(state, record);
    changed += 1;
  }

  if (!opts.dryRun && changed > 0) {
    await writeState(state);
  }

  const summary = STATUS_ORDER.filter((status) => counts.has(status)).map(
    (status) => `${status} ${counts.get(status)}`,
  );
  console.log(
    opts.dryRun ? pc.bold("checked") : pc.bold("reconciled"),
    pc.dim(summary.join(" · ")),
    changed > 0 ? pc.dim(`· ${changed} written`) : "",
  );
  if (foreign > 0) {
    console.error(
      pc.red(`${foreign} foreign file(s) left untouched`),
      pc.dim("— move or remove them, or adopt them by installing deliberately"),
    );
    return 1;
  }
  return 0;
}

/** Exported for the CLI and for tests that need the classified report alone. */
export async function classifyReport(
  opts: { projectRoot?: string } = {},
): Promise<{ items: ClassifiedInstall[]; problems: string[]; state: SkillsetState }> {
  const { declarations, problems } = await loadDeclarations();
  const coverage = declarations.length > 0 ? await declarationCoverage(declarations) : [];
  const state = await readState();
  const items = await classifyAll(declarations, state);
  return { items, problems: [...problems, ...coverage], state };
}

export type { ClassifiedInstall };
