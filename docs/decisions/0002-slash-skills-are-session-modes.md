# 0002 — slash-installed skills are session-scoped toggleable modes

## Context

Before plan 0017 there was no harness concept of an "active skill." A slash invocation injects that skill's body into the conversation at that moment — nothing records "X is on," and nothing turns it off. `caveman` only *appeared* persistent because its body text says so ("active every response until `/caveman off`") — instruction content, not a mechanism. To surface "which slash skills are on right now" (`/skillset-status` + a statusline), that state had to be invented.

## Decision

Treat **slash-installed skills as session-scoped, toggleable modes.** Invoking `/X` marks X active; `/X off` clears it. State lives in a per-session JSON file under `~/.skillset/active/<session-key>.json` (`{ active: string[], updatedAt }`), written by `skillset track` and read by `skillset status`.

- **Tracked set = slash-mode installs only.** auto- and always-mode skills are never tracked or shown — they have no on/off moment to observe.
- **Visibility, not behavioral persistence.** v1 records and reports what's on; it does not re-inject skill bodies each turn. A skill's *behavior* still lasts only as long as its body says (only `caveman` truly persists). Per-turn re-injection is a deliberate non-goal (zero added token cost).
- **Session-scoped where the agent exposes a session id** (Claude Code, pi); **project-scoped** where it doesn't (opencode commands). Both directions of a given agent use the same key, so writer and reader always agree.

## Consequences

- A new bundled `skillset-status` skill (the "status reader") reports the active set on every agent. It carries `statusReader: true` in frontmatter so its slash command reads state instead of recording itself.
- Every other slash skill records itself on invoke via an agent-specific write surface (see [0003](0003-skillset-installs-executable-artifacts.md)). On Claude Code that's a `` !`skillset track …` `` trailer in the command file; elsewhere a plugin/extension/hook.
- "Active" is a skillset-only notion layered over agents that don't model it — so the surfaces degrade per agent (e.g. Copilot CLI tracks on-only; opencode is project-scoped). Documented, not hidden.
- **Reset on compact/clear.** A slash body lives in the transcript only until the conversation is summarized or wiped, so the active set is cleared on those events to keep the status honest: Claude `SessionStart` `clear|compact` hook, Copilot `preCompact` hook, opencode plugin `session.compacted`, pi extension `session_compact`/`session_shutdown` (the `skillset reset` verb). This is *status* reset only — no agent exposes an API to selectively remove text from a live transcript, so toggling a skill off never reclaims tokens; that's `/compact`'s job. pi was specifically verified (plan 0018, Thread B): `ctx.sessionManager` is read-only (`getEntries`/`getBranch`/`getLeafId`/`getLabel`) and the only context-shrinking primitive exposed to extensions is `ctx.compact()` — wholesale summarization up to a boundary, not per-entry eviction. True per-turn behavioral persistence stays out of scope (deferred — a `UserPromptSubmit` re-inject would *accumulate* duplicate context, confirmed against the docs, so it's the wrong tool).
- 0012's framing of slash as "one-shot prompt injection" is superseded for slash mode.
