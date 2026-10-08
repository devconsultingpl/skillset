# 0006 — instruction ownership and dependency direction

**Status: implemented for slice 1** (declarations, mode-scoped identity, `sync`, foreign refusal). Slices 2–3 — moving the pi-extensions skills and agents under this repo, and generating project scaffolds — remain open.

## Context

Skills, prompts, agent definitions, commands and the workflow declarations that reference them existed in three unrelated places with no mechanism connecting them:

- **This repository** — 13 skills (now 14), installed to four harness targets via `src/targets/*`, tracked in `~/.skillset/state.json`.
- **`pi-extensions/packages/flow`** — 28 hidden skills with machine `contract:` blocks, 15 agent definitions hash-tracked in `~/.pi/agent/agents/.flow-managed.json`, and workflow graphs that hardcode skill names (`extensions/flow-core/built-in-workflows.ts`).
- **Hand-authored global files** — `~/.pi/agent/AGENTS.md` and similar, written by whichever session last noticed a problem.

Two skills were named `code-review` and two `remediate`, with deliberately different contracts and different invocations (`/sk-code-review` here, `/skill:code-review` there). Nothing detected drift, nothing propagated a change, and nothing refused a foreign edit: `target.install` wrote unconditionally, and protection existed only for installs already recorded.

The drift was not hypothetical. ADR 0005 records the pi auto-skill directory diverging from `src/skills/` **twice**, because four auto installs could not be recorded at all — a slash record already occupied the same (skill, agent, scope) key, and the reinstall guard rejected `auto` beside it. `scripts/sync-pi-auto.mjs` existed purely to paper over that, writing four rendered skills unconditionally, tracked by nothing.

## Decision

**This repository owns shared instruction content.** Skills, prompts, agent definitions, commands and the guidance that shapes work live here; harness directories hold generated outputs. A package may own what is genuinely specific to it, under a name that cannot collide with a name owned here.

**Declarations, not conventions.** `skillset.config.json` names every install: skill, agent, mode, scope. Nothing infers an install set from a skill's name, and a bundled skill that declares nothing is a reported error rather than a silent omission.

**Identity includes the mode.** A record is keyed by `(skill, agent, scope, mode)`, so the deliberate slash+auto setup is representable and the escape hatches that destroyed one mode to install the other are unnecessary.

**Sync is the propagation path.** `skillset sync` reconciles every declaration against both the state file and the disk, classifying each install as `in-sync`, `drifted`, `missing`, `adoptable`, `foreign` or `undeclared`. It installs what is missing, adopts an unrecorded artifact whose bytes already match ours, repairs a locally edited artifact while reporting the prior content, and refuses to touch a file at an owned destination that it never wrote. `--dry-run` reports without writing.

**Settings stay the developer's.** Where this repository must touch a settings file at all (the claude-code `statusLine` and its `SessionStart` hook) it does key-level read-modify-write and never regenerates the file — the harness writes those files too, so whole-file generation would fight it.

**The guidance rule ships where it is loaded.** pi reads both `<agent-dir>/AGENTS.md` (a context file) and `<agent-dir>/APPEND_SYSTEM.md` (a system-prompt append); `src/targets/pi.ts` already renders `always` mode into the latter. The `instruction-ownership` skill is declared for exactly that mode and scope, so the rule that forbids ad-hoc edits arrives through a channel that is loaded before any edit happens.

**Project agents may only suggest.** Owned content is not editable from another project. A project agent appends one JSON object per line to `.skillset/suggestions.jsonl` (target, change, why, evidence, session, timestamp); the developer triages those in a skillset session and decides what is real and what was a hallucination.

## Consequences

One place to change a rule, one place to read its current text, and drift becomes a reported state instead of an invisible one. Installing `auto` beside `slash` now records both rather than destroying one.

Costs and residual risk: this repository's inventory grows, and harness-specific frontmatter must stay under `targets.<agent>` because the renderers drop unknown top-level keys — a skill moved here without that relocation renders without its `contract:` block. `pi-extensions` re-pays a token-surface ratchet whenever a shared body changes, so instruction changes there are measured, not free. Generated outputs must be regenerated as part of normal work or consumers silently run stale copies — which is precisely the failure the classification now announces.

Slice 2 (pi-extensions depends on this repository: base skills move here, pi-specific variants are renamed together with their workflow references) and slice 3 (agent definitions and project scaffolds) are scoped in
[plan 0023](../plans/0023-skillset-owns-instructions.md) and get their own budgets.

**Amended 2026-10-08 (slice 3b).** The queue's location moved: it is `~/.skillset/suggestions.jsonl`, beside `state.json` in the global state directory — never a file in the project that files the suggestion, and never inside this repository. The project-local shape this ADR originally named had no reader (a session working here cannot see another project's queue, nothing said which projects to look in, and no project had ever written one), and a copy inside this repository would put a working-tree write and a `.gitignore` entry on the path of every suggestion. The rule now names **`skillset suggest "<what should change, and why>"`** rather than any path, so no session needs to know where this repository lives: the command records the message with the invoking project's `cwd` and the session key when one exists, and a session working here reads the queue, decides what is real, applies it and removes the line. The ownership decision above is unchanged — only the file's location and the way it is written are.

Related: [ADR 0005](0005-multi-mode-install-records.md) (mode-scoped records — the mechanism that made the dual install representable), [ADR 0003](0003-skillset-installs-executable-artifacts.md).
