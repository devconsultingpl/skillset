import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Where **skillset itself** keeps things. Harness locations are not here: each
 * harness's paths belong to its bridge (`src/bridges/<harness>/`), reached
 * through the `Bridge` contract, so this file has no harness name in it.
 */

/** Path of skillset's own state file (~/.skillset/state.json). */
export function stateFilePath(): string {
  return join(homedir(), ".skillset", "state.json");
}

/**
 * Path of the suggestion queue (~/.skillset/suggestions.jsonl). One file for
 * every project: a session outside this repository appends through
 * `skillset suggest`, and a session working here reads and clears it.
 */
export function suggestionsFilePath(): string {
  return join(homedir(), ".skillset", "suggestions.jsonl");
}

/**
 * Path of a project's own install declarations (`<root>/.skillset/config.json`),
 * read when skillset runs inside that project. It declares **local** installs
 * only: a project may add installs for itself, never for a home.
 */
export function projectDeclarationsPath(projectRoot: string): string {
  return join(resolve(projectRoot), ".skillset", "config.json");
}

/**
 * Path of the repository-level install declarations (`skillset.config.json`).
 * Resolved next to the bundle root, so it is the package root in both `src/`
 * (dev) and `dist/` (installed).
 */
export function declarationsFilePath(): string {
  // A test or CI run can point at a scratch declarations file instead; the same
  // seam `SKILLSET_ALWAYS_WARN_LINES` uses for the same reason. Without it the
  // path is fixed next to the bundle, in both `src/` and `dist/`.
  const override = process.env.SKILLSET_CONFIG?.trim();
  if (override) return resolve(override);
  return resolve(here, "..", "..", "skillset.config.json");
}
