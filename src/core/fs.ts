import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiblingFile } from "./types.js";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readMaybe(path: string): Promise<string | null> {
  if (!(await fileExists(path))) return null;
  return readFile(path, "utf8");
}

export async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

/** Bytes of a file, or null when it is absent. Text reads go through
 * `readMaybe`; this one exists so a sibling is compared as bytes — a helper may
 * be a binary the renderer must never touch. */
export async function readMaybeBytes(path: string): Promise<Buffer | null> {
  if (!(await fileExists(path))) return null;
  return readFile(path);
}

/** Copy a source file verbatim — no rendering, no substitution. */
export async function copyAtomic(source: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
}

/**
 * Copy a skill's declared sibling files into its install directory, recording
 * each path relative to that directory. Used by every target that writes a
 * per-skill directory; the copy itself lives here so the four targets do not
 * each grow their own.
 */
export async function copySiblings(
  siblings: readonly SiblingFile[] | undefined,
  installRoot: string,
  into: string[],
): Promise<void> {
  for (const sibling of siblings ?? []) {
    await copyAtomic(sibling.source, join(installRoot, sibling.rel));
    into.push(sibling.rel);
  }
}
