# 0004 — the review loop terminates on rounds, not on findings

## Context

The intended workflow is build → review → fix → review. In practice it never ended: a reviewer asked "what could be better" always has an answer, and each answer was pasted into a fresh session that had no idea why the code looked as it did, so it fixed defensively — a new file, a new layer, a guard for an impossible state. The codebase grew every round. Waiting for "no findings" is waiting for a condition an LLM reviewer will never report.

## Decision

**The loop ends on a round count, not on an empty finding list.**

- Plans carry **Acceptance criteria** (≤10 binary must / must-not lines) and a **Budget**. They are the review's oracle; without them a review can only produce preferences.
- `code-review` classifies every finding **bug** / **spec-violation** / **preference**. Only the first two are work. It names problems and never writes solutions — a suggested fix becomes the next session's architecture without anyone deciding it should.
- `remediate` fixes under a hard budget (no new files, no new dependencies, net lines not increasing) and appends one line per round to the plan's **Review log** — the loop's only cross-session state, since every session is fresh.
- **Cap: two rounds.** Not because round 3 finds nothing, but because what it finds costs more in code volume than it returns. Past the cap the user must ask explicitly.
- A fix that won't fit the budget is escalated to `architect`, never accommodated by adding a layer. The budget failing *is* the finding.

## Consequences

- `intent-review` is deleted. Once `code-review` anchors on the plan, drift / scope creep / missing pieces / overengineering are its spec-violation and preference classes.
- `code-review` stays strictly read-only; `remediate` (which already edits) owns the Review-log line.
- `builder` and `ponytail` are meant to be installed in `always` mode: constraints must be inherited by fresh sessions, not toggled by hand. Toggle-only constraints are exactly what failed.
- Preferences are recorded and discarded rather than acted on. Some real improvements are lost this way; that is the trade, and `declutter` on a quiet tree is the intended place to recover them.
- Nothing in the loop shrinks the codebase, so `/sk-declutter` every few features is part of the documented cadence rather than an occasional idea.
