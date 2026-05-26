---
name: intent-review
version: "0.1.0"
description: Read-only check of pending changes against the plan that motivated them. Flags drift from the plan, scope creep, missing pieces, and overengineering. Auto-activates when there are uncommitted changes and an open plan in docs/plans. Reports; never edits.
slug: intent-review
---
# intent-review

Read-only check: does the pending change match the intent it was meant to deliver? Activates when there are uncommitted changes and an open plan in `docs/plans/`, or when asked "did I cover the plan / am I doing too much". Skip if there's no stated intent to check against — say so rather than inventing one.

## Establish intent
- Find the governing plan in `docs/plans/` (the one matching the work), or use the intent the user states. If neither exists, stop and ask what to check against.
- Read the plan's goal, decisions, and steps. That's the spec.

## Check the diff against it
- **Drift** — changes that contradict a decision the plan made.
- **Scope creep** — changes the plan didn't call for (drive-by refactors, extra features).
- **Missing pieces** — plan steps with no corresponding change.
- **Overengineering** — abstraction, flexibility, or config the plan didn't ask for and nothing yet needs.

## Report
- Group findings under those four headings. Each: `file:line`, what it is, why it diverges from the plan.
- Read-only — propose nothing into files. End with a one-line verdict: faithful to the plan, drifting, or incomplete.
