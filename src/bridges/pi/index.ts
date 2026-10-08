import { readFile, rm } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import type { AgentInstallContext, Bridge, InstallContext } from "../../core/bridge.js";
import { assetPath } from "../../core/bundle.js";
import { compose } from "../../core/frontmatter.js";
import { copySiblings, readMaybe, writeAtomic } from "../../core/fs.js";
import { MD, extract, remove, upsert } from "../../core/markers.js";
import type { InstallRecord, Scope } from "../../core/types.js";
import { isAnchorMode } from "../../core/types.js";
import { agentPath, artifactPath, extensionPath, layout, skillDirectory } from "./paths.js";

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
  // pi substitutes `$@` (all invocation args) — without a placeholder, args are
  // dropped entirely, so every slash prompt gets a labeled argument slot. Empty
  // when invoked bare; carries e.g. `/sk-caveman off`, `/sk-commit-suggest fix auth`.
  const body = `${ctx.skill.body.trimEnd()}\n\nArguments: $@\n`;
  return compose({ description, ...rest }, body);
}

function renderAgentFile(ctx: AgentInstallContext): string {
  const { name, description } = ctx.agent.frontmatter;
  const overrides = ctx.agent.frontmatter.targets?.pi ?? {};
  return compose({ name, description, ...overrides }, ctx.agent.body);
}

export const piBridge: Bridge = {
  name: "pi",
  supportedModes: ["slash", "auto", "always", "context"],

  // What pi can carry, from the installed package's own docs (docs/skills.md,
  // docs/prompt-templates.md) and from what its loader returns. `contract` is
  // read from the installed file by FLOW's contract harvester rather than by pi
  // itself — declared here because that is where the review's gate has to travel
  // (0023 slice 2b). A prompt template reads `description` and `argument-hint`
  // only, and `name` is stripped on purpose: the filename is the command name.
  frontmatter: {
    expresses: {
      slash: ["description", "argument-hint"],
      auto: [
        "name",
        "description",
        "license",
        "compatibility",
        "metadata",
        "allowed-tools",
        "disable-model-invocation",
        "contract",
      ],
      // `always` writes a marker block into APPEND_SYSTEM.md: no frontmatter.
      always: [],
      // `context` writes a marker block into AGENTS.md: no frontmatter either.
      context: [],
    },
    native: [
      // pi's built-in slash commands (docs/slash-commands.md in the installed
      // package). Compacted: the `sk-` slug rule is what actually prevents a
      // collision, this is the namespace inventory behind it.
      ..."settings model thinking scoped-models login logout llama new resume name session".split(
        " ",
      ),
      ..."tree fork clone compact import copy export share bug trust".split(" "),
      ..."reload hotkeys changelog quit".split(" "),
    ],
  },

  async install(ctx) {
    const { skill, scope, mode, projectRoot } = ctx;
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
      // Declared sibling files land beside SKILL.md, verbatim (2a). The skill
      // directory is the destination a harness resolves relative paths against.
      await copySiblings(ctx.siblings, installRoot, files);
    } else if (mode === "slash") {
      const path = layout.slash(slug, scope, projectRoot);
      installRoot = dirname(path);
      await writeAtomic(path, renderPromptFile(ctx));
      files.push(relative(installRoot, path));
      // The status-reader skill ships the tracking + footer extension (decision 8).
      if (skill.frontmatter.statusReader) {
        const dest = extensionPath(scope, projectRoot);
        await writeAtomic(
          dest,
          await readFile(assetPath("skillset-status", "pi-extension.ts"), "utf8"),
        );
        assets.push(dest);
      }
    } else {
      // always / context: marker-wrapped block in a file the user also owns.
      const anchor = artifactPath({ mode, scope, slug, name, projectRoot });
      const existing = (await readMaybe(anchor)) ?? "";
      await writeAtomic(anchor, upsert(existing, name, ctx.skill.body, MD));
      installRoot = dirname(anchor);
      insertions.push(anchor);
    }

    return {
      skill: name,
      slug,
      version: skill.frontmatter.version,
      agent: "pi",
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
    if (isAnchorMode(record.mode) && record.insertions) {
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
    if (isAnchorMode(ctx.mode)) {
      // Marker interior in the anchor file; user content outside is invisible.
      const anchor = record.insertions?.[0];
      const existing = anchor ? await readMaybe(anchor) : null;
      const current = existing ? extract(existing, record.skill, MD) : null;
      return { current, next: ctx.skill.body.trim() };
    }
    const next = ctx.mode === "slash" ? renderPromptFile(ctx) : renderSkillFile(ctx);
    const filePath = record.files[0] ? join(record.location, record.files[0]) : null;
    const current = filePath ? await readMaybe(filePath) : null;
    return { current, next };
  },

  // The contract's path surface. Resolution only, from this bridge's own layout:
  // the core asks where an artifact goes, and never learns what a ".pi" is.
  artifactPath,
  skillDirectory,

  agents: {
    expresses: [
      "display_name",
      "description",
      "tools",
      "model",
      "thinking",
      "max_turns",
      "prompt_mode",
      "inherit_context",
      "run_in_background",
      "enabled",
    ],

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
        agent: "pi",
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
};
