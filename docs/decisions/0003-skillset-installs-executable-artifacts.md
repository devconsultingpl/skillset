# 0003 — skillset installs executable artifacts

## Context

Until plan 0017, skillset wrote only *text*: markdown skill/command files, marker-wrapped blocks in shared files, and `settings.json` hook entries pointing at the `skillset` CLI. The active-skill feature ([0002](0002-slash-skills-are-session-modes.md)) needs each agent to *record* toggles, and the agents that can't do it from a command file need real code: an opencode plugin, a pi extension, a Copilot CLI hook. That broadens skillset's remit and its trust/uninstall surface.

## Decision

Skillset may install **executable artifacts**, shipped as bundled assets under `src/skills/skillset-status/assets/` and anchored to the `skillset-status` (statusReader) install on each agent:

- **opencode** — `.opencode/plugins/skillset.js`. A `command.execute.before` hook records each slash invocation (`{command, sessionID, arguments}`) — structured detection, no text parsing. Project-scoped writes; the status command reads the same project key.
- **pi** — `.pi/extensions/skillset.ts`. The `input` event exposes raw pre-expansion text (so `/builder off` is detectable); `ctx.sessionManager.getSessionId()` gives the session id; `ctx.ui.setStatus` renders the footer.
- **Copilot CLI** — `~/.copilot/hooks/skillset.json` (a `userPromptSubmitted` hook running `skillset scan-prompt`) + a `statusLine` entry in `~/.copilot/settings.json`. **Global scope only** — Copilot CLI config is user-global, so writing under `~/.copilot/` from a `--local` install would be a surprise.

Two supporting decisions:

- **Central filter.** The plugin/extension/hook fire on *any* command/prompt; `skillset track --known-only` validates the skill against `state.json` and silently no-ops on anything skillset didn't install. One filter serves every indiscriminate writer.
- **No-clobber for singular settings.** Claude Code and Copilot CLI `statusLine` is a single field, not an appendable array. Install fills only an empty slot (or refreshes our own); uninstall removes it only if it's still ours — recorded via `InstallRecord.statusLine` + `statusLinePath`. Shared in `core/statusline.ts`.

## Consequences

- `InstallRecord` gains `assets` (absolute paths to standalone artifacts), `statusLine`, and `statusLinePath`. Uninstall removes recorded assets verbatim and conditionally clears the statusLine — reusing the existing bookkeeping, so the new surface is smaller than "ship executable code" first implied.
- Asset files are foreign-runtime code; they're excluded from skillset's `tsc` (`src/skills/**`) and `biome` (`src/skills/**/assets/**`), and copied verbatim to `dist/` by `copy-skills.mjs`.
- `update` re-syncs the `skillset-status` command/skill bytes; the executable assets are deterministic, so a re-install rewrites them idempotently.
- Trust surface grows: installing `skillset-status` now drops runtime code into an agent's plugin/extension/hook dir. Limited to that one skill, recorded for clean removal, and inert unless the `skillset` CLI is on PATH.
