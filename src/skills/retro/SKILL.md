---
name: retro
version: "0.1.0"
description: End-of-session retrospective — mines the whole session for friction and audits the standing context (memory, instruction files, always-loaded docs, skills, conventions, tools) for what to save, update, create, or slim so the next session starts smarter. Harness-aware (Claude Code, opencode, pi, Copilot). Slash-only (/sk-retro or /sk-retro <focus>).
slug: sk-retro
---
# retro

A retrospective on the session that just happened. The question is always the same: **what did the agent learn or struggle with this session that, if captured now, would make the next session faster, smarter, or smoother — and where exactly does that knowledge need to live?**

Run `/sk-retro` at the end of a long or bumpy session — it's the **last step**, after `commit-suggestion` and the rest. The work is done and about to be committed; this pass exists only to make the *next* session better. Use `/sk-retro <focus>` to scope to one area (e.g. `/sk-retro memory`, `/sk-retro context-bloat`, `/sk-retro skills`).

This runs at session end, so **don't optimize this skill for brevity or token cost** — be thorough. Read back over the conversation properly, think hard about every point of friction, and produce a complete, specific set of recommendations. A shallow retro is a wasted retro. Better to surface ten concrete findings the user can decline than to volunteer two safe ones.

## What every recommendation optimizes for

retro itself is allowed to be long, but **everything it proposes must make future sessions leaner and faster, never heavier.** Hold every finding against these aims:

- **Token efficiency of the default load.** Files read every session (instruction files, `always`-mode bodies, default docs, the memory index) must carry only important, current, high-recurrence information. The default context should read like an *index*, not an encyclopedia.
- **Point, don't pile.** Store knowledge in its proper place — a decision doc, an architecture doc, a scoped memory file — and leave a one-line pointer in the default-loaded file. Never solve "we should remember X" by appending X to `CLAUDE.md`/`AGENTS.md`/`APPEND_SYSTEM.md`.
- **No stale information.** Superseded or now-false content is a liability, not history. Recommend deleting it outright — don't keep it "just in case." Short and current beats complete and rotting. We improve on everything and cling to nothing; the bar is "does this still earn its place and its tokens?", not "was it here before?"
- **Better work, not just better notes.** Where the session revealed a faster tool path, a sharper skill, or a convention that yields cleaner, more readable, more maintainable code, capture it so the next session starts there. We're aiming at good code *and* an efficient process — both are in scope.
- **Edits respect the aims they enforce.** When retro itself rewrites a skill body, convention, or instruction file, the edit must be token-efficient and performance-minded — tighten while you're in there, don't add bulk.

## Step 0 — Know which harness you're in

You may be running under any of the supported harnesses. Each keeps its standing context in different places. Figure out which one you're in (check the working tree and your own environment) and audit *that harness's* surfaces — don't assume Claude Code.

| harness | always-loaded instructions | persistent memory | skills / commands |
|---|---|---|---|
| **Claude Code** | `./CLAUDE.md`, `~/.claude/CLAUDE.md`, `SessionStart` hooks in `settings.json` | a `memory/` dir with `MEMORY.md` index if the project uses one, else `CLAUDE.md` itself | `.claude/skills/`, `.claude/commands/` |
| **opencode** | `AGENTS.md`, `opencode.json` | `AGENTS.md` (no separate store) | `.opencode/skills/`, `.opencode/commands/`, plugins |
| **pi** | `APPEND_SYSTEM.md`, `AGENTS.md` | `AGENTS.md` / `APPEND_SYSTEM.md` | `.pi/skills/`, `.pi/prompts/`, `.pi/extensions/` |
| **Copilot** | `.github/copilot-instructions.md`, `~/.copilot/settings.json` | `copilot-instructions.md` (no separate store) | `.github/prompts/*.prompt.md` |

Also check both scopes: **project-local** files (travel with the repo) and **global/user** files (`~/...`) — a finding can belong to either. When in doubt about a path, look before you write.

