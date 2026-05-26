---
name: code-review
version: "0.1.0"
description: Read-only review of the changes on this branch — local state vs origin's default branch, or a path/range you name. Flags correctness, readability, convention, and obvious security/perf issues at file:line with a severity tag. Auto-activates on "review my changes / this diff". Reports; never edits.
slug: code-review
---
# code-review

Read-only review of *the changes*: is this delta correct, clear, and consistent with the codebase? Activates on "review my changes / this PR / this diff", or `/code-review`. Reviews the change — not the whole codebase. Pre-existing bloat is `declutter`'s, plan-alignment is `intent-review`'s, security depth is `appsec-review`'s.

## Scope the diff
- Default: everything that diverges from the repo's default branch on `origin`. Find it with `git symbolic-ref refs/remotes/origin/HEAD` (fall back to `origin/main`, then `origin/master`); diff its merge-base with `HEAD` against the working tree, so committed and uncommitted changes both show. Uncommitted work gets the hardest look.
- An argument narrows or redirects scope: `/code-review in the payments module` (a path), or a commit range. Review that instead.
- Read outside the diff only to check "does this reinvent or duplicate something that already exists" — not to review unrelated code.

## What to flag
- **Correctness** — bugs, wrong edge cases, swallowed errors, hazards around concurrency/time/money/identity/untrusted input introduced here.
- **Readability & conventions** — unclear names, dead branches, style fighting the surrounding code. Judge against `docs/conventions.md` if it exists.
- **Newly-introduced bloat** — a premature abstraction with one caller, speculative flexibility, new duplication of existing code. (Pre-existing bloat → `declutter`.)
- **Obvious security/perf** — visible injection, unsafe input, leaked secret, O(n²) in a hot path. Flag it; defer *deep* analysis to `appsec-review` or a perf pass. Never stay silent because "that's another skill's job."

## Calibrate
- Real findings only. No praise, no restating what the code does, no nits the conventions don't back. A clean diff gets a clean bill.
- Each finding earns its severity; when unsure it's a problem, say so rather than inflate it.

## Report
- Group by severity: **blocker** (fix before merge) / **important** (should fix) / **nit** (optional).
- Each: `file:line`, what's wrong, why it matters, a suggested fix where obvious.
- Read-only — write nothing into files. May point ("run `/declutter` for codebase-wide bloat") but never invoke another skill. End with a one-line verdict: ship / ship-with-fixes / needs-work.
