# 0025 — suggestion queue triage, second pass (2026-10-15 → 2026-10-17)

## Goal

Resolve the thirteen lines sitting in `~/.skillset/suggestions.jsonl` — all filed after plan 0024
closed, one from `pi-extensions`, the rest from `empatyzer-serverless` and this repository. Ten are
adopted (six as body edits, four as one-line clauses), one is adopted in a narrowed form, and two
halves are rejected. Each verdict is recorded here, because clearing the queue is an edit to that
file and a rejection with no record is a silent loss.

Guidance-only change: eight skill bodies, five agent frontmatters, one conventions subsection, one
5-line executable asset. No implementation logic, no new dependency. `dist/` regenerates from
`npm run build`; installed copies from `skillset sync`.

Two of the thirteen are load-bearing beyond their own wording:

- **Secret values never enter context** — no such rule exists anywhere in `src/skills/` today
  (`grep -rn -i secret src/skills/` returns only diff-review and template hits). This is the only
  security item on the queue and the only one whose failure is permanent: a leaked value lives in
  the transcript forever.
- **The activation signal is wrong as written** — `pasted skill body = activation` cannot separate
  *toggled on* from *always on* from *merely available*. It fired against its own intent on
  2026-10-17: a session opened with `architect` + `caveman` + `ponytail` bodies pasted together,
  acknowledged all three as active, and was wrong — `ponytail` and `caveman` install as `pi/auto`
  (`skillset.config.json`), so two of the three were available, not on.

## Acceptance criteria

1. `standing-rules` carries a **fifth** rule — secret values never enter the agent context — and
   both the body line and the frontmatter `description` say five, not four.
2. That rule names the sanctioned shape: fetch into a `0600` file **without reading it**, reference
   it as `$(cat /tmp/…)` inside the command, delete it after; never `cat`/`echo`/`grep`/paste the
   value. It names the inline `VAR=$(aws secretsmanager …) cmd` form as the thing to avoid.
3. The `Code carries no comments` rule carries a precedence clause: a repository's comment-heavy
   style is not a licence, the stricter rule wins, and a project's own bar belongs in its
   conventions doc.
4. `grep -c 'One provider per name' ~/.pi/agent/APPEND_SYSTEM.md` is exactly **1** and that line is
   a pointer; the section's text lives in `docs/conventions.md`. The instruction-ownership
   "Why this is a rule" paragraph is one sentence.
5. `builder` carries the three edit-discipline bullets: whole-line `oldText`; >~5 edits or a move is
   a rewrite; a structural invariant check after the batch.
6. `architect` requires live verification phrased as **invariants**, forbids encoding observed
   counts as assertions, and requires marking risky claims **measured** vs **hypothesis**.
7. `architect` requires one line on what changes for already-covered cases when a plan widens an
   existing branch, and states that an external checklist's coverage lives in the mapping table
   while the ≤10 AC cap applies to grouped criteria.
8. `architect` permits a plan carrying recommended defaults plus an Open questions section when the
   user asks for the plan now, and anchors Review-log appends on the **end** of the previous block.
9. Every carrier of the ingest line (`builder`, `caveman`, `ponytail` bodies and `INGEST_LINE` in
   `src/skills/skillset-status/assets/pi-extension.ts`) distinguishes the three states; no copy
   asserts that a body arriving beside others is ON. `skillset-status` states that an untoggled body
   may be `auto` or `always`.
10. Five agents carry `model: deepseek-flash` under `targets.pi` only — `codebase-locator`,
    `codebase-pattern-finder`, `artifacts-locator`, `integration-scanner`, `web-search-researcher` —
    `grep -c '^model:' ~/.pi/agent/agents/*.md` reports exactly those five and no claude-code agent
    carries one, `npm test` is green, `npm run build` is clean, and `skillset sync` reports no drift,
    no foreign file and no refusal.

## Budget

