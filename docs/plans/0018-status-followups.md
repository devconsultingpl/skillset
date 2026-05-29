# 0018 — status-feature follow-ups: trailer fix, statusline wrap, pi context-removal verdict

Follow-ups to [0017](completed/0017-active-skill-status.md) surfaced by live use on the author's machine. Three independent threads.

## Goal

1. **(A, blocking)** Make slash skills invokable again on Claude Code. Every slash skill (architect, builder, code-review, appsec-review, intent-review) currently errors on invoke.
2. **(C)** Append the active-skill set to the author's existing custom statusline without clobbering it.
3. **(B)** Settle whether `/X off` can *truly evict* a skill's injected text from context on pi (vs. Claude Code's best-effort tracking). Research-only outcome.

## Thread A — slash trailer "Contains expansion" (root cause confirmed)

Invoking `/architect` fails:

```
Shell command permission check failed for pattern
"!skillset track architect  --session "${CLAUDE_CODE_SESSION_ID}"": Contains expansion
```

**Cause.** `claude-code.ts` writes the trailer `` !`skillset track <slug> $ARGUMENTS --session "${CLAUDE_CODE_SESSION_ID}"` `` (const `SESSION_FLAG`, `src/targets/claude-code.ts:36`). Claude Code substitutes `$ARGUMENTS` *before* the permission check (the error shows it already gone), but it refuses to match a `!`-command containing **shell expansion** (`${…}`) against `allowed-tools: Bash(skillset *)`. The pre-approval can never fire → the command is blocked → the skill body never activates. 0017 assumed `${CLAUDE_CODE_SESSION_ID}` "substitutes inside a `` !`…` `` block" (step 1, "partially confirmed"); it does *not* survive the permission gate. This is the shipped regression.

**Verified just now:** `CLAUDE_CODE_SESSION_ID` *is* present in the Claude Code shell env (`echo $CLAUDE_CODE_SESSION_ID` → a real UUID). So the id is reachable **in-process** without putting `${…}` in the command text.

