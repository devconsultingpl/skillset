# architecture

Four layers: a CLI shell, command orchestrators, agent-agnostic core primitives, and per-agent targets. Skills are data (bundled `SKILL.md` files), not code.

## Components

- **CLI (`src/cli.ts`)** — commander wiring. Parses args/flags and dispatches to a command function. No business logic.
- **Commands (`src/commands/`)** — one module per verb: `install`, `uninstall`, `update`, `set-mode`, `list`, `init`, `emit`, plus the active-skill verbs `track` / `status` / `reset` / `scan-prompt`. Orchestrate core + targets; hold no agent-specific knowledge.
- **Core (`src/core/`)** — agent-agnostic primitives:
  - `parse` — split frontmatter + body (gray-matter); `types` — shared types.
  - `frontmatter` / `template` — render a restricted YAML subset by hand; substitute `{{key}}` config placeholders.
  - `markers` — wrap / remove / extract `skillset:begin…end` blocks in shared files.
  - `bundle` — enumerate and load bundled skills + their `templates/` and `assets/`.
  - `state` — read/write the install registry; match/upsert/remove records.
  - `active` — per-session active-skill store at `~/.skillset/active/<session-key>.json` (toggle/list helpers); session id or project-hash fallback. Backs `track`/`status` (see ADR 0002).
  - `statusline` — shared no-clobber add/remove for the singular `statusLine` settings field (Claude Code + Copilot CLI; see ADR 0003 / decision 9).
  - `locations` — per-agent path layout for each (mode, scope).
  - `fs` — atomic writes, presence checks. `body-size` — always-mode size warning. `prompt` / `diff` — interactive `update` divergence handling.
- **Targets (`src/targets/`)** — one module per agent (`claude-code`, `pi`, `opencode`, `copilot`) implementing the `AgentTarget` interface (`install`, `uninstall`, `preview`) plus `supportedModes`. Each owns that agent's locations, frontmatter projection, and shared-file anchors. Installing the `statusReader` skill (`skillset-status`) also drops that agent's tracking artifact — a `` !`skillset track` `` command trailer (Claude), an opencode plugin, a pi extension, or a Copilot CLI hook + statusLine (ADR 0003). `index.ts` maps agent name → target.
- **Skills bundle (`src/skills/<name>/`)** — canonical `SKILL.md` per skill, plus optional `templates/` (e.g. convention's `docs/` scaffold) and `assets/` (foreign-runtime executable artifacts, e.g. `skillset-status/assets/{opencode-plugin.js, pi-extension.ts, copilot-hook.json}`). `scripts/copy-skills.mjs` copies the tree to `dist/skills/` at build so dev (tsx on `src/`) and prod (`dist/`) resolve the same layout; assets are excluded from `tsc`/`biome` (they target other runtimes).

## Data flow

- **install** — CLI → `install` loads the bundled skill (`bundle`), applies config, then for each agent calls `targetFor(agent).install(ctx)`. The target renders agent-specific frontmatter and writes per-skill files and/or a marker block in an anchor file (`fs`, `markers`, `locations`), returning an `InstallRecord` that `state` persists to `state.json`.
- **update** — for each record, reload the skill and call `target.preview(ctx, record)` to compare on-disk bytes vs would-write bytes. Unchanged → re-install silently; diverged (local edits) → prompt / skip / overwrite per flags and TTY.
- **uninstall** — replay the record to remove exactly what was written: delete files (including recorded `assets`), strip the named marker block, drop the SessionStart hook entry, and remove the `statusLine` only if it's still ours (decision 9). Never touches unrecorded content.
- **track / status / reset** — `track <skill> [on|off]` toggles the per-session active set via `core/active`; the indiscriminate write surfaces (opencode plugin, pi extension, Copilot hook) pass `--known-only` so only installed skills are recorded. `status` prints the active set (reading the session id from a `--session` flag or a statusline stdin payload). `reset` clears the set when the agent compacts or clears the conversation — wired per agent: Claude `SessionStart` `clear|compact` hook, Copilot `preCompact` hook, the opencode plugin's `session.compacted` event, the pi extension's `session_compact`/`session_shutdown`. See ADR 0002.

## External dependencies

- Runtime: `commander` (CLI), `gray-matter` (frontmatter parse), `picocolors` (color).
- Dev: `vitest`, `@biomejs/biome`, `tsx`, `typescript`.
- Node ≥ 20. No runtime YAML serializer — `frontmatter.ts` renders the restricted subset we need (scalars + flat string arrays) by hand to keep the dependency surface small.
