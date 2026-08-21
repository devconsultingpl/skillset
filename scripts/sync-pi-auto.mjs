// Re-sync the pi auto-mode skills that skillset can't record: a slash install is
// already recorded for the same (skill, agent, scope), and the reinstall guard
// blocks recording `auto` alongside it (see docs/decisions/0005). Renders the
// exact pi `auto` projection ({name, description, ...targets.pi} + body) into
// ~/.pi/agent/skills/<name>/SKILL.md. Run `npm run build` first — the bundle
// is read from dist/skills/.
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadBundledSkill } from "../dist/core/bundle.js";
import { compose } from "../dist/core/frontmatter.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(homedir(), ".pi", "agent", "skills");
const names = ["architect", "caveman", "commit-suggestion", "ponytail"];

for (const name of names) {
  const skill = await loadBundledSkill(name);
  const { name: slug, description } = skill.frontmatter;
  const overrides = skill.frontmatter.targets?.pi ?? {};
  const body = compose({ name: slug, description, ...overrides }, skill.body);
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), body);
  console.log(`synced pi auto skill → ${join(dir, "SKILL.md")}`);
}
