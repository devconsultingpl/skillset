# 0030 — the always channel: one conventions rule, and the trim it pays for

## Status: implemented — awaiting review and sign-off; independent of 0029; developer chose the always-channel rule (C)
over the description clause, and asked for the trim in the same pass

## Goal

One standing rule, paid once per request, that makes a project's own conventions
authoritative over every skillset posture — in every harness, every session — and the
trim of the two always bodies that pays for it several times over. The always channel
is the only surface paid **per request on every harness**, so it is where instruction
tokens actually matter.

## Why the always channel and not a description

Measured on this bundle:

- A skill `description` is **selection text** in the system prompt (pi `auto` installs
  only, 5 of them, 230 words ≈ 299 estTokens/session); instructions live in the body,
  loaded on invocation (`docs/skills.md`, progressive disclosure). A conventions
  reminder is an instruction, so a description is the wrong carrier.
- The reminder is sporadic exactly where it matters: **1 of 5** visible descriptions
  mentions conventions, and only **7 of 23** bodies carry a conventions block.
- The `always` channel reaches **pi (`APPEND_SYSTEM.md`), claude-code
  (`settings.json`), opencode (`AGENTS.md`) and copilot
  (`copilot-instructions.md`)** — the description only ever reached one of them.

## What it costs, honestly

The rule is **not** a token saving by itself; it is coverage. Measured surfaces:

| Surface | Words | ≈ estTokens | Per |
|---|---|---|---|
| `standing-rules` body (what the rule joins) | 746 | 969 | request, every harness |
| `instruction-ownership` body | 322 | ~419 | request, every harness |
| the new rule | ≤ 20 | ≤ 26 | request, every harness |
| `architect` description, trimmed at the same time | 63 → 37 | 81 → 48 | session, pi only |

Net in pi: **≈ +18 − 33 = −15 estTokens/session**. Net elsewhere: **+18**, and those
harnesses gain the rule they never had. The rule is ~1.8% of what the always channel
already spends, which is the honest scale of the decision.

## The trim — measured, per section

Body word counts today (frontmatter is not rendered by an anchor mode, so it is free):

| Body | Section | Words | ≈t | Verdict |
|---|---|---|---|---|
| standing-rules | Commits have no trailers | 42 | 54 | keep verbatim |
| standing-rules | Code carries no comments | 94 | 122 | **−40** para 2 — the conventions rule supersedes it |
| standing-rules | Secrets never enter the context | 221 | 287 | **keep** — every sentence is a distinct obligation; safety is not trimmed for tokens |
| standing-rules | A blocked command is a decision point | 147 | 191 | **−15** restatement; rule 7 already carries "don't go quiet" |
| standing-rules | Delete only what you created | 74 | 96 | keep verbatim |
| standing-rules | Leave it smaller | 97 | 126 | **−15** tighten, no rule lost |
| standing-rules | A turn ends only when nothing actionable remains | 53 | 68 | keep verbatim |
| instruction-ownership | Never | 79 | 102 | **−11** merge the two overlapping bullets |
| instruction-ownership | Instead | 103 | 133 | **−12** the queue mechanism in one sentence, not three |
| instruction-ownership | Why this is a rule | 77 | 100 | **−32** the drift history is ADR 0006's Context; an anchor block holds rules, not explanations |

Totals: standing-rules **746 → ~695** (including the new rule),
instruction-ownership **291 → ~236**. Always channel: **1,037 words ≈ 1,348t →
~931 words ≈ 1,210t**, a **−138t/request** change that *adds* a rule.

Three of the cuts are conventions-mandated rather than taste: an anchor body "holds
rules, never explanations" (`docs/conventions.md`, *Rules every session loads*), which
is exactly what the 77-word rationale and the 40-word "a conventions doc may set its own
bar" paragraph are — and with D1's rule in place that paragraph is not even redundant
but superseded.

Pairing this with the `architect` description trim (D3) makes the round trip
negative everywhere: pi sees **−138/request − 33/session**, and the other three
harnesses see **−138/request** while gaining the rule.

## Decisions

**D1 — an eighth rule inside `standing-rules`, not a new skill.** Reuse: the body is
already installed `always` on all four harnesses, so a rule costs its words and nothing
else — no new marker block, no new config row, no new name. *Rejected:* a
`conventions-first` always skill — its own marker block plus its own heading for the
same 20 words.