| File | Change |
|---|---|
| `src/skills/standing-rules/SKILL.md` | +8 / −1 (fifth rule section, count wording ×2, precedence clause) |
| `src/skills/instruction-ownership/SKILL.md` | +1 / −8 (section moved out, "Why" compressed, pointer in) |
| `docs/conventions.md` | +8 (new `One provider per name` subsection, under Naming) |
| `src/skills/builder/SKILL.md` | +3 (edit-discipline bullets) |
| `src/skills/architect/SKILL.md` | +9 (invariants, measured/hypothesis, widening, AC external list, defaults + Open questions, Review-log anchor) |
| `src/skills/caveman/SKILL.md` | +1 / −1 (ingest line) |
| `src/skills/ponytail/SKILL.md` | +1 / −1 (ingest line) |
| `src/skills/skillset-status/SKILL.md` | +2 (three states; untoggled body may be auto/always) |
| `src/skills/skillset-status/assets/pi-extension.ts` | +1 / −1 (`INGEST_LINE`) |
| `src/agents/{codebase-locator,codebase-pattern-finder,artifacts-locator,integration-scanner,web-search-researcher}.md` | +1 each (`targets.pi.model` only) |
| `docs/decisions/0010-bundled-agents-pin-a-model-tier.md` | new, ~45 lines (ADR appendix, filed) |
| `src/skills/retro/SKILL.md` | +1 / −1 (pi row: Claude Code memory store) |
| `~/.skillset/suggestions.jsonl` | 13 lines removed (queue, outside the repo) |
| this plan | untracked until the work lands |

- New dependencies: **none**. Implementation-logic lines: **1** (the `INGEST_LINE` string).
- Expected physical-line delta: **+24 net**, ceiling **+40**. Growth past the ceiling is a spec
  violation, not a documentation allowance.
- Regenerated, never hand-edited: `dist/skills/**`, `dist/agents/**`, then the installs
  `skillset sync` writes (`~/.pi/agent/**`, `~/.claude/**`).
- `standing-rules` goes 30 → ~37 lines against the 80-line `ALWAYS_WARN_LINES_DEFAULT`
  (`src/core/body-size.ts`); the always-channel total is roughly flat, because the ~94 words gained
  here are the ~94 words moved out of `instruction-ownership` (both pi-only `always`).

## Decisions

**Verdicts on the queue.** Item numbers are the queue's line order in
`~/.skillset/suggestions.jsonl`.

| # | Filed from | Verdict | Where it lands |
|---|---|---|---|
| 1 | pi-extensions | **adopt, narrowed** | five agent frontmatters (`targets.pi`, tier name, not an id) |
| 2 | pi-extensions | **adopt** | `docs/conventions.md` + `instruction-ownership` |
| 3 | pi-extensions | **adopt** | `standing-rules`, precedence clause |
| 4 | empatyzer-serverless | **adopt** | `standing-rules`, fifth rule |
| 5 | empatyzer-serverless | **adopt, narrowed** | `builder`, three bullets of four |
| 6 | empatyzer-serverless | **reject** | see below |
| 7 | empatyzer-serverless | **adopt two thirds** | `architect`; todo-tool half rejected |
| 8 | empatyzer-serverless | **adopt** | `architect` |
| 9 | empatyzer-serverless | **adopt** | `architect`, Review-log anchor |
| 10 | empatyzer-serverless | **adopt** | `architect`, widening line |
| 11 | empatyzer-serverless | **adopt, narrowed** | ingest line ×4 + `skillset-status` |
| 12 | empatyzer-serverless | **adopt** | `retro` harness table |
| 13 | skillset | **adopt** | `architect`, defaults + Open questions |

**A tier name, never an id.** `models-store.json` on the authoring machine configures exactly
`openrouter`, `deepseek` and `openai-codex` — there is no `anthropic` provider — so the hardcoded
`anthropic/claude-haiku-4-5-20251001` that pi-subagents' own `Explore` agent ships with does not
resolve here; `resolveModel()` fails exact match, then reports "Falls back to your session model,
with a warning" (`pi-subagents/docs/model-policy.md`). The fuzzy rung resolves the name against
whatever the user has actually configured (`src/session/model-resolver.ts:97`), which is the only
form that survives a provider change, a plan change or a model rename.
→ worth an ADR: **bundled agents pin a model tier, not an id** (appendix below).

