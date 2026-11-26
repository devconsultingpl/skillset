# 0033 — suggestion queue triage 4: verification in the shape of the claim, and a move that exports

## Goal

Clear `~/.skillset/suggestions.jsonl` — two entries, filed 2026-11-26 16:24 and 16:25 from
`devconsulting.pl`, describing one prod outage from two angles (their plan 0025):

> architect: a plan's verification must be stated in the shape the claim asserts — a claim about a
> process the supervisor runs (a daemon, a server, an entry point) is proved by that process's entry
> point in a fresh OS process, never by a REPL session in an image that has already loaded the
> workspace. And a boundary/split criterion must name its mechanism (compiler + quoted-designator
> scan + fresh load), because 'compiles clean' + green suites + byte-identical renders missed two of
> the three defects in plan 0025, costing a prod outage.

> builder: a definition moved across a package boundary is not moved until it is exported by its new
> home — quoted function designators and quoted class names are data to the compiler, so a move can
> compile clean, pass suites and render identically while being broken at runtime. After any
> cross-package move, export the symbol or keep the definition in place, and run a quoted-designator
> scan (a project can add deploy/scripts/check-symbol-boundaries.py as the 30-line reference
> implementation).

Three clauses on three existing bullets. No new skill, no new file, no new dependency, no code.

## Verdicts

| # | origin | verdict | lands on |
|---|---|---|---|
| 1 | devconsulting.pl | **adopt**, two clauses, narrowed | `architect:47`, the acceptance-criteria bullet |
| 2 | devconsulting.pl | **adopt one clause**, thirds rejected | `builder`, *While building* |

Rejected sub-claims, with their reason:

- **`check-symbol-boundaries.py` as a bundled reference.** Measured:
  `wc -l deploy/scripts/check-symbol-boundaries.py` → **172**, not 30, and hardwired to Common Lisp
  (`DEF_FORMS` = `defun/defmacro/defgeneric/defclass/…`, `SKIP_PACKAGES` = `CL/COMMON-LISP`). A
  project-local tool, under a path that does not exist in any other project.
- **Shipping a Python checker at all** — `docs/goals.md`, *Done means*: "Cross-platform: Node ≥ 20 on
  macOS, Linux, Windows." A Python payload contradicts it; the rule travels, the tool does not.
- **The Lisp identifiers as body text** (`clog:initialize`, `route-handler`,
  `(make-instance 'content-template)`). Evidence for the entry, not instructions — `builder:25`'s
  parenthetical `Lisp xref/macroexpand` is the precedent and the ceiling.
- **A new bullet, section, or `/sk-verify` skill.** 0026's bar: one refactor does not earn a skill.
  All three clauses fit bullets that already exist.

Predecessor note: `~/.skillset/suggestions.jsonl.bak-*` already holds 0024/0025/0027/0028 history;
this run preserves the two live entries at `suggestions.jsonl.bak-0033`.

## Acceptance criteria

1. `architect`'s confidence-loop bullet states that a process claim is proved through that process's
   entry point in a fresh OS process, never a session in an image that already loaded the work.
2. `architect`'s acceptance-criteria bullet states that a split/move criterion names its mechanism,
   never the proxy signals that pass while the failure mode survives.
3. `builder`'s *While building* states that a definition moved across a package boundary is not
   moved until reachable from its new home, and that quoted/string designators are data to the
   compiler — proved only by the language's cross-reference pass.
4. Every clause is harness-neutral and project-neutral: no harness name, no project path, no
   language-specific identifier added beyond the existing `Lisp`/`xref` parenthetical.
5. No new bullet and no new section in either body; net addition ≤3 clauses.
6. The clauses reach all installs — `architect` 3, `builder` 5 — each carrying its clause exactly
   once.
7. `npm run build`, `npm test` pass and `npm run lint` is clean.
8. `skillset sync` reports no `drifted`, `missing` or `foreign`; `in-sync` returns to the pre-change
   baseline — **101, measured** (`sync --dry-run` before the edit).
9. `~/.skillset/suggestions.jsonl` holds **0** lines and its prior content sits at
   `~/.skillset/suggestions.jsonl.bak-0033`.
10. `docs/architecture.md`, `docs/conventions.md`, `docs/goals.md` untouched — a posture clause is
    neither an architectural fact nor a convention.

