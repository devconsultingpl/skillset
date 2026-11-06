# 0026 — suggestion queue triage, third pass; the always channel becomes harness-portable

## Goal

Clear `~/.skillset/suggestions.jsonl` — thirteen lines, all filed after 0025 closed — by adopting
eight, merging three duplicates into them, rejecting one new-skill proposal and denying one pi-harness
bug as out of scope. Every verdict is recorded below, because clearing the queue is an edit to that
file and a rejection with no record is a silent loss.

The second half is the developer's directive: skillset aims at the best possible version of itself
**per harness**, not the pi version everywhere. `standing-rules` and `instruction-ownership` are
`pi/always` only, although three other bridges already implement `always` — so today the five rules
bind in exactly one harness and no project opened in Claude Code, opencode or Copilot inherits them.

## Verdicts

| # | origin | verdict | lands on |
|---|---|---|---|
| 1 | empatyzer | adopt | `standing-rules` — secret rule |
| 2 | empatyzer | adopt, merged with 11 | `builder` |
| 3 | empatyzer | **deny** — no recurring instance; one refactor does not earn a skill | — |
| 4 | empatyzer | adopt | `architect` — hard rule |
| 5 | empatyzer | **deny for skillset** — `tool_search` hiding inactive tools is a pi-harness defect, filed to `pi-extensions` | — |
| 6 | empatyzer | adopt | `architect` — plan shape |
| 7 | devconsulting.pl | adopt | ingest line, 4 carriers |
| 8 | empatyzer | adopt narrowed — deletion hygiene, minus the `/tmp` half | `standing-rules` — sixth rule |
| 9 | empatyzer | adopt, merged with 4 | `architect` — hard rule |
| 10 | empatyzer | adopt narrowed — generic prerequisites, no AWS/CORS/empatyzer | `architect` — live verification |
| 11 | empatyzer | adopt, merged into 2 | `builder` |
| 12 | empatyzer | duplicate of 9 | — |
| 13 | empatyzer | adopt narrowed — precedence stated, not implied | `standing-rules` — comment rule |

Rejected sub-claims, with their reason:

- **#8's `/tmp` half.** Measured: `printf x > /tmp/probe` succeeded. `pi-permission-system/config/global-default.json`
  denies only `rm -rf *`; out-of-directory access is `external_directory: ask`. `/tmp` stays as the
  0600 file location the secret rule already names.
- **#8's glob half is kept**: `rm -f <dir>/*` is permitted by the policy above and destroyed an
  unversioned user file — so the rule is about naming paths, not about the policy.
- **#3** asks for a `behaviour-parity` skill from one instance (a temporary dual-run flag). Rung one
  of the reuse ladder: it does not need to exist yet.

## Acceptance criteria

1. `~/.skillset/suggestions.jsonl` holds **0** lines and all thirteen verdicts are in the table above.
2. `standing-rules` body and frontmatter say **six** rules; the sixth requires deletion by exact path
   created this session, forbids glob and `-rf` deletion, and sends scratch files to the repo's
   gitignored scratch directory.
3. The secret rule bans inventory/describe output that prints a whole resource configuration, bans
   derived values (length, hash, prefix) as a verification oracle, forbids hunting the transcript for
   leaks, and makes a leak a rotation rather than an investigation.
4. The comment rule states that a bar written in a project's own conventions doc wins, and that a
   repository's habit is not such a statement.
5. `architect`'s hard rule says an explicit go covers the **whole** plan (stopping at a phase boundary
   to re-ask is a defect; only deploys, migrations and destructive actions stay user-gated) and that a
   conditional pre-authorisation — "if ≥98%, start" — **is** the go.
6. `architect` requires every developer-gated step in one block, and a verification step that is
   runnable in the executing environment with its prerequisites resolved before it is written.
7. `builder` requires a heredoc append for multi-line appends and states that a multi-block edit is
   atomic.
8. The ingest line in all four carriers asserts ON/not-ON only, says an untoggled body is `auto` or
   `always`, and never asks the agent to determine which or to inspect config.
9. `skillset.config.json` declares `standing-rules` and `instruction-ownership` as `always` for
   `copilot`, `opencode` and `claude-code` at global scope, and `instruction-ownership`'s never-edit
   list names the Copilot paths.
10. `npm run build`, `npm test`, `npm run lint` are clean and `skillset sync` reports no drifted,
    missing or foreign artifact. *(Amended: the 8 `undeclared` local installs recorded for
    `devconsulting.pl`, `smart-lisp-repl` and a stale `/tmp/skillset-debug` pre-date this plan and stay
    untouched — clearing them is a `--prune` decision, not triage.)*

## Budget

| File | Change |
|---|---|
| `src/skills/standing-rules/SKILL.md` | +5 / −2 (sixth rule, secret clauses, comment precedence, counts) |
| `src/skills/architect/SKILL.md` | +4 (hard rule, developer block, runnable verification) |
| `src/skills/builder/SKILL.md` | +2 (append discipline, ingest line) |
| `src/skills/caveman/SKILL.md` | +1 / −1 (ingest line) |
| `src/skills/ponytail/SKILL.md` | +1 / −1 (ingest line) |
| `src/skills/skillset-status/assets/pi-extension.ts` | +1 / −1 (`INGEST_LINE`) |
| `src/skills/instruction-ownership/SKILL.md` | +1 (Copilot paths) |
| `skillset.config.json` | +24 physical lines (three install entries × 8 lines of JSON) |
| `test/agents-kind.test.ts` | +1 / −1 (hardcoded `checked in-sync 78` → derived from the install records) |
| `docs/decisions/0011-always-channel-is-per-harness.md` | new, ~35 lines (ADR appendix, filed) |
| this plan | untracked until the work lands |

