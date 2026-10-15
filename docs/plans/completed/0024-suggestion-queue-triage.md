# 0024 — suggestion queue triage (2026-10-09 → 2026-10-15)

## Goal

Resolve the five lines sitting in `~/.skillset/suggestions.jsonl` (four filed from
`pi-extensions`, one from `empatyzer-serverless`). Four land as edits to bundled skills and one
README line; one suggestion is partly rejected and one sub-claim is dropped. Each verdict is
recorded here, because clearing the queue is an edit to that file and a rejection with no record is
a silent loss.

Guidance-only change: four skill bodies, one catalogue line, no code and no new dependency.
`dist/` regenerates from `npm run build`; installed copies from `skillset sync`.

## Acceptance criteria

1. `standing-rules` carries a **fourth** rule — a turn ends only when no unblocked next action
   remains — and both the body line and the frontmatter `description` say four, not three.
2. That rule names the reserved-for-developer case explicitly: do every other remaining step
   first, then state the reserved step in one line and ask.
3. `architect` names an adjudication step in the parameterised form already used by `code-review`
   (a tool the session offers), at the point the approach is about to crystallise.
4. The "before declaring done" half of that suggestion is carried in `builder`'s Verification
   section, not in `architect` — architect's boundary is the written plan.
5. No `advisor` token and no other pi-only tool name enters any body that installs to
   claude-code: `grep -rn '\badvisor\b' src/skills/architect src/skills/builder` returns nothing.
6. `builder`'s Verification section requires command timeouts in **seconds** (≈120 for a test run,
   ≈300 for an install) and names a run past ~3 minutes as a signal the command is wrong.
7. No `mktemp` rule is added anywhere — that half of suggestion 3 is rejected (AC-8 records why).
8. `caveman`'s drop list loses the over-broad clause ("anything I must understand before
   choosing") and states what stays compressed.
9. `architect`'s Budget bullet carries the sweep-scope clause: the budget forecasts a mechanical
   sweep, it does not scope one.
10. `npm test` green, `npm run build` clean, and `skillset sync` reports no drift, no foreign file
    and no refusal against the four edited skills; the always-mode size warning does **not** fire
    for `standing-rules` (limit 80 lines).

## Budget

| File | Change |
|---|---|
| `src/skills/standing-rules/SKILL.md` | +5 / −2 (new 3-line rule section, count wording ×2) |
| `src/skills/architect/SKILL.md` | +2 (confidence-loop sentence, Budget-bullet clause) |
| `src/skills/builder/SKILL.md` | +2 (two Verification bullets) |
| `src/skills/caveman/SKILL.md` | +1 / −1 (drop-list paragraph rewritten) |
| `README.md` | +1 / −1 (line 63 catalogue entry) |
| this plan | untracked until the work lands |

- New dependencies: **none**. Implementation-logic lines: **0** (guidance only).
- Expected physical-line delta: **+11 net**, ceiling **+18**. Growth past the ceiling is a spec
  violation, not a documentation allowance.
- Regenerated, never hand-edited: `dist/skills/**`, then the installs `skillset sync` writes.

## Decisions

**Verdicts on the queue.** Item numbers are the queue's line order in
`~/.skillset/suggestions.jsonl`.

| # | Filed from | Verdict | Where it lands |
|---|---|---|---|
| 1 | pi-extensions | **adopt** | `standing-rules`, fourth rule |
| 2 | empatyzer-serverless | **adopt, split** | `architect` (before crystallising) + `builder` (before done) |
| 3 | pi-extensions | **adopt first half, drop second** | `builder` Verification (seconds); `mktemp` dropped |
| 4 | pi-extensions | **adopt, narrowed** | `caveman` drop-list paragraph |
| 5 | pi-extensions | **adopt** | `architect` Budget bullet |

