# glossary

- **skill** — a unit of reusable agent instruction: one `SKILL.md` (YAML frontmatter + Markdown body).
- **canonical format** — the single source `SKILL.md`; skillset projects it into each agent's native shape rather than storing per-agent copies.
- **bundled skill** — a skill shipped in `src/skills/` (today: `appsec-review`, `architect`, `builder`, `caveman`, `code-review`, `commit-suggestion`, `confidence`, `convention`, `declutter`, `intent-review`, `skillset-status`). See README's *Bundled skills* for descriptions.
- **target** — an agent integration implementing the `AgentTarget` interface (`install` / `uninstall` / `preview`). One per supported agent.
- **mode** — how a skill is invoked: `slash` (explicit `/name`), `auto` (model auto-loads by description match), `always` (injected every session).
- **scope** — install reach: `local` (current project) or `global` (user-level home dir).
- **marker** — the `<!-- skillset:begin <skill> -->` … `<!-- skillset:end <skill> -->` wrapper around anything skillset writes into a shared file, so removal touches only its own block.
- **anchor file** — a shared file skillset appends a marker block (or hook entry) to: `AGENTS.md`, `APPEND_SYSTEM.md`, `copilot-instructions.md`, or `settings.json`.
- **install record** — one entry in `state.json` describing a single install: skill, agent, scope, mode, location, files written, anchor-file insertions, and (for the status feature) any `assets`, `statusLine`, and `statusLinePath`.
- **state.json** — the install registry at `~/.skillset/state.json`; the source of truth `update` and `uninstall` replay against.
- **slug** — optional frontmatter field naming the slash command file (defaults to the skill `name`).
- **statusReader** — frontmatter flag marking the one bundled reader skill (`skillset-status`): its slash command reports the active set and installs each agent's tracking artifact, instead of recording itself as a mode.
- **config** — frontmatter `config:` defaults substituted into the body and description via `{{key}}` placeholders at install time.
- **divergence** — when an installed file's bytes differ from what the current bundle would write (i.e. a local edit); `update` detects and protects these.
- **active set** — the slash-mode skills currently toggled on in a session, stored at `~/.skillset/active/<session-key>.json`; written by `track`, read by `status` (ADR 0002).
- **executable artifact** — runtime code skillset installs (vs. text): an opencode plugin, a pi extension, a Copilot CLI hook. Shipped as `src/skills/<skill>/assets/`, recorded for clean uninstall (ADR 0003).

## Target agents

The four agents skillset installs into. Canonical identity + docs (consult these — agent-idempotence is the project goal):

- **Claude Code** — Anthropic's CLI agent. Docs: https://code.claude.com/docs
- **pi** — the **pi coding agent** (a CLI AI coding agent; *not* Inflection's Pi chatbot). Website https://pi.dev/ · docs https://pi.dev/docs/latest · repo https://github.com/earendil-works/pi.
- **opencode** — open-source TUI coding agent. Docs: https://opencode.ai/docs
- **GitHub Copilot** — VS Code Copilot Chat (prompt files) plus the standalone Copilot CLI. Docs: https://docs.github.com/en/copilot
