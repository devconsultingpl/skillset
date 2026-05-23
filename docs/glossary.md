# glossary

- **skill** — a unit of reusable agent instruction: one `SKILL.md` (YAML frontmatter + Markdown body).
- **canonical format** — the single source `SKILL.md`; skillset projects it into each agent's native shape rather than storing per-agent copies.
- **bundled skill** — a skill shipped in `src/skills/` (today: `confidence`, `convention`, `builder`, `caveman`).
- **target** — an agent integration implementing the `AgentTarget` interface (`install` / `uninstall` / `preview`). One per supported agent.
- **mode** — how a skill is invoked: `slash` (explicit `/name`), `auto` (model auto-loads by description match), `always` (injected every session).
- **scope** — install reach: `local` (current project) or `global` (user-level home dir).
- **marker** — the `<!-- skillset:begin <skill> -->` … `<!-- skillset:end <skill> -->` wrapper around anything skillset writes into a shared file, so removal touches only its own block.
- **anchor file** — a shared file skillset appends a marker block (or hook entry) to: `AGENTS.md`, `APPEND_SYSTEM.md`, `copilot-instructions.md`, or `settings.json`.
- **install record** — one entry in `state.json` describing a single install: skill, agent, scope, mode, location, files written, and any anchor-file insertions.
- **state.json** — the install registry at `~/.skillset/state.json`; the source of truth `update` and `uninstall` replay against.
- **slug** — optional frontmatter field naming the slash command file (defaults to the skill `name`).
- **config** — frontmatter `config:` defaults substituted into the body and description via `{{key}}` placeholders at install time.
- **divergence** — when an installed file's bytes differ from what the current bundle would write (i.e. a local edit); `update` detects and protects these.