## Budget

| File | Change |
|---|---|
| `src/skills/architect/SKILL.md` | +2 clauses on existing bullets (−2 / +2 lines) |
| `src/skills/builder/SKILL.md` | +1 clause on an existing bullet (−1 / +1 line) |
| `docs/plans/0033-suggestion-queue-triage-4.md` | this plan, untracked until the work lands |

New dependencies: **none**. Implementation-logic lines: **0** — guidance only. Expected physical
line count unchanged: `architect` 55, `builder` 57. No config, test, bridge or doc changes.

## Decisions

- **Adopt, don't deny**, on the 0028 precedent: a clause on an existing bullet costs tokens already
  paid, and both instances are the same incident recurring in one session.
- **Two homes, one incident.** The plan-time half is a criterion (architect); the build-time half is
  an act (builder). Neither body can enforce the other's half, so both carry theirs.
- **Cause, not inventory.** Each clause names why the proxy fails — a warm session already resolved
  what a fresh process must resolve; a quoted symbol is data the compiler never type-checks — which
  is the form that transfers.
- **The tool stays in its project; the rule ships.** Same split as 0028's harness note.
- Road not taken: folding all three into `architect` alone — rejected, the builder half is executed
  at build time, when no plan is open.

## Approach

Edit the two bodies in place, rebuild the bundle, run the suite, re-sync every install, verify the
rendered bytes, then clear the queue. Each clause anchors on a full existing line; a batch of two
files is two edit calls.

## Steps

1. Copy the queue to `~/.skillset/suggestions.jsonl.bak-0033`, then truncate the original — last, so
   nothing is lost if an earlier step fails. (Verdict table above is the surviving record.)
2. Edit `architect` — the confidence-loop bullet (#1) and the criteria bullet (#2).
3. Edit `builder` — one clause in *While building* (#3).
4. `npm run build`, `npm test`, `npm run lint`.
5. `skillset sync --dry-run`, then `skillset sync`; confirm `in-sync 101`, nothing drifted.
6. Grep each of the 8 installs for its clause — present exactly once per install.
7. Clear the queue (step 1's truncate), verify 0 lines and the `.bak` intact.

## Open questions

None. Both entries triage clean; no clause depends on an unavailable resource.

## Confidence

97%. The rejection reasons are measured (172-line Lisp-only script, goals' cross-platform line). The
adoption shape follows 0028's precedent exactly. Residual 3%: wording that reads as a duplicate of
an adjacent bullet after the fact — checked in step 6's grep and in review.

## Review log

- **Build + review, 2026-11-26.** Three clauses landed, one per specified bullet: `architect:47`
  (fresh OS process, entry point), the *Live verification* criteria bullet (a split criterion names
  its mechanism), `builder`'s *Delete, don't note* bullet (reachable from the new home, quoted
  designators are data). Net physical lines unchanged — `architect` 55, `builder` 57;
  `git diff --stat` = 3 insertions, 3 deletions.
- **Verification run.** `npm run build` ok; `npm test` 372/372 across 36 files; `npm run lint` clean
  (84 files). `skillset sync` → `reconciled drifted 8 · in-sync 93 · 8 written` (architect 3 +
  builder 5, exactly the declared installs); a second `sync --dry-run` reads `checked in-sync 101`,
  the pre-change baseline — no `drifted`, `missing` or `foreign` remains.
- **Per-install grep** (`grep -cF`, exact substring): the architect clauses appear once in each of
  its 3 installs; the builder clause once in each of its 5. AC-6 holds.
- **Leak scan (AC-4):** `grep -niE "devconsulting|deploy/|clog|python|route-handler|make-instance|
  claude|opencode|copilot"` over both bodies → no hits. No project path, no harness name, no
  language identifier beyond the pre-existing `Lisp` parenthetical.
- **Queue cleared:** `~/.skillset/suggestions.jsonl` 0 lines; the two entries preserved verbatim at
  `~/.skillset/suggestions.jsonl.bak-0033`; the verdict table above is the record.
- **Not done, deliberately:** the Lisp checker, any new bullet or section, and any edit to
  `docs/architecture.md` / `docs/goals.md` / `docs/conventions.md`.
