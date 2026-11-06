# 0011 — the always channel is per-harness generated content, with unequal guarantees

**Status: implemented** — `standing-rules` and `instruction-ownership` are declared `always` for
`claude-code`, `copilot`, `opencode` and `pi` in `skillset.config.json` (plan 0026).

## Context

`always` mode means "this body is in context every session". Four bridges implement it and none of them
by the same mechanism:

| harness | renders as | guarantee |
|---|---|---|
| pi | marker block in `~/.pi/agent/APPEND_SYSTEM.md` | appended to the system prompt |
| opencode | marker block in `AGENTS.md` | a file the harness reads as instructions |
| copilot | `~/.skillset/copilot/copilot-instructions.md` | the harness has no user-global auto-load, so the user links the file into the editor |
| claude-code | one `SessionStart` hook per always skill in `~/.claude/settings.json` | emitted once at session start, not appended to a system prompt |

Until plan 0026 only pi was declared, so the five standing rules — no commit trailers, no comments,
secrets never in context, a blocked command is a decision point, delete only what you created — bound
in one harness, while a Claude Code or opencode session in any project inherited none of them.

## Decision

Declare `always` for every harness whose bridge can carry it, and state the guarantee per harness in
the plan and here, rather than withholding a rule from a harness that can only express it weakly.

**The channel holds obligations, never explanations.** A body here is paid on every request in every
harness that carries it, so it states what must be done and how it is proved — not why, not history, not
worked examples. An explanation that a session needs only when it acts belongs in a slashed skill that
loads at that moment: `standing-rules` says *delete what is provably dead*, `builder` says what counts
as proof. That split is why the seventh rule costs ~100 words rather than a section.

Plan: 0026, 0027.

The strongest available mechanism per harness wins even where it is not equal: pi's system-prompt
marker, then opencode's `AGENTS.md`, then Copilot's linkable instructions file, then Claude Code's
session-start hook. Where a harness's `always` costs the user a manual step (Copilot's link), say so
rather than silently shipping a file nothing reads.

## Consequences

A standing rule now binds everywhere, at unequal fidelity, and the weakest renderers are the ones that
fail silently. `skillset sync` is therefore the verification for this channel: a missing or drifted
always artifact must show up in its report, and a renderer that quietly stops emitting is a loss of a
rule rather than a cosmetic defect.

Claude Code's hook is the one mechanism that writes into a settings file the user owns. It is
skillset-generated and recorded like every other artifact, so it is removed by `skillset uninstall`;
a hand edit there is drift, not customisation.
