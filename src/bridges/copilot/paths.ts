import { homedir } from "node:os";
import { join } from "node:path";
import type { ArtifactPathOptions, SkillDirectoryOptions } from "../../core/bridge.js";
import type { Scope } from "../../core/types.js";
import type { Layout } from "../_shared/paths.js";
import { resolveArtifactPath, resolveSkillDirectory } from "../_shared/paths.js";

/** Every path this harness reads, in one place. */
function base(scope: Scope, projectRoot: string): string {
  return scope === "global"
    ? join(homedir(), ".skillset", "copilot")
    : join(projectRoot, ".github");
}

export const layout: Layout = {
  // Prompt files live at .github/prompts/<slug>.prompt.md (repo-scoped). There
  // is no standard user-global location, so the global scope mirrors under
  // ~/.skillset/ and the user copies or symlinks into their editor settings.
  slash(slug, scope, root) {
    return join(base(scope, root), "prompts", `${slug}.prompt.md`);
  },
  // This harness has no auto-trigger concept — the install pipeline degrades to
  // `always`, and `skillDirectory` says so rather than the installer guessing.
  always(scope, root) {
    return scope === "global"
      ? join(homedir(), ".skillset", "copilot", "copilot-instructions.md")
      : join(root, ".github", "copilot-instructions.md");
  },
};

export const artifactPath = (opts: ArtifactPathOptions): string =>
  resolveArtifactPath(layout, opts);

/** No `auto` mode means no per-skill directory at all: prompts are single files
 * in a shared directory, and `always` appends to an instructions file. */
export function skillDirectory(_opts: SkillDirectoryOptions): string | null {
  return null;
}
