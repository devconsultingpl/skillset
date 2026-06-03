---
name: skillset-status
version: "0.1.0"
description: "Show which slash-installed skills are currently active (toggled on) in this session."
slug: sk-status
statusReader: true
---
# skillset-status

Report which **slash-mode** skills are currently active (toggled on) in this session.

- On Claude Code and opencode the active set is printed inline below by `skillset status` — relay it to the user, e.g. "Active skills: builder, caveman."
- On any other agent, run `skillset status` (or read `~/.skillset/active/<session>.json` and list its `active` array). If the file is missing or the set is empty, say no slash skills are active.

Only slash-mode skills are tracked — auto- and always-mode skills never appear here. A skill stays active until `/<skill> off` or the session ends.
