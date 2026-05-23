# 0005 — skip-if-customized for `skillset update`

## Goal

`skillset update` today overwrites every installed file unconditionally. Plan 0001 promised "skip-if-customized prompt when local file diverges from bundle". 0002 punted this as out of scope. Implement it: when an installed file's content has drifted from the bundle-rendered output, prompt interactively (skip / overwrite / diff). Non-TTY runs fall back to skip. `--force` overrides everything.

## Decisions

**Detection: compare rendered bundle body vs installed file body, byte-equal after stripping frontmatter the target writes.**
- For per-file targets (slash command files, skills dir files), compare the whole file.
- For marker-block targets (`AGENTS.md`, `APPEND_SYSTEM.md`, `copilot-instructions.md`, `settings.json` hook entries), compare only the marker block's interior. User content outside the markers is irrelevant; the markers themselves are the unit of update.
- Granularity is per-install record. Each record decides skip/overwrite independently.

**Prompt UX.** Per diverged install, one prompt:
```
[skillset] confidence → claude-code (slash, local) at .claude/commands/confidence.md has local edits.
  [s]kip  [o]verwrite  [d]iff  [a]bort      (default: s)
```
- `s` (default) — leave file alone, state record unchanged.
- `o` — overwrite, state record refreshed.
- `d` — print unified diff, re-prompt.
- `a` — stop the whole update run, leaving already-processed installs as they are.

Non-TTY (CI, hooks): always pick `s`. Print one warning line per skip. Exit 0.

**Flags.**
- `--force` — overwrite all, no prompt. Equivalent to "o for every diverged install."
- `--dry-run` — list diverged installs and what *would* happen, perform nothing. Useful in CI / pre-update audit.
- `--skip-customized` — non-interactive skip default for diverged files; still overwrites untouched ones. Useful when you don't want to type `s` 12 times.

**Idempotent installs are still unconditional.** If the on-disk file already matches what the bundle would produce, just rewrite it (cheap, avoids hash + diff complexity for the happy path) and don't prompt. The prompt only fires when the rendered-bundle bytes differ from on-disk bytes.

**No file hashes in state.json.** Compute fresh each update. State stays the install registry, not a content cache. Future optimization possible if perf matters.

**`set-mode` and `install --force` keep current behavior.** Customization protection only applies to bulk `update`.

## Approach

Layer the divergence check inside the existing `update.ts` loop. For each install record:

1. Render the bundle for that skill (same path as install/update today).
2. Ask the target module for the "current installed bytes" relevant to this install — new method on the Target interface, e.g. `readInstalled(record): Promise<string | null>`.
3. Compute the bytes that *would* be written — new method `renderInstalled(args): Promise<string>` *or* refactor `install` to return both bytes and side-effect, then dispatch via a small wrapper.
4. Compare. If equal → no prompt, proceed to rewrite (idempotent). If differ → run prompt logic, branch to skip or overwrite.

For marker blocks, both methods extract just the marker interior; whole-file targets read/write the whole file.

## Steps

1. **Spike: target API shape.** Read each `src/targets/*.ts` to see how `install()` produces and writes its bytes. Decide: add `readInstalled` + `renderInstalled` on the Target interface, or expose a "what would I write" preview from a single method.
2. **Implement target additions.** Per-agent module changes — claude-code, pi, opencode, copilot. Cover both per-file installs (slash, auto) and marker-block installs (always).
3. **Update loop changes.** `src/commands/update.ts`:
   - For each record, compute current + would-be bytes.
   - If equal → write (today's behavior).
   - If differ → consult flags + TTY + prompt → skip / overwrite.
4. **Prompt utility.** Tiny module under `src/core/prompt.ts` (or inline in update.ts if small enough). TTY check via `process.stdin.isTTY && process.stdout.isTTY`. Single-keystroke fallback to readline question.
5. **Diff renderer.** Use a built-in: render with `node:util` line-diff or pull in a tiny dep (jsondiffpatch overkill; consider `diff` package — ~10KB). Decide during impl; if no dep is wanted, hand-roll a simple LCS-ish "removed/added" line lister.
6. **CLI flags.** `--force`, `--dry-run`, `--skip-customized` on `update` subcommand in `src/cli.ts`.
7. **Tests.**
   - Idempotent overwrite (no divergence) — passes silently, current behavior preserved.
   - Diverged + TTY + answers each path (s / o / d-then-s / a).
   - Diverged + non-TTY → skip + warning.
   - `--force` overwrites diverged.
   - `--dry-run` performs no writes; prints planned action per record.
   - `--skip-customized` non-interactive skip for diverged.
   - Marker block: user content outside markers is invisible to the check (edits outside markers don't trigger a prompt).
   - Mix: two installs, one diverged one not → diverged prompts, clean one rewrites silently, both end coherent.

## Open questions

- Diff dependency or hand-roll? Decide at step 5. Lean toward hand-roll if 30 lines suffices.
- For marker-block targets, what counts as "the marker bytes"? Includes the begin/end lines or just interior? Probably interior only — consistent with how uninstall identifies the block to remove. Confirm in step 1.
- Should `update --dry-run` also report installs that *would* be silent rewrites, or only diverged ones? Lean toward only diverged (less noise). Revisit if user feedback wants the full plan.

## Confidence

≥98%.
