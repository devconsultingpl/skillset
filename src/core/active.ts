import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileExists } from "./fs.js";

/** Per-session record of which slash-mode skills are currently toggled on.
 * Invented state — the agents have no native concept of an "active skill"
 * (a slash invocation just injects body text). See plan 0017 / the
 * slash-as-modes ADR. */
export interface ActiveState {
  active: string[];
  updatedAt: string;
}

/** Directory holding per-session active-skill state files. */
export function activeDir(): string {
  return join(homedir(), ".skillset", "active");
}

/** A session key may come from an agent (a real session id) or be arbitrary.
 * Keep it to filename-safe bytes so it can never escape `activeDir()`. */
function sanitizeKey(key: string): string {
  const cleaned = key.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "default";
}

/** Stable short key for agents that expose no session id (opencode): scope the
 * state to the project root instead. */
export function projectKey(projectRoot: string): string {
  return `project-${createHash("sha256").update(projectRoot).digest("hex").slice(0, 16)}`;
}

/** Resolve the storage key: an explicit session id when present, else the
 * Claude Code session id from the env (its slash-trailer can't pass `--session`
 * because the permission gate rejects `${…}` in `!`-commands; see plan 0018),
 * else a project-scoped fallback derived from `cwd`. */
export function resolveSessionKey(explicit: string | undefined, cwd = process.cwd()): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromEnv = process.env.CLAUDE_CODE_SESSION_ID?.trim();
  if (fromEnv) return fromEnv;
  return projectKey(cwd);
}

export function activeFilePath(sessionKey: string, baseDir = activeDir()): string {
  return join(baseDir, `${sanitizeKey(sessionKey)}.json`);
}

export async function readActive(sessionKey: string, baseDir = activeDir()): Promise<ActiveState> {
  const path = activeFilePath(sessionKey, baseDir);
  if (!(await fileExists(path))) return { active: [], updatedAt: "" };
  const raw = await readFile(path, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveState>;
    return {
      active: Array.isArray(parsed.active)
        ? parsed.active.filter((s) => typeof s === "string")
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch (err) {
    throw new Error(`failed to read active state at ${path}: ${(err as Error).message}`);
  }
}

export async function writeActive(
  sessionKey: string,
  state: ActiveState,
  baseDir = activeDir(),
): Promise<void> {
  const path = activeFilePath(sessionKey, baseDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function addSkill(state: ActiveState, skill: string, now = new Date()): ActiveState {
  const active = state.active.includes(skill) ? state.active : [...state.active, skill];
  return { active, updatedAt: now.toISOString() };
}

export function removeSkill(state: ActiveState, skill: string, now = new Date()): ActiveState {
  return { active: state.active.filter((s) => s !== skill), updatedAt: now.toISOString() };
}

export function toggle(
  state: ActiveState,
  skill: string,
  on: boolean,
  now = new Date(),
): ActiveState {
  return on ? addSkill(state, skill, now) : removeSkill(state, skill, now);
}

/** Read → toggle → write. Returns the new state. */
export async function track(
  sessionKey: string,
  skill: string,
  on: boolean,
  baseDir = activeDir(),
): Promise<ActiveState> {
  const next = toggle(await readActive(sessionKey, baseDir), skill, on);
  await writeActive(sessionKey, next, baseDir);
  return next;
}

/** Wipe the active set for a session — used when the agent compacts or clears
 * the conversation (the skill bodies are gone, so the status must reset too). */
export async function clearActive(sessionKey: string, baseDir = activeDir()): Promise<void> {
  await rm(activeFilePath(sessionKey, baseDir), { force: true });
}
