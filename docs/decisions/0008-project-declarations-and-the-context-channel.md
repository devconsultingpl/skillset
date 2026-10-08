# 0008 — a project's own declarations, and the context channel

**Status: implemented for slice 3c** — the `context` mode for pi, the project declarations file, `skillset init project`, and the global `AGENTS.md` rendered from a skill body.

## Context

Two surfaces were still outside the ownership rule this repository exists to enforce.

**The context file was hand-written.** `~/.pi/agent/AGENTS.md` held the pointer to `docs/conventions.md` and the two facts no doc carried, and nothing rendered it. ADR 0006's rule — a change is made in this repository and propagated — did not reach the one file every session loads.

**Local scope had no declarative home.** `install --local` worked and records carried `projectPath`, but nothing could *declare* a project's installs: on this machine eight records sat in `state.json` reported `undeclared` forever, and the only way to deviate from the global set was a hand-run command nobody could review.

Three measured facts shaped the design, and two of them were surprises:

- pi loads the project's **root** `AGENTS.md`, not `<root>/.pi/AGENTS.md` — a fresh `pi --print` process in a temp directory reproduced a token from the former and answered `NONE` for the latter (`docs/configuration.md:30-45`: context files come from the agent directory, the working directory and its parents).
- pi's project `.pi/APPEND_SYSTEM.md` **replaces** the agent-directory one — *"the trusted project file takes precedence… Files with the same name are not combined"* (`docs/configuration.md:36`). Writing it would silently drop every global `always` block inside that project.
- claude-code 2.1.286's `instructionFiles` default is `claude-md-or-agents-md`: `AGENTS.md` is loaded where `CLAUDE.md` would be, so **one rendered project file serves both harnesses**. This is strings-level evidence from the installed build — its loader logs no memory files at all — and it is why claude-code gets no `context` renderer of its own.

## Decision

**`context` is a fourth mode, and the second anchor mode.** `always` writes into the system prompt, `context` into the context file a harness loads besides it. Which modes are anchors is one predicate (`isAnchorMode` in `src/core/types.ts`), because "is this mode a marker block in a shared file?" was previously spelled as the literal `"always"` in twelve places — a second anchor mode would have meant twelve edits and one silent miss. pi is the only bridge that declares `context`: local `<root>/AGENTS.md`, global `~/.pi/agent/AGENTS.md`. The other three report it as unsupported rather than guessing at a file their loaders were never observed reading.

**A project declares its own installs, and may not declare anything else.** `<root>/.skillset/config.json` (written once by `skillset init project`, never overwritten) takes the repository file's `installs` shape with three restrictions:

- **Local installs only.** `scope` may be omitted or `"local"`; a `"global"` entry is a declaration problem naming the file (exit 2). A committed project file must not be able to write into somebody's home.
- **`projectPath` is derived** from the working directory, so the file is portable across checkouts rather than pinned to one machine's paths.
- **`siblings`, `requires` and `agents` are refused by name.** They are facts about the bundle, which the project does not own; saying so beats ignoring them.

**Merging is additive, and an override stays visible.** `loadDeclarations` reads the repository file and, when the run happens inside a project that has one, the project file — both are reconciled in the same pass, so a project install that shadows a global one reports *both* rather than silently winning. The harness is what picks between them; skillset's job is to make the pair visible.

**The global context file becomes rendered content.** `~/.pi/agent/AGENTS.md` now carries a marker block rendered from `src/skills/context-pointer/`. It stays a pointer — that file costs tokens every session — and its hand-written text is deleted by the developer after the first `sync`, since the file is theirs.

## Consequences

A project can now deviate from the global set by declaring its own installs, in a file that is reviewed like any other change and reconciled like any other declaration. Every rule this repository renders has exactly one source, including the one in the context file, and `sync --dry-run` inside a project answers "what would this project have that the global set does not".

Costs, stated rather than discovered later:

- **A second configuration surface to keep honest.** It is deliberately narrow (installs, local only) so the honesty is cheap, but a reader now has two files to check before concluding a skill is not installed here.
- **claude-code's half is strings-level.** If a future build stops reading the project `AGENTS.md`, the block is invisible to claude sessions and nothing here fails — so `docs/conventions.md` records it as a dependency of the installed build, not a guarantee.
- **A project with its own `CLAUDE.md` does not see our block.** That is the documented exception of the same `instructionFiles` option; it is not overridden, because writing a project `CLAUDE.md` would be a second copy of a shared file.
- **A project must not scaffold `<root>/.pi/APPEND_SYSTEM.md`.** pi does not combine it with the agent-directory file, so it silences the global `always` blocks inside that project. Documented in `docs/conventions.md`; no scaffold writes it.

## Related

- ADR 0006 — instruction ownership and dependency direction (this applies its rule to a second channel and a second declaration root; nothing about ownership or dependency direction changes).
- ADR 0007 — skills ship their tools by installation, not projection.
