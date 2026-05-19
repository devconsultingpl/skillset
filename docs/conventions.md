# conventions

<!-- Keep this file tight. Token cost is paid every session. -->

## Code style

Biome (`biome.json`). Default line length. Run `npm run lint:fix` before commit.

## Naming

- Source: kebab-case files, camelCase exports.
- Tests: colocated `*.test.ts` next to source under `src/core` and `src/targets`; end-to-end tests under `test/`.
- Branches: short topical name (e.g. `step-8-agent-integration-tests`).

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
