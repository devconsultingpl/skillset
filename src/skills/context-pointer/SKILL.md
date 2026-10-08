---
name: context-pointer
version: 1.0.0
slug: sk-context-pointer
description: The pointer block skillset renders into pi's context file (`AGENTS.md`) at global scope — where installed artifacts come from, and the two facts no doc carries.
---

# Global agent notes (all projects)

Installed skills, prompts and agent definitions belong to **`skillset`**
(`~/source/priv/skillset`); the harness packages own only their own extension
surface. How a change propagates and where each artifact lands is in that
repository's `docs/conventions.md`; the rules every session obeys are in its
`always` skill bodies.

- `~/.pi/agent/extensions/skillset.ts` ships from its `skillset-status` skill
  (`src/skills/skillset-status/assets/pi-extension.ts`).
- `flow` ships its own skills from its package (`packages/flow/skills/`, declared
  as `pi.skills`) — never copied into `~/.pi/agent/skills`.
