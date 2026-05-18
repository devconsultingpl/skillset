import { loadBundledSkill } from "../core/bundle.js";

/** Hook entrypoint for claude-code `always` mode. Reads bundled skill body and
 * emits it wrapped in the JSON shape Claude Code expects on SessionStart. */
export async function emit(skill: string): Promise<void> {
  const parsed = await loadBundledSkill(skill);
  const payload = { additionalContext: parsed.body };
  // Hooks read stdout. Use console.log so a trailing newline is included.
  console.log(JSON.stringify(payload));
}
