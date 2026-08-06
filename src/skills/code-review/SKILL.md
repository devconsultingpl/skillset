---
name: code-review
version: "0.1.0"
description: Read-only review of the changes on this branch — local state vs origin's default branch, or a path/range you name. Reviews against the governing plan's acceptance criteria and classifies every finding bug / spec-violation / preference. Auto-activates on "review my changes / this diff". Names problems; never writes solutions, never edits.
slug: sk-code-review
---
# code-review

Read-only review of *the changes*: does this delta meet its spec, and is it correct and consistent with the codebase? Reviews the change — not the whole codebase. Pre-existing bloat is `declutter`'s, security depth is `appsec-review`'s, applying fixes is `remediate`'s.

## Project conventions
If the project carries them — `docs/goals.md`, `docs/conventions.md`, or `.flow/guidance/**/architecture.md` — read them first; they override these defaults.

## Scope the diff
- Default: everything that diverges from the repo's default branch on `origin`. Find it with `git symbolic-ref refs/remotes/origin/HEAD` (fall back to `origin/main`, then `origin/master`); diff its merge-base with `HEAD` against the working tree, so committed and uncommitted changes both show. Uncommitted work gets the hardest look.
- An argument narrows or redirects scope: `/sk-code-review in the payments module` (a path), or a commit range. Review that instead.
- Read outside the diff only to check "does this reinvent or duplicate something that already exists" — not to review unrelated code.

## Establish the spec first
- Find the governing plan in `docs/plans/` (the one matching the work) and read its **Acceptance criteria**, **Budget**, and **Review log**. That is the spec, and the round count.
- No plan and no stated intent → say so, review for bugs only, and note that everything else can only be preference.

## Classify every finding — the class is the point
- **bug** — provable wrong behavior: wrong edge case, swallowed error, hazard around concurrency/time/money/identity/untrusted input, visible injection or leaked secret, O(n²) in a hot path.
- **spec-violation** — contradicts an acceptance criterion, breaks the budget (new file, new dependency, blown line ceiling), contradicts a decision the plan made, or leaves a plan step undelivered. Convention breaks in `docs/conventions.md` count.
- **preference** — everything else: naming, structure, style, "could be cleaner", abstraction taste. Includes newly-introduced bloat that violates no criterion.

Unsure which class → the weaker one. A finding you can't tie to a criterion or a concrete failure is a preference.

## Name problems, never solutions
Location, what's wrong, why it matters. No code, no patches, no "extract this into…", no proposed design. A suggested solution becomes the next session's architecture without anyone deciding it should.

## Report
- **Bugs** and **Spec violations** first — actionable, `file:line` each. Then **Preferences**, in a trailing section headed *not to be acted on*.
- Real findings only. No praise, no restating what the code does. A clean diff gets a clean bill; returning "nothing actionable" is a complete answer.
- Terminal verdict, one line: **done — stop reviewing** when there are zero bugs and zero spec violations, no matter how many preferences remain. Otherwise **needs-fixes (round N)**, N from the plan's Review log +1.
- Read-only — write nothing, not even the log line (`remediate` owns it). May point ("`/sk-remediate` to fix these", "`/sk-declutter` for codebase-wide bloat") but never invoke another skill.
