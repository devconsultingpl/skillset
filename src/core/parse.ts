import matter from "gray-matter";
import type { AgentFrontmatter, ParsedAgent, ParsedSkill, SkillFrontmatter } from "./types.js";

const REQUIRED_FIELDS: (keyof SkillFrontmatter)[] = ["name", "version", "description"];

const REQUIRED_AGENT_FIELDS: (keyof AgentFrontmatter)[] = ["name", "description"];

export function parseAgent(source: string): ParsedAgent {
  const parsed = matter(source);
  const fm = parsed.data as Partial<AgentFrontmatter>;

  for (const field of REQUIRED_AGENT_FIELDS) {
    if (!fm[field] || typeof fm[field] !== "string") {
      throw new Error(`agent frontmatter missing required string field: ${field}`);
    }
  }

  return {
    frontmatter: fm as AgentFrontmatter,
    body: parsed.content.trimStart(),
    source,
  };
}

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
