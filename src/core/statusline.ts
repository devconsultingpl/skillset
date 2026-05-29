/** Shared no-clobber statusLine logic (plan 0017 decision 9). Claude Code and
 * Copilot CLI both store a *singular* `statusLine` object in a JSON settings
 * file, so neither may overwrite a user's own — only fill an empty slot or
 * refresh one we already own, and only remove one that is still ours. */

export const STATUSLINE_COMMAND = "skillset status --stdin-json";

interface StatusLine {
  type?: string;
  command?: string;
  [k: string]: unknown;
}

interface WithStatusLine {
  statusLine?: StatusLine;
  [k: string]: unknown;
}

/** Fill or refresh our statusLine; never clobber a user's own. */
export function addStatusLine<T extends WithStatusLine>(
  settings: T,
  command = STATUSLINE_COMMAND,
): { settings: T; installed: boolean } {
  const existing = settings.statusLine;
  if (existing && existing.command !== command) {
    return { settings, installed: false };
  }
  const next = structuredClone(settings);
  next.statusLine = { type: "command", command };
  return { settings: next, installed: true };
}

/** Remove the statusLine only if it is still the one skillset wrote. */
export function dropStatusLine<T extends WithStatusLine>(
  settings: T,
  command = STATUSLINE_COMMAND,
): T {
  if (settings.statusLine?.command !== command) return structuredClone(settings);
  const { statusLine: _drop, ...rest } = settings;
  void _drop;
  return structuredClone(rest) as T;
}
