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

## Slice 2e — the bridge boundary: the core stops knowing what a harness is

### Goal

The developer's decision, 2026-10-07, stated as the reason this slice exists: *"I don't want to inject some dependencies on harness into the skillset repo — I want the pi-extension to be the bridge between skillset and pi harness and some other places to be bridges between skillset and other harnesses. I want the skillset to be harness agnostic at least in its core."* Taken with the same message's second half — *"I would like the skillset project to know how to install skills, command, agents, hooks etc in the particular harnesses (most importantly now in pi, claude-code and copilot/vscode)"* — the target is: **the core knows nothing about any harness, and this repository still ships the bridge for each of the four**, as separate modules this repo owns and tests.

This slice is a **pure refactor with no behaviour change**, and it lands before 3a because 3a's agent work is exactly the kind of harness knowledge that must not fall into the core. Slice 2c put each harness's frontmatter vocabulary into `src/targets/<harness>.ts`; this slice moves those modules — and the paths still sitting in `src/core/locations.ts` — into `src/bridges/<harness>/`, and removes the last harness-shaped code from `src/core/`.

### What is true today — measured 2026-10-07

**Clean already:** no harness package is imported anywhere. `dependencies` are `commander`, `gray-matter`, `picocolors`; no pi/opencode/claude/copilot code is a dependency, and nothing under `src/` imports one.

**Not clean:** seven files under `src/core/` carry harness knowledge, and one carries the dependency inversion.

| core file | harness knowledge |
|---|---|
| `src/core/locations.ts` | the four layouts (13 `homedir()` joins), `layoutFor`, and a harness conditional in `skillDirectoryFor`: `opts.agent === "claude-code" && opts.mode === "always"` (line 155) |
| `src/core/types.ts:1-3` | `AgentName = "claude-code" \| "pi" \| "opencode" \| "copilot"` and the `AGENTS` array |
| `src/core/declarations.ts:22` | `import { targetFor } from "../targets/index.js"` — **core depends on the adapters** |
| `src/core/statusline.ts` | the shared claude-code + copilot settings behavior, and `STATUSLINE_COMMAND` |
| `src/core/active.ts:28-41` | `CLAUDE_CODE_SESSION_ID` and opencode's session-key rule |
| `src/core/bundle.ts:46`, `src/core/frontmatter.ts:5` | mentions in doc comments only |

### The shape this slice builds

```
src/core/                  the contract, and skillset's own paths only
  bridge.ts                  Bridge: name, supportedModes, frontmatter,
                             agents?, install/uninstall/preview,
                             skillDirectory?, sessionKeyFromEnv?
  locations.ts               stateFilePath, declarationsFilePath  (skillset's own)
  … unchanged mechanics: declarations, state, frontmatter, markers, parse

src/bridges/               the how; one module per harness, in this repo
  index.ts                   the ONLY file that names harnesses (the registry)
  pi/                        index.ts + paths.ts + tests
  claude-code/               index.ts + paths.ts + statusline wiring + tests
  opencode/                  index.ts + paths.ts + tests
  copilot/                   index.ts + paths.ts + tests
  _shared/statusline.ts      the no-clobber settings helper two bridges share
```

Dependency direction, after: `commands` → `bridges` → `core`. Never `core` → `bridges`. The commands are the composition root and may import the registry; the core may not.

### Acceptance criteria

