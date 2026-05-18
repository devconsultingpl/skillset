---
name: convention
version: "0.1.0"
description: Project goals, conventions, and decisions live under docs/. Read docs/goals.md and docs/conventions.md at session start. Reference docs/architecture.md, docs/glossary.md, docs/plans/, and docs/decisions/ on demand.
slug: convention
---
# convention

Project goals, conventions, and decisions live under `docs/`.

## At session start, read

- `docs/goals.md` — what we're building and why.
- `docs/conventions.md` — code style, naming, testing, commits.

## On demand, when relevant

- `docs/architecture.md` — high-level components and data flow.
- `docs/glossary.md` — domain terms.
- `docs/plans/NNNN-*.md` — designs for in-flight work.
- `docs/decisions/NNNN-*.md` — recorded decisions (ADRs).

## Numbering

Files under `docs/plans/` and `docs/decisions/` are zero-padded `NNNN-slug.md`. Next number = highest existing + 1.

## When in doubt

Read the relevant file rather than guessing. If a doc is missing or stale, flag it before acting — don't silently work around it.
