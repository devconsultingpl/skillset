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

## Design pass — converged decisions (2026-05-23)

Brainstorm with the user **reframed** the skill — and **renamed it `simplify` → `declutter`** — from a diff-scoped "does this need to exist" cleanup into a whole-codebase anti-bloat pass. These override the originals — in particular the original "local diff-scoped only" is now **reversed**, and references to `simplify` below are the new `declutter`.

**Scope → the whole codebase, not the diff.** `declutter` surveys the project for bloat: dead code, duplication, premature/leaky abstractions, things that can collapse. `code-review` owns the per-change line-level review; `declutter` owns the global structural picture.

**Bloat boundary with `code-review` — pre-existing only.** `declutter` owns *pre-existing, codebase-wide* bloat. Bloat that a change *introduces* (a new premature abstraction, new duplication of existing code) is `code-review`'s — it's in the delta. So `declutter` is the skill you run on a quiet tree to find what has accreted, not the one that polices a fresh diff.

**Lens → bloat & maintainability first; correctness preserved, flagged in passing.** Goal is *less to maintain*, not maximal austerity. It must not break behavior, and it surfaces correctness smells it trips over — but it does not actively bug-hunt. Active correctness auditing of unchanged code is out of scope (no skill owns that gap yet — noted, not filled here).

**"Simpler" can mean *adding* an abstraction.** Consolidating existing duplication behind one obvious abstraction counts as simplification when it cuts maintenance. Constraint that keeps it consistent with `builder` ("new abstraction needs a concrete second caller"): only abstract over **existing** duplication — ≥2 real callers already present. Never speculative.

**Operating model → report-first, apply on approval.** A whole codebase is too big for one pass and blanket auto-edits are high blast-radius. So: survey → prioritized simplification report (biggest wins first, each with location + maintenance/size payoff + risk) → apply only the items the user approves → run tests after applying. This supersedes the original "action-taking, apply the fixes" framing: it still applies edits, but gated behind an approved report rather than auto-applied.

**Still out of scope.** Pure performance optimization (different lens, own skill). Renaming purely for clarity (style, not bloat). Cross-cutting architectural rewrites (that's `architect` territory).

**Name → `declutter` (resolved, was `simplify`).** Renamed to name the actual job — remove accreted bloat — and to kill the "make code simple / strip abstractions" misread, which is explicitly *not* the goal. Plan file, slug, and future skill dir (`src/skills/declutter/`) all use `declutter`.

**Trigger mode → slash-only.** A whole-codebase survey that then applies edits should never fire on a weak description match — it's deliberate by nature. Invoke `/declutter` (optionally `/declutter <area>` to scope to a module). No `auto`, no `always`. (Contrast `code-review`, which is fine to auto-load.)

**Decided defaults (veto-able).**
- *Report shape:* findings ranked biggest-maintenance-win first; each = location, what it is, the payoff (size/maintenance), the risk of changing it, and a suggested action. Grouped by category (dead code / duplication / abstraction) secondarily.
- *Survey surface:* all maintained source including tests (duplicated test setup, dead helpers count). Flag obviously-dead config; don't churn prose docs.
- *Conventions:* read `docs/conventions.md` if present and judge against it; no hard dependency.
- *No hard chaining:* reports and may point ("this is a fresh-diff issue — `/code-review` owns it"), never auto-invokes another skill.

Design now locked at ≥98%. Purpose and every implementation-shaping call (scope, lens, operating model, mode, name) are fixed; what remains is pure authoring — SKILL.md body wording and the bundle test.
