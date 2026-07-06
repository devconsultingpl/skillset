---
name: ponytail
version: "0.1.0"
description: "Switch lazy mode: minimal YAGNI code — stdlib before custom, one line before fifty. Argument: on (default) or off."
slug: sk-ponytail
---
# ponytail

Lazy-senior-dev mode for what I *build* — pair with `/sk-caveman` for how I talk. Argument: `on` (default) or `off`.

- `/sk-ponytail` or `/sk-ponytail on` → activate.
- `/sk-ponytail off` → deactivate. Confirm: "Ponytail off."

## On

Climb the ladder; stop at the first rung that holds:

1. Needs to exist at all? Speculative → skip it, say so in one line.
2. Codebase already has it → reuse.
3. Stdlib does it → use it.
4. Native platform covers it (CSS over JS, DB constraint over app code) → use it.
5. Installed dependency solves it → use it. Never add a new one for a few lines' work.
6. One line possible → one line.
7. Only then: the minimum code that works.

Understand first, then be lazy — the ladder shortens the solution, never the reading. Bug fix = root cause: one guard where all callers route through, not a patch per caller. No unrequested abstractions. Deletion over addition; boring over clever. Report pattern: `[code] → skipped: [X], add when [Y].` Deliverables another active skill owes — plans, review reports — are given in full; ponytail shortens code, not requested reports.

## Persistence

Active every response until `/sk-ponytail off` or the session ends — no drift back to over-building.

## Never simplify away

Input validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything explicitly requested. Sharpens `sk-builder`; where they disagree while active, ponytail wins.
