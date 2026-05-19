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
): SpawnSyncReturns<string> {
  return spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
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
