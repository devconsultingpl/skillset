/** `always`-mode artifacts load every session, so body length is paid forever.
 * The installer warns above this many lines; users can override via env. */
export const ALWAYS_WARN_LINES_DEFAULT = 80;

export function alwaysWarnLines(): number {
  const raw = process.env.SKILLSET_ALWAYS_WARN_LINES;
  if (!raw) return ALWAYS_WARN_LINES_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : ALWAYS_WARN_LINES_DEFAULT;
}

export function bodyLineCount(body: string): number {
  const trimmed = body.replace(/\s+$/, "");
  if (trimmed === "") return 0;
  return trimmed.split("\n").length;
}
