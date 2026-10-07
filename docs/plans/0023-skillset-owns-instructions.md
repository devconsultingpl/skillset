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
- **Slice 2 — pi-extensions depends on skillset, by installation.** The review family (`code-review`, `remediate`) moves into this repository, keeps its name, and FLOW's package ships no copy of either; the one FLOW-side coupling — a `contract:` block whose `blockers_count` gates a stage — is satisfied because FLOW's contract harvester reads **user-installed** skills too. What FLOW keeps is its workflow declaration. Budgeted 2026-10-07 as **2a** (a skill ships its tools), **2b** (the review family moves) and **2c** (harness field support + the missing-renderer report). See *Slice 2* below; the context-economy half of the same directive is planned in `pi-extensions/docs/plans/0017-context-economy-load-on-demand.md`.
- **Slice 3 — agents, guidance channel and project scaffolds.** skillset gains a subagent definition concept; the global guidance channel is rendered from skillset rather than hand-written; project scaffolds (`.pi/`, project `AGENTS.md`) render with a documented local-override escape hatch. Inventory, placement rule and move order: *Slice 3 — one place for instructions, one place per harness for extensions* below.

## Acceptance criteria (slice 1)

1. Every skill in `src/skills/` declares its own install set in the repo — one or more modes plus a scope — and no script or CLI default decides them by name. This builds on **ADR 0005** ("allow recording multiple modes per (skill, agent, scope)"): the deliberate reality is that `architect`, `caveman`, `ponytail` and `commit-suggestion` install as *both* a slash prompt and an auto skill, so a declaration must express a set of modes, not one.
2. A single `skillset sync` reconciles every declared installation to the current sources for all four targets without `--force`, and lists what it changed. The exit codes are the contract, pinned by a test rather than by prose: **`0`** when it reconciled everything, **`1`** when it refused a file at an owned destination that skillset never wrote (`foreign`), **`2`** when the declarations are malformed or a declared skill is absent from the bundle. Removal stays opt-in (`--prune`), so a default run never removes a recorded install. *(Reworded 2026-10-07: the criterion as first written — "exits non-zero listing what it changed" — would have made a successful reconcile exit non-zero, breaking `sync && next-step` and telling CI that a healthy run failed.)*
3. Installs are tracked per installed file — the record lists each path — and classification compares the bytes a renderer would write with the bytes on disk. *(Amended 2026-10-07 during slice 2a: the original clause asked for a **content hash per file**, which was never implemented and is not needed — `drifted` has meant "differs from what we would write", not "differs from a recorded digest", since the live verification below. 2a's sibling classification makes the same choice, so both file kinds are judged one way. The criterion's second half stands: the statuses are reported per installation, by `sync` and its `--dry-run`, which is where the report lives — `status` is the active-skill verb.)*
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

`packages/flow/skills/` stops being a second source for anything skillset owns, and **pi-extensions depends on this repository by installation**. The review family is portable: its method, its helper and its template are harness-neutral, and its one FLOW coupling — the `contract:` block whose `blockers_count` gates a stage — is satisfied by a skill skillset installs, because FLOW's contract harvester reads user-installed skills as well as its own bundle (verified by execution, below). So the review moves here, keeps its name, and FLOW's package ships no copy. What FLOW keeps is its workflow declaration: a stage that dispatches the name and gates on its contract.

Split: **2a** teaches skillset to install a skill's **sibling files** — a portable skill carries tools, and no target copies them today. **2b** moves the review family and deletes FLOW's copies. 2b gets its own go only after 2a is green.

### What was verified for this slice (2026-10-07, in `pi-extensions` @ `0c9052a`)

- **One directory, two loaders.** pi reads `pi.skills: ["./skills"]` from `packages/flow/package.json`; flow-core reads the same place as `BUNDLED_SKILLS_DIR = join(PACKAGE_ROOT, "skills")` (`extensions/flow-core/paths.ts`), which backs both `BUNDLED_SKILL_NAMES` (the `[skill] flow:` status-line gate) and the contract harvester (`loadSkills` / `loadSkillsFromDir` + `parseFrontmatter`, `extensions/flow-core/skill-contracts-source.ts`).
- **Contracts are not restricted to that directory — this is what makes the move possible.** `buildUserSkillContracts()` (`skill-contracts-source.ts:178-198`) reads the same default locations pi's own loader reads (`<agentDir>/skills` + `<cwd>/.pi/skills`) through pi's exported `loadSkills`, harvests each skill's `contract:` block, and registers them under the `"user-skills"` owner. Verified by execution, 2026-10-07 — the harvester's own code path, run against a skillset-shaped install:

  ```
  $ PI_CODING_AGENT_DIR=<tmp>/agent   # <tmp>/agent/skills/code-review/SKILL.md, contract: at top level
  loader keys: name,description,filePath,baseDir,sourceInfo,disableModelInvocation
  harvested contract.required: ["blockers_count"]
  harvested artifactKind: review
  hidden from model: true
  ```

  So an installed skill can carry the gate's schema, and a stage whose `skill` name matches resolves it. Corollary: the registry *reports* a bundled↔user name collision (`skill-contracts-source.test.ts:710-714`) and pi's skill loader keeps the first discovered and warns — neither resolves it, so the declaration must prevent the collision (one provider per harness).
- **The token surface does not move, because the name does not.** `token-surface.test.ts` pins one message (`flow-pipeline-index`, 105 words / 137 estTokens) whose content is the hardcoded `PIPELINE_POINTER` array (`extensions/flow-core/pipeline-pointer.ts:26-41`), and that array names `code-review` (line 32) and `remediate` (line 42). Keeping both names and moving only the source leaves the pointer, the ratchet and every workflow reference untouched — a cost the abandoned rename would have paid for nothing.
- **`${SKILL_DIR}` is not a feature of pi — nor of any harness.** `grep -r SKILL_DIR` over the installed pi package (dist + docs) returns **nothing**. pi's skill loader instead injects one sentence into the skill prompt — *"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands"* (`dist/core/skills.js:285`) — and pi's only `${…}` substitution is prompt-template arguments (`docs/prompt-templates.md:44-47`). So the 20+ FLOW bodies calling `node "${SKILL_DIR}/../_shared/<script>.mjs"` carry a variable no harness expands and rely on the model substituting the path from that sentence. Any body that moves is normalised to the documented idiom as part of moving.
- **skillset cannot ship a skill's tools — this is 2a's whole job.** Every target writes exactly one rendered file (`src/targets/pi.ts:59,64,79`; `src/targets/claude-code.ts:161,166,188`); the only sibling file ever copied is the hardcoded `skillset-status` pi-extension asset (`pi.ts:69-73`). `bundle.ts` can already read any asset (`assetPath`, `templatesRoot`) — the capability exists, the install/uninstall/classification paths never use it. Meanwhile FLOW's review ships `_helpers/review-range.mjs` (439 + 227 test lines) and `templates/review.md` (151), and pi's own docs call bundled `scripts/`/`references/` the normal skill shape.
- **The agent roster is a different dialect, not a different harness.** pi's subagent extension parses exactly `display_name`, `description`, `tools`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `run_in_background`, `enabled` (`packages/pi-subagents/src/config/custom-agents.ts:56-68`). FLOW's 15 definitions declare `isolated: true` (14 of them) and `extensions:` (one) — **keys nothing parses**, the failure class `pi-extensions/docs/CONVENTIONS.md:39` names. Consequence for dispatch: fresh context is already the default (`inherit_context` is `undefined` unless declared and the caller decides), and a body naming `diff-auditor` resolves only where FLOW's roster is installed.
- **The runner never consults FLOW's bundle — 2b's step 0 is retired.** A stage dispatches a literal text prompt: `return \`/skill:${skill} ${inputForStage}\`;` (`packages/flow-workflow/runner/run-stage.ts:116`), and the skill name is pure derivation — `resolveSkill(def, stageName) { return def.skill ?? stageName }` (`stage-identity.ts:60`), with no filesystem or bundle lookup anywhere on that path. So pi resolves the `/skill:<name>` command from its own registry, which includes installed skills. Confirmed alongside it: `BUNDLED_SKILL_NAMES` has **no production consumer** in the workspace — the only hits are its own definition and docstring (`packages/flow/extensions/flow-core/paths.ts:36,76`), so its stated use (the `[skill] flow:` status-line gate) is itself stale prose, and deleting FLOW's copies changes nothing but that claim.
- **pi has no dynamic-context injection, and does not touch skill bodies at all.** No `disableSkillShellExecution`-equivalent exists anywhere in pi's dist, and the skill loader returns `{name, description, filePath, baseDir, sourceInfo, disableModelInvocation}` plus the relative-path sentence (`dist/core/skills.js:230-296`) — the body is passed through verbatim. So the ```! fenced block in FLOW's `## Metadata` (documented Claude Code dynamic context injection) is **literal text in pi**: the model may run it, and `${SKILL_DIR}` will not have been expanded when it does.

