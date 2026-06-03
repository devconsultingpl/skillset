import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { assetPath } from "../core/bundle.js";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, extract, remove, upsert } from "../core/markers.js";
import { STATUSLINE_COMMAND, addStatusLine, dropStatusLine } from "../core/statusline.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord } from "../core/types.js";

function targetOverrides(skill: InstallContext["skill"]): Record<string, unknown> {
  return skill.frontmatter.targets?.copilot ?? {};
}

// Copilot CLI config is user-global (`~/.copilot/`), distinct from the VS Code
// prompt files this target normally writes. The CLI hook + statusLine only ship
// on a global install, where writing under `~/.copilot/` isn't a surprise.
const copilotHome = () => join(homedir(), ".copilot");

async function readJsonSettings(path: string): Promise<Record<string, unknown>> {
  const raw = await readMaybe(path);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`failed to parse ${path}: ${(err as Error).message}`);
  }
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
    const assets: string[] = [];
    let statusLine: string | undefined;
    let statusLinePath: string | undefined;
    let installRoot: string;

    if (mode === "slash") {
      const path = layout.slash(slug, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderPromptFile(ctx));
      files.push(relative(installRoot, path));
      // The status-reader skill wires the Copilot CLI surface (global only).
      if (scope === "global" && skill.frontmatter.statusReader) {
        const hookDest = join(copilotHome(), "hooks", "skillset.json");
        await writeAtomic(
          hookDest,
          await readFile(assetPath("skillset-status", "copilot-hook.json"), "utf8"),
        );
        assets.push(hookDest);

        const settingsDest = join(copilotHome(), "settings.json");
        const { settings, installed } = addStatusLine(await readJsonSettings(settingsDest));
        if (installed) {
          await writeAtomic(settingsDest, `${JSON.stringify(settings, null, 2)}\n`);
          statusLine = STATUSLINE_COMMAND;
          statusLinePath = settingsDest;
        } else {
          console.error(
            "skillset: left your existing Copilot CLI statusLine untouched — run `skillset status` to see active skills.",
          );
        }
      }
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
      slug,
      version: skill.frontmatter.version,
      agent: "copilot",
      scope,
      mode,
      location: installRoot,
      files,
      insertions: insertions.length > 0 ? insertions : undefined,
      assets: assets.length > 0 ? assets : undefined,
      statusLine,
      statusLinePath,
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
    if (record.statusLine && record.statusLinePath) {
      const settings = await readJsonSettings(record.statusLinePath);
      const next = dropStatusLine(settings);
      if (Object.keys(next).length === 0) {
        await rm(record.statusLinePath, { force: true });
      } else {
        await writeAtomic(record.statusLinePath, `${JSON.stringify(next, null, 2)}\n`);
      }
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
