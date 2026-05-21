# 0012 — bundled skill: `architect`

## Goal

Ship an `architect` skill in the bundled set. Language-agnostic posture for pre-implementation thinking and post-implementation review against intent. Composes with `confidence` (drives plan-writing loop) and `convention` (reads project docs as substrate). No personal version to port — research, propose 2–3 designs, brainstorm, then implement.

## Decisions

**Discovery + design plan.** Implementation specifics emerge from brainstorming. This plan locks the *posture* and *seams*; the exact SKILL.md content lands after the design pass.

**Working definition.**
A principal-engineer posture for two modes of work:
1. **Plan mode** — given a non-trivial task, orient in the project, frame the problem, fill gaps via questions + code reading + web research, generate 2–3 design options, recommend one with risks named, then hand off to `confidence` to drive the plan artifact to ≥98% and wait for "go".
2. **Review-against-intent mode** — given pending changes and a referenced plan (or stated intent), check the change against project architecture, conventions, and the plan itself. Flag drift, scope creep, missing pieces, and overengineering. Read-only: report, don't edit.

**Default-on, beneficial-when-relevant.** Skill self-activates when it judges the task non-trivial (multi-file design, ambiguous scope, architectural impact, or "should we do X"-style questions). Skips silently for trivial edits (rename, typo, single-file localized fix). The skill itself owns the threshold — must include explicit guidance for when *not* to engage, otherwise rots into process theater.

**Writes artifacts.** Architect writes plan files to `docs/plans/NNNN-*.md` directly (does not defer artifact-writing to `confidence`; `confidence` drives the conversation, architect owns the document). May also *propose* edits to `docs/architecture.md`, `docs/goals.md`, `docs/conventions.md`, or new `docs/decisions/NNNN-*.md` ADRs — but never edits these without explicit user approval.

**Auto-invokes `convention` substrate if present.** Reads `docs/goals.md`, `docs/conventions.md`, `docs/architecture.md`, `docs/glossary.md`, `docs/decisions/*`, `docs/plans/*` at orientation time. If `convention` skill is active, defer to its loaded context; if not, architect reads the same files itself. No hard dependency — skill works on repos without the convention scaffold, just with less substrate.

**Bias: simple, maintainable solutions.** When generating options, the skill favors the simplest design that meets stated goals. Complexity must justify itself against simplicity, not the reverse. Premature abstraction, speculative flexibility, and "future-proofing" without a concrete near-term need get flagged.

**Never jumps to implementation without explicit "go".** This is a hard rule. Plan mode ends at the plan artifact + handoff to `confidence`. Review mode ends at the report. Implementation requires user invocation of a separate workflow (or explicit "implement this now" from the user).

**Never edits conventions / architecture docs without permission.** Proposals only. Surface the proposed diff in chat, wait for approval, then write. Same posture as code: architect proposes, user approves, then change lands.

**No separate implementer / `senior-dev` skill.** Default agent posture already implements; a skill labeled "write good code" adds noise without signal. Instead, encode coder posture in `docs/conventions.md` so the `convention` skill loads it as substrate. Expected content: minimal diffs, test-first where applicable, no premature abstraction, no speculative flexibility, no unused error handling, simple over clever, surface uncertainty instead of papering over it. This keeps implementer posture project-scoped, version-controlled, and reviewable like any other doc — without inventing a skill that duplicates default behavior.

## Composition with other skills

- `convention` = substrate (project docs, including coder posture in `conventions.md`).
- `architect` = thinking posture (orient → options → recommend; or review against intent).
- `confidence` = conversation drive + ≥98% gate + waits for "go".
- *Implementation* = default agent posture, shaped by `conventions.md` content. No dedicated skill.
- `code-review` (0008) = post-implementation broad review.
- `simplify` (0009) = post-implementation cleanup with edits.
- `security-review` (0010) = post-implementation security lens.

