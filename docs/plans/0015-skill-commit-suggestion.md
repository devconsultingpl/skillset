# 0015 — bundled skill: `commit-suggestion`

## Goal

Ship a `commit-suggestion` skill in the bundled set. Triggered on demand (or auto when intent is "what should I commit this as"), it inspects uncommitted/staged changes, considers the repo's existing commit style, and emits a ready-to-paste `git commit -m "..."` line — favoring one-line messages because the user works from the terminal and multiline copy-paste is awkward.

If a proven single-shot copy-paste method for multi-line commits exists (heredoc form), the skill offers it as an explicit alternative when the change is large enough to warrant body text. User has asked for this to be proposed and verified.

## Decisions

**Default output: one line.**
- Most commits are small enough that a single line captures the *why*.
- Output is the full `git commit -m "..."` invocation, not just the message text — user copies and pastes a working command.
- Style follows the repo's existing log (the skill samples recent commits to match tone, length, and conventions like prefix/scope/imperative mood).

**Multi-line is offered, not default.**
- When the diff is large, spans multiple concerns, or has non-obvious motivation, the skill offers a multi-line message *in addition to* the one-line option.
- Multi-line is delivered via heredoc form so the whole thing is a single copy-paste — no editor opens, no manual line entry.
- The heredoc form is the *proposed* mechanism; user has asked us to verify it works cleanly in their shell (zsh on darwin). First use of the skill includes a verification step.

**Proposed multi-line form** (single copy-paste, zsh/bash compatible):
```bash
git commit -m "$(cat <<'EOF'
Subject line — imperative, concise

Longer explanation paragraph if needed. Wraps at ~72 chars conventionally
but this isn't strictly enforced for internal repos.

- bullet one
- bullet two
EOF
)"
```
Why this works:
- Single-quoted `'EOF'` prevents shell from expanding `$`, backticks, or `!` inside the message body — safe for messages containing code or special chars.
- The whole block is one continuous paste; the shell consumes it as a single command. No need to enter an editor.
- Compatible with bash and zsh out of the box. Fish requires different syntax (not currently supported; flag if user switches shells).

**Style-matching from recent log.**
- Skill runs `git log -20 --oneline` (or similar) and reads patterns: prefix style (none / type-scope / ticket), length, capitalization, imperative vs descriptive.
- Output mimics the dominant pattern. Doesn't impose external conventions (e.g. Conventional Commits) unless the repo already uses them.

**Reads staged changes by default, falls back to all uncommitted.**
- If anything is staged, suggestion describes the staged diff.
- If nothing is staged, describes everything uncommitted (and notes that the user will need to `git add` first).
- If multiple unrelated concerns are detected (heuristic: changes across very different paths/types), the skill flags this and suggests splitting into multiple commits before crafting messages.

**No automatic commit.** Per project convention (user handles all git operations), the skill *only* outputs the suggested command. Never executes `git commit` itself.

**No co-author tag.** Skill output does not include the `Co-Authored-By:` line that Claude Code's default commit flow adds. This is a *suggestion* skill; tagging authorship is a separate policy decision the user makes when they paste the command.

## Composition

- Slash: `/commit-suggest` (primary), maybe alias `/commit-msg`.
- Auto-trigger: phrases like "what should the commit message be", "suggest a commit message", "commit this".
- Composes with `code-review` (0008): a typical flow is "review → fix → commit", so the skill should work naturally as the last step.
- Read-only with respect to the repo. Doesn't write files, doesn't run git commands beyond `status`, `diff`, `log`, `diff --staged`.

## Scope

**In scope (v0):**
- One-line suggestion in `git commit -m "..."` form.
- Multi-line suggestion in heredoc form when warranted.
- Style match against recent log.
- Staged-only vs all-uncommitted handling.
- Multi-concern flag with split suggestion.

**Out of scope (v0):**
- Executing the commit.
- Adding co-author tags.
- Pushing.
- Crafting PR descriptions (separate skill — see notes below).
- Squashing or amend suggestions.
- Conventional Commits enforcement (only mirrors if already in use).

