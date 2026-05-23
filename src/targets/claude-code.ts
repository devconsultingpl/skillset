import { rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, remove, upsert } from "../core/markers.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord } from "../core/types.js";

const HOOK_TAG = "# skillset:";

interface SessionStartEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

interface ClaudeSettings {
  hooks?: { SessionStart?: SessionStartEntry[] } & Record<string, unknown>;
  [k: string]: unknown;
}

function targetOverrides(skill: InstallContext["skill"]): Record<string, unknown> {
  return skill.frontmatter.targets?.["claude-code"] ?? {};
}

function renderSkillFile(ctx: InstallContext): string {
  const { name, description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  return compose({ name, description, ...overrides }, ctx.skill.body);
}

function renderCommandFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  // Commands use `description` only; allowed-tools etc. travel along if user added them.
  const { name: _omit, ...rest } = overrides as { name?: unknown };
  void _omit;
  return compose({ description, ...rest }, ctx.skill.body);
}

function hookCommand(skill: string): string {
  return `skillset emit ${skill} ${HOOK_TAG}${skill}`;
}

async function readSettings(path: string): Promise<ClaudeSettings> {
  const raw = await readMaybe(path);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    throw new Error(`failed to parse ${path}: ${(err as Error).message}`);
  }
}

async function writeSettings(path: string, settings: ClaudeSettings): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
}

function addHook(settings: ClaudeSettings, skill: string): ClaudeSettings {
  const next = structuredClone(settings);
  next.hooks = next.hooks ?? {};
  const list = next.hooks.SessionStart ?? [];
  const filtered = list.filter(
    (entry) => !entry.hooks.some((h) => h.command.includes(`${HOOK_TAG}${skill}`)),
  );
  filtered.push({
    matcher: "",
    hooks: [{ type: "command", command: hookCommand(skill) }],
  });
  next.hooks.SessionStart = filtered;
  return next;
}

function dropHook(settings: ClaudeSettings, skill: string): ClaudeSettings {
  if (!settings.hooks?.SessionStart) return structuredClone(settings);
  const remaining = settings.hooks.SessionStart.filter(
    (entry) => !entry.hooks.some((h) => h.command.includes(`${HOOK_TAG}${skill}`)),
  );
  // Rebuild settings from scratch, omitting empty hook subtrees so the final
  // JSON faithfully reflects what's still meaningful.
  const { hooks: prevHooks, ...rest } = settings;
  const { SessionStart: _, ...otherHooks } = prevHooks ?? {};
  void _;
  const nextHooks =
    remaining.length === 0 ? otherHooks : { ...otherHooks, SessionStart: remaining };
  if (Object.keys(nextHooks).length === 0) {
    return structuredClone(rest) as ClaudeSettings;
  }
  return { ...structuredClone(rest), hooks: nextHooks } as ClaudeSettings;
}

export const claudeCodeTarget: AgentTarget = {
  name: "claude-code",
  supportedModes: ["slash", "auto", "always"],

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
    const layout = layoutFor("claude-code");
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
      await writeAtomic(path, renderCommandFile(ctx));
      files.push(relative(installRoot, path));
    } else {
      // always: write skill file too (for emit fallback + discoverability),
      // then register a SessionStart hook in settings.json.
      const skillPath = layout.auto!(name, scope, projectRoot);
      await writeAtomic(skillPath, renderSkillFile(ctx));
      const settingsPath = layout.always(scope, projectRoot);
      const settings = await readSettings(settingsPath);
      await writeSettings(settingsPath, addHook(settings, name));
      installRoot = dirname(skillPath);
      files.push(relative(installRoot, skillPath));
      insertions.push(settingsPath);
    }

    return {
      skill: name,
      version: skill.frontmatter.version,
      agent: "claude-code",
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
    // Remove written files.
    for (const rel of record.files) {
      const path = `${record.location}/${rel}`;
      await rm(path, { force: true });
    }
    // For auto/always we wrote into <root>/<name>/SKILL.md — clean up the empty
    // skill dir if nothing else lives there.
    if (record.mode === "auto" || record.mode === "always") {
      await rm(record.location, { force: true, recursive: true });
    }
    // Strip our hook entry from settings.json for always mode.
    if (record.mode === "always" && record.insertions) {
      for (const settingsPath of record.insertions) {
        const settings = await readSettings(settingsPath);
        const next = dropHook(settings, record.skill);
        if (Object.keys(next).length === 0) {
          await rm(settingsPath, { force: true });
        } else {
          await writeSettings(settingsPath, next);
        }
      }
    }
  },

  async preview(ctx, record) {
    // slash → command file; auto/always → the SKILL.md file. The settings.json
    // hook (always mode) is generated deterministically, so it isn't compared.
    const next = ctx.mode === "slash" ? renderCommandFile(ctx) : renderSkillFile(ctx);
    const filePath = record.files[0] ? join(record.location, record.files[0]) : null;
    const current = filePath ? await readMaybe(filePath) : null;
    return { current, next };
  },
};

// Re-export markers helpers so tests can compose canonical inputs without
// reaching into core directly.
export const __markers = { upsert, remove, style: MD };
