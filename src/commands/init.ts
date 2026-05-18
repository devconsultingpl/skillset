import { cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { templatesRoot } from "../core/bundle.js";
import { fileExists } from "../core/fs.js";

export interface InitOptions {
  skill: string;
  projectRoot?: string;
}

/** Copy a skill's bundled `templates/` subtree into the project. Idempotent —
 * existing files are never overwritten. */
export async function init(opts: InitOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const src = templatesRoot(opts.skill);
  if (!(await fileExists(src))) {
    throw new Error(`skill "${opts.skill}" has no templates to init`);
  }
  await cp(src, resolve(projectRoot), {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  console.log(pc.green("init"), opts.skill, pc.dim(`→ ${projectRoot}`));
  console.log(pc.dim(`(existing files left untouched; see ${join(projectRoot, "docs")})`));
}
