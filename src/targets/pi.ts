import { rm } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, remove, upsert } from "../core/markers.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord } from "../core/types.js";

function targetOverrides(skill: InstallContext["skill"]): Record<string, unknown> {
  return skill.frontmatter.targets?.pi ?? {};
}

function renderSkillFile(ctx: InstallContext): string {
  const { name, description } = ctx.skill.frontmatter;
  return compose({ name, description, ...targetOverrides(ctx.skill) }, ctx.skill.body);
}

function renderPromptFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  // pi prompt template frontmatter: `description`, `argument-hint`. Strip `name`
  // if present so the filename governs the slash command name.
  const { name: _omit, ...rest } = overrides as { name?: unknown };
  void _omit;
  return compose({ description, ...rest }, ctx.skill.body);
}

export const piTarget: AgentTarget = {
  name: "pi",
  supportedModes: ["slash", "auto", "always"],

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
    const layout = layoutFor("pi");
    const name = skill.frontmatter.name;
    const slug = (skill.frontmatter as { slug?: string }).slug ?? name;
    const files: string[] = [];
    const insertions: string[] = [];
    let installRoot: string;

    if (mode === "auto") {
      const path = layout.auto!(name, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderSkillFile(ctx));
      files.push(relative(installRoot, path));
    } else if (mode === "slash") {
      const path = layout.slash(slug, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderPromptFile(ctx));
      files.push(relative(installRoot, path));
    } else {
      // always: marker-wrapped append to APPEND_SYSTEM.md (no separate skill file).
      const anchor = layout.always(scope, projectRoot);
      const existing = (await readMaybe(anchor)) ?? "";
      await writeAtomic(anchor, upsert(existing, name, ctx.skill.body, MD));
      installRoot = dirname(anchor);
      insertions.push(anchor);
    }

    return {
      skill: name,
      version: skill.frontmatter.version,
      agent: "pi",
      scope,
      mode,
      location: installRoot,
      files,
      insertions: insertions.length > 0 ? insertions : undefined,
      projectPath: scope === "local" ? projectRoot : undefined,
      installedAt: new Date().toISOString(),
    } satisfies InstallRecord;
  },

  async uninstall(record) {
    for (const rel of record.files) {
      await rm(`${record.location}/${rel}`, { force: true });
    }
    if (record.mode === "auto") {
      await rm(record.location, { force: true, recursive: true });
    }
    if (record.mode === "always" && record.insertions) {
      for (const anchor of record.insertions) {
        const existing = (await readMaybe(anchor)) ?? "";
        const next = remove(existing, record.skill, MD).trimEnd();
        if (next.length === 0) {
          await rm(anchor, { force: true });
        } else {
          await writeAtomic(anchor, `${next}\n`);
        }
      }
    }
  },
};
