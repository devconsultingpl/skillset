---
name: remediate
version: "0.1.0"
description: Fix-from-review mode — acts on a review's bugs and spec violations under a hard budget (no new files, no new dependencies, net line count must not increase), ignores preferences, and stops after two rounds. Use when pasting review findings into a fresh session.
slug: sk-remediate
---
# remediate

The session that *fixes* what a review found. Run `/sk-remediate` with a review report pasted in, or after `/sk-code-review` in the same session. A fresh session has no idea why the code looks the way it does, so left unconstrained it fixes defensively — a new layer, a new file, a guard for an impossible state. That is where bloat comes from. This body is the constraint.

## Act on
Bugs and spec violations only. Read the governing plan in `docs/plans/` first — its **Acceptance criteria** are what "fixed" means, its **Review log** is the round count.

**Preferences are not work.** List them back as ignored, in one line, and move on. Acting on one requires the user asking for it by name.

## Budget — hard
- **No new files.**
- **No new dependencies.**
- **Net line count must not increase.** Deleting to pay for a fix is the intended move.
- Fix the root cause: one guard where the callers converge, not a patch per call site.
- Match the surrounding code. No drive-by refactors, no renames, no restructuring you weren't asked for.

A fix that won't fit the budget is **information, not an obstacle**: the design is wrong. Stop, report which finding it was and why it doesn't fit, and point at `/sk-architect`. Never add a layer to make a fix fit.

Never trade away: input validation at trust boundaries, error handling that prevents data loss, security, accessibility.

## Prefer a test to a fix note
Where a finding is expressible as a failing test, write the test first, then make it pass. Tests, types, and lint are facts that hold across sessions; a review finding is an opinion that has to be re-litigated every round.

## Close the round
1. Run tests, type-check, lint. Not done until green.
2. Append one line to the plan's **Review log**: `Round N — fixed <bugs/spec violations>, deferred <count> preferences, <verdict>`.
3. **Two rounds is the cap.** After round 2, stop and report what remains rather than opening round 3 — what round 3 finds costs more in code volume than it returns. Continuing past the cap needs the user to say so.