**A fourth rule, not a clause inside the third.** The recurring failure is a turn that ends on a
status report while actionable work remains, and its second shape — the last two steps reserved for
the developer — is not a blocked command at all. Appending the sentence to rule 3 leaves that shape
uncovered, so the rule earns its own heading and the count moves to four in the body and in the
frontmatter description. Cost is ~5 lines in the always channel against a 80-line warning threshold
(`src/core/body-size.ts`, `ALWAYS_WARN_LINES_DEFAULT = 80`); `standing-rules` sits at 26 today.

**Adjudication is parameterised, never named.** `architect` installs `claude-code, slash`, so a
pi-only token in its body is a portability defect (ADR 0009, *Portable bodies*). `code-review`
already ships the sanctioned shape — "where the harness offers it … where no such tool exists, run
the sweep inline" — and this reuses the phrasing rather than inventing a second one. The call is
one, at the point the direction is about to be committed; a mandatory call at every step would
tax the loop this skill exists to keep cheap.

**The "before declaring done" call belongs to `builder`.** `architect`'s hard rule ends the plan at
the written handoff, so an end-of-work call written into that body would be a rule architect cannot
run. Placement in `builder`'s Verification puts it where the work is actually declared done, and it
travels with the already-invoked build posture instead of the always channel.

**Rejected: the `mktemp` half of suggestion 3.** "Scratch work gets a fresh `mktemp -d`, never an
in-place `rm` reset" is a second, unrelated rule smuggled inside a timeout suggestion, and
`builder`'s *Before destructive ops* already requires confirmation before a destructive step. Filed
as a standing rule it would spend always-channel tokens on a case the posture already covers. Not
applied, recorded here, and the queue line is cleared with it.

**Rejected: suggestion 2 verbatim.** It asks `architect` to require two adjudication calls and names
a harness tool. Both objections are structural (boundary, portability), neither is a disagreement
about the value of a second opinion — the value is why the split version is applied.

**No ADR is flagged.** Nothing here outlives the plan as an architectural decision: the rule texts
are guidance content in the always channel, and the portability constraint they obey is already
ADR 0009. The `always`-vs-`builder` placement choice is a token-cost judgment, revisitable by
editing a body.

## Approach

