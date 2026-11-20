---
name: supervise
version: "1.0.0"
description: Run a plan end to end — decompose it into task files, then per task plan, build and review in rounds, reconcile the docs, run the four review lenses, and leave exactly one terminal artifact. Start it deliberately with a plan path; hidden, so it costs nothing until invoked.
slug: sk-supervise
targets:
  pi:
    argument-hint: "[plan path | brief]"
    disable-model-invocation: true
    contract:
      produces:
        kind: produces
        meta:
          artifactKind: run
        data:
          type: object
          required: [blockers_count]
          properties:
            status:
              enum: [in-progress, in-review, ready]
            blockers_count:
              minimum: 0
  claude-code:
    argument-hint: "[plan path | brief]"
    disable-model-invocation: true
---

# supervise

Supervise a plan to a reviewable end: decompose, per task plan → build → review → fix, the document pass, the run-scope review, one terminal artifact. Method here; enforcement of what it leaves behind is the harness's.

## Input

A plan path (preferred) or a brief. Read it before decomposing.

No acceptance criteria → stop after one line saying so: a loop without a spec produces a diff nobody can judge. A brief becomes a plan first — `architect`'s job, not this loop's.

## Modes

- **Default** — the whole loop, ending in the one terminal artifact.
- `--no-review` — stop after the document pass: no lens panel, no artifact. The caller reviews and reports; its report is not yours.
- `--finalize --provenance <file>` — no tasks, no lenses: fold `.flow/tasks/*.json` and the lens verdicts in `--lenses <dir>` (default `.flow/artifacts/verdicts/`), render the provenance block, and write the artifact. A directory, never a verdict: a handed conclusion is not a fold, and an artifact its author could not compute is a claim nobody checked.

Fold rule, both modes: `BLOCKED.md` iff a task is `blocked` or a lens verdict has `blockers_count > 0`.

## Provenance

`--finalize` renders what the caller observed — it ran neither the lenses nor the repair hops, so it derives nothing:

```text
Run: <run_id> · workflow: <workflow> · image: <image>
Final corrections: <rounds> round, accepted at round <accepted_round>
```

The file is JSON: `run_id`, `workflow`, `image`, `final_corrections{rounds, accepted_round}`. Rules:

- **Verbatim.** Every value prints as it arrived, `rounds` above 2 included — a count over the cap is the caller's bug, and the artifact exists to show it.
- **`unknown` for anything absent** — no file, unreadable, malformed JSON, missing key, missing `final_corrections`. Every line prints; a missing line is invisible.
- `accepted_round` of `null` prints `none`; absent prints `unknown`. Pluralise (`1 round`, `2 rounds`).
- Provenance never fails the run and never touches the fold: `READY` / `BLOCKED` stays decided once.
- Place it immediately after the H1 and its one-line plan title, before the first table.

## The loop

**1. Decompose.** One task file per task at `.flow/tasks/task-<n>.json`:

```json
{ "id": "task-1", "title": "…", "write_set": ["path"], "criteria": ["…"],
  "deps": [], "state": "pending", "rounds": 0 }
```

`state` is one of `pending`, `in-progress`, `done`, `blocked`. Cap the list at 12 tasks (hard 32) — past that the plan is transcribed, not decomposed. One task, one write set it can finish alone: unrelated paths in one task means it was two.

**2. Per task, in dependency order, serially.** One worktree, one writer:

- `task-planner` — only when the task has no obvious shape. Returns ≤15 lines, nothing else.
- `task-builder` — implements against `criteria[]` and `write_set[]`, runs the verification, returns paths changed and commands run.
- `task-reviewer` — adversarial, returns the verdict object (below).
- A blocking verdict goes back to `task-builder` with its `feedback` **only**; increment `rounds`. At 2 rounds the task is `blocked`, its verdict written, and the loop moves on — one unachievable task never consumes the run.

Write each verdict to `.flow/artifacts/verdicts/<basename>__<task-id>__<round>.json` (`<basename>` = the plan's filename, no extension). The reviewer returns three fields — `status`, `blockers_count`, `feedback`; **you** stamp `task` and `rounds`, because a child not told the round cannot know it. A read-only reviewer never writes.

**3. Document pass.** One `doc-updater` dispatch with the plan path, the changed paths and the terminal artifact's path. Never a second pass.

**4. Run-scope review — not the same thing as step 2.** One dispatch per lens, an existing body, never a new one: `code-review`, `appsec-review`, `declutter`, `convention` — plus plan alignment against the input's criteria. Their blockers fold into one verdict. At most twice — the second only after corrections.

A lens ships as a command, not always as an auto skill: hand the child the first that exists — command, skill body, slash prompt. A guessed path is a lens that silently does not run; one that resolves nowhere is reported as not-reached.

**Efficiency is a dimension of this review, never a gate.** The lens asks one question — *did this buy capability, or add weight nothing pays for?* — about instructions and context as much as code. It never increments `blockers_count`, so a run whose only findings are efficiency findings still ends `READY-FOR-REVIEW.md`.

**5. Report.** Exactly one terminal artifact at the worktree root: `READY-FOR-REVIEW.md` (what was built, per-task verdicts, how to review) or `BLOCKED.md` (per-task state, rounds spent, the last verdict's feedback), by the fold rule above. Both, or neither, is a failed run — `--no-review` writes none and says so in one line.

## The verdict

```json
{ "task": "task-4", "status": "in-review", "blockers_count": 2, "feedback": "criterion 3 unmet: …", "rounds": 2 }
```

`status` and `blockers_count` are `code-review`'s keys unchanged, `status` inside its enum (`ready` at 0 blockers, `in-review` otherwise). A task that exhausted its rounds is `blocked` in **its task file**, never in a verdict. `feedback` is one line per blocker, each with `file:line` and the literal line.

## Dispatch — the token doctrine

Bodies are hidden, so the loop is free until invoked. Every dispatch then obeys four rules:

- **Paths, never text.** The task file, the criteria, the write-set and artifact paths. The diff and the plan are read by the child that needs them, never re-sent per round.
- **No context inheritance.** Each child is spawned fresh; the parent's conversation never becomes its system prompt.
- **A tool set per role.** Planner and reviewer read-only, builder writes, doc-updater edits docs: fewer schemas per child, no role can wander.
- **A bounded return.** Findings or result only, ≤12 lines, no narration.

The dispatch prompt is exactly these four slots and no fifth:

```text
<!-- dispatch-prompt -->
task: {{task}}
criteria: {{criteria}}
write-set: {{write_set}}
artifacts: {{artifacts}}
```

## Reporting

Telegraphic: `task-3 review r1 → 2 blockers`, `run → READY-FOR-REVIEW.md`. Never restate a task, summarise a child twice, or quote a diff back.

## Availability

Without a subagent mechanism, do not pretend: run one bounded inline pass, write the artifacts you did produce, name what you did not reach in the terminal artifact's first line. Written either way, an enforcer downstream still has something to read.

## Resume

Read the task files: `done` is skipped, `blocked` is reported, `in-progress` restarts from its `rounds` count. No journal beyond the files.
