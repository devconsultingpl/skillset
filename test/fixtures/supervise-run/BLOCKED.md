# BLOCKED

Run over `0002-demo.md` — one task blocked, everything else landed.

- `task-1` — **done**, 1 review round, 0 blockers.
- `task-2` — **blocked** after 2 rounds; the loop moved on rather than aborting the run.
  Last verdict: `src/cli.ts:41 — still prints to stdout; the exit code is set after the write`.

Re-run `/sk-supervise 0002-demo.md` after fixing the usage-line path; `task-1` is skipped
because its state is `done`, `task-2` restarts from round 2.
