import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const cliPath = resolve(here, "..", "dist", "cli.js");

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function run(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
  opts: { input?: string } = {},
): SpawnSyncReturns<string> {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  // resolveSessionKey honors CLAUDE_CODE_SESSION_ID as a fallback. When tests
  // run inside Claude Code the dev's real session id leaks in via process.env,
  // making project-key-fallback assertions non-deterministic. Strip it unless
  // a test explicitly opts in by setting it in `env`.
  // biome-ignore lint: assigning `undefined` keeps the key (and on process.env coerces to the string "undefined"); the key must be absent so resolveSessionKey() falls through.
  if (!("CLAUDE_CODE_SESSION_ID" in env)) delete childEnv.CLAUDE_CODE_SESSION_ID;
  return spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: childEnv,
    input: opts.input,
  });
}

/**
 * Re-route HOME so state.json and global-scope installs land in our temp dir,
 * not the developer's real ~/.skillset (or ~/.claude, ~/.pi, etc.).
 */
export function sandboxEnv(home: string): NodeJS.ProcessEnv {
  return { HOME: home, USERPROFILE: home };
}

export interface Sandbox {
  projectRoot: string;
  home: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
}

export async function makeSandbox(prefix = "skillset"): Promise<Sandbox> {
  const projectRoot = await mkdtemp(join(tmpdir(), `${prefix}-proj-`));
  const home = await mkdtemp(join(tmpdir(), `${prefix}-home-`));
  return {
    projectRoot,
    home,
    env: sandboxEnv(home),
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    },
  };
}
