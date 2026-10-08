import { dirname } from "node:path";
import type { ArtifactPathOptions, SkillDirectoryOptions } from "../../core/bridge.js";
import type { Scope } from "../../core/types.js";

/**
 * The shape every bridge's `paths.ts` returns, plus the two resolutions that are
 * the same for all of them.
 *
 * A layout is one path per (mode, scope): `slash` is the command/prompt file,
 * `auto` the skill directory's `SKILL.md` (absent where the harness has no such
 * mode), `always` the anchor file that gets a marker block.
 *
 * What each bridge supplies is the *paths*; what is shared is how they are
 * selected. A bridge whose `skillDirectory` differs from the default — because
 * its `always` mode also writes a skill directory, or because it has no `auto`
 * at all — overrides that one function and inherits the rest.
 */
export interface Layout {
  slash(slug: string, scope: Scope, projectRoot: string): string;
  auto?(name: string, scope: Scope, projectRoot: string): string;
  always(scope: Scope, projectRoot: string): string;
  context?(scope: Scope, projectRoot: string): string;
}

/** Resolve the artifact path for one (mode, scope). */
export function resolveArtifactPath(layout: Layout, opts: ArtifactPathOptions): string {
  switch (opts.mode) {
    case "slash":
      return layout.slash(opts.slug, opts.scope, opts.projectRoot);
    case "auto":
      if (!layout.auto) throw new Error(`this harness does not support mode "auto"`);
      return layout.auto(opts.name, opts.scope, opts.projectRoot);
    case "always":
      return layout.always(opts.scope, opts.projectRoot);
    case "context":
      if (!layout.context) throw new Error(`this harness does not support mode "context"`);
      return layout.context(opts.scope, opts.projectRoot);
  }
}

/** The default rule: only `auto` writes a per-skill directory, so declared
 * sibling files have somewhere to go there and nowhere else. */
export function resolveSkillDirectory(layout: Layout, opts: SkillDirectoryOptions): string | null {
  if (opts.mode !== "auto" || !layout.auto) return null;
  return dirname(layout.auto(opts.name, opts.scope, opts.projectRoot));
}
