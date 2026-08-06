import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileExists } from "./fs.js";

/**
 * Language project markers — a directory carrying any of these at its root is
 * a project/app. Exact markers match by name; suffix markers (e.g. `*.asd`)
 * match by file extension.
 *
 * Language-agnostic on purpose: skillset users work in JS/TS, Java, Kotlin,
 * Common Lisp, Clojure, and more — and monorepos may mix languages per app.
 */
const EXACT_MARKERS = new Set([
  "package.json", // JS/TS — npm, yarn, pnpm, bun
  "pom.xml", // Java — Maven
  "build.gradle", // Java/Kotlin — Gradle (Groovy DSL)
  "build.gradle.kts", // Kotlin/Java — Gradle (Kotlin DSL)
  "deps.edn", // Clojure — tools.deps / CLI
  "project.clj", // Clojure — Leiningen
  "build.clj", // Clojure — tools.build
  "build.sbt", // Scala — sbt
  "Cargo.toml", // Rust
  "go.mod", // Go
  "pyproject.toml", // Python — PEP 621
  "setup.py", // Python — legacy
  "Gemfile", // Ruby
  "composer.json", // PHP
  "CMakeLists.txt", // C/C++ — CMake
  "meson.build", // C/C++ — Meson
  "Package.swift", // Swift
  "mix.exs", // Elixir
  "QLOT", // Common Lisp — Qlot
]);

const SUFFIX_MARKERS = [".asd", ".cabal", ".csproj", ".sln"];

/** Non-dot directories never walked — dependency trees and build artifacts.
 * Hidden (dot-)directories are skipped outright; `.flow` is both hidden and
 * out of scope by policy (flow's shadow tree is never scanned or touched). */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "target",
  "build",
  "dist",
  "out",
  "bin",
  "obj",
  "venv",
  "vendor",
  "__pycache__",
  "coverage",
  "Pods",
]);

async function markersIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (EXACT_MARKERS.has(entry.name) || SUFFIX_MARKERS.some((s) => entry.name.endsWith(s))) {
      found.push(entry.name);
    }
  }
  return found;
}

async function readJsonWorkspaces(projectRoot: string): Promise<string[] | null> {
  const pkg = join(projectRoot, "package.json");
  if (!(await fileExists(pkg))) return null;
  try {
    const json = JSON.parse(await readFile(pkg, "utf8")) as { workspaces?: unknown };
    if (Array.isArray(json.workspaces)) {
      return json.workspaces.filter((p): p is string => typeof p === "string");
    }
    const packages = (json.workspaces as { packages?: unknown } | undefined)?.packages;
    if (Array.isArray(packages)) {
      return packages.filter((p): p is string => typeof p === "string");
    }
  } catch {
    // unparseable package.json — fall through to the next source
  }
  return null;
}

/** pnpm-workspace.yaml — a flat `packages:` list, parsed without a YAML dep. */
async function readPnpmWorkspaces(projectRoot: string): Promise<string[]> {
  const file = join(projectRoot, "pnpm-workspace.yaml");
  if (!(await fileExists(file))) return [];
  const raw = await readFile(file, "utf8");
  const out: string[] = [];
  let inPackages = false;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!inPackages) {
      if (trimmed === "packages:" || trimmed.startsWith("packages:")) inPackages = true;
      continue;
    }
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith("-")) break; // next top-level key
    const value = trimmed
      .slice(1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (value && !value.startsWith("!")) out.push(value);
  }
  return out;
}

async function readLernaWorkspaces(projectRoot: string): Promise<string[]> {
  const file = join(projectRoot, "lerna.json");
  if (!(await fileExists(file))) return [];
  try {
    const json = JSON.parse(await readFile(file, "utf8")) as { packages?: unknown };
    if (Array.isArray(json.packages)) {
      return json.packages.filter((p): p is string => typeof p === "string" && !p.startsWith("!"));
    }
  } catch {
    // unparseable lerna.json — treat as no declaration
  }
  return [];
}

/** Workspace glob patterns from package.json / pnpm-workspace.yaml / lerna.json
 * (first declaration wins). Negative (`!`) patterns are dropped. */
export async function readWorkspacePatterns(projectRoot: string): Promise<string[]> {
  const fromPackage = await readJsonWorkspaces(projectRoot);
  if (fromPackage) return fromPackage.filter((p) => !p.startsWith("!"));
  const pnpm = await readPnpmWorkspaces(projectRoot);
  if (pnpm.length > 0) return pnpm;
  return readLernaWorkspaces(projectRoot);
}

/** Workspace glob → regex. Supports `**` (any depth), `*` (within a segment),
 * `?` (single char); other characters are literal. */
function globToRegExp(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i += 1;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`${re}$`);
}

/**
 * Detect app directories under `projectRoot` — the directories `init convention`
 * scaffolds per-app conventions into.
 *
 * When a workspace declaration exists it is authoritative: apps are the
 * marker-carrying dirs matching its globs. Without one, every marker-carrying
 * dir found by the recursive walk counts (nested layouts like `apps/web/`
 * included). The repo root itself is never an app. Exclusions stop
 * dependency trees, build artifacts, hidden dirs, and `.flow`.
 *
 * Returns relative paths, forward-slash separated, sorted.
 */
export async function detectWorkspaceApps(projectRoot: string): Promise<string[]> {
  const apps = new Map<string, string[]>();

  async function visit(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || EXCLUDED_DIRS.has(entry.name)) continue;
      await visit(join(dir, entry.name));
    }
    const markers = await markersIn(dir);
    if (markers.length > 0) {
      const rel = relative(projectRoot, dir);
      if (rel !== "") apps.set(rel.split(sep).join("/"), markers);
    }
  }

  await visit(projectRoot);
  if (apps.size === 0) return [];

  const patterns = await readWorkspacePatterns(projectRoot);
  if (patterns.length === 0) return [...apps.keys()].sort();
  const regexes = patterns.map(globToRegExp);
  return [...apps.keys()].filter((rel) => regexes.some((r) => r.test(rel))).sort();
}
