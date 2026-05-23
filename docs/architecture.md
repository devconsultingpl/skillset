# architecture

Four layers: a CLI shell, command orchestrators, agent-agnostic core primitives, and per-agent targets. Skills are data (bundled `SKILL.md` files), not code.

## Components

- **CLI (`src/cli.ts`)** — commander wiring. Parses args/flags and dispatches to a command function. No business logic.
- **Commands (`src/commands/`)** — one module per verb: `install`, `uninstall`, `update`, `set-mode`, `list`, `init`, `emit`. Orchestrate core + targets; hold no agent-specific knowledge.
- **Core (`src/core/`)** — agent-agnostic primitives:
  - `parse` — split frontmatter + body (gray-matter); `types` — shared types.
  - `frontmatter` / `template` — render a restricted YAML subset by hand; substitute `{{key}}` config placeholders.
  - `markers` — wrap / remove / extract `skillset:begin…end` blocks in shared files.
  - `bundle` — enumerate and load bundled skills + their `templates/`.
  - `state` — read/write the install registry; match/upsert/remove records.
  - `locations` — per-agent path layout for each (mode, scope).
  - `fs` — atomic writes, presence checks. `body-size` — always-mode size warning. `prompt` / `diff` — interactive `update` divergence handling.
- **Targets (`src/targets/`)** — one module per agent (`claude-code`, `pi`, `opencode`, `copilot`) implementing the `AgentTarget` interface (`install`, `uninstall`, `preview`) plus `supportedModes`. Each owns that agent's locations, frontmatter projection, and shared-file anchors. `index.ts` maps agent name → target.
- **Skills bundle (`src/skills/<name>/`)** — canonical `SKILL.md` per skill, plus optional `templates/` (e.g. convention's `docs/` scaffold). `scripts/copy-skills.mjs` copies the tree to `dist/skills/` at build so dev (tsx on `src/`) and prod (`dist/`) resolve the same layout.

## Data flow

- **install** — CLI → `install` loads the bundled skill (`bundle`), applies config, then for each agent calls `targetFor(agent).install(ctx)`. The target renders agent-specific frontmatter and writes per-skill files and/or a marker block in an anchor file (`fs`, `markers`, `locations`), returning an `InstallRecord` that `state` persists to `state.json`.
- **update** — for each record, reload the skill and call `target.preview(ctx, record)` to compare on-disk bytes vs would-write bytes. Unchanged → re-install silently; diverged (local edits) → prompt / skip / overwrite per flags and TTY.
- **uninstall** — replay the record to remove exactly what was written: delete files, strip the named marker block, drop the SessionStart hook entry. Never touches unrecorded content.

## External dependencies

- Runtime: `commander` (CLI), `gray-matter` (frontmatter parse), `picocolors` (color).
- Dev: `vitest`, `@biomejs/biome`, `tsx`, `typescript`.
- Node ≥ 20. No runtime YAML serializer — `frontmatter.ts` renders the restricted subset we need (scalars + flat string arrays) by hand to keep the dependency surface small.
