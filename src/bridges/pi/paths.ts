import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AgentArtifactOptions,
  ArtifactPathOptions,
  SkillDirectoryOptions,
} from "../../core/bridge.js";
import type { Scope } from "../../core/types.js";
import type { Layout } from "../_shared/paths.js";
import { resolveArtifactPath, resolveSkillDirectory } from "../_shared/paths.js";

/** Every path this harness reads, in one place. */
function base(scope: Scope, projectRoot: string): string {
  return scope === "global" ? join(homedir(), ".pi", "agent") : join(projectRoot, ".pi");
}

export const layout: Layout = {
  slash(slug, scope, root) {
    return join(base(scope, root), "prompts", `${slug}.md`);
  },
  auto(name, scope, root) {
    return join(base(scope, root), "skills", name, "SKILL.md");
  },
  always(scope, root) {
    return join(base(scope, root), "APPEND_SYSTEM.md");
  },
  // The context file is not a `.pi/` file: pi loads `AGENTS.md` from the working
  // directory and its parents, so the local one sits in the project root.
  context(scope, root) {
    return scope === "global" ? join(base("global", root), "AGENTS.md") : join(root, "AGENTS.md");
  },
};

export const artifactPath = (opts: ArtifactPathOptions): string =>
  resolveArtifactPath(layout, opts);
export function skillDirectory(opts: SkillDirectoryOptions): string | null {
  return resolveSkillDirectory(layout, opts);
}

/** pi extension path: `.pi/extensions/skillset.ts` (local) or
 * `~/.pi/agent/extensions/skillset.ts` (global). */
export function extensionPath(scope: Scope, projectRoot: string): string {
  return join(base(scope, projectRoot), "extensions", "skillset.ts");
}

export function agentPath(opts: AgentArtifactOptions): string {
  return join(base(opts.scope, opts.projectRoot), "agents", `${opts.name}.md`);
}
