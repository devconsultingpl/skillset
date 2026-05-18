import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import { readState, upsertInstall, writeState } from "../core/state.js";
import { applyConfig } from "../core/template.js";
import type { AgentName, Mode, ParsedSkill, Scope } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface SetModeOptions {
  skill: string;
  mode: Mode;
  agents?: AgentName[];
  scope?: Scope;
  projectRoot?: string;
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
    const next = await target.install({
      skill,
      scope: rec.scope,
      mode: opts.mode,
      projectRoot: rec.projectPath ?? projectRoot,
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
