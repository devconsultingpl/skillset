import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { templatesRoot } from "../core/bundle.js";
import { fileExists } from "../core/fs.js";
import {
  type Asker,
  type ChoiceOption,
  askChoice,
  isInteractive,
  readlineAsker,
} from "../core/prompt.js";
import { detectWorkspaceApps } from "../core/workspaces.js";

export interface InitOptions {
  skill: string;
  projectRoot?: string;
  /** Skip per-app scaffolding in monorepos — root only, no question. */
  noApps?: boolean;
  /** Never prompt — apply the default choice (every app + root). Agent/CI-safe. */
  yes?: boolean;
  /** Injectable for tests; defaults to the real TTY asker. */
  ask?: Asker;
  /** Injectable for tests; defaults to `isInteractive()`. */
  interactive?: boolean;
}

interface ScaffoldReport {
  created: number;
  present: number;
}

const APP_CHOICES: ChoiceOption[] = [
  { key: "a", label: "every app + root" },
  { key: "r", label: "root only" },
  { key: "o", label: "apps only, not the root" },
];

/** Count what a scaffold would create vs what already exists, then copy —
 * `force: false` keeps the copy idempotent (existing files untouched). */
async function scaffold(templates: string, dest: string): Promise<ScaffoldReport> {
  const report = { created: 0, present: 0 };
  await plan(templates, dest, report);
  await cp(templates, dest, { recursive: true, force: false, errorOnExist: false });
  return report;
}

async function plan(src: string, dest: string, report: ScaffoldReport): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(src, entry.name);
    if (entry.isDirectory()) {
      await plan(child, join(dest, entry.name), report);
    } else if (await fileExists(join(dest, entry.name))) {
      report.present += 1;
    } else {
      report.created += 1;
    }
  }
}

function printReport(label: string, dir: string, report: ScaffoldReport): void {
  console.log(pc.green("init"), label, pc.dim(`→ ${dir}`));
  if (report.created === 0 && report.present > 0) {
    console.log(pc.dim("  nothing to create — all files present, untouched"));
  } else {
    console.log(
      pc.dim(`  created ${report.created} file(s)`),
      pc.dim(`(${report.present} already present, untouched)`),
    );
  }
}

/** Copy a skill's bundled `templates/` subtree into the project. Idempotent —
 * existing files are never overwritten. Monorepo-aware for `convention`: with
 * apps detected it asks (interactive TTY) how to scaffold — default every app
 * + root; non-TTY applies that default silently. `.flow/` is never created or
 * edited; reported when present. */
export async function init(opts: InitOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const src = templatesRoot(opts.skill);
  if (!(await fileExists(src))) {
    throw new Error(`skill "${opts.skill}" has no templates to init`);
  }
  const ask = opts.ask ?? readlineAsker;
  const interactive = opts.interactive ?? isInteractive();

  let appDirs: string[] = [];
  let rootOnly = false;

  if (opts.skill === "convention" && !opts.noApps) {
    appDirs = await detectWorkspaceApps(projectRoot);
    if (appDirs.length > 0 && interactive && !opts.yes) {
      const listing = appDirs.slice(0, 12).join(", ") + (appDirs.length > 12 ? ", …" : "");
      const choice = await askChoice(
        ask,
        `Monorepo detected (${appDirs.length} app(s): ${listing}). Scaffold conventions into?`,
        APP_CHOICES,
        "a",
      );
      if (choice === "r") appDirs = [];
      if (choice === "o") rootOnly = true;
    }
  }

  if (rootOnly) {
    console.log(pc.dim("root scaffold skipped (apps only)"));
  } else {
    printReport(opts.skill, projectRoot, await scaffold(src, projectRoot));
  }
  for (const app of appDirs) {
    printReport(
      `${opts.skill} (${app})`,
      join(projectRoot, app),
      await scaffold(src, join(projectRoot, app)),
    );
  }

  if (await fileExists(join(projectRoot, ".flow"))) {
    console.log(
      pc.dim("flow: .flow/ present — left untouched; skills read its guidance when present."),
    );
  }
}
