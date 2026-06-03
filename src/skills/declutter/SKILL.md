---
name: declutter
version: "0.1.0"
description: Whole-codebase anti-bloat survey — hunts pre-existing dead code, duplication, and collapsible/premature abstractions, ranks the biggest maintenance wins, and applies the fixes you approve. Slash-only (/sk-declutter or /sk-declutter <area>). Run on a quiet tree, not a fresh diff (that's code-review).
slug: sk-declutter
---
# declutter

Whole-codebase anti-bloat survey: where has the project accreted dead code, duplication, and abstractions that cost more to maintain than they earn? Run `/sk-declutter`, or `/sk-declutter <area>` to scope to a module. "Simpler" means *less to maintain* — not stripping every abstraction. Run this on a quiet tree; policing a fresh diff is `code-review`'s job.

## What counts as bloat
- **Dead code** — unreachable branches, unused exports/functions/files, commented-out blocks, obsolete flags.
- **Duplication** — the same logic copied across call sites, near-identical functions, boilerplate a present library or existing helper already covers.
- **Premature / leaky abstraction** — indirection with one real caller, speculative config or flexibility nothing uses, wrappers that only forward.
- Survey all maintained source, tests included (duplicated setup, dead helpers count). Flag obviously-dead config; leave prose docs alone.

## Lens
- Bloat and maintainability first. Preserve behavior — never change what the code *does*. Note any correctness smell you trip over; don't go bug-hunting (not this skill's job).
- "Simpler" may mean *adding* one abstraction to absorb existing duplication — but only when ≥2 real callers already exist. Never abstract speculatively (the rule `builder` follows).
- Judge against `docs/conventions.md` if present.

## Out of scope
Performance tuning, renaming for clarity, and cross-cutting architectural rewrites (those go to `architect`). This is removal of accreted bloat, not redesign.

## Operate: report first, then apply
1. **Survey, then report.** Rank findings biggest-maintenance-win first; each: `file:line`, what it is, the payoff (lines/maintenance saved), the risk of changing it, suggested action. Group by category second.
2. **Wait for approval.** The user picks which items to act on — apply nothing unasked. A whole codebase is too big to edit blind.
3. **Apply** the approved items, then run tests / type-check / lint. Not done until green.

May point ("that belongs in a fresh-diff review — `/sk-code-review`") but never invoke another skill.
