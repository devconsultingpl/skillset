# 0031 — the four lenses become enforcer-readable, and the supervisor gains a seam

## Status: in progress — answers the two suggestions queued by `pi-extensions` plan 0030 v3

## Goal

Make the run-scope review expressible outside the body without making the body a
renderer of someone else's decision. Two halves:

1. **Lens contracts.** `appsec-review`, `declutter` and `convention` declare the same
   `review` contract `code-review` already ships, so a `produces({skill})` stage derives a
   bucket from each. A contract reaches flow only through pi's **`auto`** install
   (measured: `buildUserSkillContracts` enumerates `loadSkills`, which reads skill
   directories, not slash prompts), so each lens gains a hidden pi `auto` install too —
   which is also the fix for the `ENOENT` the live 0029 run hit.
2. **A seam, not a split.** `supervise` gains `--no-review` (stop after the document pass)
   and `--finalize` (fold the files on disk and write the terminal artifact). Finalize
   **reads task files and verdicts, never a handed conclusion** — so the artifact's rule
   stays computable by the body that writes it.

## Why this shape and not the suggestion's finalize

The suggestion asked for a mode that writes the artifact "from a folded verdict path it is
handed". That turns the body into a formatter for flow's decision: it never saw the task
files, so it cannot apply the rule the artifact exists to express (`blocked` iff a task
ended blocked or a lens still carries blockers), and the guarantee degrades silently
off-pi. Handing it a *directory* instead keeps one fold, one owner, one rule.

`declutter` is the one lens whose role needed correcting, not just metadata: its body says
"run on a quiet tree, not a fresh diff (that's `code-review`'s job)". At diff scope it is
advisory by definition, so its contract pins `blockers_count` to `maximum: 0` and its body
says so. Otherwise a bloat finding becomes a failed run, which inverts 0029's D-d.

## Acceptance criteria

1. `appsec-review`, `declutter` and `convention` each declare `targets.pi.contract` whose
   `produces.data.required` is `[blockers_count]` and whose properties are exactly
   `status` (`enum [in-progress, in-review, ready]`) and `blockers_count` — byte-identical
   key names to `code-review`'s.
2. `declutter`'s `blockers_count` carries `maximum: 0`, and its body states that at diff
   scope its findings are advisory.
3. Each of the three gains a pi `auto` install with `disable-model-invocation: true`
   (hidden: 0 estTokens/session); claude-code installs are unchanged, and
   `appsec-review`'s claude-code auto-activation survives.
   **Amended in build:** `requires.<name>.pi: ["contract"]` was dropped for the three
   lenses — see D5. The contract still renders; only the hard assertion went.
4. The installed pi `auto` skills exist and carry the contract: a check asserts
   `~/.pi/agent/skills/<lens>/SKILL.md` is in-sync for all four lenses.
5. `supervise` documents three modes — default, `--no-review`, `--finalize` — and states
   the fold rule once: `BLOCKED.md` iff a task's `state` is `blocked` or a lens verdict
   carries `blockers_count > 0`.
6. `--finalize` takes a verdict **directory** and never a verdict or decision as an
   argument; the body states why in one clause.
7. `test/supervise-contract.test.ts` fails if any lens named in the body's step 4 lacks a
   contract, or if its contract's key names drift from `code-review`'s — machine-checked,
   so the body and the skills cannot disagree.
8. The body stays ≤ 900 words; the visible pi description set stays 209 words.
9. `npm run build && skillset sync --dry-run` → no drift; full suite, lint, typecheck green.
10. Both applied lines are removed from `~/.skillset/suggestions.jsonl`; a line is removed
    only after its change is green.

## Budget

**New dependencies:** none.

| File | Change | Est. lines |
|---|---|---|
| `src/skills/{appsec-review,declutter,convention}/SKILL.md` | `targets:` block + contract + hidden pi install; one advisory clause in `declutter` | 3 × ~14 |
| `src/skills/supervise/SKILL.md` | `## Modes`, the fold rule, step 5's exception | ~22 |
| `skillset.config.json` | 3 × pi `auto` install, 3 × `requires` | ~39 |
| `test/supervise-contract.test.ts` | lens-contract sweep + body/skill agreement | ~35 |
| this plan | | ~90 |
| **Total** | | **~215** |

## Decisions

**D1 — a contract demands an `auto` install, so the lenses get one.** Measured:
`contract` appears in pi's `auto` express list only, and flow reads contracts from skill
directories. Hidden, so the cost is a file on disk, not tokens.

