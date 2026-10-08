# conventions

<!-- Keep this file tight. Token cost is paid every session. -->

## Code style

Biome (`biome.json`). Default line length. Run `npm run lint:fix` before commit.

Executable artifacts under `src/skills/<skill>/assets/` (opencode plugin, pi extension, Copilot hook) are foreign-runtime code — excluded from `tsc` and `biome`, copied verbatim to `dist/`. Don't import them from skillset source; read them at install time via `assetPath`.

## Naming

- Source: kebab-case files, camelCase exports.
- Tests: colocated `*.test.ts` next to source under `src/core` and `src/bridges`; end-to-end tests under `test/`.
- Branches: short topical name (e.g. `step-8-agent-integration-tests`).

## Skill slugs — `sk-` prefix is mandatory

Every bundled skill's `slug:` **must** start with `sk-`. The slug becomes the slash command on every target (Claude Code, pi, opencode, Copilot), so a bare `code-review` or `verify` would collide with built-ins on at least one of them. The `sk-` prefix makes invocations unambiguously skillset's and survives any future built-in Anthropic / opencode / pi might ship.

- `name:` stays the canonical short name (used for `skillset install <name>`, state records, logs).
- `slug:` is the user-facing slash command. Default is `name` — override to `sk-<name>` for every skill we ship.
- Drop redundancy where it reads cleaner: `skillset-status` → slug `sk-status` (not `sk-skillset-status`).

When creating a new skill, set the slug explicitly in frontmatter even if it equals `sk-<name>` — making the convention visible at the top of every SKILL.md.

## Rules every session loads

A rule that must bind *before* an agent acts — rather than when it chooses to read something — belongs in the `always` channel: `src/skills/<name>/`, declared `"mode": "always"`, rendered as its own marker block in `APPEND_SYSTEM.md`. This file carries how *this repository* is built; the always channel carries what any session obeys. Everything there is paid on every request, so it holds rules, never explanations.

## Propagating skill edits

Canonical source is `src/skills/<name>/SKILL.md`; every agent install renders from it. Which skills
belong in which harness directories is declared in `skillset.config.json` — never inferred from a
skill's name.

1. Edit the source, then `npm run build` — the installed bundle is `dist/skills/`.
2. `skillset sync` reconciles every declaration: it installs what is missing, adopts an
   unrecorded artifact whose bytes already match, repairs a locally edited artifact (reporting
   the prior content), and **refuses** a file at an owned destination that skillset never wrote.
   It exits non-zero when it refuses something. `skillset sync --dry-run` reports without writing.
   What it wrote is recorded per file — path, mode, scope, kind — in `~/.skillset/state.json`.
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
`skillset suggest "<what should change, and why>"`, which appends one line to the single queue at
`~/.skillset/suggestions.jsonl` (beside `state.json`, never one queue per project), read and cleared
by a session working here. See ADR 0006 and the `instruction-ownership` skill.
the `instruction-ownership` skill.

## Where each artifact lands

One path per (mode, scope), resolved by each bridge in `src/bridges/<harness>/paths.ts` — the core never learns a harness's layout. Global scope:

