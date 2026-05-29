import { clearActive, resolveSessionKey } from "../core/active.js";
import { sessionFromStdin } from "./status.js";

/**
 * Clear the active slash-skill set for a session. Wired to each agent's
 * compact/clear signal (Claude `SessionStart` clear|compact, Copilot
 * `preCompact`, the opencode plugin's `session.compacted`, the pi extension's
 * `session_compact`/`session_shutdown`) — once the conversation is summarized
 * or wiped, the skill bodies are gone, so the status must reset too.
 *
 * Reads the session id from `--session`, else a `session_id` stdin payload
 * (`--stdin-json`), else falls back to the project key.
 */
export async function resetCmd(opts: { session?: string; stdinJson?: boolean }): Promise<void> {
  const explicit = opts.stdinJson ? (opts.session ?? (await sessionFromStdin())) : opts.session;
  await clearActive(resolveSessionKey(explicit));
}
