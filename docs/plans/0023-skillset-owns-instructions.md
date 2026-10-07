# 0023 — skillset owns the non-drifting instructions; pi-extensions depends on it

## Goal

One canonical home for everything that must not drift, and an automatic path from it to every harness. The developer's own words:

> I do not want anyone to edit the global settings — those global settings and most local project settings should be done by [skillset]. … those global skills and agents that are coming from skillset project should NOT drift, they should be adjusted while working on skillset project and then that change should be automatically propagated to pi or claude or any other harness global settings. … Project agents can make some suggestions to change something (some default file in plans that can be treated like a queue of work that was proposed), then I can run a session in the skillset project and work on that one by one and decide what makes sense. … pi-extension should also reuse skillset skills, prompts, agents … we should have some centralized place and that place is skillset. If the pi-extension projects need something very specialized to pi then it should own that … but it should be named in a different way. … review is not a pi-specific task and it should be reused from skillset — the best version of review skill in skillset, and maybe we can extend some pi-specific review skill, but the base should reside and be taken from skillset. … pi-extension should in one way or another DEPEND on skillset project and any change in skillset should be respected automatically.

Settings files themselves stay the developer's. What skillset owns is the *content* that shapes work: skills, prompts, agent definitions, commands, workflow declarations — plus the guidance that says so.

## Two rules this plan exists to make enforceable

1. **No agent writes owned content ad hoc.** Not into `~/.pi/agent/**`, not into a project's installed copies. A change is made in skillset and propagated.
2. **A project agent that wants something different files a suggestion.** Not an edit. Suggestions queue in one place; the developer triages them in a skillset session and decides what is real and what is hallucination.

Both rules require the same missing machinery: skillset must *refuse* foreign edits to owned files and must *propagate* changes automatically. Today it does neither (evidence below).

## Program shape — three slices, each with its own go

This is a program, not one change. Each slice gets an explicit go; slice budgets below cover slice 1 only, and slices 2–3 get their own budget when they start.

- **Slice 1 — skillset becomes the trustworthy owner.** Declare each skill's `mode` and `scope` in the repo; give installs an ownership manifest with hashes; refuse or report foreign edits; replace the hardcoded sync list with a real `sync` that reconciles every target and every consumer. Skillset-only.
- **Slice 2 — pi-extensions depends on skillset.** FLOW stops shipping its own copies: the base skills move to skillset, FLOW's pipeline consumes them, pi-specific variants keep their behaviour under distinctly different names, and the FLOW ratchet plus workflow gates stay satisfied. Scoped and budgeted 2026-10-07 as **2a** (projection mechanism, one in-place proof) + **2b** (the two collisions and the rename churn) — see *Slice 2* below.
- **Slice 3 — agents, guidance channel and project scaffolds.** skillset gains a subagent definition concept; the global guidance channel is rendered from skillset rather than hand-written; project scaffolds (`.pi/`, project `AGENTS.md`) render with a documented local-override escape hatch.

## Acceptance criteria (slice 1)

1. Every skill in `src/skills/` declares its own install set in the repo — one or more modes plus a scope — and no script or CLI default decides them by name. This builds on **ADR 0005** ("allow recording multiple modes per (skill, agent, scope)"): the deliberate reality is that `architect`, `caveman`, `ponytail` and `commit-suggestion` install as *both* a slash prompt and an auto skill, so a declaration must express a set of modes, not one.
2. A single `skillset sync` reconciles every declared installation to the current sources — install, update, and remove — without `--force`, for all four targets, and exits non-zero listing what it changed.
3. Installs are tracked by content hash per installed file. `skillset status` (or equivalent) reports, per installation: `in-sync`, `drifted`, or `foreign`.
4. A file at an owned destination that was **not** written by skillset and does not match an install record is reported `foreign` and is never overwritten silently — `install`/`sync` refuse it and name the conflict.
5. A file that **is** owned and whose content diverges from the record is reported `drifted` and is repaired by `sync`, with the prior content reported, not silently discarded.
6. The existing four-name hardcoded array in `scripts/sync-pi-auto.mjs` is gone; sync derives the set from declarations.
7. `skillset install --mode` remains available as an explicit override and is recorded as such; a contradiction between a declaration and an existing install is an error, as today.
8. Existing behaviour survives: the renderers keep dropping unknown top-level frontmatter (harness-specific keys belong in `targets.<agent>`), `update`'s divergence guard still holds, and every existing test passes unchanged or is amended with a stated reason.
9. The suggestion queue exists as a documented, append-only location with a defined entry shape, and `skillset` has a command or documented path to list and clear entries. No agent is instructed to edit owned content.

## Budget (slice 1)

Paths relative to `/Users/joozik/source/priv/skillset/`.

### Runtime (5 files, ~4 changed + 1 new)

- `src/core/types.ts` — `mode`/`scope` become part of the skill declaration; install record gains a content hash per file.
- `src/core/parse.ts` — parse and validate the new declaration keys.
- `src/core/state.ts` — hash-carrying records, plus a drift/foreign classification helper.
- `src/core/locations.ts` — per-target ownership rules; where hashes live per target.
- `src/commands/sync.ts` — **new**: reconcile all declared installs to source.
- `src/commands/status.ts` — report `in-sync` / `drifted` / `foreign` per installation.
- `src/commands/install.ts`, `src/commands/update.ts`, `src/cli.ts` — route through the classification instead of writing unconditionally.

### Tests (4)

- `src/core/parse.test.ts`, `src/core/state.test.ts`, `src/core/locations.test.ts` — declaration parsing, hash records, classification.
- `src/commands/sync.test.ts` — **new**: the in-sync / drifted / foreign matrix against a temp home.

### Docs (4)

- `README.md`, `docs/architecture.md`, `docs/conventions.md` — the declaration, the ownership rule, and the suggestion queue.
- `docs/decisions/0006-instruction-ownership.md` — the ADR appendix below, filed during implementation.
- `docs/decisions/0005-multi-mode-install-records.md` — status updated: implemented in part, with the residual named.

