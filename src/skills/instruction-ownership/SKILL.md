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
- Hand-write anything into an installed path ad hoc. The list above is where the artifacts are, not the limit of the rule.
- Edit a settings file by hand. Those belong to the user.
- "Fix drift" by editing the installed file. Drift is repaired from source, and the repair reports the prior content.

## Instead

**In the skillset repository** (`~/source/priv/skillset`): change the source — a skill is `src/skills/<name>/SKILL.md`, a subagent `src/agents/<name>.md` — then run `skillset sync` (`--dry-run` first) and paste its report.

**In any other project:** run one command and stop. Do not reach for the source from here.

```sh
skillset suggest "<what should change, and why>"
```

It appends one line to a single queue, carrying the project you ran it from. A session working in the skillset repository reads that queue, decides what is real, applies it and takes the line out — that is the only channel a project agent has into owned content.

## Why this is a rule

The pi auto-skill directory drifted from `src/skills/` twice before this rule existed, because the installed copies could not be recorded (ADR 0005); a second copy of a rule means the two disagree eventually, and the copy nobody edits wins by accident.

Where a *new* capability lives follows one further rule — **One provider per name**, in this repository's `docs/conventions.md`. Read it before choosing a home for something that does not exist yet.
