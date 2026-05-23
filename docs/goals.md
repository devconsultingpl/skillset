# goals

## What

A CLI that installs **skills** — reusable agent instructions — across Claude Code, pi, opencode, and GitHub Copilot from a single canonical `SKILL.md` per skill. Skillset projects that one source into each agent's native format and file location, in any of three invocation modes (`slash`, `auto`, `always`) at `local` or `global` scope.

## For whom

Developers who use more than one AI coding agent and want one source of truth for their prompts/skills instead of hand-maintaining a copy per agent.

## Done means

- One `SKILL.md` installs correctly into all four agents, in every mode the agent supports, at either scope.
- `install` / `uninstall` / `update` / `set-mode` / `list` / `init` / `emit` all work and are covered by unit + end-to-end tests.
- Edits into shared files are marker-wrapped, so `uninstall`/`update` never disturb surrounding user content.
- `update` re-syncs from the bundle without clobbering files the user hand-edited.
- Cross-platform: Node ≥ 20 on macOS, Linux, Windows.

## Non-goals

- Not published to npm — distribution is local-clone / `npm link` only, for now.
- No per-agent forks of a skill body — frontmatter projects to each target from one body.
- No remote skill registry or marketplace.
- Not a general prompt manager — scoped to these four agents' skill mechanisms.
