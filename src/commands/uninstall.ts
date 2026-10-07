import pc from "picocolors";
import { requireBridge } from "../bridges/index.js";
import { readState, removeInstall, writeState } from "../core/state.js";
import type { BridgeName, Scope } from "../core/types.js";

export interface UninstallOptions {
  skills: string[];
  /** When empty, uninstall from every agent the skill is installed for. */
  agents?: BridgeName[];
  /** When undefined, uninstall from any scope. */
  scope?: Scope;
  projectRoot?: string;
}

export async function uninstall(opts: UninstallOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  let state = await readState();

  for (const skill of opts.skills) {
    const matches = state.installs.filter((rec) => {
      if (rec.skill !== skill) return false;
      if (opts.agents && opts.agents.length > 0 && !opts.agents.includes(rec.agent)) return false;
      if (opts.scope && rec.scope !== opts.scope) return false;
      if (opts.scope === "local" && rec.projectPath !== projectRoot) return false;
      return true;
    });

    if (matches.length === 0) {
      console.error(pc.yellow(`no installs found for ${skill} (with given filters)`));
      continue;
    }

    for (const rec of matches) {
      const target = requireBridge(rec.agent);
      if (rec.kind === "agent") {
        if (!target.agents) {
          console.error(
            pc.red("error"),
            `${rec.skill} ← ${rec.agent}: this harness cannot install agent definitions (no renderer)`,
          );
          continue;
        }
        await target.agents.uninstall(rec);
      } else {
        await target.uninstall(rec);
      }
      state = removeInstall(state, rec);
      console.log(
        pc.green("uninstalled"),
        `${skill} ← ${rec.agent}`,
        pc.dim(`(${rec.mode}, ${rec.scope}) ${rec.location}`),
      );
    }
  }
  await writeState(state);
}