**D2 — the wording names the paths.** A rule that says "follow project conventions"
without saying where they live costs a lookup every time:

> Project conventions outrank every skillset posture: read
> `docs/conventions.md`, `docs/goals.md` or `.flow/guidance/**/architecture.md`
> first; they win.

14 words ≈ 18 estTokens. *Rejected:* the short form — cheaper by 4 tokens, and the
agent then guesses which files count as conventions.

**D3 — `architect`'s clause goes in the same change.** With the rule binding
everywhere, `"Reads project conventions first"` in the description is the duplicate the
rule exists to replace: 63 → 37 words, ≈ −33 estTokens/session. Its body keeps the
full conventions section (`SKILL.md:11-12`), which is what the architect session
actually reads.

**D4 — the rule is a rule, not an explanation.** One sentence, imperative, no
rationale — the channel is paid on every request and conventions already say so.

**D5 — the trim rides the same change, section by section, with the numbers in *The
trim*.** Every cut is one of three classes: superseded by D1's rule, a restatement of
another rule, or an explanation the anchor channel is not allowed to carry. A cut that
removes a distinct obligation is not on the list — which is why "Secrets never enter the
context" (221 words) is untouched even though it is the largest section.

**D6 — the rationale moves to where it already lives.** instruction-ownership's drift
history is ADR 0006's *Context*, verbatim. The anchor body keeps one sentence pointing
at it and the "One provider per name" rule, which is a rule.

## Acceptance criteria

1. `src/skills/standing-rules/SKILL.md` carries the rule verbatim, ≤ 20 words, naming
   all three convention locations and the precedence in one sentence.
2. Its frontmatter `description` (the "Seven rules…" summary) reads **eight** rules and
   names the new one.
3. `npm run build && skillset sync` writes the new block to all four `always` anchors;
   a following `skillset sync --dry-run` reports **no drift, no undeclared, no foreign**.
4. `src/skills/architect/SKILL.md` description is ≤ 45 words, no longer mentions
   conventions, and its body still contains the `## Project conventions` section with
   the three paths (greppable).
5. `src/core/portable-body.test.ts` passes — the new rule adds no
   `${SKILL_DIR}` / `$ARGUMENTS` / `shell-timeout` / ```` ```! ```` / `ask_user_question`
   token.
6. The visible-description set is measured before and after (words × 1.3) and both
   numbers are recorded in this plan; nothing else's description changes.
   **Measured.** Before: architect 63, builder 22, caveman 43, commit-suggestion 53,
   ponytail 49 — **230 words ≈ 299 est**. After: architect 42, the rest unchanged —
   **209 words ≈ 272 est**.
7. The always bodies measure within their targets — `standing-rules` ≤ 700 words -
   including the new rule, `instruction-ownership` ≤ 245 — recorded with `wc -w` and
   per-section numbers, and every obligation in *The trim*'s "keep" rows is still
   present verbatim or tighter (greppable by its operative phrase).
   **Measured.** `standing-rules` 746 → **698**; `instruction-ownership` 291 → **244**
   (`wc -w` on the body, frontmatter excluded from the count). Per section
   (whitespace fields, heading included): `standing-rules` — new *Project conventions
   first* 14, commits 36, comments 90 → 50, secrets 216, blocked command 137 → 122,
   delete 69, leave-it-smaller 94 → 83, turn-ends 45. `instruction-ownership` — Never
   78 → 67, Instead 102 → 86, Why 72 → 52.
8. No file outside `src/skills/standing-rules/`, `src/skills/instruction-ownership/`,
   `src/skills/architect/` and this plan is touched; no installed copy is edited by
   hand.

## Budget

**New dependencies:** none. No new skill, no new `installs` row.

| File | Change | Est. physical lines |
|---|---|---|
| `src/skills/standing-rules/SKILL.md` | one rule + its heading; frontmatter "seven" → "eight"; the three cut sections | +5 / −7 |
| `src/skills/instruction-ownership/SKILL.md` | three sections tightened (−55 words) | −10 |
| `src/skills/architect/SKILL.md` | description replacement only | −1 / +1 |
| `docs/plans/0030-always-channel.md` | this file | ~95 |
| **Total** | | **~100** |

## Steps

1. Draft the rule in place of the "Seven rules…" body header; run `wc -w` on the body
   before and after, and record both.
2. `npm run build`; `skillset sync --dry-run`, then `skillset sync`; paste both reports —
   the drift line for `architect` must name the prior content (sync repairs rather than
   silently overwriting).
3. Apply D3's description trim; rebuild; sync; confirm clean.
4. Measure the visible set (5 descriptions, words × 1.3) and write both numbers here.
5. Spot-check one installed anchor per harness (`~/.pi/agent/APPEND_SYSTEM.md` and
   `~/.claude/settings.json` at minimum) — the rule must be inside the marker block and
   nothing outside it must have moved.
   **Corrected by measurement.** claude-code's `always` anchor is not the body: it is a
   `SessionStart` hook in `settings.json` (`skillset emit standing-rules # skillset:standing-rules`)
   plus `~/.claude/skills/<name>/SKILL.md`. The check that holds for that harness is the
   hook line present and the skill file carrying the rule — the phrase is *absent* from
   `settings.json` by design, and a grep there is a false negative.
