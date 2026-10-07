---
name: instruction-ownership
version: "0.1.0"
description: Who owns skills, prompts, agent definitions and the guidance that shapes work, and what to do instead of editing an installed copy.
slug: sk-ownership
---

# Instruction ownership

Skills, prompts, agent definitions and the guidance that shapes work are owned by the **skillset** repository (`~/source/priv/skillset`). Everything installed elsewhere is an output, never a source.

## Never

- Edit an installed copy — `~/.pi/agent/{skills,prompts,agents,APPEND_SYSTEM.md}`, `~/.claude/**`, `~/.config/opencode/**`, or the project-local equivalent. It will be overwritten by the next sync.
- Edit a settings file by hand. Those belong to the user.
- "Fix drift" by editing the installed file. Drift is repaired from source, and the repair reports the prior content.

## Instead

1. Change the source: `src/skills/<name>/SKILL.md` in the skillset repo.
2. Run `skillset sync` — or `skillset sync --dry-run` to see what would change first.
3. In another project, when owned content needs a change, **file a suggestion** instead: append one JSON object per line to `.skillset/suggestions.jsonl`:

   ```json
   {"target":"skills/code-review","change":"…","why":"…","evidence":"…","session":"…","at":"…"}
   ```

   The user triages those in a skillset session and decides what is real. Suggestions are the only channel a project agent has into owned content.

## Why this is a rule

The pi auto-skill directory drifted from `src/skills/` twice before this rule existed, because the installed copies could not be recorded (ADR 0005) and nothing detected the divergence. A second copy of a rule means the two copies disagree eventually, and the copy nobody edits wins by accident.
