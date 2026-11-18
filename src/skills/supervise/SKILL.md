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

Supervise a plan to a reviewable end: decompose, then per task plan → build → review → fix, then the document pass, then the run-scope review, then one terminal artifact. The method is this body; the enforcement of what it leaves behind is whatever harness reads the artifacts.

## Input

A plan path (preferred) or a free-text brief. Read it before decomposing.

If it carries no acceptance criteria, stop after one line saying so: a loop without a spec produces a diff nobody can judge. A brief becomes a plan first — that is `architect`'s job, not this loop's.

## The loop

**1. Decompose.** One task file per task at `.flow/tasks/task-<n>.json`:

```json
{ "id": "task-1", "title": "…", "write_set": ["path"], "criteria": ["…"],
  "deps": [], "state": "pending", "rounds": 0 }
```

`state` is one of `pending`, `in-progress`, `done`, `blocked`. Cap the list at 12 tasks (hard 32) — past that the plan is not decomposed, it is transcribed. A task carries one write set it can finish alone; several unrelated paths in one task means it was two tasks.

**2. Per task, in dependency order, serially.** One worktree, one writer:

- `task-planner` — only when the task has no obvious shape. Returns ≤15 lines, nothing else.
- `task-builder` — implements against `criteria[]` and `write_set[]`, runs the verification, returns paths changed and commands run.
- `task-reviewer` — adversarial, returns the verdict object (below).
- A blocking verdict goes back to `task-builder` carrying the verdict's `feedback` **only**. Increment `rounds` in the task file. At 2 rounds the task is `blocked`, its verdict is written, and the loop proceeds to the next task — one unachievable task never consumes the run.

Write each verdict to `.flow/artifacts/verdicts/<basename>__<task-id>__<round>.json`, where `<basename>` is the plan's filename without extension. The reviewer returns three fields — `status`, `blockers_count`, `feedback`; **you** stamp `task` and `rounds` when persisting, because those are the loop's bookkeeping and a child that was not told the round cannot know it. A read-only reviewer never writes.

**3. Document pass.** One `doc-updater` dispatch with the plan path, the changed paths and the terminal artifact's path. Never a second pass.

**4. Run-scope review — not the same thing as step 2.** One dispatch per lens, each an existing body, never a new one: `code-review` (correctness, security sinks, quality, interaction sweep), `appsec-review` (security depth), `declutter` (bloat, dead weight), `convention` (this project's own rules), plus plan alignment against the input's criteria. Their blockers fold into one verdict. At most twice — the second only after corrections.

A lens ships as a command, not always as an auto skill: hand the child the first that exists — the command, the skill body, the slash prompt. A guessed path is a lens that silently does not run; one that resolves nowhere is reported as not-reached.

**Efficiency is a dimension of this review, never a gate.** The lens asks one question — *did this change buy capability, or add weight nothing pays for?* — about instructions and context as much as about code. It returns findings a human reads; it never increments `blockers_count`, so a run whose only findings are efficiency findings still ends `READY-FOR-REVIEW.md`.

**5. Report.** Exactly one terminal artifact at the worktree root: `READY-FOR-REVIEW.md` (what was built, per-task verdicts, how to review) or `BLOCKED.md` (per-task state, rounds spent, the last verdict's feedback). `BLOCKED.md` iff any task ended `blocked` or a lens still carries blockers after its second pass. Both, or neither, is a failed run.

## The verdict

```json
{ "task": "task-4", "status": "in-review", "blockers_count": 2, "feedback": "criterion 3 unmet: …", "rounds": 2 }
```

`status` and `blockers_count` are `code-review`'s declared keys, unchanged, and `status` stays inside its enum: `ready` when `blockers_count` is 0, `in-review` otherwise. A task that exhausted its rounds is `blocked` in **its task file**, never in a verdict — one vocabulary per artifact. Never a findings dump: `feedback` is one line per blocker, each carrying `file:line` and the literal line.

## Dispatch — the token doctrine

Bodies are hidden, so the loop is free until invoked. Every dispatch then obeys four rules:

- **A child receives paths, never text.** The task file, the criteria, the write-set paths, the artifact paths. The diff and the plan are read by the child that needs them, never re-sent per round.
- **No context inheritance.** Each child is spawned fresh; the parent's conversation never becomes a child's system prompt.
- **A tool set per role.** Planner and reviewer read-only, builder writes, doc-updater edits docs. Fewer schemas per child, and no role can wander.
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

Telegraphic status lines: `task-3 review r1 → 2 blockers`, `task-3 review r2 → blocked`, `run → READY-FOR-REVIEW.md`. Never restate a task, never summarise a child's report twice, never quote a diff back to the developer.

## Availability

Without a subagent mechanism, do not pretend: run one bounded inline pass over the tasks, write the artifacts you did produce, and name what you did not reach in the terminal artifact's first line. The artifacts are written either way, so an enforcer downstream still has something to read.

## Resume

Read the task files: `done` is skipped, `blocked` is reported, `in-progress` restarts from its `rounds` count. No journal beyond the files.