**`deepseek-flash`, decided by the developer, and pi-only.** Two independent reasons the pin does not
extend to `targets.claude-code`. First, the value resolved here as an exact id match on
`deepseek/deepseek-flash` (score 100 in `findBestFuzzyMatch`) because this machine runs the
`deepseek` provider; on a machine without it the same string still lands on
`openrouter/…deepseek-flash-latest` through the substring rung. Second, Claude Code's `model:`
accepts its own alias set and full ids, and `deepseek-flash` is neither — writing it there is at
best ignored and at worst a spawn failure. A *tier* name is therefore per-harness in practice even
though the rule is harness-neutral, and the ADR records that asymmetry rather than papering over it.
`deepseek-flash` is also already the session default here, so the five pins cost nothing against
today's default and only start paying when a session runs on something expensive.

**Reviewers stay unpinned — a lock, not a preference.** "Frontmatter is authoritative … those
values are locked for that agent; `subagent` tool parameters only fill fields the agent config
leaves unspecified" (`pi-subagents/README.md`, *Agent frontmatter*). Pinning `claim-verifier`,
`half`-reviewers or `slice-verifier` would therefore forbid the orchestrator's `model_reason`
escalation exactly where it is documented to matter (`pi-subagents/docs/model-policy.md`,
*Choosing a model*). Pinning the five retrieval agents costs nothing: none of them needs escalation,
and a hard task spawns `general-purpose` instead.

**Five, not nine, agents.** `codebase-locator`, `artifacts-locator`, `integration-scanner` and
`codebase-pattern-finder` are retrieval; `web-search-researcher` is named in flow's own
`docs/models-config.md` as part of the pattern. The analyzers (`codebase-analyzer`,
`artifacts-analyzer`, `precedent-locator`) and `scope-tracer` synthesize and produce judgment —
they inherit. Pinning `thinking` is skipped until retrieval turns prove noisy (see Open questions).

**Rejected: the claim-verifier scope cap (item 6).** The suggestion asks for "at most N findings plus
a time budget". The agent's contract is an *identity* obligation — "One row per input claim — no
skips, no merges, no splits, no additions" (`src/agents/claim-verifier.md`, *Output Format*) — so a
findings ceiling is an instruction to silently drop claims, which is the failure mode the agent
exists to prevent. The 112-tool-call cost reported is the **caller's batch size**, and the caller is
a lane, not this file. Not applied; if it recurs, the fix belongs where the claim list is assembled.

**Rejected: "load the todo tool" inside architect (item 7, second half).** `architect` installs to
`claude-code` (`skillset.config.json`), and a pi-only tool name in a body that also installs there is
a portability defect (ADR 0009, *Portable bodies*). The same objection plan 0024 raised against
naming `advisor` applies verbatim.

**Narrowed: the edit-discipline list (item 5) to three bullets.** "Structural invariant check after
the batch" is the finding that actually caught the defects and it stays. "An edit batch of more than
~5 becomes a whole-file rewrite" and "moving content is a rewrite, never append-then-delete" are one
bullet, because both are the same failure — a partial rewrite leaving duplicates. "oldText must be a
whole line/block" keeps its own bullet; truncating it grafts a block mid-line, which is a different
defect with a different check.

**Narrowed: the activation fix (item 11) to the signal, not a `skillset status` call.** The suggested
fix — "name the tool in the rule and state the three states" — half-works: `skillset status` is
itself a slash-only skill (`skillset.config.json`), so a body that must stay portable cannot depend
on it. What is portable is a correct sentence: a body arriving alone is ON; a body arriving beside
others may be `auto`/`always` and the session should name the set rather than assume. The extension's
`/sk-start` already knows it activated exactly the named skills, so it stays as-is.

**No shared partial for the ingest line.** The sentence lives in four places because a skill body must
be self-contained — Claude Code installs these bodies with no extension to supply the line. A
partials mechanism would cost more than the four copies; recorded here so the duplication is
deliberate rather than discovered later.

