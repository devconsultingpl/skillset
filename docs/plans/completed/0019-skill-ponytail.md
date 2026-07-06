# 0019 — bundled skill: `ponytail` (minimal-code mode)

## Goal

Add `ponytail` to the bundled skill set: a session-mode toggle that switches the agent to
lazy-senior-dev YAGNI building — stdlib before custom code, native platform before
dependencies, one line before fifty. Companion to `caveman`: caveman governs how the agent
*talks*, ponytail governs what it *builds*. Both on together = full lazy mode.

## Research

- Upstream [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (~75k stars)
  positions itself as orthogonal to caveman — its own Boundaries section says
  "pair with Caveman for terse prose." Merging the two into one skill was considered and
  rejected: it would break independent toggling (terse prose + thorough engineering, or
  minimal code + normal prose, are both real states).
- A Scott Logic benchmark critique showed a 7-word prompt ("Follow YAGNI principles, and
  one-liner solutions") beating ponytail's ~100-line skill on its own benchmark. Lesson:
  distill hard — take the distinctive ideas (the ladder, root-cause fixes, the
  `skipped: X, add when Y` output pattern, the never-simplify guardrails), skip the bulk.

## Decisions

**Separate skill, not a caveman merge.** Orthogonal axes (prose vs code); composable via the
active-skill mechanism (ADR 0002) — `/sk-caveman` + `/sk-ponytail` both on is the combined mode.

**Two states, not four.** Upstream has lite/full/ultra; we ship `on` (≈ upstream full) / `off`,
mirroring caveman's 0007 decision — intermediate levels rarely get picked.

**Keep the name `ponytail`.** Memorable, credits the upstream idea (same reasoning as keeping
`caveman` in 0007). Slug `sk-ponytail` per the mandatory `sk-` convention.

**Slash-only.** A manual mode switch, exactly like caveman — `auto`/`always` make no sense.

**Body target: ≤ 30 lines.** The ladder (7 rungs), understand-first + root-cause rule,
persistence, output pattern, never-simplify-away guardrails, `sk-builder` precedence line.

**Division of labor vs `builder`:**
- `builder` stays the always-good baseline posture; gains the two uncontroversial rungs it
  lacks — stdlib/native platform before custom code, never add a dependency for a few lines.
- `ponytail` is the dial-up toggle (question the requirement, deletion over addition,
  `skipped/add-when` reporting). Precedence when both speak: ponytail wins while active.
- `caveman` gains one boundary line pointing at `/sk-ponytail` (mirror of upstream's pairing).

## Steps

1. Author `src/skills/ponytail/SKILL.md` (frontmatter: name `ponytail`, slug `sk-ponytail`).
2. Add boundary line to `src/skills/caveman/SKILL.md`.
3. Add the two ladder rungs to `src/skills/builder/SKILL.md`.
4. Tests (mirror caveman's coverage in `test/cli.test.ts`): listed in `list`; slash install on
   claude-code asserts description + body markers; slash install on all four agents lands files.
5. README: `ponytail` line under Bundled skills.
6. Lint, typecheck, test.

## Confidence

≥98%. Pure content addition riding existing install machinery; no core code changes.