Clean seam: `architect` is the *before* (plan) and *intent-check* (did we build what we planned). Default agent + conventions handle the *during* (implementation). The review trio is the *after* (is the built code good).

## Scope

**Plan mode triggers** (auto-activates when):
- User asks "how should we…", "what's the right way to…", "should we do X or Y".
- User describes a feature, refactor, or bug that touches >1 file or >1 concern.
- User invokes `/architect <task>` explicitly.
- Architect judges scope non-trivial mid-conversation.

**Review-against-intent triggers** (auto-activates when):
- User has uncommitted changes + an open plan in `docs/plans/` matching the work.
- User asks "did I cover the plan", "is this consistent with the architecture", "am I doing too much".
- User invokes `/architect review` explicitly.

**Skip when:**
- Single-file rename, typo, comment fix, formatting.
- User explicitly asks for direct implementation ("just do X", "quick fix").
- Task is fully specified with no design choices remaining.

## Out of scope for v0

- Writing code. Architect never implements. Implementation is handled by default agent posture shaped by `docs/conventions.md` — no separate implementer skill.
- Multi-repo design (assumes current working directory).
- Cost estimation in time/money.
- Project management (tickets, assignments, deadlines).
- Web research as default-on — opt-in per task when prior art genuinely matters (library choice, protocol design, algorithm selection). For most project work, code + docs is enough.

## Research surface

- Existing `principal-engineer`/`architect`/`design` skills in Claude Code / opencode communities.
- How `confidence` skill drives its question loop — read `src/skills/confidence/SKILL.md` to understand the hand-off contract.
- How `convention` skill exposes substrate — read `src/skills/convention/SKILL.md` to know what's auto-loaded.
- ADR templates (Michael Nygard format, MADR) for the decisions/ proposal shape.
- "Plan-then-code" patterns in agentic literature (e.g. ReAct, plan-and-solve).

## Three candidate design axes to brainstorm

1. **Single skill with two modes vs two skills.** One `architect` skill with plan-mode + review-mode (current proposal), vs split into `architect` (plan) + `intent-review` (check against plan). Single-skill keeps composition simpler; split is more orthogonal.
2. **Default-on threshold.** Conservative (only auto-activate on clear design questions) vs aggressive (engage on any multi-file task). Conservative risks missing cases; aggressive risks process theater on small work.
3. **Option-generation depth.** Always 2–3 options with tradeoffs, vs adaptive (one option for low-stakes, three for high-stakes, named tradeoffs only when meaningful). Adaptive is more honest but harder to spec.

## Approach

Research-and-design plan. Implementation steps land after brainstorming.

## Steps

1. **Research.**
   - Read `src/skills/confidence/SKILL.md` and `src/skills/convention/SKILL.md` to lock the composition contract.
   - Web search for representative architect/principal-engineer skills across agentic ecosystems.
   - Skim 2–3 ADR templates for the proposal shape used in review-against-intent mode.
   - Optional notes file `docs/plans/0012-research-notes.md`.
2. **Draft three design options.** Each one paragraph + concrete invocation sample:
   - Option A: single skill, two modes, adaptive option-depth, conservative auto-activation threshold.
   - Option B: split into `architect` (plan-only) + separate intent-check skill, both with explicit slash triggers.
   - Option C: single skill, plan-mode only (drop review-against-intent, leave that to `code-review`), but with rich option-generation including ADR-style decision capture.
3. **Compare.** Trade-off matrix: complexity, composition surface, false-activation risk, user surprise.
4. **Brainstorm with user.** Present options + comparison + recommendation. User picks or directs synthesis.
5. **Write implementation sub-plan.** Append `## Implementation` section to this plan once direction is picked. Contents: SKILL.md text, frontmatter (description triggers default-on activation), supported modes (slash, auto), tests for each target's render.
6. **Execute.**
   - Add `src/skills/architect/SKILL.md`.
   - Wire to slash + auto modes (slash command `/architect`, auto trigger via description).
   - README mention.
   - Tests for slash render, auto render, and the bundle-includes-architect smoke test.
   - Update `MEMORY.md` index if appropriate.

