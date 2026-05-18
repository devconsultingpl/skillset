import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stateFilePath } from "./locations.js";
import type { InstallRecord, SkillsetState } from "./types.js";

const EMPTY: SkillsetState = { version: 1, installs: [] };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readState(path = stateFilePath()): Promise<SkillsetState> {
  if (!(await exists(path))) return structuredClone(EMPTY);
  const raw = await readFile(path, "utf8");
  try {
    const parsed = JSON.parse(raw) as SkillsetState;
    if (parsed.version !== 1) {
      throw new Error(`unsupported state version: ${parsed.version}`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`failed to read state at ${path}: ${(err as Error).message}`);
  }
}

export async function writeState(state: SkillsetState, path = stateFilePath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function matchInstall(
  a: Pick<InstallRecord, "skill" | "agent" | "scope" | "projectPath">,
  b: Pick<InstallRecord, "skill" | "agent" | "scope" | "projectPath">,
): boolean {
  return (
    a.skill === b.skill &&
    a.agent === b.agent &&
    a.scope === b.scope &&
    (a.projectPath ?? null) === (b.projectPath ?? null)
  );
}

export function upsertInstall(state: SkillsetState, record: InstallRecord): SkillsetState {
  const installs = state.installs.filter((existing) => !matchInstall(existing, record));
  installs.push(record);
  return { ...state, installs };
}

export function removeInstall(
  state: SkillsetState,
  key: Pick<InstallRecord, "skill" | "agent" | "scope" | "projectPath">,
): SkillsetState {
  return { ...state, installs: state.installs.filter((i) => !matchInstall(i, key)) };
}
