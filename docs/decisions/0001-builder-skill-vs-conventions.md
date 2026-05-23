# 0001 — builder skill vs. conventions content

## Context

Plan 0012 (`architect`) decided against a standalone implementer skill — "a skill labeled 'write good code' adds noise without signal" — and instead routed coder posture into `docs/conventions.md` for the `convention` skill to load (`docs/plans/0012-skill-architect.md:28`). Plan 0016 proposed a `builder` skill carrying a concrete engineering-principles ruleset, which reverses that call.

## Decision

Ship coder posture as a bundled `builder` skill, not as `conventions.md` content.

Rationale:
- The ruleset is concrete, enforceable guardrails default agents demonstrably break (≤15-line functions, mandatory codebase-search-before-abstraction, minimal diffs) — signal, not the generic "write good code" noise that was 0012's premise.
- A skill is reusable across all four agents and any repo from one canonical source — skillset's core value. Conventions-content only helps repos that adopt the `docs/` scaffold.
- Role factoring stays clean: `architect` plans, `confidence` gates, `builder` builds. `builder` holds no planning logic; it points at the other two for non-trivial work.

## Consequences

- A new always-mode body costs per-session tokens; mitigated by a tight (~45-line) body and a recommended `auto`/`slash` mode posture (`always` discouraged).
- `docs/conventions.md` stays project-specific; `builder` carries the universal posture and defers to `conventions.md` where present.
- 0012's "no implementer skill" decision is superseded for this case. 0014 (split-convention) is unaffected.
