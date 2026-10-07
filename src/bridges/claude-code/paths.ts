import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ArtifactPathOptions, SkillDirectoryOptions } from "../../core/bridge.js";
import type { Scope } from "../../core/types.js";
import type { Layout } from "../_shared/paths.js";
import { resolveArtifactPath, resolveSkillDirectory } from "../_shared/paths.js";

/** Every path this harness reads, in one place. */
function base(scope: Scope, projectRoot: string): string {
  return scope === "global" ? join(homedir(), ".claude") : join(projectRoot, ".claude");
}

export const layout: Layout = {
  slash(slug, scope, root) {
    return join(base(scope, root), "commands", `${slug}.md`);
  },
  auto(name, scope, root) {
    return join(base(scope, root), "skills", name, "SKILL.md");
  },
  always(scope, root) {
    return join(base(scope, root), "settings.json");
  },
};

export const artifactPath = (opts: ArtifactPathOptions): string =>
  resolveArtifactPath(layout, opts);

/**
 * `auto` writes a skill directory — and so does `always`, which is **this
 * harness's own behaviour**, not a rule the core holds: it writes a skill file
 * beside the settings hook, so it has a directory for declared siblings to fill.
 * That is why the exception lives here rather than as a name test in the core.
 */
export function skillDirectory(opts: SkillDirectoryOptions): string | null {
  if (opts.mode !== "auto" && opts.mode !== "always") return null;
  if (!layout.auto) return null;
  return dirname(layout.auto(opts.name, opts.scope, opts.projectRoot));
}
