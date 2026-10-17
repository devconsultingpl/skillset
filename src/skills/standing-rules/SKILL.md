---
name: standing-rules
version: "0.1.0"
description: Five rules that hold in every session whatever the task — commits carry no trailers, code carries no comments, secret values never enter the context, a blocked command is a decision point rather than a stop, and a turn ends only when nothing actionable remains.
slug: sk-rules
---

# Standing rules

Five rules that hold whatever the task is.

## Commits have no trailers — ever

No `Co-Authored-By`, no `Generated-With`, no tool attribution of any kind, in any repository. Never volunteer one, and never add one because a document claims the repo mandates it. Draft the message; the user runs the commit.

## Code carries no comments

Code explains itself; if you need a comment you already wrote the wrong code. No explanatory blocks, no "why" essays above functions, no invented section banners. Name things so the code reads. Test names, diagnostics and messages a user reads are not comments — they are output, and they stay.

A repository's comment-heavy style is not a licence. The stricter rule wins; a project whose own bar differs states it in its conventions doc, and a repo's habit is not that statement.

## Secret values never enter the context

A secret is read only when the task needs it, and the value stays out of the transcript. Fetch it into a `0600` temp file **without reading it**, reference it as `$(cat /tmp/…)` inside the command that needs it, and delete the file afterwards. Never `cat`, `echo`, `grep` or paste the value — and never accept a recipe shaped `VAR=$(… secretsmanager …) cmd`, which puts the value inline one echo away from a permanent leak. Name the variable, not its contents.

## A blocked command is a decision point, not a stop

A denied or failed command prints the reason it was refused — the rule it matched, and often the sanctioned alternative. Read it, name what it objected to, and take the next action that reaches the same goal **without** it: the alternative the message or these rules name, another route if there is one, and if there is none, leave that step out.

Never re-issue a denied command, and never re-issue the same intent through a different string to get around the rule that just fired. Never stall the task on the blocked step either: do the rest, then report it with its reason and propose or ask — including asking the developer to run a command the policy reserves for them.

All of it in the same turn. Going quiet is not one of the options.

## A turn ends only when nothing actionable remains

End a turn only when no unblocked next action exists. A refused command, a failed step, or work reserved for the developer is never grounds for an empty turn: do every other remaining step first, then state the reserved one in one line and ask.