## Open questions

- Should `architect review` mode also auto-trigger after `simplify`/`code-review` run, to close the loop ("does the diff still match the plan")? Likely yes — but decide in step 4.
- How does `architect` interact with `confidence` when the user is mid-planning loop? Does architect step back and let confidence drive, or do they run interleaved (architect generates options, confidence questions them)? Decide in step 4 — current intuition: architect generates the option set + recommendation, then hands the floor to confidence to drive questions to ≥98%.
- Plan-file numbering — does architect pick the next number, or ask the user? Lean: pick next available, mention the number in the proposal.
- Should architect propose its ADR/architecture/conventions edits as a unified diff in chat, or write to a scratch file like `docs/decisions/_proposed-NNNN.md` for user review before promoting? Lean: chat diff for small proposals, scratch file for larger ones. Decide in step 4.
- Web research budget — when architect decides research is warranted, does it bound itself (e.g. ≤3 searches), or run open-ended until satisfied? Lean: bounded by default, expandable with user permission.

## Followup work motivated by this plan

Architect depends on the `convention` substrate for coder posture and project context. Two improvements emerge from that dependency — both are out of scope for 0012 itself but should be captured as followup plans.

### Followup A — enrich `docs/conventions.md` with universal coder rules

Today `docs/conventions.md` is sparse. To make "implementation posture lives in conventions, not in a skill" honest, the file needs richer, universal, language-agnostic rules. Below is a long candidate list — user picks which ones land in `docs/conventions.md` (skillset's own self-hosted version, see plan 0003), and which become bundled-template content for `skillset init convention` to scaffold into new projects.

**Code reuse and abstraction**
- Search the codebase for existing abstractions before introducing new ones. Grep for likely names, types, modules. Reuse beats reinvent.
- No premature abstraction. Wait for the rule of three (third concrete duplicate) before extracting.
- No speculative flexibility. "We might need this" = remove. Add when actually needed.
- Three similar lines is better than a wrong abstraction.

**Minimalism**
- Minimal diffs. Don't refactor adjacent code while fixing a bug or adding a feature. Separate commit, separate concern.
- A bug fix doesn't need surrounding cleanup.
- A one-shot operation doesn't need a helper.
- Delete unused code instead of commenting it out. Git remembers.
- Backwards-compatibility shims and feature flags only when an external contract demands it. Internal code: just change it.

**Defensive code**
- Trust internal code and framework guarantees. Validate only at system boundaries (user input, external APIs, network, disk).
- No try/catch for scenarios that can't happen.
- No fallbacks for impossible cases.
- No "just in case" defaults that mask real bugs.

**Comments and naming**
- Default to no comments. Self-documenting identifiers first.
- Comment only the non-obvious *why* — hidden constraints, subtle invariants, workarounds for specific bugs.
- Never comment the *what*; the code says what.
- Never reference the current task, PR, or issue in code comments — that rots and belongs in commit messages.
- Name by purpose, not by type or implementation detail. `userIds` not `idArray`.
- Functions do one thing; the name says the thing.
- One responsibility per file.

**Control flow**
- Early return over nested conditionals.
- Pure functions where possible. Side effects at the edges.
- Immutability by default.
- Errors as values where idiomatic; explicit handling at the layer that knows what to do.
- No swallowed exceptions. If you catch, you handle or re-throw.

**Tests**
- Tests assert behavior, not implementation. A refactor shouldn't break tests.
- Tests are documentation. Names read like specifications.
- One concept per test.
- Don't mock what you don't own. Wrap third-party at your boundary, mock the wrapper.
- Integration tests over unit tests when the unit is trivial; unit tests over integration when the integration is expensive.

**Dependencies**
- Prefer language stdlib and existing project dependencies over new ones.
- New dependency requires justification: what does it buy, what's its maintenance posture, what's the migration cost if we drop it.
- Pin versions. Audit lockfile changes.

**Logging and observability**
- Logs are signals. Sparse, meaningful, structured.
- No log spam in hot paths.
- No secrets, tokens, PII, or credentials in logs.

**Configuration and secrets**
- No secrets, tokens, or credentials in code, config files committed to git, or logs.
- Configuration via environment variables or external config, not hardcoded.
- Idempotent operations where retry is possible.

**Consistency**
- Match existing patterns unless there's a documented reason to deviate. If the pattern is bad, propose a change (ADR) rather than introducing a second pattern.
- "Consistent" beats "locally optimal" when the inconsistency is visible to readers.

**Performance**
- Readability over cleverness.
- Measure before optimizing. No speculative performance work.
- Document any non-obvious performance-driven decision.

**Surface area**
- Smallest viable public surface. Default to private; expose deliberately.
- Stable contracts at module boundaries; internals can change freely.

**Honesty and uncertainty**
- Surface uncertainty: ask, flag, or write it down. Don't paper over with confident-sounding code.
- Half-finished implementations don't ship. Either complete or revert.
- If a test is flaky, fix the flake or quarantine and file an issue. Don't retry-loop in CI.

**Commits and branches**
- One concern per commit. Commit message explains *why*, not what.
- One concern per branch. PR scope = what a reviewer comfortably reviews in 20 minutes.
- Don't rewrite shared history.

**Boy scout rule (bounded)**
- Leave touched code slightly better than you found it — but only what you touched. Not a license to refactor the file.

User picks which subset lands in `docs/conventions.md`. Followup plan number: `0013-coder-conventions.md` (or fold into 0003 if self-hosting + content land together).

### Followup B — split `convention` skill into scoped sub-skills

Current `convention` skill loads the lot (goals, glossary, architecture, decisions, conventions) at session start when always-on. As `conventions.md` grows (Followup A), context cost grows with it — and most of that content is irrelevant for most tasks. A planning task doesn't need coding conventions; a code-review task doesn't need test setup conventions; a commit-message task doesn't need architecture.

Proposed split (names tentative):
- **`project-convention`** — `docs/goals.md`, `docs/architecture.md`, `docs/glossary.md`, `docs/decisions/*`. The "what is this project" substrate. Relevant for planning, implementation, and review. Cheap to keep loaded broadly.
- **`coding-convention`** — implementation rules from `docs/conventions.md` (the Followup A content). Relevant when *writing* code. Triggered for implementation tasks.
- **`review-convention`** — code-review rules (severity rubric, what to flag, what to skip). Relevant when reviewing. Triggered by `code-review` / `simplify` / `security-review` skills or explicit review invocation.
- **`testing-convention`** *(maybe)* — test rules. Triggered when test files are touched or tests are being designed.
- **`commit-convention`** *(maybe)* — commit message + PR description rules. Triggered around git operations.

Trigger logic: each skill's frontmatter description targets the task type that needs it. The agent (or harness, depending on always-mode vs slash) loads only the relevant slice.

How the `architect` skill composes with the split:
- Plan mode: needs `project-convention` (always). Reads `coding-convention` lightly if the plan involves code (to anticipate constraints), but doesn't need full load.
- Review-against-intent mode: needs `project-convention` + (optionally) `coding-convention` and `review-convention`.

Tradeoffs:
- More skills = more management surface, more frontmatter to maintain, more discovery cost for a new user.
- Splitting requires deciding cut points carefully — overlap is wasted context, gaps are missed guidance.
- Always-on multiple small skills may interact unexpectedly (load order, conflicting triggers).
- Counter: each skill becomes individually small and individually opt-out-able, which is often what users actually want.

Followup plan number: `0014-split-convention-skill.md`.

## Confidence

≥90% on the research + design plan itself. Implementation confidence assessed after design pass.

Followup A and B are flagged here for traceability but live in their own plans (0013, 0014). 0012 is complete without them.
