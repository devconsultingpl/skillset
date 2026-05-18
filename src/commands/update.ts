import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import { readState, upsertInstall, writeState } from "../core/state.js";
import { applyConfig } from "../core/template.js";
import type { ParsedSkill } from "../core/types.js";
import { targetFor } from "../targets/index.js";

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

/** Re-install every recorded skillset install from bundled sources. */
export async function update(): Promise<void> {
  let state = await readState();
  if (state.installs.length === 0) {
    console.log(pc.dim("nothing installed; nothing to update."));
    return;
  }

  for (const rec of [...state.installs]) {
    let skill: ParsedSkill;
    try {
      skill = applyConfigToSkill(await loadBundledSkill(rec.skill));
    } catch (err) {
      console.error(pc.yellow(`skip ${rec.skill}: not in bundle (${(err as Error).message})`));
      continue;
    }
    const target = targetFor(rec.agent);
    // Uninstall the prior artifacts then re-install with the same scope/mode.
    await target.uninstall(rec);
    const next = await target.install({
      skill,
      scope: rec.scope,
      mode: rec.mode,
      projectRoot: rec.projectPath ?? process.cwd(),
    });
    state = upsertInstall(state, next);
    console.log(
      pc.green("updated"),
      `${rec.skill} → ${rec.agent}`,
      pc.dim(`(${rec.mode}, ${rec.scope}) ${next.location}`),
    );
  }
  await writeState(state);
}
