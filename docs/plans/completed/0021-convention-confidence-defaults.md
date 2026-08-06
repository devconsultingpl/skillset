# 0021 — Convention + confidence as defaults in actionable skills

## Goal

Make every actionable skillset skill convention-aware by default (load the
project's conventions when present — including flow's `.flow/guidance/` shadow
tree — before acting), and fold the confidence planning loop into `architect`
so `/sk-architect` alone drives question loop → plan → explicit "go".
`/sk-confidence` and `/sk-convention` remain installed and functional as
explicit deep-loaders.

No context pollution: convention reading happens inside each skill body, on
invocation only. Nothing is injected at session start.

## Acceptance criteria

1. The bodies of `architect`, `builder`, `commit-suggestion`, `code-review`,
   `appsec-review`, `remediate`, and `declutter` each contain a
   "Project conventions" step that reads `docs/goals.md`, `docs/conventions.md`,
   and `.flow/guidance/**/architecture.md` when present, and states they
   override the skill's defaults.
2. `architect` body contains the full inline confidence loop: state confidence
   0–100 per turn, one question at a time with a recommended answer, read
   code/docs before asking, ≥98% threshold, write/refine `docs/plans/NNNN-*.md`,
   stop and wait for explicit "go" before any code change.
3. `builder` body defers non-trivial design to `/sk-architect` (which now runs
   the loop) and contains the convention step.
4. `convention` skill lists `.flow/guidance/**/architecture.md` among its load
   targets (after `docs/goals.md` + `docs/conventions.md`).
5. `/sk-confidence` and `/sk-convention` remain installed for pi (slash mode,
   unchanged) per skillset state.
6. No files in the pi-extensions repo are changed.
7. No new dependencies; no changes to skill frontmatter `description` fields.
8. `npm test` passes; rebuilt `dist/` and re-synced pi installs
   (`skillset update --force`) contain the updated bodies (grep-verifiable in
   `~/.pi/agent/prompts/`).

## Budget

- Files changed: 8 skill bodies under `src/skills/` (`convention`, `architect`,
  `builder`, `commit-suggestion`, `code-review`, `appsec-review`, `remediate`,
  `declutter`) + generated `dist/` + plan doc itself.
- New dependencies: none.
- Line ceiling: ~+45 lines total (3–6 per skill body).

## Decisions

- Convention bridge = read **both** doc sets: `docs/` (skillset-native) and
  `.flow/guidance/**/architecture.md` (flow-native). Skillset-side only; zero
  edits in pi-extensions. `AGENTS.md`/`CLAUDE.md` at repo root are already
  injected by pi's own resource loader — convention does not duplicate them.
- Confidence folded inline into `architect`; `builder` defers to it.
  Standalone `/sk-confidence` and `/sk-convention` kept — explicit deep-load
  path stays available, both harnesses unaffected.
- Mechanism = a short "Project conventions" step in each body. On-demand,
  harness-agnostic (works in claude-code/opencode/copilot identically), zero
  tokens until the skill is invoked. Rejected: session-start injection
  (violates the no-pollution policy) and referencing `/sk-convention` from
  other skills (recreates the two-step flow).

## Approach

1. `convention`: add flow guidance bullet + note that root `AGENTS.md`/
   `CLAUDE.md` are harness-loaded already.
2. `architect`: add convention step; replace the "hand the floor to
   `confidence`" paragraph with the inline loop (keep the doc-ownership line and
   note `/sk-confidence` remains available).
3. `builder`: add convention step; reword the defer line to point at the
   architect loop.
4. `commit-suggestion`, `code-review`, `appsec-review`, `remediate`,
   `declutter`: add the uniform convention step near the top.
5. Rebuild dist, re-sync all installs, run tests, grep-verify.

## Steps

1. Edit 8 canonical SKILL.md bodies (src/skills/).
2. `npm test` (existing suite: 163 tests).
3. `npm run build` (tsc + copy-skills.mjs → dist).
4. `skillset update --force` — re-render all recorded installs.
5. Verify: grep "Project conventions" in `~/.pi/agent/prompts/` (and claude/
   opencode/copilot locations as installed); confirm `convention` body contains
   `.flow/guidance`; confirm pi state still lists `/sk-confidence` +
   `/sk-convention` as slash.

## Open questions

- None blocking. Minor: whether `docs/architecture.md` should move from
  on-demand to default reading — kept on-demand (size discipline).
- Flow `.flow/guidance/**/architecture.md` may not exist in most projects —
  the step is conditional ("if present"), so cost is one stat per invocation.

## Confidence

~90%. Decisions locked via developer Q&A; scope is body-text edits with a
mechanical verification path. Residual risk: wording churn on re-sync
(same-mode reinstalls are idempotent — no drift expected).

## Review log

(empty — `remediate` appends one line per round.)
