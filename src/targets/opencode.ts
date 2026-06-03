import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { assetPath } from "../core/bundle.js";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, extract, remove, upsert } from "../core/markers.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord, Scope } from "../core/types.js";

function targetOverrides(skill: InstallContext["skill"]): Record<string, unknown> {
  return skill.frontmatter.targets?.opencode ?? {};
}

/** opencode plugin path: `.opencode/plugins/skillset.js` (local) or
 * `~/.config/opencode/plugins/skillset.js` (global). */
function pluginPath(scope: Scope, projectRoot: string): string {
  const base =
    scope === "global" ? join(homedir(), ".config", "opencode") : join(projectRoot, ".opencode");
  return join(base, "plugins", "skillset.js");
}

function renderSkillFile(ctx: InstallContext): string {
  const { name, description } = ctx.skill.frontmatter;
  return compose({ name, description, ...targetOverrides(ctx.skill) }, ctx.skill.body);
}

/** Only the status-reader command gets a shell trailer (a project-scoped read).
 * Tracking is owned by the plugin (`command.execute.before`), which is more
 * reliable than a per-command trailer and avoids a double-write race. */
function renderCommandFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  const { name: _omit, ...rest } = overrides as { name?: unknown };
  void _omit;
  if (ctx.mode !== "slash" || !ctx.skill.frontmatter.statusReader) {
    return compose({ description, ...rest }, ctx.skill.body);
  }
  return compose({ description, ...rest }, `${ctx.skill.body.trimEnd()}\n\n!\`skillset status\``);
}

export const opencodeTarget: AgentTarget = {
  name: "opencode",
  supportedModes: ["slash", "auto", "always"],

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
    const layout = layoutFor("opencode");
    const name = skill.frontmatter.name;
    const slug = (skill.frontmatter as { slug?: string }).slug ?? name;
    const files: string[] = [];
    const insertions: string[] = [];
    const assets: string[] = [];
    let installRoot: string;

    if (mode === "auto") {
      const path = layout.auto!(name, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderSkillFile(ctx));
      files.push(relative(installRoot, path));
    } else if (mode === "slash") {
      const path = layout.slash(slug, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderCommandFile(ctx));
      files.push(relative(installRoot, path));
      // The status-reader skill ships the tracking plugin (decision 8).
      if (skill.frontmatter.statusReader) {
        const dest = pluginPath(scope, projectRoot);
        await writeAtomic(
          dest,
          await readFile(assetPath("skillset-status", "opencode-plugin.js"), "utf8"),
        );
        assets.push(dest);
      }
    } else {
      // always: marker-wrapped block in AGENTS.md.
      const anchor = layout.always(scope, projectRoot);
      const existing = (await readMaybe(anchor)) ?? "";
      await writeAtomic(anchor, upsert(existing, name, ctx.skill.body, MD));
      installRoot = dirname(anchor);
      insertions.push(anchor);
    }

    return {
      skill: name,
      slug,
      version: skill.frontmatter.version,
      agent: "opencode",
      scope,
      mode,
      location: installRoot,
      files,
      insertions: insertions.length > 0 ? insertions : undefined,
      assets: assets.length > 0 ? assets : undefined,
      projectPath: scope === "local" ? projectRoot : undefined,
      installedAt: new Date().toISOString(),
    } satisfies InstallRecord;
  },

  async uninstall(record) {
    for (const rel of record.files) {
      await rm(`${record.location}/${rel}`, { force: true });
    }
    for (const asset of record.assets ?? []) {
      await rm(asset, { force: true });
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

  async preview(ctx, record) {
    if (ctx.mode === "always") {
      // Marker interior in AGENTS.md; user content outside is invisible.
      const anchor = record.insertions?.[0];
      const existing = anchor ? await readMaybe(anchor) : null;
      const current = existing ? extract(existing, record.skill, MD) : null;
      return { current, next: ctx.skill.body.trim() };
    }
    const next = ctx.mode === "slash" ? renderCommandFile(ctx) : renderSkillFile(ctx);
    const filePath = record.files[0] ? join(record.location, record.files[0]) : null;
    const current = filePath ? await readMaybe(filePath) : null;
    return { current, next };
  },
};