- New dependencies: **none**. New runtime files: **1** (`commands/sync.ts`).
- Estimated implementation logic: **150–260 added/rewritten lines**. Lowered from 180–300 after verifying that `update.ts:80-82` already computes `{current, next}` via `target.preview`, so classification extends that seam rather than introducing one.
- Expected physical lines added/rewritten: runtime **190–320**, tests **220–380**, docs **60–120**. New runtime commentary: **0–20 lines** — declaration and ownership invariants only.
- No `package.json` dependency change; no change to the four target destinations.

### Measured against slice 1 — 2026-10-07

Slice 1 landed. Measured from the diff:

- Runtime: **+729 lines** — 185 across the modified files (`cli`, `install`, `update`, `state`, `types`, `locations`, `template`) and 544 in **two** new modules (`core/declarations.ts` 333, `commands/sync.ts` 211), of which 106 are module/API docstrings and 438 are logic. The estimate was 150–260 logic lines and **one** new module. Both amended: two modules because classification is used by `install`, `sync` and the tests while `sync` is only the command; and the logic count, because classification carries six statuses, their reporting messages, and the adopt-vs-refuse comparison.
- Tests: **+248 added lines** (two new files, two amended) — inside the 220–380 estimate. `test/sync.test.ts` syncs the real declaration set into a sandboxed `HOME`, which also pins the coverage invariant end-to-end.
- Docs: **+87 added lines** across tracked docs, plus ADR 0006 (42) and the `instruction-ownership` skill (32) as new files — inside 60–120 for the tracked portion.
- Deleted: `scripts/sync-pi-auto.mjs` (28 lines) — the second, unchecked write path this slice exists to close.
- Two files changed beyond the budgeted list: `src/core/template.ts`, hosting `applyConfigToSkill` after it proved to be duplicated in `install.ts` and `update.ts`, and `src/skills/instruction-ownership/` (the rule itself, which needs a skill to ride `always` mode — `status.ts` was dropped from the list instead, see criterion 3).
- Post-review: **`src/commands/set-mode.ts`** (a third file beyond the budgeted list) lost its private renderer and gained a `removeInstall`, 7 insertions / 16 deletions, and `test/cli.test.ts` gained one test. The review pass over slice 1 found that `set-mode`'s mode switch left the abandoned record behind once mode joined the install identity — evidence and the failing-then-passing check are in the review-pass entry below.

## Slice 2 — pi-extensions consumes skillset (scoped and budgeted 2026-10-07)

### Goal

`packages/flow/skills/` stops being a second source for anything skillset owns. FLOW keeps loading `./skills`, but the skills in that directory that skillset owns become **projections**: rendered from `src/skills/<name>/` here, committed into the consumer, and drift-checked from both sides. The two name collisions — `code-review` and `remediate` — are resolved by renaming FLOW's arms, because they are pi pipeline arms with machine contracts while skillset's are the agent-agnostic base, and the workflow graph, the pipeline pointer and the token-surface ratchet move in the same commit.

Split: **2a** builds the mechanism and proves it with one in-place projection that changes nothing observable. **2b** moves the two arms and pays the rename churn. 2b gets its own go only after 2a is green.

### What was verified for this slice (2026-10-07, in `pi-extensions` @ `0c9052a`)

- **One directory, two loaders.** pi reads `pi.skills: ["./skills"]` from `packages/flow/package.json`; flow-core reads the same place as `BUNDLED_SKILLS_DIR = join(PACKAGE_ROOT, "skills")` (`extensions/flow-core/paths.ts`), which backs both `BUNDLED_SKILL_NAMES` (the `[skill] flow:` status-line gate) and the contract harvester (`loadSkills` / `loadSkillsFromDir` + `parseFrontmatter`, `extensions/flow-core/skill-contracts-source.ts`). A projection must therefore land **in place** in `skills/<name>/`.
- **A second skills directory would collide by design.** The contract registry reports the same skill name offered by two roots (`skills/../skill-contracts-source.test.ts:710-714` registers `code-review` from `flow` and from `user-skills` and asserts the collision is surfaced). Road not taken, below.
- **FLOW frontmatter survives skillset's YAML, not skillset's validator** — measured, not inferred:

  ```
  $ node -e "parseSkill(readFileSync('…/flow/skills/<name>/SKILL.md'))"
  commit      | keys: name,description,argument-hint,disable-model-invocation,allowed-tools,shell-timeout,contract | THROWS: skill frontmatter missing required string field: version
  code-review | keys: name,description,argument-hint,disable-model-invocation,shell-timeout,contract                | THROWS: … version
  remediate   | keys: name,description,argument-hint,allowed-tools,shell-timeout,disable-model-invocation,contract   | THROWS: … version
  ```

  gray-matter keeps every key; `src/core/parse.ts` requires `name`/`version`/`description`. Only `version` is missing.
- **The token surface moves only when the pointer text moves.** `token-surface.test.ts` pins one message (`flow-pipeline-index`, 105 words / 137 estTokens) whose content is the hardcoded `PIPELINE_POINTER` array (`extensions/flow-core/pipeline-pointer.ts:26-41`). Projecting a skill that no stage references is a **zero-surface** event; renaming `code-review` (line 32) or `remediate` (line 42) changes that array and is a measured re-pin.
- **`_shared` is a sibling dependency by name**, not by package: 20+ bodies call `node "${SKILL_DIR}/../_shared/<script>.mjs"` (`code-review` → `now.mjs`, `git-context.mjs`; `commit` → `git-changes.mjs`). In-place projection keeps that path valid because `_shared/` stays FLOW's.
- **The projection unit is the directory, not the file.** `skills/code-review/` ships `_helpers/` and `templates/`; `annotate-*` and `pr-triage` ship `examples/`; `skills/design/` contains a test. `scripts/copy-skills.mjs` already copies whole directories into `dist/skills/`.

