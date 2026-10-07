import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileExists } from "./fs.js";
import { parseAgent, parseSkill } from "./parse.js";
import type { ParsedAgent, ParsedSkill } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Directory holding bundled skill sources. Same shape in src/ (dev via tsx)
 * and dist/ (prod) thanks to scripts/copy-skills.mjs. */
export const skillsRoot = resolve(here, "..", "skills");

export const agentsRoot = resolve(here, "..", "agents");

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

export async function listBundledAgents(): Promise<string[]> {
  const entries = await readdir(agentsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

export async function loadBundledAgent(name: string): Promise<ParsedAgent> {
  const path = resolve(agentsRoot, `${name}.md`);
  if (!(await fileExists(path))) {
    throw new Error(`agent not found in bundle: ${name}`);
  }
  return parseAgent(await readFile(path, "utf8"));
}

/** Absolute path of a file shipped beside a skill's `SKILL.md` (a declared
 * sibling: helper, template, reference). Resolution only — nothing is read or
 * copied here, so a missing file surfaces as a declaration-coverage problem. */
export function skillSourcePath(skillName: string, rel: string): string {
  return resolve(skillsRoot, skillName, rel);
}

/** Path to a bundled executable artifact shipped alongside a skill — the editor
 * plugin, harness extension or hook config a skill installs as an asset. */
export function assetPath(skillName: string, file: string): string {
  return resolve(skillsRoot, skillName, "assets", file);
}
