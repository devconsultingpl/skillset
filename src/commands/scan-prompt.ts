import { resolveSessionKey, track } from "../core/active.js";
import { readState } from "../core/state.js";

const SLASH_TOKEN = /(?:^|\s)\/([a-z][a-z0-9-]*)/gi;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Copilot CLI write surface. The `userPromptSubmitted` hook pipes in a JSON
 * payload `{ sessionId, prompt, ... }`. Copilot CLI has no custom slash
 * commands, but skills are invoked by writing `/skill-name` *in the prompt*,
 * so we scan the raw prompt for `/<token>`s and mark each installed skill on.
 * On-only: the CLI has no `/skill off` convention.
 */
export async function scanPromptCmd(): Promise<void> {
  const raw = (await readStdin()).trim();
  if (!raw) return;
  let payload: { sessionId?: unknown; session_id?: unknown; prompt?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!prompt) return;
  const sessionId =
    (typeof payload.sessionId === "string" && payload.sessionId) ||
    (typeof payload.session_id === "string" && payload.session_id) ||
    undefined;

  const known = new Set((await readState()).installs.map((i) => i.skill));
  const key = resolveSessionKey(sessionId);
  const seen = new Set<string>();
  for (const m of prompt.matchAll(SLASH_TOKEN)) {
    const skill = m[1];
    if (skill === "skillset-status" || seen.has(skill) || !known.has(skill)) continue;
    seen.add(skill);
    await track(key, skill, true);
  }
}
