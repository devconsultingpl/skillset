import { rm } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import type { AgentInstallContext, Bridge, InstallContext } from "../../core/bridge.js";
import { compose } from "../../core/frontmatter.js";
import { copySiblings, readMaybe, writeAtomic } from "../../core/fs.js";
import { MD, remove, upsert } from "../../core/markers.js";
import type { InstallRecord } from "../../core/types.js";
import { isAnchorMode } from "../../core/types.js";
import { STATUSLINE_COMMAND, addStatusLine, dropStatusLine } from "../_shared/settings.js";
import { agentPath, artifactPath, layout, skillDirectory } from "./paths.js";

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

function renderAgentFile(ctx: AgentInstallContext): string {
  const { name, description } = ctx.agent.frontmatter;
  const overrides = ctx.agent.frontmatter.targets?.["claude-code"] ?? {};
  return compose({ name, description, ...overrides }, ctx.agent.body);
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

/** The pattern that pre-approves every `!`skillset …` trailer this target
 * appends. It is the target's own claim on `allowed-tools`, not a default: with
 * no pattern matching it, Claude Code's permission gate rejects the trailer. */
const SKILLSET_PATTERN = "Bash(skillset *)";

/** Merge, never replace: one field has two owners, and a plain spread let the
 * skill's value delete the pattern above — the trailer's own pre-approval, gone
 * silently (0023 open question (b)). Target pattern first; unknown shapes are
 * handed on for the frontmatter renderer to accept or refuse. */
function mergeAllowedTools(declared: unknown): unknown {
  if (declared === undefined || declared === null) return SKILLSET_PATTERN;
  if (typeof declared === "string") {
    return declared.includes(SKILLSET_PATTERN) ? declared : `${SKILLSET_PATTERN} ${declared}`;
  }
  if (Array.isArray(declared)) {
    return declared.includes(SKILLSET_PATTERN) ? declared : [SKILLSET_PATTERN, ...declared];
  }
  return declared;
}

function renderCommandFile(ctx: InstallContext): string {
  const { description } = ctx.skill.frontmatter;
  const overrides = targetOverrides(ctx.skill);
  // Commands use `description` only; other fields travel along if user added
  // them — except `allowed-tools`, which is overwritten by the merged value.
  const { name: _omit, ...rest } = overrides as { name?: unknown; [key: string]: unknown };
  void _omit;
  const slug = ctx.skill.frontmatter.slug ?? ctx.skill.frontmatter.name;
  const trailer = slashTrailer(ctx, slug);
  if (!trailer) return compose({ description, ...rest }, ctx.skill.body);
  // Pre-approve the skillset call so invoking the command never prompts for Bash.
  const frontmatter = {
    description,
    ...rest,
    "allowed-tools": mergeAllowedTools(rest["allowed-tools"]),
  };
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

/** The skill frontmatter Claude Code 2.1.286 reads, in the order its reference
 * documents. The Agent Skills spec fields are the subset other tools accept. */
const CLAUDE_SKILL_FIELDS = [
  "name",
  "description",
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "background",
  "hooks",
  "paths",
  "shell",
  "metadata",
  "license",
  "compatibility",
];

/** A file in `.claude/commands/` accepts the same fields except `name` — the
 * filename is the command name — and `paths`, which is skill-only. */
const CLAUDE_COMMAND_FIELDS = CLAUDE_SKILL_FIELDS.filter((f) => f !== "name" && f !== "paths");

export const claudeCodeBridge: Bridge = {
  name: "claude-code",
  supportedModes: ["slash", "auto", "always"],

  // From Claude Code 2.1.286's own frontmatter reference
  // (docs.claude.com/en/docs/claude-code/skills, fetched 2026-10-07). `always`
  // writes a SessionStart hook into settings.json, so it carries no frontmatter.
  frontmatter: {
    expresses: {
      slash: CLAUDE_COMMAND_FIELDS,
      auto: CLAUDE_SKILL_FIELDS,
      always: [],
    },
    // The bundled skills, plus `review` — a same-named user skill replaces a
    // bundled skill but *not* its alias, so the alias is what an install can
    // still shadow. From the same page; the `sk-` slug rule is what keeps ours
    // clear of all of them.
    native:
      "code-review,review,verify,simplify,debug,doctor,run,run-skill-generator,batch,loop,claude-api,workflow-authoring".split(
        ",",
      ),
  },

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
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
      // Declared sibling files land beside SKILL.md, verbatim (2a). Kept in step
      // with `always` below, which writes into the same directory.
      await copySiblings(ctx.siblings, installRoot, files);
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
      installRoot = dirname(skillPath);
      await writeAtomic(skillPath, renderSkillFile(ctx));
      files.push(relative(installRoot, skillPath));
      await copySiblings(ctx.siblings, installRoot, files);
      const settingsPath = layout.always(scope, projectRoot);
      const settings = await readSettings(settingsPath);
      await writeSettings(settingsPath, addHook(settings, name));
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
    // Strip our hook entry from settings.json for anchor modes.
    if (isAnchorMode(record.mode) && record.insertions) {
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

  artifactPath,
  skillDirectory,

  agents: {
    expresses: [
      "name",
      "description",
      "tools",
      "disallowedTools",
      "model",
      "effort",
      "permissionMode",
      "mcpServers",
      "hooks",
      "maxTurns",
      "skills",
      "initialPrompt",
      "memory",
      "background",
      "isolation",
      "color",
    ],
    consequence: {
      tools: "an agent artifact with no `tools` line resolves to every tool",
    },
    required: ["tools"],

    path: agentPath,

    async install(ctx) {
      const name = ctx.agent.frontmatter.name;
      const path = agentPath({
        name,
        scope: ctx.scope,
        projectRoot: ctx.projectRoot,
      });
      await writeAtomic(path, renderAgentFile(ctx));
      return {
        skill: name,
        kind: "agent",
        version: "",
        agent: "claude-code",
        scope: ctx.scope,
        mode: "auto",
        location: dirname(path),
        files: [basename(path)],
        projectPath: ctx.scope === "local" ? ctx.projectRoot : undefined,
        installedAt: new Date().toISOString(),
      } satisfies InstallRecord;
    },

    async uninstall(record) {
      for (const rel of record.files) {
        await rm(join(record.location, rel), { force: true });
      }
    },

    async preview(ctx, record) {
      const next = renderAgentFile(ctx);
      const filePath = record.files[0] ? join(record.location, record.files[0]) : null;
      const current = filePath ? await readMaybe(filePath) : null;
      return { current, next };
    },
  },
  /** This harness hands a session id to its hook children through the
   * environment; the variable's name is this bridge's business, so the core asks
   * instead of reading the environment itself. */
  sessionKeyFromEnv() {
    return process.env.CLAUDE_CODE_SESSION_ID?.trim() || undefined;
  },
};

// Re-export markers helpers so tests can compose canonical inputs without
// reaching into core directly.
export const __markers = { upsert, remove, style: MD };
