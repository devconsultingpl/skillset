# 0008 — bundled skill: `code-review`

## Goal

Ship a `code-review` skill in the bundled set. The user doesn't have an existing personal version to port — research how mature code-review skills/commands look across Claude Code, opencode, etc., propose 2–3 design options, then settle on one in a brainstorming pass before implementation.

## Decisions

**Discovery + design plan, not implementation plan.** Implementation steps will be decided after the brainstorming pass. This plan covers: research, three candidate designs, comparison, recommendation.

**Scope of the skill (rough).**
- Triggered on demand: `/review` or `/code-review` (slash mode).
- Reviews *pending changes* on the current branch (git diff against base) — not the whole codebase.
- Outputs a structured set of comments: severity (blocker / important / nit), location (`file:line`), rationale, suggested fix where obvious.
- Aware of `docs/conventions.md` if present (loose coupling with `convention` skill — read it if it exists, no hard dependency).

**Out of scope for v0.**
- Posting comments to GitHub PRs (would require gh CLI + heavy plumbing).
- Auto-applying fixes (separate skill — that's closer to `simplify`).
- Multi-branch / multi-PR review.

**Research surface — places to look.**
- Anthropic's own `claude-review` patterns (built-in `/review` in Claude Code if present).
- Public Claude Code skills repos / discussions about review prompts.
- `opencode` community skills for review.
- General prompt-engineering literature for "code-review by LLM" (calibration, false-positive control, severity rubrics).
- Existing review prompts in Cloudflare's workers-best-practices reference, found earlier at `/Users/joozik/.codex/.tmp/plugins/plugins/cloudflare/skills/workers-best-practices/references/review.md` — worth a read as a concrete example.

**Three candidate axes to brainstorm.**
1. **Single-pass vs multi-pass review.** One prompt that emits all findings, vs sequence of focused passes (correctness → readability → conventions → security → perf).
2. **Severity rubric.** Three-tier (blocker / important / nit), four-tier (blocker / important / suggestion / nit), or task-list output without severity.
3. **Convention integration.** Hard require `docs/conventions.md` present, soft read (use if present), or completely standalone.

## Approach

This is a research-and-design plan. Implementation comes after brainstorming concludes.

## Steps

1. **Research.**
   - Web search for representative code-review skill/command implementations in agent ecosystems (Claude Code, opencode, others).
   - Read the Cloudflare workers-best-practices review reference at `/Users/joozik/.codex/.tmp/plugins/plugins/cloudflare/skills/workers-best-practices/references/review.md`.
   - Skim 2–3 popular open-source AI code-review prompts for severity rubrics and output shape.
   - Capture a short notes file (`docs/plans/0008-research-notes.md`, optional) summarizing what's common, what varies, what works.
2. **Draft three design options.** Each one paragraph + concrete sample output:
   - Option A: single-pass three-tier rubric with `file:line` anchoring.
   - Option B: multi-pass focused review (correctness → conventions → security → perf), one pass per concern, combined report.
   - Option C: question-led review (mirrors the `confidence` skill) — agent asks the user what they care about for this change before reviewing.
3. **Compare.** Trade-off matrix: cost (tokens), false-positive risk, fits-on-screen output, integration cost.
4. **Brainstorm with user.** Present the three options + comparison. User picks (or directs a synthesis). Recommendation comes with the proposal.
5. **Write implementation sub-plan.** Once direction is picked, write `0008b-skill-code-review-impl.md` (or append a `## Implementation` section to this plan) with concrete SKILL.md content, modes, tests.
6. **Execute.** Implementation steps as decided. Likely shape: `src/skills/code-review/SKILL.md`, slash + auto support, README mention, tests for each target's slash render.

## Open questions

- Should this skill be slash-only, or also auto-trigger when the agent notices a "review this" intent? Decide in step 4.
- Does the convention skill's output (read at session start in `always` mode) suffice as context, or does the review skill need to re-read `docs/conventions.md` itself? Decide in step 4.
- Is there a "first-pass run on local diff" vs "review a specified PR / commit range" distinction worth making? Lean toward local diff only for v0 — simpler, no `gh` dependency.
- Severity terminology: blocker/important/nit, or different vocabulary? Step 1 research informs.

## Confidence

≥90% on the *research + design plan* itself. Implementation confidence will be assessed when the design is picked.
