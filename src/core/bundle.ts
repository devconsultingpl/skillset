import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileExists } from "./fs.js";
import { parseSkill } from "./parse.js";
import type { ParsedSkill } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Directory holding bundled skill sources. Same shape in src/ (dev via tsx)
 * and dist/ (prod) thanks to scripts/copy-skills.mjs. */
export const skillsRoot = resolve(here, "..", "skills");

export async function listBundledSkills(): Promise<string[]> {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await fileExists(resolve(skillsRoot, entry.name, "SKILL.md"))) {
      result.push(entry.name);
    }
  }
  return result.sort();
}

export async function loadBundledSkill(name: string): Promise<ParsedSkill> {
  const path = resolve(skillsRoot, name, "SKILL.md");
  if (!(await fileExists(path))) {
    throw new Error(`skill not found in bundle: ${name}`);
  }
  return parseSkill(await readFile(path, "utf8"));
}

export function templatesRoot(skillName: string): string {
  return resolve(skillsRoot, skillName, "templates");
}
