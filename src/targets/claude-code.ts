import { rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compose } from "../core/frontmatter.js";
import { readMaybe, writeAtomic } from "../core/fs.js";
import { layoutFor } from "../core/locations.js";
import { MD, remove, upsert } from "../core/markers.js";
import { STATUSLINE_COMMAND, addStatusLine, dropStatusLine } from "../core/statusline.js";
import type { AgentTarget, InstallContext } from "../core/target.js";
import type { InstallRecord } from "../core/types.js";

const HOOK_TAG = "# skillset:";

interface SessionStartEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

interface ClaudeSettings {
  hooks?: { SessionStart?: SessionStartEntry[] } & Record<string, unknown>;
  statusLine?: { type?: string; command?: string; [k: string]: unknown };
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

/** Write-on-invoke trailer for a slash command: invoking the skill records its
 * own on/off state (or, for the status reader, prints the active set). Returns
 * null for non-slash modes — tracking is slash-only (plan 0017 decision 1).
 *
 * The command MUST NOT contain shell expansion (`${…}`): Claude Code's
 * permission gate rejects any `!`-command with expansion, so it would never
 * match `allowed-tools: Bash(skillset *)` and the command would be blocked.
 * `skillset` reads `CLAUDE_CODE_SESSION_ID` from the env in-process instead
 * (see `resolveSessionKey`, plan 0018).
 *
 * We deliberately do NOT forward `$ARGUMENTS`. Claude Code substitutes
 * `$ARGUMENTS` as raw text into this backticked command — any backtick or
 * newline in the user's slash args closes the outer backticks and breaks the
 * permission-gate parser before the command runs. Dropping the placeholder
 * costs the `/skill off` toggle (a bare invocation defaults to "on"); off is
 * still reachable via `/clear`, `/compact`, or `skillset reset`. */
function slashTrailer(ctx: InstallContext, slug: string): string | null {
  if (ctx.mode !== "slash") return null;
  const cmd = ctx.skill.frontmatter.statusReader ? "skillset status" : `skillset track ${slug}`;
  return `!\`${cmd}\``;
}

function renderCommandFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  // Commands use `description` only; allowed-tools etc. travel along if user added them.
  const { name: _omit, ...rest } = overrides as { name?: unknown };
  void _omit;
  const slug = ctx.skill.frontmatter.slug ?? ctx.skill.frontmatter.name;
  const trailer = slashTrailer(ctx, slug);
  if (!trailer) return compose({ description, ...rest }, ctx.skill.body);
  // Pre-approve the skillset call so invoking the command never prompts for Bash.
  const frontmatter = { description, "allowed-tools": "Bash(skillset *)", ...rest };
  return compose(frontmatter, `${ctx.skill.body.trimEnd()}\n\n${trailer}`);
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

// A SessionStart entry is identified for removal by a `# skillset:…` tag in its
// command string. `tag` distinguishes the per-skill emit hooks (always mode)
// from the single reset hook (status feature).
function upsertSessionStart(
  settings: ClaudeSettings,
  tag: string,
  matcher: string,
  command: string,
): ClaudeSettings {
  const next = structuredClone(settings);
  next.hooks = next.hooks ?? {};
  const list = next.hooks.SessionStart ?? [];
  const filtered = list.filter((entry) => !entry.hooks.some((h) => h.command.includes(tag)));
  filtered.push({ matcher, hooks: [{ type: "command", command }] });
  next.hooks.SessionStart = filtered;
  return next;
}

function removeSessionStart(settings: ClaudeSettings, tag: string): ClaudeSettings {
  if (!settings.hooks?.SessionStart) return structuredClone(settings);
  const remaining = settings.hooks.SessionStart.filter(
    (entry) => !entry.hooks.some((h) => h.command.includes(tag)),
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

const addHook = (settings: ClaudeSettings, skill: string) =>
  upsertSessionStart(settings, `${HOOK_TAG}${skill}`, "", hookCommand(skill));
const dropHook = (settings: ClaudeSettings, skill: string) =>
  removeSessionStart(settings, `${HOOK_TAG}${skill}`);

// Reset hook: clears the active set after `/clear` or `/compact` (both fire
// SessionStart, with source clear|compact and session_id on stdin). Installed
// with the status-reader skill.
const RESET_TAG = "# skillset:reset";
const addResetHook = (settings: ClaudeSettings) =>
  upsertSessionStart(
    settings,
    RESET_TAG,
    "clear|compact",
    `skillset reset --stdin-json ${RESET_TAG}`,
  );
const dropResetHook = (settings: ClaudeSettings) => removeSessionStart(settings, RESET_TAG);

export const claudeCodeTarget: AgentTarget = {
  name: "claude-code",
  supportedModes: ["slash", "auto", "always"],

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
    const layout = layoutFor("claude-code");
    const name = skill.frontmatter.name;
    const slug = skill.frontmatter.slug ?? name;
    const files: string[] = [];
    const insertions: string[] = [];
    let statusLine: string | undefined;
    let statusLinePath: string | undefined;

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
      // The status-reader skill wires the statusLine indicator (decision 9) plus
      // a SessionStart hook that resets the active set on /clear or /compact.
      if (skill.frontmatter.statusReader) {
        const settingsPath = layout.always(scope, projectRoot);
        const withReset = addResetHook(await readSettings(settingsPath));
        const { settings, installed } = addStatusLine(withReset);
        await writeSettings(settingsPath, settings);
        statusLinePath = settingsPath; // reset hook lives here too — clean up on uninstall
        if (installed) {
          statusLine = STATUSLINE_COMMAND;
        } else {
          console.error(
            "skillset: left your existing statusLine untouched — run `skillset status` or add it to your statusline script to show active skills.",
          );
        }
      }
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
      slug,
      version: skill.frontmatter.version,
      agent: "claude-code",
      scope,
      mode,
      location: installRoot,
      files,
      insertions: insertions.length > 0 ? insertions : undefined,
      statusLine,
      statusLinePath,
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
    // Remove the status-reader's settings edits: the reset hook (by tag) and our
    // statusLine (only if it's still ours, decision 9). Both are no-ops if absent.
    if (record.statusLinePath) {
      const settings = await readSettings(record.statusLinePath);
      const next = dropStatusLine(dropResetHook(settings));
      if (Object.keys(next).length === 0) {
        await rm(record.statusLinePath, { force: true });
      } else {
        await writeSettings(record.statusLinePath, next);
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
