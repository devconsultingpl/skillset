# 0002 — step 8: agent integration tests + cross-mode reinstall guard

## Goal

Close step 8 of plan 0001. Round out test coverage for `pi`, `opencode`, and `copilot` targets; lock down marker safety on shared anchor files; implement the cross-mode reinstall guard with a `--force` flag that 0001 promised but never delivered.

## Decisions

**`--force` semantics — cross-mode reinstall guard.**
- `install <skill> --agent X --mode M --scope S`: if `state.installs` already records `(skill, agent, scope)` with a *different* mode → fail with `"<skill> already installed for <agent> as <oldmode>; use --force or run 'set-mode'"`.
- Same `(skill, agent, scope, mode)`: idempotent reinstall (existing behavior, unchanged).
- `--force`: uninstall the prior record first, then install fresh.
- Rationale: today, installing `slash` then `always` for the same `(skill, agent, scope)` silently leaves the slash file behind alongside the new `always` block. The guard surfaces the conflict; `--force` is the explicit override.

**Test layout.** Split `cli.test.ts` into one general file + per-agent files under `test/agents/`. Keep the existing sandbox pattern (re-route `HOME`/`USERPROFILE` to a temp dir) so global-scope tests don't touch the developer's real `~`.

**Settings.json marker test scope.** claude-code only. No other agent writes JSON.

**Out of scope (deferred).**
- "Skip-if-customized" prompt for `update` — separate feature; not promised by 0001.
- Windows path quirks.
- Real agent-runtime smoke (we test file shape, not whether the runtime loads it).

## Approach

Two streams in one branch:

1. **Feature work** (`--force` guard) — minimal: state lookup in `install`, helpful error, `--force` short-circuit, CLI flag.
2. **Test work** — per-agent coverage matrix + marker safety + cross-cutting.

Each phase ends with `npm test` green before the next starts.

## Steps

1. **Phase 1 — restructure tests (no behavior change).**
   - Extract `test/helpers.ts`: `run()`, `sandbox()`, `exists()`, `sandboxPath()`.
   - Move existing cases out of `test/cli.test.ts` into `test/agents/claude-code.test.ts` (agent-specific) and keep cross-cutting (init, emit, error paths) in `test/cli.test.ts`.
   - `npm test` green.

2. **Phase 2 — cross-mode reinstall guard.**
   - `src/commands/install.ts`: load state, look up prior record by `(skill, agent, scope)`. If mode differs and `force` is false → throw. If `force` is true → `target.uninstall(prior)` first.
   - `src/cli.ts`: add `--force` flag to `install` command.
   - Tests in `test/cli.test.ts`: conflict errors with the expected message, `--force` succeeds and leaves exactly one state record, same-mode reinstall stays idempotent.

3. **Phase 3 — per-agent tests.** Matrix per agent: `slash --local`, `slash --global`, `auto --local` (skip copilot), `always --local`, `always --global`. For each: file path is correct, file shape contains expected frontmatter, uninstall removes the artifact.
   - `test/agents/pi.test.ts`
   - `test/agents/opencode.test.ts` (note: `always` anchor is `<root>/AGENTS.md`, not under `.opencode/`)
   - `test/agents/copilot.test.ts` (no auto; prompt file has `mode: agent` + `description`)

4. **Phase 4 — marker safety (`test/agents/markers.test.ts`).** For each anchor file (`settings.json` claude-code-only; `APPEND_SYSTEM.md`; `AGENTS.md`; `copilot-instructions.md`):
   - Pre-write user content.
   - Install skill A in `always`.
   - Install skill B in `always`.
   - Uninstall A → user content + B's block remain, A's block gone.
   - Uninstall B → user content restored intact.
   - claude-code extra: pre-existing user-defined hook in `settings.json` survives our hook add and remove (tag-based identification via `# skillset:<skill>`).

5. **Phase 5 — cross-cutting additions to `test/cli.test.ts`.**
   - `list` correctly shows multi-agent multi-skill state.
   - `update` re-syncs after a manual edit (and overwrites it — current behavior, since skip-if-customized is unimplemented).
   - `set-mode` round-trip on each agent (slash → always → slash).
   - `state.json` reflects ops correctly (exact record count after force-reinstall = 1, not 2).

## Open questions

- None blocking. (Skip-if-customized for `update` is captured as deferred above; not required for closing step 8.)

## Confidence

≥98%. Awaiting "go" before implementation.

## Outcome (2026-05-19)

Done. 83 tests passing (was 57 baseline; +26).

- Phase 1: `test/helpers.ts` extracted; existing cases moved to `test/agents/claude-code.test.ts` + cross-cutting in `test/cli.test.ts`.
- Phase 2: cross-mode reinstall guard implemented in `src/commands/install.ts`; `--force` flag wired in `src/cli.ts`. Three guard tests added.
- Phase 3: `test/agents/{pi,opencode,copilot}.test.ts` cover slash local/global, auto local (where applicable), always local/global. No bugs surfaced in target code.
- Phase 4: `test/agents/markers.test.ts` proves user content survives install + uninstall lifecycle for every anchor file (markdown anchors via parameterized cases; `settings.json` via tag-based hook identification).
- Phase 5: `cli.test.ts` gained `list` multi-agent assertion, `update` re-sync after manual edit, `set-mode` round-trip per non-claude-code agent.
- Lint, typecheck, test suite all green.