**The always-channel budget is flat, not grown.** The fourth standing rule added in 0024 took
`standing-rules` from 26 to 30 lines; a fifth takes it to ~37 and the always channel over 80 for the
first time only if `instruction-ownership` does not shed its section — which is exactly what item 2
pays for. `One provider per name` is authoring-time guidance no task session needs, and
`instruction-ownership`'s "Why this is a rule" is history, not a rule. Both leave; the secret rule is
worth more than both.

## ADR appendix — bundled agents pin a model tier, not a model id

**Context.** Every bundled subagent is a markdown file skillset installs into
`~/.pi/agent/agents/` and `~/.claude/agents/`. Until now none carried a `model:` field, so all
fifteen inherited the session model — which is whatever the developer happens to be chatting with.
Model ids are provider- and plan-specific (`anthropic/claude-haiku-4-5-20251001` resolves only where
an `anthropic` provider is configured), while skillset ships one source to every harness and every
machine. Frontmatter is authoritative and locked (pi-subagents), so a wrong pin is not merely ignored
— it removes the orchestrator's per-call escalation for that agent.

**Decision.** A bundled agent may pin a **tier alias** (`deepseek-flash`, `haiku`, `sonnet`) and never
a full model id, and the pin is declared per target — an alias is only meaningful against the catalogue
that harness resolves against. Pin only agents whose work is retrieval. Agents that synthesize, review
adversarially or verify claims inherit the session model, so the per-call `model_reason` escalation
keeps working.

**Consequences.** A pinned agent resolves against the host's configured catalogue; where no matching
model exists, pi-subagents falls back to the session model with a warning rather than failing the
spawn. Model upgrades (haiku 4.5 → 5.5) require no skillset release. Cost is predictable per agent
class instead of tracking the session. The cost is that a tier alias is approximate — which haiku the
fuzzy matcher picks depends on the catalogue — and that a pinned agent cannot be escalated in place;
a hard task spawns a different agent instead.

## Approach

1. Edit each source body. Bind the secret rule as a positive obligation with the sanctioned recipe,
   the way 0024 bound the blocked-command rule — a prohibition phrased only as "never" gets skipped.
2. Move the count wording in `standing-rules` in the same edit that adds the rule, so no state of the
   file claims four rules and carries five.
3. Move `One provider per name` to `docs/conventions.md` **and** leave the pointer in the same edit,
   so no installed state loses the rule; compress the "Why" paragraph at the same time.
4. Rewrite the ingest line in all four carriers with one identical sentence — `skillset sync`
   compares bytes, and four slightly different sentences is how the next drift starts.
5. Pin the five agents under both `targets.pi` and `targets.claude-code`; `model` is expressed by
   both bridges (`src/bridges/pi/index.ts`, `src/bridges/claude-code/index.ts`), so a top-level
   `model:` would draw a "declared at the top level, where no renderer forwards it" warning.
6. `npm test` → `npm run build` → `skillset sync --dry-run` (expect drift only in the touched
   targets) → `skillset sync`.
7. Verify against the **installed** files with exact substrings from the rendered bundle
   (conventions, *Propagating skill edits*, item 5) — a paraphrase grep gives a false negative.
8. Clear the thirteen lines from `~/.skillset/suggestions.jsonl` only after the verdicts above are in
   this file.

## Steps

1. `standing-rules`: fifth rule; "Four rules" → "Five rules" in body and `description`; precedence
   clause in the comment rule.
2. `instruction-ownership`: "One provider per name" out, "Why this is a rule" compressed to a
   sentence, pointer in. `docs/conventions.md`: new subsection carrying the section text.
3. `builder`: three edit-discipline bullets; ingest line.
4. `architect`: invariants + measured/hypothesis; widening line; AC external-list clause; defaults +
   Open questions; Review-log anchor.
5. `caveman`, `ponytail`: ingest line.
6. `skillset-status`: three states; untoggled body may be auto/always. `pi-extension.ts`:
   `INGEST_LINE`.
7. `retro`: pi row names the Claude Code memory store and its `MEMORY.md` index.
8. Five agents: `targets.pi.model` + `targets.claude-code.model`.
9. Build, sync, verify, clear the queue.

## Open questions

1. ~~Is `haiku` the right tier?~~ **Resolved by the developer: `deepseek-flash`** — cheapest, already
   the session default, and an exact id match on this machine. Switching tiers is a one-word edit in
   five files, so `haiku` or `sonnet` stays available without a plan.