### Acceptance criteria (2a — the mechanism)

1. `skillset project` writes every declared projection to its consumer path and writes a manifest recording, per generated file, its path and sha256; `skillset project --check` reports `in-sync` / `stale` / `missing` / `foreign`, writes nothing, and exits non-zero for anything but `in-sync`.
2. A projection copies the bundled skill directory — `SKILL.md` plus any sibling `_helpers/`, `templates/`, `examples/` — so a projected file's bytes are exactly `dist/skills/<name>/**`. No renderer is added, and a projected skill that uses `config:` placeholders is a reported error (it would be copied unsubstituted).
3. Exactly one FLOW skill is projected in 2a, in place, and its bytes are identical to the file it replaces — so **no test in `pi-extensions` changes** and its suite, including the token-surface ratchet and the contract tests, passes unchanged. That is 2a's proof.
4. A generated path absent from the manifest, or occupied by a file whose sha256 disagrees with the manifest and is not from skillset, is `foreign`: reported, never overwritten, non-zero exit. A listed file whose bytes merely differ from the source is `stale` and is regenerated, reporting the prior content.
5. Declaration coverage accepts a bundled skill that declares an install **or** a projection, and still reports one that declares neither.
6. Slice 1's invariants hold: no new renderer, no new dependency, `sync` behaviour unchanged, and the four existing targets untouched.
7. Documented on both sides: skillset's README/conventions (how to add a projection, what `--check` refuses) and `packages/flow/docs/` (the consumer obligation: regenerate after a source change, `skills/.skillset-managed.json` is generated, never edit a projected skill in place).
8. ADR drafted as an appendix here and filed as `docs/decisions/0007-*.md` in this repository; the consumer-side obligation is recorded in pi-extensions' own next-free decision number (0009) as its plan already notes.

### Acceptance criteria (2b — the two collisions)

1. `packages/flow/skills/code-review/` and `packages/flow/skills/remediate/` no longer exist as hand-authored sources; the arms' sources live in `src/skills/flow-code-review/` and `src/skills/flow-remediate/`, and are projected back into the paths the two directories occupied.
2. FLOW still gates on `blockers_count` sourced from the arm's `contract:` — `built-in-workflows.ts:144,151,157,432-445,480-495,517` and the `remediate` sites at `:988-997,1378` resolve to the new name — and `built-in-workflows.test.ts` passes with assertions amended only where they name it.
3. `PIPELINE_POINTER` is updated (`pipeline-pointer.ts:32,42`) and `token-surface.test.ts` re-pinned to the measured words/estTokens, as a recorded move rather than a waived mismatch.
4. skillset's own `code-review` and `remediate` keep every install their declarations name, with unchanged behaviour; `skillset sync --dry-run` is `in-sync` afterwards.
5. No `/skill:code-review` or `/skill:remediate` reference is left pointing at a skill that no longer exists (`docs/workflows.md` 3, `skills/revise/SKILL.md` 1, `pipeline-pointer.ts`).

### Budget (2a)

Paths relative to `/Users/joozik/source/priv/skillset/` unless the path names `packages/flow`.

- Runtime: `src/core/projections.ts` **new** (~150-200 logic lines: parse the projection declarations, render-by-copy from the bundle, manifest read/write/hash, the four-state classification); `src/commands/project.ts` **new** (~90-130); `src/core/types.ts` +~15; `src/core/declarations.ts` +~15 (coverage accepts a projection); `src/cli.ts` +~15.
- Tests: `src/core/projections.test.ts` **new** (~120-160); `test/project.test.ts` **new** (~100-150) driving two temp roots — source and consumer.
- Docs: `README.md` +~30, `docs/architecture.md` +~6, `docs/conventions.md` +~12, ADR 0007 ~45.
- Consumer: the projected skill directory (bytes unchanged, **0** net lines); `packages/flow/skills/.skillset-managed.json` **new** (~15); `packages/flow/extensions/flow-core/skillset-managed.test.ts` **new** (~60-90, manifest↔disk only — it must not need skillset to run); `packages/flow/docs/` +~15; `package.json` `files` left alone unless the manifest must ship (`skills/` is already listed).
- New dependencies: **none**. New runtime modules: **2**.
- Estimated implementation logic: **240-330 added lines**. Physical lines added/rewritten: skillset **600-900**, pi-extensions **100-140**. The estimate is this high because 2a pays for a second consumer of the six-status vocabulary slice 1 introduced, not because a renderer is being written — 2a writes no renderer at all.

### Budget (2b)

- skillset: two new skill roots under `src/skills/` carrying the moved arms (**573 + 76 lines** moved, +2 for `version`), `skillset.config.json` +2 projection entries, docs ~15 lines.
- pi-extensions: `skills/{code-review,remediate}` deleted (**649 lines**), two generated projections in their place, `built-in-workflows.ts` ~12 sites, `pipeline-pointer.ts` 2 lines, `token-surface.test.ts` re-pin, `built-in-workflows.test.ts` ~10 sites, `skill-contracts-source.test.ts` ~2, `docs/workflows.md` 3, `skills/revise/SKILL.md` 1.
- Estimated: **700-1000 physical lines**, overwhelmingly moved text and mechanical renames. No new mechanism — 2b is 2a's first real payload.

### Decisions (slice 2)

