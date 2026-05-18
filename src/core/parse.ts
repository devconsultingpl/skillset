import matter from "gray-matter";
import type { ParsedSkill, SkillFrontmatter } from "./types.js";

const REQUIRED_FIELDS: (keyof SkillFrontmatter)[] = ["name", "version", "description"];

export function parseSkill(source: string): ParsedSkill {
  const parsed = matter(source);
  const fm = parsed.data as Partial<SkillFrontmatter>;

  for (const field of REQUIRED_FIELDS) {
    if (!fm[field] || typeof fm[field] !== "string") {
      throw new Error(`skill frontmatter missing required string field: ${field}`);
    }
  }

  return {
    frontmatter: fm as SkillFrontmatter,
    body: parsed.content.trimStart(),
    source,
  };
}
