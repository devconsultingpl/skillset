# 0006 — uninstall ergonomics: tests + docs

## Goal

Bare `skillset uninstall <skill>` (no `--agent`, no `--global`/`--local`) today removes every recorded install of that skill across every agent and every scope. That's the intended behavior — but it's not tested explicitly and not documented in README. Lock the behavior in with tests and surface it in the docs so a user knows what they're invoking.

## Decisions

**Behavior is correct as-is — no code change.** `src/commands/uninstall.ts` already fans out across all matching state records when filters are omitted. No semantic change in this plan; only assertions + documentation.

**Three behaviors to lock in via tests.**
1. Bare `uninstall <skill>` removes installs across multiple agents.
2. Bare `uninstall <skill>` removes installs across multiple scopes (local + global).
3. Filtered `uninstall <skill> --agent X` leaves other-agent installs untouched. `--global` leaves local untouched. `--local` leaves global untouched.

**README addition: short "Uninstall" subsection.** One paragraph explaining default fan-out + filter examples. Place near the existing `Scopes` and `Commands` sections.

**Out of scope.**
- No confirmation prompt before fan-out. Behavior was confirmed correct; adding a prompt would be a different plan.
- No `--dry-run` for uninstall. Could be a follow-up, but `skillset list` already shows what's installed before you act.
- No changes to error messaging on zero-match (today: yellow warning, exit 0 — keep).

## Approach

1. Read `test/cli.test.ts` and `test/agents/*.test.ts` to find the right home for these cases (probably `test/cli.test.ts` since they're cross-cutting).
2. Sandbox-setup helper already exists — reuse.
3. Three tests + README diff.

## Steps

1. **Audit current test coverage.** Grep `test/` for `uninstall` to confirm no test asserts the multi-agent / multi-scope fan-out today.
2. **Test 1 — multi-agent fan-out.** Install `confidence` on `claude-code` + `pi` (slash, local). Run bare `uninstall confidence`. Assert: both files gone, state.installs empty for that skill.
3. **Test 2 — multi-scope fan-out.** Install `confidence` for `claude-code` slash `--local`, then again `--global` (different scope). Run bare `uninstall confidence`. Assert: both gone.
4. **Test 3 — filtered uninstall preserves others.** Install `confidence` on `claude-code` + `pi` slash local. Run `uninstall confidence --agent claude-code`. Assert: claude-code install gone; pi install still present in state.json + on disk.
5. **README update.** Add `## Uninstall` subsection (or append to Commands) covering:
   - Default: removes every install of the skill across agents + scopes.
   - Filter with `--agent <a,b>` to scope to specific agents.
   - Filter with `--local` / `--global` to scope to one install scope.
   - Example commands for each.
6. **`npm test` green.** Run lint.

## Open questions

- Should the README warn that bare uninstall *also* removes from other projects' local installs that share `~/.skillset/state.json`? Today's behavior: bare uninstall removes ALL local installs across all project roots recorded in state, since `opts.scope === "local"` filter only fires when scope is supplied. Verify in step 1, decide whether to flag in README.

## Confidence

≥97%. Single uncertainty above is small and resolves during step 1.
