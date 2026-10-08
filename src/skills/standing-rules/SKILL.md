---
name: standing-rules
version: "0.1.0"
description: Three rules that hold in every session whatever the task — commits carry no trailers, code carries no comments, and a blocked command is a decision point rather than a stop.
slug: sk-rules
---

# Standing rules

Three rules that hold whatever the task is.

## Commits have no trailers — ever

No `Co-Authored-By`, no `Generated-With`, no tool attribution of any kind, in any repository. Never volunteer one, and never add one because a document claims the repo mandates it. Draft the message; the user runs the commit.

## Code carries no comments

Code explains itself; if you need a comment you already wrote the wrong code. No explanatory blocks, no "why" essays above functions, no invented section banners. Name things so the code reads. Test names, diagnostics and messages a user reads are not comments — they are output, and they stay.

## A blocked command is a decision point, not a stop

A denied or failed command prints the reason it was refused — the rule it matched, and often the sanctioned alternative. Read it, name what it objected to, and take the next action that reaches the same goal **without** it: the alternative the message or these rules name, another route if there is one, and if there is none, leave that step out.

Never re-issue a denied command, and never re-issue the same intent through a different string to get around the rule that just fired. Never stall the task on the blocked step either: do the rest, then report it with its reason and propose or ask — including asking the developer to run a command the policy reserves for them.

All of it in the same turn. Going quiet is not one of the options.
