---
name: commit-suggestion
version: "0.1.0"
description: Suggest a ready-to-paste git commit command for the current changes, matching the repo's existing log style. Emits a concise one-liner and a heredoc multi-line form every run; you pick and paste. Auto-activates on "suggest a commit message / commit this / what should I commit this as". Read-only — never runs git commit.
slug: commit-suggest
---
# commit-suggestion

Suggest a commit message for the current changes as a ready-to-paste command. Activates on "suggest a commit message / commit this / what should I commit this as", or `/commit-suggest`. Read-only: only inspects the repo (`git status` / `diff` / `log` / `diff --staged`) — never runs `git commit`, never pushes.

## Read the change
- If anything is staged, describe the **staged** diff. Otherwise describe **all uncommitted** changes and note the user must `git add` first. A clean tree → say there's nothing to commit.
- Sample `git log -20` (or `--oneline`) and match the repo's dominant style: prefix convention (none / type-scope / ticket), length, capitalization, imperative vs descriptive. If the log is sparse or inconsistent, fall back to imperative, concise, no forced prefix. Don't impose Conventional Commits unless the repo already uses them.

## Emit both forms
Always give two ready-to-paste commands, one-liner first (the favored default):

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
- **Secrets:** if the diff touches `.env`, `*.key`, `*.pem`, or `secrets/`, add a one-line heads-up before the suggestion — the moment of commit is when it matters. Depth is `security-review`'s job.

## Don't
Execute the commit, push, amend, or add a `Co-Authored-By` line. This skill only *suggests* — the user runs git.
