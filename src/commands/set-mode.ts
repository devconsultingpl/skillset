import pc from "picocolors";
import { alwaysWarnLines, bodyLineCount } from "../core/body-size.js";
import { loadBundledSkill } from "../core/bundle.js";
import { loadDeclarations } from "../core/declarations.js";
import { readState, removeInstall, upsertInstall, writeState } from "../core/state.js";
import { applyConfigToSkill } from "../core/template.js";
import type { AgentName, Mode, Scope } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface SetModeOptions {
  skill: string;
  mode: Mode;
  agents?: AgentName[];
  scope?: Scope;
  projectRoot?: string;
}

export async function setMode(opts: SetModeOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  let state = await readState();

  const matches = state.installs.filter((rec) => {
    if (rec.skill !== opts.skill) return false;
    if (opts.agents && opts.agents.length > 0 && !opts.agents.includes(rec.agent)) return false;
    if (opts.scope && rec.scope !== opts.scope) return false;
    if (opts.scope === "local" && rec.projectPath !== projectRoot) return false;
    return true;
  });
  if (matches.length === 0) {
    console.error(pc.yellow("no matching installs to switch"));
    return;
  }

  const skill = applyConfigToSkill(await loadBundledSkill(opts.skill));
  // A mode switch re-installs the whole skill, siblings included, or switching
  // to `auto` would leave the helpers behind.
  const { siblings } = await loadDeclarations();
  const declaredSiblings = siblings[opts.skill] ?? [];

  if (opts.mode === "always") {
    const lines = bodyLineCount(skill.body);
    const limit = alwaysWarnLines();
    if (lines > limit) {
      console.error(
        pc.yellow(
          `warning: ${opts.skill} body is ${lines} lines (>${limit}); always-mode artifacts load every session. Consider slash/auto, or trim the body.`,
        ),
      );
    }
  }

  for (const rec of matches) {
    const target = targetFor(rec.agent);
    if (!target.supportedModes.includes(opts.mode)) {
      console.error(
        pc.yellow(
          `skip ${rec.agent}: mode "${opts.mode}" not supported (supported: ${target.supportedModes.join(", ")})`,
        ),
      );
      continue;
    }
    await target.uninstall(rec);
    // Mode is part of the install identity, so the record being replaced has to
    // go explicitly: an upsert would record the new mode *beside* the old one,
    // leaving a record whose artifact this loop just deleted.
    state = removeInstall(state, rec);
    const next = await target.install({
      skill,
      scope: rec.scope,
      mode: opts.mode,
      projectRoot: rec.projectPath ?? projectRoot,
      siblings: declaredSiblings,
    });
    state = upsertInstall(state, next);
    console.log(
      pc.green("set-mode"),
      `${rec.skill} → ${rec.agent}`,
      pc.dim(`(${rec.mode} → ${opts.mode})`),
    );
  }
  await writeState(state);
}
