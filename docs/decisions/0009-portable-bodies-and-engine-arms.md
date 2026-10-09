# 0009 — what a portable body may not name, and which bodies stay with the engine

**Status: implemented for slice 3d-i** — the rule is in `docs/conventions.md` under *Portable bodies*, and its first four subjects are `annotate-guidance`, `annotate-inline`, `changelog` and `frontend-design`, moved out of the FLOW package in the same slice.

## Context

This repository owns instruction content and renders one body per harness. Triage of 30 skill bodies that arrived from a pi package (`packages/flow/skills/`) found two kinds of coupling that a review of the diff cannot tell apart from ordinary prose, and both survived three slices of this programme unnoticed.

**A workspace extension, not the harness, was providing the mechanics.** Four tokens those bodies use are expanded by `packages/flow-args`, a pi extension in the same monorepo: `${SKILL_DIR}` (24 of 30 bodies, 50 occurrences), `$ARGUMENTS` (30 of 30, 38 occurrences), fenced ```` ```! ```` shell substitution (23 bodies) and `shell-timeout` (25 bodies). None of the four exists in pi — `grep` over the installed package's dist and docs returns nothing for `${SKILL_DIR}` or `shell-timeout`, `_expandSkillCommand` substitutes nothing and appends the raw argument string instead — and none exists in any other harness either. A body carrying them therefore works in exactly one place, while reading as if it were portable.

**A harness tool's dialog was written into the method.** 26 bodies name `ask_user_question`, 14 spell out its 16-character header cap (`MAX_HEADER_LENGTH`), 10 describe its auto-appended free-text row, 16 rely on its `(Recommended)` label convention. The *capability* — ask the developer a question with options — is portable; the widget is one harness's.

**A third class was a dispatch question, not a prose question.** 17 of the 30 bodies are run by name from the pi workflow engine (`builtInWorkflows`, stage names and `skill:` overrides). Their prose is often as neutral as any portable body's, but their stage, channel and `contract:` are wired in `built-in-workflows.ts`; moving one makes that engine's stage depend on an installed artifact rather than the bundled package.

## Decision

**A body this repository owns must be executable where none of this workspace's extensions exist.** It names no extension-provided substitution and no harness tool's dialog surface. It describes capabilities generically — "ask the developer with options", "if this session exposes an adjudication tool" — and lets the harness supply the tool. Concretely, `${SKILL_DIR}` becomes a path relative to the skill's own directory (the sibling mechanism of ADR 0007), `$ARGUMENTS` becomes prose about the arguments, fenced ```` ```! ```` blocks become a fenced command the agent runs itself, and `shell-timeout` is dropped with the fences it bounded.

**A body the engine dispatches by name does not move**, however neutral its prose. This is a dependency decision, not a portability one: moving such a body makes the engine's stages require an installed artifact. It was accepted once, deliberately, for `code-review` (ADR 0006's successor note and slice 2b); accepting it seventeen times is a re-scope of the dependency, and it belongs to a plan that says so.

## Consequences

- **Bodies move less often and are rewritten more when they do.** The rewrite is mechanical and its list is measurable, which is how the four mapped bodies of slice 3d-i were checked: a residual sweep for every token in the class returns nothing.
- **Two failure modes become visible instead of silent.** Before, a moved body carrying `${SKILL_DIR}` shipped inert text to three harnesses and nothing reported it; a stage whose skill was no longer bundled failed only at run time. Both now have a check — the residual sweep, and the one-provider rule per harness.
- **A genuinely useful pi convenience is not available to owned content.** `${SKILL_DIR}` is the cheaper way to call a sibling script and it cannot be used here. Accepted: the alternative is a body that half-works outside pi, which is worse than a body that works everywhere.
- **The triage has a repeatable shape.** For any future body: is it dispatched by name? does it publish a gate input? If neither, is the method expressible without a token this class forbids? The 30 verdicts are recorded in `docs/plans/0023-skillset-owns-instructions.md` under *3d*, so the next body is judged by comparison rather than from scratch.
