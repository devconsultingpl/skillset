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

## Tests

Vitest. Unit tests live next to source (`src/**/*.test.ts`). CLI end-to-end tests live under `test/`. Cover happy path + uninstall via markers for every target.

## Commits / PRs

- Imperative subject (`add`, `fix`, `update`), under ~72 chars.
- One logical change per commit.

## What not to do

- Don't publish to npm — distribution is local-clone only for now.
- Don't write per-agent forks of a skill body — frontmatter projects to each target.
- Don't write outside marker blocks in shared files (`settings.json`, `AGENTS.md`, `copilot-instructions.md`).

## Plans

Active plans live in `docs/plans/`. As soon as a plan is fully done, move it to `docs/plans/completed/` — it stops crowding the context of active work but stays in the dev log. Never delete completed plans.
