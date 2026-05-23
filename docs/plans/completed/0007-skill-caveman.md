# 0007 — bundled skill: `caveman` (compressed)

## Goal

Add `caveman` to the bundled skill set. The existing personal version at `~/.claude/skills/caveman/SKILL.md` is ~50 lines with four levels (off / lite / full / ultra). Ship a tighter canonical version: two states (off / on=ultra) and a body short enough to be cheap to load on every session.

## Decisions

**Two states, not four.** Drop `lite` and `full`. `on` = today's `ultra` (telegraphic, maximum compression). `off` = normal. Two levels covers the real use case: "I'm in a fast iteration loop, give me terse" vs "regular communication." Intermediate levels rarely got picked and doubled the spec size.

**Slug `/caveman`.** Argument: `on` (default), `off`.
- `/caveman` or `/caveman on` → activate.
- `/caveman off` → deactivate.

**Body target: ≤ 25 lines.** Aggressive cut from the 54-line original. Keep:
- One-line description (frontmatter).
- One-line state semantics: `on` = telegraphic / `off` = normal.
- Persistence rule: stays on every response until off or session end.
- Auto-clarity exception: drop caveman for security warnings + irreversible-action confirmations + multi-step ordered instructions.
- Code/commits/PRs unaffected.

**Drop from the original:**
- The `lite` and `full` rule blocks (gone — those levels removed).
- The Usage subsection enumerating four invocations (replaced by two-line frontmatter args).
- The verbose "What to do" steps — implicit from the rule.

**Reuse the existing `arguments:` field shape.** Frontmatter mirrors the personal version's pattern: `arguments` list with `level` (default `on`). Canonical skill format supports this — verify in `src/core/parse.ts` during impl; if not, propose a frontmatter extension as part of the plan.

**Bundled skill installs to slash mode by default.** Caveman is invocation-triggered, not auto. `always` and `auto` are nonsensical for a manual mode switch. Reject those modes for caveman with a clear error, or simply document slash-only support — decide at impl time based on how clean the rejection wiring is.

## Approach

1. Confirm canonical skill format accepts `arguments` field (or add support if not).
2. Confirm each target module renders arguments correctly for slash mode — slash is the only mode caveman supports.
3. Write `src/skills/caveman/SKILL.md`.
4. Tests: install on each agent in slash mode, snapshot file shape.
5. README mention in bundled skills list.

## Steps

1. **Check `arguments` support.**
   - Read `src/core/parse.ts` and `src/core/types.ts` for frontmatter schema.
   - Read each `src/targets/*.ts` for how slash files are rendered. Does any target propagate `arguments`?
   - If not supported: extend `Frontmatter` type + parser; emit each target's idiomatic representation (e.g., Claude `argument-hint` field, Copilot `description` mention). Track this as a separate Steps sub-list before writing the skill.
2. **Decide mode restriction.** Slash only. Either:
   - Add `supportedModes` per skill (frontmatter field) — slightly bigger feature, may be reusable for future skills.
   - Or just document and let the install command's existing per-target mode-rejection path handle weirdness. Lean toward the latter for now — minimal change.
3. **Author `src/skills/caveman/SKILL.md`.** ≤ 25 lines body, ≤ 5 lines frontmatter.
4. **Tests.**
   - Slash install on claude-code → `.claude/commands/caveman.md` shape includes the description.
   - Slash install on pi / opencode / copilot — file shape consistent with other slash installs.
   - Frontmatter arguments propagate (or are noted in body if no native support).
5. **README.** Add `caveman` line under Bundled skills, one-liner: "compresses your communication to telegraphic style for fast iteration loops."
6. **Lint, typecheck, test.**

## Open questions

- Does the canonical format already accept `arguments`? Step 1 answers.
- If not, is extending frontmatter in-scope for *this* plan or a prerequisite plan? Lean in-scope if extension is < 30 LoC + 1 test. Otherwise spin out.
- Naming: keep `caveman` or rebrand? Sticking with `caveman` — it's memorable and the user uses it personally.

## Confidence

≥97%. Open question on `arguments` support could expand scope; will resolve at step 1.
