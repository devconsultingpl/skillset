import { readActive, resolveSessionKey } from "../core/active.js";

/** Claude Code (and Copilot CLI) feed a statusLine command — and SessionStart/
 * PreCompact hooks — a JSON blob on stdin that carries `session_id`. Pull it
 * out so a statusline or reset hook can scope to the right session. */
export async function sessionFromStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  try {
    // Claude Code uses snake_case `session_id`; Copilot CLI hooks use camelCase
    // `sessionId`. Accept either so one reader serves both.
    const parsed = JSON.parse(raw) as { session_id?: unknown; sessionId?: unknown };
    if (typeof parsed.session_id === "string") return parsed.session_id;
    if (typeof parsed.sessionId === "string") return parsed.sessionId;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Print the slash-mode skills currently active for a session, one compact
 * line that serves both the `/skillset-status` command and the statusline. */
export async function statusCmd(opts: { session?: string; stdinJson?: boolean }): Promise<void> {
  const explicit = opts.stdinJson ? (opts.session ?? (await sessionFromStdin())) : opts.session;
  const state = await readActive(resolveSessionKey(explicit));
  const skills = [...state.active].sort();
  console.log(skills.length > 0 ? `skills: ${skills.join(" ")}` : "skills: (none)");
}
