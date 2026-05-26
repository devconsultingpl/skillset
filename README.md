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
- **`architect`** — plan posture for non-trivial work: orients in the project, generates design options scaled to the stakes, recommends one with risks named, and writes the plan to `docs/plans/NNNN-slug.md`. Hands off to `confidence` to drive the loop to *go*; defers building to `builder`. Lean toward `auto`/`slash` — the body loads on demand, not every session.
- **`intent-review`** — read-only check of pending changes against the plan that motivated them: flags drift, scope creep, missing pieces, and overengineering. Auto-activates on uncommitted changes plus an open plan in `docs/plans/`. Reports; never edits. Lean toward `auto`/`slash`.
- **`convention`** — points the agent at `docs/goals.md` and `docs/conventions.md` for project context. Use `skillset init convention` to scaffold the tree.
- **`builder`** — senior-engineer build posture for *writing* code: search before abstracting, minimal diffs, small functions, verify before done. Defers planning to `confidence`/`architect`. Lean toward `auto`/`slash` mode — the body loads cheaply on demand rather than every session.
- **`code-review`** — read-only review of the changes on this branch (local vs `origin`'s default branch, or a path/range you name): flags correctness, readability, convention breaks, newly-introduced bloat, and obvious security/perf at `file:line` with a blocker/important/nit severity. Reports; never edits. Lean toward `auto`/`slash`.
- **`declutter`** — whole-codebase anti-bloat survey: hunts *pre-existing* dead code, duplication, and collapsible abstractions, ranks the biggest maintenance wins, and applies the fixes you approve. `/declutter` or `/declutter <area>`. Slash-only — a whole-repo survey that then edits shouldn't fire on a weak match.
- **`appsec-review`** — deep, read-only application-security audit of the changes (or a path you name): conservative — flags a vulnerability only with a concrete exploit path, ranked Critical→Info with an OWASP/CWE category. Distinct from Claude Code's built-in `/security-review` — this is the cross-agent, exploit-path-disciplined version. Reports; never edits. Lean toward `auto`/`slash`.
- **`commit-suggestion`** — suggests a ready-to-paste `git commit` command for the current changes, matching your repo's log style. Emits a concise one-liner and a heredoc multi-line form every run; flags multi-concern diffs and secret-file touches. Read-only — never runs git. `/commit-suggest`. Lean toward `auto`/`slash`.
- **`caveman`** — compresses your communication to terse, telegraphic style for fast iteration loops. `/caveman on` (default) or `/caveman off`. Slash-only — `auto`/`always` make no sense for a manual mode switch.

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
skillset update [--force|--dry-run|--skip-customized]   # re-sync every install from bundled sources
skillset list                         # what's available + what's installed
skillset init <skill>                 # scaffold a skill's templates into cwd
skillset emit <skill>                 # used by SessionStart hooks; prints JSON
```

`--agent` accepts a comma-separated list (e.g. `claude-code,pi`) or `all`.

## Uninstall

A **bare** `skillset uninstall <skill>` removes *every* recorded install of that skill — across all agents and all scopes. Narrow it with filters:

```sh
skillset uninstall confidence                      # every install, all agents + scopes
skillset uninstall confidence --agent claude-code  # only this agent (comma-separated list OK)
skillset uninstall confidence --global             # only the global install
skillset uninstall confidence --local              # only this project's local install
```

> ⚠️ Bare uninstall and `--global` are **not** project-scoped: they fan out across every install in `~/.skillset/state.json`, including local installs recorded in *other* project directories. Only `--local` restricts to the current project. Run `skillset list` first to see what would be removed. Nothing to match exits 0 with a warning.

## Reinstall guard

Installing a skill that's already installed for the same `(skill, agent, scope)` triple but with a **different mode** fails by default — old-mode artifacts would otherwise silently linger alongside the new ones. Two ways past the guard:

- **`skillset set-mode <skill> <mode>`** — preferred for plain mode switches. Atomically swaps the install's mode in place.
- **`skillset install ... --force`** — uninstalls the prior record, then installs fresh. Use when you actually want a clean re-install (e.g. after a corrupt state, or to pick up changed install-time config).

Same-mode reinstalls are idempotent and need neither flag.

## Updating without clobbering local edits

`skillset update` re-renders every recorded install from the current bundle. Installs that still match the bundle are rewritten silently. An install whose on-disk content has **drifted** from the bundle (you hand-edited it) is protected:

- **Interactive TTY** — prompts per diverged install: `[s]kip` (default) / `[o]verwrite` / `[d]iff` / `[a]bort`.
- **Non-interactive** (CI, hooks) — skips diverged installs with a warning, exits 0.
- **`--force`** — overwrite everything, no prompt.
- **`--skip-customized`** — non-interactively skip diverged installs; still rewrite untouched ones.
- **`--dry-run`** — report what each install would do; write nothing.

For marker-block installs (`always` mode), only the bytes inside the `skillset:begin/end` markers count — editing surrounding user content never triggers a prompt.

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
