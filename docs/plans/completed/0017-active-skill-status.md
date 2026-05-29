# 0017 — active-skill status surface

## Goal

Give the user a way to see **which slash-installed skills are currently "on"** in a session, on every agent via an always-working command (`/skillset-status` or similar), plus a Claude Code statusline indicator. Slash-mode skills become trackable session "modes"; auto-mode skills are deliberately excluded.

## Premise correction (why this feature has to *invent* state)

Today there is **no harness concept of an active skill**. A slash invocation injects that skill's body into the conversation at that moment — nothing records "X is on", and nothing can turn it off. caveman *appears* persistent only because its body text says *"active every response until `/caveman off` or session end"* — that's instruction content, not a mechanism. `/builder`, `/architect`, etc. carry no on/off or persistence clause.

So "show what's on" is undefined until we build the state. This plan invents it.

→ worth an ADR: **"slash-installed skills are session-scoped toggleable modes."** This is a new mental model for the project (slash was previously "one-shot prompt injection"). Record in `docs/decisions/` at execute time.

## Two sub-features — keep them distinct

- **(A) Visibility / tracking** — record which slash skills are toggled on, report them. *This is the committed v1 deliverable* — the thing the user "definitely wants everywhere".
- **(B) Behavioral persistence** — making `/builder` actually keep applying until `/builder off` (today only caveman's body does this). Strictly harder and not obviously desirable for one-shot skills (a "persistent code-review mode" is semantically odd). **Out of v1 scope as a guarantee**; the recommended Claude mechanism below happens to unlock it as a bonus. See open questions.

## Locked decisions (from planning Q&A)

1. **Tracked set = slash-mode installs.** Invoking `/X` marks X active; `/X off` clears it. Auto-mode skills never appear in the status output or statusline — this is explicitly a slash-mode feature.
2. **State recording = deterministic per-agent write path** (refined by research). Write-on-invoke `` !`skillset track` `` on Claude/opencode; a `userPromptSubmitted` hook on Copilot CLI; a `before_agent_start` extension on pi; a tool-invoking prompt file on VS Code Copilot. Model-driven write is the last-resort fallback only where none of these work.
3. **v1 surface = the status command on all four agents** (claude-code, pi, opencode, copilot); the statusline indicator is Claude Code only. *(Refined by decision 4 once research showed no uniform mechanism.)*
4. **Per-agent mapping accepted** (confirmed after research). Each agent uses its best native surface with graceful degradation — see the matrix + "Revised per-agent mapping" below. Notably: Copilot CLI gets statusline-only (it has no custom commands); opencode gets command-only (it has no statusline).
5. **v1 = visibility-first** (decided). The status surface shows which slash skills are toggled on; behavioral persistence stays per-body (only caveman truly persists today). No per-turn re-injection — keeps zero added token cost. True per-turn persistence (re-inject, or body-clause) is a documented fast-follow, out of v1 scope.
6. **Off convention = per-skill `/X off`** (decided). Same path as on; `skillset track` reads the on/off argument. Matches caveman's existing `/caveman off`. No separate management command in v1.
7. **Shared primitive** (decided). Add CLI subcommands `skillset track <skill> <on|off> [--session <id>]` (writes per-session state) and `skillset status [--session <id>]` (prints the active set), mirroring the existing `skillset emit`. New core module `src/core/active.ts` owns the per-session state file under `~/.skillset/`.
8. **New artifact class — skillset will install *executable* artifacts** (consequence → ADR). Until now skillset writes only text (markdown skill/command files, marker blocks, `settings.json` hook entries). This feature also installs a Claude statusline script + `statusLine` entry, a Copilot CLI hook JSON, an opencode JS plugin, and a pi TS extension. That broadens skillset's remit and its trust/uninstall surface — record in `docs/decisions/`. **Remit broadening explicitly accepted by the user (2026-05-29)**: v1 ships the full per-agent executable surface, not a text-only subset. Note the install/uninstall *recording* already exists (`InstallRecord.files`/`insertions`/`hooks` in `types.ts`; uninstall already removes recorded files + strips settings entries in `claude-code.ts`), so what's new is generating the executable *contents*, not the bookkeeping — the uninstall surface is smaller than the "biggest new code surface" framing suggested.
9. **`statusLine` is a *singular* field — never clobber on install, never orphan on uninstall** (decided; corrects the "same plumbing as hooks" framing). Claude Code's `settings.json` `statusLine` and Copilot CLI's `~/.copilot/settings.json` `statusLine`/`footer` are single objects, **not** appendable arrays like `hooks.SessionStart[]`. Recipe — **install:** read the field; if absent, write skillset's command and record the exact command string in the `InstallRecord`; if it already equals skillset's command, refresh idempotently; if it holds the *user's own* value, **leave it untouched**, install nothing for the statusline, and print a one-line note ("you already have a statusline — add `skillset status --session …` to your script; the `/skillset-status` command still works"). **uninstall:** clear the field only if its current value still equals the recorded skillset command; if the user has since replaced it, leave it alone. **pi is exempt** — `ctx.ui.setStatus(id, …)` is id-namespaced, so it can't clobber. This honours goals.md "never disturb surrounding user content".

## Design sketch

Three components, fed by one state store:

- **State store** — a small JSON file holding the active set for a session, e.g. `{ "active": ["caveman", "builder"], "updatedAt": ... }`. Session-scoping is the open question below.
- **Writer** — a shared CLI primitive `skillset track <skill> <on|off>` writes the state file; each agent calls it through its best native surface (see matrix below). On Claude/opencode the *command file itself* runs `` !`skillset track …` `` at expansion (write-on-invoke); on Copilot CLI a `userPromptSubmitted` hook calls it; on pi an extension calls it. (NB: a Claude `UserPromptSubmit` hook fires *after* slash expansion, so it can't grep the raw `/X` — write-on-invoke sidesteps that.)
- **Writer fallback (other agents / no hook)** — the skill bodies (or a shared snippet) instruct the model to update the state file on toggle. Less reliable; acceptable per decision 2.
- **Reader 1 — `/skillset-status` skill** — a new bundled slash skill, installed everywhere, whose body tells the agent to read the state file and list active skills. Deterministic-ish (model reads a known file).
- **Reader 2 — statusline (Claude only)** — a `statusLine` command in `settings.json` that reads the state file (it receives `session_id`/`transcript_path` on stdin) and renders e.g. `skills: caveman builder`.

### Bonus the hook unlocks
A `UserPromptSubmit` hook can *also* re-inject active skills' bodies as `additionalContext` each turn — giving real behavioral persistence (B) generically and deterministically, Claude-side only. Tempting, but treat as a follow-on; v1 commits only to visibility (A).

## Options considered

- **Write path (decided: hooks + fallback).** Rejected *model-driven everywhere* — uniform but drifts when the model forgets to write; the user wanted reliability. Rejected *read-only transcript inference* — deterministic and zero-write, but Claude-only and can't back a portable command, which conflicts with "command everywhere".
- **State scope.** Session-scoped (correct: "what's on *now*") vs project-scoped (`.skillset/active.json`, simpler for a prompt-based command to locate but collides across concurrent sessions). Leaning session-scoped keyed by `session_id`; see risk below.

## Agent capability matrix (researched against official docs — see `docs/glossary.md` "Target agents")

| capability | Claude Code | pi | opencode | Copilot (VS Code) | Copilot CLI |
|---|---|---|---|---|---|
| Run code on prompt-submit / session (write path) | ✅ hooks, shell — ⚠️ `UserPromptSubmit` fires *after* slash expansion | ✅ TS extension `pi.on("before_agent_start"/"session_start")` | ✅ plugin `chat.message` + `event` bus (Bun `$`) | ❌ none without a full VS Code extension | ✅ hooks `userPromptSubmitted` / `sessionStart`, shell |
| Custom statusline / footer | ✅ `statusLine` cmd in settings.json (stdin: session_id, transcript_path, cwd, model…) | ✅ extension-only `ctx.ui.setStatus(id,text)` | ❌ not user-configurable (open feature request) | ❌ extension-only | ✅ `/statusline` + `statusLine`/`footer` in `~/.copilot/settings.json` |
| Command can deterministically read state file | ✅ command file inlines `` !`cmd` `` at expansion | ❌ template injects text only (`$1`/`$@`); model must use a tool | ✅ command file inlines `` !`cmd` `` | ✅ prompt file in agent mode can invoke a read tool | ❌ no custom slash commands at all |
| Custom slash command exists at all | ✅ `.claude/commands/*.md` | ✅ `.pi/prompts/*.md` | ✅ `.opencode/command/*.md` | ✅ `.github/prompts/*.prompt.md` | ❌ built-in only; custom *agents* (`.agent.md`) are the analog |

Sources: Claude Code `code.claude.com/docs/en/hooks.md` + `/statusline.md`; pi `pi.dev/docs/latest`; opencode `opencode.ai/docs/{plugins,commands,tui}`; Copilot `docs.github.com/en/copilot/reference/hooks-configuration` + copilot-cli-reference.

### What the research changed

- ⚠️ **Claude `UserPromptSubmit` fires AFTER slash expansion** (a `UserPromptExpansion` step runs first). A hook never sees the literal `/caveman off`. The original "hook greps the raw slash text" idea **does not work as written.**
- ✅ **Better write path — write-on-invoke.** On Claude + opencode the command file can run `` !`skillset track <skill> $ARGUMENTS` `` at expansion, so *invoking the skill records its own state* — no hook, no ordering problem. (Verify arg interpolation into the `` !`…` `` block.)
- ❌ **opencode has no user statusline**; **VS Code Copilot has neither hooks nor a user statusline.** Statusline is reachable only on Claude Code, pi (extension), and Copilot CLI.
- ⚠️ **Copilot is two products.** VS Code = prompt-file command works, no hooks/statusline. CLI = hooks + statusline + session state, but **no custom slash commands**. The status *command* and the statusline land on different Copilot products.

### Revised per-agent mapping (proposal)

- **Claude Code** — write-on-invoke `` !`skillset track` `` in each slash skill; `/skillset-status` command inlines the state file; statusLine indicator. Full support.
- **opencode** — write-on-invoke `` !`skillset track` `` in the command; `/skillset-status` command. No statusline.
- **pi** — small pi *extension*: records toggles on `before_agent_start`, renders `ctx.ui.setStatus`. Optionally registers a `/skillset-status` command (template alone can't read the file).
- **Copilot CLI** — `userPromptSubmitted` hook writes state; `/statusline` config shows it. No status *command* (unsupported).
- **VS Code Copilot** — `/skillset-status` prompt file that invokes a read tool; no auto-tracking, no statusline. Weakest surface.

### Execution findings (2026-05-29) — verified APIs collapse the executable-artifact surface

Built and tested Claude Code + opencode against verified docs. Three plan assumptions broke under API verification (sources: opencode plugin SDK types + docs/plugins,docs/commands; pi.dev/docs/latest/extensions; docs.github.com Copilot CLI hooks + statusline):

- **opencode `command`/`commands` "bug" was a false alarm.** Docs confirm the dir is `commands` (plural); `locations.ts` is already correct. Open question closed — nothing to spin out.
- **The opencode plugin would break read/write coherence and is dropped.** The plan had the plugin do *session*-scoped writes while the `/skillset-status` command reads *project*-scoped — different keys, so status could never reflect plugin writes. Plus whether opencode even routes a slash invocation through `chat.message` as raw `/builder` text is undocumented. The coherent, shipped design is command-based **project-scoped for both** write and read (within the plan's accepted "project-scoped degradation"). No plugin.
- **pi auto-tracking is not reliably achievable; extension deferred.** `before_agent_start` receives the *expanded* prompt, not the literal `/builder`, and the extension API exposes no session-id accessor. So it can't reliably tell which skill toggled or scope state to a session. pi gets the model-driven `skillset-status` prompt template only (project-scoped); auto-tracking + `ctx.ui.setStatus` footer deferred.
- **Copilot CLI tracking is semantically N/A; dropped from the feature.** Copilot CLI has *no custom slash commands*, so there is no `/builder` to invoke or detect — a `userPromptSubmitted` hook and statusLine would have nothing skill-shaped to show. The status concept doesn't map to this product.

**Coherent shipped scope:** Claude Code (full: write-on-invoke session-scoped + statusLine + status command), opencode (command, project-scoped, both directions), pi + VS Code Copilot (model-driven `skillset-status` command, project-scoped, no auto-tracking). The three executable artifacts (opencode plugin, pi extension, Copilot CLI hook+statusline) do not hold up under verified APIs and are dropped/deferred — which also shrinks decision 8 to essentially text artifacts (the Claude statusLine is a `settings.json` entry, not a script).

### Deeper research (2026-05-29) — the executable artifacts ARE achievable

A second, deeper API pass (SDK types + event reference) found documented, coherent mechanisms — reversing the "drop" above. All three ship:

- **opencode plugin — coherent + reliable.** The `command.execute.before` hook fires per slash invocation with `{command, sessionID, arguments}` — structured detection (no fragile text parsing). The `shell.env` hook lets the plugin inject `OPENCODE_SESSION=<sessionID>` into shell execution, so the `/skillset-status` command's `` !`skillset status --session "$OPENCODE_SESSION"` `` reads the **same session scope** the plugin writes. Plugin owns writes (keyed by `sessionID`); command owns the read. No project-vs-session mismatch. (Caveat: that `shell.env` covers command `` !`…` `` blocks is inferred from its `sessionID` input but not explicitly documented — verify live; fallback is project scope, still coherent.)
- **pi extension — reliable.** The `input` event exposes `event.text` = raw input *before* skill/template expansion (so `/builder off` arrives intact), and `ctx.sessionManager.getSessionId()` returns the session UUID. Extension parses `event.text`, calls `skillset track … --session <id>`, renders the footer via `ctx.ui.setStatus("skillset", …)`. Detection is documented and structured enough.
- **Copilot CLI — partial but real.** Skills are invoked as `/skill-name` *inside the prompt text*; the `userPromptSubmitted` hook stdin carries `{sessionId, prompt}`, so the hook parses `/<token>` from `prompt` and records on. statusLine command reads `session_id` (snake_case) from stdin. Limitations (documented): on-only (no `/X off` convention on CLI), and `/agent`-picker / `--agent=` selections aren't in the prompt text so they're not catchable. Acceptable partial.

**Unifier — `skillset track` filters to installed skills.** The plugin/extension/hook fire on *every* command/prompt; to avoid recording non-skillset commands (and built-ins), `skillset track <skill>` validates `<skill>` against the installed set in `state.json` and silently no-ops if unknown. One central filter serves every writer surface; the Claude/opencode trailer always passes a real slug so it's unaffected.

Executable artifacts are installed as bundled assets, anchored to the `skillset-status` (statusReader) install on each agent, and recorded in the `InstallRecord` so uninstall/update clean them up (decision 8).

## Approach

One shared core + per-agent surfaces, all reading/writing the same per-session state file.

- **Core** — `src/core/active.ts`: read/write `~/.skillset/active/<session-id>.json` (opencode: `<project-hash>.json`), holding `{ active: string[], updatedAt }`, with toggle/add/remove/list helpers. New CLI verbs `track` + `status` (`src/commands/`), wired in `cli.ts`.
- **Claude Code** — each slash skill's command file gets a trailing `` !`skillset track <slug> $ARGUMENTS --session ${CLAUDE_CODE_SESSION_ID}` `` (rendered in `claude-code.ts`). Bundled `skillset-status` skill inlines `` !`skillset status --session ${CLAUDE_CODE_SESSION_ID}` ``. Installer adds a `statusLine` entry to `settings.json` — a *singular* field, so it follows the no-clobber record-and-restore recipe in decision 9, **not** the appendable-array plumbing used by `always`-mode hooks — pointing at a bundled statusline script that reads the state file via `session_id` on stdin.
- **opencode** — command file gets the same `` !`skillset track …` `` line (no session id available → project-scoped write). Bundled `skillset-status` command inlines `` !`skillset status` ``. Ship an opencode plugin (`.opencode/plugin/`) that records per-session toggles via `chat.message` (`message.sessionID`); the command reader stays project-scoped (documented degradation).
- **pi** — ship a pi extension: subscribe to `before_agent_start` (detect toggles, call `skillset track --session <id>`), render `ctx.ui.setStatus`. Prompt-template `skillset-status` asks the model to read the file (pi templates can't inline shell).
- **Copilot CLI** — install a `userPromptSubmitted` hook (JSON in `~/.copilot/hooks/`) calling `skillset track`; configure `statusLine` in `~/.copilot/settings.json`. No status command (unsupported).
- **VS Code Copilot** — bundled `skillset-status` `.prompt.md` (agent mode) that invokes a read tool on the state file. No auto-tracking.

## Steps

1. **Verify-in-practice (cheap, gating):** on a live Claude Code confirm (a) `${CLAUDE_CODE_SESSION_ID}` substitutes inside a `` !`…` `` block and (b) `$ARGUMENTS` interpolates there. Fallback if not: a `SessionStart` hook writes `session_id` to a known path that `skillset track` reads. Same arg check on opencode. — **(a) partially confirmed 2026-05-29:** the session id is present in the Claude Code shell env, but the var is named **`CLAUDE_CODE_SESSION_ID`** (not `CLAUDE_SESSION_ID` as first assumed). So write-on-invoke can read it via env. (b) `$ARGUMENTS`-inside-backtick interpolation still needs a live slash check; the CLI is built to degrade safely either way — `skillset track <skill>` defaults to `on`, so a missing arg never corrupts state, and the `off` path has a fallback (a dedicated `/skillset-off <skill>` or the model writing state) if `$ARGUMENTS` doesn't interpolate.
2. **Core:** `src/core/active.ts` + tests (toggle on/off, list, per-session path, opencode project-hash variant).
3. **CLI:** `skillset track` / `skillset status` + `cli.ts` wiring + tests.
4. **Bundled skill `skillset-status`:** canonical `SKILL.md`; per-agent rendering (Claude/opencode inline shell; pi/VS-Code prompt variants).
5. **Per-agent write path + executable artifacts:** render the `` !`skillset track` `` line in `claude-code.ts` + `opencode.ts`; opencode plugin; pi extension; Copilot CLI hook JSON. Extend the installer/`AgentTarget`/`state.json` to write + record these executable artifacts so `uninstall`/`update` clean them up.
6. **Statusline:** bundled Claude statusline script + `settings.json` `statusLine` install/uninstall (no-clobber record-and-restore per decision 9 — the field is singular, not an appendable array); Copilot CLI `statusLine` settings (same singular-field recipe); pi footer via the extension (id-namespaced, no clobber).
7. **Tests + README + ADRs** (slash-as-modes; executable-artifact install). Move plan to `completed/`.

## Open questions (remaining — all impl-time, with fallbacks)

- **`${CLAUDE_CODE_SESSION_ID}` / `$ARGUMENTS` inside `` !`…` ``** — step 1 verifies; fallback = SessionStart hook records the id. Only thing that could shift the Claude write path.
- **Executable-artifact install/uninstall/update** — managing a JS plugin, TS extension, and hook JSON is the biggest new code surface; exact `AgentTarget`/`state.json` shape designed in step 5. → ADR (decision 8). Bookkeeping reuses existing `InstallRecord.files`/`insertions`/`hooks`.
- **`InstallRecord` gains one field for the statusline** — record the exact `statusLine` command string skillset wrote, so uninstall can verify-then-restore (decision 9). Add to `types.ts` `InstallRecord` in step 6; default-undefined keeps it backward-compatible with existing `state.json`.
- **opencode `command` (singular) vs `commands` (plural)** in `locations.ts` — suspected pre-existing bug; verify and spin out separately.
- **Naming** — `skillset-status` slug + statusline label text; confirm no slash collisions per agent.

## Confidence

~98% (was ~96%; raised after a code-grounded verification pass against goals.md/conventions.md).

Verified against the actual tree, not memory: the "no harness concept of an active skill" premise holds (slash mode is pure body-injection via `renderCommandFile`, claude-code.ts); caveman's persistence is instruction text only (SKILL.md "## Persistence"); the executable-artifact uninstall surface reuses existing `InstallRecord.files`/`insertions`/`hooks` bookkeeping, so decision 8 is smaller than first framed.

Two gaps the verification pass closed:
- **Remit broadening** (executable per-agent artifacts vs. the "one SKILL.md projected per agent" model) is no longer an implicit ADR-at-execute-time — it is **explicitly user-accepted** (decision 8).
- **`statusLine` clobber** — the earlier "same plumbing as hooks" claim was wrong (singular field, not an appendable array). Now has a concrete record-and-restore recipe in decision 9 that satisfies goals.md "never disturb surrounding user content".

Residual <2% is impl-time with stated fallbacks: the two live verifications in step 1 (`${CLAUDE_CODE_SESSION_ID}`/`$ARGUMENTS` inside a `` !`…` `` block → fallback `SessionStart` hook records the id), the suspected opencode `command`/`commands` bug (spun out separately), and naming/slash-collision checks. Decision 9 adds one field to `InstallRecord` (the recorded `statusLine` command string) — see open questions. Plan is go-ready. **Stop — await explicit "go" before any code.**

## Outcome (shipped 2026-05-29)

Implemented and tested across all four agents (154 tests, typecheck + lint clean). Deviations from the original step list, all driven by verified-API evidence (see the two "findings" sections above):

- **`CLAUDE_SESSION_ID` → `CLAUDE_CODE_SESSION_ID`** (the real env var). `$ARGUMENTS` interpolation inside `` !`…` `` is documented-confirmed, so the off-toggle works; no SessionStart fallback needed.
- **opencode `command`/`commands` was a non-bug** — `commands` (plural) is correct; nothing spun out.
- **opencode tracking moved from a command trailer to the plugin** (`command.execute.before`, project-scoped) — more reliable and avoids a double-write race; only the status-reader command keeps a `` !`skillset status` `` trailer.
- **pi auto-tracking achieved** via the `input` event (raw pre-expansion text) + `ctx.sessionManager.getSessionId()` + `ctx.ui.setStatus` footer.
- **Copilot CLI** ships a `userPromptSubmitted` hook (`skillset scan-prompt`) + statusLine, **global scope only**; on-only (no `/X off` convention on the CLI).
- **Central `skillset track --known-only` filter** (validates against `state.json`) lets the indiscriminate plugin/extension/hook ignore non-skillset commands.
- **Claude statusLine is a `settings.json` entry**, not a script — shrinking the executable-artifact surface. Shared no-clobber logic in `core/statusline.ts`; records `statusLine` + `statusLinePath` + `assets[]` on `InstallRecord`.

Deferred (documented fast-follows): per-turn behavioral persistence (still visibility-only); session-scoping for opencode (project-scoped via `shell.env`/`OPENCODE_SESSION` is a known next step); Copilot CLI off-toggle.

ADRs: [0002](../../decisions/0002-slash-skills-are-session-modes.md), [0003](../../decisions/0003-skillset-installs-executable-artifacts.md).
