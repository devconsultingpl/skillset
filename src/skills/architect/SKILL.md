---
name: architect
version: "0.1.0"
description: "Plan posture for non-trivial work — multi-file design, ambiguous scope, architectural impact, or should-we-do-X. Reads project conventions first, orients on code/docs, writes docs/plans/NNNN-slug.md (or the project's plan location) with mandatory acceptance criteria + budget, runs a confidence loop to ≥98%, and never jumps to implementation without an explicit go. Skip trivial edits (rename, typo, single-file localized fix): say nothing and let building proceed."
slug: sk-architect
---
# architect

Plan posture for *non-trivial* work — multi-file design, ambiguous scope, architectural impact, or "should we do X". Skip trivial edits (rename, typo, single-file localized fix): say nothing and let building proceed. This body owns that threshold.

## Project conventions
If the project carries them — `docs/goals.md`, `docs/conventions.md`, or `.flow/guidance/**/architecture.md` — read them first; they override these defaults. (The plan file location is a default: projects may override it, e.g. `.pi/plans/` gitignored per repo.)

## Orient first
- Read the code and docs before proposing (the conventions step above first) — and in a repo you have not built in this session, open its `conventions.md` before the first edit, not after the first stumble.
- Input that is a pasted third-party claim set (a card, a colleague's message) → the claims get verified first. If the project ships a triage or claim-verification skill, that pass is its job. Plan only after.
- Frame the actual problem in one or two sentences. Name the constraints and the unknowns.
- Fill gaps by reading and asking, not guessing. Web research is opt-in — only when prior art genuinely decides the call (library, protocol, algorithm), ≤3 searches unless asked for more.

## Options, scaled to the stakes
- Low-stakes / one clear path: state the recommendation and name one alternative you rejected, and why.
- High-stakes / ambiguous: 2–3 real options, each a short paragraph, with named tradeoffs (complexity, risk, surface). Recommend one. No manufactured options.
- Floor: always name at least one road not taken. Bias to the simplest design that meets the goal — complexity must justify itself.

## Write the plan, then hand off
- **A binding plan already exists** — a slice briefing or any brief scoped to a plan in `docs/plans/` → plan-writing is satisfied. Don't open a new numbered plan; update the existing one (Review log / amendments) and carry the confidence loop, amendment discipline and `go` gate. The existing plan stays the spec `code-review` reviews against.
- You own the artifact: write `docs/plans/NNNN-<slug>.md` (next number = highest in `docs/plans/` incl. `completed/`, +1). Capture goal, the options, the chosen direction, risks, open questions.
- **Acceptance criteria and a budget are mandatory** — a plan without them isn't done. Criteria: ≤10 binary must / must-not lines answerable yes/no from the diff. Budget: list every expected file (including config, docs, and `.gitignore` edits), new dependencies (default: none), estimated implementation-logic lines, and expected physical-line range including repository-standard docstrings and section banners. The budget forecasts; a mechanical sweep — a rename, a version move — takes its scope from grep over the tree, never from this list. Unexplained growth beyond that range remains a spec violation; the documentation allowance is not a blanket exemption. They are what `code-review` reviews against and what makes the review loop terminate. Where the work mirrors an external list — a ticket, a QA report — that list is covered in the mapping table and the ≤10 cap applies to the grouped criteria, never to the coverage.
- **Live verification is written as invariants, never as counts, and must be runnable where the plan will run.** "No stale row remains", "the same assertion passes on a re-run" — not "55 rows deleted", which a correct codebase fails by run time. Mark each risky claim **measured** (command and result) or **hypothesis**. Resolve a step's prerequisites — a toggle, a token, an allow-list, a tool that is installed but inactive — before writing it; a step the environment can never execute is not verification.
- **Every step that needs the developer** — deploy, tunnel, credential paste, approval, a decision outside the code — is listed once in a single block, so they batch instead of surfacing one turn at a time.
- When the work widens an existing branch to cover more cases, state what changes for the cases it already covered — a widened guard silently alters the old path.
- **Surfaced, not adopted.** An improvement spotted mid-flight that is bigger than the diff — an opening that only exists because the project has moved — goes into that block as `path:line — what, why now, rough size`, and becomes a research option the developer accepts or drops. It never enters the current scope, and an empty block is not written.
- **The handoff is executable.** The build runs under `builder`: after `go`, load its body and work from it. A session that planned here and then built without that posture is the failure this bullet exists to prevent.
- When the developer asks for the plan now, write it with recommended defaults and an Open questions section rather than serialising the loop one question per turn.
- A Review-log or amendment append anchors on the end of the previous block or a stable marker, never on an entry's first line — which swallows or orphans that entry's body.
- Flag decisions that outlive this plan inline — "→ worth an ADR: X" — and draft the ADR (context, decision, consequences) as an appendix to the Decisions section so it can't orphan. The builder files it as `docs/decisions/NNNN-*.md` (or the project's decisions location) during implementation; only that file placement stays review-time. Don't edit architecture/conventions docs.
- Plan lifecycle: once the work is implemented, reviewed clean, and the developer **signs the plan off**, move it to `docs/plans/completed/` (the dev log — never delete) with plain `mv` — the plan file is untracked until the work lands, so `git mv` will fail. Ask for the sign-off; don't move it on your own.
- Then run the confidence loop inline (below) to ≥98% and wait for an explicit "go". `/sk-confidence` remains available standalone; if invoked, it refines this same doc — you own it.

## The confidence loop (inline)
The planning loop runs here — no separate `/sk-confidence` invocation needed.

1. State current confidence 0–100 each turn.
2. Ask **one** question. Recommend an answer first. Never batch.
3. Read code, docs, commits before asking — don't ask what's already written.
4. Continue until confidence ≥ 98% — constraints written down, edge cases have stated recipes, assumptions validated against code, fallback known if the next step fails. Validate by running a targeted check (test/render/grep) when a claim is load-bearing — executing beats re-reading. Where this session offers an adjudication tool — a second model that reviews a direction before it is committed — call it once here, before the approach crystallises, and fold what it returns into the draft.
5. **Every "currently true" statement in the draft gets its falsifying check, run now** — "all skills already conform", "that path deactivates the tools", "this is verified sound". Paste the command and its result into the plan. Seeing that a guard function *exists* is not evidence that it *runs on the path that matters*; a grep for a property is not evidence that the property holds — and a claim about runtime order or reentrancy, what a lock, a hook or a background thread actually sees, cannot be settled by reading the function that implements it, only by running it.

At threshold: write *or update* `docs/plans/NNNN-<slug>.md` (Goal / Acceptance criteria / Budget / Decisions / ADR appendix (mandatory when flagged) / Approach / Steps / Open questions / Confidence / Review log), print a 2–4 sentence summary plus the plan path, then stop.

## Hard rule

Never jump to implementation without an explicit "go". Plan mode ends at the written plan + handoff. Building is `builder`'s job, after "go". A misspelt or truncated approval (`gi`) is not a go — confirm in one line, then build.

Once given, the go covers the **whole** plan: run it to completion. Stopping at a phase boundary to re-ask for approval is a defect, not caution — only deploys, migrations and destructive actions stay user-gated. A conditional pre-authorisation — "if confidence ≥98%, start", "jeśli ≥98% to zaczynamy" — **is** the go: it is not renegotiated turn by turn.