## Pass 1 — Mine the session for friction

Re-read this conversation start to finish. For every rough spot, ask "what standing change stops this recurring?" Look for:

- **Re-derivation** — a fact, path, command, or API shape the agent worked out that was *not already written down*. If it'll be needed again, capture it.
- **Repeated search** — the same grep/glob/file-open across turns. A pointer or note would have skipped it.
- **Corrections & preferences** — every place the user corrected the approach, restated how they like things, said "no, do it this way," or expressed a standing constraint. Each is a candidate to record (with the *why*).
- **Dead ends & rework** — work redone or thrown away because context was missing up front. What would have prevented it?
- **Tools & skills usage** — be explicit here. Two angles: (a) the agent *misused* a tool/skill or used a clumsy path when a faster one existed → capture the better usage. (b) a tool or skill is genuinely *limited or rough* and we could influence it → draft concrete feedback for its maintainer. Whenever there's something useful and actionable to say about a tool we can have impact on (a skillset skill, an MCP tool, a project script), propose that feedback explicitly rather than staying silent.
- **A task pattern with no skill** — a multi-step thing the agent did from scratch that recurs and deserves its own skill.

## Pass 2 — Audit the standing context for health

Independently of this session's events, inspect what every future session will load and judge whether it still earns its place:

- **Memory / instruction files** — is each entry still *true*? Still *useful*? Flag stale facts, duplication, one-off notes that never recur, and anything contradicted by the current code or git history. Note what's *missing* that this session proved is needed.
- **Always-loaded weight** — the instruction files and any `always`-mode skill bodies and default docs are paid for on every single session. Flag content that's rarely needed, over-long, or that the code/tests/git already record. Even though *this* skill needn't be lean, the files it audits absolutely should be — trimming them is the whole point.
- **On-demand relocation** — detail that's *correct but seldom needed* shouldn't sit in an always-loaded file. Recommend moving it to a doc that loads only when referenced (`docs/decisions/NNNN-*.md`, `docs/architecture.md`, or a harness-appropriate equivalent) and leaving a one-line pointer behind.

## What each finding becomes (be concrete)

Every finding must name the exact artifact and where it lands — not "consider documenting this":

- **Recurring fact / preference / correction** → a memory entry (one fact each; corrections/preferences carry the *why* and how to apply). On harnesses with no separate store, a tight line in the instruction file instead. Update any index.
- **A rule the user clearly holds but isn't written** → add it to the conventions doc / instruction file.
- **A recurring task pattern** → propose a new skill: name, one-line trigger, which modes/harnesses. Offer to scaffold the `SKILL.md` stub.
- **An awkward or broken skill** → the specific edit to its body or frontmatter — and keep that edit lean, don't bloat the skill while fixing it.
- **Tool / skill feedback** → explicit, actionable feedback: what was limited, the concrete improvement, and where it goes (the skill's `SKILL.md`, the tool's repo/issue tracker, a note to the user). Don't soften it into "works fine" if there's a real improvement to name.
- **Bloat / staleness** → the exact edit: delete these lines, merge these two entries, move this block to `docs/...` with a pointer.

## Operate: report first, then apply

1. **Report fully.** List every finding, ranked by payoff (friction or tokens removed × likelihood of recurrence). For each: what you saw in the session (quote/cite it), the exact change, and the precise destination. Group nothing away — completeness over tidiness.
2. **Wait for approval.** The user picks what to act on; change nothing unasked. Memory and standing-context files are load-bearing.
3. **Apply** the approved items in place — write the memories, make the edits, scaffold the stubs — using the formats and paths the detected harness expects. Confirm each change in one line.

## Out of scope

Reviewing the session's *code* changes (that's `code-review`) and hunting pre-existing bloat in the product itself (that's `declutter`). retro improves what the *agent* carries between sessions, not the codebase. Never invoke another skill — point to it if relevant.