1. **In-place projection into `packages/flow/skills/`, tracked by a manifest** (`.skillset-managed.json`, the shape FLOW already uses for its 15 agents with `.flow-managed.json`). Road not taken: a sibling `skills-generated/` directory — pi would then resolve the same skill name from two roots, which the contract registry reports as a collision.
2. **The projection copies; it never renders.** A projected skill's frontmatter is FLOW's shape (`contract:`, `argument-hint`, `allowed-tools`, `shell-timeout`, `disable-model-invocation` at top level), and any renderer that composes for a target would either move those keys or drop them. This also keeps slice 1's rule intact by not adding a render path at all.
3. **Drift is detected on both sides.** `skillset project --check` covers source → artifact; the committed consumer manifest covers artifact → recorded sha256 and needs no skillset at test time. Road not taken: a runtime dependency of the flow package on skillset — pi resolves skills from the installed package, which must stand alone.
4. **`version` is added to the moved skills.** Measured above: skillset's validator rejects FLOW frontmatter without it. The alternative — exempting projected skills from validation — weakens a validator to save one line per skill.
5. **A consumer-side edit of a projected file is regenerated, not preserved.** The consumer copy is generated output; the source is authoritative, and the prior content is reported. An unlisted file at a generated path is `foreign` and refused. This mirrors slice 1's `drifted` / `foreign` split exactly.
6. **Only the two collisions' arms move.** FLOW's 30 other skills are pipeline internals — stages, gates, lane fan-out, artifact contracts — with no non-FLOW home, and relocating them would make skillset own pi's workflow internals, which the directive explicitly leaves with the package.
7. **`_shared/` stays FLOW's** and is a declared consumer-side dependency of a projected skill (a projection entry names the scripts its body calls), not something skillset copies. Road not taken: moving `_shared` into skillset in this slice — it is 9 runtime modules with 6 test files and no skillset home yet.

### Decision — the arms' names (settled 2026-10-07)

