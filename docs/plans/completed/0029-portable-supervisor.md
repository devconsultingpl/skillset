# 0029 — the portable supervisor: a loop you can run on any harness, enforced where it runs

## Status: in progress — supersedes the earlier triage note (deleted, never committed). Blocks
`pi-extensions` plan 0030's shape and, through it, `devbox` plan 0002's last hop.

## Goal

One body that supervises work — decompose, then per task plan → build → review →
fix — usable **on the host, in any harness**, and cheap enough to leave running.
The graph in `pi-extensions` does not re-implement it: it dispatches this body and
enforces the artifacts it leaves behind. Method here, enforcement there.

```console
$ /sk-supervise docs/plans/0002-devbox-orchestrator.md     # host, any harness
$ /wf deliver "…"                                          # pi: same loop, floored
```

## Why here and not in the engine

ADR 0012's line — "instruction a second harness can run is skillset's, pi-only
machinery is flow's" — puts this body here for three reasons, in order of weight:

1. **It is wanted off-pi.** The developer's stated need is supervision while coding
   on the host, in whatever harness is in front of them. A `defineWorkflow` graph
   exists only where `@joozik/flow` is loaded.
2. **Nothing in it needs pi.** Its inputs are a plan, a working tree and a task list;
   its outputs are files. The harness supplies a subagent mechanism, or the body says
   what did not run (ADR 0009's availability rule).
3. **The engine keeps what is genuinely its own.** Caps, audit rows, routing and the
   terminal gate stay in flow as *deterministic floors over the body's artifacts* —
   the same posture `plan-cite-check` / `implement-scope-check` / `reconcile` already
   take over LLM-produced documents.

**One provider, one name.** The capability is provided once, here, and *dispatched*
by pi (ADR 0009's `auto` install makes it reachable as `/skill:supervise`). Flow
declares it in `EXTERNAL_SKILLS`; there is no second body in `packages/flow`. That is
the difference between this and a duplicated method: one body, one enforcer.

## The loop

1. **Decompose.** Read the brief/plan. Write one task file per task:
   `.flow/tasks/task-<n>.json` — `{id, title, write_set[], criteria[], deps[], state,
   rounds}`. Cap the list (default 12, hard 32 — the same ceiling every loop in this
   toolchain already has).
2. **Per task, in dependency order, serially** (one worktree, one writer):
   - `task-planner` — only when the task has no obvious shape: returns a ≤15-line
     plan, nothing else.
   - `task-builder` — implements against the task's `criteria[]` and `write_set[]`,
     runs the task's verification, returns `paths changed + commands run`.
   - `task-reviewer` — adversarial, reads the diff and the criteria, returns a
     verdict object (below), never prose findings dumps.
   - blocking verdict → back to `task-builder` with the verdict's `feedback` only;
     round count in the task file; at `K` rounds (default 2) the task is `blocked`
     and the loop moves on — one unachievable task never consumes the run.
3. **Document pass.** After the tasks: `doc-updater` reconciles the plan's status,
   README/AGENTS claims and any doc the change made false. One dispatch.
4. **Run-scope review — deep, and deliberately not the same thing as step 2.**
   One dispatch per lens, each reusing a body that already exists rather than a new
   one: `code-review` (correctness, security sinks, quality surfaces, interaction
   sweep), `appsec-review` (security depth), `declutter` (bloat, dead weight,
   deletion), `convention` (this project's own rules), plus plan-alignment against
   the brief's criteria. Their blockers fold into one verdict; at most twice — the
   second only after corrections.

   **Efficiency is a dimension of this review, never a gate.** The lens asks one
   question — *did this change buy capability, or did it add weight nothing pays
   for?* — about instructions, context and tokens as much as about code. It returns
   findings a human reads; it does not fail the run, and no rule here forbids a
   larger diff.
5. **Report.** Exactly one terminal artifact at the worktree root:
   `READY-FOR-REVIEW.md` (what was built, per-task verdicts, how to review) or
   `BLOCKED.md` (per-task state, the rounds spent, the last verdict's feedback).

## Token doctrine — the part that has to be measurable

Bodies are hidden (`disable-model-invocation: true`): **0 tokens per session**, paid
only on invocation. Then every dispatch obeys four rules:

| Rule | Why it is cheap |
|---|---|
| **A child receives paths, never text** — the task file, the criteria, the patch path | The plan and the diff are read once, by the child that needs them, not re-sent per round |
| **No context inheritance** — each child is spawned fresh with a task-scoped prompt | The parent's conversation never becomes a child's system prompt |
| **A restricted tool set per role** — planner/reviewer read-only, builder write, doc-updater docs only | Fewer tool schemas declared per child, and the roles cannot wander |
| **A bounded return shape** — findings/result only, ≤ 12 lines, no narration | The supervisor's own context grows by one verdict per task, not by a transcript |

Terse reporting is the body's own rule (telegraphic status lines, no restatement of
the task, no summary of what the child said twice), so the loop's context stays flat
as tasks accumulate.

## Discoverability, and what a session actually pays

Hidden bodies cost nothing per session — and they also stop auto-activation, which is
the trade this plan has to make explicitly rather than inherit. Measured on this
machine's installed bundle:

| State | Count | Per-session cost |
|---|---|---|
| `auto` + visible description (auto-activates from prose: `commit-suggestion`, `architect`, `builder`, `ponytail`, `caveman`) | 5 | **230 words ≈ 299 estTokens** |
| `auto` + `disable-model-invocation: true` (hidden, needs `/skill:<name>`) | 8 | 0 |
| flow's pointer precedent — 31 command names in one hidden-by-default message | 31 | 137 estTokens (≈4.4 per name) |
| pi-subagents' deferred-tool precedent — 0 bytes declared, one awareness line | 3 tools | 34 estTokens |

The rule this plan adopts, in the spirit of those two precedents:

- **A capability that must fire from prose stays visible, and pays.** "Suggest me a
  commit" working without a command is worth 53 words; the five together are ~300
  tokens, which is cheap for the only always-on surface the repository has.
- **A deliberate act is hidden, and is named in one index line.** The supervisor is
  started intentionally — `/sk-supervise`, or dispatched by pi — never inferred from
  prose. It costs 0 per session and is discoverable through the same index that
  already names the other commands, so a session knows *of* it without carrying it.
- **Content on demand, never up front.** Nothing about the loop, the artifact
  contract or the role roster belongs in an always-channel: the index names the
  command, the body carries the method, the task files carry the state.

Cheapest single win available, recorded but not required: `architect`'s description is
**63 words** — the largest of the five and the only one above the 50-word budget the
pi packages hold themselves to. Trimming it to 40 saves ~30 estTokens every session.

## The verdict — the seam the enforcer reads

```json
{ "task": "task-4", "status": "in-review", "blockers_count": 2,
  "feedback": "criterion 3 unmet: …", "rounds": 2 }
```

`status` and `blockers_count` are the shape `code-review` already declares (measured:
8 installed skills declare contracts; `code-review`'s is
`{required:["blockers_count"], properties:{status, blockers_count}}`), plus `task` and
`rounds` as the supervisor's own fields. Written to
`.flow/artifacts/verdicts/<basename>__<task>__<round>.json`, so a harness-specific
enforcer finds them by name and a human finds them by task.

## Decisions taken during implementation

**D-a — the index line lives in `context-pointer`.** skillset ships no command-roster body:
the pipeline index a session sees is emitted by the flow package, and this plan's
diff may not touch it (criterion 10). `context-pointer` is the only always-loaded
skillset body (`context` mode → `~/.pi/agent/AGENTS.md`), so two lines there name
`/sk-supervise` at 0 tokens of description. claude-code discovers it through the
slash menu instead — the honest limit of a pi-only anchor, recorded rather than
hidden. *Rejected:* a roster in `standing-rules` — that channel holds rules, not
catalogues (`docs/conventions.md`, *Rules every session loads*).

**D-b — the reviewer returns the verdict; the supervisor writes the file.** A
read-only reviewer cannot write `.flow/artifacts/verdicts/`, and giving it a write
tool to do so would let it edit the change under review. The seam stays one-way:
the child returns the object, the parent persists it. *Measured compatibility:*
flow's collector takes the **newest** `<basename>__<dimension>__*.json` since its
snapshot (`verdict-collector.ts:1-12`), so `dimension` = task id and the round
segment needs no enforcement from flow.

**D-c — decomposition stays in the body; `task-planner` is per task and on demand.**
Resolves the plan's open question in favour of the stated default: the planner runs
only for a task whose shape is not obvious, so a 4-task run makes 8 dispatches, not 12.

**D-d — the terminal artifact is decided by one rule.** `BLOCKED.md` iff any task ends
`blocked` or a run-scope lens still carries blockers after its second pass; otherwise
`READY-FOR-REVIEW.md`. Exactly one, always. An efficiency finding is advisory by
construction: it never increments `blockers_count`, so it cannot flip the rule.

**D-e — criterion 5's host run is deferred, its invariants are not.** The loop is an
instruction body, so a deterministic test can only police its artifacts. `test/` gains a
validator over a checked-in 2-task fixture, which makes a contract breach fail the
suite; the live run is listed in *Steps needing the developer* below, because it needs
real subagent dispatch and a scratch worktree, not this repository's tree.

## Steps needing the developer

- ~~Run `/sk-supervise <a 2-task scratch plan>` once on the host with no flow loaded.~~
  Executed during implementation — see *Recorded run*. Still owed: a run from a **fresh**
  session, since the supervisor here was the session that wrote the body.

## Acceptance criteria

1. `src/skills/supervise/SKILL.md` exists with `slug: sk-supervise` and
   `disable-model-invocation: true`, declared in `skillset.config.json` (`pi` auto +
   slash, `claude-code` slash); `src/core/portable-body.test.ts` passes over it — no
   `${SKILL_DIR}`, `$ARGUMENTS`, `shell-timeout`, ```` ```! ````, `ask_user_question`,
   `MAX_HEADER_LENGTH`.
2. Four agents exist under `src/agents/` — `task-planner`, `task-builder`,
   `task-reviewer`, `doc-updater` — each one-line description, `targets.pi.tools` and
   `targets.claude-code.tools` declared, registered under `agents` for both targets.
3. Word budget, measured with `wc -w` and recorded in this plan (×1.3 ≈ tokens):
   `supervise/SKILL.md` ≤ 900 words, each agent body ≤ 300 words, every agent
   `description` ≤ 15 words.
4. The index line names `/sk-supervise`, and a session in a fresh install knows the
   command exists without its body being in context: the measured per-session cost of
   the installed visible set is recorded in this plan and does not exceed 320
   estTokens.
5. A 2-task fixture run on the **host** with no flow loaded leaves: two task files,
   one verdict per review round, and exactly one of `READY-FOR-REVIEW.md` /
   `BLOCKED.md` — never both, never neither.
6. A task whose reviewer returns blocking findings twice is written `blocked` with
   `rounds: 2`, and the loop proceeds to the next task (no run-wide abort).
7. A dry-run dump of every dispatch prompt contains no conversation text: each
   prompt's only inputs are the task id, the criteria, the write-set paths and the
   artifact paths.
8. The verdict JSON validates against the shape in *The verdict*, and its
   `status`/`blockers_count` keys are byte-identical to `code-review`'s declared
   contract property names.
9. The run-scope review dispatches the four lenses named in step 4 (each a body that
   already exists — no new lens body), and its fold carries the efficiency finding as
   advisory: a run with only efficiency findings still writes `READY-FOR-REVIEW.md`.
10. `npm run build && skillset sync --dry-run` exits 0 with no drift; the declarations
    and agent-kind tests pass; no file changes in `pi-extensions` or `devbox` in this
    plan's diff.

## Criterion status — measured

| # | Status | Evidence |
|---|---|---|
| 1 | **met** | `slug: sk-supervise`, `targets.pi.disable-model-invocation: true`, config `pi` auto+slash + `claude-code` slash; `portable-body.test.ts` 4/4 |
| 2 | **met** | four agents, each with `targets.pi.tools` + `targets.claude-code.tools`, all 8 installs present, descriptions 14/12/11/13 words |
| 3 | **met** | `wc -w` body counts: supervise 827 (≤900), planner 212, builder 235, reviewer 256, doc-updater 197 (≤300 each) |
| 4 | **met** | index lines in `~/.pi/agent/AGENTS.md`; visible set 209 words ≈ **272 est** (≤320), unchanged |
| 5 | **met** | live run in `~/tmp/supervise-demo` (Recorded run below): 2 task files, 2 verdicts, one `READY-FOR-REVIEW.md` — the same tree the fixture validates |
| 6 | **met** | fixture task-2 `blocked`/`rounds: 2`, task-1 `done`, terminal artifact still written — asserted in `test/supervise-contract.test.ts` |
| 7 | **met** | the body's fenced dispatch prompt carries exactly `{{task}} {{criteria}} {{write_set}} {{artifacts}}`; the test fails on a fifth slot |
| 8 | **met** | `status`/`blockers_count` read from `code-review`'s own declared contract by the test, not copied by hand; the verdict's `status` stays inside its enum |
| 9 | **met** | body names the four existing lens bodies and marks efficiency advisory — it cannot increment `blockers_count`, so `READY-FOR-REVIEW.md` survives it |
| 10 | **met** | `skillset sync --dry-run` → `checked in-sync 98`, exit 0; full suite 360 passed, lint and typecheck clean; nothing touched outside this repo |

## Budget

**New dependencies:** none.

| File | Change | Est. physical lines |
|---|---|---|
| `src/skills/supervise/SKILL.md` | new — the loop, the doctrine, the artifact contract | ~140 |
| `src/agents/task-planner.md`, `task-builder.md`, `task-reviewer.md`, `doc-updater.md` | new | 4 × ~35 |
| `skillset.config.json` | `installs.supervise`, `agents.{4}`, `requires.supervise.pi = ["contract"]` | +14 |
| `src/core/portable-body.test.ts` | the new body joins the sweep as-is (no edit expected) | +0 |
| the index body (whichever `always`/`context` skill carries the command roster) | one line naming `/sk-supervise` beside the existing commands | +2 |
| `test/` | the fixture run of criteria 5–9 (script + expectations) + the per-session cost measurement | ~75 |
| `test/supervise-contract.test.ts` | **actual** — 7 tests: task schema, one verdict per round, contract-key identity, one terminal artifact, no run-wide abort, dispatch slots, word budgets | 177 |
| `test/fixtures/supervise-run/**` | **actual** — 2 task files, 3 verdicts, `BLOCKED.md` | 52 |
| `src/bridges/{pi,claude-code}/agents.test.ts`, `src/bridges/bridges.test.ts`, `test/agents-kind.test.ts` | **actual, unplanned** — the four roster counts pinned `15`, now `19` | 5 |
| **Total** | | **~370 actual ≈ 545** |

Application logic = the fixture harness (~75 lines, which includes the token-cost
measurement); everything else is instruction. Growth beyond ~420 without an amended
budget is a spec violation.

## Steps

1. Read `discover`/`architect` bodies and `slice`'s contract for the decomposition
   vocabulary, so the task file's fields are not a new dialect.
2. Write the four agent bodies first — they are the dispatch surface, and their word
   counts decide the supervisor's shape.
3. Write `supervise/SKILL.md`: the loop, the token doctrine table, the artifact and
   verdict contract, and the availability fallback ("no subagent mechanism → one
   bounded pass, name what you did not reach").
4. Declare everything; hide the body; put one line in the index body; run the
   portable-body sweep and the declarations tests.
5. Measure the installed visible set (`description` words × 1.3) before and after;
   write both numbers into this plan (criterion 4).
6. Build the 2-task fixture; run it on the host; assert criteria 5–9 — including a
   run whose only findings are efficiency findings, which must still end
   `READY-FOR-REVIEW.md`.
7. `wc -w` every new body; write the numbers into this plan; trim to budget.
8. `npm run build && skillset sync --dry-run`; hand `pi-extensions` the names to
   declare (`supervise`, and the four agents if flow dispatches them directly).

## Open questions

| Question | Recipe |
|---|---|
| Does the reviewer need `code-review`'s specialist passes at task scope, or is one adversarial read enough? | Compare a single `task-reviewer` dispatch against `/sk-code-review --file <write-set>` on the first two real tasks; task scope is small, a five-pass review is likely overkill |
| Is `doc-updater` a role or just the last task? | Step 5: if the document pass is always one dispatch of the same three files, it is a role; if it varies per plan, it is a task the decomposition emits |
| Does decomposition belong in the body or a `task-planner` dispatch? | The body holds it (it is the loop's own framing); the planner is for a task whose shape is not obvious — revisit if task files come back shallow |
| How does the loop resume after an interruption? | Read the task files: `done` tasks are skipped, `blocked` ones are reported, `in-progress` ones restart from their round count. No journal beyond the files |
| Does a harness without subagents still satisfy the contract? | ADR 0009's fallback: one bounded inline pass, naming what was not reached — the artifacts are written either way, so the enforcer still works |

## Confidence

**88%.** The placement is settled by ADR 0009/0012 and by the developer's need to run
it off-pi; the verdict shape is measured against `code-review`'s declared contract.
The residual is the token doctrine: the four rules are reasoned from how
`pi-subagents` builds a child session (own system prompt, no inheritance by default,
restricted tools), not yet measured as a per-run cost. Step 6 turns the budgets into
numbers; the first real 4-task run is where the per-dispatch overhead shows up.

## Review log

**Implementation pass (measured).**

- Roster counts: four existing tests pinned the agent roster at `15`; the four new agents
  make it `19`. Bumped in place — the assertions exist to catch a silently lost agent,
  and the intent survives the number change. Unplanned, hence the amended budget row.
- Verdict vocabulary: the plan's example showed `"status": "in-review"` only, while the
  reviewer body first said `blocked`. Resolved the other way — **one vocabulary per
  artifact**: `blocked` is the task file's `state`, a verdict's `status` stays inside
  `code-review`'s enum. Nothing downstream has to learn a second set of values.
- Dispatch prompt: the four slots are a fenced `text` block in the body, so the test
  asserts the slot set rather than trusting prose — a fifth slot now fails the suite.
- Efficiency-advisory claim: enforced structurally instead of by wording — the lens
  cannot raise `blockers_count`, and `BLOCKED.md` is written only when a task or a lens
  carries blockers.
- The reviewer stays read-only (D-b), so `rounds` is persisted by the supervisor; the
  fixture's filenames use flow's `<basename>__<dimension>__<slug>` convention verbatim.

Verification pasted:

```
npx vitest run           34 files, 360 tests, all passed
npm run lint             Checked 87 files. No fixes applied.
npm run typecheck        clean
skillset sync --dry-run  checked in-sync 98   (after 1 drifted + 11 missing on the first run)
installed                ~/.pi/agent/skills/supervise/SKILL.md (disable-model-invocation: true),
                         ~/.pi/agent/prompts/sk-supervise.md, ~/.claude/commands/sk-supervise.md,
                         4 agents × 2 harnesses, index line in ~/.pi/agent/AGENTS.md
```

Pending, and only the developer can run it: the live 2-task host run in *Steps needing the
developer*.

## Recorded run — `~/tmp/supervise-demo`

Executed end to end with real dispatch, no flow loaded: `PLAN.md` with three criteria,
decomposed into two task files, one builder round and one reviewer round per task, a
`doc-updater` pass, the four lenses, then the terminal artifact.

```
.flow/artifacts/diffs/task-1.patch
.flow/artifacts/diffs/task-2.patch
.flow/artifacts/verdicts/PLAN__task-1__1.json
.flow/artifacts/verdicts/PLAN__task-2__1.json
.flow/tasks/task-1.json
.flow/tasks/task-2.json
PLAN.md
READY-FOR-REVIEW.md
src/greet.js
src/greet.test.js
src/index.js
```

Both tasks `done` at round 1; every lens `blockers_count: 0`; `declutter` returned one
**advisory** (`src/index.js:1` has no consumer yet) and the run still ended
`READY-FOR-REVIEW.md` — criterion 9's invariant, observed rather than argued.

Dispatch prompts carried the four slots and nothing else. The builder respected its write
set in both tasks, and the second builder volunteered that a `"type": "module"` line would
belong to a different task — the boundary held without being policed.

**Two defects the live run found, both now fixed in the bodies:**

1. **`rounds` was unfillable.** The reviewer returned `"rounds": 0` — it cannot know the
   round, because the four-slot prompt does not carry it. Resolved as the plan already
   implied: `task` and `rounds` are *the supervisor's* fields, stamped when it persists the
   object; `task-reviewer` now returns three fields and is told why. A verdict with
   `rounds: 0` would have been silently wrong for any consumer reading recency.
2. **Three of four lens bodies are slash-only.** `declutter`, `convention` and
   `appsec-review` install as prompts (`~/.pi/agent/prompts/sk-*.md`), not as auto skills;
   only `code-review` has both. Both children hit `ENOENT` on
   `~/.pi/agent/skills/<lens>/SKILL.md` and recovered by reading this repository's source
   — a correct lens, by luck. The body now says: hand the child the first path that
   exists, and report a lens that resolves nowhere as not-reached rather than skipping it.

Neither defect is visible in a fixture. That is the argument for criterion 5 existing, and
the reason the fixture alone was not treated as proof.
