import pc from "picocolors";
import { listBundledSkills } from "../core/bundle.js";
import { readState } from "../core/state.js";

export async function list(): Promise<void> {
  const [state, available] = await Promise.all([readState(), listBundledSkills()]);

  console.log(pc.bold("available skills (bundled):"));
  for (const name of available) {
    console.log(`  - ${name}`);
  }

  console.log();
  console.log(pc.bold("installed:"));
  if (state.installs.length === 0) {
    console.log(pc.dim("  (none)"));
    return;
  }
  for (const rec of state.installs) {
    const where = rec.scope === "local" ? rec.projectPath : "global";
    console.log(
      `  - ${rec.skill} @ ${rec.version} → ${rec.agent} ${pc.dim(`(${rec.mode}, ${rec.scope})`)} ${pc.dim(where ?? "")}`,
    );
  }
}