## Research surface

- Existing `commit-message` / `commit-suggest` skills in Claude Code and opencode ecosystems.
- Conventional Commits spec (https://www.conventionalcommits.org) — only as reference, not as enforcement.
- How Claude Code's own commit flow constructs messages (already documented in the system prompt's git-commit section). The heredoc pattern is borrowed from there and is known to work.
- Shell-portability notes for heredoc form (bash vs zsh vs fish).

## Three candidate design axes to brainstorm

1. **Single output vs paired output.** Always emit just one suggestion (one-line, escalate to multi-line if large), vs always emit both (one-line + multi-line) and let user pick. Paired is more useful but noisier.
2. **Style-matching strictness.** Strict (mimic recent log exactly), loose (use general best practice with light style match), or configurable per project. Strict reduces surprise; loose helps repos with messy histories.
3. **Multi-concern handling.** Flag and suggest split, vs craft one combined message, vs offer both with explicit "(consider splitting)" annotation. Splitting is the right answer pedagogically but adds friction.

## Approach

Research + design plan. Implementation steps emerge from brainstorming.

## Steps

1. **Verify heredoc copy-paste in user's shell.**
   - On first use (or as a one-time verification step), the skill outputs the heredoc template with a trivial test message and asks the user to paste-and-run against an empty commit to confirm zsh handles it as expected. (Or user manually verifies before adopting.)
   - Capture result in a `docs/plans/0015-verification.md` notes file if useful.
2. **Research.**
   - Web search for representative commit-message-suggestion skills/commands in agent ecosystems.
   - Skim 2–3 existing implementations for output shape, trigger logic, edge case handling.
   - Read Claude Code's own git-commit section (system prompt) for the heredoc pattern, since that's the proven mechanism.
3. **Draft three design options.** Each one paragraph + sample output:
   - Option A: single-output, escalates one-line → heredoc when diff is large or multi-concern.
   - Option B: always paired (one-line + heredoc), user picks.
   - Option C: one-line only by default, heredoc only when user explicitly asks for "with body".
4. **Compare.** Trade-off matrix: noise, copy-paste UX, style-match fidelity, multi-concern handling.
5. **Brainstorm with user.** Present options + recommendation. User picks or directs synthesis.
6. **Write implementation sub-plan.** Append `## Implementation` section once direction is picked. SKILL.md text, trigger description, mode support.
7. **Execute.**
   - Add `src/skills/commit-suggestion/SKILL.md`.
   - Slash + auto modes.
   - Tests for each target's render and a smoke test for the bundle.
   - README mention.

## Open questions

- Skill slug: `commit-suggestion`, `commit-suggest`, `commit-msg`, or `commit`? Lean: `commit-suggestion` for the dir name, slash `/commit-suggest` for invocation. Decide in step 5.
- Should the skill also support amending the last message (suggest a *replacement* message for `git commit --amend -m "..."`)? Likely out of scope for v0 — flag as followup.
- PR description suggestion is a sibling skill (read commit log between branch and base, produce PR body). Out of scope here, but worth noting as a likely 0016.
- Should the skill warn when the diff touches `.env`, `*.key`, `secrets/`, etc.? Useful safety net, but might overlap with `security-review`. Lean: include a small built-in warning since it's cheap and the moment-of-commit is when it matters.
- Multi-line: should the skill always offer it as the *secondary* option, or hide it unless asked? Decide in step 5 after seeing how often diffs warrant a body.

## Followup (not in 0015)

- **0016 — `pr-description` skill.** Generate PR title + body from branch's commit log + diff. Similar shape to commit-suggestion but operates on a range, not a single working tree.
- **`commit-amend-suggest`** — possibly fold into 0015 if straightforward.

## Confidence

≥90% on research + design plan. Implementation confidence assessed after design pass.

Heredoc multi-line approach is borrowed from Claude Code's own commit flow and is known-good in bash + zsh; verification step is included as a courtesy, not because the pattern is suspect.
