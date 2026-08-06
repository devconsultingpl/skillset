# 0022 — Monorepo-aware idempotent convention ensure

## Goal

`skillset init convention` becomes a one-command *ensure*: it reports what the
project already has (docs/ tree, all expected files) and creates whatever is
missing from the bundled templates — idempotently, never overwriting. When the
project is a monorepo, it asks how to scaffold (default: every app + the
monorepo root). Flow artifacts (`.flow/`) are never created or edited — only
reported if present, so the skills align with them.

## Acceptance criteria

1. `skillset init convention` in a plain project scaffolds `docs/` as today and
   prints a report: created files vs already-present (untouched) files.
2. Re-running is idempotent everywhere: existing files untouched, including
   per-app scaffolds; exit 0 with "nothing to create" when fully present.
3. Monorepo detection, **language-agnostic** (JS/TS + Java, Kotlin, Common Lisp, Clojure, and more):
   - Workspace declarations: `package.json` `workspaces` globs, `pnpm-workspace.yaml`, `lerna.json` — glob matches count when the dir carries ≥1 language project marker.
   - Fallback scan: **recursive** walk from the repo root (depth unlimited, so `apps/web/frontend` and other nested layouts are found), honoring exclusions: `node_modules`, `.git`/`.hg`/`.svn`, hidden dot-dirs, build artifacts (`target`, `build`, `dist`, `out`, `.gradle`, `.venv`, `venv`, `vendor`, `__pycache__`, `.next`, `.nuxt`, `coverage`), and `.flow` (never scanned or touched). A dir counts as an app when ≥1 marker sits directly inside it.
   - Project markers: package.json (JS/TS); pom.xml / build.gradle / build.gradle.kts (Java/Kotlin); *.asd / QLOT (Common Lisp); deps.edn / project.clj / build.clj (Clojure); build.sbt (Scala); Cargo.toml (Rust); go.mod (Go); pyproject.toml / setup.py (Python); Gemfile (Ruby); composer.json (PHP); CMakeLists.txt / meson.build (C/C++); *.csproj / *.sln (C#); Package.swift (Swift); mix.exs (Elixir); *.cabal (Haskell).
4. Interactive TTY + monorepo → asks how to scaffold, listing the detected apps in the prompt; default choice = every app + root (per standing instruction).
5. Non-TTY monorepo run → scaffolds root + all detected apps without prompting.
6. `--no-apps` → root only, no question, no per-app docs.
7. Only dirs with ≥1 language project marker are scaffolded as apps (workspace
   glob matches without one are skipped).
8. `.flow/`, `AGENTS.md`, `CLAUDE.md` are never created or modified; if `.flow/`
   exists it is reported ("flow guidance present — left untouched, skills read
   it").
9. No new dependencies; existing 163 tests pass; new tests cover plain,
   monorepo-default, monorepo `--no-apps`, idempotency across apps, and the
   report output.
10. `init --help` documents `--no-apps` and `--yes`; dist rebuilt; installs unaffected.
11. `--yes` skips the monorepo question even on a TTY (default choice, agent/CI-safe); the `convention` skill body documents `skillset init convention` (incl. `--no-apps`/`--yes`) so a model asked to "ensure conventions" runs it.

## Budget

- Files: `src/commands/init.ts` (report + monorepo + question), new
  `src/core/workspaces.ts` (detection, pure + testable), `src/core/prompt.ts`
  (+choice asker helper), `src/cli.ts` (flag wiring), tests
  (`test/cli.test.ts`, `src/core/workspaces.test.ts`).
- New dependencies: none.
- Line ceiling: ~+280 lines incl. tests.

## Decisions

- Reuse the `init` verb (already idempotent) — no new command name; the report
  is the new value. Monorepo logic is convention-only by construction (only
  `convention` ships templates today).
- Question uses the existing `readlineAsker`/`isInteractive` pattern; choice
  resolution extracted as a testable helper in `core/prompt.ts`.
- `.flow/` is out of scope by policy: never written, reported only. This aligns
  with the `convention` skill reading `.flow/guidance/**/architecture.md` when
  present.
- Full template set (goals, conventions, architecture, glossary, plans/,
  decisions/) is scaffolded per app and at root — apps get their own
  conventions, the root carries the monorepo-wide ones.

## Approach

1. `core/workspaces.ts`: `detectWorkspaceApps(projectRoot)` → app dirs: workspace globs resolved first; then the recursive marker walk with exclusions; dedup; skip dirs without markers. Pure, unit-tested (nested layouts, exclusions, mixed-language monorepos).
2. `core/prompt.ts`: `askChoice(ask, prompt, options, defaultKey)` returning the
   chosen key; empty input → default.
3. `init.ts`: after the plain cp, (a) build created/present report by comparing
   template tree against destination, (b) if skill is `convention` and apps
   detected → interactive `askChoice` (default `all`) or non-TTY default `all`,
   honoring `--no-apps`, (c) scaffold into each app dir (same idempotent cp),
   (d) print report + `.flow/` note.
4. `cli.ts`: `--no-apps` + `--yes` options on `init`.
5. `convention` skill: "Ensure conventions exist" section (run `skillset init convention`, variants, never touches `.flow`/`AGENTS.md`/`CLAUDE.md`).
6. Tests + build + manual smoke in a scratch monorepo.

## Open questions

- None blocking (asked the developer re: app-detection scope before
  implementation — decision recorded in the plan or superseded by their answer).

## Confidence

~90%. Reuses existing idempotent cp + asker machinery; detection and choice
logic are small and unit-testable. Residual risk: workspace glob edge cases
(nested patterns) — covered by tests + the package.json guard.

## Review log

(empty — `remediate` appends one line per round.)
