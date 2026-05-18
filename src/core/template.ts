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
