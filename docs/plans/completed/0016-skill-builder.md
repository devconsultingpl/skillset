# 0016 — bundled skill: `builder`

Realizes 0012 Followup A (reserved as `0013-coder-conventions`) as a **skill**, not `conventions.md` content. Supersedes that reservation; 0014 (split-convention) unaffected.

## Goal

Ship a `builder` skill: a senior-engineer **build** posture for writing and changing code. Completes the role trio — `architect` plans, `confidence` drives to "go", `builder` builds. Holds no planning logic (would duplicate the other two); points at them for non-trivial work.

## Decisions

- **Build-only.** Governs *during*-implementation conduct. Defers planning + the "go" gate to `architect`/`confidence` via a one-line pointer. No mode-switching, no overlap.
- **Reverses 0012's "no implementer skill" call** (`0012-skill-architect.md:28`). Justification: this is concrete, enforceable guardrails default agents demonstrably break (≤15-line functions, mandatory codebase-search-before-abstraction, minimal diffs) — signal, not "write good code" noise. And a skill is reusable across all four agents and any repo, where conventions-content only helps repos that adopt the `docs/` scaffold. Record as an ADR in `docs/decisions/` at execute time.
- **Tight body is a hard requirement.** This repo pays token cost every session in `always` mode and warns over 80 lines (`README.md`, plan 0011). Target ≤55 rendered lines — terse imperative fragments distilled from the user's Engineering Principles doc, no prose, no redundancy. Mirrors `confidence` (~35 lines) / `convention` (~25).
- **Content** = the user's Engineering Principles, compressed, plus the two emphasized additions: *search the codebase for an existing solution before adding any abstraction/utility*; *small functions (≤15 lines target; larger needs a stated reason)*.
- **Slug = `builder`** (dir `src/skills/builder/`, command `/builder`). Verified conflict-free: no collision with existing/planned skill slugs (confidence, convention, architect, caveman, code-review, commit-suggestion, security-review, simplify) or CLI subcommands (install, uninstall, set-mode, update, list, init, emit).
- **Convention link = one-line pointer.** Body states precedence ("project `conventions.md` overrides these defaults") without re-reading the file — `convention`, if installed, already loads it. No hard dependency, no duplicate read.
- **Mode posture (honors the no-waste mandate):** recommend `auto` (loads only on implementation-task match) for claude-code/pi/opencode; `slash` (`/builder`) for Copilot, which has no `auto`. `always` is supported but discouraged — only if the user wants ambient enforcement and accepts the per-session cost.

## Proposed `src/skills/builder/SKILL.md`

```markdown
---
name: builder
version: "0.1.0"
description: Senior-engineer build posture for writing and changing code. Search before abstracting, minimal diffs, small functions, verify before done. Defers planning to architect/confidence.
slug: builder
---
# builder

Posture for *writing* code. For non-trivial design, plan first — `/architect`, then `/confidence` to "go". Project `conventions.md`, if present, overrides these defaults.

## Before changing
- Read the code first. Local patterns override general ones.
- Search the codebase for an existing solution before adding any abstraction or utility — grep likely names, types, modules. Reuse beats reinvent.
- Match existing style, naming, error handling, tests.

## While building
- Boring, obvious solution. New abstraction needs a concrete second caller.
- Solve what was asked. No scope creep. Minimal diff — no drive-by refactors.
- Small functions: ≤15 lines is the target. Larger needs a stated reason.
- One responsibility per function and file. Early return over nesting.
- Make invalid states unrepresentable where the language allows.
- Handle errors where there's context to act. Never swallow them.
- Extra care: concurrency, time, money, identity, untrusted input.

## Honesty
- Never fabricate APIs, signatures, or file contents. Read, or say you didn't.
- State load-bearing assumptions when proceeding without asking.
- Same approach failing twice → change strategy, don't loop.

## Verification
- Run tests, type-check, lint. Not done until verified. Can't verify here → say so.
- Cover new behavior, edge cases included.

## Before destructive ops
Confirm first: deletions, force-push, history rewrite, schema migration, prod credentials, billing, irreversible side effects.

## Reporting
Surface only what changed, what to verify, anything notable. Say up front if you skipped something asked. "Not sure" beats false confidence. Disagree once with reasoning and an alternative, then defer unless it's unsafe.
```

## Steps

1. Add `src/skills/builder/SKILL.md` with the body above. Confirm rendered body ≤80 lines (trim if over).
2. Wire `slash` + `auto` + `always` modes (auto/always trigger off the description).
3. Tests mirroring existing skills: slash render, auto render, bundle-includes-`builder` smoke.
4. README: one line adding `builder` to the bundled-skills list.
5. Write the ADR in `docs/decisions/` recording the 0012 reversal.
6. Move this plan to `docs/plans/completed/` when done.

## Confidence

~93%. Content, role-factoring, slug, and convention link all settled. Only remaining tuning is the final body trim under the line budget — cheap to revisit.
