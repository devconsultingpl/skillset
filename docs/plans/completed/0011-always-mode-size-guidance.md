# 0011 — always-mode size guidance

## Goal

Surface skill-body size at install time when `--mode always`, so users don't silently bloat per-session context. `always` artifacts load every session across every agent surface (SessionStart hook for claude-code, `APPEND_SYSTEM.md` for pi, `AGENTS.md` for opencode, `copilot-instructions.md` for copilot). Token cost is paid forever; bloat should be visible.

`slash` and `auto` modes load only on invocation, so they're out of scope here.

## Decisions

- **Warn, don't block.** Guidance, not policy. Users override convention sometimes (e.g. a security-review skill that *must* be long).
- **Measure the rendered body** (post-template-substitution, post-frontmatter-strip) — that's what actually lands in session context.
- **One threshold, one number.** Avoid tiered warnings; keep output quiet.
- Document the convention in `README.md` alongside the mode table.

## Approach

1. Add a `bodySize(skill, config)` helper in `src/core/` that returns rendered-body byte count (or line count — see open questions).
2. In `src/commands/install.ts`, when resolved mode is `always`, compute size and emit a single `stderr` warning line if over threshold:
   ```
   warning: <skill> body is <N> lines; always-mode artifacts load every session. Consider slash/auto, or trim the body.
   ```
3. README: add a short paragraph under the modes table — "`always` artifacts cost tokens every session. Keep bodies tight; the installer warns above ~<threshold>."
4. Test in `test/cli.test.ts`: install a synthetic oversized skill in `always` mode, assert warning lands on stderr.

## Steps

1. Pick a threshold (see open questions).
2. Implement `bodySize` helper + unit test in `src/core/`.
3. Wire warning into `install.ts`; thread through `set-mode` as well (mode switch to `always` deserves the same warning).
4. Update `README.md`.
5. Add CLI test.

## Open questions

- **Threshold value.** Candidates: 50 lines, 80 lines, 2KB, 4KB. Lean toward **80 lines** — matches what current bundled skills land at after the confidence trim (~35 lines), gives 2× headroom.
- **Lines or bytes?** Lines are more intuitive in the warning; bytes track tokens slightly better. Lean toward lines.
- **Should `update` re-warn?** Probably yes if it switches mode, no on plain re-sync — the user already saw the warning at install.
- **Description length too?** Descriptions are short by design (one-liner), but `always` mode pastes the body, not the description. Probably skip.

## Confidence

~85%. Mechanics are clear; the only real uncertainty is threshold tuning, and that's cheap to revisit once the warning is wired up.
