/**
 * Wrap text in skillset begin/end markers so it can be safely removed later
 * without disturbing surrounding user content.
 *
 * Use `wrap` to produce a fresh block and `replace` to upsert (replace existing
 * block with the same skill name, or append if not present).
 */

const BEGIN = "skillset:begin";
const END = "skillset:end";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockRegex(skill: string, commentOpen: string, commentClose: string): RegExp {
  const open = `${escapeRe(commentOpen)}\\s*${BEGIN}\\s+${escapeRe(skill)}\\s*${escapeRe(commentClose)}`;
  const close = `${escapeRe(commentOpen)}\\s*${END}\\s+${escapeRe(skill)}\\s*${escapeRe(commentClose)}`;
  return new RegExp(`\\n?${open}[\\s\\S]*?${close}\\n?`, "g");
}

function interiorRegex(skill: string, commentOpen: string, commentClose: string): RegExp {
  const open = `${escapeRe(commentOpen)}\\s*${BEGIN}\\s+${escapeRe(skill)}\\s*${escapeRe(commentClose)}`;
  const close = `${escapeRe(commentOpen)}\\s*${END}\\s+${escapeRe(skill)}\\s*${escapeRe(commentClose)}`;
  return new RegExp(`${open}\\n([\\s\\S]*?)\\n${close}`);
}

export interface MarkerStyle {
  /** Opening comment delimiter (e.g. `<!--`, `//`). */
  open: string;
  /** Closing comment delimiter (e.g. `-->`, ``). Empty string for line comments. */
  close: string;
}

export const MD: MarkerStyle = { open: "<!--", close: "-->" };
export const JS: MarkerStyle = { open: "//", close: "" };

export function wrap(skill: string, body: string, style: MarkerStyle = MD): string {
  const open = `${style.open} ${BEGIN} ${skill} ${style.close}`.trimEnd();
  const close = `${style.open} ${END} ${skill} ${style.close}`.trimEnd();
  return `${open}\n${body.trim()}\n${close}\n`;
}

export function remove(haystack: string, skill: string, style: MarkerStyle = MD): string {
  return haystack.replace(blockRegex(skill, style.open, style.close), "");
}

/**
 * Return the interior of a skill's marker block (the bytes `wrap` placed between
 * begin/end — i.e. the trimmed body), or null if no such block is present.
 */
export function extract(haystack: string, skill: string, style: MarkerStyle = MD): string | null {
  const m = interiorRegex(skill, style.open, style.close).exec(haystack);
  return m ? m[1] : null;
}

export function upsert(
  haystack: string,
  skill: string,
  body: string,
  style: MarkerStyle = MD,
): string {
  const block = wrap(skill, body, style);
  const re = blockRegex(skill, style.open, style.close);
  if (re.test(haystack)) {
    return haystack.replace(re, `\n${block}`);
  }
  const sep = haystack.length === 0 || haystack.endsWith("\n") ? "" : "\n";
  return `${haystack}${sep}\n${block}`;
}
