# 0005 — allow recording multiple modes per (skill, agent, scope)

**Status: implemented** — by mode-scoped record identity rather than by a mode list on one record. See the note at the end of this decision.

## Context

Under pi, `architect`, `caveman`, `ponytail`, and `commit-suggestion` run as **both** slash prompts (`~/.pi/agent/prompts/`, recorded) and auto skills (`~/.pi/agent/skills/`, unrecorded). The reinstall guard blocks `skillset install … --mode auto` when a slash record already exists for the same (skill, agent, scope): "already installed … use `--force` or run `skillset set-mode`", and both escape hatches *delete* the slash prompt. The dual install is the real, deliberate setup — slash for explicit `/sk-x`, auto for description-matched loading — but the state model can't represent it.

Consequence: the auto dir is hand-managed and has drifted from `src/skills/` twice — synced back in `db1ed5c`, then again in the 2026-08 session, where `architect` carried two uncommitted improvements (`git mv` fails on untracked plan files; validate load-bearing claims by executing). `scripts/sync-pi-auto.mjs` re-syncs it on demand, but every future edit re-exposes the drift until the state model is fixed.

## Decision

Allow one record to carry **multiple modes**: `skillset install <skill> --mode auto` on an existing slash record adds the auto artifacts and the mode to the record instead of erroring (and vice versa). `set-mode` still swaps to a single mode. `uninstall` removes every artifact of the record's modes. `update` re-renders all modes, with per-mode divergence checks.

Rationale:
- The guard protects against *mode swaps* (stale artifacts lingering), not *mode additions* — adding is safe because `uninstall`/`update` already track every written artifact.
- Keeping the auto dir unrecorded makes it a permanent drift hazard — the exact failure this hit twice.

## Consequences

- `state.json` install records gain a mode list (version bump); `track`/`status` semantics unchanged.
- `--force` clears all modes of a record, not one.
- `sync-pi-auto.mjs` and conventions step 3 become unnecessary once records support dual mode; retire them.

## Implemented differently (2026-10-07)

Plan 0023 delivered this by making `mode` part of the **record identity** — `matchInstall` now keys on
`(skill, agent, scope, mode, projectPath)`, so one skill simply holds several records, one per mode.
The mode-list alternative above was dropped for three reasons:

- Recording two records is a smaller change than teaching every reader of a record to iterate modes
  (`update`, `uninstall`, `list`, `track`, the four targets, and the classification added since).
- No state migration: every existing single-mode record stays valid, so `version` remains 1.
- Removing an install becomes expressible per mode rather than all-or-nothing.

What this changes about the consequences above: there is **no version bump**, and `--force` no longer
clears the other mode — a different mode is a different install, so installing `auto` beside `slash`
keeps both artifacts and both records. `scripts/sync-pi-auto.mjs` is deleted and conventions step 3 is
replaced by `skillset sync`, as this ADR anticipated. Installing a second mode beside the first is
pinned by `test/cli.test.ts` ("records a second mode beside the first instead of replacing it") and by
`src/core/state.test.ts`.
