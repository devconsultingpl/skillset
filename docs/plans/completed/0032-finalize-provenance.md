# 0032 — `--finalize` renders provenance it was handed

## Status: implemented, awaiting sign-off — answers `devbox` plan 0002 criteria 8, 9 and 13 without a host name in the body

## Goal

`--finalize` gains `--provenance <file>`: the caller writes the four facts it observed, the body
renders them verbatim into the one terminal artifact, `unknown` for anything absent. Reporting
only — the fold rule that decides `READY` / `BLOCKED` is untouched.

The artifact is the reviewer's first ground truth, and today it names neither the run, the
workflow, the image, nor the correction rounds, so a reviewer cannot tie it to a run. The facts
are the caller's (flow's), which is why the body renders a file instead of reading an
environment it would be wrong to know about.

## Acceptance criteria

1. `src/skills/supervise/SKILL.md` documents `--finalize --provenance <file>` with the schema
   exactly as handed over: `run_id`, `workflow`, `image`, `final_corrections{rounds,
   accepted_round}`; no key required beyond those and none invented.
2. It states the two-line render: `Run: <run_id> · workflow: <workflow> · image: <image>` and
   `Final corrections: <rounds> round(s), accepted at round <k>`.
3. It states the four failure rules: absent/unreadable file, malformed JSON and missing key each
   print `unknown`; every line always prints; provenance never fails the run and never touches
   the fold.
4. It states that a `rounds` value above 2 prints as it arrived — no clamping, the cap is the
   caller's to enforce.
5. It states placement: after the H1 and its one-line plan title, before the first table.
6. `accepted_round: null` prints `none`; an absent `accepted_round` prints `unknown`.
7. A fixture under `test/fixtures/supervise-finalize/` carries the input and the expected
   artifact for three cases — valid, `run_id` missing with `rounds: 5`, malformed JSON — and
   `test/supervise-provenance.test.ts` asserts them, including "every line present in every
   case".
8. No harness name, environment variable or run-directory path appears in the body: `grep -inE
   "devbox|DEVBOX_|workflows/runs|\\.jsonl" src/skills/supervise/SKILL.md` returns nothing.
9. The body's word ceiling moves 900 → 1050 in `test/supervise-contract.test.ts`, recorded here
   as a deliberate +150 for three reporting modes; no other budget line moves.
10. `npm run build && skillset sync --dry-run` → no drift; full suite, lint and typecheck green.

## Budget

**New dependencies:** none.

| File | Change | Est. lines |
|---|---|---|
| `src/skills/supervise/SKILL.md` | `## Provenance` + the `--finalize` bullet's flag | ~26 |
| `test/fixtures/supervise-finalize/**` | 2 task files, 2 verdicts, 3 inputs + 3 expected artifacts | ~60 |
| `test/supervise-provenance.test.ts` | three cases + a body/no-host assertion | ~70 |
| `test/supervise-contract.test.ts` | the ceiling 900 → 1050 | 1 |
| this plan | | ~75 |
| **Total** | | **~230** |

## Decisions

**D1 — the body renders, it never reads.** `run_id` is flow's own run file, `workflow` its graph
name, `image` a devbox env var, `rounds` a count of repair hops `--finalize` did not run. A body
that reached for any of them would carry a host's vocabulary into a portable instruction and
would print `unknown` forever on claude-code; a body that *computed* `rounds` would be inventing
the one number the artifact exists to make checkable.

**D2 — five facts, two lines.** The handover says both "five lines" and shows a two-line shape;
the shape wins, because the artefact is read by a human. Recorded so the difference is not read
as an omission.

**D3 — `accepted_round: null` is `none`, not `unknown`.** `null` is a statement (the run ended
`BLOCKED`); an absent key is ignorance. Collapsing them would make the two indistinguishable.

**D4 — the ceiling moves rather than the prose being mangled.** 900 was chosen when the body had
one mode; three modes and a renderer is a bigger instruction, and the honest response is to
record the new ceiling, not to strip the rules a reviewer depends on.

## Open questions

| Question | Recipe |
|---|---|
| Does the fixture's expected artifact stay honest once a real `--finalize` run exists? | The fixture pins the contract, not the implementation — the same posture as `supervise-run`. Replace the expected files with a recorded run's output the first time one is produced |
| Is pluralisation ("1 round" / "2 rounds") worth a rule? | It is a render detail; if flow ever parses these lines instead of a human reading them, fix the format once and pin it in the test |

## Confidence

**97%.** The schema, the render, the failure rules and the placement are all handed over
explicitly; the only judgement calls are D2 and the pluralisation, both recorded. The residual is
that the fixture's expected artifacts are authored here rather than recorded from a real
`--finalize` run — they pin the contract, and a live run would pin the writer.

## Diff as built

| File | Change |
|---|---|
| `src/skills/supervise/SKILL.md` | `## Provenance` section; `--finalize` bullet carries `--provenance <file>` (+19/−1) |
| `test/supervise-provenance.test.ts` | new — 7 tests over 4 cases + the no-host assertion |
| `test/fixtures/supervise-finalize/**` | new — 2 task files, 2 verdicts, 4 inputs + 4 expected artifacts |
| `test/supervise-contract.test.ts` | ceiling 900 → 1050; the dispatch-prompt test now scopes to its own fenced block, because the body carries two `text` fences |
| `biome.json` | `test/fixtures/**` ignored — one fixture exists to be invalid JSON |

```
npx vitest run            36 files, 372 tests passed
npm run lint              clean, 84 files
npm run typecheck         clean
skillset sync --dry-run   checked in-sync 101
body                      1,049 words (ceiling 1,050)
```

**A dependency the earlier reading missed.** The body now carries a second fenced `text` block,
and the dispatch-prompt test was matching "the first fence in the file" — it failed the moment
provenance landed, which is the test doing its job. Scoped to the block containing
`<!-- dispatch-prompt -->`.

**Two deviations, both recorded above.** `accepted_round: null` prints `none`, not `unknown`
(D3) — `null` is a statement, absence is ignorance. And the handover says "five lines" but shows
a two-line block; the shape won (D2), five *facts*.
