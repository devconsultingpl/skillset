---
name: instruction-ownership
version: "0.1.0"
description: Who owns skills, prompts, agent definitions and the guidance that shapes work, and what to do instead of editing an installed copy.
slug: sk-ownership
---

# Instruction ownership

Skills, prompts, agent definitions and the guidance that shapes work are owned by the **skillset** repository (`~/source/priv/skillset`). Everything installed elsewhere is an output, never a source.

## Never

- Edit or hand-write an installed copy — `~/.pi/agent/{skills,prompts,agents,APPEND_SYSTEM.md}`, `~/.claude/**`, `~/.config/opencode/**`, `~/.skillset/copilot/**`, `.github/copilot-instructions.md`, or the project-local equivalent. The list is where the artifacts are, not the limit of the rule; the next sync overwrites it.
- Edit a settings file by hand. Those belong to the user.
- "Fix drift" by editing the installed file. Drift is repaired from source, and the repair reports the prior content.

## Instead

**In the skillset repository** (`~/source/priv/skillset`): change the source — a skill is `src/skills/<name>/SKILL.md`, a subagent `src/agents/<name>.md` — then run `skillset sync` (`--dry-run` first) and paste its report.

**In any other project:** run one command and stop; never reach for the source from here.

```sh
skillset suggest "<what should change, and why>"
```

It appends one line, tagged with the project it came from, to a single queue a skillset session reads, decides, applies and clears — the only channel a project agent has into owned content.

## Why this is a rule

A second copy of a rule means the two disagree eventually, and the copy nobody edits wins by accident — the drift history is ADR 0006's context.

Where a *new* capability lives follows **One provider per name**, in `docs/conventions.md`; read it before choosing a home for something that does not exist yet.