- **FLOW frontmatter survives skillset's YAML, not skillset's validator** — measured, not inferred:

  ```
  commit      | keys: name,description,argument-hint,disable-model-invocation,allowed-tools,shell-timeout,contract | THROWS: skill frontmatter missing required string field: version
  code-review | keys: name,description,argument-hint,disable-model-invocation,shell-timeout,contract                | THROWS: … version
  remediate   | keys: name,description,argument-hint,allowed-tools,shell-timeout,disable-model-invocation,contract   | THROWS: … version
  ```

  gray-matter keeps every key; `src/core/parse.ts` requires `name`/`version`/`description`. Only `version` is missing — and a moved source supplies it.

### Acceptance criteria (2a — a skill ships its tools)

1. A declared skill's sibling files (`_helpers/`, `scripts/`, `references/`, `templates/`, `examples/`) are copied verbatim into the install target beside `SKILL.md`, recorded per file, and removed by `uninstall` — nothing skillset did not write is touched. *(Reworded 2026-10-07 while building: "recorded per file with a sha256" described neither the sibling build nor slice 1 as shipped. Slice 1's record carries paths, and classification compares the rendered bytes with the bundle — hashes were never implemented, and the mechanism has been verified against the real home. See the deviation note under **Measured against 2a**.)*
2. What travels is **declared**, not "whatever sits in the directory": a skill lists its sibling files (per skill, in `skillset.config.json`), so shipping a 439-line helper is a deliberate, reviewable statement.
3. `sync` classifies siblings through slice 1's vocabulary: an unrecorded file at an installed sibling path is `foreign` (refuse, exit non-zero), a recorded sibling whose bytes moved is `drifted` (repair, report the prior content), a declared sibling that is absent is `missing`.
4. `SKILL.md` keeps rendering through `applyConfigToSkill`; siblings are copied byte-for-byte, and a sibling containing a `config:` placeholder is a reported error rather than a silently unsubstituted copy.
5. Proof by execution, not assertion: with `review-range.mjs` declared as a sibling of the review skill, an install into a sandboxed home followed by `node <installed skill dir>/_helpers/review-range.mjs <spec>` produces the same labelled output the helper produces inside FLOW's package.
6. Slice 1's invariants hold: no new renderer, no new dependency, `sync --dry-run` still the read-only report, and the four targets keep their existing destinations.
7. Documented: `README.md` (which files travel, how they are declared), `docs/conventions.md` (a skill with tools is the normal Agent Skills shape now), `docs/architecture.md`, and ADR 0007 filed as `docs/decisions/0007-*.md`.

**Status as built — 2026-10-07.** All seven hold; the deviations and the one addition are named here rather than left in the diff.

