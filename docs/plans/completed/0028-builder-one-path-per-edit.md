# 0028 — builder: one path per edit call

## Goal

Clear the last line on `~/.skillset/suggestions.jsonl` — one entry, filed 2026-11-13 from
`devconsulting.pl`, hit three times in a single session (that project's plan 0024):

> builder skill: say that each edit call targets one path — putting a second file's `oldText` in the
> same call (e.g. an `.asd` edit while `path` is `package.lisp`) fails the whole call and costs a
> retry; hit 3x in one session.

`builder:32` already says a batch is atomic, but never says *why* a foreign anchor gets in: `path` is
singular and `edits` is plural, so pasting another file's anchor looks legal and the whole call is
silently dropped. One clause, folded into the existing bullet — no new bullet, no new section.

## Verdicts

| # | origin | verdict | lands on |
|---|---|---|---|
| 1 | devconsulting.pl | adopt, narrowed to one clause | `builder:32` |

Rejected sub-claims, with their reason:

- **"a standalone bullet"** — a bare description of the tool's signature is noise in a posture body;
  the fact only earns its tokens as the cause of the atomicity rule already there.
- **naming the harness** — the statement must read true under every target. Verified below only for
  pi; claude-code and opencode take a single file and single anchor per call, so the rule is inert but
  harmless there, which is exactly what a portable body requires.

Predecessor note: `~/.skillset/suggestions.jsonl.bak-0028` is a stray backup from 2026-11-10 whose
entry (`skillset-status` asset stale against pi 1.5.2, `sendUserMessage` needing `deliverAs`) has
already landed by other work — `deliverAs` is present at
`src/skills/skillset-status/assets/pi-extension.ts:109` and the stale version note is gone. Nothing is
lost; this plan takes the number the file name reserved.

## Acceptance criteria

1. `builder`'s multi-block-edit bullet states that an edit call takes **one `path`**, so a second
   file's anchor fails the whole batch.
2. The same bullet still states that one bad anchor silently drops every block and that each block is
   to be verified after landing.
3. The wording is harness-neutral: the body names no harness, no tool flag and no target path.
4. `builder` gains no new bullet and no new section — net public surface unchanged, +1 clause only.
5. The clause reaches all five builder installs (`pi` auto + slash, `claude-code` auto + slash,
   `opencode` auto), each carrying it exactly once.
6. `~/.skillset/suggestions.jsonl` holds **0** lines and its prior content is preserved at
   `~/.skillset/suggestions.jsonl.bak-0028-builder-edit-path`.
7. `npm run build` and `npm test` pass; `npm run lint` is clean.
8. `skillset sync` reports no `drifted`, `missing` or `foreign` artifact; its `in-sync` count returns
   to the pre-change baseline (**87**, measured).
9. `docs/architecture.md`, `docs/conventions.md` and `docs/goals.md` are untouched — a posture clause
   is neither an architectural fact nor a convention.

## Budget

| File | Change |
|---|---|
| `src/skills/builder/SKILL.md` | −1 / +1 line (one bullet, one clause; physical line count unchanged) |
| this plan | untracked until the work lands |

New dependencies: **none**. Implementation-logic lines: **0** — guidance only, no code. Expected
physical delta: **0 net lines**; the diff is a single modified line. No config, test or doc beyond this
plan changes, and nothing here may grow into a second file.

## Decisions

- **Adopt, not deny.** The precedent from 0026 — "one refactor does not earn a skill" — is a bar
  against *new surface*, not against one clause on an existing bullet, and this instance recurred three
  times in one session. The cost is inside a body already paid per session.
- **Cause, not inventory.** The clause explains why the failure happens (one path, many anchors), which
  is the only form that transfers; "remember that edit calls are single-file" is a memorised fact an
  agent drops.
- **Not a `pi` note.** *One provider per name* argues against a harness-specific body; the fact is true
  in all three targets, so it lives in the portable body rather than in a harness fork or a `pi`
  extension comment.
- **The queue is cleared by truncating its one exact path**, after a copy, in the same step — the
  verdict row above is the surviving record of what it said.
- Road not taken: reword `builder`'s earlier `oldText`-anchor bullet to cover both — rejected, that
  bullet is about anchor *shape*, this one about call *scope*; merging them blurs two distinct retries.

## Verification (measured, 2026-11-13)

| claim | command | result |
|---|---|---|
| baseline is clean before the change | `skillset sync --dry-run` | `checked in-sync 87`, no drifted/missing/undeclared |
| the batch is atomic — the claim's mechanism holds | one `edit` call on `tmp/probe.txt` with a valid `alpha` anchor plus a bogus anchor | `Could not find edits[1] in …/tmp/probe.txt`; `cat tmp/probe.txt` → `alpha` / `beta`, i.e. **nothing applied** (probe deleted afterwards) |
| nothing in the tree pins the old wording | `grep -rn "restated anchor\|silently drops" --include=*.ts --include=*.json` | no hits outside the skill body — no test or fixture to update |
| the clause reaches every install | `grep -c 'One `path` per edit call'` on the five artifacts | each `1` (filled in after the edit; see Review log) |
| sync reconciles, no artifact left behind | `skillset sync` (after `--dry-run`) | drifted 5 written, `in-sync 87` restored |
| suite and lint | `npm run build`, `npm test`, `npm run lint` | to be pasted in the Review log |
| queue emptied | `wc -l ~/.skillset/suggestions.jsonl` | `0` |

**Hypothesis, not verifiable here:** that an agent reading the clause stops before pasting a foreign
anchor. The measurement is the next session's retry count in a project that edits more than one file per
turn — it either never makes the second-file call, or it does and the sentence was too quiet.

## Steps

1. Rewrite the one bullet in `src/skills/builder/SKILL.md`.
2. `npm run build`; `skillset sync --dry-run` → `skillset sync`.
3. `npm test`, `npm run lint`; grep the five installed artifacts.
4. Copy the queue to `~/.skillset/suggestions.jsonl.bak-0028-builder-edit-path`, truncate it.
5. Move this plan to `docs/plans/completed/` on sign-off.

## Open questions

None. The one judgement worth flagging: if a future session finds the clause still too quiet, the next
step is not a longer sentence but a `pi` extension that names the offending path in the failure — a
harness change, out of scope here.

## Confidence

98 — the mechanism is measured, the wording's portability is argued and inert elsewhere, the queue has
one line and its verdict is written, the change has no code, no test and no config, and the verification
is a dry-run diff plus a grep against a known-clean baseline.

## Review log

Applied 2026-11-13, on the developer's "yes" to the recommendation. Measured after the change:

| check | command | result |
|---|---|---|
| the bullet changed and nothing else in the body did | `git diff --stat src/skills/builder/SKILL.md` | `1 file changed, 1 insertion(+), 1 deletion(-)`; `wc -l` still **55** — AC4's "no new bullet" holds by line count |
| no drift left behind | `skillset sync --dry-run` before sync | `drifted 5 · in-sync 82` — exactly the five declared builder installs, each naming its own path |
| the rewrite happened from source | `skillset sync` | `reconciled drifted 5 · in-sync 82 · 5 written`; no `refused`, no `foreign` |
| the clause reached every install once | `grep -c 'One \`path\` per edit call'` on the five artifacts | pi auto `1`, pi slash `1`, claude-code auto `1`, claude-code slash `1`, opencode auto `1` |
| baseline restored | `skillset sync --dry-run` after sync | `checked in-sync 87` — the pre-change count, no `drifted` / `missing` / `foreign` |
| suite and lint | `npm test`, `npm run lint` | **353 passed / 33 files**; biome `Checked 81 files … No fixes applied` (both clean on the first run) |
| queue emptied, line preserved | `wc -l ~/.skillset/suggestions.jsonl`; `cat ~/.skillset/suggestions.jsonl.bak-0028-builder-edit-path` | `0`; the one entry verbatim |
| no doc touched beyond this plan | `git status --porcelain` | `src/skills/builder/SKILL.md` and this plan only |

Not done, deliberately: the plan is not moved to `completed/` and nothing is committed — both wait on
the developer's sign-off.

**Signed off 2026-11-13** — moved to `completed/` on the developer's word, which supersedes the line
above about this plan staying put. The commit remains theirs.
