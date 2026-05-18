/** Tiny YAML-frontmatter renderer for a restricted subset (strings, numbers,
 * booleans, flat arrays of strings). We don't pull a full YAML serializer to
 * keep deps small. */
export function renderFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v === "string")) {
        const rendered = value.map((v) => quoteIfNeeded(v as string)).join(", ");
        lines.push(`${key}: [${rendered}]`);
      } else {
        throw new Error(`unsupported array element type for frontmatter key ${key}`);
      }
      continue;
    }
    switch (typeof value) {
      case "string":
        lines.push(`${key}: ${quoteIfNeeded(value)}`);
        break;
      case "number":
      case "boolean":
        lines.push(`${key}: ${value}`);
        break;
      default:
        throw new Error(`unsupported value type for frontmatter key ${key}: ${typeof value}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function quoteIfNeeded(value: string): string {
  // Quote when YAML special chars or leading/trailing spaces are present.
  // eslint-disable-next-line no-control-regex
  if (/[:#&*!|>'"%@`{}\[\],]|^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export function compose(frontmatter: Record<string, unknown>, body: string): string {
  return `${renderFrontmatter(frontmatter)}\n${body.trimEnd()}\n`;
}