1. Edit each source body. Bind the standing rule as a positive obligation ("end a turn only when no
   unblocked next action exists"), with the reserved case as its named exception — a rule phrased
   as a prohibition against reporting reads as advice and gets skipped.
2. Move the count wording in `standing-rules` in the same edit that adds the rule, so no state of
   the file claims three rules and carries four.
3. Update `README.md:63` to list the fourth rule beside the other three, in the same sentence shape.
4. `npm run build` → `skillset sync --dry-run` (expect drift only in the four targets) →
   `skillset sync`.
5. Verify against the **installed** files with exact substrings from the rendered bundle
   (conventions, *Propagating skill edits*, item 5) — a paraphrase grep gives a false negative.
6. Clear the five lines from `~/.skillset/suggestions.jsonl` only after the verdicts below are in
   this file.

## Steps

1. `standing-rules`: new rule section; "Three rules" → "Four rules" in body and `description`.
2. `architect`: adjudication sentence in the confidence loop; sweep-scope clause in the Budget
   bullet.
3. `builder`: timeout-units bullet and adjudication-before-done bullet, both in Verification.
4. `caveman`: rewrite the drop-list paragraph.
5. `README.md`: the `standing-rules` catalogue line.
6. Build, sync, verify installed bytes, run the test suite.
7. Clear the queue lines.

## Verified state (checks run at planning time, 2026-10-15)

| Claim | Command | Result |
|---|---|---|
| No turn-ending rule exists; rule 3 is scoped to denials | `grep -rn "actionable\|end a turn\|nothing remains" src/skills` | no hit in `standing-rules`; the "same turn / going quiet" sentence sits inside the blocked-command section |
| Nothing pins the rule count in tests | `grep -rn "no trailers\|decision point\|no comments" test/` | no hits in `test/` |
| Both count sites, and the README line, are in scope | `grep -rn "Three rules" --include='*.md' .` (excl. `dist`, `node_modules`) | `SKILL.md:4` (description), `SKILL.md:10` (body), `README.md:244` (unrelated — project-declaration rules) |
| `architect` has no adjudication step today | `grep -rn "advisor" src/skills src/agents` | only `code-review:238` and its template; none in `architect`/`builder` |
| `architect` ships to claude-code | `skillset.config.json` installs | `claude-code, slash` + `pi, auto` + `pi, slash` — pi-only tokens forbidden |
| pi bash timeout is seconds | session tool schema; `grep -rho "timeout[^\"]\{0,60\}" dist/bundle/chunks/*.js` (pi package) | schema: "timeout in seconds"; dist: `timeout must be a finite number of seconds`, `maximum is ${MAX_TIMEOUT_SECONDS} seconds` |
| always-mode warning threshold | `grep -n ALWAYS_WARN_LINES_DEFAULT src/core/body-size.test.ts` | `expect(ALWAYS_WARN_LINES_DEFAULT).toBe(80)`; `standing-rules` is 26 lines |
| Sync baseline is clean before the change | `skillset sync --dry-run` | `checked undeclared 8 · in-sync 78` |

## Open questions

- **Does the fourth rule actually change behaviour?** The failure it names was observed twice in one
  project. If a fourth empty-turn incident is filed after this lands, the rule's phrasing is the
  problem and the next move is a reword, not a fifth rule.
- **Whether the adjudication line ever fires in practice.** If three plans pass with no call, the
  line is ceremony and should be cut rather than softened.

## Confidence

98%. All five verdicts are decided, both rejections have a stated reason and a home, the two
load-bearing constraints (portability, boundary) are checked against the config and the bodies, and
every "currently true" claim above has a command and a result beside it. The only residual
uncertainty is behavioural — whether the fourth rule changes the outcome — and that is measured
after the fact, not before.

## Review log

- 2026-10-15 — plan written from the queue's five lines; baseline `skillset sync --dry-run` recorded
  at `in-sync 78`.
- 2026-10-15 — implemented. `npm run build` then `skillset sync`: `reconciled drifted 9 · in-sync 69 ·
  9 written`, re-run `in-sync 78`, no drift, no foreign file, no refusal. Drift landed exactly on the
  four edited skills (architect ×3, builder ×2, caveman ×3, standing-rules ×1 — builder is slash-only,
  so it has no `pi auto` target).
- 2026-10-15 — acceptance checked against the **installed** files with exact rendered substrings:
  `~/.pi/agent/APPEND_SYSTEM.md` carries the new rule heading, `Four rules that hold whatever the
  task is.` and the reserved-step sentence (1 each); `~/.claude/commands/sk-architect.md` carries the
  adjudication sentence and the sweep clause; `~/.claude/commands/sk-builder.md` carries both new
  Verification bullets; `~/.pi/agent/skills/caveman/SKILL.md` carries the compressed-list sentence
  and no longer carries `anything I must understand before choosing`.
- 2026-10-15 — `grep -rn '\badvisor\b' src/skills/architect src/skills/builder` and `grep -rn mktemp
  src/skills README.md` both empty (AC-5, AC-7). No always-mode warning at the real threshold, and
  `SKILLSET_ALWAYS_WARN_LINES=20` makes one fire — the check is live, and `standing-rules` is under
  the limit (rendered anchor block 25 lines against 80).
- 2026-10-15 — `npm test` 33 files / 344 tests pass; `npm run lint` clean (81 files); `npm run
  typecheck` clean. Diff: +12 / −6 across the five renderable files, net +6 — inside the +11 / ceiling
  +18 budget.
- 2026-10-15 — queue cleared (`~/.skillset/suggestions.jsonl` emptied; the five entries are preserved
  at `~/.skillset/suggestions.jsonl.bak-0024` until this plan is signed off and moves to
  `completed/`, after which the backup can go).

Awaiting developer sign-off to move this plan to `docs/plans/completed/`.
