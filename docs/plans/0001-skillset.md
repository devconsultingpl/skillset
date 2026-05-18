# 0001 — skillset

## Goal

Build `skillset` — TypeScript CLI that installs agent skills across multiple coding agents (Claude Code, pi, opencode, copilot) from a single canonical source. Cross-platform via npm (`npm i -g skillset` / `npx skillset`). Day-one ships two skills: `confidence` (planning loop) and `convention` (project goals + conventions). Tool is itself a vehicle for an opinionated workflow: ask questions until aligned, write plan, wait for go.

## Decisions

**Distribution**
- npm package, cross-platform Node.
- Skills bundled inside CLI package (v0). Future: optional registry.
- License: MIT. Lint/format: biome. Test: vitest. CI: GitHub Actions (lint + test + publish on tag).

**Canonical skill format**
- One source file per skill — markdown body + YAML frontmatter.
- Frontmatter is superset of all targets' fields; installer projects to each agent's required form.
- Body stays single source of truth — no per-agent body forks.
- Token-efficient — each skill kept tight, no padding.

**Targets (day-one, all four)**
- claude-code — skills dir + hook in `settings.json` for `always` mode.
- pi — skills + TS extension for `always` mode.
- opencode — skills + AGENTS.md-style injection.
- copilot — `.github/copilot-instructions.md` and/or `.github/prompts/*.prompt.md`. Limited where capabilities differ; still useful.

**Install scope**
- Both `--global` (per user) and `--local` (per project).
- Default chosen per agent's idiomatic location.

**Invocation modes (per install)**
- `slash` — explicit command (`/confidence`).
- `auto` — agent's description-matching trigger.
- `always` — SessionStart hook / always-loaded file. Injected via marked block for safe removal.

**Combination**
- Skills atomic — never generate combined files. User installs multiple, invokes multiple, or sets multiple `always`.

**State / registry**
- `~/.skillset/state.json` tracks every install: `{skill, version, agent, scope, location, mode, project_path?}`.
- `skillset update` sweeps every recorded location — global + every known project.
- `skillset list` reads state.
- `skillset uninstall` uses recorded locations + markers for safe removal.

**Safety**
- Always-mode writes wrapped in markers:
  ```
  <!-- skillset:begin <skill> -->
  ...
  <!-- skillset:end <skill> -->
  ```
- Uninstall removes only the marker block. Never touches outside.
- Hook entries in `settings.json` tagged with `skillset:<skill>` for clean removal.

**Update flow**
- Manual: `skillset update`. Re-syncs every recorded install from bundled sources.
- Skip-if-customized prompt when local file diverges from bundle.

**Mode switching**
- `skillset set-mode <skill> <mode> [--agent X] [--scope global|local]` (clear).
- `skillset install <skill> --mode X --force` (power-user reinstall).

**Skill: `confidence`**
- Drives planning loop. Trigger: before any non-trivial work.
- Asks questions conversationally — **one at a time**, no batching (absolute rule).
- States current confidence each turn.
- Defaults (configurable via frontmatter): start work at ≥98%; resume questioning if drops <95%.
- When ≥98%: writes plan to `docs/plans/NNNN-slug.md` with sections — `Goal`, `Decisions`, `Approach`, `Steps`, `Open questions`, `Confidence`. Then prints short summary inline + path. **Waits for explicit "go" / "proceed" before any code change.**
- Generic — no project-specific tooling references.

**Skill: `convention`**
- Loads `docs/goals.md` + `docs/conventions.md` always (hot context).
- References `docs/architecture.md`, `docs/glossary.md`, `docs/decisions/`, `docs/plans/` as pointers — agent reads on demand.
- `skillset init convention` scaffolds:
  ```
  docs/
  ├── goals.md
  ├── conventions.md
  ├── architecture.md
  ├── glossary.md
  ├── plans/
  └── decisions/
  ```
  Each with short commented template. Idempotent — never overwrites existing files.

## Approach

Layered:
1. **Core** (`src/core/`) — parse canonical frontmatter+body, transform to each target's shape, resolve install locations.
2. **Targets** (`src/targets/<agent>.ts`) — one module per agent. Knows: locations (global/local), file shape, how to wire `slash`/`auto`/`always`, how to safely undo.
3. **Commands** (`src/commands/`) — `install`, `uninstall`, `list`, `update`, `init`, `set-mode`.
4. **State** (`src/state.ts`) — read/write `~/.skillset/state.json`.
5. **Skills** (`src/skills/<name>/`) — bundled canonical sources + (for `convention`) templates.

Self-host: skillset itself uses its own `docs/` convention. This file is the first artifact.

## Steps

1. Bootstrap repo — `package.json`, `tsconfig.json`, biome, vitest, GH Actions workflow, `bin` entry.
2. Core: `parse.ts`, `transform.ts`, `locations.ts`, `state.ts`. Cover with tests.
3. Target modules — claude-code first (best-known), then pi, opencode, copilot. Each independently testable with golden-file tests.
4. Commands — install / uninstall / list (in that order). State threading throughout.
5. Bundled skills:
   - Write canonical `src/skills/confidence/SKILL.md`.
   - Write canonical `src/skills/convention/SKILL.md` + `templates/docs/*`.
6. `update` + `set-mode` commands.
7. `init` command for `convention` scaffold.
8. Integration tests: install into temp dirs simulating each agent's layout; verify file shapes; verify clean uninstall via markers.
9. README + usage docs.
10. Publish v0.1.0.

## Open questions

- Pi extension API specifics — confirm during impl by reading `earendil-works/pi` source.
- OpenCode skill/config conventions — research during impl.
- Copilot `always` fidelity — `.github/copilot-instructions.md` is repo-scoped; user-global Copilot custom instructions live in IDE settings (harder to write programmatically). Decide minimum viable approach in impl.
- Versioning of individual skills (separate from CLI version)? Defer until first skill change ships.
- Telemetry / opt-in usage stats? Defer.

## Confidence

≥98%. Awaiting explicit "go" before any implementation work.
