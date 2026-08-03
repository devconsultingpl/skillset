# 0020 — Closing the review loop (spec → build → review → remediate → stop)

## Problem

The user's real workflow is: build in session A → review in fresh session B → paste findings into fresh session C → review in session D → … It never terminates, and each round grows the codebase. `ponytail` did not fix this, and the reason is structural, not a wording problem in that skill.

Skillset today has a skill per *phase* (`architect`, `confidence`, `builder`, `ponytail`, `code-review`, `intent-review`, `declutter`, `retro`) but no closed *loop*. Six concrete gaps, each traceable to a file in this repo:

1. **No acceptance criteria exist anywhere.** The plan template (`confidence/SKILL.md:28-37`) is Goal / Decisions / Approach / Steps — all prose, nothing binary. So review has no oracle and must answer the open question "what could be better", which always has an answer. Open questions don't terminate; binary ones do.
2. **Review mixes classes of finding.** `code-review/SKILL.md:27` groups by *severity* (blocker/important/nit), not by *class* (bug / spec violation / preference). A "nit" still reads as a work item, so preference-grade findings become code.
3. **The reviewer proposes solutions.** `code-review/SKILL.md:28` — "a suggested fix where obvious". The fix session has no standing to argue with a suggestion it inherits as text, so the reviewer's imagined architecture lands in the codebase. This is the single largest bloat vector in the loop.
4. **No fix mode exists.** Session C is unconstrained: fresh context, no idea why the code looks as it does, so it fixes defensively — new file, new layer, extra guard. `ponytail` is the antidote but is documented **slash-only** (`README.md:60`), so a fresh session starts *without* it unless the user remembers to toggle it. That is exactly why ponytail "did not resolve" the problem.
5. **Nothing counts rounds or declares done.** Sessions are fresh; the only cross-session memory is the plan file, and it records no review history. No round cap, no terminal verdict.
6. **No preference for mechanized checks.** `builder/SKILL.md:33-34` says run tests/lint, but nothing says *convert a review criterion into a failing test* — turning a recurring opinion into a fact that never re-litigates itself.

Not a gap: the deletion pass. `declutter` already exists and already reports-then-applies. It only lacks a cadence trigger.

## Options

**A — Patch existing bodies only.** Add acceptance criteria to the plan template, classification + no-solutions to `code-review`, a mechanized-check line to `builder`. No new skill, no new artifact. Cheapest and touches nothing structural — but leaves gap 4 open: nothing owns the fix session, so the paste-back step stays unconstrained and defensive. Rejected: gap 4 is where the bloat is actually produced.

**B — A, plus one new skill `remediate` (chosen).** Everything in A, plus a fix-from-review mode with a hard budget (no new files, no new dependencies, net lines must not increase, root cause only) that refuses to add a layer and escalates to `architect` when a fix won't fit the budget. Cross-session termination state lives in the *existing* plan file as a review log — no new document type. One new skill, five edited bodies, one README recipe.

**C — B, plus a dedicated `spec` skill and a separate round-ledger artifact.** Fullest control, but it adds a skill and a doc type to do what the plan file and the two planning skills already do. Rejected on this repo's own rule (`declutter`: never abstract speculatively) — and skillset bloating while preaching against bloat is the worst possible outcome.

## Chosen direction — B

Six changes:

**a. Plan template gains a spec and a budget** (`confidence/SKILL.md`, referenced by `architect`). Two new sections:
- `## Acceptance criteria` — binary must / must-not, ≤10 lines, each answerable yes/no by reading the diff.
- `## Budget` — expected files touched, new dependencies (default: none), rough line ceiling.
- `## Review log` — one line per round: `Round N — verdict, fixed X, deferred Y`. This is the loop's only cross-session state.

**b. `code-review` becomes an oracle, not a critic.**
- Read the governing plan in `docs/plans/` first when one exists; review against its acceptance criteria.
- Classify every finding: **bug** (wrong behavior, provable) / **spec violation** (contradicts an acceptance criterion) / **preference** (everything else). Bugs and spec violations are actionable; preferences go in a separate trailing section explicitly marked *not to be acted on*.
- **Name problems, never write solutions.** No code, no proposed implementation, no "extract this into…". Location + what's wrong + why it matters.
- Verdict is terminal: with zero bugs and zero spec violations, the verdict is **done — stop reviewing**, regardless of preference count.

