---
name: confidence
version: "0.1.0"
description: Drive a question-led planning loop before any non-trivial work. Reach confidence ≥{{start}}% before writing code; write a plan to docs/plans and wait for explicit "go". If confidence drops below {{resume}}% mid-task, stop and re-question.
slug: confidence
config:
  start: 98
  resume: 95
---
# confidence

Run the planning loop **before** any non-trivial code change.

## Loop

1. State current confidence 0–100 each turn.
2. Ask **one** question. Recommend an answer first. Never batch.
3. Read code, docs, commits before asking — don't ask what's already written.
4. Continue until confidence ≥ {{start}}%.

Confidence is ≥ {{start}}% only if constraints are written down, edge cases have stated recipes, assumptions are validated against code (not memory), and you know your fallback if the next step fails.

## At threshold

1. Next plan number: scan `docs/plans/`, take the highest `NNNN-*.md`, increment, zero-pad to 4.
2. Write `docs/plans/NNNN-<slug>.md`:

   ```
   # NNNN — <title>

   ## Goal
   ## Decisions
   ## Approach
   ## Steps
   ## Open questions
   ## Confidence
   ```

3. Print a 2–4 sentence summary plus the plan path.
4. **Stop. Wait for explicit "go" before any code change.**

## Mid-task drop

If confidence drops below {{resume}}% — surprising code, contradictory requirement, broken assumption — stop. Re-enter the loop. Update the plan; don't improvise silently.
