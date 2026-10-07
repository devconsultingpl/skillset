import type { ParsedSkill } from "./types.js";

/** Substitute `{{key}}` occurrences in `body` with values from `config`.
 * Unknown placeholders are left intact so they're visible at runtime instead
 * of silently disappearing. Values are coerced via String(). */
export function applyConfig(body: string, config?: Record<string, unknown>): string {
  if (!config) return body;
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in config)) return match;
    return String(config[key]);
  });
}

/**
 * A skill with its config placeholders substituted, as every install must write
 * it. Shared by `install`, `update` and drift classification: a comparison that
 * renders the raw bundle instead reports a correctly configured file as
 * `drifted` and would "repair" it back to its placeholders.
 */
export function applyConfigToSkill(
  skill: ParsedSkill,
  overrides?: Record<string, unknown>,
): ParsedSkill {
  const effective = { ...(skill.frontmatter.config ?? {}), ...(overrides ?? {}) };
  if (Object.keys(effective).length === 0) return skill;
  return {
    ...skill,
    body: applyConfig(skill.body, effective),
    // Also propagate into description (visible to agents auto-loading skills).
    frontmatter: {
      ...skill.frontmatter,
      description: applyConfig(skill.frontmatter.description, effective),
      config: effective,
    },
  };
}
