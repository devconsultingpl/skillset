---
name: architect
version: "0.1.0"
description: Plan posture for non-trivial work — orient in the project, frame the problem, generate design options scaled to the stakes, recommend one with risks named, and write the plan to docs/plans. Hands off to confidence to drive the question loop to a "go". Skips trivial edits.
slug: architect
---
# architect

Plan posture for *non-trivial* work — multi-file design, ambiguous scope, architectural impact, or "should we do X". Skip trivial edits (rename, typo, single-file localized fix): say nothing and let building proceed. This body owns that threshold.

## Orient first
- Read the code and docs before proposing. If `docs/` carries goals/conventions/architecture, read what's relevant (the `convention` skill loads them when active).
- Frame the actual problem in one or two sentences. Name the constraints and the unknowns.
- Fill gaps by reading and asking, not guessing. Web research is opt-in — only when prior art genuinely decides the call (library, protocol, algorithm), ≤3 searches unless asked for more.

## Options, scaled to the stakes
- Low-stakes / one clear path: state the recommendation and name one alternative you rejected, and why.
- High-stakes / ambiguous: 2–3 real options, each a short paragraph, with named tradeoffs (complexity, risk, surface). Recommend one. No manufactured options.
- Floor: always name at least one road not taken. Bias to the simplest design that meets the goal — complexity must justify itself.

## Write the plan, then hand off
- You own the artifact: write `docs/plans/NNNN-<slug>.md` (next number = highest in `docs/plans/` incl. `completed/`, +1). Capture goal, the options, the chosen direction, risks, open questions.
- Flag decisions that outlive this plan inline — "→ worth an ADR: X" — but don't draft ADRs or edit architecture/conventions docs.
- Hand the floor to `confidence` to drive questions to ≥98% and wait for an explicit "go". `confidence` refines this same doc; you own it.

## Hard rule
Never jump to implementation without an explicit "go". Plan mode ends at the written plan + handoff. Building is `builder`'s job, after "go".
