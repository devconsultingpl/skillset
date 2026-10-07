/** Tiny YAML-frontmatter renderer for a restricted subset (strings, numbers,
 * booleans, flat arrays of strings, and nested mappings of those). We don't pull
 * a full YAML serializer to keep deps small.
 *
 * Nested mappings exist because a harness field can be one: a skill's
 * `contract:` block is an object another tool parses, and it is the only reason
 * a workflow gate can read `blockers_count` (0023 slice 2b).
 * Arrays of mappings are still refused — nothing needs them, and a hand-rolled
 * renderer should refuse what it has not been tested against. */
export function renderFrontmatter(fields: Record<string, unknown>): string {
  return `---\n${renderMapping(fields, 0).join("\n")}\n---\n`;
}

function renderMapping(fields: Record<string, unknown>, indent: number): string[] {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const scalar = renderScalar(value);
    if (scalar !== null) {
      lines.push(`${pad}${key}: ${scalar}`);
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = renderMapping(value as Record<string, unknown>, indent + 1);
      if (nested.length === 0) {
        lines.push(`${pad}${key}: {}`);
        continue;
      }
      lines.push(`${pad}${key}:`);
      lines.push(...nested);
      continue;
    }
    throw new Error(
      `unsupported value type for frontmatter key ${key}: ${
        Array.isArray(value) ? "array (only flat arrays of strings are supported)" : typeof value
      }`,
    );
  }
  return lines;
}

/** Everything that renders on one line; `null` means "not a scalar". */
function renderScalar(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string")) {
      return `[${value.map((v) => quoteIfNeeded(v as string)).join(", ")}]`;
    }
    return null;
  }
  switch (typeof value) {
    case "string":
      return quoteIfNeeded(value);
    case "number":
    case "boolean":
      return String(value);
    default:
      return null;
  }
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
