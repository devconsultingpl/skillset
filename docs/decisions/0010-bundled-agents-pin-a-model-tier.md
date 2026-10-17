# 0010 — bundled agents pin a model tier, never a model id

**Status: implemented** — the rule is in `docs/conventions.md` under *Agent model pins*, and its first five subjects are `codebase-locator`, `codebase-pattern-finder`, `artifacts-locator`, `integration-scanner` and `web-search-researcher`, whose `targets.pi.model` fields were set in plan 0025.

## Context

Every bundled subagent is a markdown file with frontmatter that skillset renders per harness and installs into `~/.pi/agent/agents/` and `~/.claude/agents/`. Until plan 0025 none of the fifteen carried a `model:` field, so all of them inherited whatever model the session happened to be running — a file locator doing grep work priced at the same rate as an adversarial reviewer, or a reviewer making judgment calls on a cheap model, depending only on what the developer was chatting with.

Three properties of the host decide the shape of the fix.

**Frontmatter is authoritative and locked.** pi-subagents: "If an agent file sets `model` … those values are locked for that agent. `subagent` tool parameters only fill fields the agent config leaves unspecified." A pin is therefore not a default — it removes the orchestrator's ability to escalate that agent for one hard call.

**Model ids are provider- and plan-specific.** `anthropic/claude-haiku-4-5-20251001` — the pin pi-subagents' own `Explore` agent ships with — resolves only where an `anthropic` provider is configured. On a machine with only `openrouter`, `deepseek` and `openai-codex`, `resolveModel()` fails the exact rung and falls back to the session model *with a warning*. One source ships to every machine and every harness, so a hardcoded id is a warning on somebody's terminal by construction.

**Resolution already has a fuzzy rung.** `resolveModel()` tries an exact `provider/modelId`, then scores the input against every available model by id, name and provider substring, accepting the best match at or above a threshold. A tier word resolves against whatever the host actually has.

## Decision

A bundled agent may pin a model **tier** — `deepseek-flash`, `haiku`, `sonnet` — and never a full model id. The pin is declared per target (`targets.pi.model`, `targets.claude-code.model`), because an alias is only meaningful against the catalogue that harness resolves against: `deepseek-flash` is an exact id on pi and meaningless to Claude Code, whose `model:` accepts its own alias set and full ids.

Pin only agents whose work is retrieval. Agents that synthesize, review adversarially or verify claims inherit the session model, so the per-call `model_reason` escalation keeps working where it matters most. A genuinely hard retrieval task spawns a different agent rather than escalating a pinned one.

## Consequences

A pinned agent resolves against the host's configured catalogue; where no matching model exists, the spawn falls back to the session model with a warning instead of failing. Model upgrades need no skillset release — the tier word follows the catalogue. Cost becomes predictable per agent class instead of tracking the session.

The cost is approximation: which model the fuzzy rung picks depends on the catalogue's ordering and naming, so a tier word is a range, not a guarantee. A pinned agent also cannot be escalated in place; that is deliberate for retrieval and the reason reviewers stay unpinned. Both properties are rechecked by AC-10 of plan 0025 (`grep -c '^model:' ~/.pi/agent/agents/*.md` equals the pinned set) rather than by reading this document.
