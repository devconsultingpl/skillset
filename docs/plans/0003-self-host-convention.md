# 0003 — self-host convention

## Goal

Dogfood the `convention` skill on the skillset repo itself. Today `docs/` only has `conventions.md` and `plans/`. Plan 0001 promised that skillset uses its own convention scaffold — make that real by running `skillset init convention` here and filling in the project-specific docs by hand.

## Decisions

**Scaffold via `init`, not by hand.** Real dogfood: run `skillset init convention` in the repo root. If `init` mis-behaves (e.g. overwrites, skips silently, writes wrong content), that's a signal — fix `init` itself before completing the plan.

**Idempotency over the existing `docs/conventions.md`.** `init` is documented as "never overwrites existing files". Verify behavior: the existing `conventions.md` should survive untouched. If it does, keep current content. If `init`'s template is meaningfully better than what's there, do a manual merge — do not let `init` clobber.

**Don't install the convention skill in always-mode on this repo.** That was an option but rejected — keeps the experiment focused on scaffolding + hand-authored content. The skill is well-tested via the test suite; we don't need session-time loading to evaluate the docs themselves.

**Hand-author goals.md, architecture.md, glossary.md.** Templates land as commented stubs. Replace each with terse, skillset-specific content:
- `goals.md` — restate what skillset is and what "done" looks like (drawn from README + 0001).
- `architecture.md` — core/targets/commands/state layering. Mirror the layout described in 0001's Approach.
- `glossary.md` — terms: skill, target, mode, scope, marker, anchor file, install record.
- `decisions/` — leave empty for now; future ADRs land here.
- `plans/` — already populated; `init` should not touch it.

**Move 0001's "skip-if-customized" reference into a real ADR?** No. Decisions captured in plans are sufficient for now. ADRs (`decisions/NNNN-*.md`) reserved for decisions that span plans or persist past one feature.

## Approach

1. Run `skillset init convention` from a fresh checkout (or just `cwd = repo root`).
2. Inspect what landed: which files are new, whether any pre-existing file (notably `docs/conventions.md`) was touched.
3. If `init` mis-behaved, fix the bug in `src/commands/init.ts` first, add a test, then re-run.
4. Replace templated stubs with real content.
5. Confirm a fresh-clone reader can grok the project from `docs/` alone.

## Steps

1. **Dry-run audit.** Read `src/commands/init.ts` + `src/skills/convention/templates/docs/*`. Confirm what `init` actually copies and how it decides "exists already". Cheap pre-check; avoids surprise.
2. **Run init.** `npm run dev -- init convention`. Observe stdout, diff working tree.
3. **Verify existing `docs/conventions.md` survived.** If overwritten → bug. Fix.
4. **Fill `docs/goals.md`** — terse paragraph per heading. Source material: README §1 ("Install agent skills across…") + 0001 Goal.
5. **Fill `docs/architecture.md`** — bullets per layer (Core / Targets / Commands / State / Skills). Reuse the layered description from 0001 Approach.
6. **Fill `docs/glossary.md`** — definitions: skill, canonical format, target, mode, scope, marker, anchor file, install record, state.json, bundled skill.
7. **Leave `docs/decisions/` empty.** Add a one-line README inside (or rely on the template's commented stub) explaining when an ADR lands here.
8. **Smoke test the dogfood.** Read the four docs end-to-end. Can a stranger build the same mental model the maintainer has? If not, tighten.
9. **No code changes to the skill itself unless step 3 surfaced a bug.**

## Open questions

- Does `init`'s "don't overwrite" check work at file level or directory level? Determined in step 1.
- Template content quality — until we read the templates we don't know how much hand-editing each doc needs. Step 1 answers this too.

## Confidence

≥98%.