2. **Should the five pinned agents also pin `thinking: off`?** Deliberately left inherited — a
   retrieval agent that reasons silently is a behaviour change nobody asked for. Add when a
   retrieval turn is demonstrably noisy.
3. **Does `standing-rules` growing to ~37 lines still earn the always channel?** Yes today: it holds
   rules that must bind before the agent acts, which is the channel's charter. If a sixth is
   proposed, that is the moment to move the trailers rule (which fires at most once per session) to
   `commit-suggestion`'s body instead.

## Confidence

98% — the two claims that were load-bearing were checked against the tree rather than assumed:
frontmatter locking (pi-subagents README) and fuzzy-before-id resolution (model-resolver source,
plus `deepseek/deepseek-flash` present in this machine's store). Remaining 2%: the exact physical
delta depends on how terse the moved conventions section renders. The plan number is `0025` because
every prior plan has been moved to `completed/`.

## Review log

**Round 1 — 2026-10-17, implementation.** All ten acceptance criteria checked against installed files, not against `src/`.

| AC | Check | Result |
|---|---|---|
| 1 | `grep -c 'Five rules' ~/.pi/agent/APPEND_SYSTEM.md` · `grep -c 'Secret values never enter the context'` | 1 · 1 |
| 2 | `grep -c '0600'` · `grep -c '\$(cat /tmp/'` · `grep -c secretsmanager` | 1 · 1 · 1 |
| 3 | `grep -c 'not a licence'` | 1 |
| 4 | `grep -c 'One provider per name' ~/.pi/agent/APPEND_SYSTEM.md` · `grep -c '^## One provider per name' docs/conventions.md` | 1 · 1 |
| 5 | builder: `whole line or block` · `is a rewrite` · `structural check` | 1 · 1 · 1 |
| 6 | architect: `written as invariants` · `measured` | 1 · 1 |
| 7 | architect: `widens an existing branch` · `mapping table` | 1 · 1 |
| 8 | architect: `recommended defaults and an Open questions` · `anchors on the end of the previous block` | 1 · 1 |
| 9 | identical ingest line in `sk-builder.md`, `caveman/SKILL.md`, `ponytail/SKILL.md`, `pi-extension.ts`; old sentence `pasted skill body = activation` absent tree-wide | 4 carriers · 0 hits |
| 10 | `grep -l '^model: deepseek-flash' ~/.pi/agent/agents/*.md \| wc -l` · same under `~/.claude/agents` | 5 · 0 |

Gates: `npm test` 33 files / 344 tests green, `npm run build` clean, `biome check src/` clean (62 files), `skillset sync` reconciled 24 expected artifacts — the seven skills (multiple targets each), the two `always` blocks and the five agents; nothing unexpected drifted.

**Deviation from the budget.** `APPEND_SYSTEM.md` grew 679 → 736 words (+57, ~70 tokens) rather than staying flat as *Decisions* forecast. The provider section leaving `instruction-ownership` (−94 words) is outweighed by the fifth rule (+~85) plus its `docs/conventions.md` pointer (+15), and the "Why" paragraph lost only one clause. Accepted without trimming: the surplus is the security rule, which is the one item on this queue whose failure is permanent. `standing-rules` is 36 lines against the 80-line warn threshold, so no size warning fires.

**Pin widened to `deepseek-flash`, narrowed to pi.** Developer decision, applied before implementation: five agents carry `targets.pi.model` only. Claude Code's `model:` accepts its own aliases and full ids, and `deepseek-flash` is neither — a pin there would be ignored at best and a failed spawn at worst. Recorded in ADR 0010 rather than left as an inconsistency between the two targets.

**Filed.** `docs/decisions/0010-bundled-agents-pin-a-model-tier.md`.

**Left alone, deliberately.** `skillset sync` reports 8 pre-existing `undeclared` records — `confidence` and `convention` in three project trees plus a `/private/tmp/skillset-debug` leftover. None were created by this work, and pruning them touches the developer's other repositories, which this plan's budget does not cover. Reported, not acted on.
