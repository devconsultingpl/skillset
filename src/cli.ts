#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { emit } from "./commands/emit.js";
import { init } from "./commands/init.js";
import { install, parseAgentArg, parseModeArg } from "./commands/install.js";
import { list } from "./commands/list.js";
import { setMode } from "./commands/set-mode.js";
import { uninstall } from "./commands/uninstall.js";
import { update } from "./commands/update.js";
import type { Scope } from "./core/types.js";

const program = new Command();

function scopeOf(opts: { global?: boolean; local?: boolean }): Scope {
  if (opts.global && opts.local) {
    throw new Error("--global and --local are mutually exclusive");
  }
  return opts.global ? "global" : "local";
}

program
  .name("skillset")
  .description("Install agent skills across Claude Code, pi, opencode, and Copilot.")
  .version("0.1.0-dev");

program
  .command("install")
  .description("Install one or more skills into one or more agents.")
  .argument("<skills...>", "skill name(s)")
  .requiredOption(
    "--agent <agents>",
    'comma-separated agent list, or "all" (claude-code, pi, opencode, copilot)',
  )
  .option("--mode <mode>", "invocation mode: slash | auto | always", "slash")
  .option("--global", "install at the user-global level")
  .option("--local", "install into the current project (default)")
  .option(
    "--force",
    "replace any prior install for the same skill+agent+scope, even if its mode differs",
  )
  .action(async (skills: string[], opts) => {
    await install({
      skills,
      agents: parseAgentArg(opts.agent),
      mode: parseModeArg(opts.mode),
      scope: scopeOf(opts),
      force: Boolean(opts.force),
    });
  });

program
  .command("uninstall")
  .description("Uninstall one or more skills.")
  .argument("<skills...>", "skill name(s)")
  .option("--agent <agents>", 'comma-separated agent list, or "all"')
  .option("--global", "match only global installs")
  .option("--local", "match only local installs in the current project")
  .action(async (skills: string[], opts) => {
    await uninstall({
      skills,
      agents: opts.agent ? parseAgentArg(opts.agent) : undefined,
      scope: opts.global ? "global" : opts.local ? "local" : undefined,
    });
  });

program
  .command("list")
  .description("List bundled and installed skills.")
  .action(async () => {
    await list();
  });

program
  .command("update")
  .description("Re-sync every installed skill from the current bundle.")
  .option("--force", "overwrite every install, including ones with local edits, without prompting")
  .option("--dry-run", "report what would happen per install; write nothing")
  .option("--skip-customized", "non-interactively skip installs with local edits")
  .action(async (opts) => {
    await update({
      force: Boolean(opts.force),
      dryRun: Boolean(opts.dryRun),
      skipCustomized: Boolean(opts.skipCustomized),
    });
  });

program
  .command("set-mode")
  .description("Switch an installed skill's invocation mode.")
  .argument("<skill>", "skill name")
  .argument("<mode>", "slash | auto | always")
  .option("--agent <agents>", 'comma-separated agent list, or "all"')
  .option("--global", "match only global installs")
  .option("--local", "match only local installs")
  .action(async (skill: string, mode: string, opts) => {
    await setMode({
      skill,
      mode: parseModeArg(mode),
      agents: opts.agent ? parseAgentArg(opts.agent) : undefined,
      scope: opts.global ? "global" : opts.local ? "local" : undefined,
    });
  });

program
  .command("init")
  .description("Scaffold a skill's templates into the current project (idempotent).")
  .argument("<skill>", "skill name with bundled templates (e.g. convention)")
  .action(async (skill: string) => {
    await init({ skill });
  });

program
  .command("emit")
  .description("Emit a bundled skill's body as a SessionStart-hook JSON payload.")
  .argument("<skill>", "skill name")
  // Tail args are accepted so the hook command can include a `# skillset:<name>`
  // marker without commander rejecting it.
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (skill: string) => {
    await emit(skill);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red("error:"), err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