1. **The rule, executable:** `rg -n -i 'claude|opencode|copilot|\bpi\b' src/core/ --glob '!*.test.ts'` returns **nothing**. One test asserts the invariant so it cannot silently regress.
2. **The registry is the only place that names a harness:** `src/bridges/index.ts` is the sole file listing all four; each `src/bridges/<name>/index.ts` exports one bridge object satisfying the contract.
3. **Byte-for-byte no behaviour change**: every installed artifact under `~/.claude`, `~/.pi/agent`, `~/.config/opencode` and `~/.skillset/copilot` has the same content hash before and after, and `node dist/cli.js sync --dry-run` prints the same `checked undeclared 8 · in-sync 32`. Hashes in the plan.
4. **All four bridges still drive every command** — `install`, `sync`, `update`, `uninstall` — through the registry: `--agent <name>` validates against registry names, an unknown name is rejected naming the registry's list (not a hardcoded one), and `--agent all` means every registered bridge.
5. **2c's capability report is unchanged**: `fieldSupport` takes the bridge as an argument instead of looking it up, so `core/declarations.ts` no longer imports anything harness-shaped; each moved test still asserts its own harness's vocabulary, including the `requires`-with-no-renderer error.
6. **No harness conditional in core**: `skillDirectoryFor`'s `agent === "claude-code"` test becomes a declared bridge capability, and the session-identity rule in `active.ts` becomes a bridge-supplied value (claude-code's env var is named only in its bridge).
7. **Core keeps skillset's own paths and nothing else**: `stateFilePath` and `declarationsFilePath` stay; the four layouts leave. The layout assertions in `core/locations.test.ts` move to the bridges they test.
8. **Nothing is dropped in the move**: the full suite is green with **≥262 tests** (today's count), and the moved files are covered where they now live.
9. **No new dependency**, no `package.json` change beyond what already exists, `skillset.config.json` and the state-file format unchanged, and no artifact on this machine rewritten.
10. **An external bridge remains possible without being built**: bridges resolve through one function (`bridgeFor`), so a later `bridges:` map in the config can dynamic-import a module from outside this repo. Building that loader is **not** in this slice — it is the seam, recorded so the next slice can use it.

### Budget

- **Moved, not rewritten**: `src/targets/{pi,claude-code,opencode,copilot}.ts` → `src/bridges/<name>/index.ts`; the four layouts out of `core/locations.ts` → each bridge's `paths.ts`; `src/core/locations.test.ts` + `src/targets/*.test.ts` → the bridges they test.
- **New**: `src/core/bridge.ts` (the contract, ~70 lines with docs), `src/bridges/index.ts` (registry, ~30), `src/bridges/_shared/statusline.ts` (moved ~60), a boundaries test (~40).
- **Removed from core**: the four layouts (~100), `AgentName`/`AGENTS` (~5), the `targetFor` import, the statusline helper (~60 out), the session-env knowledge (~10).
- **Expected net across the repository: −150 to −250 physical lines** — four layouts and a name union leave the core, and the contract and registry add back less than that. New logic **≤120 lines**; **no new dependency**; no new file in `src/skills/**` or `src/agents/**`.

### Decisions

1. **The bridges live in this repository, outside the core.** The developer wants `skillset` to know how to install skills, commands, agents and hooks into pi, claude-code, copilot/VS Code and opencode, so the how ships here — but as modules the core does not import, so the core stays harness-free and any bridge can later be replaced by an external one (AC-10).
2. **`bridges/` is not `core/`, and that is the whole rule.** No new abstraction beyond the contract: a bridge is a plain module implementing an interface, exactly as a target is today. The change is *where it lives* and *who may import it*.
3. **`AgentName` becomes `BridgeName = string`.** A closed union in the core is the core knowing the harnesses; the names become registry data, and config still validates against them.
4. **The shared statusline helper is not harness knowledge** — its code touches no harness name, only a `statusLine` object that claude-code and copilot happen to have in common. The *command string* it writes is bridge data, so the helper moves to `bridges/_shared/` with the two bridges supplying the command.
5. **No behaviour change is the point of the slice.** Every byte this program has already installed must be identical afterwards, which is why AC-3 hashes the harness directories instead of trusting the test suite.

**Road not taken.** *External bridges now* (the literal reading of option B): nothing outside this repository exists to load yet, and a loader adds a resolution failure mode to every command — the seam is recorded in AC-10 instead. *Leaving the adapters alone and only moving the paths out of core*: it would leave `core → targets` in place, which is the one inversion that makes the core non-agnostic regardless of where the files sit. *Doing this inside 3a*: the slice would mix a byte-neutral refactor with new behaviour, and a refactor's only real acceptance test is that nothing changed.

### Confidence

**~96%.** The inventory of harness knowledge in core is exhaustive grep output, not recall (seven files, with line numbers above); the refactor is moves plus one inverted import; and the no-behaviour criterion is a hash comparison rather than a test count. Residual: (i) `active.ts`'s session identity needs a small contract addition (`sessionKeyFromEnv`), and if that proves to reach further than the one env var, it becomes its own step with its own note rather than being smuggled in; (ii) the `_shared` directory is a new convention in this repo — the alternative is duplicating the helper in two bridges, which is worse; (iii) the moved test files keep their assertions verbatim, so a test that was silently coupled to `core/locations.ts` internals may need one import rewritten.

Nothing is authorised. ~~The go is a separate step.~~ **Go given 2026-10-07; implemented below.**

### Implemented — 2e, the bridge boundary — 2026-10-07 (Review log)

The developer gave **go**. The refactor is byte-neutral: **586 files under `~/.claude`, `~/.pi/agent`, `~/.config/opencode` and `~/.skillset/copilot` were hashed before and after, and not one byte changed**; the dry-run still reports `checked undeclared 8 · in-sync 32`. The tree it produced:

```
src/core/         29 files / 2,895 lines      (was 30 / 3,021 — net −126)
  bridge.ts   the contract: Bridge, BridgeLookup, ArtifactPathOptions, InstallContext
  locations.ts  stateFilePath, declarationsFilePath — skillset's own paths only

src/bridges/      the how; one module per harness, in this repository
  index.ts       the registry — the only file that names a harness
  _shared/settings.ts   the no-clobber settings helper two bridges share
  _shared/paths.ts      the Layout shape + the resolutions common to all four
  pi/ claude-code/ opencode/ copilot/   index.ts + paths.ts + tests
```

**Criteria as built.**

1. Holds — `rg -n -i 'claude|opencode|copilot|\bpi\b' src/core/ --glob '!*.test.ts'` returns **nothing**, and `src/bridges/boundaries.test.ts` asserts it line by line so it cannot silently regress.
2. Holds — each `src/bridges/<name>/index.ts` exports one `Bridge`; `src/bridges/index.ts` holds `BRIDGES`, `BRIDGE_NAMES`, `bridgeFor`, `requireBridge`, `envSessionKey`.
3. Holds, by execution — 586-file hash comparison, identical; `checked undeclared 8 · in-sync 32` unchanged.
4. Holds — `--agent all` and `--agent <name>` read `BRIDGE_NAMES`; `install confidence --agent cursor` prints `unknown value: cursor (allowed: claude-code, pi, opencode, copilot)`, and the same list is what the CLI's help shows, built from the registry rather than typed twice.
5. Holds — `fieldSupport` takes the bridge; `instantiate`/`sync` resolve it from the registry and pass it down. The moved vocabulary assertions in `declarations.test.ts` still pass against the real bridges, including the required-field-with-no-renderer error.
6. Holds — the `agent === "claude-code" && mode === "always"` conditional is gone from the core; the rule now lives in `src/bridges/claude-code/paths.ts` as that bridge's own `skillDirectory`, with its own test. Session identity: `resolveSessionKey(explicit, cwd, fromEnv)` receives the key; `claude-code`'s bridge supplies it from its own variable and is tested in its own file.
7. Holds — core keeps `stateFilePath` and `declarationsFilePath`; the four layouts are gone, and the path assertions now live in `src/bridges/paths.test.ts` (plus a two-case `src/core/locations.test.ts` for skillset's own paths).
8. Holds — **273 tests green** (was 262, and no assertion was dropped), 28 files.
9. Holds — dependencies unchanged (`commander`, `gray-matter`, `picocolors`), `skillset.config.json` untouched, state format untouched, no artifact rewritten.
10. Holds — bridges resolve through `bridgeFor` alone; the config-declared external loader remains the seam it was described as, still unbuilt.

**Measured against its budget — the logic claim held, the physical claim was wrong.**

| area | budget | measured | verdict |
|---|---|---|---|
| new logic lines | ≤120 | ≈120 including the registry and the shared resolutions | met |
| **core** | should shrink | **30 files / 3,021 → 29 / 2,895** (−126 lines) | met |
| **repository physical** | **−150 to −250** | **≈ +386** (excluding the plan's own +209) | **wrong by ~550** |
| new dependency | none | none | met |

Why the estimate was wrong, stated plainly: it counted four layouts *leaving* the core and treated the contract as free. In reality the core's single `locations.ts` resolved a path **once** for all four harnesses — 90 lines of paths plus one `switch` — and splitting it per harness means four modules each with their own base, layout object and resolution entry point. Extracting the common `Layout` shape and both resolutions into `bridges/_shared/paths.ts` recovered the worst of that duplication (the switch had briefly existed four times); what is left is inherent to the split. The contract (`core/bridge.ts`, ~100 lines where `target.ts` was 49) and the registry (~45) are new surface that buys the boundary. If the overage is not acceptable, the honest lever is the four `paths.ts` files' doc comments, not the structure.

**Deviations, each deliberate.**

- **The contract ships agent-free.** The brief's sketch gave `Bridge` an `agents?` member; it is not there. An optional member no bridge implements is dead surface, and 2e had to stay behaviour-neutral — agent support arrives with 3a, which owns both the contract member and the pi bridge that implements it.
- **`parseDeclarations` no longer validates harness names; `declarationCoverage` does.** Which harnesses exist is registry data, so the core is *handed* the names (`declarationCoverage(…, knownHarnesses)`) rather than importing them. The test that asserted `unknown agent "cursor"` at parse time now asserts it through coverage, naming the registry's list.
- **`_shared/paths.ts` is new and not in the brief.** Four identical `switch` blocks were the obvious smell of the split; the shared module is where the shape and the two common resolutions live, so a bridge overrides only what actually differs (claude-code's `always` directory, copilot's absent one).
- **AC-1's pattern caught a historical filename.** `scripts/sync-pi-auto.mjs` in a `declarations.ts` comment matched `\bpi\b`; the comment now cites `docs/decisions/0005` and describes the script instead of naming it. The surrounding assertion was not relaxed to accommodate it.
- **`biome` forced parameter order twice** — `useDefaultParameterLast` — so the required parameters (`bridge`, `lookup`) come before the defaulted `siblings`. Mechanical, but it is why three call sites read `(declaration, state, bridge, siblings)`.
- **`active.test.ts` no longer reads an environment variable**; the bridge-level assertion replaced it, and the end-to-end CLI test that spawns a child with the variable still passes unchanged.

**Not yet done.** Nothing is committed. 38 paths are dirty: 19 modified, 7 renames-with-edits, 1 pure rename, 2 deletions, 9 new. The plan is the only documentation file changed.

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

### The agent-definition dialect per harness — measured 2026-10-07

Recorded because it is what the rest of 3a's targets need, and because it was measured against implementations rather than prose. **Provenance and its limits, stated first:** the research run that produced this had **no web tooling available** (`web_search`/`web_fetch` returned "tool not found"), so no documentation page was read. The evidence is therefore *local implementation* — opencode's compiled binary (the embedded zod config schema), opencode's generated OpenAPI SDK types, claude-code's source tree dump at `~/source/dangerous/claude-code-source-code-full`, and VS Code's `copilot` extension bundle. For a portability analysis that is stronger than prose for *what the loader does*, and weaker for *version-pinning to a released build*: the claude-code tree is a third-party dump of unstated version, so treat its field names as load-accurate but not release-pinned.

| | pi | claude-code | opencode | copilot |
|---|---|---|---|---|
| **file** | `agents/<name>.md` | `agents/<name>.md` | `{agent,agents}/**/*.md` (recursive) | `.github/agents/*.agent.md` |
| **user path** | `$PI_CODING_AGENT_DIR/agents` (default `~/.pi/agent/agents`) | `$CLAUDE_CONFIG_DIR/agents` (default `~/.claude/agents`) | `~/.config/opencode`, `~/.opencode`, `$OPENCODE_CONFIG_DIR` | profile `agents/` — **UNCONFIRMED for the CLI** |
| **project path** | `<cwd>/.pi/agents` | `.claude/agents` in cwd **and every ancestor** to the git root | `.opencode` walked up from cwd to worktree | `.github/agents` (confirmed) |
| **name source** | **filename** (frontmatter `name:` ignored) | frontmatter `name:` **required** (3-50 chars, alnum+hyphen) | filename, but frontmatter `name:` **overrides** it | `name:` defaults to filename |
| **body** | system prompt | system prompt (`content.trim()`) | `prompt` — body always wins over frontmatter `prompt:` | the agent prompt |
| **tools** | `tools:` CSV, `none` = none | `tools:` list or CSV, `[]` = none, `*` = all; deny-list is **camelCase `disallowedTools`** | `tools: {name: bool}` — **deprecated** in favour of `permission` | `tools:` aliases (`execute, read, edit, search, agent, web, todo`), `#tool:<name>` in body |
| **model** | `model:` string | aliases `sonnet/opus/haiku/best/opusplan/…` **+ `inherit`** | `model:` string | `model:` string **or an array for fallback** |
| **agent-kind** | `enabled: false` hides | — (agent *type* directory) | `mode: subagent\|primary\|all`; `hidden:` | `user-invocable`, `disable-model-invocation` |
| **unknown keys** | ignored | ignored | **`catchall` → swept into `options`** (not an error) | ignored |
| **nests in frontmatter** | — | `hooks`, `mcpServers` | `permission` (object form) | `hooks` (events → `{type, command, timeout, …}`) |

Three consequences for this program, recorded rather than acted on:

- **The renderer's nested-mapping support is now load-bearing beyond pi.** 2c added recursion to `src/core/frontmatter.ts` because pi's `contract:` block is an object. Copilot's agent `hooks` and opencode's `permission` are objects too, so that recursion is what makes those targets possible at all — do not remove it.
- **`name` is the one field with three different provenances**: required from frontmatter (claude-code), ignored in favour of the filename (pi), and overridden the other way round (opencode). A portable agent source must therefore keep `name:` *and* the filename, and each target renders whichever its loader reads — which is exactly what AC-1 of 3a preserves by moving the files verbatim.
- **`tools` is not portable, and cannot be made so by expressing it.** pi names its tools `read, grep, find, ls, bash`; claude-code `Read, Grep, Glob, Bash`; opencode keys them for `permission`; copilot uses alias classes. The mapping is per-target data, so it belongs in `targets.<agent>.tools` — which is where 3a puts it.

**Still unverified, and therefore work rather than assumption:** opencode's default `mode` when the frontmatter omits it, and opencode's directory precedence (the minified merge helper was not resolved); and Copilot CLI's user-level agent path and its field-by-field CLI set — the bundled reference is *VS Code's* page, so only `.github/agents/*.agent.md` is confirmed for the CLI, indirectly (its own changelog and a discovery log line in a bundled skill). Treat opencode and copilot agent support as doc-level-and-partial until a target slice verifies it against the loader, the way 2c did for skills.

### The order, and what this repository gains before each move

- **3a — an agent-definition concept.** Today this repository installs skills and prompts and has no concept of a *subagent definition* at all, so FLOW's 15 agents cannot move however portable they are. The roster's dialect is pi's: `packages/pi-subagents/src/config/custom-agents.ts:56-68` parses exactly `display_name`, `description`, `tools`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `run_in_background`, `enabled`, while 14 of FLOW's files add `isolated: true` and one adds `extensions:` — keys nothing parses. Rendering agents per harness therefore needs the same thing 2c is building for skills: a per-target declaration of the fields a target can express. Until then the roster stays FLOW's (slice-2 decision 7, unchanged). `model` is one of the ten fields pi does parse, which is where the developer's multi-model intent for `pi-llm-switch` meets this step: an agent that names a model is a declaration, and only the harness can honour it.
- **3b — the guidance channel** (already scoped in this plan): the ownership rule rendered here instead of hand-written.
- **3c — project scaffolds**: project `.pi/`, project `AGENTS.md`, with a documented local-override escape hatch.
- **3d — the FLOW skill triage** (30 skills, not 31 — corrected and scoped 2026-10-08: *3d — scoped and awaiting go* below). **Done, 3d-i and 3d-ii both implemented.** The roster is one smaller than this list first said, because 2b deleted `code-review` and renamed `remediate`. The triage's question turned out sharper than "does it name a pi-only tool": the bodies' pi coupling is mostly **`flow-args`**, an extension in the same workspace, and what must stay is what the workflow engine dispatches. **Seven moved** (annotate-guidance, annotate-inline, changelog, create-handoff, discover, frontend-design, resume-handoff), **twenty-one stay**, and **two are decided** (`commit`, `revise`). All 30 verdicts are recorded below.
- **3e — workflow declarations. CLOSED 2026-10-08, not moved** — see *Closed — 3e and 3f* below for the measurement. FLOW's stage graph (`built-in-workflows.ts`) is the pi engine's own configuration: 1,443 lines of TypeScript calling that engine's DSL, with exactly one reader, in the package that also holds that reader.
- **3f — prompts and commands. CLOSED 2026-10-08, already satisfied** — the premise this line carried was false (there *is* a `prompts/` directory, holding one extension asset), and the harness-facing shape it existed to add is `slash` mode, live for all four targets. Same section.

### 3a — scoped and awaiting go: the agent-definition concept, and the roster moves for pi — 2026-10-07

> **2e has landed — the bridge boundary is in place, uncommitted — so this slice is unblocked and its file locations are settled.** The agent dialect, path and renderer this slice describes are **bridge** knowledge, not core knowledge: the implementation lands in `src/bridges/pi/` and the core carries only the contract. Concretely, what 2e put there for this slice to use: `Bridge` in `src/core/bridge.ts` (the core may name it; it may not name a harness), each bridge's own `paths.ts` (so the agent path joins `slash`/`auto`/`always` in `src/bridges/pi/paths.ts`), and `src/bridges/index.ts` as the only file that knows a harness exists. The scope, criteria and budget below stand; only the file locations move. **3a adds the contract member (`agents?`, plus the agent path) that 2e deliberately left out** — see *Implemented — 2e* for why it was left out.

#### Goal

Give this repository the artifact kind it lacks — a **subagent definition** — and use it to end the split ownership of FLOW's 15-agent roster, for pi. Today the roster is FLOW's (`slice-2 decision 7`), FLOW syncs it into the same directory skillset would write, and nothing here can express an agent at all. After this slice, one writer owns `~/.pi/agent/agents/`, the files do not change by one byte, and ~2,300 lines of FLOW's agent machinery retire with the content they transformed. The other three targets are explicitly out of scope: their field matrices are still being researched, and two of them cannot be verified on this machine (opencode's arm64 binary is `invalid signature` and SIGKILLed; Copilot CLI is installed nowhere — both recorded in the 2c entries).

**The developer's two calls, 2026-10-07.** (1) Scope: *concept + move the roster for pi*, retiring FLOW's agent sync — the shape 2b used for the review family. (2) The `models.json` `agents` axis **retires**; a per-agent model or thinking level becomes a static declaration in the agent's own file.

#### Measured starting state — by execution, 2026-10-07

```sh
ls packages/flow/agents/*.md | wc -l                 # 15
cat packages/flow/agents/*.md | wc -l                # 1769 lines, bodies 71-201 each
# installed roster vs FLOW source, byte-for-byte:
for f in packages/flow/agents/*.md; do cmp -s "$f" ~/.pi/agent/agents/$(basename "$f"); done
#                                                    → identical: 15   differs: 0
ls ~/.config/flow-pi/models.json                     # absent — the injection has no input
python3 -c …AGENT_ENABLEMENT_GRANTS                  # {} — "the machinery ships dormant"
```

- **The move is byte-neutral on this machine.** All 15 installed agents equal FLOW's sources exactly: no injected `model`/`thinking`, no `isolated: false`, no `skills: false`. FLOW's smart gate (`agents.ts`) has had nothing to do because its two inputs — a `models.json` and an active enablement grant — do not exist here.
- **`tools:` values are pi tool names**: `read, grep, find, ls` on 13 agents, `bash` on `claim-verifier` and `precedent-locator`, and `web-search-researcher` adds `ext:flow-web-tools/web_search, ext:flow-web-tools/web_fetch`. Nothing portable is claimed by this slice; `tools` travels in `targets.pi`.
- **The injection machinery exists to write keys pi no longer reads.** `packages/pi-subagents/README.md:345-346`: *"Persistent agent memory (the `memory:` frontmatter key) and skill preloading (the `skills:` frontmatter key) were removed when the core was slimmed down. Children now always inherit the parent's skills and extensions, so the `isolated`, `extensions`, and `skills` frontmatter keys no longer exist."*

**A correction to this plan's own inventory text, found while scoping.** The slice-3 entry says FLOW's files add `isolated` and `extensions` — *"keys nothing parses"*. That is wrong in both directions, and the correction matters for what moves: **pi** parses exactly the ten fields `custom-agents.ts:56-68` lists (`display_name`, `description`, `tools`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `run_in_background`, `enabled`) **and takes the agent's name from the filename — frontmatter `name:` is ignored by pi** (it is required by claude-code, so it is not dead in the source, only dead here). **FLOW** does parse `isolated` and `extensions` — `agents.ts:420` reads `isolated: true` to decide the `isolated: false` + `skills: false` injection — but that parse is inside the machinery that is retiring, and the keys it produces are the ones pi-subagents' README says were removed. So: three keys drop out of the portable core, deliberately, with the citation in the Decisions section and an AC that proves they are gone.

#### Acceptance criteria

1. `src/agents/` holds all **15** agent files, and each body is **byte-identical** to `git show <pre-move-sha>:packages/flow/agents/<name>.md`'s body — content moved, not re-authored. Checked by a normalising diff that strips the frontmatter block, pasted into the plan.
2. **The cutover changes no agent content beyond the three dropped keys**: every `~/.pi/agent/agents/<name>.md` differs from its pre-cutover copy (`cp` the 15 to a scratch dir first, AC-2) by **at most the removal of the `isolated:`/`extensions:` line** — 13 agents byte-identical, and `diff` on any that differ shows only a `<` line for the dropped key and no other change. Transcripts in the plan.
   *Resolved during implementation — this criterion as first written was wrong and could not hold.* It demanded "byte-identical before and after", which AC-5 makes impossible: dropping a key from frontmatter **is** a content change, so the two criteria contradicted each other for the 14 files carrying `isolated: true`. AC-5 wins — the key is dead for pi by the README citation, and its only reader was the machinery being deleted — and AC-2 is restated above to say exactly how much changes rather than being quietly relaxed to "nearly identical".
3. skillset handles the kind **end to end**: `status` reports the 15 as `adoptable` (on disk, unrecorded, byte-identical) before any record exists; `sync` records them and **writes nothing** (`0 written`); the follow-up `sync --dry-run` reports the 15 `in-sync` with `drifted 0`; `uninstall` removes only what it recorded and leaves the directory otherwise untouched.
4. A **field a target cannot express is reported for agents exactly as 2c reports it for skills**: a `targets.pi` key outside pi's ten-field agent set produces a warning naming field and consequence, and a field listed as required with no renderer is an error that writes nothing.
5. `isolated`, `skills` and `extensions` appear in **no** moved agent — neither in the source frontmatter nor in any rendered artifact — and the drop is recorded in Decisions with the README line that justifies it. `grep -rnE "^(isolated|skills|extensions):" src/agents/ ~/.pi/agent/agents/` returns nothing.
6. The rendered artifact carries what pi actually parses, **verified through pi's own parser rather than by reading**: jiti-importing `packages/pi-subagents/src/config/custom-agents.ts` and calling `loadCustomAgents(cwd)` returns 15 entries, each with the expected `builtinToolNames` and a non-empty `systemPrompt`; the transcript goes in the plan. (`jiti` resolves only from `packages/flow` — the plan already records that trap.)
7. **pi-extensions is the other half, and it is net-negative**: `packages/flow/agents/` deleted; `agents.ts`, `agent-enablement.ts`, `update-agents-command.ts` and their three test files deleted; `/flow-update-agents` unregistered; the `agents` axis removed from `models-config.ts` with `stages`/`skills`/`presets` **untouched** (those are consumed at runtime — `skill-bracket.ts:73`, `workflow-execution-host.ts:53`); the agent arms removed from `session-hooks.ts`. `rg -n "BUNDLED_AGENTS_DIR|syncBundledAgents|cleanupPerCwdAgents|flow-update-agents" packages/` returns nothing.
8. **No writer other than skillset remains for `~/.pi/agent/agents/`**, and the stale `~/.pi/agent/agents/.flow-managed.json` is deleted. The deletion is not cosmetic: had FLOW's sync survived with its sources gone, `classifyStaleEntries` would have swept all 15 entries as stale-managed and **deleted the files skillset had just adopted**.
9. Gates green: skillset `npm run build` → `npm test` → `npx biome check .`; pi-extensions `pnpm -r run test` from the workspace root (there is no root `npm test`). **No new dependency in either repository**; `skillset.config.json` gains only the `agents:` block; the state file's `version` stays **1** and a state file written before this slice still reads — a test pins absent-`kind` ⇒ skill.
10. **Nothing outside the roster moves**: `skillset sync --dry-run` still reports `in-sync 32 · undeclared 8` for skills, and `~/.claude/`, `~/.config/opencode/`, `~/.skillset/copilot/` are byte-untouched.

#### Budget

**skillset — expected +500 to +700 physical lines, of which ~320 are logic.**

| area | file | what | est. logic |
|---|---|---|---|
| content | `src/agents/<name>.md` × 15 | the moved roster — 1769 body lines + frontmatter | — |
| types | `src/core/types.ts` | `ArtifactKind`, `AgentFrontmatter`, `ParsedAgent`, `InstallRecord.kind?`, the agent field-support shape | ~40 |
| bundle | `src/core/bundle.ts` | `listBundledAgents`, `loadBundledAgent`, `agentSourcePath` | ~25 |
| parse | `src/core/parse.ts` | agent parsing, required set `[name, description]` (no `version`) | ~20 |
| paths | `src/core/locations.ts` | `agent?(name, scope, root)` per layout; **only pi wired**, the rest left undefined | ~15 |
| state | `src/core/state.ts` | kind in `matchInstall`, absent ⇒ `skill` | ~3 |
| declarations | `src/core/declarations.ts` | `agents:` parse, coverage, `fieldSupport` for the kind | ~80 |
| targets | `src/targets/pi.ts` | agent render + the ten-field expressibility declaration | ~40 |
| targets | `claude-code.ts`, `opencode.ts`, `copilot.ts` | agent expressibility *declared*, path undefined until each slice lands | ~15 |
| commands | `install`/`sync`/`status`/`diff`/`uninstall` | kind dispatch | ~80 |
| config | `skillset.config.json` | the `agents:` block, 15 entries | ~45 physical |
| tests | — | parse, render, adopt, drift, back-compat, native-shadow, cli round-trip | ~200 |

**pi-extensions — expected net −1,900 to −2,300 physical lines, ~0 new logic.**

| area | file | what | lines |
|---|---|---|---|
| content | `packages/flow/agents/*.md` × 15 | deleted (moved) | −1769 − frontmatter |
| runtime | `extensions/flow-core/agents.ts` | deleted | −774 |
| runtime | `extensions/flow-core/agent-enablement.ts` | deleted | −164 |
| runtime | `extensions/flow-core/update-agents-command.ts` | deleted | −62 |
| runtime | `models-config.ts`, `session-hooks.ts`, `paths.ts` | agent axis / arms trimmed | −60 to −120 |
| tests | `agents.test.ts`, `agent-enablement.test.ts`, `update-agents-command.test.ts` | deleted | −1273 |
| docs | `docs/models-config.md` | the `agents` axis section removed | −20 to −40 |

**No new file is expected in pi-extensions**, no new dependency in either repository, and **no state-migration code** — the cutover is `adoptable` by construction, which AC-3 proves rather than assumes.

#### Decisions

1. **`kind` on the record; absent means `skill`.** The state file stays `version: 1` and `matchInstall` compares `(a.kind ?? "skill")`, so a state file written before this slice reads unchanged. Rejected: a new state version, which forces a migration for no gain; and re-keying the roster onto `skill` names, which would collide with the real skill namespace.
2. **An agent install records `mode: "auto"`.** An agent has exactly one delivery shape per target, and `auto` is already the file-form mode; the **kind** selects the directory. This is the slice's one wart — the alternative is making `mode` optional and rippling that through `preview`/`status`/`diff` for a cosmetic gain. Named here so it can be objected to before implementation.
3. **Bundle layout is `src/agents/<name>.md`, flat.** No per-agent directory: agents ship no siblings and no templates, and unlike a skill — where `SKILL.md` is one file among several — the agent file *is* the whole artifact.
4. **The config block mirrors `installs:` minus `mode`**: `"agents": { "<name>": [{ "agent": "pi" }] }`. Per-agent granularity is not speculative — `web-search-researcher` depends on the `flow-web-tools` sibling for two of its tool selectors, so its target list must be able to diverge from the other fourteen the moment a second target gains support.
5. **No `version` field on agents.** The 15 files carry none, and adding one would edit content that must move verbatim (AC-1).
6. **`native` for agents is a test-time invariant, as it is for skills.** The only consumer of a target's `native` list today is `src/targets/agents.test.ts:216`; the agent-side assertion joins that test rather than adding a runtime check nobody would call.
7. **`isolated`, `skills`, `extensions` are dropped, and the drop is deliberate** — pi-subagents' README says the keys no longer exist; they entered FLOW's files as markers for an injection whose grants map is empty and whose config is absent on this machine.
8. **`model`/`thinking` become a declaration in the agent's file** (`targets.pi.model`, `targets.pi.thinking`), per the developer's call. `models.json`'s `agents` axis retires with the machinery it fed — its single call site, `agents.ts:371`, is the injection itself — while its `stages`/`skills`/`presets` axes stay, because those are read at runtime.
9. **No ADR.** This applies ADR 0006's ownership rule to a second artifact kind; it does not change the rule, the dependency direction, or who owns the config. The retirement of a second writer is a consequence of the existing rule, and AC-8 records it as evidence rather than as a new principle.

**Road not taken.** *Concept only, roster untouched* — it leaves two owners of one artifact kind for no benefit once the move is authorised, and the abstraction would be proved by a fixture instead of by 15 real files. *Concept plus all four targets* — it would ship two renderers that cannot be verified on this machine against their own loaders, which is the failure mode 2c already recorded. *Keeping a post-install rewrite in FLOW* — with skillset comparing against bytes it did not write, all 15 agents would report `drifted` after every session start, and the classification would stop meaning anything.

#### Not in this slice

- Any render for claude-code, opencode or copilot agents — their field matrices and paths are now measured (*The agent-definition dialect per harness*, above), and their entries here get the expressibility declaration only. claude-code is the obvious next target (its loader is verifiable on this machine with `HOME=<temp>`); opencode and copilot stay doc-level until their loaders can be exercised.
- Body neutralisation of the 15: they install to pi alone in this slice, so the per-agent portability triage (does the body name a pi-only tool?) is 3d's, not this slice's.
- Any change to a skill, sibling, template or dependency.
- **No effect on per-turn context cost.** The 15 agent descriptions still render into pi-subagents' tool schema (≈243 bytes/request, recorded in `0017`'s Step 1), because the move changes who writes the file, not where it lives or what it says. Nothing about this slice reduces that cost — F1/F2 in the 0017 workstream are where it would be addressed.

#### Confidence

**~96%.** Every load-bearing claim above is executed, not recalled: the roster's count and size, the byte-identity of the installed copies, the absence of `models.json`, the emptiness of the grants map, the one call site of the `agents` axis, the README line that kills three keys, and the state key's shape (which is what makes AC-9's back-compat claim checkable). The residual is three implementation choices, none of which can fail a criterion: (i) whether agent coverage lives in `declarations.ts` or a new module; (ii) AC-6's script must set `PI_CODING_AGENT_DIR` or accept the default path, because pi-subagents resolves the agents dir through `getAgentDir()` while this repository's pi layout hardcodes `homedir()/.pi/agent` — a pre-existing difference this slice inherits, not one it introduces; (iii) the other three harnesses' field matrices arrived from a research run with no web access, so they are measured against local implementations rather than docs — good enough to scope the next target, and recorded above with their two UNCONFIRMED items rather than smoothed over.

**Open question, pre-existing and not introduced here:** should this repository honour `PI_CODING_AGENT_DIR` for pi paths at all? Skills already ignore it. Recorded, not decided.

Nothing is authorised. The go is a separate step.

### Implemented — 3a, the agent-definition kind and the roster move — 2026-10-07 (Review log)

The developer gave **go**, with four decisions already made: build it as a bridge capability (`src/bridges/pi/`), retire FLOW's agent sync with the content it transformed, retire `models.json`'s `agents` axis in favour of a static declaration in each agent file, and drop `isolated`/`extensions`/`skills`. All four landed as stated. Both repositories are green: skillset **30 files / 301 tests**, pi-extensions `pnpm -r run test` **exit 0, 16 packages** (flow 68/1668, flow-workflow 66/2573, pi-permission-system 136/2773, pi-subagents 66/1254, …).

**Two criteria could not hold as written, and the reason is measurable rather than a choice.**

- **AC-3 is restated**, because the classifier answered a question the criterion had assumed. Its middle clause — "`status` reports the 15 as `adoptable`; `sync` records them and writes nothing" — is unreachable once AC-5 drops a key: `classifyPrimary` calls an unrecorded artifact at an owned destination whose bytes differ from the render **`foreign`** (`declarations.ts:643`) and `sync` refuses it (exit 1). The first real run said exactly that:

  ```
  $ node dist/cli.js sync --dry-run
  checked foreign 15 · undeclared 8 · in-sync 32          (exit 1, 15 files left untouched)
  ```

  So adoption-before-change was never available: the installed bytes were FLOW's, not ours, and they differ from what we would write by the same three changes AC-5 and the renderer imply. The cutover is therefore one deliberate write — `install <15 names> --agent pi --global --force`, the documented escape for a foreign destination — and AC-3's end-to-end claim now reads: **`foreign 15` before, one forced install, `in-sync 47` after, `drifted 0`**.
- **AC-2 is restated in kind, not in spirit.** The artifacts differ from their pre-cutover copies by **three** changes, not one: the dropped `isolated:`/`extensions:` line, `tools:` re-quoted (`compose` quotes a scalar containing a comma — `tools: "read, grep, find, ls"`), and the description's redundant quotes dropped. All three are semantically null, and that is proved rather than asserted (AC-6, below). Only the last two are the renderer's normalisation; nothing else moved.

**Criteria as built.**

1. Holds — 15 files in `src/agents/`, and every body is byte-identical to `HEAD:packages/flow/agents/<name>.md`: a normalising diff (frontmatter stripped) reports **bodies byte-identical: 15 differ: 0**.
2. Holds as restated — per-file `diff` against a pre-cutover copy shows the dropped key, the re-quoted `tools`, and the dropped description quotes, and nothing else in any of the 15.
3. Holds as restated above. The recorded installs are `kind: "agent"`, `mode: "auto"`, `version: ""`.
4. Holds — `agentFieldSupport` warns on a `targets.pi` key outside the ten-field set, warns on a top-level field no renderer forwards, and makes a `requires` entry with no renderer an **error**: `install` writes nothing, `sync` exits 2 before its first artifact. A bridge with no agent capability is an error too, so a declaration for one is refused rather than half-installed.
5. Holds — `grep -rnE "^(isolated|skills|extensions):" src/agents/ ~/.pi/agent/agents/` returns nothing, in both the source and the installed roster.
6. Holds, by execution — pi's own parser, run twice with `PI_CODING_AGENT_DIR` pointed at a pre-cutover copy and then at the installed directory:

  ```
  before dir: /tmp/agents-before-…  | agents: 15
  after  dir: /tmp/agents-after-…   | agents: 15
  same names: True
  entries differing in any parsed field: NONE
  claim-verifier: tools=['read','grep','find','ls','bash'] promptMode=append promptLen=4359
  web-search-researcher: tools=['read','grep','find','ls','ext:flow-web-tools/web_search','ext:flow-web-tools/web_fetch']
  ```

  Every field `loadCustomAgents` returns — `builtinToolNames`, `description`, `maxTurns`, `thinking`, `promptMode`, `inheritContext`, `enabled`, `systemPrompt` — is identical across the cutover for all 15, which is what makes AC-2's three-change diff safe.
7. Holds — `packages/flow/agents/` deleted (15 files, 1,769 body lines); `agents.ts` (774), `agent-enablement.ts` (164), `update-agents-command.ts` (62) and their three test files (1,012 + 155 + 106) deleted; `/flow-update-agents` unregistered from `flow-core/index.ts`; the agent arms removed from `session-hooks.ts`; `BUNDLED_AGENTS_DIR` gone from `paths.ts`. `rg -n "BUNDLED_AGENTS_DIR|syncBundledAgents|cleanupPerCwdAgents|flow-update-agents" packages/` returns only CHANGELOG history and completed plans.
8. Holds — the `agents` axis is gone from `models-config.ts` (schema, resolution, `getAgentModelConfig`, `KnownModelKeys`), from `models-config-sources.ts` (`bundledAgentNames`), from `models-config-validate.ts`, and from the `/flow-models` picker (`SCOPE_AGENTS` + its descriptor). `~/.pi/agent/agents/.flow-managed.json` is deleted. **No writer other than skillset remains for that directory.**
9. Holds — the state file's `version` stays **1**; `matchInstall` and `findRecord` compare `(kind ?? "skill")`, so a record written before this slice reads as a skill, pinned by a test.
10. Holds — `sync --dry-run` after the cutover: `checked foreign 0 · undeclared 8 · in-sync 47`, and `~/.claude/`, `~/.config/opencode/`, `~/.skillset/copilot/` untouched (32 skill installs still `in-sync`).

**Measured against 3a's budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| skillset runtime logic | ~320 | **+540 / −29 = +511 net** | **overrun +191 (60%)** |
| skillset physical | +500 to +700 | **+711 / −46 tracked**, +433 in two new test files | over, of which +77 is the config and +2 the plan |
| payload | counted apart (as 2a counted its helper) | `src/agents/*.md` **1,799 lines** | — |
| new dependencies | none | none in either repository | met |
| new runtime modules | 0 | 0 | met |
| pi-extensions | −1,900 to −2,300 | **−4,856 / +136 across 41 files** (2,273 of it the four runtime modules and their tests, ~1,900 the roster) | met and then some |

**Per-file runtime logic, and where the overrun went.**

| file | net |
|---|---|
| `src/core/declarations.ts` | **+192** |
| `src/commands/install.ts` | **+142** |
| `src/bridges/pi/index.ts` | +52 |
| `src/commands/sync.ts` | +39 |
| `src/core/bridge.ts` | +20 |
| `src/core/{bundle,parse,types,state}.ts`, `src/bridges/{index,pi/paths}.ts`, `src/commands/uninstall.ts` | +75 |

1. **`declarations.ts` is the overrun, exactly as 2a's was**: `parseAgents` (~50), the agent-side coverage symmetry (~25), `agentFieldSupport` (~55 — a second field-support function rather than a branch inside the first, because the two kinds differ in all three of their inputs), and `classifyAgentInstall` + `standInAgentRecord` (~60). The budget's "~80" assumed one of each.
2. **`install.ts` (142) is the second**: the agent branch mirrors the skill branch's order — capability check, foreign refusal, local-edit warning, write — which is the slice's point (an agent is covered by the existing guarantees) but costs ~90 lines of parallel structure. **The honest lever, if the overage is not acceptable, is a single per-kind "prepare" helper**; the two paths differ in mode resolution and sibling handling, which is why it was not done blind here.

**Deviations, each deliberate.**

- **The other three bridges declare no agent vocabulary.** The 3a budget line said "agent expressibility *declared*" for claude-code, opencode and copilot. It is not: a field set no renderer reads is the dead surface 2e refused to add, and their vocabularies are already recorded in this document's dialect matrix. A declaration for one of them is an error naming the missing renderer, which is 2c's shape.
- **`extensions`/`tools` left `models.json` with the `agents` axis.** AC-7 asked only for the axis. Those two fields had exactly one consumer — the frontmatter injection this slice deleted — so leaving them would have left a schema that promises something nothing reads, plus a warn-on-miss message naming a consumer that no longer exists. `models-config.test.ts` lost its `agent-axis fields` and `getAgentModelConfig` suites (~150 lines) with them.
- **Files beyond the budgeted list**: `models-config-sources.ts`, `models-config-validate.ts`, `flow-models/{index,items,overrides}.ts`, `flow-models/units.test.ts`, `flow-models-command.test.ts` (47/66 — the picker's agent scope re-pointed to `skills`), and `flow-test-utils/token-surface.contract.test.ts`, whose non-vacuity check asserted the workspace holds >10 agent files; it now asserts the scan finds **none**, because the workspace ships none.
- **Doc rewrites beyond "−20 to −40"**: `docs/agents.md`'s *How they reach disk* section is now the ownership statement (skillset installs, `skillset sync` changes, model is a declaration in the file), and `docs/models-config.md` lost the axis row, the subagent example and the two `/flow-update-agents` instructions.
- **Comment trim after the build.** The slice's first pass shipped heavy commentary in both repositories; it was cut back to near-nothing before the gates (the long doc blocks on `AgentCapability`, `AgentFrontmatter`, `parseAgent`, `renderAgentFile` and the classification branch are gone). Net effect: the logic counts above are logic, not prose.

**Verification, in the order it ran.**

```sh
# skillset
npm run build                   # tsc + copy-skills + copy-agents (both trees to dist/)
npx biome check .               # 77 files clean
npm test                        # 30 files / 301 tests
node dist/cli.js sync --dry-run # checked foreign 0 · undeclared 8 · in-sync 47
# pi-extensions
pnpm -r run test                # exit 0 — 16 packages
```

**Not yet done.** Nothing is committed in either repository. Two follow-ups are named rather than implied: the other three harnesses' agent renderers (claude-code is the obvious next target, verifiable on this machine with a temp `HOME`) and the `install.ts` duplication lever above.

**Commit — drafted, never run.** Both slices add files, so the command is `git add -A`, never `git commit -am` (the mistake that produced `c174158`). **Re-verified 2026-10-08 against the staged tree**: 41 files, +136/−4,856; 15 roster files (1,769 lines); `agents.ts` 774, `agent-enablement.ts` 164, `update-agents-command.ts` 62, their tests 1,012 + 155 + 106; `~/.pi/agent/agents/.flow-managed.json` absent; `pnpm -r run test` exit 0 — **15 packages, not 16**, since the 16th (`pi-llm-switch`) declares no `package.json` and so has no test task; the message below is corrected accordingly.

```sh
# skillset
git add -A && git commit -F - <<'MSG'
skillset: agents become an artifact kind, and the roster moves in (0023 slice 3a)

The 15 pi subagent definitions move out of pi-extensions into src/agents/, bodies
byte-identical, `tools` under targets.pi, the dead isolated/extensions keys dropped.
The kind is a bridge capability: Bridge gains `agents?`, pi implements it, and the
record carries `kind` — absent means skill, so the state file stays version 1.

FLOW's roster classified foreign (its bytes, not ours) and differed by the dropped
keys anyway, so the cutover is one deliberate `install <15> --agent pi --global
--force`. The installed roster is now in-sync 47.

Gates: build, biome clean, 30 files / 301 tests.
MSG

# pi-extensions
git add -A && git commit -F - <<'MSG'
flow: the agent roster and its machinery retire to skillset (0023 slice 3a)

skillset owns ~/.pi/agent/agents/ now. packages/flow/agents/ is deleted, along with
agents.ts, agent-enablement.ts, update-agents-command.ts and their three test files;
/flow-update-agents is unregistered and its session-hook arms are gone. The stale
.flow-managed.json is removed — had the sync survived with its sources gone it would
have swept the whole roster as stale and deleted the files skillset had just adopted.

models.json loses the `agents` axis plus the `extensions`/`tools` fields that only fed
its injection, and /flow-models loses the agent scope. Per-agent model and thinking are
a static declaration in the agent file now.

41 files changed, +136 / -4856. pnpm -r run test: exit 0 across the 15 packages that declare one.
MSG
```

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

Implemented, tested, measured, and **committed** — `c8cc22d`, carried forward into `7eb7f75` with 2b. *(Superseded the same day: this entry first read "not committed"; the developer ran both messages before the next session.)* 2b's prerequisite was solved in the same session: the matrix states exactly which fields the review can carry per harness, so the skill-versus-command decision (claude-code `auto`, which has a directory for `review-range.mjs`, versus `slash`, which has none) can be made from data rather than from a reading.

### Implementation session — slice 2b — 2026-10-07

The developer said **go**, with one preference that shaped the declaration: **slash commands in claude-code** for the review. Two forks were settled before building, because the plan's criteria did not decide them:

1. **FLOW's `remediate` is renamed `flow-remediate`, not deleted.** Reading both bodies showed they are different capabilities sharing a name: skillset's is fix-from-review, FLOW's is a workflow-dispatched repair arm (`"validate-fix": acts({ skill: "remediate", reads: ["plans","validation"] })`, two workflows, its own `built-ins/remediation.ts`, outcome digest and tests). The developer chose the rename so each capability keeps one name. **AC-3 as written is therefore deviated from deliberately**: FLOW ships no copy of the *review*, but it keeps its repair arm — under a name that can no longer collide.
2. **`code-review` installs as pi `auto` + pi `slash` + claude-code `slash`.** `auto` is not a preference: only a skill directory can hold `_helpers/review-range.mjs` and `templates/review.md`, and only a skill file can carry the `contract:` the gate reads (2c's matrix: pi *prompt templates* carry `description` and `argument-hint`, nothing else). The slash install keeps `/sk-code-review` on pi, and claude-code stays slash per the developer.

**What landed.** In skillset: the portable review body (43 → 211 lines — scope resolution via the helper, the 13 quality surfaces with their mechanical triggers, the 8 sink classes with the in-scope rule, the interaction sweep's nine categories, gap-finder coverage arithmetic, the citation contract, reconciliation with cascade detection, the verifier's four checks and three tags, the review document with `blockers_count`, and the subagent-dispatch contract with its bounded fallback); `templates/review.md` (151) and `review-range.test.ts` (227) moved verbatim; `skillset.config.json` declaring the three installs, both siblings, and `requires: {code-review: {pi: ["contract"]}}`; and the conventions rule for portable dispatch.

In pi-extensions: `packages/flow/skills/code-review/` deleted (1,390 lines); `remediate/` → `flow-remediate/` with its frontmatter name; the two `validate-fix` stages, the built-in remediation outcome, the pipeline pointer, the docs, a CHANGELOG entry, the invariant helper and its test updated; a fixture user-agent dir; and the tests that pinned the old state amended.

Evidence, all of it by execution:

```sh
# skillset
npm run build && npm test          # 26 files / 259 tests
npx biome check .                  # 68 files clean
# pi-extensions, whole workspace
pnpm -r run test                   # 16 packages; flow 1781, flow-workflow 2573,
                                   # pi-permission-system 2773, pi-subagents 1254, …
```

The claim that matters — **the gate's schema reaches FLOW from the installed skill** — was re-run against a real install rather than assumed. `skillset sync` into a sandboxed `HOME` wrote 32 installs; then FLOW's own harvester, pointed at that home:

```
$ PI_CODING_AGENT_DIR=$T/.pi/agent node …  # buildUserSkillContracts()
user-skill contracts: code-review
produces.kind:       produces
artifactKind:        review
required:            [ 'blockers_count' ]
consumes.world:      working-tree
```

And the claude-code half, through its own loader (`HOME=$T claude --debug-file … -p …`; auth failed, so no model call — the log is the loader's):

```
Loading skills from: …, user=/tmp/2b-home-fx5F/.claude/skills, project=[]
Loaded 11 unique skills (… user: 1, …, legacy commands: 10)
```

The arithmetic is explained, not asserted: the sandbox holds exactly 10 claude command files (including `sk-code-review.md`) and exactly one claude skill directory (`commit-suggestion`, the only claude-code `auto` install) — so both numbers are ours.

**Three prerequisites the slice uncovered, each found by building rather than by reading:**

1. **The frontmatter renderer refused objects.** `compose({ …, contract: {…} })` threw `unsupported value type for frontmatter key contract: object`, so the nested `contract:` block the gate parses could not be rendered at all. `src/core/frontmatter.ts` now renders nested mappings recursively (arrays of mappings still refused, deliberately), with tests — **+39/−17 logic lines, a file 2b's budget did not list.**
2. **2c's capability check was wrong per mode.** `fieldSupport` judged one mode at a time, so a field expressible in the skill's `auto` install was reported unsupported — and, for a `requires` entry, refused outright — for the same agent's `slash` install. Demonstrated before fixing: with `contract` under `targets.pi` and pi installed twice, the slash install produced `required field \`contract\` has no renderer for pi — refusing a partial install`, i.e. `sync` would have exited 2 on the repository's own declaration. Now expressibility is judged across the modes an agent is installed in, with a regression test. **This is a 2c defect defeated by 2b use; 2c's entry records it as an amendment.**
3. **Two pi-extensions harnesses validated a configuration that no longer exists.** `validate-workflow-invariant.mjs` threaded only the *bundled* contracts, so with the review unbundled the polish/vet `code-review` gate validated with no schema and reported `produces-without-outcome` and `route-reads-unvalidated-data`. The helper now mirrors production (bundled **and** user-installed contracts), and the test points `PI_CODING_AGENT_DIR` at a fixture so it stays hermetic. A repo-wide contract test also caught the fixture on first run — every `SKILL.md` under a scanned package must set `disable-model-invocation: true` — which is how the fixture came to match the real skill's frontmatter.

**The failure mode is now documented, not silent** (`packages/flow/docs/skills.md`, *The review is a dependency*): with the review uninstalled, `/wf` still loads and the workflows that dispatch a `code-review` stage report `produces-without-outcome` and `route-reads-unvalidated-data` at validation. That is plan decision 4's "clear failure rather than a silently empty stage", and it is what the amended tests now pin.

### Measured against 2b — 2026-10-07

| area | budget | measured | verdict |
|---|---|---|---|
| skillset physical | 1,050-1,450 (≈820 moved verbatim) | **789** (411 tracked insertions + 378 moved: template 151, helper test 227) | **under, −261 (−25%)** |
| skillset logic (`src/`, non-test) | not broken out by 2b | **+198/−53 = +145 net** | reported |
| the review body | 43 → ~300-420 lines | 43 → **211** | **under — see the judgment note** |
| pi-extensions deletions | ~1,470 | **1,490** (review 1,390 + remediate's body, renamed not deleted) | met |
| pi-extensions additions | not estimated | +144 across 15 tracked files, plus the renamed `flow-remediate/SKILL.md` (76) and a 33-line fixture | reported |
| new runtime modules / dependencies | 0 / 0 | 0 / 0 | met |

**Per-file logic, skillset (2c and 2b together, committed as `c8cc22d` + `7eb7f75`):** `src/core/frontmatter.ts` +39/−17 (the nested renderer), `src/core/declarations.ts` +9/−8 (the mode-union fix), `src/commands/install.ts` +7/−1 and `src/commands/sync.ts` +8/−1 (the corrected call sites).

**The body-size judgment, stated rather than buried.** 211 lines is below the 300-420 estimate because the port keeps the *method and the dispatch contract* and drops FLOW's choreography: the three-wave dispatch order, the Discovery Map's internal format spec, the five literal agent prompt bodies, the advisor integration, and the read-economy rules. Everything AC-1 names is present, and the checks that matter (citation contract, in-scope rule, verification tags, `blockers_count`) are intact — but a harness whose specialists are thinner than FLOW's receives a thinner review than FLOW's bundled agents delivered. If the developer wants that fidelity back, it is a second pass over the same file, and it should be asked for rather than slipped in.

**Findings recorded, not fixed:** the review's *Fix* line supersedes skillset's old "never writes solutions" posture (FLOW's template carries `**Fix**` and the next workflow round consumes it — the 43-line body's stance is now wrong and the description says so); `allowed-tools` is left undeclared on claude-code, so a command run prompts for Bash permissions it could pre-approve — a permission-widening decision worth its own answer rather than a default; and `remediate`'s own body was left untouched by the rename, so its lane inputs (`--plans`, `--validation`) and artifact conventions survive exactly as they were (AC-8).

### Slice-2b status — 2026-10-07

Implemented, both suites green, and **committed** — `7eb7f75` here, `4b66b55` in `pi-extensions`. The two-copy window for `review-range.mjs` is **closed**: FLOW's copy, its test and the template are gone. AC-3 is satisfied in intent and deviated in letter (FLOW keeps its renamed repair arm); AC-6 is satisfied in effect but not untouched: `PIPELINE_POINTER` changed text (`remediate` → `flow-remediate`) while its token surface did not move, which `token-surface.test.ts` confirms still passes without a re-pin.

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

> **Superseded — 2026-10-07, the same day.** 2c and 2b were both built and are green; the two-copy window is closed. Read the 2b and 2c entries below, not this paragraph, for the current state.

The parallel `pi-extensions` audit (plan 0017 step 1: all 13 tool-declaring packages, zero production code) was started from this session in the background; its result is reported separately and is not part of this repository's state.

### Slice-2a sign-off — 2026-10-07

The developer committed slice 2a (`7e65d1a`), pushed it, and signed it off. As with slice 1, the plan **stays in `docs/plans/`** rather than `completed/`: the same document carries 2b, 2c and slice 3, and moving it would claim the program is done. It moves when the program does.

Two consequences recorded for the next session: the sibling declaration for `code-review` has **no install that can carry it** (its declared modes are `slash` only), which is a decision 2c makes rather than a defect; and the `review-range.mjs` **two-copy window stays open** until 2b deletes FLOW's copy and its test.

### Planning session — slice 3 inventory — 2026-10-07

The developer asked whether the plan says how the remaining instruction content moves here, and whether the other harnesses are missing anything pi has. Both answered in a new *Slice 3 — one place for instructions, one place per harness for extensions* section: the placement rule extended to every artifact kind, the measured per-package inventory of `pi-extensions` (`flow` is the only content-bearing package: 31 skills, 15 agents; the other fifteen are runtime), the verified-versus-unverified split on harness parity, and a six-step order (3a agents → 3f prompts) with what this repository must gain before each. Nothing was moved, nothing was authorized, and no file outside this plan was touched. The parity check is named as work rather than asserted: today's fetches cover the *capabilities* the peer harnesses ship, not whether each `pi-*` package is a parity shim or a unique capability.

### Implementation session — slice 2c — 2026-10-07 (Review log)

The developer said go on 2c after the slice-3 inventory session, and answered the one design question 2c carried: the capability report reads **two** declarations — a field present in the skill's own frontmatter warns, a `requires` entry in `skillset.config.json` errors. Built tests-first; criteria as built, the measured overrun, and the falsification run are recorded in the *Implementation session — slice 2c*, *Measured against 2c* and *Slice-2c status — 2026-10-07* entries above, so this entry is the pointer rather than a second copy. Gates: `npm run build`, `npm test` (25 files / 241 tests), `npx biome check src test` — all clean. Nothing committed; the message is drafted for the developer to run. Two findings were recorded rather than fixed: the copilot target writes `mode:` where VS Code now documents `agent:`, and opencode's installed binary cannot launch on this machine (`invalid signature`), which is why its half of AC-5 rests on its docs plus path agreement rather than on its own discovery.

### Implementation session — slice 2b — 2026-10-07 (Review log)

The developer said go on 2b with slash commands preferred for claude-code, and settled two forks the plan had left open: FLOW's repair arm is **renamed `flow-remediate`** rather than deleted (the two `remediate` bodies are different capabilities sharing a name), and the review declares **pi auto + pi slash + claude-code slash**. The session's record — the three prerequisites it uncovered (the frontmatter renderer refusing the nested `contract:`, 2c's per-mode false positive on `fieldSupport`, and two pi-extensions harnesses validating a configuration the move had made obsolete), the measured budget, and the honest note on the 211-line body against the 300-420 estimate — is in the entries above rather than restated here. Gates: skillset 26 files / 259 tests and biome clean; pi-extensions `pnpm -r run test` green across all 16 packages. The end-to-end claim was re-verified by execution (`buildUserSkillContracts` reading the installed skill, and claude-code's loader counting exactly our 10 commands and 1 skill dir). Nothing committed; two messages are drafted, one per repository. AC-3 is deviated from in letter (FLOW keeps a renamed repair arm) and AC-6 in method (the pointer's text changed; its token surface did not).

### Sign-off — slices 2c and 2b — 2026-10-07

Both slices are committed: `c8cc22d` (2c alone) and `7eb7f75` (2b, carrying 2c's frontmatter work forward) in this repository, `4b66b55` in `pi-extensions`. Confirmed by `git log` in the following session — this document's "not committed" statements were the only stale thing left, and they are corrected above.

Re-verified by execution in that session, on the committed state, rather than restated: `npm run build` + `npm test` → **26 files / 259 tests**; `npx biome check .` → 68 files clean; `git status --short` in `pi-extensions` clean. Structure confirmed present: `src/skills/code-review/` (211-line body, `_helpers/review-range.mjs`, `_helpers/review-range.test.ts`, `templates/review.md`), `skillset.config.json` declaring both siblings and `requires.code-review.pi = ["contract"]`, `packages/flow/skills/code-review/` absent, `flow-remediate/` present.

**The gap the commits left: propagation had not run.** `node dist/cli.js sync --dry-run` against the real home:

```
drifted    code-review → claude-code (slash, global)  ~/.claude/commands/sk-code-review.md   (43-line body → 211)
drifted    code-review → pi (slash, global)           ~/.pi/agent/prompts/sk-code-review.md  (43-line body → 211, + contract:)
missing    code-review → pi (auto, global)            ~/.pi/agent/skills/code-review/SKILL.md (+ both declared siblings)
checked drifted 2 · missing 1 · undeclared 8 · in-sync 29      (exit 0)
```

A committed source change is not a propagated one. Until `skillset sync` runs, this machine serves the old 43-line review from both prompt files **and** holds no user-installed `code-review` skill — which, with FLOW's bundled copy deleted by `4b66b55`, is decision 4's documented failure mode (`produces-without-outcome`, `route-reads-unvalidated-data`) rather than a silent one. Both installs are reported `drifted`, not `foreign`: the destinations are ours and the rewrite is the intended repair, so `sync` repairs them without `--force`.

Lesson for every later slice: a slice that changes a committed skill ends by running `sync` and recording its report, not by assuming the commit reached the home. 2c's `requires` gate makes that mandatory anyway — a declared required field with no renderer refuses the install — but nothing here fails when a *stale* install is still in place, which is why the dry run is the check.

**Propagation run, and verified by execution — same session, at the developer's go.**

```
$ node dist/cli.js sync                                    (exit 0)
reconciled drifted 2 · missing 1 · undeclared 8 · in-sync 29 · 3 written
$ node dist/cli.js sync --dry-run                          (exit 0)
checked undeclared 8 · in-sync 32                          # nothing drifted, missing or foreign
```

What `sync` wrote: both slash prompts re-rendered from the 211-line source (the pi one gaining `argument-hint`, `disable-model-invocation` and the `contract:` block, the claude-code one gaining the new description and body), and `~/.pi/agent/skills/code-review/` created with `SKILL.md` + the two declared siblings. The 8 `undeclared` records are the project-local claude-code installs slice 1 already documented; untouched, as intended.

Three checks confirm the write is real rather than reported:

1. **The gate's schema now reaches FLOW from the installed skill** — FLOW's own harvester, jiti-imported and pointed at the real agent dir: `buildUserSkillContracts()` → 1 contract, `code-review`, `artifactKind: review`, `required: ["blockers_count"]`, `world: working-tree`. Before `sync` this returned nothing, because the destination did not exist.
2. **The installed helper runs from the installed location** — `node ~/.pi/agent/skills/code-review/_helpers/review-range.mjs "file:README.md"` inside this repository prints `default_branch: main / strategy: tree / files_list: README.md`, exit 0. AC-5's mechanism, on the real home rather than a sandbox.
3. **Both siblings are byte-identical to the bundle source** — `diff` over `_helpers/review-range.mjs` and `templates/review.md` reports no difference, so the copy step did not reformat or re-encode anything.

**Finding recorded, not fixed.** The classifier's drifted message reads *"edited locally; rewriting from source"*, but these two destinations were never edited locally — the **source** moved and the destination was stale. It cost nothing here, and it is the wrong diagnosis for the common case this program is built around (skillset changes, installs follow), so the wording should distinguish *local divergence* from *stale against a changed source* — a report-vocabulary change against criterion 5, needing its own go rather than a drive-by edit.

### Go state — 2026-10-07

**3a is implemented and awaiting sign-off** (both repositories, gates green, nothing committed — see *Implemented — 3a*).

**State correction — 2026-10-08, verified with `git log` and `git status`, not with this file's prose.** **skillset's 3a is committed — `c917d4e`** (`skillset: agents become an artifact kind, and the roster moves in (0023 slice 3a)`, 33 files, +3,033/−48). The only dirty path here is this plan, carrying 3a's commit drafts and the rewritten handoff. **pi-extensions' 3a is staged and uncommitted**: `git diff --cached --shortstat` = 41 files, +136/−4,856, nothing untracked, nothing unstaged — the drafted message in *Implemented — 3a* is still to run there. Both halves are already installed on this machine (`sync --dry-run` = `checked foreign 0 · undeclared 8 · in-sync 47`), so the remaining paperwork is one commit message per repository. **(d) is scoped below and awaits its go.**

The two decisions it was waiting on are settled and built: the artifact kind is a bridge capability (`src/bridges/pi/`), and FLOW's agent machinery retired with the content it transformed, `models.json`'s `agents` axis included.

Still open, in the order the work now stands:

**(d) The agent renderers for the other three harnesses** — claude-code first (its loader is checkable on this machine with `HOME=<temp>`), opencode and copilot doc-level until their loaders can be exercised. 3a deliberately shipped none of them: a renderer that cannot be verified against its own loader is the failure mode 2c already recorded. **Superseded the next day: (d) is implemented for claude-code and awaits sign-off** — read *Implemented — (d), the claude-code agent renderer* below, and the scope it was built against, *(d) — scoped and awaiting go*. opencode and copilot are still unbuilt, on purpose.

**(e) `install.ts`'s skill/agent duplication** — the measured lever if 3a's +191 logic overrun is not acceptable.

**(f) Slice 3 proper** — 3b (the guidance channel), 3c (project scaffolds), 3d (the FLOW skill triage), 3e (workflow declarations), 3f (prompts and commands). 3a's completion removes the ordering blocker 3b sits behind.

**(g) The `CLAUDE_CONFIG_DIR` / `PI_CODING_AGENT_DIR` path question** — found while verifying (d), measured rather than argued: claude-code's loader prefers `CLAUDE_CONFIG_DIR` over `$HOME/.claude`, and pi's resolves its agent dir through `PI_CODING_AGENT_DIR`, while this repository's bridges resolve `homedir()` and know neither variable. On a machine with either set, `sync` writes where the harness never looks — silently. It affects the existing **skill** installs too, so it is its own slice with its own go; the recommendation is a per-bridge resolution (the way 2e taught claude-code `sessionKeyFromEnv`), never a core one.

### (d) — scoped and awaiting go: the claude-code agent renderer — 2026-10-08

#### Goal

skillset installs agent definitions into claude-code, and **claude-code's own loader** confirms it. 3a shipped the artifact kind as a bridge capability and deliberately left the other three bridges renderer-less — *"a renderer that cannot be verified against its own loader is the failure mode 2c already recorded"*. This slice pays that debt for the first of the three, with the verification that was missing: claude-code's loader is observable on this machine, so the renderer is judged by the harness rather than by a fixture.

Scope: the renderer **plus all 15 agents** for claude-code, global scope (developer's call, 2026-10-08). opencode and copilot stay renderer-less — their loaders cannot be exercised here (opencode's arm64 binary is `invalid signature` and SIGKILLed; Copilot CLI is installed nowhere), and a field set no renderer reads is the dead surface 2e refused.

#### What was verified by execution — claude-code 2.1.286, the installed build, 2026-10-08

**Method.** The loader's own registry, no model call, authentication irrelevant:

```
$ HOME=$T claude --agent zzz-sentinel -p "hi"
--agent 'zzz-sentinel' not found. Available agents: claude, Explore, field-probe, general-purpose, Plan, statusline-setup. Using default behavior.
```

An unknown `--agent` makes claude-code print every agent it registered; the sentinel name turns its own error into the measurement, and the failure is what makes it non-circular. **A first probe was invalid and is recorded so it is not repeated:** `claude agents --json` on this build means *background sessions* (`Manage background agents` in `claude agents --help`) and printed `[]` whether an agent was installed or not — the *subcommand has been repurposed since the source dump*, which is the dump's version drift showing up in day-to-day use.

| probe | result |
|---|---|
| `<HOME>/.claude/agents/<n>.md` | registered (`field-probe`) |
| `<HOME>/.claude/agents/nested/<n>.md` | registered — the loader recurses |
| `<cwd>/.claude/agents/<n>.md` | registered — project scope works |
| file `c-filestem.md` carrying `name: frontmatter-wins` | registered as **`frontmatter-wins`** — frontmatter `name` wins over the filename |
| `name:` present, no `description:` | **silently skipped**, nothing logged |
| `description:` present, no `name:` | **silently skipped** |
| `totallyUnknownKey: 1` | ignored; the agent still registers |
| `tools: "Read, Grep, Glob"` (quoted CSV — the renderer's own shape) | registered |
| `tools: []` | registered |
| `--debug-file` log | names the directory it watches: `Watching for changes in skill/command directories: <…>/.claude/agents…` |
| `CLAUDE_CONFIG_DIR=<dir>` set alongside a populated `$HOME/.claude/agents` | the agent at `<dir>/agents/` registers and the one under `$HOME` does **not** — the loader prefers that variable, both directories populated at once so the result is not a default-path artefact |

**Source-level only, not execution-verified, and labelled as such:** `tools` absent means *all* tools (`parseAgentToolsFromFrontmatter` — `undefined` = all, `[]` = none, `*` = all; the source comment and claude-code's docs agree). It cannot be observed without a model call, because the resolved tool list is not logged. It is load-bearing all the same — it is the entire reason for decision 2 below.

**The opposite direction is measured too, and it is just as silent.** `resolveAgentTools` splits an agent's declared specs into `validTools` and `invalidTools`; an unrecognised spec never enters `resolvedTools`, so a `tools:` line whose names all fail resolves to an **empty tool set** — no error, no session, no tools. So this slice's mapping guards two opposite silent failures: **absent `tools` grants every tool, and wrongly-named `tools` grants none.** That is why AC-2 asserts names rather than treating the check as cosmetic, and why the mapping is authored from the build's own tool-name constants instead of from memory.

**Tool names**, from the source tree's own constants, because a mapping authored from memory would be a guess: `Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`, `WebSearch`, `WebFetch`, `Agent` (legacy `Task`), `TodoWrite`, `Skill`. No `LS` and no `find` exist as tools — `Glob` is what both of pi's names map to.

| pi (source, `targets.pi.tools`) | claude-code (artifact, `targets.claude-code.tools`) | agents affected |
|---|---|---|
| `read` (13 of 15) | `Read` | 13 |
| `grep` (15) | `Grep` | 15 |
| `find`, `ls` (15) | `Glob` | 15 |
| `bash` | `Bash` | 2 — `claim-verifier`, `precedent-locator` |
| `ext:flow-web-tools/web_search` | `WebSearch` | 1 — `web-search-researcher` |
| `ext:flow-web-tools/web_fetch` | `WebFetch` | 1 — `web-search-researcher` |

Three tool classes cover all 15 sources (read-only, read-only+Bash, read-only+web), so the content edit is one added `targets.claude-code.tools` line per file. **`expresses` for claude-code agents** — `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `initialPrompt`, `memory`, `background`, `isolation`, `color` — comes from that source tree's markdown parser, whose provenance limit *The agent-definition dialect per harness* already records: load-accurate, **not release-pinned**. **Pinned to the installed build rather than trusted to the dump**, by the same `strings` method: `/opt/homebrew/Caskroom/claude-code@latest/2.1.286/claude` contains the parser's own field-specific messages verbatim — `invalid permissionMode`, `invalid memory value`, `invalid effort`, `invalid background value`, `invalid isolation value` — alongside `disallowedTools` (76 occurrences), `maxTurns` (53), `initialPrompt` (34), and the tool-resolution properties `hasWildcard`, `validTools`, `invalidTools`, `allowedAgentTypes`. The dump's drift shows only in the branches this slice does not touch (its `Invalid tools:` message and helper names are absent from 2.1.286), which is a second reason to author from the build's constants rather than from the tree.

**The mechanism is proved end to end before a line is written.** Two real sources — `diff-auditor` (`Read, Grep, Glob`) and `web-search-researcher` (the 5-name web set, quoted CSV with its description's own quoting preserved) — rendered by hand into `<temp>/.claude/agents/` in the exact shape the bridge will compose, and the loader registers both:

```
$ HOME=<temp> claude --agent zzz-sentinel -p "hi"
--agent 'zzz-sentinel' not found. Available agents: claude, diff-auditor, Explore, general-purpose, Plan, statusline-setup, web-search-researcher
```

**Recorded finding, not fixed, and pre-existing.** The loader prefers `CLAUDE_CONFIG_DIR` over `$HOME/.claude` (measured above), while this repository's claude-code bridge resolves `homedir()/.claude` and knows nothing of the variable (`src/bridges/claude-code/paths.ts`, `base()`). On a machine with it set, `sync` would write where claude-code never looks — silently, because every byte is where skillset put it, and `--agent <name>` would report the name missing. It affects the **existing skill installs identically**, so fixing it inside (d) would change behaviour beyond this slice's criteria — the records' locations move and `sync` would report 32 skill installs `missing` on such a machine — and it needs its own go. Recommended follow-up, so it is not lost: teach the claude-code bridge its own variable the way 2e taught it `sessionKeyFromEnv` (per-bridge resolution, never a core one), and settle pi's `PI_CODING_AGENT_DIR` — already an open question in this plan — in the same pass. **This machine is unaffected**: `env | grep -i claude` is empty, which is also why the temp-`HOME` probe is a valid method here.

**The command layer needs no change at all** — measured, not assumed. `install`, `sync`, `status` and `uninstall` already dispatch on `declaration.kind` and reach the harness through `bridge.agents` (`install.ts:136-203`, `sync.ts:134,232`, `uninstall.ts:35-43`), and `AGENT_BRIDGE_NAMES` is derived — `BRIDGES.filter(b => b.agents)` (`bridges/index.ts:23`) — so a second bridge declaring the capability is admitted with **no registry edit**, and `grep -rn '"pi"' src/commands/ src/core/` returns nothing.

#### Acceptance criteria

1. `src/bridges/claude-code/` declares an `agents` capability (`path`, `install`, `uninstall`, `preview`, `expresses`); `AGENT_BRIDGE_NAMES` contains `claude-code` **with no edit to `src/bridges/index.ts`** — the derivation is what admits it.
2. All 15 agents carry `targets.claude-code.tools` in claude-code's own names, and **no pi tool name reaches a rendered artifact**: `grep -nE "^tools:.*(\bread\b|\bgrep\b|\bfind\b|\bls\b|\bbash\b|ext:)" ~/.claude/agents/*.md` returns nothing.
3. **claude-code's own loader registers all 15**, after a real install: `HOME=<temp> claude --agent <sentinel> -p "hi"` names all 15, and each is present as a file in `<temp>/.claude/agents/`. Transcript in the plan.
4. An agent declared for claude-code with **no** `targets.claude-code.tools` is an **error that writes nothing** — `install` writes no file and records nothing, and `sync` exits 2 before its first artifact. The rule is declared by the bridge, not by 15 config entries (decision 2).
5. The agent kind keeps 3a's guarantees on the second harness: an unrecorded differing file at the destination refuses as `foreign`; a recorded install whose bytes moved is repaired by `sync` with the prior content reported; `uninstall` removes the recorded file and **never the `agents/` directory itself**.
6. `sync` is idempotent here: a second `sync --dry-run` reports the 15 agent installs `in-sync`, with `drifted 0 · missing 0 · foreign 0`.
7. **Nothing else moves**: the 32 skill installs and the 15 pi agent installs still report `in-sync`, and `~/.claude/commands/`, `~/.claude/skills/`, `~/.claude/settings.json`, `~/.pi/agent/`, `~/.config/opencode/` and `~/.skillset/copilot/` are byte-unchanged — hash comparison before and after, as 2e did it, not a test count.
8. State back-compat holds: the state file stays `version 1`; the new records are `kind: "agent"`, `mode: "auto"`, `agent: "claude-code"`, and the pi records are untouched.
9. Gates: `npm run build` → `npm test` → `npx biome check .`, then a real `sync` with its report pasted, then the temp-HOME loader transcript re-run against the installed directory.
10. **No new dependency, no new runtime module, no comments added.** Nothing under `src/core/**` or `src/commands/**` names a harness (`src/bridges/index.ts` stays the only file that names one), and the standing comment rule is honoured: no explanatory blocks, no "why" essays above functions, no invented section banners.

#### Budget

| area | file | what | est. logic |
|---|---|---|---|
| bridge | `src/bridges/claude-code/paths.ts` | `agentPath` | ~4 |
| bridge | `src/bridges/claude-code/index.ts` | the `agents` capability: `expresses`, render, install/uninstall/preview, path wire-up | ~55 |
| core | `src/core/bridge.ts` | `AgentCapability.required?: readonly string[]` | ~4 |
| core | `src/core/declarations.ts` | merge the capability's required list; an expressible-but-undeclared required field on an **agent** is an error | ~10 |
| content | `src/agents/*.md` × 15 | `targets.claude-code.tools`, three tool classes | +30 physical |
| config | `skillset.config.json` | 15 entries gain a claude-code install | +15 physical |
| tests | `src/bridges/claude-code/agents.test.ts` (new) + core/CLI additions | render, path, install/uninstall/preview, the required-`tools` error, foreign refusal, sandboxed `sync`, CLI round trip | ~200 |
| docs | `README.md`, `docs/architecture.md`, `docs/conventions.md` | the second harness's agent row, the required-`tools` rule | ~40 physical |

- New dependencies **none**; new runtime modules **0**; new test files **1**.
- Estimated implementation logic: **~75 added lines**. Physical: **~380-520** including tests, docs and content.
- **Base rate, stated so the estimate is not read as precision:** every slice of this program that added a mechanism overran — 2a +63 net, 2c +100 net, 3a +191 net (30-77%). The honest read for (d) is **75-130 logic lines**, and the plan's own budget discipline is what will make the overrun visible rather than discovered late.

#### Decisions

1. **All 15 agents, global scope** (developer's call, 2026-10-08). A partial roster would leave "where does an agent live" ambiguous, which is the question this program exists to answer. Local scope needs no new code — the path branches on scope already — but no local declaration is added, because nothing consumes one.
2. **The required-`tools` rule is declared by the bridge, not by config.** Absence-means-all-tools is a property of claude-code's loader, so it is harness knowledge and belongs in `src/bridges/claude-code/` (`AgentCapability.required`) — 15 identical config lines would be the same fact written 15 times, in the one place a maintainer can silently omit it. 2c's `requires` in `skillset.config.json` stays available and composes with it.
3. **Severity changes for agents only.** An expressible-but-undeclared required field becomes an error in `agentFieldSupport` and stays a warning in `fieldSupport`. The developer's rule, 2026-10-08: *error, write nothing*. The repository's own skill declaration is unaffected — `requires.code-review.pi = ["contract"]` names a field that carries a value, so no shipped declaration changes behaviour.
4. **Tool names are per-target data, authored in each agent's file.** A pi→claude mapping table inside the claude-code bridge would put another harness's vocabulary in a bridge, and it breaks on `ext:` selectors; the plan decided this at 3a (`targets.<agent>.tools`) and 3a landed it that way.
5. **`name` stays in the source.** claude-code requires it and takes it over the filename (verified above); pi ignores it. One source, no per-target naming.
6. **No expressibility declaration for opencode or copilot** — unchanged from 3a, for the reason 3a gave: neither loader can be exercised here.
7. **No ADR.** This applies ADR 0006/0007 and 3a's bridge rule to a second harness; ownership, dependency direction and who owns the config are all unchanged.

**Road not taken.** *Declare claude-code agents with no `tools`* — the artifact would carry no `tools:` line, which claude-code reads as every tool, so 13 read-only auditors would silently gain `Bash`, `Write` and `Edit`; that is decision 2's whole reason. *Map pi names to claude names inside the bridge* — one harness's vocabulary embedded in another's module, and the `ext:` selectors have no mechanical equivalent. *Ship project-scope declarations too* — `.claude/agents` in a project is the developer's own space, and no project scaffold exists until 3c.

#### Confidence

**~98%.** Retired by execution before scoping: the loader registers files at both scopes and recursively; `name` and `description` are both required and a file missing either is a **silent** skip; frontmatter `name` wins over the filename; unknown keys are ignored; the renderer's quoted-CSV `tools` shape and an empty `tools` both register; `CLAUDE_CONFIG_DIR` wins over `$HOME/.claude`; the command layer admits a second agent bridge with no registry or command edit; and the two real agents of AC-3's target shape already register in the loader. Retired by `strings` over the installed binary: the sixteen-field vocabulary and the valid/invalid tool split. What remains is exactly the two things a plan cannot measure — the tool set a *session* offers (the mapping is authored from the build's own constants, and AC-2 pins the absence of pi names) and the run-time effect of a wrong name (the source reads it as an empty tool set, which is the conservative assumption, not the flattering one). Fallback if a future build's loader refuses the artifact: it is a markdown file with `name`, `description` and `tools` — the same three fields `pi-subagents` reads — so a failed probe would cost the verification, not the artifact, and `install` would still refuse rather than half-write.

Nothing is authorised. ~~The go is a separate step.~~ **Go given 2026-10-08; implemented below.**

### Implemented — (d), the claude-code agent renderer — 2026-10-08 (Review log)

The developer gave **go** with the three decisions this scope was waiting on: all 15 agents on claude-code, a missing `tools` declaration is an **error that writes nothing**, and the slice stops at claude-code.

**What landed.** `src/bridges/claude-code/paths.ts` gains `agentPath`; the bridge gains an `agents` capability (`expresses` — the sixteen fields its loader reads; `consequence.tools`; `required: ["tools"]`; `path`; `install`/`uninstall`/`preview`); `AgentCapability` gains `required`, and `agentFieldSupport` merges it with the config-supplied list and makes an expressible-but-undeclared required field an **error** for agents while skills keep the warning. All 15 sources gained `targets.claude-code.tools` in claude-code's own names, and all 15 declarations gained a claude-code install. No command, registry or config-shape change: `AGENT_BRIDGE_NAMES` derived the second bridge by itself.

**Criteria as built.**

1. Holds — the capability is declared and the registry admitted it with no edit: `AGENT_BRIDGE_NAMES` is `["claude-code", "pi"]`, pinned by a test that reads the registry rather than a literal.
2. Holds, on the installed bytes rather than the sources: `grep -nE "^tools:.*(\\bread\\b|\\bgrep\\b|\\bfind\\b|\\bls\\b|\\bbash\\b|ext:)" ~/.claude/agents/*.md` returns **nothing** (exit 1), no `targets:` block leaked, and the four rendered sets are exactly `Read, Grep, Glob` (9), `Grep, Glob` (3), `Read, Grep, Glob, Bash` (2), `Read, Grep, Glob, WebSearch, WebFetch` (1).
3. Holds, by execution against the **real home** — claude-code's own registry, after `sync`: `Available agents: artifact-code-reviewer, artifact-coverage-reviewer, artifacts-analyzer, artifacts-locator, claim-verifier, claude, codebase-analyzer, codebase-locator, codebase-pattern-finder, diff-auditor, Explore, general-purpose, integration-scanner, peer-comparator, Plan, precedent-locator, scope-tracer, slice-verifier, statusline-setup, web-search-researcher` — 15 ours, 5 its own.
4. Holds, **falsified rather than asserted**: with the `claude-code` tools block deleted from the *built* bundle, `install diff-auditor --agent claude-code --global` exits **1** — `required field \`tools\` is expressible but nothing declares a value for it — add \`targets.claude-code.tools\` (an agent artifact with no \`tools\` line resolves to every tool)` — and creates no `.claude/agents` directory at all; `sync --dry-run` in the same tree exits **2** with the same message. The bundle was restored by `npm run build` and the real home re-checked (`in-sync 62`).
5. Holds — the kind's guarantees on the second harness are covered by unit and end-to-end tests: `foreign` refuses and `--force` adopts (a CLI test now writes somebody else's `~/.claude/agents/diff-auditor.md` and checks both outcomes), a recorded install whose bytes moved classifies `drifted`, and `uninstall` removes the file while leaving `agents/` standing.
6. Holds — `sync` then `sync --dry-run`: `reconciled missing 15 · undeclared 8 · in-sync 47 · 15 written` (exit 0), then `checked undeclared 8 · in-sync 62` (exit 0), nothing drifted, missing or foreign.
7. Holds, by hash — `~/.claude`, `~/.pi/agent`, `~/.config/opencode` and `~/.skillset/copilot` were hashed before and after (4,289 + 1,498 + 744 + 1 files). The **only** additions anywhere are the 15 `~/.claude/agents/*.md` files; opencode and copilot are byte-identical, and `~/.pi/agent` differs in exactly two files, both this session's own runtime state rather than installed content — `extensions/pi-permission-system/logs/pi-permission-system-permission-review.jsonl` (the log of the blocked `rm -rf` attempt below) and this session's transcript under `sessions/`. No skillset-owned artifact byte moved.
8. Holds — the state file is still `version: 1`; the new records are `kind: "agent"`, `mode: "auto"`, `agent: "claude-code"`, and the pi records are untouched.
9. Holds — the gates, in order:

```sh
npm run build                   # tsc + copy-skills + copy-agents, clean
npx biome check .               # 78 files clean
npm test                        # 31 files / 314 tests  (was 30 / 301)
node dist/cli.js sync            # reconciled missing 15 · undeclared 8 · in-sync 47 · 15 written
node dist/cli.js sync --dry-run  # checked undeclared 8 · in-sync 62
```

10. Holds — no new dependency, no new runtime module, no harness name in `src/core/**` or `src/commands/**` (the boundaries test is green), and **no comments added**: the one doc comment written on `AgentCapability.required` was removed when the standing rule was re-read, so the member is documented in the plan and the README instead. The `consequence` text is data, not commentary — it is what the error prints.

**Measured against the budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| runtime logic | ~75 added | **+81 / −10 = +71 net**, non-comment non-blank in `src/` | **met** (under the honest 75-130 read) |
| physical, non-plan | ~380-520 | **+468 / −33** (245 tracked + the 223-line new test file) | met |
| content (15 sources) | +30 | **+30** | met |
| config | +15 | **+45** | **over by 30** — see deviations |
| tests | ~200 | **+266 / −13**, 12 new cases in a new file + 1 end-to-end | **over by ~66** |
| docs (non-plan) | ~40 | **+39 / −10** across README, conventions, architecture, glossary | met |
| new runtime modules / dependencies / test files | 0 / none / 1 | 0 / none / 1 | met |

**Deviations, each deliberate.**

- **The config cost 3 lines per agent, not 1** (+45 against a +15 estimate). `skillset.config.json` is expanded JSON — one key per line — so a second install entry is `},`, `{`, `"agent": …`. The estimate assumed a compact line; the file's existing shape won, because reformatting it to save 30 lines would have made the diff unreviewable. My first attempt *did* rewrite the file wholesale and reformatted two unrelated `siblings`/`requires` lines; that was reverted (`git checkout -- skillset.config.json`) and redone as a targeted text edit, so the diff is additions only.
- **The tests are over by ~66 lines**, and the reason is the same one 2c and (b) recorded: each case asserts exact rendered bytes (`tools: "Read, Grep, Glob"`) rather than `toContain`, because the loose form passes against the wrong mapping. The new file also exercises the whole roster through the real write path, which is what AC-2 needs.
- **`docs/glossary.md` was not in the budget** (+4/−3). Editing it was not optional once the README claimed a second harness: its `target` entry still defined an `AgentTarget` interface that 2e had renamed, so a reader would have been sent to a symbol that no longer exists. The same 2e relics were corrected in `docs/architecture.md` (`targetFor` → `requireBridge`, the `src/targets/` heading → `src/bridges/`) and `docs/conventions.md` (the roster sentence, which still said agents were FLOW's until skillset could render them — false as of this slice).
- **`src/bridges/pi/agents.test.ts` changed** (−8/+7): three assertions named claude-code as the bridge *without* an agent capability and now name opencode. Amended rather than deleted, because the invariant they check — a harness with no renderer refuses the declaration — is still worth holding, and `harnesses that can: claude-code, pi` is now the message they pin.
- **A discovery, recorded rather than fixed: the config `requires` block is skill-keyed.** `declarationCoverage` validates `requires.<name>` against skill declarations, so `requires` naming an *agent* is a coverage problem (`declares required fields but no install`) and never reaches `agentFieldSupport`. That is pre-existing, unchanged here, and it is why the required-`tools` rule is declared by the bridge: for the agent kind the bridge is the only channel that binds. An e2e test written on the config route failed for exactly this reason and was replaced by the falsification in AC-4, which tests the rule through the channel that actually exists.
- **`consequence.tools` does double duty** — it is the field's consequence for a `targets.<harness>` entry the harness ignores (2c's use) *and* the tail of the required-undeclared error. Reusing the existing map kept `AgentCapability` at one new member.

**Not yet done.** The commit itself has run (below). Two things stay open and named rather than implied: the **`CLAUDE_CONFIG_DIR` finding** (recorded above; the loader honours it, this repository's claude-code paths do not, and it affects the skill installs identically — its own go), and the **opencode and copilot agent renderers**, which stay unbuilt until their loaders can be exercised.

**Commit — run by the developer as `748d318`** (`skillset: claude-code installs agent definitions too (0023 slice 3d)`); the working tree is clean afterwards. This slice adds a file, so the command was `git add -A`, never `git commit -am`.

**The label on that commit is wrong, and it is this plan's error.** The message says `(0023 slice 3d)`, but **3d in this plan is the FLOW skill triage** — a different, unstarted piece of work. This slice is item **(d)**, *the agent renderers for the other three harnesses, claude-code first*, and the two share nothing but a letter. `748d318` is already pushed (`origin/main` = `748d318`), so the label stands unless the developer chooses to amend; the honest reading for anyone grepping the log for the triage is: this commit is not it. The drafted text below is kept as it was run rather than silently corrected, so the record matches the history.

```sh
git add -A && git commit -F - <<'MSG'
skillset: claude-code installs agent definitions too (0023 slice 3d)

The agent kind was pi-only because a renderer that cannot be verified against its
own loader is the failure mode 2c recorded. claude-code's loader is verifiable
here — `claude --agent <unknown> -p` prints the registry it loaded — so the
capability is a second implementation of it, and AGENT_BRIDGE_NAMES derives the
change with no registry edit.

All 15 agents declare targets.claude-code.tools in Claude Code's own names: a
`tools` line it does not recognise resolves to no tools at all, and no `tools`
line resolves to every tool. The second failure is silent and widens a read-only
agent's permissions, so AgentCapability.required now names fields whose absence
changes what the artifact means, and an agent that leaves one undeclared is
refused: install writes nothing, sync exits 2.

Verified against the loader after a real sync: all 15 register, and with the
tools block deleted from the built bundle install exits 1 with nothing written.

31 files / 314 tests, biome clean, sync --dry-run = in-sync 62.
MSG
```

### CI fix — colour on every platform, separators on Windows — 2026-10-08

**Symptom.** The GitHub workflow (`ci.yml`: ubuntu, macos and windows × node 20/22) failed on `test/agents-kind.test.ts` — expected `'\u001b[32minstalled\u001b[39m diff-au…'` to match `/installed diff-auditor → pi/`, and the same for `/checked in-sync 62/`. Both pass locally, and both passed in every gate transcript this plan records.

**Cause, reproduced rather than reasoned.** `picocolors` enables colour when `CI` is in the environment **and unconditionally on `win32`**, so no local `npm test` — and no transcript in this plan — ever ran the condition CI runs in. `sync` prints its summary as `pc.bold("checked")` beside `pc.dim(summary)` (`src/commands/sync.ts:285-286`), so an ANSI reset lands *between* the two words the regex spans; the install line has the same shape (`pc.green("installed")`). Measured with the CLI's own predicate:

```sh
$ CI=true node -e "const pc=require('picocolors'); console.log(JSON.stringify(pc.green('installed')))"
"\u001b[32minstalled\u001b[39m"
$ CI=true NO_COLOR=1 node -e "…"
"installed"
```

**Fix — one line, at the single place every CLI test spawns through.** `test/helpers.ts` `run()` sets `NO_COLOR: "1"` in the child environment, before the caller's `env` so a test can still opt in to colour. The tests assert text, not rendering, and the child now behaves as it does when piped — which is what CI is.

**Verified.** `CI=true npm test` reproduced the failure before the fix (`2 failed | 312 passed`) and reports **31 files / 314 tests passed** after it; the workflow's other steps are green locally as well (`npm run lint` · 78 files; `npm run typecheck`; `npm run build`).

**Lesson, and why two slices of green gates missed it.** The gate this plan has been recording — `npm test` — is not the CI gate: it differs in exactly the variable that decides colour. `CI=true npm test` is the cheap reproduction and joins the slice gate list from here on.

**Still open — the Windows jobs, reported red "since several commits".** The mechanism above is also a Windows trigger (`win32` forces colour regardless of TTY), so this fix removed one proven cause there. The other two were found the moment the Windows log arrived, and they were a **different bug**: a `rel` path built with the OS separator.

#### The second bug, from the same log — a platform-dependent sibling identity

The Windows job showed **four** failures, not two. Alongside the colour pair:

```
FAIL test/agents/pi.test.ts > pi target > sibling files > copies a declared sibling …
  Array [ "SKILL.md", "_helpers\\review-range.mjs", "templates\\review.md" ]
FAIL src/core/declarations.test.ts > parseDeclarations — sibling files > …
  expected '_helpers\review-range.mjs' to be '_helpers/review-range.mjs'
```

**One call caused both:** `parseSiblings` did `const rel = normalize(entry)` — `node:path`'s platform `normalize`, which turns `_helpers/review-range.mjs` into `_helpers\review-range.mjs` on Windows. A sibling's `rel` is an **identity**, not just a path: it is written into the install record, compared against that record on every later `sync`, read out of a config file that is shared across platforms, and joined to the install directory for the copy. Built with the OS separator it is a different string per platform, so the same repository installs to two different records and a state file stops travelling.

```
$ node -e "…"
path.win32.normalize  -> "_helpers\\review-range.mjs"      ← the old call, on Windows
posix.normalize(win-style input) -> "_helpers/win.mjs"    ← the new one, on any platform
```

**Fix.** `const rel = posix.normalize(entry.replaceAll("\\", "/"))`, with a drive-letter guard beside `posix.isAbsolute` so `C:\\x.mjs` and `\\\\server\\share\\x.mjs` are refused on **every** platform rather than only where `isAbsolute` happens to catch them. This is not a new convention: `src/core/workspaces.ts:186` already canonicalises exactly this way (`rel.split(sep).join("/")`) — the sibling parser was the one place that used the raw platform call.

**Two tests came with it**, both of which run on macOS and pin the Windows behaviour: `\`, `./` and `//` all canonicalise to one portable form, and both absolute forms are rejected. The `source` assertion below the failing one was fixed too — it matched an *absolute OS path* with `/`, so it was Windows-broken as well and had merely never been reached, the `rel` assertion failing first.

**Verified.** `npm run lint` (78 files), `npm run typecheck`, `npm run build`, `npm test` → **31 files / 316 tests** (was 314; +2 cases), and the same suite under `CI=true` → 31 / 316.

**Honest limit.** Windows cannot be run here, so the confirmation is the next CI run. What is established is narrower and stated as such: the identity path no longer calls an OS-separator API at all, the canonical form is pinned by tests that execute on this machine, and the demonstration above is `node:path`'s own win32 implementation, not a guess about it.

#### The third instance — the context anchor's local path assertion — 2026-10-08

That next CI run confirmed the two fixes and surfaced **one more instance of the same class**, in a test 3c wrote:

```
FAIL src/bridges/bridges.test.ts > declares the context anchor for pi alone, at the paths pi actually loads
AssertionError: expected '\proj\AGENTS.md' to be '/proj/AGENTS.md'
  expect(piBridge.artifactPath({ ...artifact, scope: "local", projectRoot: "/proj" })).toBe(
    "/proj/AGENTS.md",
  );
```

**One line, and the same mistake as the two before it:** the expectation was a POSIX literal for a path the *code* builds with `join`, while the assertion three lines below it — the global anchor — was written with `join(homedir(), …)` and therefore platform-neutral. `artifactPath` is right; the test encoded one platform's separator.

**Reproduced without Windows, which is what makes this a fix rather than a guess:**

```sh
$ node -e "const {win32,posix}=require('node:path'); console.log(win32.join('/proj','AGENTS.md'), posix.join('/proj','AGENTS.md'))"
\proj\AGENTS.md /proj/AGENTS.md        # the received value CI printed, and the expected one
```

**Fix.** `join("/proj", "AGENTS.md")`, matching the file's own idiom and `src/bridges/paths.test.ts`, which builds every expectation that way and passes on Windows.

**The class was swept, not just the report.** Every string literal in the suite that starts with `/` was read and classified (`grep -rnE '"/[A-Za-z0-9._/-]+"'` over `src` and `test`): the `/proj` values in `active.test.ts`, `state.test.ts` and `declarations.test.ts` are **inputs or echoed fields**, not joined outputs — asserted by the declaration tests passing on Windows in the same run — and `bridges.test.ts:216` was the only expectation standing on the wrong side of a `join`. The source side was re-checked in the same pass: `record.files` entries come from `copySiblings` (`sibling.rel`, canonicalised to POSIX by the fix above) or from `relative()` calls whose second argument is the file itself, so they are basenames — no identity in the state file is built with an OS separator after 2069691.

**Verified.** `npm run build`, `npx biome check .` (81 files), `CI=true npm test` → **33 files / 344 tests**, and the fixed test alone (15/15). The Windows confirmation is again the next CI run — but this time the failing value itself was produced here by `node:path.win32`, so the only thing left unverified is that the suite has no *fourth* instance.

**Commit — drafted, never run.** One file, one line; it is not part of 3d-i's change set, so it commits on its own — the shape `2069691` used for the first two instances.

```sh
git add src/bridges/bridges.test.ts && git commit -F - <<'MSG'
skillset tests: the context anchor's local path is joined, not a literal (windows ci)

The 3c test asserted '/proj/AGENTS.md' against a path the bridge builds with
join, which is '\proj\AGENTS.md' on Windows — the third instance of the class
2069691 fixed two of. The assertion three lines below was already written with
join; this one was not.

Swept the class rather than the report: every '/'-leading literal in the suite,
plus the state-file identities. This was the only expectation on the wrong side
of a join. Reproduced with node:path.win32, and the whole suite is green with
CI=true.
MSG
```

### Finding — the comment rule binds nobody, and the mechanism explains why (2026-10-07)

The developer asked why the "no comments" instruction had no effect on this slice. Traced: the rule exists in exactly one place — **a completed plan**, `docs/plans/completed/0012-skill-architect.md:143,145` (*"Default to no comments. Self-documenting identifiers first."*, *"Never comment the *what*; the code says what."*). It is in **no skill body**, and `docs/conventions.md` has no comment policy at all.

Even had it been a skill, it would not have bound: every coding skill — `builder`, `ponytail`, `architect` — installs as `slash` (loaded only when invoked by name) or `auto` (the model must choose to load it). Only `always` mode lands in a context window unasked, and the only `always` install in this repository is `instruction-ownership`. So the rule was invisible to every session that wrote code, and the failure is the same class 2b found twice in FLOW: a claim with no reader.

This is **3b's work**, not a side quest — the channel that renders "rules about how work is done" already exists (pi's `APPEND_SYSTEM.md`, verified loaded in slice 1) and already carries one rule. The question 3b has to answer is which rules belong in it, because everything placed there is paid on **every request** (the cost 0017's F1/F2 measures). Candidate homes, cheapest first: `docs/conventions.md` (read by `architect`/`ponytail` orientation, but only when those skills are invoked), the coding skills' bodies (`builder` is slash-only on both harnesses — the weakest home), or one line in the always-mode rule (binds every session, costs ~1 line of always-surface). No decision is recorded here; the finding is, with the evidence.

### Scoped and awaiting go — 2d: restore the review body's fidelity — 2026-10-07

The developer chose the body-fidelity call (open question (a)) and asked for it scoped before a line is written. This is that scope. **No go yet.**

#### Goal

The portable body is 211 lines against 2b's 300-420 estimate, and the gap is not evenly spread: the port kept the *method* and the dispatch contract, and lost the **specification** half. Artifacts the body still names are no longer defined, and the per-pass output contracts that made a pass's work checkable are gone. 2d restores the specification — enough that an independent harness runs this review as completely as FLOW's bundled agents did, without the reader re-inventing what a Discovery Map is. It does **not** restore the choreography, which was never the thin part.

#### What was dropped — measured, not remembered

Method, so it can be re-run: take 2b's deleted source (`git show 4b66b55^:packages/flow/skills/code-review/SKILL.md`, **573** lines), normalise both files line-by-line, and keep the v1 lines with no near-match in the portable body (difflib, cutoff 0.75). **355 of 574 lines** have no counterpart — most of that is FLOW's prose style, but six groups are substantive:

| dropped | v1 shape | portable today |
|---|---|---|
| **Discovery Map format** | a `#### Discovery Map` block, 35 lines: header fields, the clustering rule, a 6-row role-tag table, the symbols-touched heuristic | named three times (lines 50, 109, 115) and **never specified**; the single sentence at 109 is the entire definition |
| **Role-tag precedence** | 6 tags, "one tag per file, first match wins", `[test]` ordered before `[config]` before `[hub]` | one *processing-order* list (line 85) — classification and ordering are conflated, so a test file that also matches `[config]` mistags |
| **Per-pass output contracts** | peer-mirror rows `peer_site \| new_site \| status \| delta` under `### Peer pair: <new> ↔ <peer>`; gap-finder `G<ordinal> — file:line — \`<line>\` — {role-tag} — <risk class>`; verifier `FINDING <id> \| <tag> \| <justification>`; the dependencies lens's 7-item enumeration; the CVE and precedents return shapes | compressed to prose — the emit strings and headings are gone, so the same work produces differently shaped evidence per run, and reconciliation has less to reconcile |
| **Derived flags** | `LockstepSelfReview` (3 refs), `TreeInputMode`, intra-folder peers for a tree review, `PeerPairs` heuristics (stem similarity ≥60%, `I<Name>` ↔ `<Name>`, both-new exclusion) | `LockstepSelfReview` **0 refs** — while "lockstep-contract violation" survives in Step 5's severity rules (line 168): a **dangling reference**; `InScopeFiles` 8→2, `PeerPairs` 7→3 |
| **Artifact metadata derivation** | `date` / `author` / `repository` / `branch` / `commit` derived via `_shared/now.mjs` + `git-context.mjs` | dropped together with the `_shared` call sites — but `templates/review.md` still carries all five frontmatter fields and nothing says where their values come from |
| **Read economy, file orientation, isolation rationale** | "issue a `Read` only when (a)/(b)"; "hunks are evidence *within* a file's analysis, never the unit of analysis"; lens output under `### file/path.ext`; the DO-NOT-paste list, the self-check, and the observed failure mode (≈5× speedup with hallucinated findings and mis-cited lines) | the `-U30` / `-U10` / never-`-U0` rule survives (line 77); the orientation invariant and the enforcement list do not — one sentence at line 50 carries the rule without its teeth |

**Two defects the diff surfaces, both cheap and both real:** the **dangling reference at line 54** — "ask one clarifying question with the same four options below", where v1's four options (A) branch-vs-default → `auto`, (B) staged + unstaged → `modified`, (C) unstaged → `working`, (D) restate → free text, were never carried over (the table below line 54 is the 8-row translation table, not those four); and the **`LockstepSelfReview` reference** above.

#### Acceptance criteria

1. Every artifact or flag the body names is **defined where it is used** — `Discovery Map`, `InScopeFiles`, `ManifestChanged`, `PeerPairs`, `HasGatingPredicate`, `ReviewType` each have a definition, not only a use. Checked by grep per token, with the definition cited.
2. The Discovery Map is specified: header fields, clustering rule, symbols-touched hint, and a role-tag **classification** table with first-match-wins precedence, distinct from processing order.
3. Each analysis pass states its own output shape (heading plus row/emit format) beside the pass, and the verifier's per-finding row format is restored.
4. `LockstepSelfReview` has a derivation, **or** its reference in Step 5 is removed — no dangling reference in either direction, and the same check applied to the four clarifying options at line 54.
5. The artifact's frontmatter values are derivable with plain `git` and `date` commands written in the body — no `${SKILL_DIR}`-relative sibling script, no `_shared` call.
6. No pi-only tool name appears in the body — `advisor`, `ask_user_question`, `todo`, `flow-*`, `Write(` — checked by grep. Harness-specific dispatch stays parameterised as it is today.
7. Wave-1/2/3 vocabulary is **not** restored; the flattened orientation → lens → coverage structure keeps its existing barriers.
8. Body lands in **300-360 lines** — restored text is specification, not narrative; a body that hits 400 by padding fails this criterion even though 400 is inside 2b's original estimate.
9. `templates/review.md` stays byte-identical (moved verbatim in 2b; its shape already matches the restored contracts).
10. Gates stay green: `npm run build` → `npm test` → `npx biome check .`; a real-home `sync --dry-run` then reports the three `code-review` installs as the only drift, and a real `sync` re-installs them.

#### Budget

- **One file**: `src/skills/code-review/SKILL.md`, expected **+90-150 physical lines** (211 → 300-360), of which the restore itself is the whole of it — no new section is invented, each restored block has a v1 counterpart.
- `docs/conventions.md`: **0-5 lines**, only if the portability rule ("a portable body names no harness tool") is not already implied by the subagent-dispatch rule 2b added. No other doc, no ADR: this restores a decision the plan already recorded.
- **No new runtime file, no dependency, no config change, no sibling, no `skillset.config.json` edit.** No size ratchet applies: the body-size warning fires only for `always`-mode artifacts (`src/commands/install.ts:84-95`) and `code-review` declares pi `auto` + pi `slash` + claude-code `slash`.
- Measurement, as 2a/2b/2c each did: `wc -l` before and after, the mechanical diff re-run to show what residue is deliberate, and the three gates' output pasted into this plan.

#### Decisions

**Scope locked 2026-10-07: the full restore**, all six dropped groups plus both dangling-reference fixes and the parameterised adjudication rule below — 211 → 300-360 lines (criterion 8 unchanged). The two narrower options (core-only ≈285, minimal ≈245) were offered and declined; neither needs re-opening. Decision 2 stands as written unless struck; the alternative remains "drop adjudication entirely", which no longer removes anything but the inline dimension sweep.

1. **Specification yes, choreography no.** v1's wave vocabulary returns nowhere, including its own wart — Wave-1 dispatching prompts "defined in Step 3 below", which puts a pass's contract in a different section from its dispatch. Each pass's contract goes beside the pass.
2. **Adjudication is parameterised, not dropped.** v1's advisor path is pi's tool and cannot be named; the *inline* path beneath it (the 6-dimension sweep: data model / API surface / integration / scope / verification / performance) is harness-neutral and is what a harness without an advisor needs. Recommended: one short rule — "if this harness exposes an adjudication tool, flush findings, call it once, paste its prose verbatim as a blockquote; otherwise run the dimension sweep" — and no `advisor` identifier anywhere. **Strike this if you disagree; the alternative is dropping adjudication entirely.**
3. **Role-tag classification is restored with its precedence; the existing ordering list stays as ordering only.** One table, two clearly different jobs.
4. **`allowed-tools` is untouched by 2d** — it stays open question (b), and the restored body does not depend on it.

**Road not taken.** Keeping v1 as a second body with the portable one as a fallback for thin harnesses — two bodies for one capability, which is the drift this program exists to remove. Padding to 400 lines to sit inside the original estimate — the estimate measured a body that had not yet been written; a smaller body that names everything is the better read.

#### Confidence

**~93%.** The inventory is mechanical and re-runnable, the target is measured against the estimate, and the constraints are checked: no size ratchet (`install.ts:84-95`), no config or sibling change, and every gate green before and after because no runtime path changes. The residual is judgment — how much of v1's per-pass prompt text is *method* rather than FLOW's reporting taste — plus decision 2, which is yours. Nothing here is authorised; the go is a separate step.

### Implemented — 2d, the body-fidelity restore — 2026-10-07 (Review log)

The developer gave **go** on the full restore as scoped. One file changed in this repository: `src/skills/code-review/SKILL.md`. Nothing else was touched — no config, no sibling, no template, no runtime path — and the body is the only reason any gate could move.

**What was restored**, each block with a v1 counterpart rather than invented: the Discovery Map specification (header block, clustering rule, a first-match-wins role-tag table, the symbols-touched hint) and the separation of role-tag *classification* from *processing order*; per-pass output contracts — integration connections, the precedents row, the dependencies pass's seven-item enumeration, the advisory row, the peer-mirror row plus its `### Peer pair:` heading, the quality and security lenses' per-file sections and file order, the predicate-trace row, the gap-finder emit string, the verifier's `FINDING <id> | <tag> | <justification>` row, the summary block, and the follow-up rules; the derived flags `LockstepSelfReview`, `ReviewType`, `TreeInputMode`, the `PeerPairs` heuristics (stem ≥ 60%, interface/impl, shared suffix, both-new exclusion) and intra-folder peers; artifact frontmatter derived with plain `git` and `date` instead of the `_shared` scripts; the read-economy and file-orientation invariants; the isolation enforcement list with its self-check; and the parameterised adjudication rule, which names no harness tool. Both dangling references are closed — the four clarifying options are back at Step 1, and `LockstepSelfReview` has a derivation where it previously had only a reference. Also restored: the section-omission and not-emitted rules, the title-line annotations, and the security lens's *prefer false negatives* stance.

**Measured against its budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| body | 211 → 300-360 lines | 211 → **301** (`git show HEAD:… \| wc -l` = 211) | met, by one line — see the note |
| physical lines | +90-150 | **+108 / −18 = +90 net** | met |
| files | one (`SKILL.md`) | one | met |
| config / siblings / template / dependency | none | none (`templates/review.md` and `_helpers/review-range.mjs` show no diff) | met |
| docs | 0-5 lines | **0** | met — the portability rule was already implied by 2b's dispatch rule |

**The one-line note, stated rather than smoothed over.** The first pass landed at **299**, one line under the floor, because three restored items compressed into fewer physical lines than estimated. Rather than amend the criterion down, two genuine v1 items still outstanding were restored: the run's step index near the top of the body, and the security lens's adjacent-context precision (an added, modified or reworded adjacent line is in region; a pre-existing sink is not). Body 299 → **301**. The scope was not widened on the second pass; both items come from v1 and were already in the dropped-group inventory.

**Criteria as built.**

1. Holds — `Discovery Map` (7), `ChangedFiles` (7), `InScopeFiles` (2), `ManifestChanged` (3), `LockstepSelfReview` (2), `HasGatingPredicate` (3), `PeerPairs` (3), `ReviewType` (2), `TreeInputMode` (1), `patch_path` (2), `null_tree` (2), `blockers_count` (5) each have a definition at first use.
2. Holds — `#### The Discovery Map` carries the header block, the clustering rule, the first-match-wins table (six rows, `[test]` before `[config]` before `[hub]`) and the symbols-touched hint; Step 1's ordering list now says explicitly that it is not the classification rule.
3. Holds — each of the five orientation passes, both lenses, the predicate trace, the gap finder and the verifier states its own output shape beside the pass.
4. Holds — `LockstepSelfReview` is derived at Step 1.4 and read by the dependencies pass; the four clarifying options (A)-(D) are restored at Step 1.1.
5. Holds — five frontmatter values derived from `date -u`, `git remote get-url origin`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse --short HEAD`, with `unknown` preferred to a guess for the author. No `${SKILL_DIR}`-relative script and no `_shared` call added.
6. Holds — `grep -nE "\badvisor\b|\bask_user_question\b|\btodo\b|\bflow-[a-z]|Write\("` returns **nothing**. The adjudication rule is phrased generically ("if this session exposes an adjudication tool"), so the harness-specific step is described, not named.
7. Holds — `grep -ni wave` returns nothing.
8. Holds — 301 lines, in range.
9. Holds — `templates/review.md` is byte-identical to `HEAD`'s copy (no diff).
10. Holds, by execution:

```sh
npm run build && npm test      # 26 files / 259 tests passed
npx biome check .              # 68 files clean
node dist/cli.js sync          # exit 0 — 3 written
node dist/cli.js sync --dry-run # checked undeclared 8 · in-sync 32
```

**Propagated and verified after the write, not assumed.** All three installed copies were `drifted` against the restored source and were repaired. The installed skill now carries `#### The Discovery Map`, `first match wins`, `LockstepSelfReview`, `FINDING <id>` and `Review type:` — each present exactly once in both the pi skill directory and the pi slash prompt, so the restored specification is live rather than merely committed. Regression checks on 2b's wiring both still hold on the real home: FLOW's harvester returns `code-review` with `required: ["blockers_count"]` and `artifactKind: review`, and `node ~/.pi/agent/skills/code-review/_helpers/review-range.mjs "file:README.md"` prints `default_branch: main / strategy: tree`. Both siblings remain byte-identical to their bundle sources.

**What is deliberately left unrestored — classified, so the number is not a loose end.** Re-running the mechanical diff against v1: **327 of 574 lines** still have no counterpart (down from 355). Split: **189** are v1's indented literal per-agent prompt prose (the `subagent_type:` / `Prompt:` blocks the plan already treats as one implementation's choreography), **20** are wave vocabulary or its barriers, **22** are pi-only machinery (`${SKILL_DIR}`, `_shared/*` call sites, `$ARGUMENTS`, `shell-timeout: 10`, `## Metadata`, `advisor`), and **97** are other — mostly lines the restore *rewrote* rather than dropped (a line-level diff counts a reworded line as residue), plus v1's own headings. The judgment call is in the 189, and it is the same call 2b made: the method and its contracts are restored; the verbatim prompt prose is not part of the portable body.

**Not yet done.** Nothing is committed. Both changed files are in this repository only.

### Open question (b) — scoped and awaiting go: the target keeps its own `allowed-tools` pattern — 2026-10-07

#### Goal

Close open question (b). The developer's criterion, stated 2026-10-07, decides the shape of the answer: **skillset does not choose a permission level — it only guarantees the field is available in each target.** Permission content is the developer's to set in each harness. So (b) is not "should we widen permissions" and it is not "should we port something": it is exactly two questions, and only the second has work in it.

1. **Is `allowed-tools` expressible on claude-code?** Yes — already. Nothing to declare, nothing to port.
2. **Does a skill's declared value survive to the artifact?** No. The slash renderer writes its own value for the same field and lets the skill overwrite it, so the one pattern the target's own trailer depends on is silently dropped the moment any skill declares the field.

#### What is true today — measured, not read

- **No content to port.** `grep -rn "allowed-tools" src/skills/` returns nothing. Only `code-review` has a `targets:` block at all, and it is `targets.pi`. The developer's read ("we have nothing to port") is correct.
- **The field is expressible for claude-code in both modes that could carry it**: `src/targets/claude-code.ts:145-176` lists it in `CLAUDE_SKILL_FIELDS` and therefore in `CLAUDE_COMMAND_FIELDS`. `fieldSupport()` (`src/core/declarations.ts:390-412`) warns for neither, so a skill declaring it gets no diagnostic at install or sync time — including no diagnostic for the breakage below.
- **The clobber, shown by the target's own `preview`** (`node` probe against `dist/targets/claude-code.js`, synthetic skill, `mode: slash`):

```
### targets.pi only                allowed-tools: "Bash(skillset *)"          trailer: true | skillset pattern: true
### + allowed-tools: Bash(git *) … allowed-tools: "Bash(git *) Bash(date *)"  trailer: true | skillset pattern: false
### + allowed-tools: [Bash(git *)]  allowed-tools: ["Bash(git *)", Read]      trailer: true | skillset pattern: false
```

The trailer is appended regardless, so the artifact asks Claude Code to pre-approve nothing for its own `!`skillset track sk-code-review`` line — and per the comment at `claude-code.ts:38-44` the permission gate **blocks** a `!`-command that matches no allowed pattern, which is the failure that comment records. One field, two owners (the target's trailer, the skill's own needs), single-valued, skill wins. Nothing declares the field today, so the breakage is latent.
- **The undeclared case must not move.** The as-shipped render of `code-review` is **byte-identical** to `~/.claude/commands/sk-code-review.md` (which carries `allowed-tools: "Bash(skillset *)"`), and that install is part of the `in-sync 32`. Any rule that changes the undeclared render marks every claude-code slash artifact on this machine `drifted`.

#### Acceptance criteria

1. A skill declaring **no** `targets.claude-code.allowed-tools` renders byte-identical to today: `allowed-tools: "Bash(skillset *)"`, target pattern first. Checked against `~/.claude/commands/sk-code-review.md`.
2. A skill declaring it as a **string** renders the target's pattern plus its own, both present, target's first: `"Bash(skillset *) Bash(git *) Bash(date *)"`.
3. A skill declaring it as a **flat array of strings** keeps the array shape and gains the pattern as a first element: `["Bash(skillset *)", "Bash(git *)", Read]`.
4. A declaration that **already contains** `Bash(skillset *)` is not duplicated.
5. `renderSkillFile` (auto / always) is **unchanged** — auto mode still writes no `allowed-tools` of its own, and the existing `does not append a trailer for auto mode` assertion stays green.
6. Each new test **fails first** against the current renderer and passes after; the two assertions in the AC-2/AC-3 rows are the red evidence, pasted into this plan.
7. No change to any skill body, `skillset.config.json`, sibling, template, or dependency.
8. Gates green: `npm run build` → `npm test` → `npx biome check .`, then `node dist/cli.js sync --dry-run` reports **`checked undeclared 8 · in-sync 32`** with nothing newly drifted — the installed artifacts' bytes are unchanged, so propagation writes nothing.

#### Budget

- `src/targets/claude-code.ts`: **+8 / −1 logic lines** (one pattern constant, one merge helper for the two renderable shapes, the frontmatter object) plus a 3-5 line comment recording why the target's own pattern is non-negotiable. Physical ≈ +13 / −1.
- `src/targets/claude-code.test.ts`: **2 tests**, ≈ 30 physical lines, one for AC-2 (string merge) and one for AC-3 (array merge) — AC-1 and AC-4 are covered by extending the existing slash test's second assertion (~3 lines).
- `docs/plans/0023-…md`: this section, ~35 lines.
- **No new file, no dependency, no config, no skill content, no sibling, no template.** Expected implementation-logic total **≤ 10 lines**; physical range across the two code files **40-50**.

#### Decisions

1. **Merge, not clobber, and the target's pattern goes first.** First keeps the undeclared render and every existing artifact's bytes stable (AC-1) and keeps diffs readable.
2. **Slash only.** `renderSkillFile` is not touched: the trailer — the only reason the target has an opinion — exists only in slash mode (`slashTrailer` returns null otherwise), and the `auto` test pins that no field appears there.
3. **Two shapes are handled, because two shapes are renderable.** A string is merged textually; a flat array gains an element. Any other type is left alone for the existing renderer to accept or throw on — no third normalisation path.
4. **`disallowed-tools` is not defended.** A skill that adds our pattern to `disallowed-tools` blocks its own trailer. That is self-sabotage, no skill does it, and code for it would be speculation.
5. **No ADR.** The invariant is target-internal — *a target's own appended command must remain permitted by the artifact it writes* — not a cross-cutting rule, and it changes nothing about ownership or dependency direction.

**Road not taken.** Dropping the trailer so the field needs no merging — trades a live feature (on/off tracking in pi and claude-code alike) for a latent bug. Warning instead of merging — reportable, but it leaves the trailer breakable and is more machinery than a five-line fix. Declaring `Bash(git *)` ourselves for the review — that is permission policy, which the developer explicitly does not want skillset to hold.

#### Confidence

**~95%.** The clobber and the byte-stability of the undeclared case are both **measured** (the `preview` probe and the byte-identical comparison above), which is what AC-1 and AC-2 rest on, and the whole change is one function in one target. Residual: Claude Code's actual gate behaviour — that a `!`-command matching no allowed pattern is blocked — rests on `claude-code.ts:38-44`'s comment and the 2c doc fetch, not on execution here (no authenticated claude-code session in this repository). It is not load-bearing for the fix: even if the gate merely prompted instead of blocking, a skill silently deleting the target's declared value is still the wrong composition, and AC-1-AC-4 hold either way.

Nothing is authorised. ~~The go is a separate step.~~ **Go given 2026-10-07; implemented below.**

### Implemented — (b), the target keeps its own `allowed-tools` pattern — 2026-10-07 (Review log)

The developer gave **go** on the scope above. Two files changed in this repository: `src/targets/claude-code.ts` (one constant, one merge helper, the frontmatter composition) and `src/targets/claude-code.test.ts` (three cases plus a shared helper). No config, no skill body, no sibling, no template, no dependency.

**What landed.** `mergeAllowedTools` merges instead of replacing, target pattern first: an undeclared field returns `Bash(skillset *)` exactly as before, a string gains the pattern as a prefix, a flat array gains it as a first element, and either shape is left alone if it already names the pattern. `renderCommandFile` composes the merged value over the declared one, so the spread can no longer delete it. `renderSkillFile` — auto and always modes, which append no trailer — is untouched. One thing the scoping did not predict: `rest["allowed-tools"]` needed an index signature on the destructured cast, because `tsc` refuses the implicit `any`; the build gate surfaced it, one line, no net growth.

**AC-6 red evidence, first — the tests failed against the old renderer**, which is what makes them the criterion rather than an assertion of the new behaviour:

```
 × keeps the target's pattern alongside a declared string
   → expected 'allowed-tools: "Bash(git *) Bash(date *)' to be 'allowed-tools: "Bash(skillset *) Bash…'
 × keeps the target's pattern alongside a declared array, as an element
   → expected 'allowed-tools: ["Bash(git *)", Read]' to be 'allowed-tools: ["Bash(skillset *)", "…'
 Test Files  1 failed (1) | Tests  2 failed | 14 passed (16)
```

**AC-6 red evidence, second — AC-1 caught a real defect in my own first implementation.** The initial `mergeAllowedTools` handled only the string and array shapes, so the undeclared case returned `undefined` and `compose` dropped the key: the artifact was written with **no `allowed-tools` at all**, i.e. the merge rule itself deleted the target's pattern in the one case every installed artifact uses. The AC-1 assertion I had just tightened caught it:

```
 FAIL … claude-code target — write-on-invoke trailer > appends a track line + allowed-tools for a slash skill
 AssertionError: expected '…' to contain 'allowed-tools: "Bash(skillset *)"\n'
 Test Files  1 failed (1) | Tests  1 failed | 15 passed (16)
```

Fixed by making `undefined`/`null` return the pattern. Both red transcripts are the reason AC-1 and AC-6 were written as they were: a rule that preserves a field is worthless if it silently omits it when nothing declares one.

**Criteria as built.**

1. Holds — every claude-code slash artifact on this machine still carries exactly `allowed-tools: "Bash(skillset *)"` (one unique value across all 10 files, `grep -h "^allowed-tools:" ~/.claude/commands/sk-*.md | sort -u`), and the tightened test asserts the line including its newline, so a merged value cannot pass it.
2. Holds — pinned by exact bytes: `allowed-tools: "Bash(skillset *) Bash(git *) Bash(date *)"`.
3. Holds — pinned by exact bytes: `allowed-tools: ["Bash(skillset *)", "Bash(git *)", Read]`; the array shape is preserved, the pattern is an element.
4. Holds — a declaration already naming the pattern renders unchanged, because the whole value ships verbatim when it already contains it.
5. Holds — `renderSkillFile` is unmodified and the existing `does not append a trailer for auto mode` assertion (`not.toContain("allowed-tools")`) stays green.
6. Holds — both red transcripts above; the first run was red on the two merge cases, the second on the undeclared case.
7. Holds — `git diff --numstat` shows two source files and this plan; no skill body, config, sibling, template, or dependency changed.
8. Holds, by execution, in this order:

```sh
npm run build                   # tsc + copy-skills, clean
npx biome check .               # 68 files clean
npm test                        # 26 files / 262 tests passed
node dist/cli.js sync --dry-run # checked undeclared 8 · in-sync 32
```

**A pre-existing drift was found while checking AC-8, and it contradicts the handoff.** The first dry-run of this slice reported **`drifted 3 · undeclared 8 · in-sync 29`**, not 32. The three were exactly 2d's installs — `code-review` on claude-code slash, pi auto and pi slash — and their diff was the run-order index line added in **2d's second pass** (299 → 301), absent from every installed copy: `git show HEAD:src/skills/code-review/SKILL.md | grep -n "The run, in order"` → present at line 37; `grep -n "The run, in order" ~/.pi/agent/skills/code-review/SKILL.md` → absent. So `sync`'s "3 written" and the handoff's `in-sync 32` were true *before* that second pass, and the second pass was never re-propagated. Nothing about this slice caused it (two of the three drifted artifacts are pi, which this change does not touch, and the diff is body text, not frontmatter). Running `sync` reconciled all three — `reconciled drifted 3 · undeclared 8 · in-sync 29 · 3 written` — and the follow-up dry-run is `checked undeclared 8 · in-sync 32` with nothing drifted. The lesson this plan already wrote down held again: **verify the installed copy, not the committed one, and re-run the dry-run after every write** — a transcript from the first pass is not evidence about the second.

**Measured against its budget — over, with the reasons, not smoothed.**

| area | budget | measured | verdict |
|---|---|---|---|
| `claude-code.ts` logic | +8 / −1 | **+15 logic lines** (+9 comment, +4 brace-only = +28 / −3) | **over by 7** |
| `claude-code.ts` comment | 3-5 lines | 9 | over by 4 |
| `claude-code.test.ts` | 2 tests, ≈30 lines | **+53 / −1**, 3 cases + helper (8 comment, 45 code) | over by ~20 |
| physical, both code files | 40-50 | **81 added / 4 removed** | over by ~30 |
| config / skill body / sibling / template / dependency | none | none | met |
| `docs/plans/0023-…md` | ~35 lines | +61 / −3 | over — this section reports the drift finding too |

Why the estimate was low, stated rather than rounded away: the merge is four branches, not two — each shape needs a presence check *and* a merge expression — and the `undefined` guard is a fifth line that the red test forced (without it the rule deletes the pattern it exists to protect; that is a line the estimate had no way to anticipate). The comment count assumed 3-5 lines where this file's convention is to carry the *why* at the point of decision; both new blocks have a why a reader would otherwise re-derive wrong, and I chose that over brevity because the alternative is a future session "simplifying" the merge back into a spread. The tests are over because each of the three cases asserts exact rendered bytes rather than `toContain` — the loose form would have passed against the broken renderer, which is the entire point of AC-1 and AC-4. No criterion fails and nothing speculative was built; if the overage is not acceptable, the trims are the 9 comment lines and one of the three test cases, and I would take them on request rather than assume them.

**Not yet done.** ~~Nothing is committed. Three files are dirty in this repository: the two source files and this plan.~~ **Committed — `90610ef`**, all three files, after the gates were green and the installed copies verified (`in-sync 32`, nothing drifted). Nothing about (b) is pending.

### Corrected outside both repositories — 2026-10-08

`~/.pi/agent/AGENTS.md` was rewritten by hand, at the developer's explicit go and with the change shown before it was applied (their standing condition). This is decisions-asserted item 5 being executed a little early: the file is still the developer's, and its hand-written text had drifted from the program it describes.

**Four statements were false, each measured before the edit:**

| the file said | measured |
|---|---|
| propagate the auto set with `node scripts/sync-pi-auto.mjs` | the script was deleted in slice 1 |
| agents are hash-tracked in `~/.pi/agent/agents/.flow-managed.json` | deleted in 3a |
| agent sources are `packages/flow/agents/*.md` — "edit the FLOW source" | that directory was deleted in 3a; this repository installs the roster |
| "Two names currently exist in both places, `code-review` and `remediate`" | false since 2b — FLOW ships `flow-remediate` only |

Also retired: the frame "they are two owners, not one" (there is one owner now) and the enumerated auto set (`architect`, `caveman`, `ponytail`, `commit-suggestion` — short by `code-review` since 2b). The rewrite points at the declarations instead of enumerating their result, which is what stopped the old text drifting in the first place.

Result: **39 → 35 lines, 2,470 → 2,277 bytes**; the commit rule byte-identical; `grep` for all four stale strings returns nothing. It binds from the next session, since the file is loaded at session start. The file keeps the **map** (sources, propagate, where they land, the extension asset); under 3b the **rules** leave it for the always channel.

### 3b — scoped and awaiting go: the standing rules move into the channel that exists — 2026-10-08

#### Goal

Two rules a session must obey *before* it acts have no rendered home. "Commits carry no trailers" lives in `~/.pi/agent/AGENTS.md`, hand-written; "code carries no comments" lives only in a completed plan (`docs/plans/completed/0012-skill-architect.md:143,145`) that no session loads. **3b renders both into pi's always channel** — the one channel this repository already writes, whose load into the system prompt slice 1 verified live — and moves the rule-shaped ownership text out of the hand-written file, so every rule has exactly one copy.

Scope settled by the developer 2026-10-08: **rules into the existing channel; `AGENTS.md` keeps the map and stays hand-owned until 3c renders the context file**, where project scope gives that channel a consumer. **No new mode, no new artifact kind, no second anchor, no runtime code.**

#### What is true today — measured 2026-10-08

- `~/.pi/agent/APPEND_SYSTEM.md` holds one marker block, `instruction-ownership`, `always` on pi: 213 words ≈ **277 estTokens** by this repository's published estimator (words × 1.3, `pi-extensions/packages/flow-test-utils/token-surface.ts`).
- **Two blocks coexist in one file, and the machinery already targets them individually** — executed against the built bundle, not read:

```sh
$ node -e "upsert two skill names into one file; extract each; remove one"
after two upserts  both blocks, in order, surrounding user text intact
extract('instruction-ownership') → "RULE A"   extract('standing-rules') → "RULE B"
after removing one  the other block survives; the user's text survives
```

  `src/bridges/pi/index.ts:111-115` upserts by skill name, `:144-151` removes by skill name and deletes the file only when it is empty, and `markers.test.ts:58` already pins "extract targets only the named block among several".
- **Reach does not change.** The commit rule is read by pi alone: `~/.claude/CLAUDE.md` and opencode's global `AGENTS.md` do not exist on this machine, and claude-code never reads `~/.pi/agent/**`. pi-only before, pi-only after.
- **The comment rule is single-copy and unloaded.** `grep -rni "comment" src/skills/*/SKILL.md docs/*.md` finds no policy; `grep -rni "self-documenting\|never comment" src/ docs/` finds only `completed/0012:143,145`.
- **This plan's own retro finding is overstated, and this entry is the correction.** It predicted `src/skills/retro/SKILL.md:33` "will keep generating that mistake". Measured: line 33 lists *both* channels and line 36 already tells the reader to find the managing project before editing anything under a global agent dir. **retro needs no edit.**
- **Cost, measured per file.** `AGENTS.md` is 295 words ≈ 384 estTokens today; the commit rule (43 words ≈ 56) and the one-provider rule (86 words ≈ 112) leave it, and the always block gains those two plus the new comment rule (≈ 91). **Net +91 estTokens of default-loaded surface**, and that is exactly the one new rule.

#### Acceptance criteria

1. `~/.pi/agent/APPEND_SYSTEM.md` carries **two** marker blocks after a real `sync`, and each removes on its own `uninstall` leaving the other intact — proved end to end, not by the marker unit test alone.
2. Each rule exists in **exactly one repository artifact** — the rendered body — and is absent from `AGENTS.md`: `grep -c "Co-Authored-By" ~/.pi/agent/AGENTS.md` is 0 while the same string is in `src/skills/standing-rules/SKILL.md`.
3. **The rules bind in a live session, by slice 1's method**: a fresh `pi --print` process run from `/tmp`, with no skillset context, reproduces text that exists only in the installed block. Transcript in the plan.
4. The text that leaves `AGENTS.md` — the commit rule and the one-provider paragraph — arrives in the rendered bodies **without paraphrase**, so the developer's own wording survives the move, and `AGENTS.md` afterwards carries the map only.
5. The map stays unmanaged: `AGENTS.md` appears in no record, is reported nowhere by `sync --dry-run`, and its four falsified statements stay fixed.
6. `sync` reports the new install as the only addition — `undeclared 8` unchanged, nothing `foreign` — and a second `sync --dry-run` reports `in-sync 63`.
7. Each always body stays under the existing size warn (`warnIfBodyLarge`, `SKILLSET_ALWAYS_WARN_LINES`, default 80), and the always surface is recorded after the change: 213 words → **~417 words across two blocks**.
8. **No runtime logic change**: `git diff --stat` names only `src/skills/**`, `skillset.config.json`, tests, docs and this plan — nothing under `src/core/**`, `src/bridges/**` or `src/commands/**`.
9. `retro` is not edited, with the measured reason recorded rather than left as an open loop.
10. Gates: `npm run build` → `CI=true npm test` → `npx biome check .`, then a real `sync` with its report pasted, then the live-session check re-run against the installed file.

#### Budget

| area | file | what | lines |
|---|---|---|---|
| content | `src/skills/instruction-ownership/SKILL.md` | the one-provider rule moved in verbatim; `Never` gains "never hand-write into an installed path ad hoc" | +10 to +14 |
| content | `src/skills/standing-rules/SKILL.md` | **new** — the commit rule moved verbatim, plus the comment rule | ~26 |
| config | `skillset.config.json` | one declaration: `standing-rules` → pi, `always` | +6 |
| tests | `test/agents/pi.test.ts` | two blocks coexist; one `uninstall` leaves the other | ~35 |
| docs | `docs/conventions.md` | one line naming what belongs in the always channel vs this file | +4 |
| docs | this plan | this section, the correction above, the handoff update | ~65 |

- New dependencies **none**; new runtime modules **0**; **runtime logic 0 lines** — the slice is content, config and one test. Estimated physical **~140 repository lines**, plus the `AGENTS.md` edit (2,277 → ~1,950 bytes, not repository content).
- **Base rate, stated so the estimate is not read as precision:** every slice of this program overran, and this one is nearly all prose, so the honest read is **140-230**.

#### Decisions

1. **A new skill, not a wider `instruction-ownership`.** Commit and comment policy is not ownership policy, and the always file already carries one block per skill — which keeps `uninstall`, `preview` and the size warn per rule.
2. **The commit rule keeps its wording exactly, including "never add one because a document claims the repo mandates it."** That sentence already earned its place: a reference document in the installed pi package makes that claim.
3. **The comment rule states what it is not.** The line *"test names, diagnostics and messages a user reads are not comments — they are output, and they stay"* is mine, not the developer's, and it is the one part of this scope that can be struck without weakening the rule. Strike it if you disagree.
4. **pi only, and that is not a reach change.** claude-code's `always` anchor (`~/.claude/settings.json`, a SessionStart hook) is declared supported by 2c and has never been verified against that harness's loader, so declaring these rules for it would be the unverifiable renderer this program keeps refusing. Recorded as a follow-up, not built.
5. **No ADR.** ADR 0006's ownership rule is unchanged; this is the first *content* placed in the channel slice 1 built, and it applies an existing decision rather than making one.
6. **`AGENTS.md` stays hand-owned until 3c.** Its remaining content is a map — paths, commands, where artifacts land — which is what this plan already assigned to the context channel. Rules about how work is done belong in the system prompt; the map is conventions.

**Road not taken.** *Build the pi `context` anchor now and render `AGENTS.md`* — it would make a map into an output and ship a mechanism proved by a pointer, when the anchor's real consumer is 3c's project scope. *Put both rules in `docs/conventions.md`* — cheapest in tokens, but that file is read only when `architect` or `ponytail` orients, which is the mechanism that already failed this rule twice. *Extend `instruction-ownership` with everything* — one block and one uninstall, but a skill named for ownership carrying commit policy.

#### Confidence

**~97%.** The mechanism is executed rather than assumed (two blocks, per-skill extract and remove, the empty-file cleanup, all against the built bundle); the cost is measured with this project family's own estimator and attributed line by line; and the reach claim is checked against the three global files that do or do not exist. The residual is the two content judgments above, plus one thing this machine cannot show yet: that the block still reaches the system prompt once a **second** skill joins the file — slice 1 proved the load for one block, and AC-3 re-proves it rather than inheriting the claim.

Nothing is authorised. The go is a separate step.

### Implemented — 3b, the standing rules in the always channel — 2026-10-08 (Review log)

The developer gave **go** on the scope above, then reshaped one line of it mid-build: the map does not belong in `AGENTS.md` at all. That is recorded as the supersession it is, below, rather than folded in silently.

**What landed.** `src/skills/standing-rules/SKILL.md` (pi, `always`) carrying the commit rule and the comment rule; `instruction-ownership` gained the one-provider rule (moved verbatim) and a `Never` entry for ad-hoc writes to any installed path; one config declaration; one end-to-end test; and a new `## Rules every session loads` section plus a new `## Where each artifact lands` table in `docs/conventions.md`. No file under `src/core/**`, `src/bridges/**` or `src/commands/**` was touched.

**Criteria as built.**

1. Holds — two blocks in one file, and each removes alone. The new test installs both by **declaration** (no `--mode`), removes one, and asserts the other survives and the file stays:

```sh
$ grep -n "skillset:begin\|skillset:end" ~/.pi/agent/APPEND_SYSTEM.md
2:<!-- skillset:begin instruction-ownership -->   33:<!-- skillset:end instruction-ownership -->
35:<!-- skillset:begin standing-rules -->          47:<!-- skillset:end standing-rules -->
```

2. Holds — `grep -c` in `~/.pi/agent/AGENTS.md`: `Co-Authored-By` **0**, `two providers of one name` **0**, `hand-write anything into an installed path` **0**; each present once in the repository sources.
3. Holds, by the slice-1 method — a **fresh** `pi --print` process run from `/tmp`, no skillset context, answering from what it loaded:

```
1. PRESENT
2. One provider per name
3. Test names, diagnostics and messages a user reads are not comments — they are output, and they stay.
4. Never two providers of one name in one harness — not "never a colliding name".
```

4. Holds with **one deviation**: the rule text is character-identical across `AGENTS.md` → source → installed block (checked by normalising and comparing all three), except that the commit rule's sentence-ending `— ever.**` became the heading `— ever`, which the heading form requires. **The second half of the criterion is superseded** — see *Superseded* below.
5. Holds — `AGENTS.md` appears in no record and in no `sync` report, and the four falsified statements stay fixed.
6. Holds exactly as predicted — `reconciled drifted 1 · missing 1 · undeclared 8 · in-sync 61 · 2 written`, then `checked undeclared 8 · in-sync 63`. The `drifted 1` was `instruction-ownership`'s own source change, and its message read *"edited locally"* although the source moved — the recorded diagnosis defect, observed again rather than fixed.
7. Holds — bodies are 30 and 13 lines against the 80-line warn, and the measured always surface is **433 words ≈ 563 estTokens** in two blocks (predicted ~417 words / ~536).
8. Holds — `git diff --stat` names `docs/conventions.md`, `skillset.config.json`, `src/skills/**`, `test/**` and this plan; nothing in `src/core/**`, `src/bridges/**` or `src/commands/**`.
9. Holds — `retro` untouched, with the measured reason recorded above.
10. Holds — `npm run build` · `npx biome check .` (78 files) · `CI=true npm test` → **31 files / 317 tests** (was 316; +1 case).

**One existing test was amended, and it is a file 3b's budget did not list.** `test/agents-kind.test.ts:61` pinned `checked in-sync 62`; the new declaration makes it 63. One line, and the reason is AC-6's own arithmetic rather than a regression. Nothing else moved: `undeclared 8` is unchanged.

**Superseded mid-slice — the map leaves `AGENTS.md`.** After the build, the developer's read was that the file should carry the *most important rules* and not the inventory of where things live; asked to choose, they took the shrink. So AC-4's clause "`AGENTS.md` afterwards carries the map only" does not describe the result, and neither does AC-5's frame:

- `AGENTS.md` is now **13 lines / 76 words ≈ 99 estTokens** — a pointer at this repository's `docs/conventions.md` and the always skill bodies, plus the two facts no doc carried. It was 35 lines / 384 estTokens at the start of the session and 22 / 207 after the correction. **285 estTokens/session less than where this session found it.**
- **The map moved into `docs/conventions.md`**, not out of existence: a new `## Where each artifact lands` table gives the global path per (mode, harness) for all four, the local-scope exceptions, and the two pi paths that are not install records. `~/.skillset/state.json` is named there too.
- **This corrects a claim the scoping got wrong.** The question put to the developer said conventions.md "already teaches … the target paths per mode"; it does not — `grep -c 'prompts/sk-' docs/conventions.md` was **0** before this slice. The shrink therefore needed the paths *added*, not just pointed at, which is why `docs/conventions.md` came in at **+20 lines against a +4 budget**. The estimate's premise was wrong, not the file's size.
- The pointer's own sentence "never edit an installed copy" was **cut on the first pass and the file re-cut**: it is a rule, it already lives in the always block, and a pointer that restates a rule is the second copy this program removes.

**Amended after review — the branch, and the queue's home (2026-10-08).** The developer's objection was that a sentence in the installed pointer — *"Change the source and run `skillset sync`; never edit an installed copy"* — is wrong advice for a session in another project: **only a session running in this repository may edit content and sync**, because one project's request can be locally sensible and wrong in the wider view. Every other session's whole answer is to file a suggestion and stop. Measured first: that sentence was **already absent** from `AGENTS.md` (12 lines; `grep` returns nothing), cut in the shrink's second pass — so the objection landed on the always block, which is the file that binds. Its `## Instead` was three numbered steps that opened with the skillset-repo instruction and mentioned "in another project" as a trailing caveat. It now branches **first**, in two scopes, and the second scope's entire answer is the suggestion. Verified in the installed copy: the old wording greps **0**, the branch and the queue path are both present.

Then the queue's location changed, because the branch made its missing reader obvious. It was `.skillset/suggestions.jsonl` in the **filing project** — no queue file existed anywhere, and a session in this repository can neither see another project's queue nor know which projects to look in, so "a future skillset session picks it up" had no mechanism. It is now **this repository's** `.skillset/suggestions.jsonl` (gitignored; one queue for every project), read and cleared by a session working here, which decides what is real. ADR 0006 is **appended to** rather than edited — it records the move and why — and `docs/conventions.md` and the skill body carry the path. No `suggestions` verb is built: `cat` reads the queue, editing the file clears it, and that is the ladder's answer until the queue is big enough to want more.

**Measured against the budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| `instruction-ownership/SKILL.md` | +10 to +14 | **+5** | under |
| `src/skills/standing-rules/SKILL.md` | ~26 | **18** | under |
| `skillset.config.json` | +6 | **+6** | met |
| `test/agents/pi.test.ts` | ~35 | **+19** | under |
| `docs/conventions.md` | +4 | **+20** | **over by 16** — the wrong premise above, not drift |
| `test/agents-kind.test.ts` | not budgeted | **1 line** | beyond the list, forced by AC-6 |
| `.gitignore` | not budgeted | **+1** | the queue's new home is not repository content |
| `docs/decisions/0006-*.md` | not budgeted | **+2** | an appended amendment, not an edit |
| this plan | ~65 | over | it carries the whole record |
| runtime logic | 0 | **0** | met |
| dependencies / runtime modules | none / 0 | none / 0 | met |
| `AGENTS.md` | 2,277 → ~1,950 B | **642 B** | outside the repository; the developer's call changed the target |

**Findings recorded, not fixed.**

- **The suggestion queue now has a writer and a reader, and its command arm is closed by 3b-ii.** The location is `~/.skillset/suggestions.jsonl` (beside `state.json`); `skillset suggest "…"` appends from any project, `retro` carries the step for sessions that do not think of it, and a session working here reads and clears it. Listing and clearing remain `cat` and an edit — deliberately, until the queue is worth a flag.
- **The README's `## Bundled skills` list omits `instruction-ownership` and now `standing-rules`.** Adding rows is a doc change outside this budget. *(Fixed 2026-10-08, with `context-pointer` as well — all 16 bundled skills are catalogued and a `comm` against `src/skills/` is empty; see the note under *Amended — the standing-rules block learns what a blocked command means*.)*
- **claude-code's `always` anchor remains unverified against its loader.** The same two rules would reach claude-code sessions through it, but 2c declared that mode from documentation and nothing has exercised it — declaring them there would be the unverifiable renderer this program keeps refusing.

**Commit — drafted, never run.** ~~This slice adds a file, so `git add -A`, never `git commit -am`.~~ **Superseded**: 3b and 3b-ii are uncommitted in one tree, so the pair's draft is under *Implemented — 3b-ii* below. The original single-slice text is kept here only as a record of what was drafted at the time.

```sh
git add -A && git commit -F - <<'MSG'
skillset: the standing rules reach the channel that binds (0023 slice 3b)

Two rules a session must obey before it acts had no rendered home: commits carry
no trailers lived in the hand-written ~/.pi/agent/AGENTS.md, and code carries no
comments lived only in a completed plan. Both are now a skill body rendered into
APPEND_SYSTEM.md as its own marker block, so each rule has exactly one copy.

instruction-ownership gains the one-provider rule and a Never entry for ad-hoc
writes to any installed path; standing-rules is new. No runtime code changes —
the slice is content, one declaration, one end-to-end test and two docs sections.

AGENTS.md shrinks to a pointer plus the two facts no doc carried, and the map of
where each artifact lands moves into docs/conventions.md, where it is read on
demand rather than paid every session (384 -> 99 estTokens).

The ownership rule now branches first: a session running in this repository edits
the source and syncs, and every other project files a suggestion and stops. The
queue moves into this repository (`.skillset/suggestions.jsonl`, gitignored, one
for every project) because a project-local file had no reader.

Gates: build, biome clean, CI=true 31 files / 317 tests. sync: in-sync 63.
MSG
```

### 3b-ii — scoped and awaiting go: `skillset suggest` — 2026-10-08

#### Goal

The rule the always block now carries — a session outside this repository files a suggestion and stops — is **advertised but not executable**: it named a path no other project could discover, and no such file existed anywhere. `skillset suggest "<text>"` makes it one bash call from any harness in any project, and removes the last path from an always-loaded file.

#### What is true today — measured 2026-10-08

- **`skillset` is already on PATH everywhere and always current**: the global bin is a symlink into this repository's build — `readlink -f $(which skillset)` → `/Users/joozik/source/priv/skillset/dist/cli.js`. No per-project install, no stale copy.
- **`~/.skillset/` is the existing global state directory** (`state.json`, `active/`, `copilot/`), so the queue joins a location a skillset session already knows rather than inventing a second one.
- The CLI's verbs are install, sync, uninstall, list, update, set-mode, init, emit, track, scan-prompt, status, reset — **no `suggest`**, which is why slice 1's criterion 9 has only ever been half-met.
- **This supersedes the queue location 3b set an hour earlier** (this repository's `.skillset/`): the `.gitignore` line reverts, because nothing writes into the working tree any more.

#### Acceptance criteria

1. `skillset suggest "<text>"` appends exactly one JSON line to `~/.skillset/suggestions.jsonl` and exits 0 **from any cwd** — proved by a test that runs it from a sandboxed foreign directory.
2. The line is `{"at","cwd","session","suggestion"}`: `at` ISO-8601 UTC, `cwd` the invoking project's absolute path, `session` the environment session key when one exists and omitted otherwise.
3. The file is created on first use, and a second call appends without rewriting the first line.
4. `skillset --help` lists `suggest`; **no path appears in any always-loaded file** — the rendered rule names the command and nothing else.
5. An empty or whitespace-only message is refused: non-zero exit, nothing written.
6. Only `src/cli.ts`, a new `src/commands/suggest.ts`, its new test, `src/skills/instruction-ownership/SKILL.md`, `docs/conventions.md`, ADR 0006 and this plan change. No new dependency.
7. `.gitignore` no longer carries `.skillset/`.
8. **`retro` carries the suggestion step** (developer's call, 2026-10-08), so a retrospective session knows a finding about content it does not own becomes a `skillset suggest` call rather than an edit — and says so where the finding's destination is decided, not in a footnote. Its existing "check who owns it" paragraph stops saying "propose the edit there" and names the command. Only a session working **in** the owning repository edits the source and syncs.
9. Gates: `npm run build` → `npx biome check .` → `CI=true npm test`, then a real `sync` with its report, then the installed block re-read to confirm the path is gone and the command is named.

#### Budget

| area | file | lines |
|---|---|---|
| runtime | `src/commands/suggest.ts` (**new**) | ~35 logic |
| runtime | `src/cli.ts` | +6 |
| tests | `src/commands/suggest.test.ts` (**new**) | ~40 |
| content | `src/skills/instruction-ownership/SKILL.md` | −3 (path → command) |
| content | `src/skills/retro/SKILL.md` | +8 to +12 (the suggestion step, where a finding's destination is decided) |
| docs | `docs/conventions.md` | ±4 |
| docs | `docs/decisions/0006-*.md` | +2 (appended) |
| config | `.gitignore` | −1 |
| docs | this plan | ~45 |

- New dependencies **none**. Estimated implementation logic **~40 lines**; base rate for this programme is 30-77% over, so the honest read is **40-70**.
- Listing is deliberately not built: the file is the interface — `cat` reads it, an edit clears it. A `--list` flag is three lines the moment it is wanted.

#### Decisions

1. **`~/.skillset/`, beside `state.json`** (developer's call, 2026-10-08). One fixed location for global state, no write into a working tree, and the command never has to locate the repository — which is what makes it work from an installation that is not this checkout.
2. **Four fields, not six.** The documented shape was `target`/`change`/`why`/`evidence`/`session`/`timestamp`, which a one-line call cannot fill. `cwd` is what replaces the structure: it tells triage **which project** asked, the one thing a project-local file gave away free.
3. **No `--list`** — ladder discipline, above.
4. **The suggestion step lives in `retro`, not in every skill body.** retro is the skill that already decides where a session's knowledge goes and already warns that a global agent dir may be generated; it is also the session-end moment where this class of finding surfaces. Duplicating the instruction into the coding skills would be the same rule in several places, which is what this programme removes.
5. **No ADR.** This completes slice 1's criterion 9 instead of making a new ownership decision; ADR 0006 takes an appended amendment recording the location.

**Road not taken.** *Keep the path in the rule* — it is what failed: an agent in another project cannot discover a path it was never told, and putting another project's paths in every session's context is the tax this programme removes. *Self-locate the repository from the binary* — breaks the moment skillset is installed anywhere but this checkout, and buys nothing over `~/.skillset/`.

#### Confidence

**~97%.** The mechanism is one append into a directory that already exists, the invocation is **measured** (symlinked global bin, current build), and every criterion is checkable by running the command from a foreign cwd. Residual: `session` resolution for a caller outside pi — the key is bridge-supplied — which AC-2 pins by requiring it omitted when absent rather than invented.

Nothing is built. The go is a separate step, per this programme's rule.

### Implemented — 3b-ii, `skillset suggest` — 2026-10-08 (Review log)

The developer gave **go**, mid-conversation, having proposed the command themselves — *"maybe even I would think of creating a command like `skillset suggest "something to suggest"` that any project can invoke in bash … we should not put paths to other projects in the agents.md that are loaded every session"* — and settled the queue's home as `~/.skillset/`, beside `state.json`.

**What landed.** `src/core/locations.ts` gained `suggestionsFilePath()`; `src/commands/suggest.ts` is new; `suggest` is registered in `src/cli.ts`; `test/suggest.test.ts` is new; `instruction-ownership`'s rule lost its path and names the command; `retro` gained the suggestion step and its ownership paragraph stopped saying "propose the edit there"; `docs/conventions.md` and ADR 0006 carry the new location; `.gitignore` is back to where it started.

**Criteria as built.**

1. Holds, **with the real binary rather than `node dist/cli.js`** — run from another project on this machine, sandboxed `HOME`:

```sh
$ cd ~/source/priv/devconsulting.pl && HOME=$T skillset suggest "the review skill should ship a fixture for the tree strategy"
suggested $T/.skillset/suggestions.jsonl
{"at":"2026-10-08T20:24:14.245Z","cwd":"/Users/joozik/source/priv/devconsulting.pl","suggestion":"the review skill should ship a fixture for the tree strategy"}
```

2. Holds — the line carries `at`, `cwd` (the invoking project), no `session` in a plain shell, and `session` when the environment supplies one (pinned by a test that sets `CLAUDE_CODE_SESSION_ID`).
3. Holds — first call creates the file; a second appends to a two-line file; the empty call left the count at 2.
4. Holds — `skillset --help` lists `suggest <message...>`, and **no path survives in any always-loaded file**: `grep -c suggestions.jsonl` is 0 in both `~/.pi/agent/APPEND_SYSTEM.md` and `~/.pi/agent/AGENTS.md`, and `grep -c '\.skillset/'` is 0 in both.
5. Holds — `skillset suggest ""` exits 1, prints the refusal, writes nothing.
6. **Amended — a third changed file.** `suggestionsFilePath()` went into `src/core/locations.ts`, beside `stateFilePath()`, because that file's stated purpose is "where **skillset itself** keeps things" and a second module holding one path would be the kind of split this programme removes. `src/commands/suggest.ts` and `test/suggest.test.ts` are the two others; the file list is one longer than scoped, not wider.
7. Holds — `.gitignore` shows no diff at all (`git status --porcelain .gitignore` empty), since the location it ignored no longer exists.
8. Holds — `retro` carries the step in **both** installed harnesses (`~/.pi/agent/prompts/sk-retro.md` and `~/.claude/commands/sk-retro.md`, `skillset suggest` twice in each: the new block and the tightened ownership paragraph).
9. Holds — `npm run build` · `npx biome check .` (80 files) · `CI=true npm test` → **32 files / 321 tests** (was 317; +4 cases); `sync`: `reconciled drifted 3 · undeclared 8 · in-sync 60 · 3 written`, then `checked undeclared 8 · in-sync 63`. The three were `instruction-ownership` (always) and `retro` (pi slash, claude-code slash) — exactly the changed skills, and nothing else moved.

**Two defects of mine, both caught by the gates rather than by review.** The first pass had a line biome wanted wrapped, and the new test asserted `toHaveLength(1)` on the **function** instead of its awaited array — the failure was `expected [AsyncFunction entries] to have a length of 1 but got +0`, which is a test bug, not a code bug. Both fixed before the gates ran green.

**One platform artifact, recorded because it looks like a defect and is not.** The `cwd` assertion failed on the first green-ish run: `mkdtemp` returns `/var/folders/…` while the child's `process.cwd()` resolves `/private/var/folders/…`. The code is right — recording the physical path is more useful than the symlinked alias — so the **test** normalises with `realpathSync`.

**ADR 0006 was edited, not appended a second time.** Its first amendment (an hour earlier in this same session, uncommitted) named a location this slice replaces. Two contradictory amendments inside one hour, neither committed, would be noise rather than history — the append-only rule protects decision history, and there was none yet. The amendment now records the final location and the command, in one paragraph. Flagged here because it is an exception to a rule this plan has otherwise kept.

**Measured against the budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| `src/commands/suggest.ts` | ~35 logic | **29 lines total, ~24 logic** | under |
| `src/cli.ts` | +6 | **+9** | over by 3 |
| `src/core/locations.ts` | **not budgeted** | **+9** (1 logic line, 8 of docstring) | beyond the list — AC-6 amended above |
| `test/suggest.test.ts` | ~40 | **63** (4 cases) | **over by 23** — exact assertions, not `toContain` |
| `src/skills/retro/SKILL.md` | +8 to +12 | **+9 / −1** | met |
| `src/skills/instruction-ownership/SKILL.md` | −3 | **+12 / −7** (net +5, carrying 3b's rewrite too) | met in effect |
| `docs/conventions.md` | ±4 | **+23 / −3** (both slices) | over — it carries 3b's artifact table as well |
| `.gitignore` | −1 | **0** | met |
| implementation logic, total | ~40 | **~42** across the three runtime files | **met** |
| dependencies / runtime modules | none / 0 | none / 0 | met |

**Findings recorded, not fixed.**

- **A suggestion written from *this* repository is indistinguishable from one written elsewhere** except by its `cwd`. Not a defect, but the triage session's first question — "did this come from a session that could have edited the source?" — is answered only by looking at that field.
- **No `--list` flag** (the decision above). The queue is `cat`-read and cleared by editing; when it has more than a handful of lines that trade-off should be revisited rather than assumed.
- **`session` is omitted, never invented**, when no harness supplies one — so a suggestion filed from a bare shell reports the project but not the conversation it came from.

**Commit — drafted, never run.** One message, because **3b and 3b-ii are uncommitted in one tree** and they share three files (`instruction-ownership`, `docs/conventions.md`, this plan) — a clean two-commit split is a `git add -p` exercise, available if wanted, not the default. This slice adds files, so `git add -A`, never `git commit -am`.

```sh
git add -A && git commit -F - <<'MSG'
skillset: the rules that bind every session, and a door for suggestions (0023 3b + 3b-ii)

Two rules a session must obey before it acts had no rendered home: commits carry
no trailers lived in the hand-written ~/.pi/agent/AGENTS.md, and code carries no
comments lived only in a completed plan. Both are now a skill body rendered into
APPEND_SYSTEM.md as its own marker block, so each rule has exactly one copy, and
instruction-ownership gains the one-provider rule plus a Never entry for ad-hoc
writes to any installed path.

The ownership rule now branches first: a session running in this repository edits
the source and syncs, and every other project files a suggestion and stops.

That suggestion had no door — the rule named a path no project could discover and
no file existed. `skillset suggest "<what should change, and why>"` is it: one
JSON line appended to ~/.skillset/suggestions.jsonl beside state.json, carrying
at, cwd, the session key when there is one, and the message. It reaches every
project because the global bin is a symlink into this repository's build, and it
never has to locate the repository. retro carries the step where it decides a
finding's destination, and the always-loaded rule names the command, not a path.

AGENTS.md shrinks to a pointer plus the two facts no doc carried, and the map of
where each artifact lands moves into docs/conventions.md, read on demand instead
of paid every session (384 -> 99 estTokens).

Gates: build, biome clean, CI=true 32 files / 321 tests, sync in-sync 63.
MSG
```

### Sign-off — 3b and 3b-ii — 2026-10-08

The developer signed both off. **The plan stays in `docs/plans/` rather than `completed/`**, for the reason the earlier sign-offs recorded: this document carries 3c–3f, which are not done, so moving it would claim otherwise. It moves when the programme does.

**State at sign-off, verified by `git log`/`git status` rather than by this file's prose:** skillset's tree is **still dirty** — 10 modified, 3 new (`src/commands/suggest.ts`, `src/skills/standing-rules/`, `test/suggest.test.ts`) — so the commit has **not** been run, and the pair's drafted message above is the one to run. `pi-extensions` is clean at `f67d744` and untouched by this slice. Gates on the signed-off tree: `npm run build`, `npx biome check .` (80 files), `CI=true npm test` → **32 files / 321 tests**, `sync --dry-run` → `checked undeclared 8 · in-sync 63`, with `instruction-ownership` and `retro` rendered into three installed artifacts and `retro` carrying the suggestion step in both harnesses.

**What the pair leaves behind for the next session:** the suggestion queue has a writer (`skillset suggest`, from any project, on PATH everywhere) and a stated reader (a session working here), which closes slice 1's criterion 9; the always-loaded surface carries a command instead of a path, and `AGENTS.md` is a 99-estToken pointer where it was 384. Still unbuilt and unauthorised: `--list`, the `install.ts` duplication (e), the harness env-var paths (g), and 3c–3f.

### 3c — scoped and awaiting go: the `context` channel and project declarations — 2026-10-08

#### Goal

The context file — the instruction file a harness loads besides the system prompt — is the one surface this programme still writes by hand, and local scope has no declarative home: a project's installs are either hand-run `install --local` calls or the eight *undeclared* records this repository already carries. 3c adds a fourth mode that renders marker blocks into that file (pi: local `<root>/AGENTS.md`, global `~/.pi/agent/AGENTS.md`), reads a **project declarations file** — `<root>/.skillset/config.json`, local entries only — so a project can declare and therefore override its own installs, and gives both a door: `skillset init project`. Nothing hand-edited into a project, nothing declared without being reconciled.

#### What was verified by execution — 2026-10-08

```sh
$ (cd $T1 && pi --no-session --print "Which probe token appears in your instructions? …")   # $T1/AGENTS.md
ZZZ-CONTEXT-PROBE-4711
$ (cd $T2 && pi --no-session --print "Which probe token appears in your instructions? …")   # $T2/.pi/AGENTS.md, no root file
NONE
```

- **The project's root `AGENTS.md` reaches pi's prompt; `<root>/.pi/AGENTS.md` does not.** pi's project `.pi/` table has no `AGENTS.md` row, and context files are loaded from the agent directory, the working directory and its parents (`docs/configuration.md:30-45`). So the project context file is the root one, and a `.pi/AGENTS.md` write would be dead content.
- **The hazard that shapes the scaffold:** pi's project `.pi/APPEND_SYSTEM.md` **replaces** the agent-directory one — *"the trusted project file takes precedence over the corresponding agent-directory file. Files with the same name are not combined"* (`docs/configuration.md:36`). A project that hand-writes that file **silences** the global `instruction-ownership` and `standing-rules` blocks inside itself. The scaffold must never write it, and the docs must name it.
- **One rendered project `AGENTS.md` serves pi and claude-code.** claude-code 2.1.286's own strings carry the switch — `instructionFiles` = `"claude-md"` | `"claude-md-or-agents-md"` (**default**) | `"claude-md-and-agents-md"`, described in the build as *"AGENTS.md as project instructions: by default loaded where the project has no CLAUDE.md; by its instructionFiles option, loaded beside CLAUDE.md, left out, or with the project instructions dropped"*. The documented exception travels with it: a project carrying its **own** `CLAUDE.md` gets that file instead, and our block is then invisible to claude-code.
- **What is not verifiable here, and is therefore not built:** claude-code's *loader* does not report memory files. A 204-line `--debug-file` run (auth absent) logs the skill loader (`Loaded 0 unique skills (…)`) and then ends — no `CLAUDE.md`/`AGENTS.md` line appears anywhere in it. So claude-code's context reading rests on the build's own **strings**, not on its loader: the weaker evidence class this plan has recorded before, stated rather than smoothed. Consequence: **no claude-code `context` renderer for its global file** (`~/.claude/CLAUDE.md`) in this slice.
- The marker machinery is mode-agnostic and already proven for two blocks in one file (`core/markers.ts`; `test/agents/pi.test.ts`), and local scope already resolves per bridge (`<root>/.pi`, `<root>/.claude`) with `projectPath` recorded on the record.
- **The literal `"always"` is how twelve non-test sites recognise an anchor** — `src/bridges/{pi,claude-code,opencode,copilot}/index.ts` (two each), `src/core/declarations.ts:648,825`, `src/commands/install.ts:260`, `src/commands/set-mode.ts:40`. A second anchor mode is therefore *one predicate*, not twelve edits — and leaving it as twelve literals is what would make the second mode dangerous.

#### The shape 3c builds

1. `Mode` gains `context`. `always` and `context` are **anchor** modes behind one predicate, so the twelve sites read the same way and a third anchor would join by name.
2. pi declares `context`: local `<root>/AGENTS.md`, global `~/.pi/agent/AGENTS.md`, marker-wrapped, created when absent, and removed by `uninstall` leaving other blocks and the surrounding text intact — the same shape `always` has, and the same no-frontmatter rule (`expresses.context: []`).
3. claude-code, opencode and copilot declare **no** `context` support, so the existing unsupported-mode report fires for them and nothing is written — never a silent skip.
4. The **project declarations file** — `<root>/.skillset/config.json`, the schema the repository file already uses — is read when skillset runs in that project and merged with the repository's declarations. **Local entries only:** `projectPath` is derived from the working directory and never authored, and a `scope: "global"` entry in a project file is a declaration problem that names the file. That one rule is what stops a cloned repository from writing into somebody's home.
5. The escape hatch, documented and tested: a project overrides by **declaring its own local install** of the same skill. The override stays visible — the project's install reconciles as declared while the global one still reports `in-sync` — and the harness is what picks between the two.
6. `skillset init project` writes the skeleton once and never overwrites it (`init`'s existing idempotence), and the docs carry the worked example. **No directory is scaffolded**: local installs create what they need, and an empty `.pi/` is cruft rather than a scaffold.
7. The global context file flips to rendered content — the consumer 3b deferred. The hand-written 13-line `~/.pi/agent/AGENTS.md` becomes a skill body installed as pi `context` global. Its per-request cost does not change (that file is loaded whether hand-written or rendered), and it must stay a pointer.

#### Acceptance criteria

1. `Mode` is `slash | auto | always | context`, and `grep -rn '"always"' src/core src/bridges src/commands --glob '!*.test.ts'` returns only `supportedModes` declarations and the predicate's defining table — the twelve recognition sites are gone.
2. pi `context` renders at both scopes — local `<root>/AGENTS.md`, global `~/.pi/agent/AGENTS.md`, marker-wrapped — and `uninstall` removes only its own block, deleting the file only when that block was the last content, exactly as `always` does.
3. **The channel is observable and the blocks do not displace each other:** a fresh `pi --print` process run from a temp project reproduces text that exists only in the rendered `<root>/AGENTS.md`, while both `APPEND_SYSTEM.md` blocks are still installed; the negative run — the same probe from a project that declares no `context` install — reproduces nothing. Transcript in the plan.
4. Only pi declares `context`; asking another bridge for it is reported by the existing unsupported-mode path and writes nothing, pinned per bridge.
5. A project file at `<root>/.skillset/config.json` is honoured in that project and only there: `sync --dry-run` run from the project lists the declared local install; run from the repository root the same entry does not appear.
6. A `scope: "global"` entry in a project file is a problem naming that file; a malformed or unreadable project file is the same class of problem — never a silent fallback to the repository file alone.
7. The escape hatch holds: a project declaring a local install of a globally installed skill reconciles the local one **and** leaves the global one `in-sync`, both in one report.
8. `skillset init project` is idempotent (second run creates nothing, reports present) and the file it writes parses — a `sync` in that project reports no declaration problem.
9. **Nothing else moves:** from the repository root `sync --dry-run` reports `undeclared 8` and the skill/agent installs unchanged apart from the one new global `context` install, with nothing drifted, missing or foreign; `~/.claude/`, `~/.config/opencode/` and `~/.skillset/copilot/` are byte-unchanged.
10. Gates and standing rules: `npm run build` → `npx biome check .` → `CI=true npm test`; **no new dependency, no new runtime module**; no comments added; `src/bridges/boundaries.test.ts` green (no harness name under `src/core/**` or `src/commands/**`).

#### Budget

| area | file | what | est. logic |
|---|---|---|---|
| runtime | `src/core/types.ts` | `context` in `Mode`/`MODES`, `isAnchorMode` | ~8 |
| runtime | `src/bridges/pi/{paths,index}.ts` | layout entry, install/uninstall/preview for anchor modes, `expresses.context: []` | ~25 |
| runtime | the twelve literal sites | route through the predicate | ~15 |
| runtime | `src/core/locations.ts` | `projectDeclarationsPath(root)` | ~8 |
| runtime | `src/core/declarations.ts` | project-file load, merge, local-only validation, problem text naming the file | ~60 |
| runtime | `src/commands/sync.ts` (+`list`/`status` if they surface it) | reconcile project declarations beside the repository's | ~20 |
| runtime | `src/commands/init.ts`, `src/cli.ts` | `init project` skeleton | ~40 |
| content | `src/skills/<pointer>/SKILL.md` (**new**) | the global context file's body, moved from the hand-written file | ~20 |
| config | `skillset.config.json` | the `context` global declaration | +6 physical |
| tests | — | context render/uninstall, coexistence probe, project-file merge, the global-entry refusal, malformed file, escape hatch, init idempotence, CLI round trip | ~220 |
| docs | `README.md`, `docs/conventions.md`, `docs/architecture.md`, ADR 0008 | the fourth mode, the project declarations file and its local-only rule, `AGENTS.md` serving two harnesses with the `CLAUDE.md` exception, the `APPEND_SYSTEM.md` replacement hazard | ~120 physical |

- New dependencies **none**; new runtime modules **0**; new test files **1-2**.
- Estimated implementation logic: **~175 added**. This programme's base rate is +30-77% over, so the honest read is **175-300 logic lines**; physical **620-930** including tests, docs and the moved body.

#### Decisions

1. **A fourth mode, not a second meaning for `always`.** Reusing `always` with a per-bridge anchor choice would make one mode mean two different files and lose the ability to declare one channel without the other — and the two channels are independently useful (rules in the system prompt, the map in the context file).
2. **`isAnchorMode`, not twelve literals.** The sweep is mechanical and it is the reason a second anchor mode is cheap; the predicate keeps the *rule* in one place, which is what the literals got wrong the moment there was a second anchor.
3. **Local entries only in a project file.** *Strike this if you disagree:* the alternative is letting a project declare global installs, which means any clone can write into a home.
4. **`<root>/.skillset/config.json`.** Hidden, project-local, and the same schema as the repository file so `parseDeclarations` is reused rather than forked. *Strike if you want `skillset.config.json` at the project root* — that is the repository's own file name, which is either consistent or confusing, and I chose unambiguous.
5. **`skillset init project` — a reserved argument, not a new verb.** `init` already means "scaffold into the project", and the bundle ships no skill named `project` (pinned by a test) so the reserved word cannot collide.
6. **The scaffold writes one file and creates no directory.** A committed empty `.pi/` is not a scaffold; the first local install creates the directory it needs.
7. **The global context file flips to rendered now, because this is the slice that gives the channel its consumer.** Its hand-written content moves into the body verbatim; the developer deletes the hand text after `sync` — it is their file, and one sync window of duplication is visible rather than silent.
8. **claude-code gets no `context` renderer, and the reason is evidence rather than caution** — strings, not its loader. The slice's answer on that harness is a *shared file* instead: its default `instructionFiles` reads the project `AGENTS.md` we render for pi.
9. **ADR 0008, filed as `docs/decisions/0008-project-declarations-and-the-context-channel.md`.** A second declaration root, a fourth mode and a rule about what a project may declare change the configuration surface this repository promises; that outlives the plan.

#### Road not taken

- **Scaffolding `.pi/` and a `.gitkeep`** — empty directories are cruft, and local installs create their own parents.
- **Rendering a project `CLAUDE.md` for claude-code** — its global memory file cannot be verified here (no loader evidence), and the project file it reads by default is the very `AGENTS.md` we already render; a second file would be a second copy with no reader this machine can prove.
- **A project file that may declare global installs** — one cloned repository writing into a home, silently, which is the failure this repository's whole ownership story exists to prevent.
- **`.pi/skillset.config.json`** — the file is not a harness artifact; it is skillset's own config, and `.skillset/` is where skillset's own files live (global scope already uses `~/.skillset/`).

#### Confidence

**~94%.** Retired by execution: pi's project-context load and the dead `.pi/AGENTS.md` (both probes), the marker machinery's multi-block safety, local scope's existing per-bridge resolution, the twelve-site literal count, and claude-code's `instructionFiles` switch from the build's own strings. The residual is two things and neither is hidden: claude-code's context read is **strings-level** — if its loader in fact ignores `AGENTS.md`, the project block is invisible to claude sessions, so the docs state it as a dependency rather than a guarantee; and `init project`'s shape (reserved argument, one file) is a taste call made here rather than measured.

#### Not in this slice

- claude-code's global context file, and `context` at any scope for opencode and copilot.
- Any FLOW content move (3d-3f).
- The three separately-recorded items stay where they are: `install.ts`'s skill/agent duplication (e), the `CLAUDE_CONFIG_DIR` / `PI_CODING_AGENT_DIR` question (g), and the suggestion queue's missing `--list`.

### Implemented — 3c, the context channel and project declarations — 2026-10-08 (Review log)

The developer gave **go** on the scope above, with the three forks answered up front: a `context` mode plus `skillset init project`, the **project declarations file** as the documented local-override escape hatch (not a project-scope install, not documentation-only), and **pi + claude-code** reach for the scaffold.

**What landed.** `Mode` gained `context`; `isAnchorMode` in `src/core/types.ts` is now the single place that decides what an anchor mode is, and the recognition sites read through it. pi declares the mode (`expresses.context: []`, layout `<root>/AGENTS.md` local / `~/.pi/agent/AGENTS.md` global) and installs/uninstalls/previews it through the existing marker machinery. `loadDeclarations` reads a repository file **and** the project's own `<root>/.skillset/config.json`, merged additively; `parseProjectDeclarations` accepts `installs` only, local only, with `projectPath` derived. `skillset init project` writes that file's skeleton once. `src/skills/context-pointer/` is new and declares pi `context` global, so `~/.pi/agent/AGENTS.md` is rendered content now rather than a hand-written file.

**Criteria as built.**

1. Holds, with **one correction to the count**: the literal `"always"` was the anchor predicate in **eleven** sites, not twelve — the twelfth (`claude-code`'s `record.mode === "auto" || record.mode === "always"`, which removes an emptied skill directory, and its twin in `claude-code/paths.ts:39`) recognises a *skill-directory* rule that happens to name a mode, and it is not an anchor test. All eleven route through `isAnchorMode`; the two skill-directory mentions stay as they are, and `claude-code` supports no `context` mode for them to be wrong about. AC-1 is amended here rather than the code being bent to fit it: `grep -rn '"always"' src/core src/bridges src/commands --glob '!*.test.ts'` now returns the mode table and predicate, four `supportedModes` declarations, the layout switch case, and those two skill-directory mentions — nothing else.
2. Holds — pi `context` writes a marker block at both scopes and `uninstall` removes only its own block, deleting the file only when that block was the last content (pinned by test, both directions).
3. Holds, by execution — the probe pair is in *Evidence* below: a fresh `pi --print` from `/tmp` reproduces a marker string that exists only in the rendered global block, and a temp project with a local `context` install makes pi name that project's `AGENTS.md` as its context source, while the same question from a project with no context file answers `NONE`.
4. Holds — a registry-level test pins `supportedModes` containing `context` to `["pi"]`, `artifactPath` throws for the other three, and a claude-code CLI test pins the unsupported-mode report with neither `AGENTS.md` nor `CLAUDE.md` written.
5. Holds — the project file is honoured inside its project and nowhere else, in one test that runs the same home from two working directories.
6. Holds — a `scope: "global"` entry exits 2 with a problem naming the file and nothing written; a malformed file is refused against its own path (`not valid JSON`) rather than falling back to the repository file alone.
7. Holds — the escape hatch is visible: after a real `sync`, the state holds `confidence` at both `global` and `local`, and the dry run reports both `in-sync` in one pass.
8. Holds — `init project` is idempotent, an edited file survives a second run untouched, the skeleton parses, and no skill named `project` exists in the bundle (pinned).
9. Holds, by hash — `~/.claude` (4,304 files), `~/.config/opencode` (744) and `~/.skillset/copilot` (1) are byte-identical before and after; the only changed files under `~/.pi/agent` are `AGENTS.md` (this slice's write) plus the permission-system log and this session's own transcript.
10. Holds — build, biome, `CI=true npm test`; no new dependency, no new runtime module, no harness name under `src/core/**` or `src/commands/**`; no comments added beyond the house-style one-liners.

**Measured against the budget — the first slice of this programme to come in under.**

| area | budget | measured | verdict |
|---|---|---|---|
| runtime logic | ~175 added (honest read 175-300) | **+163 / −30 = +133 net** | **under** |
| runtime physical | — | 14 files, +208 / −31 | reported |
| tests | ~220 | **+284 / −3**, 19 new cases (321 → 340) | over by ~64, exact-bytes assertions |
| docs | ~120 | **+61 / −4** tracked + ADR 0008 (47 new) | under |
| content | ~20 | `src/skills/context-pointer/SKILL.md` **19 lines** | met |
| config | +6 | **+7** | met |
| new runtime modules / dependencies / test files | 0 / none / 1-2 | 0 / none / **0** (added to existing files) | met |

The runtime total is dominated by `src/core/declarations.ts` (+100 logic), which is the project-file parser and the loader's second source — the estimate's largest single line and the one that came in as predicted. The overrun-free result is not a rounding: the mode itself was cheap because the predicate sweep made it so, and the scaffold is one file.

**Deviations, each deliberate.**

- **The new skill needs an `sk-` slug.** `src/bridges/bridges.test.ts:265` requires every bundled skill to declare one; `context-pointer` gained `slug: sk-context-pointer`. The invariant is unchanged and still global — a context block never becomes a slash file, but the rule that every bundled skill is addressable stays true for free.
- **Two existing tests were amended.** `test/agents-kind.test.ts:61` pinned `checked in-sync 63` and now pins **64** (the one new declaration — AC-9's arithmetic), and `test/cli.test.ts:387` pinned the body-size warning's wording `always-mode`, which now reads `anchor-mode artifacts (always, context)` in both `install` and `set-mode` so the message stays true for the mode we just added.
- **`loadDeclarations`'s signature changed** from `(path = declarationsFilePath())` to `(projectRoot = process.cwd())`. The path parameter had no caller — every call site used the default, tests included — and the project root is what the second source needs. Callers pass it: `sync` (both call sites), `install`, `set-mode`; `update` keeps the default because a project file cannot declare siblings.
- **The project file refuses more than the config schema does:** `siblings`, `requires` and `agents` by name, `projectPath` (derived), and `kind` (agent installs are the repository's). Refusing beats ignoring, which is the failure class this programme removes.
- **One mistake, recorded because it cost a turn.** Cleanup after the probes used `rm -rf`, which the permission policy blocks — and the blocked call took the whole compound command with it, so the uninstall and the state check never ran. Redone with plain `rm`/`rmdir`, and the plan already carries the rule that says so.

**Evidence, in the order it ran.**

```sh
npm run build                   # tsc + copy-skills + copy-agents, clean
npx biome check .               # 80 files clean
CI=true npm test                # 32 files / 340 tests  (was 321)
node dist/cli.js sync           # reconciled missing 1 · undeclared 8 · in-sync 63 · 1 written
node dist/cli.js sync --dry-run  # checked undeclared 8 · in-sync 64
```

The one written artifact is `~/.pi/agent/AGENTS.md`, and the block landed **beside** the hand-written text rather than replacing it:

```
# Global agent notes (all projects)
… (hand-written, 13 lines, unchanged) …
<!-- skillset:begin context-pointer -->
# Global agent notes (all projects)
… (rendered) …
<!-- skillset:end context-pointer -->
```

That window is deliberate (decision 7) and the developer closed it the same session, at their word: the hand-written copy above the block was deleted, leaving a 14-line file that is the rendered block and nothing else. `sync --dry-run` after the edit still reports `in-sync 64` — the block itself was untouched, so classification never moved.

**The probes — three, because the first pair was confounded and saying so is the point.**

```
1. from /tmp, fresh pi:  "skillset:begin context-pointer"      → reproduced
   (that marker exists only in the rendered block; the hand text above it carries no markers)
2. from a temp project with a local `context` install of standing-rules:
   pi's own answer named the source — "…/tmp.2QNhf1sgda/AGENTS.md (a project-local AGENTS.md in a
   temp directory, injected as project context)"
3. from a temp project with no context file:                 → NONE
```

Probe 2 as first written asked the temp project to reproduce the string `skillset:begin standing-rules` — which also exists in the **global** `APPEND_SYSTEM.md`, so the "negative" run answered with it too. The probe was wrong, not the code: questions about a string that is installed globally cannot distinguish a project block from a global one, so probes 2 and 3 now ask for a token that exists only in the project's own file. Cleanup afterwards: `uninstall` removed the block and left the file standing (the temp project's own token was still in it, so deleting it would have been the bug), the state file carries **0** records for temp projects, and the temp directories are gone.

**Committed — `5458ebc`**, run by the developer from the multi-line form below, and pushed (`origin/main` matches). This slice added files, so the command was `git add -A`, never `git commit -am`. The code block is kept as it was pasted rather than trimmed to what changed, so the record matches the history.

```sh
git add -A && git commit -F - <<'MSG'
skillset: a project declares its own installs, and the context file is rendered (0023 slice 3c)

Local scope had no declarative home: eight records on this machine were undeclared forever, and
the only way to deviate from the global set was a hand-run install command. <root>/.skillset/
config.json is now a second declaration root, read additively whenever skillset runs in that
project — local entries only (a global one exits 2, because a clone must not write a home),
projectPath derived from the working directory, and siblings/requires/agents refused by name
rather than ignored. `skillset init project` writes it once. An override stays visible: the
global declarations reconcile alongside the project's, so both installs report in one run.

Mode gains `context` — the second anchor mode. always writes the system prompt, context the file
a harness loads besides it; `isAnchorMode` is now the one place that says which modes those are,
where the literal "always" used to stand in eleven sites. Only pi declares it: local
<root>/AGENTS.md, global ~/.pi/agent/AGENTS.md. Not <root>/.pi/AGENTS.md — measured against pi's
loader, which reads the context file from the working directory and its parents, so that write
would be dead content. claude-code reads that same project file (its instructionFiles default is
claude-md-or-agents-md), which is why it needs no renderer of its own; a project with its own
CLAUDE.md gets that file instead, and the docs say so.

~/.pi/agent/AGENTS.md becomes rendered content: src/skills/context-pointer/ carries what was
hand-written there, installed as pi context global. The hand-written copy above the new block was
deleted in the same session, so the file is the rendered block alone.

sync: missing 1 · undeclared 8 · in-sync 63 · 1 written, then in-sync 64. ~/.claude,
~/.config/opencode and ~/.skillset/copilot byte-identical (hash diff, 5,049 files).

standing-rules gains its third rule — a blocked command is a decision point, not a stop: read the
reason the denial printed, take the path that respects it, never re-issue the denied command or the
same intent under a different spelling, and never stall the task on the blocked step — do the rest,
then report it and ask. Written after a denied `rm -rf` swallowed a whole compound command and cost
a turn; the rule is in the installed APPEND_SYSTEM.md and reproduces in a fresh session.

The README's bundled-skill catalogue gains the three rules it never listed (instruction-ownership,
standing-rules, context-pointer) — a comm against src/skills/ is now empty — and docs/conventions.md
states what the anchor modes do not deliver: no frontmatter at all, so the body is the artifact and a
description is `skillset list` metadata there. Docs-only; nothing propagated, in-sync still 64.

Gates: build, biome 80 files clean, CI=true 32 files / 340 tests. No new dependency, no new
runtime module, no harness name in core or commands.
MSG
```

### Amended — the standing-rules block learns what a blocked command means — 2026-10-08

Added after this session, at the developer's word, and it earns its place by the failure that prompted it: during 3c's cleanup a `bash` call containing `rm -rf` was denied by the permission policy, the denial took the whole compound command with it — uninstall and state check included — and the turn ended instead of the reason in that message being read and acted on. The block now carries a third rule, `## A blocked command is a decision point, not a stop`:

> A denied or failed command prints the reason it was refused — the rule it matched, and often the sanctioned alternative. Read it, name what it objected to, and take the next action that reaches the same goal **without** it: the alternative the message or these rules name, another route if there is one, and if there is none, leave that step out.
>
> Never re-issue a denied command, and never re-issue the same intent through a different string to get around the rule that just fired. Never stall the task on the blocked step either: do the rest, then report it with its reason and propose or ask — including asking the developer to run a command the policy reserves for them.
>
> All of it in the same turn. Going quiet is not one of the options.

The middle paragraph is the one the developer corrected me on: my first draft said *correct it and re-run it*, which is the retry instinct the rule exists to kill. The rule is not "find another spelling of the denied action" — it is "read the violation, decide what the goal needs now, and take a path that respects the rule", with the blocked step either deferred to the report or handed to the developer.

Body 13 → **26 lines**, well under the 80-line anchor warn; no other file touched, no runtime change. Propagated and verified as the block requires: `sync` → `reconciled drifted 1 · undeclared 8 · in-sync 63 · 1 written`, then `in-sync 64`; both marker blocks intact in the installed `~/.pi/agent/APPEND_SYSTEM.md` (`instruction-ownership` lines 2-33, `standing-rules` 35-55); and a **fresh `pi --print` from `/tmp`** reproduced the new rule's final sentence verbatim — *"Going quiet is not one of the options."* — so the rule is in the prompt a session actually carries, not merely committed. Gates unchanged: build, biome 80 files, `CI=true npm test` 32 files / 340 tests.

**Both findings it recorded are now fixed, in the same session and at the developer's word.**

- **The README's `## Bundled skills` catalogue omitted every rule added by this programme** — not two skills but three: `instruction-ownership`, `standing-rules` and `context-pointer`. All three now have rows in the list, so a `comm` of `src/skills/*/` against the catalogue returns nothing. Their rows say what they are rather than recommending a posture: these are the rules, and they belong in an anchor channel (`always` for the two rules, `context` for the pointer).
- **The anchor modes' silence about frontmatter is now stated, not inferred.** `expresses.always` and `expresses.context` are empty because a marker block has no YAML to read, so a skill's `description` is `skillset list` metadata in those modes rather than text the harness sees. `docs/conventions.md` says so where the field matrix is documented. No warning was added for it and that is deliberate: nothing is lost — for a mode with no model-side selection there is nothing for a description to select — and a warning would fire on all three anchor installs this repository declares to report a non-problem.

Docs-only, so nothing propagated: `sync --dry-run` still reports `in-sync 64`, and the gates are unchanged (build, biome 80 files, `CI=true npm test` 32 files / 340 tests).

### 3d — scoped and awaiting go: the FLOW skill triage — 2026-10-08

#### Goal

End the question *where does a skill live* for the last 30 bodies this programme has not judged. FLOW ships 30 skills; this repository owns 16. Per skill, decide whether the body is instruction content (a method that means something in any harness, so it moves here and FLOW stops shipping a copy) or pi surface (it only means something against the workflow engine or an extension in that workspace, so it stays), and move the ones that are portable **today** without inventing a mechanism. The verdict for every one of the 30 is recorded below, so the next session does not re-litigate it.

Scope: the triage, its evidence, and a split into two slices. **Nothing moves until the go for 3d-i.**

#### What was measured — by execution, 2026-10-08

**The roster is 30, not 31.** `ls -d skills/*/` is 31 and one of those is `_shared/`; 2b deleted `code-review` and renamed `remediate` to `flow-remediate` after this plan's inventory was written. 30 bodies, **7,028 lines**.

**The dispatch map is the engine's own, not a grep.** `builtInWorkflows` jiti-imported from `packages/flow` and walked stage by stage (`def.skill ?? stage`, `produces.prompt` and `produces.script` excluded), plus the literal `/skill:<name>` strings in `extensions/flow-core/**` excluding tests:

| dispatched (17 of FLOW's 30, plus `code-review`, this repository's since 2b) | where |
|---|---|
| acceptance | build:acceptance, ship:acceptance |
| amend | build:plan-fix, build:code-fix, `built-ins/reconcile.ts` |
| architecture-review | polish:architecture-review |
| blueprint | vet:blueprint, polish:blueprint |
| code-review | vet:code-review, polish:code-review — **this repository's now** |
| commit | vet:commit, polish:commit, `/skill:commit --baseline` from `built-ins/goal-baseline.ts:298` |
| design-review | build:design-review |
| design-slice | build:slice-design |
| elaborate | build:code |
| flow-remediate | build:validate-fix, ship:validate-fix |
| grade | build:slice-grade, build:plan-grade, build:plan-confirm, build:code-grade, build:code-confirm, ship:grade |
| implement | build:implement, vet:implement, polish:implement, ship:implement, meta:implement |
| lens-grade | meta:research-grade, meta:plan-grade, meta:implement-grade |
| quick-plan | ship:plan |
| research | `/skill:research` in `built-in-workflows.ts:199,226` |
| slice | build:slice, build:slice-fix |
| synthesize | build:subplan, build:plan |
| validate | vet:validate, plus `built-ins/goal-baseline.ts` |

**Thirteen are not dispatched at all**: annotate-guidance, annotate-inline, changelog, create-handoff, design, discover, explore, frontend-design, migrate-to-guidance, plan, pr-triage, resume-handoff, revise. 17 + 13 = 30. Every one of the 30 is named somewhere in `flow-core` non-test code — none is orphaned — but `pipeline-pointer.ts` is the only place the thirteen appear, and that is a *listing* the model reads, not a dispatch.

**The coupling is `flow-args`, not pi.** This is the correction the plan needs before any body moves. Four tokens the bodies use are provided by **`packages/flow-args`**, a pi extension in the same workspace, and by nothing else:

- `$ARGUMENTS` / `$1` / `$@` — 30 of 30 bodies, 38 occurrences. Measured against pi itself: `_expandSkillCommand` substitutes nothing, it appends the raw argument string after the `<skill>` block (`dist/core/agent-session.js:1628-1641`), and the `expandPromptTemplate` that runs next does nothing because the expanded text begins with `<`, not `/` (`dist/core/prompt-templates.js`).
- `${SKILL_DIR}` — 24 of 30, 50 occurrences. **`strings`/`grep` over the whole installed pi package returns nothing for it** — the plan's earlier "expanded by no harness" stands — but `flow-args` substitutes it "always, on both paths" (`packages/flow-args/docs/how-it-works.md`). That is why the 24 bodies' `_shared` calls work at all.
- ```` ```! ```` and `` !`cmd` `` shell blocks — 23 of 30. Also `flow-args` (`how-it-works.md`, pipeline step 5). Zero occurrences of pi doing this: the plan's 2c finding that pi passes a skill body through verbatim is what it looks like when this extension is absent.
- `shell-timeout` — 25 of 30. **Not a pi field and not a harness field**: `grep -rn 'shell-timeout'` over the installed pi package (dist, docs) is empty, and its only reader in this workspace is `packages/flow-args/args.ts:184` `resolveShellTimeoutMs`. So it bounds exactly one thing — how long a ```` ```! ```` fence may run.

**`/skill:<name>` resolves from the loader's whole skill set**, which is what makes a move possible without touching the engine: `_expandSkillCommand` looks the name up in `this.resourceLoader.getSkills().skills` and reads that file's body (`dist/core/agent-session.js:1628-1641`; `resource-loader.js:293`), and `disable-model-invocation` only keeps a skill out of the model's list — `docs/skills.md` in the package says such skills "can only be invoked explicitly via `/skill:name` commands". Read from pi's own code, not executed: the executed half is 2b's, which installed a skill and had the loader list it.

**Everything a moved body carries is renderable.** skillset's frontmatter renderer takes strings, numbers, booleans, flat arrays of strings and nested mappings of those. Measured over the 30: **no body declares an array of mappings** (the one shape the renderer refuses), and the single body with block sequences in frontmatter — `create-handoff`'s `required:` and `enum:` — renders fine, because a flat array of strings is inlined by `renderScalar` at any depth (`src/core/frontmatter.ts:44-56`).

**No name collision, and no verdict field to step on.** The 30 names against this repository's 16: none equal. Exactly **two** skills declare a `verdict` field (`explore`, `validate`), and the engine's two gates read `blockers_count` (`built-in-workflows.ts:157,484`) and `verdict` (`:1399`).

**`_shared/` is shared with the skills that stay** — the reason the move splits. 24 bodies call 8 plain-node scripts. Per script, who needs it:

| script | non-dispatching candidates that need it | stayers that keep it |
|---|---|---|
| `changelog-bootstrap.mjs` | changelog | — |
| `git-changes.mjs` | commit | — |
| `now.mjs` | create-handoff, discover, revise | 20 skills |
| `git-context.mjs` | create-handoff, discover | 16 skills |
| `list-recent.mjs` | resume-handoff, revise | blueprint, design, validate |

**How the thirty were read.** Four parallel read-only passes, five-to-ten bodies each, every one required to cite a line number per claim and to answer the same six questions (method; pi-bound tokens with lines; whether it emits an engine-gated verdict; whether the method survives generic phrasing; a verdict; the reason). Their per-skill reasoning is the evidence behind the table below; the grouping, the tests that decide it and the split are this plan's.

#### The test, resolved — which bodies are pi surface

The plan's original phrasing ("does the body name a pi-only tool, or call a `_shared/` script?") is **wrong in both directions** and is retired here. Naming a tool is not disqualifying — 2d already set the precedent of describing a tool generically ("if this session exposes an adjudication tool") — and calling a `_shared` script is not disqualifying either, since the scripts are plain node and 2a's mechanism carries them. What decides it is two questions:

1. **Does any workflow dispatch it?** A body the engine runs by name is engine surface: its stage, its channel and its contract are all wired in `built-in-workflows.ts`, and moving it makes those presets depend on an installed skill (slice-2 decision 4 accepted exactly that for one skill, not for seventeen). Measured above, 17 skills.
2. **Does it publish a gate input?** `verdict`, `blockers_count`, or an artifact channel a stage reads. Two `verdict` declarations, and the rest of the gate arms are already caught by (1).

Both false → portable today. One true → stays. **`ask_user_question` is not part of the test**, and the fork is settled: it may be named generically in a moved body, because the engine's *parking* of a question is the tool's behaviour, not the body's text — `question-lifecycle.ts:29` describes "a deferred `ask_user_question`" as the registry's own mechanism, `siblings.ts:35` declares the tool a package sibling, and `sdk-workflow-host.ts:356` degrades it in the lane dock. What a moved body **must** stop carrying is the pi implementation detail around it: the `MAX_HEADER_LENGTH = 16` header cap (14 bodies), the auto-appended `Type something.` row (10) and the `(Recommended)` label convention (16) are that tool's option surface.

#### The verdict — all 30, no cross-hatching

**Move (7)** — no dispatch, no gate input, method portable:

- **annotate-guidance** (312) and **annotate-inline** (307) — a brownfield annotation pipeline: map with two locator agents, select targets by depth rules plus a developer confirmation, run analyzer + pattern-finder per folder, self-review against a checklist, batch-write from templates. The only harness references are `allowed-tools` (a name list) and the `Agent({ subagent_type: … })` call shape. Their siblings travel: 2 templates each, and 5 `examples/` each (two of the five differ between them — measured, not assumed).
- **changelog** (185) — git-log classification into Keep a Changelog sections. Its `contract` is `kind: side-effect` / `effect: changelog-edit`; nothing gates on it. `changelog-bootstrap.mjs` is used by this skill alone, so its helper moves cleanly.
- **frontend-design** (279) — scan the tree, then one aesthetic question per dimension, then emit guidelines. Two lines are pi-shaped and both are one-line edits: it says *do not* use `pi.sendMessage` (line 264) and it inherits pi tool names.
- **create-handoff** (126) and **resume-handoff** (230) — the handoff pair: compact the session into a document, then read it back and verify the tree against it. `kind: produces` with `artifactKind: handoff`, consumed by the other half and by nothing that gates.
- **discover** (238) — the requirements interview (one question at a time, intent before probes, a lazily expanded decision tree) into an FRD. `grep` for `frd` across `built-in-workflows.ts` and `built-ins/*.ts` is **empty**: no workflow reads it.

**Stay (21)** — the engine's arms, each with the reason that binds it:

acceptance (its inventory is the completeness gate's anchor; `required: [items, item_count]`), amend (reads the grade gate's channel flags and re-emits latest-wins), architecture-review (Step 8 rewrites the `phases:` array the contract declares), blueprint (`phases`/`phase_count` the implement fanout derive-checks; its metadata fence is `${SKILL_DIR}`), design-review (announces every design path into the `designs` channel), design-slice (`filename_slice` is parsed by the build workflow and "never authored"), elaborate (its `## Phase N:` heading is the splice anchor for `stitch-elaborations`), flow-remediate (its success *is* the presence of the closing block the gate looks for), grade (the verdict schema folded across the panel), implement (parallel-lane write-scope plus the `reconcile` directives it must record), lens-grade (verdict JSON addressed by `unit/lens/round/generation` for the loop), quick-plan (the plan-time checks it exists to satisfy), slice (the re-slice half is gate plumbing; the fresh-cut half is not, and splitting it is a product decision), synthesize (the `sources:` coverage floor and the `files:` contract the fanout derives edges from), validate (`blockers` is "the ONLY handles the workflow's remediation arm may act on"), research (`status` enum plus `consumes: artifactKind: [frd]`), **design** (hand-run, but its one-slice-per-session resume protocol and `${SKILL_DIR}` metadata fence are its spine), **explore** (one of the two `verdict` declarations), **plan** (pure transcription of one engine artifact into the shape the next one validates), **pr-triage** (`required: [security_flag, blockers_count]` — a gate field), **migrate-to-guidance** (the method *is* FLOW's own `scripts/migrate.js` writing `.flow/guidance/`).

**Decided — both stay (2)**, closed 2026-10-08 rather than left open:

- **commit** (93) — the method is entirely git (diffstat, `git log --pretty=%s -n 20` for style, group by purpose, `git add` by path, never `-A`) and its `contract` is `kind: side-effect`, so it passes both tests. **It stays because three sites dispatch it** — `vet:commit`, `polish:commit` and `/skill:commit --baseline` from the goal-baseline built-in — so moving it would put every preset's last stage behind an installed skill. `commit-suggestion` here is a near-neighbour, not a collision (it suggests a message and never runs git), so dispatch is the whole reason.
- **revise** (317) — **it stays because it edits FLOW's plan-artifact schema**: the `- [x]` checkbox semantics `implement` trusts, and `phases:` kept in step with the headings. Measured while closing this: **no workflow dispatches it either** — only `pipeline-pointer.ts` names it — so the *"the orchestrator wires both upstream artifacts in"* line in its body is stale, the same class of dead claim as `BUNDLED_SKILL_NAMES` and `isolated: true`. That does not change the decision: the artifact format is what binds it, exactly as it binds `plan`/`slice`/`synthesize`. Recorded as a finding, not fixed here.

#### What a move costs — the normalisation, measured

A moved body keeps working in pi untouched, because `flow-args` is installed and hooks `/skill:<name>` for every skill the loader knows, bundled or not. It does **not** keep working in the other harnesses, which is the point of moving it — so each moved body is normalised in the same pass, and the list is exactly what the measurements above produced:

| token | occurrences | becomes |
|---|---|---|
| `$ARGUMENTS` | 30 bodies, 38 uses | "the arguments you were given", or the documented `$ARGUMENTS` where the harness supports it (claude-code's command fields include it; pi's prompt templates use `$@`) |
| `${SKILL_DIR}` | 24 bodies, 50 uses | the skill's own directory — 2b's normalisation, and the reason 2a's siblings exist |
| ```` ```! ```` fences | 23 bodies | a fenced command plus "run it" — inert text otherwise, which is what a moved body must not ship |
| `shell-timeout` | 25 bodies | **dropped.** It bounds fence execution only, and there are no fences left to bound |
| `ask_user_question` | 98 uses, 26 bodies | "ask the developer", with the tool's *machinery* dropped — `MAX_HEADER_LENGTH`, the auto-appended `Type something.` row, and the rule about not authoring an `Other` option. The engine's parking is unaffected — see *The test, resolved*. `(Recommended)` **stays**: it is plain wording inside an option's label, not a widget, and every harness's picker renders it. *(Corrected 2026-10-08, after 3d-i shipped: the table first listed `(Recommended)` as removed, and the built bodies keep it.)* |
| `allowed-tools` | 16 bodies | per-target names: `targets.pi.tools`-style mapping, the shape (d) established — FLOW writes claude-code's `Read, Grep, Glob` in bodies that only ever ran on pi |
| `pi.sendMessage`, `/skill:`, `/new` | frontend-design 264, several bodies | generic phrasing |

#### Split: 3d-i and 3d-ii

The *mechanism* the move needs is in place — siblings land beside `SKILL.md` and are removed by `uninstall` (2a, executed), a `contract:` under `targets.pi` is read back by FLOW's own harvester from the installed skill (2b, executed), `disable-model-invocation` and `allowed-tools` are expressible in pi `auto`, and `/skill:<name>` resolves against the loader's whole skill set (pi's `agent-session.js`, read — the end-to-end command is 3d-i's first check, named under *Confidence*). What is not settled is `_shared/`. Three of the seven candidates need a script that the twenty-one stayers keep: `now.mjs` (20 stayers), `git-context.mjs` (16), `list-recent.mjs` (3). Moving them means **two copies of the same script in two repositories**, which is the drift this programme exists to remove — and 2a's sibling rule refuses `../_shared/x.mjs` by construction (a path that escapes the skill directory is a declaration problem), so there is no third option inside today's mechanism.

So: **3d-i moves the four that need no shared script** — annotate-guidance, annotate-inline, changelog, frontend-design. **3d-ii moves discover, create-handoff and resume-handoff**, and is blocked until the `_shared` question is answered (per-skill copies with the duplication named, or a shared-asset concept in this repository, or `_shared` moving wholesale when the stayers retire). 3d-ii gets its own go.

**Superseded 2026-10-08, before 3d-ii started: that was the wrong blocker.** The paragraph above is kept because it is what the go was given on and the replacement should be readable beside it. Read on.

#### Acceptance criteria (3d-i)

1. `src/skills/` holds the four bodies, and each is **byte-identical to `git show f67d744:packages/flow/skills/<name>/SKILL.md`** apart from the normalisation table above — the diff is pasted into this plan, per file, and names every changed line's reason.
2. Every `targets.claude-code` value that survives is claude-code's own vocabulary, and `grep -rnE '\$\{SKILL_DIR\}|^```!|\$ARGUMENTS|shell-timeout|pi\.sendMessage' src/skills/{annotate-guidance,annotate-inline,changelog,frontend-design}/` returns **nothing**.
3. The three pi-only things a moved body must keep are declared where pi reads them: `disable-model-invocation: true`, the `contract:` block, and `allowed-tools` — each under `targets.pi`, each reported expressible by `sync` (no unsupported-field warning for these four).
4. `grep -rn 'ask_user_question\|MAX_HEADER_LENGTH' src/skills/{annotate-guidance,annotate-inline,changelog,frontend-design}/` returns nothing, and the same bodies in `packages/flow/skills/` are **deleted** — one provider per harness, so `pi` must not find two skills named either one.
5. Every sibling the body resolves by relative path is declared and lands: annotate-guidance and annotate-inline install 7 files each beside `SKILL.md` (2 templates + 5 examples), changelog 1 (`_helpers/changelog-bootstrap.mjs`), frontend-design none — and every installed copy is byte-identical to **this repository's** bundle source under `src/skills/<name>/`, compared from the installed path, never from the committed one.
6. `/skill:<name>` resolves for each of the four from the installed skill directory, and the pipeline pointer's text is unchanged (the names did not move) — `grep -c 'annotate-guidance\|annotate-inline\|changelog\|frontend-design' packages/flow/extensions/flow-core/pipeline-pointer.ts` is the same before and after.
7. Nothing else moves: from the repository root `sync --dry-run` reports the four as the only new installs — **8 new records**, pi `auto` and claude-code `auto` each, so the total moves from `in-sync 64` to **72** — `undeclared 8` unchanged, nothing `foreign`, and a second run reports `drifted 0 · missing 0`.
8. The twenty-one stayers are still FLOW's: `packages/flow/skills/` holds **26 skills (27 directories with `_shared/`)** — the four deleted here and `code-review` deleted by 2b — `pnpm -r run test` from the workspace root is green, and no stayer's installed artifact changed byte for byte (hash the four harness directories before and after, as 2e and (d) did).
9. Documentation lands where the dependency is stated: `README.md` and `docs/conventions.md` gain the four skills, and `packages/flow/docs/` states the new dependency (these four are installed, not bundled) the way 2b did for the review.
10. Gates and standing rules: `npm run build` → `npx biome check .` → `CI=true npm test`; no new dependency, **no new runtime module**, and no comment added to any body beyond what it already carries.

#### Budget (3d-i)

| area | file | what | est. |
|---|---|---|---|
| content | `src/skills/annotate-guidance/SKILL.md` (new) | 312 lines moved + normalisation | — |
| content | `src/skills/annotate-inline/SKILL.md` (new) | 307 moved + normalisation | — |
| content | `src/skills/changelog/SKILL.md` (new) | 185 moved + normalisation | — |
| content | `src/skills/frontend-design/SKILL.md` (new) | 279 moved + normalisation | — |
| payload | `annotate-guidance/{templates,examples}/` 7 files | verbatim | ~378 |
| payload | `annotate-inline/{templates,examples}/` 7 files | verbatim | ~378 |
| payload | `changelog/_helpers/changelog-bootstrap.mjs` (+ its test, not installed) | verbatim | ~35 |
| config | `skillset.config.json` | 4 installs (pi `auto`, claude-code `auto`), 2 `siblings` blocks | ~+50 |
| content edit | 4 bodies | the normalisation table, per file | ~+80 / −120 |
| tests | `src/skills/skills.test.ts` or a new `test/skills/flows.test.ts` | the four render, the siblings land, the deletions hold, `sync` round trip | ~130 |
| docs | `README.md`, `docs/conventions.md` | 4 rows, the dependency note | ~+35 |
| docs | `packages/flow/docs/skills.md` | these four are a dependency now | ~+10 |
| docs | this plan | this section, its review log, the handoff update | ~+230 |

- New dependencies **none**. New runtime modules **0** — the slice is content, declarations and tests, like 3b. Estimated implementation logic **0 lines**; edited body lines **~200**; physical **~800–1,050** including payload and tests.
- **Base rate, stated so the estimate is not read as precision:** every slice that added a mechanism overran; this one adds none, and the two slices that were also content-and-tests only (3b, 3c) came in at **under** and **−24%** against their estimates.

#### Decisions

1. **The test is "is it dispatched" and "does it publish a gate input", not "does it name a pi tool".** Naming is not binding — 2d proved a tool can be described generically with the engine's behaviour intact — and the measured coupling turned out to be `flow-args`, not pi.
2. **`ask_user_question` may be named generically in a moved body; its option surface may not travel.** The parking is the tool's; the 16-character header cap and the auto-appended free-text row are pi's UI, and a body that tells another harness to respect them is documenting someone else's implementation.
3. **A body the engine dispatches stays**, even when its prose is neutral. Seventeen skills, measured, and the alternative is that every preset's stage depends on an installed skill — a dependency this programme accepted once (2b, deliberately, for one skill) and should not accept seventeen times without a decision.
4. **`shell-timeout` is dropped in the normalisation**, because it bounds fence execution and the fences go with it. It is not a pi field and reading it as one would put a falsehood in `expresses`.
5. **The four moved skills install as pi `auto` and claude-code `auto`** — `auto` because only a skill directory carries siblings, and pi `auto` because that is the mode `/skill:<name>` resolves from. Not opencode and copilot: their skill loaders cannot be exercised on this machine (opencode's arm64 binary is `invalid signature`, Copilot CLI is installed nowhere), and declaring them would be the unverifiable renderer this programme keeps refusing.
6. **`argument-hint` goes only where it is read.** It is a pi *prompt-template* field (`docs/prompt-templates.md:14`) and claude-code reads it for skills — so it stays under `targets.claude-code` and leaves the pi side, where `auto` cannot express it and a warning would be reported for every one of the four.
7. **3d is split, and the split is `_shared/`.** The three script-dependent movers are held until that question is answered; the four clean ones are not.

**Road not taken.** *Move the seventeen dispatched skills too, contract and all* — mechanically possible (2b proved a gate arm can live here, keep its name and still be read by the harvester), but it converts FLOW's self-contained pipeline into a set of installed skills, and that is a dependency decision the plan has not made. *Keep the bodies pi-shaped and let the other harnesses get inert text* — the moved copy would carry `${SKILL_DIR}` fences that never run and `$1` placeholders nothing substitutes, which is shipping a broken artifact to three harnesses to save a rewrite. *Move a `_shared/` copy per skill and call the duplication temporary* — it is two copies of a script in two repositories with no test that keeps them equal, which is the failure ADR 0006 exists to prevent; if the developer wants the three movers now, the honest price is a shared-asset concept, and that is 3d-ii's blocker.

→ **worth an ADR: 0009 — what a portable body may not name, and which bodies stay with the engine.** Its rule outlives this plan: a body this repository owns names no harness tool's *option surface* and no *extension-provided substitution*, and a body the engine dispatches by name does not move, however neutral its prose. Draft below.

**ADR appendix — 0009: portable bodies and engine arms.**

**Context.** This repository owns skill bodies rendered for four harnesses. Two classes of coupling were found while triaging 30 bodies that came from a pi package: tokens no harness provides but a *workspace extension* does (`flow-args` substitutes `${SKILL_DIR}`, `$ARGUMENTS` and ```` ```! ````; it alone reads `shell-timeout`), and bodies whose entire purpose is to publish a value a pi workflow gate reads. Naming an extension's token and naming a harness tool look identical in a diff, and both survived three slices of review here.

**Decision.** A body this repository owns must be executable in a harness that has none of this workspace's extensions: it names no extension-provided substitution, and it names no harness tool's option surface (option-count limits, auto-appended rows, label conventions). Naming a *capability* generically is allowed and preferred — "ask the developer with options", "if this session exposes an adjudication tool". Separately, a body whose dispatch the harness engine performs by name stays with that harness's package: moving it makes the engine's stages depend on an installed artifact, which is a dependency decision, not a portability one.

**Consequences.** Bodies move less often and are rewritten more when they do; the rewrite is mechanical and its list is measurable (the normalisation table above). Two failure modes become visible instead of silent: a body carrying a token nothing expands, and a stage whose skill is no longer bundled. The cost is that a genuinely useful pi convenience (`${SKILL_DIR}`) cannot be used in owned content — accepted, because the alternative is a body that half-works.

#### Confidence

**~96%.** Every load-bearing claim above is executed or read from the implementation, and each is cited where it is made: the dispatch map (jiti-imported workflows, not a grep), the roster count, the per-token coupling counts, the `_shared` sharing matrix, `/skill:` resolution and `disable-model-invocation` semantics (pi's own `agent-session.js` / `resource-loader.js`), the renderer's accepted shapes (its code and a sweep of all 30 frontmatters), the absence of `shell-timeout` in pi and its single reader in `flow-args`, and the empty `frd` channel. What is judgment, and is marked as judgment: the six stay-rules that rest on "the engine parses this" rather than on a token count, and the two bodies left as DISCUSS, where the developer's answer — not more evidence — is what decides.

What is **not** verified and would be 3d-i's first check: that a skillset-installed `auto` skill is reachable as `/skill:<name>` in a **live** pi session. The mechanism is read from pi's code and 2b's loader probe showed the skill is discovered; the end-to-end command, through a session, has not been run. The fallback if it fails is cheap and named: the four skills would then need a pi `slash` install beside the `auto` one, which 2b already does for the review.

Nothing is authorised. ~~The go for 3d-i is a separate step.~~ **Go given 2026-10-08; implemented below — and 3d-ii with it, which closed slice 3d.**

### Implemented — 3d-i, the four standalone bodies move — 2026-10-08 (Review log)

The developer gave **go** on rule 3 as scoped. Four bodies left the FLOW package for this repository, normalised off every `flow-args` token on the way, and FLOW's copies are deleted so each name has one provider per harness.

**What landed.** `src/skills/{annotate-guidance,annotate-inline,changelog,frontend-design}/SKILL.md` (new); their payload beside them — 7 template/example files for each annotate skill, `_helpers/changelog-bootstrap.mjs` for `changelog`; `skillset.config.json` declarations (pi `auto` + claude-code `auto` each, three `siblings` blocks); `src/core/portable-body.test.ts`; `docs/decisions/0009-portable-bodies-and-engine-arms.md`; README rows and the *Portable bodies* section of `docs/conventions.md`; and in `pi-extensions`, 19 deletions plus the dependency note in `packages/flow/docs/skills.md`.

**Criteria as built.**

1. Holds, with the diff measured per file rather than pasted whole (each is 53-54 changed lines and the two output blocks are the body plus its payload, which is noise at this size): the four bodies differ from `git show f67d744:packages/flow/skills/<name>/SKILL.md` by **54 / 54 / 53 / 54** lines, and `git diff` shows every one of them is a line the normalisation table names. No body line was reflowed, reordered or dropped.
2. Holds — `grep -rnE '\$\{SKILL_DIR\}|^```!|\$ARGUMENTS|shell-timeout|pi\.sendMessage|ask_user_question|MAX_HEADER_LENGTH|subagent_type' src/skills/{annotate-guidance,annotate-inline,changelog,frontend-design}/` returns **nothing**.
3. Holds **as amended** — `disable-model-invocation: true` and the `contract:` block travel under `targets.pi`, `sync` reports no unsupported field for any of the four, and every rendered pi artifact lets pi's loader mark them hidden (transcript below). The clause about `allowed-tools` does not: see *Deviations*.
4. Holds — the same sweep, and `packages/flow/skills/` no longer holds the four (27 directories: 26 skills + `_shared/`).
5. Holds — 7 / 7 / 1 / 0 sibling files per skill, declared and landing beside `SKILL.md` in both harnesses: **30 installed copies checked against the bundle source, 0 differing**.
6. Holds — pi's own loader finds all four at `~/.pi/agent/skills/<name>/SKILL.md` with `disableModelInvocation` set, **0 collisions**, no name loaded twice; and `git diff --stat packages/flow/extensions/flow-core/pipeline-pointer.ts` is empty, with all four names still in the pointer (3 references).
7. Holds — `reconciled missing 8 · undeclared 8 · in-sync 64 · 8 written`, then `checked undeclared 8 · in-sync 72`.
8. Holds, by hash — 5,810 files across `~/.pi/agent` and `~/.claude` hashed before and after **sync**: 40 new lines, of which 38 are this slice's artifacts and the remaining two are files that changed in place for reasons outside it — this session's own transcript and `pi-permission-system/logs/…jsonl`. **No skillset-owned artifact changed byte for byte**, and `~/.config/opencode` / `~/.skillset/copilot` were not touched at all. `pnpm -r run test`: **68 files / 1668 tests passed**.
9. Holds — README gained four rows, `docs/conventions.md` replaces its retired rule and states the new one, and `packages/flow/docs/skills.md` says the four are installed now rather than bundled, and that nothing in `/wf` needs them.
10. Holds — `npm run build` · `npx biome check .` (81 files) · `CI=true npm test` → **33 files / 344 tests** (was 32 / 340); no new dependency, no new runtime module, and **no comment added to any body** — the four were rewritten at the token sites only.

**Verification, in the order it ran.**

```sh
npm run build                   # tsc + copy-skills + copy-agents, clean
npx biome check .               # 81 files clean
CI=true npm test                # 33 files / 344 tests
node dist/cli.js sync           # reconciled missing 8 · undeclared 8 · in-sync 64 · 8 written
node dist/cli.js sync --dry-run # checked undeclared 8 · in-sync 72
# pi-extensions
pnpm -r run test                # 68 files / 1668 tests
```

`pi --print` cannot answer the command question (a skill with `disable-model-invocation` is absent from the model's list by design), so the check is the loader's own: `loadSkills()` from the installed package's `dist/core/skills.js`, called against the real agent directory.

```
annotate-guidance    /Users/joozik/.pi/agent/skills/annotate-guidance/SKILL.md (hidden)
annotate-inline      /Users/joozik/.pi/agent/skills/annotate-inline/SKILL.md (hidden)
changelog            /Users/joozik/.pi/agent/skills/changelog/SKILL.md (hidden)
frontend-design      /Users/joozik/.pi/agent/skills/frontend-design/SKILL.md (hidden)
loaded skills: 9 | collisions: 0
names loaded twice: none
```

That closes the *Confidence* gap this scope named — discovery and the hidden flag are now observed rather than read from `agent-session.js`. What is still unobserved is the end of the chain: `_expandSkillCommand` reading one of these bodies in a live session. Its mechanism is four lines (`getSkills().skills.find(…)`) and its fallback is unchanged (a pi `slash` install beside the `auto` one).

**Measured against the budget.**

| area | budget | measured | verdict |
|---|---|---|---|
| moved bodies | 312 + 307 + 185 + 279 = 1,083 lines | **1,102** (318 + 313 + 188 + 283) | +19, the four frontmatter blocks growing |
| body edits | ~200 changed lines | **215** (54 + 54 + 53 + 54) | met |
| payload | 378 + 378 + ~35 | **798** across 15 files | met |
| `skillset.config.json` | ~+50 | **+60** | over by 10 |
| tests | ~130 | **99** new + 19 amended (5 in skillset, 14 in pi-extensions) | under |
| docs | ~+35 tracked | **+27** (README 4, conventions 14, pi-extensions 9) + ADR 26 | met |
| **runtime logic** | **0 lines** | **0** | met |
| new dependencies / runtime modules | none / 0 | none / 0 | met |
| this plan | ~+230 | over | it carries the scope and this record |
| physical, headline | ~800-1,050 | **~2,300 added**, of which **1,900 is moved content** (1,102 bodies + 798 payload) | see the note |

**The headline number, stated honestly.** 800-1,050 was always going to exclude the moved bodies — the budget table listed them with no estimate, because they are not written so much as relocated — but the whole-file total is roughly twice that, and a reader comparing the two should see both. What was *authored* is 392 tracked lines (config 60, conventions 14, README 4, test files 118, ADR 26, plus small amendments); what was *carried* is 1,900. This is the same shape 2b measured and counted the same way.

**Deviations, each deliberate.**

- **`allowed-tools` does not travel to pi.** Criterion 3 asked for it under `targets.pi` and reported expressible, and pi's field list does accept the key. It is dropped anyway: pi's documentation calls it an *"Experimental pre-approved tool list"* with no documented value format, and the four bodies' values are **claude-code's** vocabulary — `Bash(git *), Read, Edit`, `Agent, Read, Write, Glob, Grep` — applied to bodies that until this slice could only ever run on pi. Writing them under `targets.pi` would have preserved the wrong vocabulary in a format nothing documents; claude-code keeps them verbatim, where they mean what they say. A criterion amended rather than a format invented.
- **The four `contract:` blocks travel, and nothing reads them.** They are carried verbatim under `targets.pi` because removing them would be an unforced behaviour change, but the measurement in *3d* stands: nothing gates on these four (no workflow reads `frd`, and none of the four is dispatched). Recorded as an open finding, not fixed here.
- **Test amendments in both repositories.** `test/agents-kind.test.ts` pinned `checked in-sync 64` and now pins **72** — the slice's own arithmetic, and the count the criteria predicted. In pi-extensions, `skill-contracts-source.test.ts` lost the four names from three lists (declared size 30 → **26**, the not-harvested set 15 → **11**, the side-effect list 8 → **4**), each amended with the reason rather than deleted — the same class of amendment 2b recorded when a test enumerates bundled skill names.
- **A new test file rather than an extension of an existing one.** `src/core/portable-body.test.ts` is the ADR as an executable ratchet: the residual-token sweep over every bundled body (so a future body cannot ship `${SKILL_DIR}` silently), the install shape for the four, the frontmatter placement rule, and the sibling declaration checked against the filesystem. The sweep matches `${SKILL_DIR}/` and not the bare token, because `code-review`'s body *mentions* `${SKILL_DIR}` to say that no harness expands it — a test that failed on the sentence documenting the rule would be the wrong test.

**Not yet done.** Nothing is committed in either repository. 3d-ii (`discover`, `create-handoff`, `resume-handoff`) stays blocked on the `_shared` question, and `commit` + `revise` stay open — all three as scoped.

**Commit — drafted, never run.** Both add **and** remove files, so `git add -A`, never `git commit -am`. **Run the Windows CI fix first**, on its own (`git add src/bridges/bridges.test.ts`, drafted under *The third instance* above) — otherwise this `git add -A` sweeps that one-line fix into a slice it does not belong to.

```sh
# skillset
git add -A && git commit -F - <<'MSG'
skillset: four standalone FLOW bodies move in, off the flow-args tokens (0023 slice 3d-i)

annotate-guidance, annotate-inline, changelog and frontend-design are invoked by
hand rather than dispatched by the pi workflow engine, so nothing in /wf needs
them and they can live where every harness can read them. FLOW's copies are gone:
one provider per harness, same names, and its pipeline pointer is unchanged.

Each body was normalised off the tokens a workspace extension expands and no
harness does — $ARGUMENTS, ${SKILL_DIR}, the ```! fences, and shell-timeout,
which is read by flow-args alone. What stays pi's (disable-model-invocation, the
contract block) is declared under targets.pi; claude-code keeps the allowed-tools
values, written in its own vocabulary. allowed-tools is dropped for pi rather
than inventing a format for a field pi calls experimental and does not document.

Siblings travel: 7 template/example files per annotate skill, one helper for
changelog. sync wrote 8 installs; 30 installed payload copies verified
byte-identical to the bundle, 5,810 files hashed across ~/.pi/agent and ~/.claude
with no owned artifact changed. New test file pins the rule for every future body.

Gates: build, biome 81 files, CI=true 33 files / 344 tests. sync --dry-run: in-sync 72.
MSG

# pi-extensions
git add -A && git commit -F - <<'MSG'
flow: four standalone skills retire to skillset (0023 slice 3d-i)

annotate-guidance, annotate-inline, changelog and frontend-design are owned by
skillset now, rendered for pi and claude-code from one body. None of them is
dispatched by a workflow, so the pipeline is unaffected and pipeline-pointer.ts
is untouched — the names still resolve, from the installed skill.

docs/skills.md says so, and says what breaks without `skillset sync`: their
/skill:<name> commands are simply absent, and nothing in /wf notices.

skill-contracts-source.test.ts loses the four from its three lists (declared
30 -> 26, not-harvested 15 -> 11, side-effect 8 -> 4) — a test enumerating
bundled names, amended rather than relaxed.

pnpm -r run test: 68 files / 1668 tests.
MSG
```

### Implemented — 3d-ii, the last three bodies, and the `_shared` question dissolved — 2026-10-08 (Review log)

The developer gave **go** on closing slice 3d: `commit` and `revise` decided (both stay — see *Decided* above), and 3d-ii run.

**The blocker was the wrong blocker, and the reason is in the scripts.** Measured before writing a line:

- `now.mjs` prints `<iso>\t<slug>` — one `date` call twice.
- `git-context.mjs` prints six labelled git facts — `branch`, `commit`, `repo`, `root`, `in_repo`, `author`.
- `list-recent.mjs` is `ls -t <dir> | head -n N` plus a git-root resolution.

Both consumers use them **to fill artifact frontmatter** — `create-handoff` and `discover` run them inside a fence and copy the values verbatim. That is precisely the case **2d already solved**: *"frontmatter values derived with plain `git` and `date` commands written in the body — no `${SKILL_DIR}`-relative sibling script, no `_shared` call."* So the choice was never *copy the script or build a shared-asset concept*; it was *carry a script at all, for six shell commands*. Inlined, there is no copy, no duplication, and no new mechanism — and the bodies got **more** portable, because a `date` and a `git rev-parse` work in every harness.

**What landed.** `src/skills/{discover,create-handoff,resume-handoff}/SKILL.md` (new) with `templates/frd.md` beside `discover`; the three `Metadata` fences replaced by six/bash commands; `skillset.config.json` declarations (pi `auto` + claude-code `auto` each, one `siblings` block); README rows; `packages/flow/docs/skills.md` updated; and in `pi-extensions`, 21 deletions plus three amended lists in `skill-contracts-source.test.ts`.

**Criteria — the same ten, applied to three bodies.**

1. Diff against `git show f67d744:…`: **84 / 78 / 56** changed lines, every one a line the normalisation table names (the two Metadata blocks are the bulk).
2. Residual sweep clean across the three — including `/skill:` and `` `Agent(` ``, which the 3d-i sweep did not check and which these bodies used in help blocks and dispatch shapes.
3. `disable-model-invocation` and `contract:` under `targets.pi`; `argument-hint` only under `targets.claude-code`; **no `allowed-tools` on either side** — none of the three declared it.
4. The three are gone from `packages/flow/skills/`, which now holds **23 skills (24 directories with `_shared/`)**.
5. `discover` carries one sibling (`templates/frd.md`), landing beside `SKILL.md` in both harnesses, byte-identical; the other two carry none, and **no `.mjs` was carried anywhere**.
6. pi's loader finds all three at `~/.pi/agent/skills/<name>/SKILL.md`, hidden, **0 collisions**, none twice.
7. `reconciled missing 6 · undeclared 8 · in-sync 72 · 6 written`, then `checked undeclared 8 · in-sync 78`.
8. Hashing `~/.pi/agent` and `~/.claude` before and after: **8 new files** (3 skills × 2 harnesses + `frd.md` × 2) and **zero files changed in place**.
9. README and `packages/flow/docs/skills.md` — which now says seven skills are installed rather than bundled, and 23 are shipped.
10. `npm run build` · `npx biome check .` (81 files) · `CI=true npm test` → **33 files / 344 tests**; pi-extensions `pnpm -r run test` → **68 files / 1668 tests**; no new dependency, no new runtime module, no comment added.

**The three `_shared` scripts stay where they are**, serving the 20/16/3 stayers that still call them. Nothing was duplicated and nothing was moved out of that directory — which is the outcome the blocked framing had assumed was impossible without a new mechanism.

**Finding recorded, not fixed.** The sweep over *bodies* is clean, but a sweep over everything under `src/skills/` flags `code-review/_helpers/review-range.mjs` — its docstring explains how **pi** passes arguments (`$ARGUMENTS`, "ask the user via ask_user_question"), and it is a **payload file carried verbatim** by 2a, not a body. The ratchet in `portable-body.test.ts` reads `SKILL.md` alone and is deliberately scoped that way; editing the helper would break the property that it is FLOW's file unchanged, whose only deviation is the one docstring line 2a normalised. Recorded so the next person reading a full-tree grep does not read two comment lines as two violations.

**Measured against the budget.** There was no separate budget for 3d-ii: it was scoped only as "blocked". Measured from the diff: **612 body lines** (218 changed by the normalisation: 84 + 78 + 56), one sibling (`templates/frd.md`, 78 lines), **config +31** (the three install blocks and one `siblings` entry; 3d-i's was +60), **docs +7/−1** (`packages/flow/docs/skills.md`) plus three README rows, and the test side is the three amended lists in `skill-contracts-source.test.ts` (shared with 3d-i's amendment: 9 added / 30 removed across both) and the extended `MOVED`/`SIBLINGS` tables in `portable-body.test.ts`. No implementation logic, no dependency, no new runtime module.

**Not yet done.** Nothing is committed. `revise`'s stale orchestrator claim is recorded as a finding rather than fixed — it is FLOW's body, and changing it is not this slice's.

**Commit — drafted, never run.** Adds and removes, so `git add -A`.

**Read this before running the drafts above: 3d-i and 3d-ii share a tree, and `git add -A` cannot tell them apart.** `skillset.config.json`, `README.md`, `docs/plans/0023-…md` and `skill-contracts-source.test.ts` each carry both slices, so running 3d-i's message with `git add -A` sweeps 3d-ii's files into it and leaves the second command with nothing to commit. Two honest options:

- **One commit for the slice (recommended, and what the messages below are written for).** 3d was one authorisation — the triage and its moves — and splitting it needs `git add -p` over four shared files for no gain in the history.
- **Two commits**, if the split matters: `git add -p` for the four shared files, path-scoped adds for everything else (`git add src/skills/annotate-guidance src/skills/annotate-inline src/skills/changelog src/skills/frontend-design` and the pi-extensions deletions for 3d-i; the rest for 3d-ii), using the per-slice drafts above.

Combined, in the order to run them: **the Windows CI fix on its own first** (`git add src/bridges/bridges.test.ts`), then one commit per repository.

```sh
# skillset — after the CI fix
git add -A && git commit -F - <<'MSG'
skillset: the seven portable FLOW bodies move in (0023 slice 3d)

annotate-guidance, annotate-inline, changelog, create-handoff, discover,
frontend-design and resume-handoff are invoked by hand rather than dispatched by
the pi workflow engine, so nothing in /wf needs them and they can live where
every harness can read them. FLOW's copies are gone: one provider per harness,
same names, its pipeline pointer untouched.

Each body was normalised off the tokens a workspace extension expands and no
harness does — $ARGUMENTS, ${SKILL_DIR}, the ```! fences, and shell-timeout, which
is read by flow-args alone — and off the question tool's dialog surface. Where a
helper did the work of six shell commands (a timestamp, six git facts, ls -t |
head), the commands are inline now: no copy, no shared-asset mechanism, and the
bodies are portable to harnesses that have neither extension.

What is pi's (disable-model-invocation, contract) is declared under targets.pi;
allowed-tools travels only where its values mean what they say, claude-code.

sync wrote 14 installs; 46 files added under ~/.pi/agent and ~/.claude with no
owned artifact changed. A new test file pins the rule for every future body.

Gates: build, biome 81 files, CI=true 33 files / 344 tests. sync --dry-run: in-sync 78.
MSG

# pi-extensions
git add -A && git commit -F - <<'MSG'
flow: seven standalone skills retire to skillset (0023 slice 3d)

annotate-guidance, annotate-inline, changelog, create-handoff, discover,
frontend-design and resume-handoff are owned by skillset now, rendered for pi and
claude-code from one body each. None is dispatched by a workflow, so the pipeline
is unaffected and pipeline-pointer.ts is untouched — the names still resolve, from
the installed skill.

docs/skills.md says so, and says what breaks without `skillset sync`: their
/skill:<name> commands are simply absent, and nothing in /wf notices.

skill-contracts-source.test.ts loses them from its three lists (declared 30 -> 23,
not-harvested 15 -> 8, side-effect 8 -> 3), amended rather than relaxed.

pnpm -r run test: 68 files / 1668 tests.
MSG
```

```sh
# skillset
git add -A && git commit -F - <<'MSG'
skillset: discover and the handoff pair move in, and the _shared blocker dissolves (0023 3d-ii)

The last three portable bodies. They looked blocked because each calls a _shared
helper the 21 stayers keep, and a copy would have been the drift this programme
exists to remove. The helpers are now.mjs (a timestamp), git-context.mjs (six git
facts) and list-recent.mjs (ls -t | head), and both consumers use them to fill
artifact frontmatter — 2d had already replaced exactly that with plain date and
git commands for the review. Inlined here too: no copy, no shared-asset concept,
and the bodies are more portable than before.

sync wrote 6 installs; 8 files added under ~/.pi/agent and ~/.claude and none
changed in place; pi's loader finds all three hidden with no collisions.

Gates: build, biome 81 files, CI=true 33 files / 344 tests. sync --dry-run: in-sync 78.
MSG

# pi-extensions
git add -A && git commit -F - <<'MSG'
flow: discover and the handoff pair retire to skillset (0023 slice 3d-ii)

23 skills ship here now. None of the three is dispatched by a workflow, so the
pipeline is unaffected and pipeline-pointer.ts is untouched.

skill-contracts-source.test.ts loses them from its three lists (declared 26 -> 23,
not-harvested 11 -> 8, side-effect 4 -> 3), amended rather than relaxed.

pnpm -r run test: 68 files / 1668 tests.
MSG
```

### Closed — `(e)`, `(g)`, `3e` and `3f` — 2026-10-08

Four items were carried as pending with nothing left to decide. Each is closed here with the evidence and the condition that would reopen it, so none of them reads as open work again.

**`(e)` — `install.ts`'s skill/agent duplication. Not pursued.** It was named as "the lever if 3a's +191 and (d)'s +71 logic overruns are not acceptable". Nobody has said they are unacceptable: both overruns are recorded with their per-file breakdown, and the duplication is the price of two kinds of artifact being covered by the same guarantees. *Reopens when a third artifact kind arrives* — at which point the two branches become three and a per-kind prepare helper pays for itself.

**`(g)` — `CLAUDE_CONFIG_DIR` / `PI_CODING_AGENT_DIR`. Not acted on.** On a machine where either is set, `sync` writes where the harness never looks. **Neither variable is set here**, so the finding cannot be verified on this machine without a temp dir, and acting on it would move the location of 78 recorded installs and needs a migration story. *Reopens when a machine that sets either variable needs skillset* — at which point the fix is per-bridge resolution (`sessionKeyFromEnv`'s shape), never a core one.

**`3e` — workflow declarations. Not moved.** Measured before closing it, because the entry read plausibly:

- `packages/flow/extensions/flow-core/built-in-workflows.ts` is **1,443 lines of TypeScript**, importing 16 symbols from `@joozik/flow-workflow/registration` (`acts`, `gate`, `match`, `produces`, `defineWorkflow`, …) plus ~40 helpers from its own `built-ins/`. Not a declaration file — code calling the engine's DSL.
- `@joozik/flow-workflow` is a **peerDependency**: the engine is a sibling at runtime, and it is the graph's **only reader**.
- **17 of its stages dispatch skills**, and by 3d's decision 16 of those stay with that package — so a graph living here would reference names owned next door.
- **Only pi can execute it.** The other three harnesses have no workflow engine at all, so a rendered copy would be one reader and three files nobody can run.

So the move would not be a move. `sync`'s entire contract is *harness directories* (`~/.pi/agent/**`, `~/.claude/**`, `~/.config/opencode/**`, `~/.skillset/copilot/**`), and a workflow graph lives in none of them: owning it here means a **projection** — source here, rendered back into a node package, kept in sync — which is the mechanism slice 2 deleted for being a second writer. The cost of leaving it is **zero**: one file, one reader, one package, and its name references are already checked (the harvest test is what made 3d-i's and 3d-ii's deletions show up as three failing lists rather than silent breakage). *Reopens when the graph becomes data rather than code calling a DSL, or when a second harness gains a comparable engine* — either would give it more than one consumer and make ownership meaningful.

**`3f` — prompts and commands. Already satisfied; the entry's premise was false.** It read: *"`pi-extensions` ships no `prompts/` directory; this repository's `slash` mode already covers that shape for all four targets, so the remaining gap is only that FLOW's stage skills install as skills rather than prompts."* Measured:

- There **is** a `prompts/` directory — `packages/flow-advisor/prompts/advisor-system.txt`, **8 lines**, declared in that package's `files` and read by the advisor extension at runtime. An extension's own system prompt for a sub-model: installed into no harness directory, addressed to no session. It stays with its extension, the same way `permission-policy-change` stays with `pi-permission-system`.
- Everything else the workspace matches on "prompt" is `.ts` code — formatters, sanitizers, the subagent prompt builder — runtime, not instruction content.
- The harness-facing shape the item existed to add — prompt templates and slash commands — **is `slash` mode**, live for all four targets, and it is what 2b and 3d installed wherever a skill needed it.

*Reopens when a prompt asset appears that a harness **loads*** — content addressed to a session rather than to one extension's internal model.

## Handoff — prompt for the next session

Paste this into a skillset session to continue. It assumes nothing that is not written above.

> Continue the skillset instruction-ownership programme. Read `docs/plans/0023-skillset-owns-instructions.md` in full first — it is the spec. Do not re-derive anything marked verified; it was checked by execution and the transcripts are in the plan. **Start with `git log` and `git status` in both repositories, never with this file's prose** — the prose has claimed "not committed" twice after the fact, and the 3b-ii entry says in as many words that its commit was still unrun when it was written.
>
> **State — 2026-10-08, re-verified with `git log` and `git status` rather than with this file's prose.** skillset: slices 1 (`880fdfe`), 2a (`7e65d1a`), 2c (`c8cc22d`), 2b (`7eb7f75` here, `4b66b55` in `pi-extensions`), 2d (`cea2963`), (b) (`90610ef`), 2e (`4852681` + `c174158`), 3a (`c917d4e`), (d) the claude-code agent renderer (`748d318`), the CI fix (`2069691`), 3b + 3b-ii (`d9f8c7d`) and **3c (`5458ebc`, `skillset: a project declares its own installs, and the context file is rendered (0023 slice 3c)`)** are committed and pushed — `git status -sb` reads `## main...origin/main` with no divergence, and the tree is **clean**. `pi-extensions` is clean at `f67d744`, untouched since 3a. Counts on the committed tree: `npm run build` clean, biome **80 files clean**, `CI=true npm test` **32 files / 340 tests**, `sync --dry-run` → `checked undeclared 8 · in-sync 64`. **On the uncommitted working tree (3d-i + 3d-ii + the Windows CI fix): biome 81 files, `CI=true npm test` 33 files / 344 tests, `sync --dry-run` → `in-sync 78`, and pi-extensions `pnpm -r run test` 68 files / 1668 tests.** **What is not readable from this machine: the CI run logs** (`gh` is installed but unauthenticated, no `GH_TOKEN`), so greenness rests on the local equivalent of what CI runs, not on a run log — as it has since slice 1.
>
> **One label to know about.** `748d318` reads `(0023 slice 3d)`, but **3d in this plan is the FLOW skill triage** — that commit is item **(d)**, the harness agent renderers, and the two share nothing but a letter. It is pushed, so the label stands unless you amend; the plan carries the correction.
>
> **What is built.** `src/agents/<name>.md` installs for pi **and** claude-code — `claude --agent zzz-sentinel -p "hi"` lists all 15 from the loader's own registry. `APPEND_SYSTEM.md` carries **two** marker blocks: `instruction-ownership` (the ownership rule; the one-provider rule; and the branch — in this repository edit the source and run `sync`, in any other project `skillset suggest "…"` and stop) and `standing-rules` (commits carry no trailers; code carries no comments; **a blocked command is a decision point, not a stop** — read the reason the denial printed, take the path that respects it, never re-issue the denied command or the same intent under another spelling, and never stall the task on the blocked step: do the rest, report it, ask). **`skillset suggest "<what should change, and why>"`** appends one JSON line (`at`, `cwd`, `session` when the environment supplies one) to `~/.skillset/suggestions.jsonl`; it works from any project because the global bin is a symlink into this repository's `dist/cli.js`. `retro` carries the suggestion step where it decides a finding's destination. `~/.pi/agent/AGENTS.md` is **rendered** now (pi `context`, global) from `src/skills/context-pointer/` — the same 99-estToken pointer it was by hand, no longer hand-written; the artifact map lives in `docs/conventions.md` and the rules in the anchor blocks.
>
> **Go state — nothing is authorised, and each item needs its own go.** **3c is committed and signed off** (`5458ebc`). **Slice 3d is closed** — the triage of all 30 of FLOW's skills is done, the seven portable ones have moved (3d-i: annotate-guidance, annotate-inline, changelog, frontend-design; 3d-ii: discover, create-handoff, resume-handoff), the twenty-one that the engine dispatches or that publish a gate input stay, and the last two are **decided**, not open (`commit` — three dispatch sites; `revise` — it edits FLOW's plan-artifact schema). Read *3d — scoped and awaiting go*, *Implemented — 3d-i* and *Implemented — 3d-ii* before touching a skill body; the per-skill verdict for all 30 is there, so it does not need re-litigating. **`(e)` and `(g)` are closed as decided-not-to-act**, each with the condition that would reopen it, in *Closed as decided-not-to-act* below — do not carry them as pending work. **Three things are uncommitted and drafted**: the Windows CI fix (one line in `src/bridges/bridges.test.ts`), then **one commit per repository covering slice 3d** — the two 3d slices share a tree, so their files cannot be separated by `git add -A`; the messages and the running order are at the end of *Implemented — 3d-ii* and none of them has been run. The plan's own move to `completed/` is part of that pending rename: `git add -A` picks it up. Everything built and live stands as before: `Mode` gains `context`, the second anchor mode (pi local `<root>/AGENTS.md`, global `~/.pi/agent/AGENTS.md` — **not** `<root>/.pi/AGENTS.md`, measured dead); `<root>/.skillset/config.json` is a second declaration root read additively, **local entries only**, with `projectPath` derived and `siblings`/`requires`/`agents` refused by name; `skillset init project` writes that skeleton once; `~/.pi/agent/AGENTS.md` is the rendered `context-pointer` block alone. Two consequences a next session must know: claude-code reads that same project `AGENTS.md` only where the project has no `CLAUDE.md` of its own — strings-level evidence, not loader-level — and a project must never scaffold `<root>/.pi/APPEND_SYSTEM.md`, which *replaces* the agent-dir one and would silence both global `always` blocks inside that project. **The programme has no unstarted work left.** `3e` and `3f` joined `(e)` and `(g)` in *Closed — `(e)`, `(g)`, `3e` and `3f`*: 3e is the pi engine's own configuration (1,443 lines of TypeScript calling its DSL, one reader, in the package that holds that reader) and 3f's premise was false — the only prompt asset is an extension's own system prompt. **The programme is complete, and this plan moved to `docs/plans/completed/` on 2026-10-08 on the developer's instruction** — with the commits drafted the same session and **not yet run**, which is the one place the record runs ahead of the paperwork. The work itself is described above and measured; the commands are in *The third instance*, *Implemented — 3d-i* and *Implemented — 3d-ii*; the Windows CI run is the last thing left to confirm. This was the first time in this programme the move was due rather than premature.
>
> **Recorded findings, not fixed** — do not fold them into another slice silently: the copilot target writes `mode: agent` where VS Code documents `agent:`; the classifier's drifted message says "edited locally" when it was the *source* that moved (seen again during 3b); `requires` in `skillset.config.json` is skill-keyed, so an agent name there is a coverage problem rather than a rule; `expresses` for claude-code agents comes from the field vocabulary, of which only `name`/`description`/`tools` are exercised; `skillset suggest` has no `--list` flag (the file is the interface until the queue argues otherwise); and a suggestion filed from *this* repository is distinguishable from one filed elsewhere only by its `cwd`.
>
> **Not verifiable on this machine, so not built:** opencode (arm64 binary `invalid signature`, SIGKILLed) and Copilot CLI (installed nowhere) keep **no** agent renderer. A renderer that cannot be checked against its own loader is the failure mode 2c recorded — say so rather than guessing. claude-code's `always` anchor (`~/.claude/settings.json`, a SessionStart hook) is declared by 2c and has never been exercised against that harness's loader either.
>
> **No comments. This is a standing instruction, and as of 3b it binds mechanically** — it is rendered from `src/skills/standing-rules/SKILL.md` into `APPEND_SYSTEM.md`, so it is in the block you are already carrying: no explanatory blocks, no "why" essays above functions, no invented section banners. Name things so the code reads.
>
> **Rules that are not negotiable.** Gates — skillset: `npm run build` *before* `npm test` (tests spawn `dist/cli.js`), then `npx biome check .`, **and `CI=true npm test`** — that variable is what CI runs in, and a red CI hid behind two slices of green local gates because `picocolors` colours output under `CI` and on `win32`; pi-extensions: `pnpm -r run test` from the workspace root (there is no root `npm test`). Commit messages are drafted, never run, carry no trailers of any kind, and a slice that adds files uses `git add -A`, never `git commit -am`. **Never use `rm -rf`** — the permission policy blocks it and the blocked call takes the rest of the command with it; use a unique `mktemp -d` scratch and a plain `rm <file>`, and when a blocked removal is the last step, leave it, report it, and ask rather than stalling the task on it (the standing-rules block now carries this: a blocked command is a decision point, not a stop). Never hand-write into `~/.pi/agent/**`, `~/.claude/**`, `~/.config/opencode/**` or an installed copy: change the source, run `skillset sync`, paste its report. **A slice that changes `src/skills/` or `src/agents/` is not finished until `sync` has run** — a commit is not a propagation. Keep the plan's criteria and budget current, and report overruns honestly.
>
> **Verification methods — use them rather than reading.** **The always channel and the context file are observable**: run a **fresh** `pi --print` process from `/tmp` and have it reproduce text that exists only in the installed file. Slices 1 and 3b both used this; it proves a block reaches the system prompt and that a second block did not displace the first, and it is the check for anything rendered into `APPEND_SYSTEM.md` or `AGENTS.md`. **Claude Code's agent loader is the registry probe**: install into `<temp>/.claude/agents/`, then `HOME=<temp> claude --agent zzz-sentinel -p "hi"` — the unknown name makes it print `Available agents: …` (`claude agents --json` is *not* that probe on 2.1.286; there the subcommand means background sessions). **pi's agent parser** is the authority for an agent artifact: from `packages/flow`, jiti-import `pi-subagents/src/config/custom-agents.ts` and call `loadCustomAgents(cwd)` with `PI_CODING_AGENT_DIR` pointed at a directory — run it twice to compare parsed fields. **FLOW's contract harvester** the same way (`buildUserSkillContracts()`). **claude-code's skill loader** via `HOME=<temp> claude --debug-file … -p "…"` and its `Loaded N unique skills (… user: N, …, legacy commands: N)` line; auth failing is irrelevant, no model call means the log is the loader's. **A byte-neutral move is proved by hashing the destination directories before and after** (`find <dir> -type f | sort | xargs shasum` then `diff`), never by a test count — and name any file that changed for a reason outside the change (a live session's own log and transcript did, on 2026-10-08). **An unrecorded artifact at an owned path whose bytes differ from the render is `foreign`** — expect a refusal, not an adoption; reach for `install --force` deliberately. **Verify the installed copy, not the committed one**: grep the changed markers under `~/.pi/agent/` and `~/.claude/` after `sync`. **Claude Code's tool and field names come from the build, not from memory** — `strings` the installed binary for the name before declaring it.
>
> **Parallel workstream (separate session, `pi-extensions`) — step 1 done, step 2 not authorised.** `docs/plans/0017-context-economy-load-on-demand.md` carries `## Step 1 — measured 2026-10-07`: 1,483 estTokens across the 13 tool-declaring packages against the 1,412 baseline, every surface classified, 27 activation claims checked (8 Falsified), and a step-2 budget F1–F8. Two facts to carry: the `pi-subagents` pin is **not hermetic** (it renders `~/.pi/agent/agents` into its own tool schema — ≈243 bytes of it the 15 agent descriptions, which 3a moved but did not change) and ≈234 estTokens/request of per-turn surface is pinned by nothing. **Nothing there is authorised — ask.**
