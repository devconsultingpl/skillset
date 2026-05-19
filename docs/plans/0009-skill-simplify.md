# 0009 — bundled skill: `simplify`

## Goal

Ship a `simplify` skill in the bundled set. No existing personal version to port — research what "simplification" skills look like in the agent ecosystem, propose 2–3 designs, settle on one through brainstorming, then implement.

## Decisions

**Discovery + design plan.** Implementation specifics emerge from the brainstorming pass.

**Working definition of the skill.**
Review pending changes on the current branch for opportunities to: reuse existing code, remove unused code paths, collapse abstractions added prematurely, drop dead branches, tighten control flow, replace boilerplate with library calls already present. Then *apply the fixes* — unlike `code-review` which just reports, `simplify` proposes and applies edits.

**Compared to `code-review`.**
- `code-review` = report-only, multi-concern (correctness, readability, conventions, security).
- `simplify` = action-taking, single-concern (does this code need to exist?).
- The two should compose: run review first, run simplify to apply the trivially actionable findings. Not a hard dependency though.

**Out of scope for v0.**
- Cross-file refactors (e.g. extract module, rename across repo). Local diff–scoped only.
- Performance optimization. Different lens; would be its own skill.
- Renaming for clarity. Style, not simplification.

**Research surface.**
- Generic "clean up this diff" prompts in agent ecosystems.
- Refactoring catalogs (Fowler-style) for what counts as a simplification vs a stylistic change.
- The CLAUDE.md guidance baked into this very harness about not adding abstractions / not adding error handling for impossible scenarios — that's the philosophical fit. Skill body can lean on it directly.

**Three candidate axes.**
1. **Apply automatically vs propose-then-apply.** Auto-apply minor stuff (remove unused vars, collapse `if (x) return true; return false;`), confirm bigger ones. Or always propose first.
2. **Scope of pass.** Just the diff, or the diff + immediately-touched files (tests count).
3. **Output shape.** Edits only, or edits + short "removed/collapsed" summary, or full before/after diff per item.

## Approach

Research-and-design plan. Implementation steps decided after brainstorming.

## Steps

1. **Research.**
   - Find 2–3 existing "refactor / simplify" prompts in public agent skill collections.
   - Cross-reference with refactoring patterns (Fowler's catalog, "Extract" reversals).
   - Note this harness's own anti-over-engineering guidance (in CLAUDE.md) as primary philosophical anchor.
2. **Draft three options.** Each with one paragraph + sample interaction:
   - Option A: auto-apply trivial, propose major.
   - Option B: always propose first as a numbered list; apply on user confirmation per item.
   - Option C: diff-aware question loop — agent reads diff, asks "this abstraction looks premature — drop it?" one item at a time (mirrors confidence skill loop).
3. **Compare.** Trade-offs: trust required, edits-per-turn, rework cost when wrong, fits the user's collaboration style.
4. **Brainstorm with user.** Present + recommend. User picks or directs synthesis.
5. **Write implementation sub-plan.** SKILL.md content, modes, tests.
6. **Execute** — `src/skills/simplify/SKILL.md`, README mention, target tests.

## Open questions

- Should `simplify` ever delete files entirely (e.g. if a whole new file is unused)? Conservative answer: yes for files clearly created in this diff, no for pre-existing.
- Interaction model when applying edits: rely on the agent's own Edit tool, or emit a structured edit list the agent then applies? Probably the former — the skill is a *prompt* that drives the agent, not a tool.
- Does simplify need test-awareness (don't simplify away code that tests depend on)? Lean yes — at minimum, body instructs "run tests after applying."

## Confidence

≥90% on this discovery plan. Implementation confidence reassessed post-brainstorm.
