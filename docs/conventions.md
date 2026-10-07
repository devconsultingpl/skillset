# conventions

<!-- Keep this file tight. Token cost is paid every session. -->

## Code style

Biome (`biome.json`). Default line length. Run `npm run lint:fix` before commit.

Executable artifacts under `src/skills/<skill>/assets/` (opencode plugin, pi extension, Copilot hook) are foreign-runtime code — excluded from `tsc` and `biome`, copied verbatim to `dist/`. Don't import them from skillset source; read them at install time via `assetPath`.

## Naming

- Source: kebab-case files, camelCase exports.
- Tests: colocated `*.test.ts` next to source under `src/core` and `src/targets`; end-to-end tests under `test/`.
- Branches: short topical name (e.g. `step-8-agent-integration-tests`).

## Skill slugs — `sk-` prefix is mandatory

Every bundled skill's `slug:` **must** start with `sk-`. The slug becomes the slash command on every target (Claude Code, pi, opencode, Copilot), so a bare `code-review` or `verify` would collide with built-ins on at least one of them. The `sk-` prefix makes invocations unambiguously skillset's and survives any future built-in Anthropic / opencode / pi might ship.

- `name:` stays the canonical short name (used for `skillset install <name>`, state records, logs).
- `slug:` is the user-facing slash command. Default is `name` — override to `sk-<name>` for every skill we ship.
- Drop redundancy where it reads cleaner: `skillset-status` → slug `sk-status` (not `sk-skillset-status`).

When creating a new skill, set the slug explicitly in frontmatter even if it equals `sk-<name>` — making the convention visible at the top of every SKILL.md.

## Propagating skill edits

Canonical source is `src/skills/<name>/SKILL.md`; every agent install renders from it. Which skills
belong in which harness directories is declared in `skillset.config.json` — never inferred from a
skill's name.

1. Edit the source, then `npm run build` — the installed bundle is `dist/skills/`.
2. `skillset sync` reconciles every declaration: it installs what is missing, adopts an
   unrecorded artifact whose bytes already match, repairs a locally edited artifact (reporting
   the prior content), and **refuses** a file at an owned destination that skillset never wrote.
   It exits non-zero when it refuses something. `skillset sync --dry-run` reports without writing.
3. A recorded install the declarations no longer mention is reported as `undeclared`;
   `skillset sync --prune` removes it.
4. Skill identity is `(skill, agent, scope, mode)`. A skill may hold several modes at once — the
   deliberate slash+auto setup (ADR 0005) — so installing `auto` no longer replaces `slash`.
   Omitting `--mode` takes the mode from the declaration; a skill declaring two modes for the same
   agent asks for the flag instead of guessing.
5. Verify against installed files with exact substrings from the rendered bundle — case and
   backticks matter; a paraphrase grep gives a false negative.

Installed content is an output. Never hand-edit `~/.pi/agent/**`, `~/.claude/**`,
`~/.config/opencode/**`, a project-local equivalent, or a settings file: change the source and run
`skillset sync`. A project agent that wants a change to owned content files a suggestion instead —
one JSON object per line in `.skillset/suggestions.jsonl`
(`{"target":"skills/<name>","change":"…","why":"…","evidence":"…","session":"…","at":"…"}`),
which the developer triages in a skillset session. See ADR 0006 and
the `instruction-ownership` skill.

## Skill payloads — declared siblings

A skill with tools (helper scripts, templates, references) ships them as **declared siblings**: name
each path in `skillset.config.json` under `siblings.<skill>`, relative to the skill directory.

- Copied byte-for-byte into the install directory beside `SKILL.md`; never rendered, so a `config:`
  placeholder in a sibling is a mistake, not a feature.
- Declared, never inferred: shipping a 400-line helper is a deliberate, reviewable statement.
- Recorded per relative path, so an edited helper is `drifted` and an unrecorded one is `foreign`.
- Siblings need a per-skill directory (`auto` mode). A `slash` prompt or marker block has none, and
  the gap is reported rather than left silent — say which install is supposed to carry the tools.
- `assets/` keeps its distinct meaning: foreign-runtime artifacts read at install time by
  `assetPath` and landing *outside* the skill directory (a plugin, an extension, a hook).

## Tests

Vitest. Unit tests live next to source (`src/**/*.test.ts`). CLI end-to-end tests live under `test/`. Cover happy path + uninstall via markers for every target.

## Commits / PRs

- Imperative subject (`add`, `fix`, `update`), under ~72 chars.
- One logical change per commit.

## What not to do

- Don't publish to npm — distribution is local-clone only for now.
- Don't write per-agent forks of a skill body — `targets:` frontmatter projects per-agent overrides (allowed-tools, activation) to each target. Keep the shared body tool-agnostic: tool names (`browser_*` on pi vs `mcp__playwright__*` on Claude Code), activation instructions, and allowed-tool metadata belong in `targets:`, never hard-coded in the body. A skill whose core is one harness's tool API may stay as separate per-agent copies — intent and safety rules synchronize, tool specifics don't.
- Don't write outside marker blocks in shared files (`settings.json`, `AGENTS.md`, `copilot-instructions.md`).

## Plans

Active plans live in `docs/plans/`. When a plan's work is fully done, **ask the developer to sign it off first**; only on explicit sign-off move it to `docs/plans/completed/` — it stops crowding the context of active work but stays in the dev log. Never delete completed plans.
