import { rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, extract, remove, upsert } from "../core/markers.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord } from "../core/types.js";

function targetOverrides(skill: InstallContext["skill"]): Record<string, unknown> {
  return skill.frontmatter.targets?.copilot ?? {};
}

function renderPromptFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  // VS Code Copilot prompt files (.prompt.md) accept: mode, description, tools.
  // Default mode to "agent" when caller didn't specify.
  const fields: Record<string, unknown> = { mode: "agent", description, ...overrides };
  return compose(fields, ctx.skill.body);
}

export const copilotTarget: AgentTarget = {
  name: "copilot",
  // Copilot has no model-driven auto-trigger concept — only slash + always.
  supportedModes: ["slash", "always"],

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
    if (mode === "auto") {
      throw new Error("copilot does not support mode 'auto'. Use 'slash' or 'always' instead.");
    }
    const layout = layoutFor("copilot");
    const name = skill.frontmatter.name;
    const slug = (skill.frontmatter as { slug?: string }).slug ?? name;
    const files: string[] = [];
    const insertions: string[] = [];
    let installRoot: string;

    if (mode === "slash") {
      const path = layout.slash(slug, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderPromptFile(ctx));
      files.push(relative(installRoot, path));
    } else {
      // always: marker-wrapped block in .github/copilot-instructions.md.
      const anchor = layout.always(scope, projectRoot);
      const existing = (await readMaybe(anchor)) ?? "";
      await writeAtomic(anchor, upsert(existing, name, ctx.skill.body, MD));
      installRoot = dirname(anchor);
      insertions.push(anchor);
    }

    return {
      skill: name,
      version: skill.frontmatter.version,
      agent: "copilot",
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

  async preview(ctx, record) {
    if (ctx.mode === "always") {
      // Marker interior in .github/copilot-instructions.md.
      const anchor = record.insertions?.[0];
      const existing = anchor ? await readMaybe(anchor) : null;
      const current = existing ? extract(existing, record.skill, MD) : null;
      return { current, next: ctx.skill.body.trim() };
    }
    // copilot only supports slash + always; slash writes a .prompt.md file.
    const next = renderPromptFile(ctx);
    const filePath = record.files[0] ? join(record.location, record.files[0]) : null;
    const current = filePath ? await readMaybe(filePath) : null;
    return { current, next };
  },
};
