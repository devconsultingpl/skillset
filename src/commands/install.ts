import pc from "picocolors";
import { loadBundledSkill } from "../core/bundle.js";
import { parseSkill } from "../core/parse.js";
import { readState, upsertInstall, writeState } from "../core/state.js";
import { applyConfig } from "../core/template.js";
import type { AgentName, Mode, ParsedSkill, Scope } from "../core/types.js";
import { AGENTS, MODES } from "../core/types.js";
import { targetFor } from "../targets/index.js";

export interface InstallOptions {
  skills: string[];
  agents: AgentName[];
  mode: Mode;
  scope: Scope;
  projectRoot?: string;
  /** Configurable values that override frontmatter.config keys. */
  configOverrides?: Record<string, unknown>;
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

function applyConfigToSkill(skill: ParsedSkill, overrides?: Record<string, unknown>): ParsedSkill {
  const effective = { ...(skill.frontmatter.config ?? {}), ...(overrides ?? {}) };
  if (Object.keys(effective).length === 0) return skill;
  return {
    ...skill,
    body: applyConfig(skill.body, effective),
    // Also propagate into description (visible to agents auto-loading skills).
    frontmatter: {
      ...skill.frontmatter,
      description: applyConfig(skill.frontmatter.description, effective),
      config: effective,
    },
  };
}

export async function install(opts: InstallOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();

  let state = await readState();
  for (const skillName of opts.skills) {
    const raw = await loadBundledSkill(skillName);
    const skill = applyConfigToSkill(raw, opts.configOverrides);
    for (const agent of opts.agents) {
      const target = targetFor(agent);
      if (!target.supportedModes.includes(opts.mode)) {
        console.error(
          pc.yellow(
            `skipping ${skillName} → ${agent}: mode "${opts.mode}" not supported (supported: ${target.supportedModes.join(", ")})`,
          ),
        );
        continue;
      }
      const record = await target.install({
        skill,
        scope: opts.scope,
        mode: opts.mode,
        projectRoot,
      });
      state = upsertInstall(state, record);
      console.log(
        pc.green("installed"),
        `${skillName} → ${agent}`,
        pc.dim(`(${opts.mode}, ${opts.scope}) ${record.location}`),
      );
    }
  }
  await writeState(state);
}
