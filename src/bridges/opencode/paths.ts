import { homedir } from "node:os";
import { join } from "node:path";
import type { ArtifactPathOptions, SkillDirectoryOptions } from "../../core/bridge.js";
import type { Scope } from "../../core/types.js";
import type { Layout } from "../_shared/paths.js";
import { resolveArtifactPath, resolveSkillDirectory } from "../_shared/paths.js";

/** Every path this harness reads, in one place. */
function base(scope: Scope, projectRoot: string): string {
  return scope === "global"
    ? join(homedir(), ".config", "opencode")
    : join(projectRoot, ".opencode");
}

export const layout: Layout = {
  slash(slug, scope, root) {
    return join(base(scope, root), "commands", `${slug}.md`);
  },
  auto(name, scope, root) {
    return join(base(scope, root), "skills", name, "SKILL.md");
  },
  always(scope, root) {
    if (scope === "global") return join(homedir(), ".config", "opencode", "AGENTS.md");
    return join(root, "AGENTS.md");
  },
};

export const artifactPath = (opts: ArtifactPathOptions): string =>
  resolveArtifactPath(layout, opts);
export function skillDirectory(opts: SkillDirectoryOptions): string | null {
  return resolveSkillDirectory(layout, opts);
}
