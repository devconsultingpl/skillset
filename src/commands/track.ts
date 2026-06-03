import { resolveSessionKey, track } from "../core/active.js";
import { readState } from "../core/state.js";

/** Names + slugs of every skill skillset has installed (any agent/scope). The
 * indiscriminate writer surfaces (opencode plugin, pi extension, Copilot hook)
 * fire on *any* command/prompt, so they pass `--known-only` to drop anything
 * that isn't a skillset skill. We include both name and slug because trackers
 * receive the slash-command name typed by the user (the slug), while older
 * state records may only carry the skill name. */
async function installedSkills(): Promise<Set<string>> {
  const state = await readState();
  const keys = new Set<string>();
  for (const i of state.installs) {
    keys.add(i.skill);
    if (i.slug) keys.add(i.slug);
  }
  return keys;
}

/**
 * Record that a slash-mode skill toggled on or off for the current session.
 * Called by each agent's write surface (Claude/opencode command trailer, the
 * opencode plugin, the pi extension, the Copilot CLI hook).
 *
 * Defaults to "on": a bare `/skill` with no argument — or an un-interpolated
 * `$ARGUMENTS` that the shell expands to empty — records the skill as active
 * rather than corrupting state. Only an explicit "off" turns it off.
 *
 * With `knownOnly`, silently no-ops unless the skill is one skillset installed.
 */
export async function trackCmd(args: {
  skill: string;
  state?: string;
  session?: string;
  knownOnly?: boolean;
}): Promise<void> {
  if (args.knownOnly && !(await installedSkills()).has(args.skill)) return;
  const on = (args.state ?? "on").trim().toLowerCase() !== "off";
  await track(resolveSessionKey(args.session), args.skill, on);
}
