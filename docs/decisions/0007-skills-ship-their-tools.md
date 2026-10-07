# 0007 — skills ship their tools; propagation is by installation, not projection

**Status: implemented for slice 2a** (declared sibling files: copy, record, classify, remove). The review family's move here, and per-harness field support, remain open.

## Context

ADR 0006 decided that this repository owns shared instruction content. It also described *how* a change would reach consumers: "generated projections inside the flow package, plus an ownership manifest". That mechanism did not survive contact with the consumer.

An executed check in `pi-extensions` (`packages/flow/extensions/flow-core/skill-contracts-source.ts:178-198`) showed FLOW's contract harvester reads pi's **user-installed** skill locations as well as its own bundle, registering them under the `user-skills` owner. So a skill installed here reaches FLOW's contract gate without a copy ever existing inside FLOW's package. A projection would have created a second source to drift, for nothing.

What remained genuinely missing was smaller and more general: a skill could not ship a **helper**. Every target wrote exactly one rendered file (`src/targets/pi.ts:59,64,79`), the only sibling file ever copied was one hardcoded `skillset-status` asset, and FLOW's review carried `_helpers/review-range.mjs` (439 lines) beside its `SKILL.md` — a payload this repository had no way to express. pi's own documentation calls bundled `scripts/` and `references/` the normal skill shape.

## Decision

**A skill ships its tools by declaration, not by directory scan.** `skillset.config.json` gains a `siblings` block, keyed by skill, listing each payload file as a path relative to the skill directory:

```json
"siblings": { "code-review": ["_helpers/review-range.mjs"] }
```

Declared rather than inferred, because shipping a 400-line helper is a decision that should be reviewable in the diff. A path that is absolute, escapes the skill directory, is `SKILL.md`, or is not a file in the bundle is a reported declaration error (exit 2).

**Copied verbatim, never rendered.** A sibling goes byte-for-byte from `src/skills/<skill>/` to the install directory beside `SKILL.md`; the render path is for the body only. This also means a `config:` placeholder in a sibling is not substituted — a mistake to report, not a feature to support.

**Recorded per file, classified like any artifact.** The install record lists each sibling's relative path, so slice 1's vocabulary applies unchanged: a recorded file whose bytes moved is `drifted` (repaired, prior content reported), an unrecorded file at a sibling path that differs is `foreign` (refused, exit non-zero), an unrecorded one that already matches is `adoptable`, an absent one is `missing`. An install reports the most urgent status among its files and lists the sibling rows individually. Comparison is by bytes against the bundle source, not by a stored hash: the same choice slice 1 made for `SKILL.md`, and one that answers "does this still match what we would write" rather than "did it change since we wrote it".

**Siblings travel only where a skill directory exists.** `auto` mode on pi, claude-code and opencode, plus claude-code's `always` (which writes a skill file beside its settings hook). A `slash` prompt or a marker block installs one file into a shared directory, so a declared sibling cannot go with it — and `install` and `sync` both say so rather than dropping it silently.

**No projection, and the names do not change.** The review family moves here by installation, under its own name. ADR 0006's mechanism sentence is superseded by this one; the ownership decision it makes stands. FLOW keeps its workflow declaration — the stage that dispatches the name and gates on its contract.

## Consequences

One mechanism replaces one command, one manifest and a second writer, and it generalises: the next skill with a helper inherits it. Removing an install removes its tools, because `uninstall` replays the recorded file list.

Costs and residual risk: the four targets now each copy siblings — the first per-target duplication this repository accepts, with the copy itself living once in `core/fs.ts` and the destination rule once in `core/locations.ts`. The destination rule exists in two shapes (each target's install branch, and `skillDirectoryFor` for classification) and is pinned by a test per target. `assets/` keeps its distinct meaning — a foreign-runtime artifact read at install time by `assetPath` and landing outside the skill directory — so the two payload concepts stay separate.

Related: [ADR 0006](0006-instruction-ownership.md) (the ownership decision this refines), [ADR 0005](0005-multi-mode-install-records.md), [ADR 0003](0003-skillset-installs-executable-artifacts.md). Plan: [0023](../plans/0023-skillset-owns-instructions.md).