### Options
- **A1 — read the env var in-process (recommended).** Drop `--session "${…}"` from the trailer; trailer becomes `` !`skillset track <slug> $ARGUMENTS` `` (reader: `` !`skillset status` ``) — static, matches `Bash(skillset *)`, no expansion. `skillset track`/`status` resolve the session as: explicit `--session` flag → `process.env.CLAUDE_CODE_SESSION_ID` → project-key fallback. Preserves session scoping. Smallest correct diff.
- **A2 — drop session scoping on Claude Code** (project-key only). Trivial, but two concurrent Claude sessions in one repo would share one active set and stomp each other's status. Worse UX for ~no saving over A1. Rejected.
- **A3 — `SessionStart` hook writes `session_id` to a file `skillset` reads** (0017's documented fallback). More moving parts; only needed if the env var were absent — it isn't. Keep as the fallback if A1 fails live.

### Risk
The env var must be present in the *slash `!`-command* shell specifically (verified in the Bash-tool shell, same Claude Code process — high confidence, not yet proven in the `!`-shell). Mitigation: after the fix, invoke `/architect` live and run `/skillset-status`; if the active set is mis-scoped, fall back to A3.

## Thread B — can pi truly evict a skill from context? (verdict: no)

Researched against pi docs (sources below). `ctx.sessionManager` is **read-only**: `getEntries()`, `getBranch()`, `getLeafId()`, `getLabel()` — no mutation. Sessions are a **tree** (every entry has `id`/`parentId`, current position = active leaf; branch via `/tree` `/fork` `/clone`). The only context-shrinking primitive exposed to extensions is **`ctx.compact()`** (+ a `session_before_compact` hook returning a custom `{ summary, firstKeptEntryId, tokensBefore }`) — **wholesale** summarization up to a boundary, *not* selective removal of one skill's entry. `pi.sendMessage`/`appendEntry` are forward-only and explicitly *do not* participate in LLM context; `input` can transform/handle the current input but not rewrite history.

**Verdict.** Real per-skill context eviction (`/builder off` reclaiming exactly builder's tokens, keeping everything else) is **not achievable on pi** any more than on Claude Code. ADR 0002's "no agent exposes an API to selectively remove text from a live transcript" stands — pi confirms it.

### Options
- **B1 — don't build it anywhere; record the finding (recommended).** Keep the visibility-only model. "Best effort" on Claude Code = the existing tracking + reset-on-compact. Add one line to ADR 0002 (and/or 0017 outcome) citing the pi verdict so it isn't re-litigated. Zero new code — the valuable architect output here is *deciding not to build*.
- **B2 — call `ctx.compact()` on `/X off`.** Rejected: blunt and lossy — collapses the *entire* prefix into a summary, not just the skill; surprising and destructive.
- **B3 — custom `session_before_compact` summary that omits toggled-off skills.** Defer: marginal benefit, only acts when compaction already happens; revisit only if per-turn persistence is ever pursued.

## Thread C — append active skills to the author's statusline

decision 9 (0017) deliberately leaves a user's own `statusLine` untouched, so this is an explicit, one-off wrap of the author's config — not an installer behavior.

Current `~/.claude/settings.json` `statusLine.command` (single jq, no trailing newline via `-rj`):

```
jq -rj '"\(.model.display_name // "?")  ⏐  Context: \(.context_window.used_percentage // 0 | floor)% of \((.context_window.context_window_size // 0) / 1000 | floor)k tokens"'
```

The statusLine command gets the same stdin JSON skillset's reader consumes (`session_id`, `model`, …), but **stdin is single-read** — a wrapper must capture it once and feed both consumers.

### Options
- **C1 — small wrapper script (recommended).** Write `~/.claude/skillset-statusline.sh`: read stdin once; run the author's jq expression on it; run `skillset status --stdin-json` on it; append the skills only when the set is non-empty (suppress `skills: (none)`). Point `statusLine.command` at the script. Maintainable; the author's jq stays verbatim. Edits the real `settings.json` → preserve the original command in this plan for one-line restore.
  - **Format (chosen):** reuse the existing `⏐` separator with a `skills:` label, e.g. `… 1000k tokens  ⏐  skills: architect builder`; render nothing extra when no skills are active.
- **C2 — inline `bash -c` one-liner** in `statusLine.command`. No extra file, but embeds the jq inside a bash string (quoting-hell, fragile). Rejected.
- **C3 — `skillset status --quiet`** (empty output when none) + a documented wrapper recipe in README. Reusable for anyone wrapping a statusline, but scope creep — the C1 wrapper does the none-check itself. Optional follow-on, not required.

### Risk
Editing the author's live `settings.json`. Mitigation: confirm the exact rendered line first; keep the original command verbatim here (above) for restore; the wrapper is additive (their jq output is unchanged, skills are appended).

## Decisions (proposed — confirm in the question loop)
- A1 for the trailer fix; A3 held as fallback.
- B1: no context-removal feature; record the pi verdict.
- C1 for the statusline, format = `⏐  skills: <names>` (hidden when none); edits real `settings.json`, original command preserved above for restore.

## Steps
1. **A1 — core:** `resolveSessionKey` (`src/core/active.ts`) gains an env fallback (`--session` → `CLAUDE_CODE_SESSION_ID` → project key). Add a track/status test asserting the env var is honored when `--session` is absent.
2. **A1 — target:** drop `SESSION_FLAG` from `slashTrailer` in `src/targets/claude-code.ts`; trailer → `` !`skillset track <slug> $ARGUMENTS` `` / reader → `` !`skillset status` ``. Update assertions in `src/targets/claude-code.test.ts:75,90`.
3. **A1 — reinstall + live-verify:** rebuild, reinstall the slash skills globally, invoke `/architect` live, run `/skillset-status`, confirm the active set scopes per-session. If mis-scoped → A3.
4. **C1:** read the author's current `statusLine`, write the wrapper script, confirm the exact rendered output, then repoint `statusLine.command`.
5. **B1:** add a one-line pi verdict to ADR 0002 (and/or 0017 outcome). No code.
6. Typecheck + lint + test; author commits (per [[feedback-git-workflow]] — no commits/pushes by Claude).

## Open questions
- **Statusline format/placement** — resolved: `⏐  skills: <names>`, hidden when none.
- **`$ARGUMENTS` inside the trailer** — confirmed substituted pre-permission-check (the live error proves it), so the `off` path stays intact after A1. No action.
- **Other agents' trailers** — opencode tracking is plugin-based (no `${…}` trailer); only the Claude Code target had the expansion. No cross-agent change needed. (Verify opencode's status-reader command trailer carries no `${…}` during step 2.)

## Confidence
~97%. Root cause of A is confirmed against the live error + the source; the env var is confirmed present. B is a sourced research verdict. Residual <3%: the statusline format is a user preference (Thread C question), and A's env var is proven in the Bash shell but not yet in the slash `!`-shell (step 3 live-verifies; A3 is the fallback). **Stop — await explicit "go" before any code change.**

## Sources (Thread B)
- pi extensions API — https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
- pi session model — https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sessions.md

## Outcome (shipped 2026-05-29)

All three threads landed; 160 tests + biome clean.

- **A — trailer fix.** `resolveSessionKey` honors `CLAUDE_CODE_SESSION_ID` from the env between explicit `--session` and the project-key fallback (`src/core/active.ts`). The Claude Code slash trailer dropped its `${…}` (`src/targets/claude-code.ts`); reader is now `` !`skillset status` ``, tracker `` !`skillset track <slug> $ARGUMENTS` `` — both static and matched by `allowed-tools: Bash(skillset *)`. `test/helpers.ts` strips `CLAUDE_CODE_SESSION_ID` from spawned children unless a test opts in, so project-key-fallback tests stay deterministic when run from inside Claude Code. New env-fallback tests at the unit and CLI levels. Globals reinstalled with `skillset install … --force`; the 95 user permissions and the custom `statusLine` were left untouched. End-to-end verified: `skillset track architect on` (no flag) wrote to `~/.skillset/active/<CLAUDE_CODE_SESSION_ID>.json`; `skillset status` read it back. A live `/architect` smoke test in a fresh slash invocation is the final confirmation.
- **C — statusline wrap.** `~/.claude/skillset-statusline.sh` (executable) reads stdin once and feeds it to both the jq expression and `skillset status --stdin-json`, appending `  ⏐  skills: <names>` only when non-empty. `~/.claude/settings.json` `statusLine.command` repointed at the script; the original command is preserved verbatim in Thread C above for restore.
- **B — pi verdict recorded.** One sentence added to ADR 0002 citing the read-only `sessionManager` + wholesale-only `ctx.compact()` finding (sources above). No code.

Open question on the opencode trailer is resolved: `src/targets/opencode.ts:40` already emits `` !`skillset status` `` (no `${…}`) — unaffected.
