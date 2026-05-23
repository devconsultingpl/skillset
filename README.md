# skillset

Install agent skills across **Claude Code**, **pi**, **opencode**, and **GitHub Copilot** from a single canonical source.

One file per skill. Skillset projects it into each agent's idiomatic format.

## Install

**From a local clone (no npm registry needed):**

```sh
git clone <this-repo>
cd skillset
npm install          # also builds via the prepare hook
npm install -g .     # installs `skillset` globally
```

After pulling new commits: `npm install -g .` again.

**Dev / live updates (symlinked):**

```sh
npm install && npm link
```

Cross-platform — Node ≥ 20 on macOS, Linux, Windows.

## Quick start

Install the bundled `confidence` skill into every supported agent, in slash-command mode, for the current project:

```sh
skillset install confidence --agent all --mode slash --local
```

Switch it to always-on for Claude Code only:

```sh
skillset set-mode confidence always --agent claude-code --local
```

Scaffold `docs/` for the `convention` skill (idempotent — won't overwrite):

```sh
skillset init convention
```

## Bundled skills (v0.1)

- **`confidence`** — drives a question-led planning loop. Asks one question at a time until confidence ≥ 98%, writes a plan to `docs/plans/NNNN-slug.md`, waits for explicit *go* before code changes. If confidence drops below 95% mid-task, it stops and re-questions.
- **`convention`** — points the agent at `docs/goals.md` and `docs/conventions.md` for project context. Use `skillset init convention` to scaffold the tree.
- **`builder`** — senior-engineer build posture for *writing* code: search before abstracting, minimal diffs, small functions, verify before done. Defers planning to `confidence`/`architect`. Lean toward `auto`/`slash` mode — the body loads cheaply on demand rather than every session.

## Modes

| mode | what it does | claude-code | pi | opencode | copilot |
|---|---|---|---|---|---|
| `slash` | invoke explicitly with `/<name>` | `.claude/commands/` | `.pi/prompts/` | `.opencode/commands/` | `.github/prompts/*.prompt.md` |
| `auto` | model auto-loads by description match | `.claude/skills/` | `.pi/skills/` | `.opencode/skills/` | *(not supported)* |
| `always` | injected every session | SessionStart hook in `settings.json` | `APPEND_SYSTEM.md` | `AGENTS.md` | `copilot-instructions.md` |

Copilot doesn't have an auto-trigger concept; `auto` is rejected with a clear message. Use `slash` or `always` instead.

`always` artifacts cost tokens every session. Keep bodies tight — the installer prints a warning when the rendered body is over **80 lines**. Override with `SKILLSET_ALWAYS_WARN_LINES=<n>`.

## Scopes

- `--local` (default) — installs under the current project (`.claude/…`, `.pi/…`, etc.). Travels with the repo.
- `--global` — installs under your home dir (`~/.claude/…`, `~/.pi/agent/…`, `~/.config/opencode/…`).

## Commands

```
skillset install <skills...> --agent <agents> --mode <mode> [--global|--local] [--force]
skillset uninstall <skills...> [--agent ...] [--global|--local]
skillset set-mode <skill> <mode> [--agent ...] [--global|--local]
skillset update                       # re-sync every install from bundled sources
skillset list                         # what's available + what's installed
skillset init <skill>                 # scaffold a skill's templates into cwd
skillset emit <skill>                 # used by SessionStart hooks; prints JSON
```

`--agent` accepts a comma-separated list (e.g. `claude-code,pi`) or `all`.

## Reinstall guard

Installing a skill that's already installed for the same `(skill, agent, scope)` triple but with a **different mode** fails by default — old-mode artifacts would otherwise silently linger alongside the new ones. Two ways past the guard:

- **`skillset set-mode <skill> <mode>`** — preferred for plain mode switches. Atomically swaps the install's mode in place.
- **`skillset install ... --force`** — uninstalls the prior record, then installs fresh. Use when you actually want a clean re-install (e.g. after a corrupt state, or to pick up changed install-time config).

Same-mode reinstalls are idempotent and need neither flag.

## How it stays safe

- Every artifact skillset writes into shared files is wrapped in begin/end markers (`<!-- skillset:begin <skill> -->`). Uninstall removes only the marked block.
- `settings.json` hook entries carry a `# skillset:<skill>` shell comment for safe identification on removal.
- State file at `~/.skillset/state.json` records every install (skill, agent, scope, mode, path) so `update` and `uninstall` know exactly what to touch.
- `init` never overwrites existing files.

## Canonical skill format

```yaml
---
name: confidence
version: "0.1.0"
description: Short one-liner. Drives auto-trigger.
slug: confidence          # optional — slash command name (default: name)
config:                   # optional — values substituted into body
  start: 98
  resume: 95
targets:                  # optional — per-agent frontmatter overrides
  claude-code:
    allowed-tools: [Read, Grep]
---
# Body markdown
Use `{{key}}` to reference config values. They're substituted at install time.
```

## Develop

```sh
npm install
npm run dev -- list           # run CLI via tsx
npm test
npm run build
```

## License

MIT.