1. Holds as *reworded above*; the declared list lives under `siblings.<skill>` in `skillset.config.json` and each entry resolves to a bundle source path.
2. Holds — the key is `siblings.<skill>`; a path that is absolute, escapes the skill directory, names `SKILL.md`, repeats, or is not a file in the bundle is a declaration problem (exit 2).
3. Holds, per file. `ClassifiedInstall` carries the per-sibling states, and the install's own status is the most urgent of its files' (`STATUS_ORDER`, now shared with `sync`'s report order rather than duplicated).
4. Holds — and it was **not in the first build**: the `config:`-placeholder clause was missing until the criteria were re-read against the code. `configPlaceholdersIn` checks a sibling for a `{{key}}` naming one of its own skill's config keys; coverage reports it, and keys the skill never declared are left alone so a template may carry its own braces.
5. Holds — transcript below.
6. Holds. One file beyond the budgeted list is `biome.json`: the payload is foreign-runtime code, so `src/skills/**/_helpers/**` joins `templates/**` and `assets/**` in the formatter/linter ignore list — without it `biome check --write` reformats a copied file.
7. Holds: `README.md` gained *Files that travel with a skill*, `docs/conventions.md` a *Skill payloads* section, `docs/architecture.md` the mechanism in its component and data-flow lists, and `docs/decisions/0007-skills-ship-their-tools.md` was filed.

### Acceptance criteria (2b — the review family moves)

1. `src/skills/code-review/` holds the portable review — citation contract, quality-surface taxonomy, sink classes, mechanical selectors, verify step, subagent-dispatch default — with `_helpers/review-range.mjs` and `templates/review.md` beside it, travelling by 2a's mechanism.
2. It runs in a subagent by default and returns **only** the findings and the verdict; tool calls, intermediate findings and the search trail never enter the session. The body checks for a subagent mechanism and falls back to a bounded single pass where there is none; an explicit instruction ("run it here", "no subagent") or a direct invocation overrides the default.
3. `packages/flow/skills/code-review/` and `packages/flow/skills/remediate/` are **deleted**. One source, one name, no second copy — and no `package.json` or workflow edit, because the names do not change.
4. The gate still works end to end: `blockers_count` reaches `built-in-workflows.ts:157` from the `contract:` block skillset renders under `targets.pi`.
5. Step 0 is **retired** (2026-10-07): the runner dispatches a literal `/skill:<name>` text prompt (`packages/flow-workflow/runner/run-stage.ts:116`) and never consults FLOW's bundle — `resolveSkill` is `def.skill ?? stageName` (`stage-identity.ts:60`) and `BUNDLED_SKILL_NAMES` has no production consumer. What remains is the per-harness frontmatter check (2c), not the resolution path.
6. `PIPELINE_POINTER` and `token-surface.test.ts` are **untouched** (names unchanged ⇒ surface unchanged); FLOW's suite passes with amendments only where a test enumerates bundled skill *names* (`skill-contracts-source.test.ts:231,251`).
7. No harness ends up with two providers of one name. The declaration states, per harness, which side serves the review, and a harness with no skill-style install is stated rather than silently skipped.
8. `remediate`'s lane inputs (`--plans`, `--validation`) and the artifact conventions it reads survive as documented inputs, or their replacement is named in the Review log.
9. The agent roster stays FLOW's. The review names subagents generically and checks availability, so it is useful where FLOW's 15 agents are not installed; migrating the roster is slice 3's, and it is a dialect problem rather than a harness one.

### Budget (2a — sibling files)

Paths relative to `/Users/joozik/source/priv/skillset/`.

- Runtime: `src/core/types.ts` +~20 (a declared sibling list on the declaration and on the record); `src/core/declarations.ts` +~35 (parse, coverage, and sibling classification through the existing six statuses); `src/core/bundle.ts` +~10 (`listSkillFiles`, beside `assetPath`); `src/targets/pi.ts` +~35, `claude-code.ts` +~35, `opencode.ts` +~25, `copilot.ts` +~25 (copy, record, remove — the first per-target duplication this repository accepts, so the copy/remove helper itself lives once in `core/fs.ts`); `src/commands/update.ts` +~15 (a sibling's divergence is reported, not silently overwritten).
- Tests: `src/core/declarations.test.ts` +~60; `test/agents/*.test.ts` +~30-40 each for the four targets' sibling handling; `test/sync.test.ts` +~40 (a foreign sibling refuses; a drifted sibling is reported and repaired).
- Docs: `README.md` +~25, `docs/conventions.md` +~12, `docs/architecture.md` +~8, ADR 0007 ~45.
- New dependencies: **none**. New runtime modules: **0**.
- Estimated implementation logic: **150-210 added lines**. Physical lines: skillset **450-700** including tests and docs.

### Measured against 2a — 2026-10-07

Measured from the diff. Logic counts are added/removed non-comment, non-blank lines in `src/` (tests excluded); physical counts are `git diff --shortstat`.

| area | budget | measured | verdict |
|---|---|---|---|
| runtime logic | 150-210 added | **331 added/rewritten, 273 net** | **overrun: +63 net (30%), +121 gross (58%)** |
| runtime physical | — | 13 files, +445/−61 | 3 files beyond the budgeted list |
| new runtime modules | 0 | 0 | met |
| new dependencies | 0 | 0 | met |
| tests | ~60 (declarations) + 4×30-40 (agents) + 40 (sync) = 220-260 | **+371** (unit 160, end-to-end 211) | overrun +111 |
| docs | README +25, conventions +12, architecture +8, ADR ~45 = 90 | **113** (24 + 13 + 11 + ADR 65) | +23 |
| payload | not in 2a's budget | `_helpers/review-range.mjs` **443 new lines** | counted apart, as slice 1 counted its deleted script |

The payload is 439 lines moved verbatim from `packages/flow/skills/code-review/_helpers/` plus 4 for the normalised docstring — the `${SKILL_DIR}` idiom replaced by the skill's own directory, which no harness expands. FLOW keeps its copy **and its 227-line test** until 2b deletes them; the two-copy window is real, named, and scheduled, and the developer's call on 2026-10-07 was to pay it now so AC-5's proof runs against the real helper rather than a fixture.

**Per-file logic, and where the overrun went:**

| file | added / removed / net |
|---|---|
| `src/core/declarations.ts` | 186 / 27 / **159** |
| `src/commands/update.ts` | 42 / 6 / **36** |
| `src/core/fs.ts` | 21 / 2 / **19** |
| `src/commands/sync.ts` | 29 / 14 / **15** |
| `src/core/locations.ts` | 14 / 0 / **14** |
| `src/commands/install.ts` | 16 / 3 / **13** |
| `src/core/types.ts`, `src/commands/set-mode.ts`, `src/core/bundle.ts`, the three targets, `src/core/target.ts` | 23 / 6 / **17** |

1. `declarations.ts` is the whole overrun. It holds sibling path validation (~30: absolute, escape, `SKILL.md`, duplicate — the safety surface for a byte-for-byte copy), `parseSiblings` (~25), `classifySiblings` (~40), the config-placeholder check (~12), the coverage additions (~20), the shared `STATUS_ORDER` and roll-up (~15), and the `classifyInstall` → `classifyPrimary` extraction that moved ~30 existing lines behind a name (gross +30, net 0) so the roll-up had one merge point instead of three return paths.
2. `update.ts` (36) is the second avoidable chunk: reporting a sibling as divergence meant rebuilding the dry-run/skip/prompt branches around a `divergedWhat` list rather than `displayPath(rec)`, and making the prompt's diff callback conditional.
3. The rest is the mechanism itself.

**Files beyond the budgeted list:** `src/commands/install.ts` and `src/commands/sync.ts` (criteria 3 and 4 are *about* those two paths, so the budget's file list was short, not the build wide), `src/commands/set-mode.ts` (a mode switch must carry the siblings or it drops them; the same post-budget addition slice 1 recorded), `biome.json` (one ignore entry), `test/helpers.ts` (one export, `repoRoot`), and `src/skills/code-review/_helpers/` (the payload).

**Payload proof — executed, not asserted.** Install into a sandboxed home, then run the helper *from the installed location*, with FLOW's copy run against the same tree for comparison:

```sh
$ HOME=$TMPHOME node dist/cli.js install code-review --agent pi --mode auto --global
installed code-review → pi (auto, global) $TMPHOME/.pi/agent/skills/code-review
$ find $TMPHOME/.pi/agent/skills/code-review -type f
~/.pi/agent/skills/code-review/_helpers/review-range.mjs
~/.pi/agent/skills/code-review/SKILL.md
$ HOME=$TMPHOME node $TMPHOME/.pi/agent/skills/code-review/_helpers/review-range.mjs "file:README.md" > /tmp/inst.out
$ node /Users/joozik/source/priv/pi-extensions/packages/flow/skills/code-review/_helpers/review-range.mjs "file:README.md" > /tmp/flow.out
$ diff /tmp/flow.out /tmp/inst.out && echo IDENTICAL
IDENTICAL
```

Both runs exit 0 and print the same labelled block (`strategy: tree`, `---changed-files---`, `README.md`). The installed file differs from FLOW's copy in exactly one place — the docstring line naming how the path is resolved.

**Behaviour change the developer sees today:** `sync` prints one `note` on stderr per run until 2b changes `code-review`'s declaration — *"code-review: 1 declared sibling file(s), but no declared install of it writes a skill directory (`auto` mode) — none are copied"*. The declared installs are `slash` on pi and claude-code, which write a single prompt file into a shared directory. Nothing is silently dropped; the fix is 2b's or 2c's per-harness decision, not a quiet `auto` install added now.

### Budget (2b — the review move)

- skillset: `src/skills/code-review/SKILL.md` 43 → ~300-420 lines, a **portability rewrite, not a copy** (FLOW's 573 lines are a 9-step dispatch program with wave choreography and context-isolation rules; the portable form states the method and the dispatch contract, not one implementation's choreography); `src/skills/remediate/SKILL.md` 38 → ~60; `_helpers/review-range.mjs` (439) + `review-range.test.ts` (227) + `templates/review.md` (151) moved verbatim; `skillset.config.json` declarations for both; `docs/conventions.md` +~20 (the subagent-dispatch rule).
- pi-extensions: `skills/code-review/` (573 + 439 + 227 + 151) and `skills/remediate/` (76) deleted — **~1,466 lines**; `skill-contracts-source.test.ts:231,251` name lists amended; `packages/flow/docs/` +~15 (the dependency: skillset must be installed, and what failure looks like when it is not).
- Estimated: **1,050-1,450 physical lines** in skillset (≈820 of them moved verbatim), **~1,470 deleted** in pi-extensions. The dominant cost is the portability rewrite, which is judgment work.

### Slice 2c — harness field support and the missing-renderer report

#### Goal

An install is honest per harness: every declared frontmatter field is either expressed by that target's renderer or **reported as unsupported**, and no skillset install shadows a capability the harness already ships. Today an unsupported field is dropped in silence (`src/targets/pi.ts:24-46` composes `{name, description, ...targets.<agent>}`, so anything else is discarded; opencode ignores unknown fields by its own documentation). The developer's rule for this: *"if some skill needs some special things in one harness… if there is no renderer for that then we should let the user know that the renderer is missing for that."*

#### Evidence gathered 2026-10-07 (docs fetched, not recalled)

**Claude Code 2.1.286 (installed locally).** Skills follow the Agent Skills standard plus extensions. Frontmatter it honours: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. Two facts reshape slice 2: **`context: fork` + `agent: <type>` runs a skill in a subagent** (with `background: true` by default) — the developer's "run the review in a subagent and return only findings" is a one-line frontmatter field here, not body instructions; and a user skill of the same name **replaces a bundled skill** ("A project code-review skill replaces `/code-review`, and the bundled alias `/review` never runs your skill"). Claude Code ships bundled `/code-review`, `/verify`, `/run`, `/debug`, `/simplify`, `/doctor`, toggled by `disableBundledSkills` / `skillOverrides`. `!`command`` dynamic context injection and `${CLAUDE_SKILL_DIR}` substitutions are Claude Code features.

**opencode (installed locally).** Skills are recognised in `.opencode/skills/`, `~/.config/opencode/skills/`, **and the Claude-compatible `.claude/skills/` + agent-compatible `.agents/skills/` locations** — so one global install is visible to two harnesses. It reads **only** `name`, `description`, `license`, `compatibility`, `metadata`; every other field, `disable-model-invocation` included, is **ignored**, and `name` must match the directory name. Skills surface through a `skill` tool whose description lists every available skill (the eager surface, gateable by `permission.skill` patterns) — so a skill installed here without `disable-model-invocation` is model-invocable whether we intend it or not. Agents: markdown in `~/.config/opencode/agents/`, `mode: primary|subagent|all`, `hidden`, per-tool and per-command permissions, `Task` dispatch.

**GitHub Copilot CLI (not installed locally — doc-level only).** Its docs list Agent Skills, custom agents, subagents, hooks, plugins, dynamic workflows, parallel task execution and its own code review. Field-level support is **unverified** and is a step-2c task, not an assumption.

#### Acceptance criteria

1. Each target declares, in one place, the frontmatter fields it can express and the native commands it must not shadow. The four declarations are reviewable data, not scattered conditionals.
2. `install` and `sync` report every declared field a target cannot express — naming the field and the consequence — instead of dropping it silently: *"opencode cannot express `disable-model-invocation`: this skill will be model-invocable there."*
3. A declared **required** field with no renderer is a reported error (the renderer is missing), never a partial install. Warning versus error is decided by the declaration, not by guesswork.
4. No install shadows a harness built-in: the Claude Code commands named above are listed in the matrix, and the existing `sk-` slug rule (`docs/conventions.md:19`) is what keeps them intact.
5. Cross-harness discovery is documented where it changes behaviour: opencode reads `.claude/skills/`, so a global Claude install also serves opencode, and a skill's install set must account for it rather than double-install.

#### Budget (2c)

- Runtime: `src/core/types.ts` +~25 (a per-target capability record); `src/core/target.ts` +~10; the four targets +~10-15 each (declare the set); `src/commands/install.ts` +~30 and `src/commands/sync.ts` +~25 (report unsupported/required fields); `src/core/declarations.ts` +~20 (a declaration may mark a field required per harness).
- Tests: `src/targets/*.test.ts` +~25 each; `test/cli.test.ts` +~50 (the report shape and the exit code).
- Docs: `README.md` +~35 (the matrix), `docs/conventions.md` +~15, `docs/architecture.md` +~6.
- Verification per harness: claude-code and opencode are installed locally, so an install into a temp dir followed by that CLI's own discovery is checkable; Copilot CLI needs its `custom agents configuration` and `built-in skills` reference pages read before anything is declared for it.
- New dependencies: **none**. Estimated implementation logic: **90-130 added lines**. Physical: skillset **400-600**.

**Superseded 2026-10-07 by the build** — the estimate treated the per-target capability record as if the field sets were small; four harnesses' actual vocabularies are data, and Claude Code's skill reference alone is 20 fields. Measured: **240 added / 10 removed, 230 net** runtime logic. The per-file breakdown, the two mechanical reductions made before measuring, and what is counted as overrun are under *Measured against 2c* below.

### Decisions (slice 2)

1. **No projection mechanism — superseded, and dropped.** The earlier 2a (`skillset project` + manifest + two-sided drift checks) rested on a premise the executed check destroyed: that a skill must have a source here *and* a copy in FLOW's package. pi resolves an installed skill at run time and FLOW harvests contracts from installed skills, so nothing needs to exist twice. Dropping it removes a command, a manifest, a second writer and a class of drift; what replaces it is smaller and more general — a skill ships its tools.
2. **One source, one name.** `code-review` stays `code-review`; after the move it exists once, here. The `flow-code-review` rename is dead, and with it a pointer edit and a ratchet re-pin that would have bought nothing.
3. **Exactly one provider per harness, enforced by declaration.** pi keeps the first discovered skill on a name collision and warns (`docs/skills.md`), and the contract registry reports a bundled↔user collision (`skill-contracts-source.test.ts:710-714`). Neither is a resolution policy; the declaration must make the collision impossible.
4. **The dependency is by installation, not by packaging.** FLOW's package stops being self-contained for the review: it requires the skill to be installed on the machine. That is the dependency direction this program asked for; the mitigation is a clear failure (the contract provider is already fail-soft, and `packages/flow/docs/` states what happens) rather than a silently empty stage.
5. **Skills ship their tools.** A skill with `scripts/`, `references/` or `_helpers/` is the shape pi's own documentation calls normal, and skillset cannot express it today. The review needs it; every later skill inherits it.
6. **Subagent by default, availability-checked.** The portable wording dispatches through the harness's subagent mechanism and returns findings only; where none exists it degrades to a bounded single pass; an explicit instruction overrides. No flag is needed for fresh context — `inherit_context` is `undefined` unless declared, and the caller decides.
7. **The agent roster stays FLOW's** (developer's call, 2026-10-07). The review dispatches generically; migrating 15 definitions needs a skillset agent-definition target with a per-harness dialect — a slice-3 mechanism, and a dialect problem rather than a harness one.
8. **`_shared/` stays FLOW's for now.** A moved body that needs a `_shared` script either carries it as a sibling (2a) or is rewritten not to call it; decided per script when 2b lands. Its callers are why the `${SKILL_DIR}` idiom must be normalised in the same pass.

### Decision — the placement rule (settled 2026-10-07, superseding the rename)

**Portability decides the home; the name does not change.** A skill useful in any harness lives here and is the default everywhere; a skill that depends on one harness's extension surface stays with that harness. When two exist for one capability they carry the same name and the *harness* picks — which requires exactly one provider per harness: never two names for one capability, and never the same name twice in one harness. Applied to the review: it is portable (evidence above), so it moves here, keeps its name, and FLOW ships no copy; what stays FLOW-side is the workflow declaration that dispatches the name and gates on its contract. Roads not taken: the `flow-code-review` rename (two names for one capability, plus a pointer edit and a ratchet re-pin); the thin-runner split (leaves the good text in the repository that can use it in one harness only); keeping FLOW's copy as the pi provider with skillset's as the other-harness default (two bodies for one capability — the drift this program exists to remove, hidden inside pi by the same-name rule rather than prevented).

### Confidence (slice 2)

**~90% for 2a** and **~92% for 2b** — higher than the projection design this replaces, because one executed check replaced a whole mechanism. Retired today by running it, not by reading:

- The load-bearing claim — *a skillset-installed skill's `contract:` reaches FLOW's gate* — is verified: pi discovers `<agentDir>/skills/code-review/SKILL.md`, reports it as `disableModelInvocation: true`, and the harvester's own path (`parseFrontmatter(readFileSync(skill.filePath))`) returns `contract.produces.data.required = ["blockers_count"]` with `artifactKind: review`.
- The token surface is provably unchanged: the pointer names skills, the names stay, so no re-pin.
- `${SKILL_DIR}` is provably not a pi feature (zero occurrences in the installed package), so normalising it is required work rather than a preference.
- The roster's `isolated: true` (14 files) and `extensions:` (one) are provably read by nothing, so "fresh context" needs no new flag.

What remains unretired, in risk order: **(a) retired 2026-10-07 by execution** — the runner builds a literal `/skill:<name>` prompt (`run-stage.ts:116`) over a pure name derivation (`stage-identity.ts:60`) and never consults the bundle, and `BUNDLED_SKILL_NAMES` has no production consumer. **(b)** That claude-code and opencode accept the review's rendered frontmatter once `contract:` moves under `targets.pi`: claude-code's full field set and opencode's five-field set are now documented, but the end-to-end check is 2c's first task, since both CLIs are installed here. **(c)** The size of the portability rewrite — judgment work, and the plan's largest single estimate.

## Slice 3 — one place for instructions, one place per harness for extensions

Planned 2026-10-07 at the developer's direction: *"we should probably add to the plan how we are going to move other things to skillset — like other agents, so we have one place where we define agents skills prompts etc etc and one place with genuine extensions — right now we are actively developing only pi extensions as the other harnesses that we're using have most of our extensions build in."* **No go**: this section is the inventory, the rule and the order. Budget is written when the slice starts, as the program shape says.

### The test that decides where something lives

The slice-2 placement rule, extended from skills to every artifact kind:

1. **Does it implement a harness API?** — an extension entry point, tool registration, a hook, a TUI overlay, a prompt rewrite, a permission gate. Then it is *harness surface*: it stays in that harness's package, because no other harness has that API.
2. **Does it shape how work is done?** — a skill body, an agent definition, a prompt or command template, a workflow declaration. Then it is *instruction content*: it lives here and is rendered per target in the dialect that target reads.
3. **Is it instruction content that documents one harness's extension?** — then it stays beside that extension. Verified example: `pi-permission-system` ships `permission-policy-change`, which means nothing where that extension is not installed.

Roads not taken: importing a harness extension here as an "asset" (foreign code with no owner and no test); leaving content in the harness's package because it is convenient there (that is the drift this program exists to remove).

### Inventory — measured 2026-10-07, `pi-extensions` @ `c488419`

Per-package counts of `skills/`, `agents/`, `extensions/`, `prompts/` (`ls -d` per directory), against the 16 packages in the workspace:

| package | kind | what it holds (measured) |
|---|---|---|
| `flow` | **content**, plus one runtime | `skills/` 32 directories (31 skills + `_shared/`), `agents/` 15 definitions, `extensions/flow-core` (contract harvester, pipeline pointer, agent manifest) |
| `flow-workflow` | runtime | the workflow engine: chained stages, audited JSONL state, predicate routing. Its stage lists are the *declaration* half of the same package (3e) |
| `flow-advisor`, `flow-ask-user-question`, `flow-todo`, `flow-web-tools`, `flow-args`, `flow-i18n` | runtime | one pi tool or prompt layer each |
| `pi-subagents`, `pi-playwright`, `pi-permission-system`, `pi-permission-system-slr`, `pi-slr-service` | runtime | agent core, browser tools, permission enforcement, SLR adapter |
| `pi-permission-system` | runtime, plus one skill | `permission-policy-change` — content for its own surface (rule 3) |
| `flow-config`, `flow-test-utils` | no extension | shared config utils, test fixtures |
| `pi-llm-switch` | **planned, not built** | `README.md`, `docs/` (a plan, a RAM/model analysis, a fine-tuning guide) and an empty `src/` — no `package.json`, no extension entry point. The developer's purpose for it, stated 2026-10-07: run subagents on **different models**, and use **local models** (Ollama / MLX) alongside cloud ones, releasing RAM when switching. Runtime and pi-side; nothing here for this repository to own |

Exactly **one** package is mostly instruction content, and it is the one this program already started on: `flow`, whose review family is 2b. The other fifteen are what the developer called genuine extensions.

### Do the other harnesses miss anything pi has?

Verified 2026-10-07 by fetching docs, not by recall: claude-code 2.1.286 honours a full skill frontmatter set, runs a skill in a subagent (`context: fork` + `agent:`), and ships slash commands, subagents, hooks, plugins, permissions, statusline and MCP; opencode 1.1.40 has skills, commands, agents/subagents, plugins, permissions, MCP; Copilot CLI documents agent skills, custom agents, subagents, hooks, plugins, dynamic workflows and MCP, plus its own code review. Those capabilities are what `flow-todo`, `flow-web-tools`, `pi-subagents`, `pi-permission-system`, `pi-playwright`, `flow-ask-user-question` exist to give pi — so in the main the developer's reading holds: the pi side is where parity work lives, and there is nothing to port into a harness that already ships it.

**Not verified, and therefore work rather than assumption:** parity *per capability*. Nobody has checked whether opencode ships a todo tool, a web-fetch tool or a permission gate shaped like `pi-permission-system`'s, nor what Copilot CLI's hooks and plugin model would do with `flow-workflow`'s needs. The check is per capability and cheap — the harness's docs plus a temp-dir install followed by its own discovery, the method 2c already uses — and it sorts each runtime package into one of three outcomes: **parity shim** (pi catching up; nothing to move, nothing for this repository to own), **harness-unique** (no peer concept exists, so there is nothing to port), or **portable capability** (the engine is harness-specific but a peer concept exists — GitHub's *dynamic workflows* is the nearest thing to `flow-workflow`, in a different shape).

**SLR — settled 2026-10-07 by the developer, and not by the classification.** `pi-slr-service` and `pi-permission-system-slr` exist to make SLR a first-class tool *in pi*. SLR itself is a tool under development, and the other harnesses will be reached a different way later; **nothing about SLR is to be ported now**. It is harness-unique by decision as well as by evidence, and the same holds for `flow-i18n` (a locale layer for pi-side skills).

### The order, and what this repository gains before each move

- **3a — an agent-definition concept.** Today this repository installs skills and prompts and has no concept of a *subagent definition* at all, so FLOW's 15 agents cannot move however portable they are. The roster's dialect is pi's: `packages/pi-subagents/src/config/custom-agents.ts:56-68` parses exactly `display_name`, `description`, `tools`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `run_in_background`, `enabled`, while 14 of FLOW's files add `isolated: true` and one adds `extensions:` — keys nothing parses. Rendering agents per harness therefore needs the same thing 2c is building for skills: a per-target declaration of the fields a target can express. Until then the roster stays FLOW's (slice-2 decision 7, unchanged). `model` is one of the ten fields pi does parse, which is where the developer's multi-model intent for `pi-llm-switch` meets this step: an agent that names a model is a declaration, and only the harness can honour it.
- **3b — the guidance channel** (already scoped in this plan): the ownership rule rendered here instead of hand-written.
- **3c — project scaffolds**: project `.pi/`, project `AGENTS.md`, with a documented local-override escape hatch.
- **3d — the FLOW skill triage** (31 skills). Per skill, one question: does the body name a pi-only tool, or call a `_shared/` script? Portable method moves here — 2b's review is the first case, already in flight — and a body that only means something against pi's tool surface stays with FLOW, under a name this repository does not own.
- **3e — workflow declarations.** FLOW's stage graph (`built-in-workflows.ts`) is a declaration over skill names: content by the rule above. Moving it needs a workflow concept here *and* a per-harness story for the harnesses with no workflow engine — pi has `flow-workflow`, GitHub now advertises dynamic and agentic workflows, the other two have nothing comparable.
- **3f — prompts and commands.** `pi-extensions` ships no `prompts/` directory; this repository's `slash` mode already covers that shape for all four targets, so the remaining gap is only that FLOW's stage skills install as skills rather than prompts.

### Implementation session — slice 2c — 2026-10-07

The developer said **go** on 2c (2c first, then 2b) and settled the one open design question: the capability report has **two sources** — a field present in the skill's own frontmatter *warns*, and a `requires` entry in `skillset.config.json` *errors*. Implemented tests-first, in the four steps the handoff named.

**What landed.** `TargetFrontmatter` on every target (`expresses` per mode, `consequence`, `native`) with the four sets declared in `src/targets/*.ts`; `requires` parsing, coverage checks and `fieldSupport` in `src/core/declarations.ts`; the capability check wired into `install` (warn, or refuse and write nothing) and `sync` (warn, or exit 2 before the first artifact — sync stays all or nothing); the `sk-` slug rule pinned by a test against each target's recorded built-ins; and `SKILLSET_CONFIG=<path>`, a declarations-path seam so an end-to-end test can exercise a declaration shape without editing this repository's own config.

Evidence:

```sh
npm run build              # tsc + copy-skills
npm test                   # 25 files / 241 tests (2a: 226 → +15)
npx biome check src test   # clean
```

**AC-5 proved by execution, not assertion — and one half failed for a reason outside this repository.** An install into a temp project, then Claude Code 2.1.286's own loader (`claude --debug-file … -p …`; authentication failed, so **no model call happened** and the log is the loader's, not a model's claim):

```
[DEBUG] Loading skills from: … project=[/private/tmp/cc-disc-vjxt/.claude/skills]
[DEBUG] Loaded 16 unique skills (16 unconditional, …, project: 1, …, legacy commands: 12)
[DEBUG] getSkills returning: 16 skill dir commands, 0 plugin skills, 39 bundled skills, 1 builtin plugin skills
# artifact removed with `rm …/architect/SKILL.md`:
[DEBUG] Loaded 15 unique skills (… project: 0, …)
[DEBUG] getSkills returning: 15 skill dir commands, …
```

`project: 1` with our artifact and `project: 0` without it: the count is ours. The negative run is the check, because a positive count alone would not distinguish our skill from one already on the machine.

**opencode could not be checked, and the cause is a broken install rather than a design problem.** Its arm64 binary dies with `Killed: 9` on every invocation (direct, through a pty, and with `HOME` unset), and `codesign --verify --strict` names why:

```
opencode-darwin-arm64/bin/opencode: invalid signature (code or signature have been modified)
```

So opencode 1.1.40 cannot launch on this machine at all, and *its own* discovery is unrunnable here — a reinstall would fix it. What stands in for it is weaker and is named as such: opencode's field sets come from its fetched docs, and the install paths this repository writes (`~/.config/opencode/skills/<name>/SKILL.md`, `~/.config/opencode/commands/<slug>.md`) are the paths those docs list. Copilot CLI is installed nowhere here, so its row is doc-level throughout, and there is no `native` list for it beyond the Copilot **app**'s built-in skill ids — the CLI's own list was not read and is not claimed.

### Measured against 2c — 2026-10-07

| area | budget | measured | verdict |
|---|---|---|---|
| runtime logic | 90-130 added | **240 added / 10 removed, 230 net** | **overrun: +100 net (77%), +110 gross (122%)** |
| runtime physical | — | 10 files in `src/` (beyond tests), +654/−13 overall with tests and docs | see below |
| new runtime modules | 0 | 0 | met |
| new dependencies | 0 | 0 | met |
| tests | ~25 × 4 targets + ~50 CLI = ~150 | **+249** (unit 120, matrix 32, end-to-end 91, +6 amended) | overrun +99 |
| docs | README +35, conventions +15, architecture +6 = 56 | **+115** (README 52, conventions 27, architecture 33 incl. amendments) | +59 |

**Per-file runtime logic, and where the overrun went:**

| file | added / removed / net |
|---|---|
| `src/core/declarations.ts` | 104 / 5 / **99** |
| `src/targets/claude-code.ts` | 34 / 0 / **34** |
| `src/targets/pi.ts` | 23 / 0 / **23** |
| `src/commands/sync.ts` | 20 / 2 / **18** |
| `src/core/types.ts` | 15 / 0 / **15** |
| `src/commands/install.ts` | 14 / 2 / **12** |
| `src/targets/opencode.ts`, `copilot.ts` | 19 / 0 / **19** |
| `src/core/target.ts`, `locations.ts` | 11 / 1 / **10** |

1. **The field vocabularies are data the budget did not model.** It budgeted "a per-target capability record (~25 lines in `types.ts`)" as if the sets were small. Claude Code's skill frontmatter reference alone is 20 fields, and pi's command namespace 26 names; enumerating what four harnesses actually read is most of the difference. Two mechanical reductions were made before measuring — Claude's command set is derived (`CLAUDE_SKILL_FIELDS.filter(…)`, exactly the doc's "same fields except `name` and `paths`") instead of transcribed twice, and the `native` lists are compacted one-liners with their source named — which removed ~75 lines. What remains is the substance of the matrix.
2. **Per-mode sets were necessary, not speculative**: the same harness reads different vocabularies for a command and a skill (claude-code: minus `name`/`paths`; opencode: five fields versus four; pi: `argument-hint` versus the Agent Skills set). A single set per target would have made the report wrong in both directions.
3. **The behavioural half is close to plan**: `fieldSupport` (45) + `requires` parsing (28) + coverage (14) + report wiring in `install` (12) and `sync` (18) = 117 against a budgeted 30 + 25 + 20 + 10 = 85.
4. One file beyond the budgeted list: **`src/core/locations.ts`** (2 logic lines) — the `SKILLSET_CONFIG` seam, added because the declarations path is fixed next to the bundle, so the error path could otherwise only be unit-tested, never proven end-to-end as this plan's criteria require for "never a partial install".

**Falsification, because a green test proves nothing on its own.** The load-bearing test (criterion 3) was run against a deliberately broken implementation:

```
$ sed -i '' 's/if (support.errors.length > 0) {/if (false \&\& …) {/' src/commands/install.ts && npm run build
$ npx vitest run test/cli.test.ts -t "refuses a required field"
AssertionError: expected 0 to be 1        # exit status: the install proceeded
```

The file was restored and rebuilt. Without that run, "the refusal works" would have been an assertion.

**Criteria as built.**

1. Holds — `TargetFrontmatter` is declared once per target, four records, no scattered conditionals; `expresses` is per mode and `native` per harness.
2. Holds, with the two-source split the developer chose: a top-level harness field warns that no renderer forwards it; a `targets.<agent>` field the harness ignores warns with the field and the consequence (opencode's `disable-model-invocation` entry is written from its own docs).
3. Holds, and is falsified above: `requires` with no renderer is an error, `install` writes nothing and records nothing, and `sync` exits 2 before its first write.
4. Holds: the `sk-` rule is now *checked* rather than assumed — every bundled slug must match `^sk-`, and each shipped slug is compared against its target's recorded built-in list, which for Claude Code includes the `/review` alias alongside the bundled skills.
5. Documented where it changes behaviour: opencode reads `.claude/skills/`, so a global claude-code install is visible to opencode and a skill should be declared for one of them, not both (README).

**Behaviour change the developer sees today:** none. No shipped skill declares a harness field a target cannot express, so a healthy `sync` reports nothing new — pinned by an end-to-end test ("reports no unsupported field for the repository's own declarations") so the silence is a checked claim rather than an accident. The first live subject is 2b's review declaration.

**Findings recorded, not fixed.** This target writes `mode: agent` into Copilot prompt files, while VS Code's current reference documents the field as `agent` (and documents prompt files as deprecated for Agent Host sessions). Changing rendered output for copilot installs is a behaviour change outside 2c's criteria, so it is named here rather than slipped into the diff.

### Slice-2c status — 2026-10-07

Implemented, tested, and measured; **not committed** — the commit message is drafted and the developer runs it. 2b remains unauthorised, and its prerequisite is now closer to solved: the matrix states exactly which fields the review can carry per harness, so the skill-versus-command decision (claude-code `auto`, which has a directory for `review-range.mjs`, versus `slash`, which has none) can be made from data rather than from a reading.

## Decisions

### Ownership by manifest and hash, not by convention

FLOW already solved this shape for its agents: a hash manifest (`.flow-managed.json`, `Record<filename, sha256>`) with explicit states including `UNMANAGED` for a directory it never installed and preservation of user-added files. skillset should adopt the same shape rather than invent one, because it is proven in this codebase family and because the developer's "must not drift" requirement is exactly what a hash manifest detects.

### Settings stay the developer's; declarations live in skillset

The developer owns `settings.json`. skillset owns the *content* it renders into harness directories. Where skillset must touch a settings file at all (the claude-code target already writes `statusLine` and a `SessionStart` hook there via read-modify-write, and explicitly leaves unrelated keys alone), it keeps doing key-level read-modify-write and never regenerates a whole file — pi writes `settings.json` itself (theme, model, changelog version), so whole-file generation would fight it.

### The ownership rule ships through the system-prompt channel

pi loads **both** `<agent-dir>/AGENTS.md` (user instructions applied across working directories) and `<agent-dir>/APPEND_SYSTEM.md` (appended to the system prompt) — pi docs `configuration.md:18-20`, confirmed in pi's code by `discoverAppendSystemPromptFile()` in `dist/core/resource-loader.js`. skillset's pi `always` mode targets `APPEND_SYSTEM.md`, and the repo's own `src/skills/retro/SKILL.md:33` claims pi's global instruction file is `AGENTS.md` — so nothing currently writes the ownership rule into either channel.

Decided: the rule ships via `always` mode into `APPEND_SYSTEM.md`, because rules about *how work is done* belong in the system prompt while project and repository conventions belong in the context file. The `retro` claim is corrected in the same slice — a skill that misstates the channel will keep generating that mistake.

### Slices 2–3 decisions recorded now, decided later

- **Names — settled 2026-10-07, differently from the guess below.** FLOW's workflow graph hardcodes skill names (`extensions/flow-core/built-in-workflows.ts:144,149-151,157` — stages `implement → validate → code-review` with a gate reading `blockers_count` from the skill's `contract:` block), so a skill that *moves* must keep its name and carry the contract with it. Nothing is renamed: see *Decision — the placement rule* under slice 2.
- **Unknown frontmatter keys are dropped today** unless nested under `targets.<agent>` (`src/targets/pi.ts:24-46`). FLOW's `contract:`, `argument-hint`, `allowed-tools`, `shell-timeout`, `disable-model-invocation` therefore must be relocated under `targets.pi` to survive a move — a mechanical but non-optional part of slice 2.
- **`_shared` is runtime code.** FLOW's bodies call `node "${SKILL_DIR}/../_shared/<script>.mjs"`, and `_shared` holds scripts with their own tests. Two findings settled this in slice 2: **no harness expands `${SKILL_DIR}`** (measured — zero occurrences in the installed pi package), so the idiom is normalised to pi's documented relative-path rule (`dist/core/skills.js:285`) as a body moves; and a moved skill can **carry the scripts it needs as declared sibling files**, which is 2a's mechanism.

### Road not taken

Vendoring FLOW's skills into skillset as auto-installed copies (two homes, synced by script) was rejected: it reproduces the drift problem it is meant to remove. Making skillset a runtime *dependency* of the pi extension bundle was rejected for slice 1 — and the seam chosen instead, a generated projection inside the flow package, was **itself dropped in slice 2**: the executed check showed FLOW's contract harvester also reads user-installed skills (`skill-contracts-source.ts:178-198`), so a skill skillset installs needs no package-side copy at all, and the projection's command, manifest and second writer disappear with it. Renaming anything before the ownership machinery exists was rejected: a rename is the easy half and it is not the problem — and slice 2 went further, dropping the rename entirely once the review turned out to be portable under one name.

### ADR appendix — 0006: instruction ownership and dependency direction

To be filed as `docs/decisions/0006-instruction-ownership.md` in this repository during slice 1. pi-extensions keeps its own decisions for consumer-side obligations; its next free number is 0009.

**Context.** Skills, prompts, agent definitions, commands and workflow declarations exist in three places with no relationship between them: the skillset repo (13 skills, 3 install modes, 4 targets, own state file), the pi-extensions FLOW package (28 hidden skills with machine contracts, 15 agents with a hash manifest, workflow graphs referencing skills by name), and hand-maintained global files in `~/.pi/agent`. Two skills are named `code-review` and two `remediate` with deliberately different contracts. Nothing enforces non-drift, and nothing propagates a change.

**Decision.** skillset is the canonical owner of shared instruction content. Harnesses and the pi-extensions packages consume it; a package may own what is genuinely specific to it, under a name that cannot collide with a skillset name. Changes are made in skillset and propagated automatically to every consumer through generated projections plus an ownership manifest; project-side agents may only queue suggestions for that content, never edit it. Settings files remain the developer's.

**Consequences.** One place to change a rule, one place to look for its current text, and drift becomes detectable rather than invisible. Costs: skillset grows from 13 skills to a much larger inventory with harness-specific frontmatter spread across targets; FLOW's token-surface ratchet must be re-satisfied whenever a base body changes, so review of any instruction change includes a surface check; and the projection must be regenerated as part of the normal build, or consumers silently run stale copies — which is precisely the failure mode the manifest exists to announce.

> **Superseded in part — 2026-10-07, slice 2.** The filed ADR 0006 stands as the record of the *ownership* decision. Its mechanism sentence — "propagated automatically to every consumer through generated projections plus an ownership manifest" — does not: the review family moves by **installation** (one source, one name, one provider per harness) and skills carry their own tools, so nothing is projected. ADRs are append-only, so the correction is a new ADR (0007) rather than an edit to the filed one; the last clause above about regenerating a projection is dead with it.

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

**Lower confidence for slices 2–3, deliberately:** FLOW's skill loading, contract harvesting and workflow coupling are verified, but the *mechanism* was not designed here, and the token-surface ratchet makes every rename a measured event. Slice 2 was scoped and budgeted on 2026-10-07 (*Slice 2* below), then reshaped the same day once the contract harvester was checked by execution and the review turned out to be movable by installation rather than by projection; slice 3 is still unestimated.

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

**S1, resolved 2026-10-07** (developer's call: reword the criterion, keep the code). Criterion 2 as first written — "exits non-zero listing what it changed" — would have made a successful reconcile exit non-zero, which tells CI a healthy run failed and stops `sync && next-step`. The criterion now states the three codes as the contract (`0` reconciled, `1` refused a foreign file, `2` broken declarations) and they are to be pinned by a test as part of 2a.

### Planning session — slice 2 — 2026-10-07

Scope and budget for slice 2 written the same day, after slice 1's implementation and before its commit. No implementation authorized; nothing in `pi-extensions` was modified. Recon read `pi.skills` and `BUNDLED_SKILLS_DIR` and their consumers, the contract harvester, `built-in-workflows.ts`'s stage and gate references, `pipeline-pointer.ts`, `token-surface.test.ts`, the 32 skill directories with their line counts and sibling files, `_shared/`'s call sites, and `copy-skills.mjs`; it also measured skillset's `parseSkill` against FLOW's frontmatter for three skills rather than assuming compatibility. **Revised the same session, after the developer challenged the classification.** A second pass asked what is *pi*-coupled rather than *FLOW*-coupled and answered it with evidence: FLOW's contract harvester also reads user-installed skills, so the gate does not bind the review to FLOW's package (executed check, transcript under *What was verified*); the nine subagent types are a dialect of the pi-subagents extension, not a harness feature; `${SKILL_DIR}` is expanded by no harness; and two agent frontmatter keys are read by nothing. Consequences of the revision: the arm **rename is dropped** (the review keeps its name and moves by installation), 2a's projection mechanism is dropped in favour of skillset installing a skill's sibling files, and the review becomes one portable body that runs in a subagent and returns findings only. Also settled: the agent roster stays FLOW's for slice 2, and the context-economy half of the directive is planned separately in `pi-extensions/docs/plans/0017-context-economy-load-on-demand.md`.

### Harness research, verification and slice 2c — 2026-10-07

Three execution checks ran **before any go**, at the developer's request; each result is in *What was verified for this slice* above rather than restated here.

1. **The runner's resolution path.** `runner/run-stage.ts:116` builds the literal `/skill:<name>` prompt; `stage-identity.ts:60` is `def.skill ?? stageName`; no bundle lookup exists on that path. `BUNDLED_SKILL_NAMES` has no production consumer (`paths.ts:36,76` only), so its docstring's claim about the status-line gate is stale prose — the second finding of that class in FLOW's flow-core this session, after `isolated: true` in the agent roster. **2b's step 0 is retired.**
2. **pi's handling of the skill body.** Verbatim (`dist/core/skills.js:230-296`), and no dynamic-context-injection feature exists anywhere in pi's dist — so the ```! block in FLOW's `## Metadata` is literal text in pi, and `${SKILL_DIR}` reaches a shell unexpanded. Normalising both is part of any body that moves, not a portability blocker.
3. **Harness capability research** (docs fetched, not recalled). Claude Code 2.1.286 honours a full field set and runs a skill in a subagent natively via `context: fork` + `agent:`; a same-named user skill **replaces** its bundled `/code-review`; it ships `/code-review`, `/verify`, `/run`, `/debug`, `/simplify`, `/doctor`. opencode recognises **only** `name`, `description`, `license`, `compatibility`, `metadata` — `disable-model-invocation` included in what it ignores — and also reads `.claude/skills/`, so one global Claude install serves two harnesses. Copilot CLI is installed nowhere here and stays doc-level only, with its field support unverified.

Consequence: **slice 2c added** (targets declare their field support; `install`/`sync` report every declared field a target cannot express, and a required field with no renderer is a reported error rather than a partial install). Budget in place: 90-130 logic lines, no new dependencies.

Outside both repositories, at the developer's instruction, the global note in `~/.pi/agent/AGENTS.md` was corrected — the colliding-name rule became *"never two providers of one name in one harness"*, with the harness picking the provider. That file is still the developer's hand-edit and is replaced by rendered content when this repository takes over the channel (decisions-asserted item 5).

### Slice-1 sign-off — 2026-10-07

The developer confirms slice 1 is committed (`880fdfe`) and signed off. The plan **stays in `docs/plans/`** rather than `completed/`, because the same document carries slices 2 and 3, which are not done — moving it would claim otherwise. It moves when the program does.

### Implementation session — slice 2a — 2026-10-07

The developer said **go** on 2a and answered two build-time questions: copy `review-range.mjs` into this repository now (so AC-5's proof runs against the real helper), and start the parallel `pi-extensions` audit (plan 0017 step 1) from this session as a background agent.

**What landed.** `siblings.<skill>` in `skillset.config.json`; `core/declarations.ts` parsing, coverage and per-file classification; `core/locations.ts` `skillDirectoryFor`; `core/fs.ts` `copyAtomic` / `copySiblings` / `readMaybeBytes`; `core/bundle.ts` `skillSourcePath`; `InstallContext.siblings`; the three directory-writing targets (`pi`, claude-code's `auto` **and** `always`, `opencode`) copying, recording and removing siblings; `install` passing and warning about them; `sync` reporting them per file; `update` treating an edited sibling as divergence; `set-mode` carrying them across a mode switch; `biome.json` ignoring the payload. Plus the payload itself, three docs and ADR 0007.

Evidence:

```sh
npm run build              # tsc + copy-skills
npx tsc --noEmit           # clean
npm test                   # 25 files / 226 tests (slice 1: 203 → +23)
npx biome check src test   # clean
```

Real-home dry run, unchanged from slice 1's steady state:

```
$ node dist/cli.js sync --dry-run          # exit 0
note code-review: 1 declared sibling file(s), but no declared install of it writes a skill directory (`auto` mode) — none are copied
checked undeclared 8 · in-sync 31
```

No `drifted`, `missing` or `foreign` row appeared, and nothing was written. The `note` is the deliberate honesty path described under **Measured against 2a**, not a regression.

**Three things this session got wrong first, recorded so they are not repeated:**

1. **`biome check --write` reformatted the copied payload.** The helper is foreign-runtime code — the same class as `assets/`, which `biome.json` already excludes — and it was not excluded until the linter diffed a 439-line copy against its source. The file was restored from FLOW's copy and re-edited, and the ignore added. Byte-identity with FLOW's copy (apart from the docstring line) is now pinned by the pi target's test, which compares the *installed* bytes with the bundle source rather than trusting the copy step.
2. **AC-4's `config:`-placeholder clause was missing from the first build** — found by re-reading the acceptance criteria against the code before updating the plan, not by a test. It is implemented (`configPlaceholdersIn`) and unit-tested; recorded as a criteria pass, not dressed up as a review finding.
3. **The budget's file list was short, not just its estimate.** Criteria 3 and 4 are about `sync` and `install`, neither of which 2a's budget listed.

**Criterion amended, in both places.** The `sha256 per installed file` clause was struck from 2a's criterion 1, and the same clause in slice 1's criterion 3 is superseded by what slice 1 actually shipped: records carry paths, and classification compares rendered bytes with the bundle. The plan's verification section already claimed "criterion 3's per-file hash is genuinely new" — it never became true, and `drifted` has meant "differs from what we would write" since slice 1's live verification. Not implemented, not planned, and now not claimed.

**Not yet done.** 2b (the review family moves here; FLOW's copies deleted) and 2c (per-target field support and the missing-renderer report) have **no go**, and 2b now has a prerequisite gap to close: `code-review` declares only `slash` installs, so its declared helper has no directory to travel into. If 2c runs first it decides which frontmatter fields the review must carry per harness — including whether claude-code takes the review as a skill (`auto`, which has a directory for the helper) rather than a command. Both slices still carry the two-copy window for `review-range.mjs` opened here.

The parallel `pi-extensions` audit (plan 0017 step 1: all 13 tool-declaring packages, zero production code) was started from this session in the background; its result is reported separately and is not part of this repository's state.

### Slice-2a sign-off — 2026-10-07

The developer committed slice 2a (`7e65d1a`), pushed it, and signed it off. As with slice 1, the plan **stays in `docs/plans/`** rather than `completed/`: the same document carries 2b, 2c and slice 3, and moving it would claim the program is done. It moves when the program does.

Two consequences recorded for the next session: the sibling declaration for `code-review` has **no install that can carry it** (its declared modes are `slash` only), which is a decision 2c makes rather than a defect; and the `review-range.mjs` **two-copy window stays open** until 2b deletes FLOW's copy and its test.

### Planning session — slice 3 inventory — 2026-10-07

The developer asked whether the plan says how the remaining instruction content moves here, and whether the other harnesses are missing anything pi has. Both answered in a new *Slice 3 — one place for instructions, one place per harness for extensions* section: the placement rule extended to every artifact kind, the measured per-package inventory of `pi-extensions` (`flow` is the only content-bearing package: 31 skills, 15 agents; the other fifteen are runtime), the verified-versus-unverified split on harness parity, and a six-step order (3a agents → 3f prompts) with what this repository must gain before each. Nothing was moved, nothing was authorized, and no file outside this plan was touched. The parity check is named as work rather than asserted: today's fetches cover the *capabilities* the peer harnesses ship, not whether each `pi-*` package is a parity shim or a unique capability.

### Implementation session — slice 2c — 2026-10-07 (Review log)

The developer said go on 2c after the slice-3 inventory session, and answered the one design question 2c carried: the capability report reads **two** declarations — a field present in the skill's own frontmatter warns, a `requires` entry in `skillset.config.json` errors. Built tests-first; criteria as built, the measured overrun, and the falsification run are recorded in the *Implementation session — slice 2c*, *Measured against 2c* and *Slice-2c status — 2026-10-07* entries above, so this entry is the pointer rather than a second copy. Gates: `npm run build`, `npm test` (25 files / 241 tests), `npx biome check src test` — all clean. Nothing committed; the message is drafted for the developer to run. Two findings were recorded rather than fixed: the copilot target writes `mode:` where VS Code now documents `agent:`, and opencode's installed binary cannot launch on this machine (`invalid signature`), which is why its half of AC-5 rests on its docs plus path agreement rather than on its own discovery.

## Handoff — prompt for the next session

Paste this into a skillset session to continue. It assumes nothing that is not written above.

> Continue the skillset instruction-ownership program. Read `docs/plans/0023-skillset-owns-instructions.md` in full first — it is the spec, and its slice-2 sections carry the decisions, budgets and evidence you need. Do not re-derive anything marked verified; it was checked by execution and the transcripts are in the plan. Read *Slice-2a sign-off*, *Implementation session — slice 2a* and *Measured against 2a* before touching anything: they carry the criteria as built, the measured overrun, and the three mistakes that session made first.
>
> **State.** Slice 1 (`880fdfe`) and slice 2a (`7e65d1a`) are implemented, committed, pushed and signed off. The plan stays in `docs/plans/` until the program finishes. 2a landed: declared `siblings.<skill>` payload files, copied verbatim beside `SKILL.md`, recorded per relative path, classified through the six existing statuses, removed on uninstall — plus `src/skills/code-review/_helpers/review-range.mjs` (443 lines incl. the normalised docstring) proven to run from the installed location. FLOW still keeps its copy **and its 227-line test**, so a two-copy window is open until 2b. **Slice 2c is implemented and measured but not committed** (see *Implementation session — slice 2c*, *Measured against 2c*, *Slice-2c status*): every target declares the frontmatter it can carry (`TargetFrontmatter`, per mode) and the native commands it must not shadow; `install` and `sync` report every declared field a target cannot express, naming the field and the consequence; a `requires` entry with no renderer is an error that writes nothing (sync exits 2 before its first write); the `sk-` slug rule is now checked against each target's recorded built-ins; and `SKILLSET_CONFIG=<path>` is the seam the end-to-end tests use. Gates were clean — 25 files / 241 tests, biome clean. Slice 3 has an inventory section but stays parked.
>
> **Go state.** 2b has **no go** — ask before building it. 2c is built; if the developer wants it committed, the message is drafted and they run it. 2b's prerequisite gap is smaller now but not closed: the matrix says which fields the review can carry per harness, so the remaining decision is whether claude-code takes the review as a **skill** (`auto`, which has a directory for `_helpers/review-range.mjs`) or a **command** (`slash`, which has none) — and `code-review` still declares only `slash` installs on pi and claude-code, so every `sync` run reports its declared helper on stderr (a CLI test pins that note).
>
> **Verification lesson for 2b.** AC-5 was proved by execution on the claude-code side (its own loader logged `project: 1` with our artifact and `project: 0` without it; authentication failed, so no model call happened and the log is the loader's). The opencode side **could not be** proved: its installed arm64 binary is `invalid signature` and is SIGKILLed on every invocation, so reinstall it before trusting anything about opencode's discovery. Copilot CLI is installed nowhere on this machine and stays doc-level; this target writes `mode: agent` into `.github/prompts/*.prompt.md` where VS Code's current reference documents `agent:`.
>
> **Rules that are not negotiable.** Gates: `npm run build` *before* `npm test` (tests spawn `dist/cli.js`), then `npx biome check src test`. Commit messages are drafted, never run, and carry no trailers of any kind. Never hand-write into `~/.pi/agent/**`, `~/.claude/**`, `~/.config/opencode/**` or an installed copy — change the source and run `skillset sync`. Never re-introduce a raw-bundle render: every write and comparison path renders through `applyConfigToSkill`. A copied sibling is foreign-runtime code like `assets/`: excluded from `biome` and `tsc` (`src/skills/**/_helpers/**`) and never reformatted — the 2a session lost a round to `biome check --write` rewriting the payload. Keep the plan's acceptance criteria and budget current as you go, and report honestly, including failures.
>
> **Parallel workstream (separate session, `pi-extensions`) — step 1 done, step 2 not authorised.** `docs/plans/0017-context-economy-load-on-demand.md` now carries `## Step 1 — measured 2026-10-07`: 1,483 estTokens across the 13 tool-declaring packages against the 1,412 baseline from 2026-09-30, every surface classified `every-session`/`per-turn`/`on-demand`, 27 activation claims checked (8 Falsified, 4 Weakened, 1 Unverified), and a step-2 budget F1-F8. Two verified facts to carry forward: the `pi-subagents` pin is **not hermetic** — it renders `~/.pi/agent/agents` into its own tool schema, so with an empty `HOME` the test fails (2389 → 2146 schema bytes, ≈243 bytes of it FLOW's 15 agent descriptions) — and ≈234 estTokens/request of per-turn surface is pinned by nothing (`flow-args/args.ts:468` 170t, `flow-workflow/docs-protocol.ts:92` 64t, both packages pinning `estTokens: 0`). F1/F2 remove that per-turn cost, F5 up to ≈295 t/session, F6 repairs 10 stale or falsified claims, F7/F8 are the two confirmed defects (`isolated: true` inert on 14 agent files; `BUNDLED_SKILL_NAMES`'s docstring naming a consumer that does not exist). Nothing there is authorised yet — ask.
