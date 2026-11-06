# 0027 — leave it smaller: removal as ambient behaviour, architecture as a report

## Goal

Sessions add four lines for every one they remove (measured: +7,578 / −1,681 across 55 commits,
modifications only; 0 of 55 commits net-negative). Not because `ponytail` is wrong, but because nothing
ever commissions subtraction: `builder` explicitly forbids it ("Leave pre-existing dead code — flag it,
don't delete it"), and `declutter` — the one skill that deletes — is slash-only, whole-codebase,
approval-gated and explicitly not for a fresh diff, so it never fires.

Make removal ambient and cheap, in three tiers, sized so it never becomes the session's subject:

| tier | the agent does | where it is decided |
|---|---|---|
| **1. Verified dead code** | removes it in the same change, no asking | ambient rule + `builder` proof |
| **2. Smaller, no architecture change** | does it, bounded to the area it is already touching | `builder` gate |
| **3. Architectural opportunity** | one line to the developer, offers a research/deep-dive; never acts | `architect` surfaced block |

The developer's own line: *"If something is not causing architectural changes but it is simplifying the
codebase and reducing the codebase it is most likely a good idea."* Tier 3 exists for the opposite case,
and its whole value is that the human decides.

## Acceptance criteria

1. `standing-rules` carries a **seventh** rule — leave it smaller — and both frontmatter and body say
   seven. It names the three tiers, states that *no candidate found* is a fine outcome, caps the report
   at three lines, and forbids blocking, re-asking or padding.
2. `builder` no longer says "Leave pre-existing dead code — flag it, don't delete it". It requires
   removing verified dead code in the same change and names the proof: callers (`grep` every name),
   dynamic references (reflection, DI/registry keys, string lookups), config and fixtures, and public
   exports consumed outside the module — plus the exit: a reference that cannot be ruled out means it is
   **not** dead and stays.
3. The proof is **language-aware, and grep is only the default**: where a reference can exist without a
   textual name — macros and reader macros, `eval`, dispatch tables, generated registries, symbol
   lookup — the proof is the language's own cross-reference tool (a Lisp project's `xref`/`macroexpand`
   pass, a compiler's unused-symbol warning), and a project with no such tool reports the candidate
   instead of deleting on a grep result alone.
4. `builder` states the tier-2 gate as a checkable list: no public interface change, no new module
   boundary, no cross-package move, no behaviour change. Anything past the list is tier 3.
5. `builder` fixes two report formats: `simplified: path:line — what, −N lines` and
   `opportunity: path:line — what, why now, rough size`, and says an empty list prints nothing at all.
6. `architect` requires a **Surfaced, not adopted** block in a plan when an improvement is spotted
   mid-flight, and requires a tier-3 opportunity to be offered as a research option rather than
   absorbed into scope.
7. `architect`'s handoff is executable, not a dead reference: after `go` the session loads `builder`'s
   body and works under it, and the body says so.
8. `builder` is declared `auto` for `pi`, `claude-code` and `opencode` — its 22-word description makes it
   discoverable without a toggle — and stays `slash` on `copilot`, where `auto` degrades to `always` and
   would pay the whole body every session.
9. `declutter` requires proof-of-dead before applying a removal — the same four checks — and states that
   an area scope (`/sk-declutter <area>`) is the right size for a post-change sweep.
10. The new rule's text is project-agnostic: no cloud vendor, no harness name, no repository-specific
    example; and `npm run build`, `npm test`, `npm run lint` are clean, `skillset sync` reports no
    drifted, missing or foreign artifact, `grep -rn "Leave pre-existing dead code" src/skills/` is empty,
    and `wc -l ~/.pi/agent/APPEND_SYSTEM.md` stays **≤ 80** (the `always` warn line).

## Budget

| File | Change |
|---|---|
| `src/skills/standing-rules/SKILL.md` | +1 rule (~55 words) and two count fixes (description, body) |
| `src/skills/builder/SKILL.md` | +3 / −1 (dead-code clause replaced, gate list, report lines) |
| `src/skills/declutter/SKILL.md` | +2 (proof-of-dead, area scope) |
| `src/skills/architect/SKILL.md` | +3 (surfaced block, research option, executable handoff) |
| `skillset.config.json` | +3 install entries (`builder` auto: pi, claude-code, opencode) ≈ +24 physical lines |
| this plan | untracked until the work lands |

New dependencies: **none**. Implementation-logic lines: **0** — this is guidance only, no test changes.
Expected physical delta: **+33 net**, ceiling **+50** (the config's three entries are JSON, not prose).

## Harness parity

`standing-rules` is `always` on pi, opencode, copilot and claude-code (0026), so tier 1 binds in every
harness without a second carrier. `builder` is slash-only on pi and claude-code — the mechanics are
loaded exactly when code is being written, which is the only time they matter.

Road not taken: install `ponytail` as `always` instead. Rejected — its body is ~330 words paid on every
request in every harness, and its seven rungs still never commission a removal. A 55-word rule that says
"delete what is dead, report what is structural" does.

## Decisions

- **The proof standard is the rule, not the enthusiasm.** Removal requires evidence that a symbol is
  unreachable; an unprovable candidate is reported, never deleted. One wrong deletion costs more trust
  than ten skipped ones.
- **Cap and silence.** Three items maximum, one line each, nothing when empty. The failure mode of an
  ambient rule is noise, so "nothing to report" must be an accepted answer rather than something to fill.
- **Tier 3 never acts.** An architectural opportunity becomes a question to the developer and, if they
  say yes, a research plan — never an inline refactor, and never scope creep in the current diff.
- **No new file format.** A ratified improvement becomes a plan or a `skillset suggest` line; this plan
  deliberately does not invent an "improvements queue" for every project.
- **The build mechanics are not copied into `architect`.** *One provider per name*: a second copy of
  `builder`'s rules drifts from the first, and the copy nobody edits wins by accident. `architect` gets a
  handoff that works (load `builder`), not a digest of it.
- **`auto`, never `always`, for a posture body.** `always` pays the whole body per request in every
  harness; `auto` pays a 22-word description and loads the body when the work matches. Copilot is the
  exception that proves it — it has no `auto`, so a posture declared there arrives as `always` or not at
  all, and for `builder` that is not at all.
- **The developer's ritual is the target, not an afterthought.** `architect` + `ponytail` + `caveman` around
  significant work stays as it is; what was missing is that after `go` the same session had no build
  posture loaded, because `builder` was slash-only and therefore invisible.
→ worth an ADR: ambient guidance must pay for itself; a rule in the `always` channel is a permanent
per-request cost, so it holds obligations, never explanations. Filed with this plan as
`docs/decisions/0012-always-channel-holds-obligations.md` if the developer wants it separate from 0011.

## Verification (how it will be measured)

| claim | check |
|---|---|
| always channel still inside budget | `wc -l -w ~/.pi/agent/APPEND_SYSTEM.md` → **75 lines / 1004 words**: inside the 80-line warn, +70 words over 0026 |
| the rule reached four harnesses | `grep -c "Leave it smaller"` → `1` in pi `APPEND_SYSTEM.md`, opencode `AGENTS.md`, copilot `copilot-instructions.md`; `skillset emit standing-rules \| grep -c` → `1` (the claude-code hook path; 2 hooks still registered in `~/.claude/settings.json`) |
| the old prohibition is gone | `grep -rn "Leave pre-existing dead code" src/skills/` → **0 hits** |
| mechanics are loaded where code is written | `~/.pi/agent/skills/builder/SKILL.md`, `~/.claude/skills/builder/SKILL.md` and `~/.config/opencode/skills/builder/SKILL.md` now exist; the language-aware proof (`cross-reference pass`) is in all four builder artifacts |
| suite and lint | `npm test` 344 passed / 33 files; `npm run lint` clean |
| sync reconciles | `skillset sync` exit 0 — `reconciled drifted 11 · missing 3 · undeclared 8 · in-sync 73 · 14 written`; the 8 `undeclared` are the pre-existing local installs |

**Hypothesis, not verifiable here:** that a tier-1 removal becomes routine rather than a debate. The
next non-trivial change in any project is the measurement — it either deletes something it made
unreachable, or reports why it could not.

**Measured during verification, worth knowing:** both falsifiable assumptions held — `auto` puts a
22-word description in pi's skill list, and declaring it made the skill directory appear on all three
of pi, claude-code and opencode.

## Open questions

1. Tier 3 needs a destination the developer will actually read. Recommended default: the response line
   plus the plan's *Surfaced, not adopted* block, and nothing else until they say "research it". A
   per-project `improvements.md` is the alternative and is deliberately not proposed.
2. The ratchet (option C from the previous analysis — a pinned size surface that may only go down) is
   **not** in this plan. It is the only enforcement mechanism, but it is code, and the developer asked
   for behaviour rather than a new gate. Say the word and it gets its own plan.

## Steps

1. `standing-rules`: seventh rule + counts.
2. `builder`: replace the dead-code clause, add the language-aware proof, the gate list and the two
   report formats.
3. `declutter`: proof-of-dead, area scope.
4. `architect`: surfaced block, research option, executable handoff.
5. `skillset.config.json`: `builder` auto on pi, claude-code, opencode.
6. `npm run build`, `npm run lint:fix`, `npm test`, `skillset sync`; verify the four harnesses, that
   `~/.pi/agent/skills/builder/` now exists, and the line budget.
