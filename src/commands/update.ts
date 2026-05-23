import { join } from "node:path";
import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import { lineDiff } from "../core/diff.js";
import { isInteractive, readlineAsker, resolveDivergence } from "../core/prompt.js";
import { readState, upsertInstall, writeState } from "../core/state.js";
import type { InstallContext } from "../core/target.js";
import { applyConfig } from "../core/template.js";
import type { InstallRecord, ParsedSkill } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface UpdateOptions {
  /** Overwrite every install, including diverged ones, without prompting. */
  force?: boolean;
  /** Report planned actions per install; write nothing. */
  dryRun?: boolean;
  /** Non-interactively skip diverged installs; still rewrite untouched ones. */
  skipCustomized?: boolean;
}

function applyConfigToSkill(skill: ParsedSkill): ParsedSkill {
  const config = skill.frontmatter.config;
  if (!config || Object.keys(config).length === 0) return skill;
  return {
    ...skill,
    body: applyConfig(skill.body, config),
    frontmatter: {
      ...skill.frontmatter,
      description: applyConfig(skill.frontmatter.description, config),
    },
  };
}

/** Path of the artifact a divergence prompt should name, for display only. */
function displayPath(rec: InstallRecord): string {
  if (rec.files[0]) return join(rec.location, rec.files[0]);
  return rec.insertions?.[0] ?? rec.location;
}

function printDiff(current: string, next: string): void {
  console.log(pc.dim("  --- on disk / +++ bundle ---"));
  for (const line of lineDiff(current, next).split("\n")) {
    if (line.startsWith("- ")) console.log(pc.red(`  ${line}`));
    else if (line.startsWith("+ ")) console.log(pc.green(`  ${line}`));
    else console.log(pc.dim(`  ${line}`));
  }
}

/**
 * Re-sync every recorded install from bundled sources. Installs whose on-disk
 * content matches the bundle are rewritten silently. Diverged installs (local
 * edits) are protected: `--force` overwrites, `--skip-customized` and non-TTY
 * runs skip with a warning, and an interactive TTY prompts per install.
 */
export async function update(opts: UpdateOptions = {}): Promise<void> {
  let state = await readState();
  if (state.installs.length === 0) {
    console.log(pc.dim("nothing installed; nothing to update."));
    return;
  }

  const interactive = isInteractive();

  for (const rec of [...state.installs]) {
    let skill: ParsedSkill;
    try {
      skill = applyConfigToSkill(await loadBundledSkill(rec.skill));
    } catch (err) {
      console.error(pc.yellow(`skip ${rec.skill}: not in bundle (${(err as Error).message})`));
      continue;
    }

    const target = targetFor(rec.agent);
    const ctx: InstallContext = {
      skill,
      scope: rec.scope,
      mode: rec.mode,
      projectRoot: rec.projectPath ?? process.cwd(),
    };
    const label = `${rec.skill} → ${rec.agent} (${rec.mode}, ${rec.scope})`;

    const { current, next } = await target.preview(ctx, rec);
    const diverged = current !== null && current !== next;

    if (opts.dryRun) {
      if (!diverged) {
        console.log(pc.dim("up-to-date"), label);
      } else {
        const action = opts.force ? "overwrite" : "skip";
        console.log(pc.yellow("diverged"), label, pc.dim(`${displayPath(rec)} — would ${action}`));
      }
      continue;
    }

    if (diverged && !opts.force) {
      if (opts.skipCustomized || !interactive) {
        console.warn(
          pc.yellow("skip"),
          label,
          pc.dim(`${displayPath(rec)} has local edits (use --force to overwrite)`),
        );
        continue;
      }
      console.log(pc.yellow(`\n${label}`), pc.dim(`at ${displayPath(rec)}`), "has local edits.");
      const decision = await resolveDivergence(readlineAsker, () =>
        printDiff(current as string, next),
      );
      if (decision === "abort") {
        console.log(pc.dim("aborted; remaining installs left untouched."));
        break;
      }
      if (decision === "skip") {
        console.log(pc.dim("skipped"), label);
        continue;
      }
      // decision === "overwrite": fall through to rewrite.
    }

    await target.uninstall(rec);
    const nextRec = await target.install(ctx);
    state = upsertInstall(state, nextRec);
    console.log(
      diverged ? pc.green("overwrote") : pc.green("updated"),
      label,
      pc.dim(nextRec.location),
    );
  }

  if (!opts.dryRun) await writeState(state);
}