**c. New skill `remediate`** (slug `sk-remediate`), the missing session C. Input is a pasted review report plus the plan. Rules:
- Act on bugs and spec violations only. Preferences are ignored by default and listed back as ignored.
- Budget: no new files, no new dependencies, net line count must not increase.
- Root cause, one guard where callers converge — not a patch per call site.
- A fix that can't fit the budget is **information, not an obstacle**: stop, report "this needs a design change", point at `/sk-architect`. Never add a layer to make a fix fit.
- Append the round line to the plan's Review log. **Two rounds is the cap** — after round 2, stop and report what remains rather than opening round 3.

**d. `ponytail` becomes installable in `always` mode** (body note + `README.md:60`). Its ladder is a build posture, not a communication switch like `caveman`; a fresh fix session must inherit it without a toggle. Body is 34 lines, well under the 80-line always-mode warning.

**e. `builder` gains one line:** any review criterion expressible as a failing test becomes a test — tests, types, and lint are facts and don't re-litigate; LLM review is opinion and does.

**f. `README` gains a "closed loop" recipe:** the five steps, the round cap, the deletion cadence (`/sk-declutter` every few features), and a recommended install profile — `builder` + `ponytail` `always`, `code-review` + `remediate` slash.

## Risks

- **Skillset bloating itself.** One new skill against eight existing. Mitigated by rejecting option C and by putting the loop's state in the existing plan file. If `intent-review` merges away (see open questions), skill count is unchanged.
- **Over-constrained remediation.** A legitimate fix may genuinely need a new file. Handled by design: that case escalates to `architect` instead of being silently allowed — but if it fires often, the budget is wrong.
- **Acceptance criteria as friction.** Writing ten binary lines before every change is real cost. Scoped to work that already gets a plan; trivial edits skip planning entirely (`architect`'s existing threshold).
- **Always-mode token cost.** Two always-mode bodies (`builder` 40 lines + `ponytail` 34) load every session. Real but small, and it is the price of fresh sessions inheriting constraints.

## Decisions (settled)

1. **`intent-review` is deleted.** Once `code-review` anchors on the plan, `intent-review`'s four categories (drift / scope creep / missing pieces / overengineering) are its spec-violation class plus overengineering — already covered by "newly-introduced bloat". Absorb both into `code-review`, remove `src/skills/intent-review/`, its README entry, and any test/docs references. Skill count stays flat: −1 `intent-review`, +1 `remediate`.
2. **`remediate` is its own skill**, not a flag on `builder`. Different input (a review report), different budget (net-lines-non-increasing), different terminal condition (round cap).
3. **Net-lines-non-increasing is a hard rule.** The escape is escalation to `architect`, not an override — a fix that won't fit is a design signal.
4. **`code-review` stays strictly read-only.** `remediate` writes the Review log line.
5. **Deletion cadence is a README line**, not machinery. → worth an ADR: *the review loop terminates on rounds, not on findings*.

## Work items

1. `confidence/SKILL.md` — plan template gains `## Acceptance criteria`, `## Budget`, `## Review log`.
2. `architect/SKILL.md` — plan artifact section names the same three; a plan without acceptance criteria isn't done.
3. `code-review/SKILL.md` — plan-anchored; bug / spec-violation / preference classification; no proposed solutions; terminal verdict; absorbs `intent-review`'s drift + missing-pieces checks.
4. `src/skills/remediate/SKILL.md` — new (slug `sk-remediate`), per the rules above.
5. `ponytail/SKILL.md` + README — `always` mode supported and recommended.
6. `builder/SKILL.md` — one line: a criterion expressible as a failing test becomes a test.
7. `README.md` — closed-loop recipe, install profile, deletion cadence; drop `intent-review`, add `remediate`.
8. Delete `src/skills/intent-review/` and its references (grep `intent-review` across `src/`, `test/`, `docs/`, `README.md`).
9. `docs/decisions/NNNN-review-loop-terminates-on-rounds.md` — the ADR from decision 5.
10. Tests: whatever bundle/smoke tests enumerate skills need updating for the −1/+1.

## Confidence

High. Shape is settled; remaining unknowns are mechanical (which tests enumerate the skill list). Awaiting explicit **go**.
