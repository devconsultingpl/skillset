# 0004 — document `--force` for install

## Goal

README's Commands section lists `skillset install` but never mentions `--force`. The flag exists (added in 0002) and changes install semantics meaningfully — without it, a cross-mode reinstall fails with a guarded error. Make `--force` discoverable in README and confirm CLI `--help` is consistent.

## Decisions

**Two places to update.**
1. README `Commands` section — signature + dedicated subsection explaining the cross-mode reinstall guard.
2. `src/cli.ts` install command help string — verify it surfaces `--force` with a description that matches README.

**No new behavior.** Documentation only. If audit of step 2 reveals the help text is missing or misleading, fix it as a tiny code change inside this plan.

**Dedicated subsection wording.** Cover three things in ~5 lines:
- What the guard does (different-mode install for same `(skill, agent, scope)` fails by default).
- Why (silent leftover artifacts from the old mode are footguns — 0002 rationale).
- The two ways past it: `--force` (uninstall-then-install) vs `set-mode <skill> <mode>` (semantic switch, recommended for plain mode changes).

**Lead with `set-mode` as preferred path.** Reserve `--force` for "I want a fresh install for some other reason." This matches what the error message itself suggests.

## Approach

1. Read current README Commands section + `src/cli.ts` install help.
2. Compose the signature line and the subsection prose.
3. Apply edits.
4. Sanity check: `npm run dev -- install --help` shows `--force` with consistent wording.

## Steps

1. **Read current state.** README lines 68–80 (Commands), `src/cli.ts` install subcommand definition.
2. **Update README signature.** Change `skillset install <skills...> --agent <agents> --mode <mode> [--global|--local]` to include `[--force]`.
3. **Add subsection** under Commands titled `Reinstall guard` (or similar — pick whichever blends with surrounding headings). Body:
   > Installing a skill that's already installed with a *different* mode for the same `(skill, agent, scope)` triple fails by default — old-mode artifacts would silently linger. Switch modes with `skillset set-mode <skill> <mode>`. Use `install ... --force` only when you want to wipe and re-install fresh.
4. **Audit CLI help.** If `src/cli.ts` doesn't already describe `--force` (or describes it wrong), update the description string to match.
5. **Cross-check** with the actual error message thrown in `src/commands/install.ts` (currently: `"use --force or run 'skillset set-mode …'"`). README phrasing should not contradict the error.

## Open questions

- None.

## Confidence

≥98%.

## Outcome (2026-05-19)

Done.

- README `Commands` signature gained `[--force]`.
- New `## Reinstall guard` section between Commands and How it stays safe: explains the cross-mode guard, prefers `set-mode` for plain mode switches, reserves `--force` for clean re-installs.
- `src/cli.ts` already exposed `--force` with a description matching the README wording — no code change needed.
- Cross-checked against the live error message in `src/commands/install.ts`: both routes the error suggests (`--force` and `set-mode`) appear in the README guidance.