New dependencies: **none**. Implementation-logic lines: **1** (the `INGEST_LINE` string).
Expected physical delta: **+37 net in source** (9 files), ceiling **+50** — raised from +30 on
2026-11-06 because the config's three declarations are 24 physical lines of JSON, not three lines,
and the test-count fix was not forecast. Both are recorded rather than absorbed.

## Harness parity, as implemented

| harness | `always` renders as | consequence |
|---|---|---|
| pi | marker block in `~/.pi/agent/APPEND_SYSTEM.md` | unchanged |
| opencode | marker block in `AGENTS.md` | full parity |
| copilot | `~/.skillset/copilot/copilot-instructions.md` | full parity; the user links it into the editor — the harness has no global auto-load |
| claude-code | one SessionStart hook per always skill in `~/.claude/settings.json` | best available on that harness: emitted at session start, not appended to a system prompt — it will not be as cheap as pi's |

→ worth an ADR: the always channel is per-harness generated content with unequal guarantees.
Draft appendix, filed as `docs/decisions/0011-always-channel-is-per-harness.md`.

## Decisions

- The queue is cleared by truncating its one file in place — no glob, exact path, and the verdicts
  above are the surviving record.
- Denying #5 leaves it with a home rather than dropping it: the entry is quoted in this plan, so the
  pi-extensions session that reads this plan inherits the report.
- `test/agents-kind.test.ts` pinned `checked in-sync 78` — a count that six new declarations break by
  construction. It now derives the number from the install records. That assertion was the same defect
  the plan's own ACs warn about, found by the change itself.

## Verification (measured, 2026-11-06)

| claim | command | result |
|---|---|---|
| new declarations triage cleanly | `skillset sync --dry-run` | `drifted 15 · missing 6 · undeclared 8 · in-sync 63` — the 15 are the edited bodies, the 6 are the new always declarations, the 8 are pre-existing |
| sync reconciles | `skillset sync` | exit 0, `reconciled undeclared 8 · in-sync 84` |
| sixth rule reaches three harnesses | `grep -c 'Delete only what you created'` on pi/opencode/copilot artifacts | `1`, `1`, `1` |
| claude-code hook is registered | `diff` of `~/.claude/settings.json` before/after | two `SessionStart` entries, `skillset emit instruction-ownership` / `standing-rules` |
| the hook emits a payload | `tsx src/cli.ts emit standing-rules` | `{"additionalContext":"# Standing rules…"}`, six sections |
| ingest line reaches every carrier | `grep -c` on the four installed carriers | `1` each (builder/ponytail/caveman prompts and skills) |
| pi always channel still under the warn line | `wc -l -w ~/.pi/agent/APPEND_SYSTEM.md` | 71 lines / 906 words (was 63/736) — under `ALWAYS_WARN_LINES_DEFAULT = 80` |
| suite and lint | `npm test`, `npm run lint` | 344 passed / 33 files; biome clean |
| queue emptied | `wc -l ~/.skillset/suggestions.jsonl` | `0` |

**Hypothesis:** whether Claude Code surfaces a `SessionStart` hook's `additionalContext` on every
session is not observable from here — it needs a fresh Claude Code session and is recorded as
hypothesis in the parity table, not as verified.

## ADR appendix — the always channel is per-harness

**Context.** `always` mode is installed per (skill, harness) with a different renderer each time. Only
pi appends to a system prompt; opencode anchors in `AGENTS.md`, Copilot writes an instructions file the
user must link, Claude Code writes a SessionStart hook into `settings.json`. Declaring two skills for
four harnesses multiplies the mechanisms, and the guarantee differs.

**Decision.** Declare `always` for every harness that can carry it, accept the per-harness degradation,
and state the guarantee per harness in the plan and in `docs/architecture.md`'s bridge section — rather
than withholding a rule from a harness that can only express it weakly.

**Consequences.** A rule now binds in all four harnesses with unequal fidelity; a broken renderer is a
silent loss of a standing rule, so `skillset sync` must stay the verification and a missing always
artifact must be visible in its report.

## Steps

1. Skill bodies: `standing-rules`, `architect`, `builder`, `caveman`, `ponytail`, `instruction-ownership`.
2. `INGEST_LINE` in the status extension.
3. `skillset.config.json` declarations; `docs/decisions/0011-always-channel-is-per-harness.md`.
4. `npm run build`, `npm run lint:fix`, `npm test`, `skillset sync --dry-run` → `skillset sync`.
5. Verify per harness: grep the rendered artifact in each of the four destinations.
6. Clear the queue; move this plan to `completed/` on sign-off.

## Open questions

- Claude Code's hook fidelity is not measurable from here without a fresh Claude Code session; it is
  recorded as **hypothesis** in the parity table, not as verified.
