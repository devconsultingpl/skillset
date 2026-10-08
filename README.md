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
- **`convention`** — points the agent at `docs/goals.md` and `docs/conventions.md` for project context. Use `skillset init convention` to scaffold the tree.
- **`builder`** — senior-engineer build posture for *writing* code: search before abstracting, minimal diffs, small functions, verify before done. Defers planning to `confidence`/`architect`. Lean toward `auto`/`slash` mode — the body loads cheaply on demand rather than every session.
- **`code-review`** — read-only review of the changes on this branch (local vs `origin`'s default branch, or a path/range you name). Reviews against the governing plan's **acceptance criteria** and classifies every finding **bug** / **spec-violation** / **preference** — preferences go in a trailing section marked *not to be acted on*. Names problems, never writes solutions (a suggested fix becomes the next session's architecture without anyone deciding it should). Terminal verdict: zero bugs and zero spec violations = *done, stop reviewing*. Reports; never edits. Lean toward `auto`/`slash`.
- **`remediate`** — the session that *fixes* what a review found, under a hard budget: no new files, no new dependencies, net line count must not increase, root cause not per-caller patch. Acts on bugs and spec violations only; preferences are listed back as ignored. A fix that won't fit the budget is a design signal — it stops and points at `architect` rather than adding a layer. Appends the round line to the plan's Review log and caps the loop at **two rounds**. `/sk-remediate`. Lean toward `slash` — it edits, so it shouldn't fire on a weak match.
- **`declutter`** — whole-codebase anti-bloat survey: hunts *pre-existing* dead code, duplication, and collapsible abstractions, ranks the biggest maintenance wins, and applies the fixes you approve. `/sk-declutter` or `/sk-declutter <area>`. Slash-only — a whole-repo survey that then edits shouldn't fire on a weak match.
- **`appsec-review`** — deep, read-only application-security audit of the changes (or a path you name): conservative — flags a vulnerability only with a concrete exploit path, ranked Critical→Info with an OWASP/CWE category. Distinct from Claude Code's built-in `/security-review` — this is the cross-agent, exploit-path-disciplined version. Reports; never edits. Lean toward `auto`/`slash`.
- **`commit-suggestion`** — suggests a ready-to-paste `git commit` command for the current changes, matching your repo's log style. Emits a concise one-liner and a heredoc multi-line form every run; flags multi-concern diffs and secret-file touches. Read-only — never runs git. `/sk-commit-suggest`. Lean toward `auto`/`slash`.
- **`caveman`** — compresses your communication to terse, telegraphic style for fast iteration loops. Governs how the agent *talks*, not what it builds — pair with `ponytail` for minimal code. `/sk-caveman on` (default) or `/sk-caveman off`. Slash-only — `auto`/`always` make no sense for a manual mode switch.
- **`ponytail`** — lazy-senior-dev mode for what the agent *builds*: a YAGNI ladder (needs to exist at all? → reuse the codebase → stdlib → native platform → installed dependency → one line → only then minimum code), root-cause bug fixes, `skipped: X, add when Y` reporting. Never simplifies away validation, error handling, security, or accessibility. Sharpens `builder`; pairs with `caveman` for terse prose. `/sk-ponytail on` (default) or `/sk-ponytail off` — or install it `always`, so fresh sessions inherit the ladder without anyone remembering to toggle it. (Unlike `caveman`, this is a build posture, not a communication switch.)
- **`retro`** — end-of-session retrospective: mines the session for friction (re-derivation, repeated searches, corrections, wasted tokens) and audits the standing context for what to save, update, create, or slim. **Harness-aware** — it first works out which harness it's in (Claude Code, opencode, pi, Copilot) and audits *that* harness's surfaces (memory store, instruction files, always-loaded docs, skills, conventions, tools), in both local and global scope. Turns each finding into a concrete edit — a new/updated memory, a convention, a skill stub, tool feedback, or relocating rarely-needed detail out of always-loaded files into on-demand `docs/`. Reports first, applies on approval. Deliberately *not* token-frugal: it runs at session end, so it reads back thoroughly rather than skimming. `/sk-retro` or `/sk-retro <focus>`. Slash-only — an explicit end-of-session moment.
- **`instruction-ownership`** — the ownership rule itself: owned content is changed in this repository and propagated with `skillset sync`, never hand-written into an installed harness directory; one provider per name per harness; and a session in any other project files `skillset suggest "…"` instead of editing. Install it `always` (pi) — it has to bind before the first edit, not after one.
- **`standing-rules`** — commits carry no trailers, code carries no comments, and a blocked command is a decision point rather than a stop: read the reason the denial printed, take the path that respects it, and never stall the task on the step that was refused. Install it `always` — every session inherits them without anyone remembering to toggle.
- **`context-pointer`** — the pointer block skillset renders into pi's **context file** (`AGENTS.md`) at global scope: where installed artifacts come from, and the two facts no doc carries. `context` mode, pi-only — the channel a session loads besides the system prompt.
- **`skillset-status`** — shows which **slash-installed** skills are currently active (toggled on) in this session. `/sk-status`. Installing it also wires per-agent tracking so `/<skill>` and `/<skill> off` flip a skill on and off (see **Active-skill status** below). Slash-only.

## The review loop

Build → review → fix → review → fix → … doesn't terminate on its own, and every round grows the codebase. A reviewer with no acceptance criteria is being asked an open question, so it always has an answer; a fix session with no budget fixes defensively, adding a layer rather than changing a line. These skills are shaped to close that loop:

1. **Spec** — `/sk-architect` then `/sk-confidence` write `docs/plans/NNNN-slug.md` with **Acceptance criteria** (≤10 binary must / must-not lines) and a **Budget** (files, dependencies, line ceiling). Skip for trivial edits; without it the rest of the loop has no oracle.
2. **Build** — `/sk-builder` (+ `ponytail`). Any criterion expressible as a failing test becomes a test — tests, types, and lint are facts that hold across sessions; review findings are opinions that get re-argued every round.
3. **Review** — `/sk-code-review` against those criteria. Findings come back classified; only **bugs** and **spec violations** are work.
4. **Fix** — `/sk-remediate` with the report pasted in. Hard budget, preferences ignored, round logged to the plan.
5. **Stop** — at *done — stop reviewing*, or at **round 2**, whichever comes first. Round 3 costs more in code volume than it returns.

Every few features, run `/sk-declutter` — the loop above has no step that makes the codebase smaller, so add one deliberately.

**Install profile for this loop.** Constraints must be inherited by fresh sessions, not toggled by hand:

```sh
skillset install builder --agent all --mode always --local
skillset install ponytail --agent all --mode always --local
skillset install architect confidence code-review remediate declutter --agent all --mode slash --local
```

## Active-skill status

Slash skills are treated as session-scoped, toggleable **modes**: invoking `/sk-builder` marks it active, `/sk-builder off` clears it, and `/sk-status` reports the set. (auto- and always-mode skills are never tracked — they have no on/off moment.) Install the feature with:

```sh
skillset install skillset-status --agent all --mode slash --local   # or --global
```

State lives in `~/.skillset/active/<session>.json`. How each agent records and shows it:

| agent | tracking (write) | status command | live indicator |
|---|---|---|---|
| **Claude Code** | `` !`skillset track` `` trailer in each slash command (session-scoped) | `/sk-status` (inline) | `statusLine` in `settings.json` |
| **opencode** | `.opencode/plugins/skillset.js` via `command.execute.before` (project-scoped) | `/sk-status` (inline) | — (no statusline API) |
| **pi** | `.pi/extensions/skillset.ts` via the `input` event (session-scoped) | `/sk-status` (model-driven) | footer via `ctx.ui.setStatus` |
| **Copilot CLI** | `~/.copilot/hooks/skillset.json` parses `/skill` in the prompt (on-only) | — (no custom commands) | `statusLine` in `~/.copilot/settings.json` |
| **VS Code Copilot** | — (no hooks) | `/sk-status` (model-driven) | — |

The Copilot CLI hook + statusline install on `--global` only (CLI config is user-global). A user's existing `statusLine` is never overwritten — skillset fills only an empty slot and removes only what it wrote.

**Reset on compact/clear.** Because a slash skill's body lives in the transcript only until the conversation is summarized or wiped, the active set is cleared automatically when that happens — so the status never claims a skill is on after its guidance is gone. Per agent: Claude Code a `SessionStart` `clear|compact` hook; Copilot CLI a `preCompact` hook; opencode the plugin's `session.compacted` event; pi the extension's `session_compact` (and `session_shutdown`). These are wired by the `skillset-status` install and removed on uninstall. Note this is *status* reset — Claude Code has no API to selectively remove text from a live transcript, so `/<skill> off` is a label, not a token refund; use `/compact` to actually shrink the conversation.

## Modes

| mode | what it does | claude-code | pi | opencode | copilot |
|---|---|---|---|---|---|
| `slash` | invoke explicitly with `/<name>` | `.claude/commands/` | `.pi/prompts/` | `.opencode/commands/` | `.github/prompts/*.prompt.md` |
| `auto` | model auto-loads by description match | `.claude/skills/` | `.pi/skills/` | `.opencode/skills/` | *(not supported)* |
| `always` | injected every session | SessionStart hook in `settings.json` | `APPEND_SYSTEM.md` | `AGENTS.md` | `copilot-instructions.md` |
| `context` | loaded as context, not as the system prompt | *(not supported)* | `AGENTS.md` — the project's, or `~/.pi/agent/AGENTS.md` | *(not supported)* | *(not supported)* |

Copilot doesn't have an auto-trigger concept; `auto` is rejected with a clear message. Use `slash` or `always` instead.

`always` and `context` are **anchor modes**: they append a marker-wrapped block to a file you also
own, so your own text in that file is never touched. On pi the two are different files —
`APPEND_SYSTEM.md` for `always`, `AGENTS.md` for `context` — and a project's `AGENTS.md` is the
file claude-code reads too, when the project has no `CLAUDE.md` of its own.

Anchor artifacts cost tokens every session. Keep bodies tight — the installer prints a warning when
the rendered body is over **80 lines**. Override with `SKILLSET_ALWAYS_WARN_LINES=<n>`.

## Scopes

- `--local` (default) — installs under the current project (`.claude/…`, `.pi/…`, etc.). Travels with the repo.
- `--global` — installs under your home dir (`~/.claude/…`, `~/.pi/agent/…`, `~/.config/opencode/…`).

## Commands

```
skillset install <skills...> --agent <agents> [--mode <mode>] [--global|--local] [--force]
skillset uninstall <skills...> [--agent ...] [--global|--local]
skillset set-mode <skill> <mode> [--agent ...] [--global|--local]
skillset sync [--dry-run|--prune]                # reconcile every declared install to sources
skillset update [--force|--dry-run|--skip-customized]   # re-sync every install from bundled sources
skillset list                         # what's available + what's installed
skillset init <skill>                 # scaffold a skill's templates into cwd
skillset init project                 # scaffold this project's own declarations file
skillset emit <skill>                 # used by SessionStart hooks; prints JSON
skillset status [--session <id>]      # print the slash skills active in a session
skillset track <skill> [on|off]       # record a toggle (used by the write surfaces)
skillset reset [--session <id>]       # clear the active set (compact/clear hooks)
skillset scan-prompt                  # Copilot CLI hook: scan a prompt for /skill tokens
```

`--agent` accepts a comma-separated list (e.g. `claude-code,pi`) or `all`. `--mode` may be omitted:
the repository declaration decides, and a skill declaring two modes for the same agent asks for the
flag rather than guessing.

## Uninstall

A **bare** `skillset uninstall <skill>` removes *every* recorded install of that skill — across all agents and all scopes. Narrow it with filters:

```sh
skillset uninstall confidence                      # every install, all agents + scopes
skillset uninstall confidence --agent claude-code  # only this agent (comma-separated list OK)
skillset uninstall confidence --global             # only the global install
skillset uninstall confidence --local              # only this project's local install
```

> ⚠️ Bare uninstall and `--global` are **not** project-scoped: they fan out across every install in `~/.skillset/state.json`, including local installs recorded in *other* project directories. Only `--local` restricts to the current project. Run `skillset list` first to see what would be removed. Nothing to match exits 0 with a warning.

## Declarations and sync

Which skills belong in which harness directories is declared in `skillset.config.json`, keyed by
skill:

```json
{
  "version": 1,
  "installs": {
    "architect": [
      { "agent": "claude-code", "mode": "slash" },
      { "agent": "pi", "mode": "slash" },
      { "agent": "pi", "mode": "auto" }
    ]
  }
}
```

Nothing infers an install set from a skill's name, and a bundled skill that declares nothing is a
reported error, not a silent omission. `skillset sync` reconciles every declaration against both the
state file and the disk:

| status | meaning | sync does |
|---|---|---|
| `in-sync` | recorded, bytes match | nothing |
| `drifted` | recorded, bytes differ (you edited it) | rewrites from source, reporting the prior content |
| `missing` | declared, nothing there | installs it |
| `adoptable` | on disk unrecorded, bytes already ours | records it, rewriting nothing |
| `foreign` | on disk unrecorded and **not** ours | refuses to touch it, exits non-zero |
| `undeclared` | recorded, no longer declared | reports it; `--prune` removes it |

### Files that travel with a skill

A skill that ships a helper, a template or a reference declares it under `siblings` — one relative
path per file, never "whatever sits in the directory":

```json
{
  "version": 1,
  "siblings": { "code-review": ["_helpers/review-range.mjs"] },
  "installs": { "code-review": [{ "agent": "pi", "mode": "auto" }] }
}
```

Siblings are copied **verbatim** beside `SKILL.md` — never rendered, so a `config:` placeholder in
one is a mistake rather than a substitution — recorded per relative path, and removed by
`uninstall`. Only installs that write a per-skill directory carry them: `auto` mode on pi,
claude-code and opencode, plus claude-code's `always`, which writes a skill file beside its settings
hook. A `slash` prompt or a marker block installs a single file into a shared directory, so a
declared sibling cannot travel there and both `install` and `sync` say so instead of dropping it
silently.

A declared path that is not a file in `src/skills/<skill>/` is a reported error (exit 2). Each
sibling is classified through the same six statuses as the skill file: edited → `drifted` (rewritten
from source, prior content reported), present, unrecorded and different → `foreign` (refused).

### A project's own declarations

A project can declare installs for itself in `<root>/.skillset/config.json` — created by
`skillset init project`, and read whenever skillset runs inside that project:

```json
{
  "version": 1,
  "installs": { "confidence": [{ "agent": "pi", "mode": "slash" }] }
}
```

This is the **local-override door**, and the one deliberate way to deviate from what the global
declarations say. Three rules keep it safe:

- **Local installs only.** `scope` may be omitted or `"local"`; a `"global"` entry is a declaration
error naming the file (exit 2), because a cloned repository must never be able to write into
somebody's home.
- **`projectPath` is derived**, not authored — the working directory skillset ran in — so one file
works in every checkout.
- **It is additive, and an override stays visible.** The global declarations are reconciled
alongside the project's, so a shadowed skill reports both installs in one run rather than silently
winning. The harness is what picks between them.

`skillset init project` never overwrites the file. `siblings`, `requires` and `agents` are repository
facts about the bundle and are refused in a project file rather than ignored.

## What each harness can carry

Every target declares, in one place, the frontmatter it can actually deliver — the renderer
forwards it *and* the harness reads it — plus the native commands an install must not shadow:

| target | frontmatter it can carry |
|---|---|
| pi | prompt template: `description`, `argument-hint`. Skill: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`, `contract` (the last read by FLOW's contract harvester from the installed file, not by pi) |
| claude-code | skill: Claude Code's full skill vocabulary — `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. Command: the same set minus `name` and `paths` |
| opencode | command: `description`, `agent`, `model`, `subtask`. Skill: `name`, `description`, `license`, `compatibility`, `metadata` — every other field, `disable-model-invocation` included, is ignored |
| copilot | VS Code prompt file: `description`, `name`, `argument-hint`, `agent`, `model`, `tools` (not `mode` — see the target's own note) |

A harness field travels under `targets.<agent>`: every renderer composes a fixed shape
(`{name, description, …targets.<agent>}`), so a field written at the top level reaches no harness.
That silence is now a report, on `install` and on `sync`:

- **declared at the top level** → warned by name, with the place it belongs (`targets.<agent>`);
- **declared under `targets.<agent>` and ignored by that harness** → warned with the consequence
  (opencode ignores `disable-model-invocation`, so the skill stays model-invocable there);
- **listed in `requires` and unrenderable** → an **error**, and nothing is written. `requires`
  states a capability the skill needs per harness, never a preference:

```json
{ "requires": { "code-review": { "pi": ["contract"] } } }
```

The `sk-` slug rule is what keeps our commands clear of the harnesses' own: every bundled skill's
slug must start with `sk-`, and a test checks each shipped slug against each target's recorded
built-in list (Claude Code's bundled skills and the `/review` alias, opencode's `/init`, `/undo`,
`/redo`, `/share`, `/help`, the Copilot app's built-in skill ids, pi's slash commands).

One install can serve two harnesses: opencode also reads `.claude/skills/`. Declare such a skill for
one of them, not both.

## Agent definitions

`src/agents/<name>.md` holds a subagent definition: the body becomes the child's system prompt,
the frontmatter its configuration. Two harnesses take one today, each declared in
`skillset.config.json` under `agents`:

| target | where it lands | what its loader reads |
|---|---|---|
| pi | `~/.pi/agent/agents/<name>.md` | `display_name`, `description`, `tools`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `run_in_background`, `enabled`. The agent's name comes from the **filename** — frontmatter `name` is ignored |
| claude-code | `~/.claude/agents/<name>.md` | `name` and `description` (both required; `name` wins over the filename), `tools`, `disallowedTools`, `model`, `effort`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `initialPrompt`, `memory`, `background`, `isolation`, `color` |

`tools` is not portable: pi names `read`, `grep`, `find`, `ls`, `bash` and its `ext:` selectors,
while Claude Code names `Read`, `Grep`, `Glob`, `Bash`, `WebSearch`, `WebFetch`. It is per-target
data, so it travels under `targets.<agent>.tools`, and both loaders ignore the other's names.

**A claude-code agent must declare `tools`, and the declaration is an error to omit.** Claude Code
reads an agent with no `tools:` line as *every* tool — a locating specialist would silently gain
`Bash`, `Edit` and `Write` — and an agent whose tool names it does not recognise as *no* tools at
all. Both are silent, and both are the wrong artifact, so a missing `tools` for claude-code refuses
the install (`install` writes nothing, `sync` exits 2 before its first write). pi has no such rule.

An agent has one delivery shape per harness, so it takes no `--mode`: passing one is refused rather
than guessed.

## Reinstall guard

A different mode is a different install: `--mode auto` beside an existing `slash` install records
both and keeps both artifacts, which is the deliberate dual setup (`architect`, `caveman`,
`ponytail`, `commit-suggestion` run as both under pi). Two flags remain meaningful:

- **`skillset set-mode <skill> <mode>`** — swaps a mode in place, for when you meant to replace it.
- **`skillset install ... --force`** — replaces a destination without asking, including one skillset
  never wrote (without `--force`, an unrecorded file at an owned destination is refused).

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
- A singular `statusLine` field is never clobbered: skillset fills only an empty slot (or refreshes its own) and on uninstall removes only the command it wrote.
- State file at `~/.skillset/state.json` records every install (skill, agent, scope, mode, paths, plus any executable `assets` and `statusLine`) so `update` and `uninstall` know exactly what to touch.
- `init` never overwrites existing files.

## Canonical skill format

```yaml
---
name: confidence
version: "0.1.0"
description: Short one-liner. Drives auto-trigger.
slug: sk-confidence       # slash command name; bundled skills use `sk-` to avoid built-in collisions
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
