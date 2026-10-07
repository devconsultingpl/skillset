import { join } from "node:path";
import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import { classifySiblings, loadDeclarations } from "../core/declarations.js";
import { lineDiff } from "../core/diff.js";
import { skillDirectoryFor } from "../core/locations.js";
import { isInteractive, readlineAsker, resolveDivergence } from "../core/prompt.js";
import { readState, upsertInstall, writeState } from "../core/state.js";
import type { InstallContext } from "../core/target.js";
import { applyConfigToSkill } from "../core/template.js";
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
  // Declared sibling files are copied, not rendered, so `preview` cannot see
  // them; a helper the user edited is divergence all the same.
  const { siblings } = await loadDeclarations();

  for (const rec of [...state.installs]) {
    let skill: ParsedSkill;
    try {
      skill = applyConfigToSkill(await loadBundledSkill(rec.skill));
    } catch (err) {
      console.error(pc.yellow(`skip ${rec.skill}: not in bundle (${(err as Error).message})`));
      continue;
    }

    const target = targetFor(rec.agent);
    const declared = siblings[rec.skill] ?? [];
    const ctx: InstallContext = {
      skill,
      scope: rec.scope,
      mode: rec.mode,
      projectRoot: rec.projectPath ?? process.cwd(),
      siblings: declared,
    };
    const label = `${rec.skill} → ${rec.agent} (${rec.mode}, ${rec.scope})`;

    const directory = skillDirectoryFor({
      agent: rec.agent,
      mode: rec.mode,
      name: skill.frontmatter.name,
      scope: rec.scope,
      projectRoot: ctx.projectRoot,
    });
    const siblingStates =
      directory && declared.length > 0
        ? await classifySiblings(declared, directory, new Set(rec.files))
        : [];
    const siblingDrift = siblingStates.filter((state) => state.status === "drifted");

    const { current, next } = await target.preview(ctx, rec);
    const primaryDiverged = current !== null && current !== next;
    const diverged = primaryDiverged || siblingDrift.length > 0;
    // What a prompt names: the primary artifact when it moved, otherwise the
    // sibling files that did.
    const divergedWhat = primaryDiverged
      ? [displayPath(rec)]
      : siblingDrift.map((state) => state.path);

    if (opts.dryRun) {
      if (!diverged) {
        console.log(pc.dim("up-to-date"), label);
      } else {
        const action = opts.force ? "overwrite" : "skip";
        console.log(
          pc.yellow("diverged"),
          label,
          pc.dim(`${divergedWhat.join(", ")} — would ${action}`),
        );
      }
      continue;
    }

    if (diverged && !opts.force) {
      if (opts.skipCustomized || !interactive) {
        console.warn(
          pc.yellow("skip"),
          label,
          pc.dim(`${divergedWhat.join(", ")} has local edits (use --force to overwrite)`),
        );
        continue;
      }
      console.log(
        pc.yellow(`\n${label}`),
        pc.dim(`at ${divergedWhat.join(", ")}`),
        "has local edits.",
      );
      const decision = await resolveDivergence(readlineAsker, () => {
        if (primaryDiverged) {
          printDiff(current as string, next);
          return;
        }
        const first = siblingDrift[0];
        if (first?.currentBytes != null && first.nextBytes !== undefined) {
          printDiff(first.currentBytes, first.nextBytes);
        }
      });
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