**`flow-code-review` and `flow-remediate`.** The prefix says whose variant the skill is, which is the property the naming rule exists to make visible: a base skill and a harness-specific arm must be distinguishable by name alone. It is collision-proof against any future skillset skill, it keeps the projection a byte copy (no consumer-overlay axis, no second render path), and the churn it buys is mechanical and test-covered — ~12 references in `built-in-workflows.ts`, two lines of pointer text, one re-pinned ratchet. Roads not taken: `review-lanes`/`remediate-arm` (FLOW's internal jargon in a name the developer types, and no ownership signal); renaming skillset's base instead (inverts the directive — the shared base yields to the pi variant — and breaks `/sk-code-review`, the most-used invocation); one skill with a per-consumer overlay axis (zero rename churn, but a new frontmatter axis and two render paths for one skill, which is the divergence-at-a-distance a name would have made visible).

### Confidence (slice 2)

**93% for 2a**, enough to start; **~90% for 2b** now that the names are settled, with the pointer's new length the one measurement left to run (it is a re-pin, not a risk — both names are longer than the ones they replace, so the words and estTokens both move up). What the 93% rests on, and what would falsify it:

- Verified today by execution or direct reading: both loader roots and their failure modes; collision reporting in the contract registry; `parseSkill` rejecting FLOW frontmatter while gray-matter keeps every key (command and output pasted above); `copy-skills.mjs` copying whole directories; per-skill `_shared` call sites; the pointer being a hardcoded 16-line array, so surface cost follows references, not skill count; skill directories carrying `_helpers/`, `templates/`, `examples/`.
- Not yet verified, and cheap to settle in 2a's first step: that pi's loader ignores the added `version` key (there is no FLOW test asserting an exact frontmatter key set today — to be confirmed by running FLOW's suite against the projected file), and that `dist/skills/<name>/**` is byte-identical to the current hand-authored file for the chosen proof skill.
- The residual is the usual one: a mechanism designed against read code rather than executed code. 2a exists to execute it on one skill before 2b moves 649 lines.

## Decisions

### Ownership by manifest and hash, not by convention

FLOW already solved this shape for its agents: a hash manifest (`.flow-managed.json`, `Record<filename, sha256>`) with explicit states including `UNMANAGED` for a directory it never installed and preservation of user-added files. skillset should adopt the same shape rather than invent one, because it is proven in this codebase family and because the developer's "must not drift" requirement is exactly what a hash manifest detects.

### Settings stay the developer's; declarations live in skillset

The developer owns `settings.json`. skillset owns the *content* it renders into harness directories. Where skillset must touch a settings file at all (the claude-code target already writes `statusLine` and a `SessionStart` hook there via read-modify-write, and explicitly leaves unrelated keys alone), it keeps doing key-level read-modify-write and never regenerates a whole file — pi writes `settings.json` itself (theme, model, changelog version), so whole-file generation would fight it.

### The ownership rule ships through the system-prompt channel

pi loads **both** `<agent-dir>/AGENTS.md` (user instructions applied across working directories) and `<agent-dir>/APPEND_SYSTEM.md` (appended to the system prompt) — pi docs `configuration.md:18-20`, confirmed in pi's code by `discoverAppendSystemPromptFile()` in `dist/core/resource-loader.js`. skillset's pi `always` mode targets `APPEND_SYSTEM.md`, and the repo's own `src/skills/retro/SKILL.md:33` claims pi's global instruction file is `AGENTS.md` — so nothing currently writes the ownership rule into either channel.

Decided: the rule ships via `always` mode into `APPEND_SYSTEM.md`, because rules about *how work is done* belong in the system prompt while project and repository conventions belong in the context file. The `retro` claim is corrected in the same slice — a skill that misstates the channel will keep generating that mistake.

### Slices 2–3 decisions recorded now, decided later

- **Names.** FLOW's workflow graph hardcodes skill names (`extensions/flow-core/built-in-workflows.ts:144,149-151,157` — stages `implement → validate → code-review` with a gate reading `blockers_count` from the skill's `contract:` block). So a skillset-owned base skill must carry the machine contract, and a pi-specific variant must be renamed *and* its workflow references updated together.
- **Unknown frontmatter keys are dropped today** unless nested under `targets.<agent>` (`src/targets/pi.ts:24-46`). FLOW's `contract:`, `argument-hint`, `allowed-tools`, `shell-timeout`, `disable-model-invocation` therefore must be relocated under `targets.pi` to survive a move — a mechanical but non-optional part of slice 2.
- **`_shared` is runtime code.** FLOW's bodies call `node "${SKILL_DIR}/../_shared/<script>.mjs"`, and `_shared` holds scripts with their own tests. A projection must preserve that sibling layout or the bodies must be rewritten; skillset has no shared-asset concept today.

### Road not taken

Vendoring FLOW's skills into skillset as auto-installed copies (two homes, synced by script) was rejected: it reproduces the drift problem it is meant to remove. Making skillset a runtime *dependency* of the pi extension bundle was rejected for slice 1: FLOW resolves skills through pi's own `loadSkills`/`loadSkillsFromDir` and validates `contract:` blocks from frontmatter, so the compatible seam is a generated projection inside the flow package, verified by FLOW's existing tests. Renaming anything before the ownership machinery exists was rejected: a rename is the easy half and it is not the problem.

### ADR appendix — 0006: instruction ownership and dependency direction

To be filed as `docs/decisions/0006-instruction-ownership.md` in this repository during slice 1. pi-extensions keeps its own decisions for consumer-side obligations; its next free number is 0009.

**Context.** Skills, prompts, agent definitions, commands and workflow declarations exist in three places with no relationship between them: the skillset repo (13 skills, 3 install modes, 4 targets, own state file), the pi-extensions FLOW package (28 hidden skills with machine contracts, 15 agents with a hash manifest, workflow graphs referencing skills by name), and hand-maintained global files in `~/.pi/agent`. Two skills are named `code-review` and two `remediate` with deliberately different contracts. Nothing enforces non-drift, and nothing propagates a change.

**Decision.** skillset is the canonical owner of shared instruction content. Harnesses and the pi-extensions packages consume it; a package may own what is genuinely specific to it, under a name that cannot collide with a skillset name. Changes are made in skillset and propagated automatically to every consumer through generated projections plus an ownership manifest; project-side agents may only queue suggestions for that content, never edit it. Settings files remain the developer's.

**Consequences.** One place to change a rule, one place to look for its current text, and drift becomes detectable rather than invisible. Costs: skillset grows from 13 skills to a much larger inventory with harness-specific frontmatter spread across targets; FLOW's token-surface ratchet must be re-satisfied whenever a base body changes, so review of any instruction change includes a surface check; and the projection must be regenerated as part of the normal build, or consumers silently run stale copies — which is precisely the failure mode the manifest exists to announce.

## Approach (slice 1)

1. Declare `mode`/`scope` per skill in the repo; parse and validate them; keep `--mode` as an explicit override that conflicts loudly with a declaration.
2. Add per-file content hashes to the install record and a classification helper: `in-sync`, `drifted`, `foreign`.
3. Make install refuse `foreign` destinations with a named conflict, and report drift instead of overwriting silently.
4. Add `skillset sync` as the single reconciliation entry point across all targets, deriving the set from declarations.
5. Replace `scripts/sync-pi-auto.mjs`'s hardcoded array with the declared set, or delete the script in favour of `sync` — decide while implementing, and say which.
6. Resolve the guidance-channel question, and place the ownership rule in the channel pi actually loads.
7. Define and document the suggestion queue shape and the triage path.

## Verification and current-state evidence

Checks run 2026-10-07. Both reconnaissance passes were read-only; every claim below was verified against source.

**skillset cannot currently refuse anything.** `target.install` calls `writeAtomic` unconditionally (`src/targets/pi.ts:59,64`); protection exists only for *recorded* installs during `update` (`src/commands/update.ts:78-110`). A foreign file at an owned destination is overwritten without a word.

**Mode is not declared anywhere.** It is a CLI argument — `--mode`, default `"slash"` (`src/cli.ts:44`), parsed in `src/commands/install.ts:48-53` — persisted on the install record (`src/core/types.ts:57`). `src/skills/architect/SKILL.md` has only `name/version/description/slug`. The four-name auto set survives solely as `const names = ["architect","caveman","commit-suggestion","ponytail"]` in `scripts/sync-pi-auto.mjs:16`, which bypasses state entirely.

**The drift this plan prevents has already happened twice, and is documented as an open proposal.** `docs/decisions/0005-multi-mode-install-records.md` records that the dual slash+auto install is deliberate, that the state model cannot represent it, that the reinstall guard forces `--force` or `set-mode` (and that both escape hatches delete the slash prompt), and that the auto directory "has drifted from `src/skills/` twice — synced back in `db1ed5c`, then again in the 2026-08 session". Its status is **proposal — not implemented**. Slice 1 is the mechanism that closes it, which is why criterion 1 declares a set of modes rather than one.

**Rendering drops unknown keys.** `src/targets/pi.ts:24-27` and `:30-46` compose `{ name, description, ...targets.pi }` — so top-level `contract:`, `argument-hint`, `allowed-tools`, `shell-timeout`, `disable-model-invocation` are discarded, and only `targets.<agent>` survives.

**No subagent support.** `~/.pi/agent/agents/` is referenced nowhere in skillset; `AgentName` enumerates harnesses only (`src/core/types.ts:1-3`), and `AgentTarget` (`src/core/target.ts:29-36`) has no hook for agent definitions. (`src/targets/agents.test.ts` is a misnomer — it tests skill renderers.)

**pi's two guidance channels** — `docs/configuration.md:18-20` in the installed pi package: `<agent-dir>/AGENTS.md` is "user instructions applied across working directories"; `<agent-dir>/APPEND_SYSTEM.md` "adds instructions to Pi's system prompt". skillset's pi `always` anchor is the latter (`src/core/locations.ts:45`).

**FLOW's coupling**, from `/Users/joozik/source/priv/pi-extensions/packages/flow`: skills are declared `pi.skills: ['./skills']` and read through pi's own `loadSkills`/`loadSkillsFromDir` plus `parseFrontmatter` for `contract:` blocks (`extensions/flow-core/skill-contracts-source.ts:16,23,131-139`); the pipeline hardcodes stage names and contract gates (`extensions/flow-core/built-in-workflows.ts:144,149-151,157`); bodies call sibling scripts by relative path (`skills/synthesize/SKILL.md:94,96`); the agent manifest is `~/.pi/agent/agents/.flow-managed.json` with `MANAGED`/`UNMANAGED` states and user-added files preserved (`extensions/flow-core/agents.ts:68,97-101,192`); and the context surface is ratcheted — token-surface notes "28 hidden skills and 15 agents" (`packages/flow/token-surface.test.ts:8`).

**Install records carry no hashes.** `src/core/types.ts` `InstallRecord` holds `skill`, `slug?`, `version`, `agent`, `scope`, `mode`, `location`, `files: string[]` (relative paths), `insertions?`, `hooks?`, `statusLine?`, `statusLinePath?`, `assets?`, `projectPath?`, `installedAt` — paths and identities, no content digests. Criterion 3's per-file hash is genuinely new.

**`sync` does not exist, but the comparison primitive does.** `src/cli.ts` registers `install`, `uninstall`, `list`, `update`, `set-mode`, `init`, `emit`, `track`, `scan-prompt`, `status`, `reset`; `src/commands/` has no `sync.ts`. `update.ts:80-82` already computes the comparison slice 1 needs: `const { current, next } = await target.preview(ctx, rec); const diverged = current !== null && current !== next;` — with `--dry-run`, `--force` and `--skip-customized` paths already built on it. Classification therefore extends `preview` rather than re-reading files, and `status` (not a new command) is where it surfaces.

**The reinstall guard destroys the other mode — ADR 0005's complaint, verified.** `src/commands/install.ts:106-112`: when a record exists for the same (skill, agent, scope) with a different mode and `--force` is absent, it throws and points at `set-mode`; with `--force` it calls `await target.uninstall(prior)` before installing. So recording `auto` beside `slash` is blocked, and both escape hatches remove the existing install.

**The drift surface is exactly four unrecorded files.** `~/.skillset/state.json` holds 34 records — 19 claude-code, 13 pi, 1 opencode, 1 copilot — and all 13 pi records are `slash`/`global` with one file each. There is **no record for any of the four auto skills**, so `~/.pi/agent/skills/` is entirely unmanaged. `scripts/sync-pi-auto.mjs` says so in its own header: "Re-sync the pi auto-mode skills that skillset can't record: a slash install is already recorded for the same (skill, agent, scope), and the reinstall guard blocks recording `auto` alongside it (see docs/decisions/0005)", and it writes each rendered skill unconditionally, reading the bundle from `dist/skills/` after a build.

**`always` mode is implemented and tested for pi.** `src/targets/pi.ts:44` declares `supportedModes: ["slash", "auto", "always"]`; `:76-77` renders a marker-wrapped append to `APPEND_SYSTEM.md`; `:110` removes it on uninstall; `test/agents/pi.test.ts:101-126` covers both the local (`.pi/APPEND_SYSTEM.md`) and global (`~/.pi/agent/APPEND_SYSTEM.md`) cases. The mode is not unused machinery.

**pi loads `APPEND_SYSTEM.md` into the system prompt — verified in pi's code, not only its docs.** `dist/core/resource-loader.js` exposes `appendSystemPrompt` and `appendSystemPromptSourcePaths` and implements `discoverAppendSystemPromptFile()`, which prefers the trusted project's `.pi/APPEND_SYSTEM.md` and falls back to the agent directory; `dist/core/trust-manager.js` lists `APPEND_SYSTEM.md` among the recognised agent-directory files. This falsifies the recon pass's own inference that the pi `always` anchor is inert.

## Steps (slice 1)

1. Write the failing tests first: declaration parsing, the `in-sync`/`drifted`/`foreign` matrix against a temp home, and `sync` deriving its set from declarations.
2. Implement declarations and hashes; keep the existing renderers untouched so slice 1 cannot regress a target destination.
3. Implement classification and refusal; verify against a temp home containing a foreign file at an owned path.
4. Implement `sync`; run it against the real home and report exactly what it would change before changing anything.
5. Resolve the guidance channel: render the ownership rule through `always` mode, then verify in a live session — after a reload — that the rule is loaded from `APPEND_SYSTEM.md`. This is where the residual 2% is retired or confirmed.
6. Document the suggestion queue, and delete `scripts/sync-pi-auto.mjs` once `sync` covers its four skills.

## Decisions asserted for slice 1

These were open questions at 94%. Each is now decided, with the evidence that decided it, so the plan can be executed without another round trip. Strike out any you disagree with and it becomes an open question again.

1. **The ownership rule ships through `always` mode into `APPEND_SYSTEM.md`** — the system-prompt channel. Decided by evidence, not preference: pi loads that file (`dist/core/resource-loader.js` `discoverAppendSystemPromptFile()`, `appendSystemPromptSourcePaths`), skillset already implements and tests the mode (`src/targets/pi.ts:44,76-77,110`; `test/agents/pi.test.ts:101-126`), and a rule that forbids ad-hoc edits has to be loaded before any edit happens. `AGENTS.md` remains the channel for project and repository conventions.
2. **The suggestion queue is project-local: `.skillset/suggestions.jsonl`**, append-only, with one JSON object per entry (skill or artefact, proposed change, reason, evidence, session id, timestamp) and a `skillset suggestions` command to list and clear. Rationale: a project session already has write access there, and triage in skillset reads it explicitly — so the suggestion path never requires an agent to write into an owned directory or a global config.
3. **`scripts/sync-pi-auto.mjs` is deleted in slice 1.** Its only reason to exist is the one it states in its own header — auto installs that "skillset can't record" — and multi-mode records remove that reason. `sync` supersedes it, and leaving both would preserve exactly the second, unchecked write path this plan exists to close.
4. **Slice 1 does not rename the colliding skills.** The rename belongs with slice 2, where FLOW's workflow references (`built-in-workflows.ts:144-157`) change in the same commit as the name.
5. **The hand-edited `~/.pi/agent/AGENTS.md` paragraph stays until its content is rendered from skillset**, then is replaced by the rendered rule. Reverting now would restore a claim that attributes FLOW's agents to skillset — a worse state than a correct-but-manually-authored one.
6. **`docs/decisions/0005-multi-mode-install-records.md` is marked implemented in the record sense, with one residual pinned by a test.** The escape-hatch complaint (`--force` / `set-mode` destroying the other mode) is verified (`install.ts:106-112` calls `target.uninstall(prior)`), and it becomes unnecessary rather than fixed once multiple modes are representable — so slice 1 adds a test asserting that installing `auto` beside an existing `slash` record records both and removes neither.

## Still open (the residual 2%)

1. Whether the rendered marker block in `APPEND_SYSTEM.md` reaches the system prompt in a live session. pi's loader is verified; the end-to-end observation needs a session, and slice 1's step 5 does it with a reload.
2. Whether the multi-mode record change alters `uninstall` semantics for the 13 existing single-mode pi records. Expected to be additive, but it touches install/uninstall state handling, which is where slice 1's implementation risk sits.

## Confidence

**98%** for slice 1. What the last four points were made of, and how each was closed by execution rather than assertion:

- *94% → 96%*: the mechanisms are now verified in source rather than inferred from a reconnaissance summary — install records carry no hashes (`src/core/types.ts`), `sync` is absent while `preview`-based divergence detection already exists (`update.ts:80-82`), the reinstall guard and `--force` uninstall are read directly (`install.ts:106-112`), and the drift surface is counted exactly (13 pi records, all `slash`, none for the four auto skills).
- *96% → 97%*: the guidance-channel question stopped being a policy coin-flip. `discoverAppendSystemPromptFile()` in pi's `resource-loader.js` proves the channel is loaded, and `src/targets/pi.ts:44,76-77` plus its tests prove skillset can already render into it.
- *97% → 98%*: every remaining open question now has a decision with its rationale recorded above, so nothing in slice 1 waits on another round trip. The budget was also corrected downward (150–260 logic lines) on evidence that the comparison primitive is reusable, which reduces the risk the estimate was hiding.

The residual 2% is execution risk inside one repo: the two items in "Still open". Neither can invalidate the approach — the first is a live observation of a verified loader path, the second is a state-handling detail pinned by criteria 3, 4 and 7.

**Lower confidence for slices 2–3, deliberately:** FLOW's skill loading, contract harvesting and workflow coupling are verified, but the projection mechanism has not been designed, and the token-surface ratchet makes every base-body change a measured event. Slice 2 was scoped and budgeted on 2026-10-07 (*Slice 2* below) once slice 1 landed; slice 3 is still unestimated.

## Review log

### Planning session — 2026-10-07

Opened after the developer clarified the target state in two messages, superseding the "settle the two names" option I had offered: skillset owns shared instruction content, pi-extensions depends on it, names must not collide, changes propagate automatically, project agents may only suggest, and settings stay the developer's. Orientation ran two read-only reconnaissance passes — one in skillset, one attempted in pi-extensions — plus direct checks. The pi-extensions pass stopped with no output (an Explore agent has no shell, so it could not change directory out of its inherited cwd and stalled on the external-directory gate); its scope was recovered directly, and the plan cites that evidence rather than the agent's. That same failed-agent pattern is what plan 0014 recorded; the arbiter fix from plan 0015 was exercised by this pair of agents and the prompts queued as designed.

No implementation authorized. Nothing was modified in either repository by this plan; the only file touched during the session was `~/.pi/agent/AGENTS.md`, by hand, before the developer's directive ruled that out — recorded as decisions-asserted item 5 (was open question 5).

### Confidence pass — 2026-10-07

The developer asked for 98% and the gap was closed by execution rather than restatement. Checks run in `skillset`: the `InstallRecord` field list (no hashes), the full CLI command set (no `sync`, but `status` exists), `update.ts:80-82`'s existing `preview`-based divergence comparison, `install.ts:106-112`'s guard and its `target.uninstall(prior)` on `--force`, the state file's 13 pi records (all `slash`, none for the four auto skills), `sync-pi-auto.mjs`'s own header and unconditional writes, and `src/targets/pi.ts:44,76-77,110` plus `test/agents/pi.test.ts:101-126` for `always` mode. In pi's installed package: `discoverAppendSystemPromptFile()`, `appendSystemPrompt` and `appendSystemPromptSourcePaths` in `dist/core/resource-loader.js`, falsifying the reconnaissance pass's inference that the pi `always` anchor is inert.

Three consequences: the six open questions became decisions with rationales (item 1 no longer a coin-flip — the channel is proven loaded *and* already rendered by an implemented, tested mode); the budget was corrected **downward** to 150–260 logic lines because the comparison primitive is reusable; and `src/commands/status.ts` was added to the runtime list, since criterion 3 extends the existing command rather than adding one.

### Implementation session — 2026-10-07

The developer said **go** on slice 1. Implemented directly, tests first, in `skillset` only.

What landed: `skillset.config.json` declaring 14 skills / 31 installs (the 26 recorded global installs plus the four unrecorded pi auto skills, so sync can adopt instead of refuse); `core/declarations.ts` (parse, coverage, classification); `commands/sync.ts`; mode-scoped record identity in `state.ts`; declaration-derived mode plus foreign refusal in `install.ts`; shared `applyConfigToSkill` in `core/template.ts`; `sync` registered in the CLI; `scripts/sync-pi-auto.mjs` deleted; the `instruction-ownership` skill declared for pi `always`; ADR 0006 written and ADR 0005 marked implemented.

Evidence:

```sh
npm run typecheck   # clean
npm run build       # tsc + copy-skills
npx biome check src test   # clean
npm test            # 25 files / 203 tests
```

Four pre-existing tests failed first and were right to: two `state` tests encoded the old identity (a mode replacing rather than accompanying), and two CLI tests asserted the reinstall guard this slice removes. They were rewritten to the new invariant, and installing a second mode beside the first is now pinned by name in both files.

**The real-home dry run earned its keep.** `skillset sync --dry-run` against the actual `HOME` first reported `drifted 1` — `confidence`, whose diff showed `- If confidence drops below 95%` against `+ … {{resume}}%`. Not a stale file: `confidence` carries `config: {start: 98, resume: 95}` in its own frontmatter, `install` renders through `applyConfigToSkill`, and the new classifier rendered the raw bundle. Left unfixed, `sync` would have "repaired" a correctly configured file back to its placeholders. The fix also surfaced why it happened: `applyConfigToSkill` was duplicated in `install.ts` and `update.ts`, so the comparison had a third, subtly different renderer. It now lives once in `core/template.ts` and all three paths use it.

The second dry run is the intended steady state, and is the evidence the slice was aiming for:

```
checked missing 1 · adoptable 4 · undeclared 8 · in-sync 26      (exit 0)
```

The four `adoptable` entries are exactly the pi auto skills whose unrecorded state ADR 0005 documents — recorded without rewriting a byte. `missing 1` is the ownership rule itself. The 8 `undeclared` are project-local claude-code installs, correctly outside a global declaration.

Still open: nothing in slice 1. The real write and its live verification both ran.

### Live verification — 2026-10-07

`skillset sync` executed against the real home:

```
reconciled missing 1 · adoptable 4 · undeclared 8 · in-sync 26 · 5 written   (exit 0)
second run  in-sync 31 · undeclared 8                                        (nothing missing, drifted or foreign)
```

The four `adoptable` entries — the pi auto skills ADR 0005 documents as unrecordable — were recorded **without rewriting a byte**; pi records in the state file went from 13 to 18 (13 slash + 4 auto + 1 always). `~/.pi/agent/APPEND_SYSTEM.md` was created with the rule wrapped in `<!-- skillset:begin/end instruction-ownership -->`.

The load was then verified end-to-end rather than asserted, by running a **new** `pi --print` process from `/tmp` — a session with no skillset context and no reload involved — and asking it to reproduce text that exists only in that file:

```
1. PRESENT
2. # Instruction ownership
3. - Edit an installed copy — `~/.pi/agent/{skills,prompts,agents,APPEND_SYSTEM.md}`, `~/.claude/**`, …
```

A first attempt at this check was wrong and is recorded so it is not repeated: grepping the session log for `appendSystemPromptSourcePaths` returned 23 hits, all of them this session's own tool calls and outputs quoting that string back — self-reference, not evidence. pi does not record loaded resource paths in the session file.

With both residual items closed — the live load, and the state handling of the 13 pre-existing single-mode records, which reconciled in place without removing anything — slice 1 is at **99%**: implemented, tested, propagated, observed.

### Not yet done

Slices 2 and 3 of this plan (pi-extensions consuming this repository's skills; agent definitions, guidance and project scaffolds). Slice 1 awaits sign-off and the commit. The eight `undeclared` records are project-local claude-code installs, deliberately outside a global declaration — leave them, or `skillset sync --prune` removes them.

### Review pass and its fix — 2026-10-07

A read-only review pass over slice 1 ran before the commit. It is recorded outside this file deliberately: the review skill is read-only and does not write log lines (`remediate` owns that). It found one bug and one criterion-versus-code conflict, both reported in the session.

**B1, fixed in the same commit** (developer's call: fix first, one commit). `set-mode` uninstalled the artifact and called `upsertInstall` without `removeInstall`, which was invisible while the identity ignored the mode and became a stale record the moment the mode joined the key. Measured before the fix, in a sandboxed `HOME`: `install confidence --agent pi --mode slash --global` then `set-mode confidence auto` left **two** records while the slash artifact was already deleted, and `sync --dry-run` then reported the slash install `missing` (it would have reinstalled the mode just switched away from) and the auto install `undeclared`. `update --dry-run` calls an `always` record whose anchor was removed `up-to-date`, because `preview` returning `current === null` is not divergence.

The fix is three lines in `src/commands/set-mode.ts` — `removeInstall` before the `upsertInstall`, both shared renderer paths used — plus a test that fails without it:

```
$ vitest run test/cli.test.ts -t "swaps the record instead of leaving"   # with the fix reverted
AssertionError: expected [ 'slash', 'always' ] to deeply equal [ 'always' ]
```

**S1, still open and needing your call.** Criterion 2 says `sync` "exits non-zero listing what it changed" and reconciles "install, update, and remove", but the delivered `sync` exits `0` when it reconciled (1 only for a refused foreign file, 2 for malformed declarations) and removes only under `--prune`. The delivered semantics look right — a healthy reconcile is not a failure — so the proposed amendment is to criterion 2's wording, not to the code. It is not amended unilaterally, because it is an acceptance criterion the developer wrote.

### Planning session — slice 2 — 2026-10-07

Scope and budget for slice 2 written the same day, after slice 1's implementation and before its commit. No implementation authorized; nothing in `pi-extensions` was modified. Recon read `pi.skills` and `BUNDLED_SKILLS_DIR` and their consumers, the contract harvester, `built-in-workflows.ts`'s stage and gate references, `pipeline-pointer.ts`, `token-surface.test.ts`, the 32 skill directories with their line counts and sibling files, `_shared/`'s call sites, and `copy-skills.mjs`; it also measured skillset's `parseSkill` against FLOW's frontmatter for three skills rather than assuming compatibility. The arm names were settled the same session (`flow-code-review`, `flow-remediate` — see *Decision* above), which is what 2b's budget and churn estimate hang on.
