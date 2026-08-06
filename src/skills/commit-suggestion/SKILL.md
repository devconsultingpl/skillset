---
name: commit-suggestion
version: "0.1.0"
description: Suggest a ready-to-paste git commit command for the current changes, matching the repo's existing log style. Emits a concise one-liner and a heredoc multi-line form every run; you pick and paste. Auto-activates on "suggest a commit message / commit this / what should I commit this as". Read-only — never runs git commit.
slug: sk-commit-suggest
---
# commit-suggestion

Suggest a commit message for the current changes as a ready-to-paste command. Read-only: only inspects the repo (`git status` / `git diff HEAD` / `log` / `diff --staged`) — never runs `git commit`, never pushes.

## Project conventions
If the project carries them — `docs/goals.md`, `docs/conventions.md`, or `.flow/guidance/**/architecture.md` — read them first; they override these defaults.

## Optional subject
If the invocation carried a subject, make it the message's focus. No subject → derive it from the diff.

## Read the change
- By default describe the **full working-tree change** (`git diff HEAD`) — staged and unstaged together — and note the user must `git add` them before committing. A clean tree → say there's nothing to commit. If the user scoped the request (staged only, or specific paths), follow that scope instead.
- Sample `git log -20` (or `--oneline`) and match the repo's dominant style: prefix convention (none / type-scope / ticket), length, capitalization, imperative vs descriptive. If the log is sparse or inconsistent, fall back to imperative, concise, no forced prefix. Don't impose Conventional Commits unless the repo already uses them.

## Emit both forms
Always give two ready-to-paste commands, one-liner first — and **the one-liner is the answer** unless the change genuinely can't be explained in one line (a migration with an ordering constraint, a non-obvious *why* a reader will need, a breaking change). Say which you'd use, and lead with the one-liner.

1. **One-liner** — `git commit -m "subject"`. Captures the *why* in one imperative line.
2. **Multi-line** (heredoc, body scales to the change — may be just the subject for a small diff):
   ```bash
   git commit -m "$(cat <<'EOF'
   Subject — imperative, concise

   Why this change, what it affects. Bullets for distinct points.
   EOF
   )"
   ```
   The single-quoted `'EOF'` keeps `$`, backticks, and `!` literal — safe for any message. One continuous paste; no editor opens. Works in bash/zsh (fish differs — flag if the user switches shells).

## Flag, don't block
- **Multi-concern:** if the diff spans clearly unrelated paths/types, still emit working message(s), then add "looks like N concerns; consider splitting" with the suggested split. Never withhold a usable message.
- **Secrets:** if the diff touches `.env`, `*.key`, `*.pem`, or `secrets/`, add a one-line heads-up before the suggestion — the moment of commit is when it matters. Depth is `appsec-review`'s job.

## Don't
Execute the commit, push, or amend. This skill only *suggests* — the user runs git.

Don't volunteer a `Co-Authored-By` or other trailer on your own — but if the harness or the repo mandates one, include it. A standing instruction wins over this default.
