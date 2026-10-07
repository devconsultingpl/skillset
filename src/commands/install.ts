import pc from "picocolors";
import { alwaysWarnLines, bodyLineCount } from "../core/body-size.js";
import { loadBundledSkill } from "../core/bundle.js";
import { classifyInstall, declaredModes, loadDeclarations } from "../core/declarations.js";
import { matchInstall, readState, upsertInstall, writeState } from "../core/state.js";
import { applyConfigToSkill } from "../core/template.js";
import type { AgentName, Mode, ParsedSkill, Scope } from "../core/types.js";
import { AGENTS, MODES } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface InstallOptions {
  skills: string[];
  agents: AgentName[];
  /** Omitted means "use the repository declaration" for this skill and agent. */
  mode?: Mode;
  scope: Scope;
  projectRoot?: string;
  /** Configurable values that override frontmatter.config keys. */
  configOverrides?: Record<string, unknown>;
  /** If true, replace any prior install for the same (skill, agent, scope, mode), including a foreign destination. */
  force?: boolean;
}

/**
 * Resolve the mode for one (skill, agent, scope): an explicit `--mode` wins,
 * otherwise the repository declaration decides. A skill that declares two modes
 * for the same agent (the deliberate slash+auto setup, ADR 0005) is ambiguous
 * without a flag, so it asks instead of guessing.
 */
async function resolveMode(
  skill: string,
  agent: AgentName,
  opts: InstallOptions,
): Promise<Mode | null> {
  if (opts.mode) return opts.mode;
  const { declarations } = await loadDeclarations();
  const modes = declaredModes(declarations, skill, agent, opts.scope);
  if (modes.length === 1) return modes[0] ?? null;
  if (modes.length === 0) {
    console.error(
      pc.red("error"),
      `${skill} → ${agent} declares no ${opts.scope} install; pass --mode`,
    );
    return null;
  }
  console.error(
    pc.red("error"),
    `${skill} → ${agent} declares ${modes.join(" and ")}; pass --mode <${modes.join("|")}>`,
  );
  return null;
}

function parseList<T extends string>(input: string, allowed: readonly T[]): T[] {
  const seen = new Set<T>();
  for (const raw of input.split(",")) {
    const item = raw.trim();
    if (!item) continue;
    if (!(allowed as readonly string[]).includes(item)) {
      throw new Error(`unknown value: ${item} (allowed: ${allowed.join(", ")})`);
    }
    seen.add(item as T);
  }
  if (seen.size === 0) {
    throw new Error(`no values supplied (allowed: ${allowed.join(", ")})`);
  }
  return [...seen];
}

export function parseAgentArg(arg: string): AgentName[] {
  if (arg === "all") return [...AGENTS];
  return parseList(arg, AGENTS);
}

export function parseModeArg(arg: string): Mode {
  if (!(MODES as readonly string[]).includes(arg)) {
    throw new Error(`unknown mode: ${arg} (allowed: ${MODES.join(", ")})`);
  }
  return arg as Mode;
}

function warnIfBodyLarge(body: string, skillName: string): void {
  const lines = bodyLineCount(body);
  const limit = alwaysWarnLines();
  if (lines > limit) {
    console.error(
      pc.yellow(
        `warning: ${skillName} body is ${lines} lines (>${limit}); always-mode artifacts load every session. Consider slash/auto, or trim the body.`,
      ),
    );
  }
}

export async function install(opts: InstallOptions): Promise<number> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const projectPath = opts.scope === "local" ? projectRoot : undefined;
  let failures = 0;

  let state = await readState();
  for (const skillName of opts.skills) {
    const raw = await loadBundledSkill(skillName);
    const skill = applyConfigToSkill(raw, opts.configOverrides);
    for (const agent of opts.agents) {
      const mode = await resolveMode(skillName, agent, opts);
      if (mode === null) continue;
      if (mode === "always") warnIfBodyLarge(skill.body, skillName);
      const target = targetFor(agent);
      if (!target.supportedModes.includes(mode)) {
        console.error(
          pc.yellow(
            `skipping ${skillName} → ${agent}: mode "${mode}" not supported (supported: ${target.supportedModes.join(", ")})`,
          ),
        );
        continue;
      }

      const key = { skill: skillName, agent, scope: opts.scope, mode, projectPath };
      const prior = state.installs.find((r) => matchInstall(r, key));
      if (!opts.force) {
        // The identity now includes the mode, so an unrecorded destination is
        // somebody else's file — or an artifact this repository once wrote
        // without recording (ADR 0005). Classify before writing: adopt silently
        // only when the bytes are exactly ours.
        const classified = await classifyInstall(
          {
            skill: skillName,
            agent,
            mode,
            scope: opts.scope,
            ...(projectPath ? { projectPath } : {}),
          },
          state,
        );
        if (classified.status === "foreign") {
          failures += 1;
          console.error(
            pc.red("refusing"),
            `${skillName} → ${agent} (${mode}, ${opts.scope}): ${classified.path ?? "destination"} exists and was not written by skillset (pass --force to replace)`,
          );
          continue;
        }
      }
      if (prior) {
        const { current, next } = await target.preview(
          { skill, scope: opts.scope, mode, projectRoot },
          prior,
        );
        if (current !== null && current !== next && !opts.force) {
          console.error(
            pc.yellow("warning"),
            `${skillName} → ${agent} (${mode}, ${opts.scope}) has local edits; overwriting from source`,
          );
        }
      }

      const record = await target.install({
        skill,
        scope: opts.scope,
        mode,
        projectRoot,
      });
      state = upsertInstall(state, record);
      console.log(
        pc.green("installed"),
        `${skillName} → ${agent}`,
        pc.dim(`(${mode}, ${opts.scope}) ${record.location}`),
      );
    }
  }
  await writeState(state);
  return failures;
}
