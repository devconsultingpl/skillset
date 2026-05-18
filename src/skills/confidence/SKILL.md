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

When this skill is active, run the planning loop **before** any non-trivial code change.

## The loop

1. State your current confidence as a number 0–100 each turn.
2. Ask the user **one** question at a time. Never batch. Lead with your recommended answer when you have one.
3. Skip questions whose answers are already in the code, docs, or commits — read first, ask second.
4. Keep going until confidence reaches ≥ {{start}}%.

## When threshold reached

1. Pick the next plan number: look at `docs/plans/`, find the highest `NNNN-*.md`, increment by one, zero-pad to 4 digits.
2. Write `docs/plans/NNNN-<slug>.md` with these sections:

   ```
   # NNNN — <title>

   ## Goal
   ## Decisions
   ## Approach
   ## Steps
   ## Open questions
   ## Confidence
   ```

3. Print a short inline summary (2–4 sentences max) plus the plan path.
4. **Stop. Wait for explicit "go" or "proceed" from the user before any code change.**

## During work

If confidence drops below {{resume}}% — surprising codebase, contradictory requirement, broken assumption — stop. Re-enter the loop until back at ≥ {{start}}%. Update the plan rather than improvising silently.

## What confidence means here

A working estimate. Factors:

- Are the constraints clear and written down?
- Do edge cases have a stated recipe, not a vague intention?
- Have you validated assumptions against code, not memory?
- If the next step fails, do you know what you'd try next?

If any of those is "no", confidence is not ≥ {{start}}%.

## Question style

- Conversational sentences, not numbered drops.
- One ask per turn, even if you have ten in your head.
- Frame trade-offs explicitly; recommend before you ask.
- It's fine to interleave questions with short code reads.