| mode | pi | claude-code | opencode | copilot |
|---|---|---|---|---|
| `slash` | `~/.pi/agent/prompts/<slug>.md` | `~/.claude/commands/<slug>.md` | `~/.config/opencode/commands/<slug>.md` | `~/.skillset/copilot/prompts/<slug>.prompt.md` |
| `auto` | `~/.pi/agent/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | `~/.config/opencode/skills/<name>/SKILL.md` | — (degrades to `always`) |
| `always` | `~/.pi/agent/APPEND_SYSTEM.md` | `~/.claude/settings.json` | `~/.config/opencode/AGENTS.md` | `~/.skillset/copilot/copilot-instructions.md` |
| `context` | `~/.pi/agent/AGENTS.md` | — | — | — |
| agent | `~/.pi/agent/agents/<name>.md` | `~/.claude/agents/<name>.md` | — | — |

`context` is pi-only, and it is the one mode whose local form is **not** under `<root>/.pi`: pi
loads `AGENTS.md` from the working directory and its parents, so a local `context` install writes
`<root>/AGENTS.md` and `<root>/.pi/AGENTS.md` would be dead content. claude-code reads that same
project file — its `instructionFiles` default is `claude-md-or-agents-md`, i.e. `AGENTS.md` is
loaded where `CLAUDE.md` would be — which means one rendered project file serves both harnesses; a
project carrying its own `CLAUDE.md` gets that file instead, and our block is then invisible to
claude-code.

**Never scaffold `<root>/.pi/APPEND_SYSTEM.md`.** pi gives the trusted project file precedence over
the agent-directory one and does not combine them, so writing it would silence every global `always`
block (`instruction-ownership`, `standing-rules`) inside that project.

Local scope mirrors under the project (`<root>/.pi`, `<root>/.claude`, `<root>/.opencode`, `<root>/.github`) with two exceptions: opencode's and copilot's `always` anchors are `<root>/AGENTS.md` and `<root>/.github/copilot-instructions.md`, and copilot has no user-global prompt location documented, so its global `slash` mirrors under `~/.skillset/copilot/` for the user to copy or symlink.

Two pi paths are not install records. `~/.pi/agent/extensions/skillset.ts` ships from the `skillset-status` skill's `assets/pi-extension.ts`, and `flow` ships its own skills from its package (`packages/flow/skills/`, declared as `pi.skills`) — those are never copied into `~/.pi/agent/skills`.

## A project's own declarations

`<root>/.skillset/config.json` is a **second declaration root**, read whenever skillset runs inside that project (`skillset init project` writes the skeleton). It exists so a project can declare — and so override — installs for itself without editing this repository.

- The shape is the repository file's `installs` block and nothing else: `siblings`, `requires` and `agents` are bundle facts and are refused by name rather than ignored.
- **Local installs only.** A `"global"` entry is a declaration problem naming that file (exit 2) — a cloned repository must not be able to write into a home.
- `projectPath` is derived from the working directory, never authored, so the same file works in every checkout.
- Merging is additive: the repository's global declarations reconcile alongside the project's, so a shadowed skill reports both installs in one run instead of silently winning. A malformed project file is reported against its own path rather than falling back to the repository file alone.

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

## Harness fields — one declaration, honest reporting

A harness-specific frontmatter field goes under `targets.<agent>` in the skill, never at the top
level: the renderers compose a fixed shape and forward only `targets.<agent>`, so a top-level field
is dropped by all four targets.

Each target declares what it can carry (`frontmatter.expresses`, per mode — a command and a skill
have different vocabularies on the same harness) plus its native command names. `fieldSupport`
compares a skill's declared fields against that record, and `install` / `sync` report the gap:
warning for a field the harness ignores, error and no write at all for a field the skill **requires**
(`requires.<skill>.<agent>` in `skillset.config.json`). Never work around a missing renderer by
writing a field anyway and hoping.

Every bundled skill's `slug:` starts with `sk-`. That prefix is the whole reason our installs cannot
shadow a harness's own commands, and a test pins it against each target's recorded built-in list.

**An anchor mode renders no frontmatter at all** — `expresses.always` and `expresses.context` are
empty, because a marker block in a shared file has no YAML to read. So for `always` and `context`
the body *is* the artifact: anything a session must know goes in the body, and a skill's
`description` is metadata for `skillset list` in those modes rather than text the harness reads.
Nothing is silently lost — the field is simply not part of what that mode delivers, which is why no
warning fires for it.

`SKILLSET_CONFIG=<path>` points a run at a different declarations file — the seam end-to-end tests
use to exercise a declaration shape without editing the repository's own.

## Portable bodies: dispatch, don't assume an agent roster

A skill that is useful in more than one harness cannot name a subagent type from one
harness's roster. The portable shape, first used by `code-review`:

- **Role names describe the job**, not an agent type (`integration-scanner`,
  `peer-comparator`, `claim-verifier`), and the body maps each to whatever the harness
  offers — `subagent`, `Task`, an Agent tool.
- **Check availability before dispatching.** No subagent mechanism → one bounded single pass,
  naming what was not reached. Never pretend the passes ran.
- **Return findings and the verdict, not the trail** — tool calls and intermediate output stay
  in the subagent.
- **A direct invocation wins**: the user typing the command, or saying "run it here", means
  inline.
- **Say what did not run.** A specialist with no equivalent, a skipped pass, a check that
  could not execute — each is reported as not run, with the reason.

The roster lives in `src/agents/<name>.md`, rendered per harness for pi and claude-code (see
*Agent definitions* in `README.md`). A body that names a pi-only tool or calls a FLOW `_shared/`
script is not portable, and each target's tool set is declared per harness under
`targets.<agent>.tools` — a claude-code agent with no `tools` declaration is refused, because
Claude Code reads that absence as *every* tool. See
`docs/plans/0023-skillset-owns-instructions.md`, slice 3.

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