6. Ask for sign-off; the change is content, so it lands like any other skill edit.

## Open questions

| Question | Recipe |
|---|---|
| Does the rule actually change behaviour? | Unprovable by test. Observe two sessions on a repo with `docs/conventions.md`: does the agent open it before acting? If not, the wording is the problem, not the channel |
| Does `standing-rules` (now ~765 words ≈ 995 estTokens) deserve a trim of its own? | Separate plan: measure per-rule word counts, cut the two longest, keep the rule count. Out of scope here |
| Should `instruction-ownership`'s pointer to conventions move too? | No — it governs editing owned content, not acting on a project. Left alone |
| Does claude-code pay `settings.json` per request or per session? | Verify in pi's and Claude Code's docs before quoting a per-request number for that harness; the pi number is the one measured here |

## Confidence

**95%.** The mechanism is mechanical and already exercised by two always skills; the
costs are counted from the installed bundle. The 5% is criterion 3's second half and
open question 1: sync's repair path is documented but this is the first time this
session runs it against a *changed* anchor body, and "the rule is in the prompt" is not
the same claim as "the rule is obeyed".

## Review log

**Implementation pass (measured).** Both halves of the 5% are now closed:

- *Sync's repair path* — `reportPriorContent` (`src/commands/sync.ts:90`) is what the
  `drifted` branch calls, so a repair cannot be silent. Run for real: baseline
  `skillset sync --dry-run` → `checked in-sync 87` (no drift, no undeclared, no
  foreign); after the edits → `checked drifted 11 · in-sync 76`, each with its prior
  content printed; after `skillset sync` → `checked in-sync 87` again.
- *Open question 1 stays unprovable by test* — it is a behaviour claim about a prompt,
  marked as such rather than counted as covered.

Always channel as delivered: **1,037 → 942 words** (698 + 244), ≈ **1,348 → 1,225 est
per request**, −123 est/request while adding a rule. Plan projected 931 words / 1,210t;
actual is 11 words heavier — the *Why this is a rule* cut came in at −20 instead of −32,
because D6 keeps the ADR pointer *and* the "One provider per name" rule that the plan's
target implicitly dropped.

Verification pasted:

```
npx vitest run           33 files, 353 tests, all passed
npm run lint             Checked 81 files. No fixes applied.
npm run typecheck        clean
portable-body.test.ts    4 passed (the rule carries no shell/argument token)
body-size.test.ts        6 passed
outside-marker diff      ~/.pi/agent/APPEND_SYSTEM.md: identical outside skillset blocks, 2 blocks before and after
rule present in          pi APPEND_SYSTEM.md, opencode AGENTS.md, copilot copilot-instructions.md, ~/.claude/skills/standing-rules/SKILL.md
```

Surfaced, not adopted: `docs/conventions.md:68` was an orphaned fragment — the line
"the `instruction-ownership` skill." repeating the tail of line 67. **Adopted on the
developer's call** after sign-off review: one-line deletion, no other change to the file,
and no re-render needed (conventions is not an installed artifact).