**D2 — `disable-model-invocation` on the new pi install only.** `appsec-review`'s claude-code
install keeps auto-activation: its description promises it ("auto-activates on security
review"), and removing it would be a behaviour change nobody asked for.

**D3 — declutter is capped, not excluded.** `maximum: 0` states the advisory rule in the
schema flow reads, instead of relying on a fold to remember it.

**D4 — finalize folds; it does not render.** *Rejected:* the suggestion's handed path.

## Open questions

| Question | Recipe |
|---|---|
| Does flow read `maximum`? | If not, the cap is documentation for humans plus our own test; the fold still gets `blockers_count` from a lens that has no diff scope to fail on. Check `outcome-derivation.ts` before quoting it as enforced |
| Does `--finalize` need the doc pass skipped too? | It runs after the tasks, so the doc pass has happened in the default path; a `deliver` run doing its own doc pass would call it with the plan already reconciled — revisit if flow wants one call for both |

## Confidence

**96%.** The mechanism is measured on both sides — contracts and their renderer here,
`loadSkills` discovery and `BUCKET_BY_KIND` there — and the two suggestion texts are
quoted. The 4% is whether flow's stage resolves the lens *contract* before or after the
`auto` install lands on a machine that has not re-synced; the fail mode is a missing bucket,
not a wrong run.

## Review log

**Implementation pass (measured).**

```
npx vitest run            34 files, 362 tests passed (+2 lens-contract tests)
npm run lint / typecheck  clean
skillset sync --dry-run   checked in-sync 101   (98 before: +3 hidden pi auto installs)
lens skill dirs           ~/.pi/agent/skills/{code-review,appsec-review,declutter,convention}/SKILL.md
                          each carrying `contract:` — the ENOENT from 0029's live run is gone
visible pi set            209 words ≈ 272 est — unchanged, all three lenses hidden
supervise body            894 words (≤900) after absorbing `## Modes`
```

**D5 — `requires` is mode-blind, so three lenses go without it.** Adding
`requires.<name>.pi: ["contract"]` made `install convention --agent pi --mode always` exit 1
(`test/agents/markers.test.ts` caught it): `always` renders no frontmatter, so a required
field is unexpressible there, and `requires` is declared per skill+agent with no mode in
scope. Kept: the contract on all four lenses, a hidden pi `auto` install, no `requires` for
the three. Dropped: the assertion — it buys a CI check at the price of forbidding a mode the
CLI supports.

Surfaced, not adopted: **`code-review` and `supervise` still carry that latent trap** —
`src/core/declarations.ts` should evaluate `requires` against the modes declared in
`skillset.config.json`, not against whatever mode an ad-hoc `install --mode` asks for.
`skillset install code-review --agent pi --mode always` fails for that reason today —
measured in a scratch dir, `exit=1`, `required field \`contract\` has no renderer for pi —
refusing a partial install`. No declared install asks for it, which is why it has survived.

Queue: both lines removed from `~/.skillset/suggestions.jsonl` — the lens-contract line and
the harness-owned-review line — with S2 delivered as `--no-review` + `--finalize <dir>`,
not as the suggested finalize-from-a-folded-path. Hand the counterparty: `supervise`'s
`## Modes`, and that the three lenses are now resolvable as skill bodies on pi.

One residual carried, not closed: flow reads contracts through `loadSkills`, so a machine
that has not run `skillset sync` since this change sees no lens contract and derives no
bucket. The fail mode is a missing bucket, not a wrong run.

## Post-sign-off addition — the rendered-output assertion (third queued suggestion)

Queued after sign-off, and correct: nothing in this suite would have noticed a **renderer**
regression. `requires.<lens>.pi: ["contract"]` is undeclarable (D5), and the declaration test
reads source frontmatter, so a bridge that stopped writing `contract` into the pi skill file
would have shipped green.

`src/bridges/pi/lens-contracts.test.ts` now renders each lens through `piBridge.install` into a
scratch root and asserts the bytes on disk: `produces.meta.artifactKind === "review"`, the same
`required` list and key names as `code-review`, the same `status` enum, and
`blockers_count.maximum === 0` for `declutter` only. No install into a home directory, no
`requires`, no mode — the renderer is the surface.

**Falsified, so it is a guard and not decoration.** Dropping `contract` from `renderSkillFile`'s
spread turns all three tests red (`code-review renders a contract into its pi skill file:
expected undefined to be defined`); restoring it turns them green. Removing `contract` from pi's
`expresses` list changes nothing — measured, because that list drives capability warnings, not
rendering, which is why the first falsification attempt was the wrong knob.

Suite: 35 files, 365 tests. Queue line removed.
