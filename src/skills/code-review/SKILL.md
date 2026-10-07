---
name: code-review
version: "1.0.0"
description: Read-only review of *the changes* — a branch against its default, a commit, staged or working-tree edits, a folder or named files. Dispatches specialist passes (integration, precedents, dependencies, peer mirror, quality surfaces, security sinks, interaction sweep), verifies every finding against the real file, and returns only the findings and the verdict. Use when the user asks to review a diff, a branch, a PR, or pending changes. Writes one review document when a workflow drives it, and nothing else.
slug: sk-code-review
targets:
  pi:
    argument-hint: "[scope]"
    disable-model-invocation: true
    contract:
      produces:
        kind: produces
        meta:
          artifactKind: review
        data:
          type: object
          required: [blockers_count]
          properties:
            status:
              enum: [in-progress, in-review, ready]
            blockers_count:
              type: integer
              minimum: 0
      consumes:
        meta:
          world: working-tree
---
# code-review

Read-only review of *the changes*: does this delta meet its spec, and is it correct and consistent with the codebase? Reviews the change — not the whole codebase. Pre-existing bloat is `declutter`'s, security depth on untouched code is `appsec-review`'s, applying fixes is `remediate`'s.

Two invariants hold through every step:

- **Never edit.** Not the reviewed files, not the plan, not the log. Verification is observation.
- **Every finding carries evidence** — `file:line` plus the literal line. A finding without a quotable line is not a finding (the **citation contract**, defined once in *Evidence contract* and binding on every pass).

**The run, in order:** scope → orientation passes → lens passes → coverage passes → reconcile → verify → write the document → follow-ups.

## Project conventions
If the project carries them — `docs/goals.md`, `docs/conventions.md`, or `.flow/guidance/**/architecture.md` — read them first; they override these defaults.

## Dispatch contract — who does the work

The analysis runs in specialist passes, not in this session:

- **Subagents are the default.** Dispatch each pass through the harness's subagent mechanism (`subagent`, `Task`, an Agent tool — whatever this harness exposes) so that tool calls, intermediate findings and the search trail never enter the session. What comes back is findings and the verdict; nothing else.
- **Check availability first.** No subagent mechanism → run the passes yourself, in the order below, as **one bounded single pass**: apply the surfaces and sink classes to the highest-risk files and say plainly which files you did not reach. Do not silently pretend the passes ran.
- **A direct invocation wins.** The user typing the command, or saying "run it here" / "no subagent", means do it inline.

Role names below (`integration-scanner`, `precedent-locator`, `codebase-analyzer`, `diff-auditor`, `peer-comparator`, `claim-verifier`) describe the *job*, not an agent type: map each to whatever this harness offers, and where a named specialist is missing, do that job yourself or state that it did not run.

**Context isolation is load-bearing.** A pass receives the changed-file list, the Discovery Map and the patch path — never another pass's findings, with one deliberate exception: the predicates table from the quality lens is handed to the interaction sweep verbatim. Sharing more produces overlapping findings, inflated severity and burned tokens.

**Never paste these into a pass's prompt**, even when the orchestrator already holds them: a raw orientation pass's output (the Discovery Map summarises it), the precedents output, the dependencies or advisories output, and any finding or output from an earlier run in this session.

**Self-check before dispatching.** Read the outgoing prompt. Anything from an earlier pass beyond the Discovery Map and the patch path gets deleted — context that summarises the findings induces narrativisation, and the observed failure is a much faster run producing hallucinated findings with mis-cited line numbers.

## Step 1 — Resolve scope and assemble the diff

Determine the scope spec from the argument the user supplied. Empty → `auto`. Ambiguous (prose, mixed list, an unresolvable ref) → ask **one** clarifying question, offering exactly these four options, then continue with whichever the user picks:

- **(A)** the current branch against its default branch — `auto`
- **(B)** every tracked change against `HEAD`, staged and unstaged together — `modified`
- **(C)** unstaged changes only — `working`
- **(D)** restate the scope — free text, then re-invoke with what the user supplies

Never guess between them. A wrong scope is a thorough review of the wrong thing.

1. **Resolve scope with the bundled helper**, from this skill's own directory — the path is resolved against the directory holding this `SKILL.md`, and no harness expands `${SKILL_DIR}`:

   ```bash
   node "<skill dir>/_helpers/review-range.mjs" "<scope-spec>"
   ```

   It prints labelled key/value lines (`default_branch:`, `strategy:`, `oldest:`, `newest:`, `base:`, `tip:`, `range:`, `fp_flag:`, `patch_path:`; plus `null_tree:` for a tree) followed by a `---changed-files---` block. Those values are authoritative for the rest of this step. `strategy: unrecognised` carries a `note:` explaining why — clarify and re-invoke.

   | Argument shape | Pass to the helper |
   |---|---|
   | empty | `auto` |
   | literal `commit` / `staged` / `working` / `modified` | the word verbatim |
   | hex hash (4–40 chars) | the hash |
   | `A..B` | the range |
   | comma- or space-separated hashes | the list |
   | branch name (checked out at HEAD) | the branch name |
   | `--folder <path>` / `--file <paths>` (comma-separate multiple) | verbatim, legacy `folder:` / `file:` aliases included |
   | anything else | clarify, then re-invoke |

2. **Confirm the strategy** — `first-parent` (`auto`, PR branch, commit list) uses `<range>` **and** `<fp_flag>`; `explicit-range` (hash, `A..B`) uses `<range>` without it; `working-tree` (`commit` / `staged` / `working`) uses the working-tree commands, no range; `tree` (`--folder` / `--file`) reviews tracked files as complete entities and **skips precedents** (there is no creation history to compare). `--first-parent` and `--no-merges` are orthogonal — the first prunes second-parent subtrees from reachability, the second drops merge commits from the log itself — and both are set by the commands below. Never substitute one for the other.

3. **Assemble the union of changes**, not the endpoint diff, so reverted intermediate work stays visible. Save the patch once with generous context — `git log "<range>" <fp_flag> --patch --reverse --no-merges -U30 > <patch_path>` — and never re-run `git log --patch` to slice windows later. Working-tree and tree strategies have their equivalents (`git diff [--cached] -U30`, `git show HEAD -U30`, and for a tree a `<null_tree>` diff of the enumeration the helper returned). A patch over ~1 MB drops to `-U10`; **never `-U0`** — the surrounding context is what lets a pass judge a change without a second read. For a tree review in `patch` mode, a `<null_tree>` diff that produces nothing falls back to a synthetic patch per file — a `diff --git a/<f> b/<f>` header with `new file mode 100644` and the file's lines as additions — and if that is empty too, print `No patchable content in scope. Exiting.` and stop.

4. **Derive the review's working sets**:
   - `ChangedFiles` — the helper's `---changed-files---` block. A `(... N more files truncated ...)` footer means the change set exceeded the helper's size cap: tighten the scope, or recover the full surface from disk with the patch command below.
   - `InScopeFiles` — what the author actually wrote. For `first-parent` it is the union of each feature commit's own `--name-only` delta, which drops back-merge sidecars that `ChangedFiles` carries. For every other strategy it equals `ChangedFiles`. Invariant: `InScopeFiles ⊆ ChangedFiles`.
   - `ManifestChanged` — `ChangedFiles` touches a dependency manifest or lockfile, or a peer/optional/dev-dependency field.
   - `LockstepSelfReview` — the repository root carries a version-sync script (`scripts/sync-versions.js` or the repository's equivalent), every workspace manifest shares one `version:`, and the diff touches a manifest, a lockfile or a version field. True → the dependencies pass judges intra-monorepo drift rather than registry drift, and a wildcard peer pin is treated as intentional.
   - `HasGatingPredicate` — the diff adds or modifies a status/enum predicate, or introduces a value into an enum other predicates already gate. Not merely the presence of a guard.
   - `ReviewType` — one of `commit` / `pr` / `staged` / `working` / `tree`, derived from the strategy and the input that produced it.
   - `PeerPairs` — new files paired with an existing peer at HEAD. A pair qualifies when the peer exists at HEAD and a heuristic matches it: stem similarity ≥ 60% of the longer stem (`PhysicalProductSubscription` ↔ `Subscription`); an interface/impl shape (`I<Name>` ↔ `<Name>`, `<Name>` ↔ `<Name>.impl`, `<Name>{Abstract,Base,Protocol}` ↔ `<Name>`); or a shared role suffix (`Handler`, `Service`, `Repository`, `Reducer`, `Strategy`, `Policy`, …). Both files new, or no peer at HEAD → dropped. An empty list skips the peer-mirror pass. For a tree review with three or more files under one parent directory, pair intra-folder files the same way.
   - `TreeInputMode` — for `strategy: tree`: `direct-read` when `ChangedFiles` holds more than ten entries (no patch is generated), otherwise `patch`. The lens passes are told which one they are in.
   - Role tag per file, for ordering the passes: `[boundary]` (security-sensitive) → `[persistence]` → `[hub]` (blast-radius amplifier) → `[code]` → `[config]` → `[test]` last. **This ordering is not the classification rule.** A file's tag is decided once, by the first-match-wins table under *Step 2 — The Discovery Map*; the order here only decides which files are analysed first.

5. **Bail out when there is nothing to review**: empty `ChangedFiles` → print `No changes in scope {scope}. Exiting.` and write nothing.

## Evidence contract

Binding on every pass, every finding, every justification:

```
file:line — `<verbatim line>` — <note>
```

The line is quoted literally from the file. **Omit any finding whose line you cannot quote verbatim.** Passes return evidence only: no severity, no recommendations, no prose outside their own format. Severity is assigned once, in reconciliation.

## Step 2 — Orientation passes (parallel)

Dispatch together; they consume only `ChangedFiles`, the manifest diff and `PeerPairs`, never each other's output.

- **Integration map** (`integration-scanner`) — inbound references, outbound dependencies, and infrastructure wiring for the changed files. Flag auth-boundary crossings (middleware, guards, interceptors, authorize-style decorators) and config/DI/event registration touching those paths. Connections only — no quality analysis. Output: `file:line` per connection, grouped by kind (auth-boundary crossing / inbound refs with consumer counts / outbound deps / wiring and config). No severity, no recommendations.
- **Precedents** (`precedent-locator`) — skipped for a tree review: there is no creation history to compare. Similar past changes, their blast radius and their follow-up fixes. Output one row per precedent — `hash | subject | blast radius | follow-ups within 30 days | takeaway` — plus one composite-lessons line. A prior fix within 30 days of a sibling change is evidence about this one.
- **Dependencies** (only when `ManifestChanged`) — the touched manifests and lockfiles. Identify the ecosystem from what changed, parse both sides, and report: (1) added dependencies `name@version` with `file:line`; (2) bumped dependencies `name: old -> new` with `file:line`; (3) removed dependencies; (4) peer / optional / development-scope changes, whatever the ecosystem calls them; (5) licence changes in a manifest or lockfile; (6) when `LockstepSelfReview` is true, only intra-monorepo drift — a sibling pin diverging from the lockstep version — with wildcard peer pins treated as intentional; (7) when it is false, version conflicts between a declared dependency and the lockfile's resolution. Evidence only, no advisories here.
- **CVE / advisories** (only when `ManifestChanged`) — `name@version` pairs parsed from the manifest diff, checked against advisory databases. Output one row per advisory: `package@version | severity | advisory link`. Links only, no fix versions invented.
- **Peer mirror** (`peer-comparator`) — for each `PeerPairs` tuple, read both files and enumerate the peer's **public surface** as rows: public methods and exported functions; domain events and notifications fired (by concept — `fire*`, `emit*`, `publish*`, `dispatch*`, `raise*`, `notify*`, and their equivalents); state transitions with their precondition guard; constructor- or DI-supplied collaborators; persisted fields, columns and serialised properties; and registrations this file contributes to a switch, map, table, route or handler registry elsewhere. One row per peer invariant:

  `peer_site (file:line — \`<verbatim line>\`) | new_site (file:line — \`<verbatim line>\` or \`<absent>\`) | status | one-sentence delta`

  where status ∈ `Mirrored` / `Missing` / `Diverged` / `Intentionally-absent`. `Intentionally-absent` needs an explicit cite — a comment, a commit-message line, or a type constraint that makes it inapplicable; when in doubt, `Missing`. Output: one markdown table per pair under `### Peer pair: <new_file> ↔ <peer_file>`, no prose outside the tables, no severity, no recommendations.

The orchestrator builds the **Discovery Map** inline from Step 1 while those run. It is the only context the next step receives, so it is complete and literal — no pass may receive a summary of it.

#### The Discovery Map

```
Review type: {ReviewType}
Scope: {scope argument}
Commit/range: {git ref}
Manifest changed: {yes|no}
Lockstep self-review: {yes|no}

Changed files ({N}):
  ## {cluster — longest shared directory prefix}
    path/file.ext (+A -B) {role-tag} — top 1–3 symbols touched
    ...

Auth-boundary crossings: {orientation pass, file:line}
Inbound refs (files with ≥3 consumers): {orientation pass}
Outbound deps: {orientation pass}
Wiring/config: {orientation pass}
Peer mirrors: {Missing/Diverged rows verbatim; Mirrored and Intentionally-absent as counts}
```

**Clustering** — group files by the longest shared directory prefix that yields clusters of two or more; a singleton forms its own cluster labelled with its file name.

**Role tag** — one tag per file, **first match wins**, in this order:

| # | tag | matches |
|---|---|---|
| 1 | `[boundary]` | named in the orientation pass's auth-boundary output |
| 2 | `[persistence]` | path contains `migration`, `schema`, `repository`, `dao` or `model`, or otherwise matches a migration/ORM convention visible in the repository |
| 3 | `[test]` | path contains `/test`, `/spec` or `__tests__`, or the filename ends in a test suffix (`.test.*`, `.spec.*`, `_test.*`, `Test.*`) |
| 4 | `[config]` | named in the pass's wiring/config output, or is a manifest, lockfile or settings file |
| 5 | `[hub]` | in the pass's inbound refs with three or more consumers |
| 6 | `[code]` | everything else — the default |

The order is the rule: an auth-guarded repository is `[boundary]`, and a test file that also looks like config is `[test]`.

**Symbols touched** — the top one to three top-level definitions on the diff's `+` lines, read with a convention appropriate to the file's language (class, function, def, func, interface, type). A hint for orientation, never an inventory.

Wait for the integration map and — when dispatched — the peer mirror before continuing: the next passes read both. Precedents must be in before reconciliation; dependencies and advisories merge there too.

## Step 3 — Lens passes (parallel)

Each lens receives the Discovery Map verbatim, plus the patch path (or, for a tree review with more than ten files, the file list to read directly — a full-tree patch would flood the session).

**File orientation is load-bearing.** A pass reasons about *files as coherent units*; hunks are evidence *within* a file's analysis, never the unit of analysis. Output is organised per file (`### path/file.ext`), never per hunk. A pass reads a file outside `ChangedFiles` only for a cross-file trace — a hub, a peer, a test named in the map — and the patch's 30 lines of context are what make a second read unnecessary.

In `direct-read` mode, replace every instruction to inspect the patch region with a direct read of the file: the passes get the changed-file list, not a diff.

### Quality lens — the surfaces

Per file, form a model of what the file does and what the diff changes, then walk every surface whose **trigger** applies. Write the result per file under `### path/file.ext`, carrying only the surfaces that apply to that file's changes, and take the files in role-tag order — `[boundary]` first, then `[persistence]`, `[hub]`, `[code]`, with `[test]` last. The triggers are mechanical — each names a condition in the diff that decides whether the surface applies — so the walk is checkable rather than a matter of taste, and a surface that fires is reported even when the finding is mild:

1. **Logic & flow** (always) — validation, error paths, off-by-one, null misses, branch ordering, `return`/`await`, unguarded mutation.
2. **Pattern coherence** (≥2 similar constructs in a file, or ≥2 files in a cluster) — cite the nearby line it breaks from.
3. **Blast radius** (the map lists inbound refs, or the file is a hub) — `consumer:line` and what changes for each.
4. **Test coverage gaps** (once, across the changeset) — each risk-bearing function added or changed: is there a corresponding test anywhere in the changeset?
5. **Predicate-set coherence** (`HasGatingPredicate`) — ≥2 conditionals on the same enum across the changeset. Tabulate `predicate file:line | accepted | rejected` under the review-scope heading `### Predicate-set coherence`; the interaction sweep consumes this table verbatim.
6. **Registration coverage** (the changeset adds a discriminator value, enum variant, handler key, route or event type) — every dispatch table, registry or switch that must enumerate it, and every gap.
7. **Query/write symmetry** (a setter, link, shape change or new persisted field) — trace creation *and* renewal paths; cite the writer and the reader.
8. **Cross-layer drift** (one entity, enum or key in ≥2 files across clusters — model ↔ DTO ↔ schema ↔ registry ↔ presentation) — tabulate presence per file, flag asymmetry. For a key fanned out across parallel tables, every table must carry an added key and none may retain a removed one.
9. **Peer-member consistency** (a new method, hook, case or handler in a set of peers) — tabulate the invariants peers share and flag what the new member omits.
10. **Durable-state hygiene** (migration, repository/DAO, file-backed config, cache, serialized artifact, or a new persisted field) — forward write **and** rollback; flag data-losing rollback, a new query field with no lookup affordance, iteration over an unbounded source without a stable cursor, and storage invariants the in-memory validator does not mirror.
11. **Shared-state acquisition** (async handler, listener, singleton init, queue consumer, lock region, global cache mutation) — acquire/release around every mutation; flag unguarded check-then-act across an `await` or IPC boundary, stale reads while another writer is in flight, non-commutative lock order, and replay paths without an idempotency key.
12. **Multi-step commitment** (≥2 writes that must all succeed or all be undone) — the commit boundary; flag missing compensation on partial failure and divergence between two stores with no coordinating primitive.
13. **Error handling & idempotency** (a new failure-response construct: retry loop, catch, error boundary, fallback, circuit breaker, timeout, resumable step) — the propagation path; flag swallowed errors, retry without an idempotency key, fallbacks that silently degrade observable behaviour, and unjustified timeouts.

### Security lens — the sink classes

File-oriented, with an **in-scope rule**: report only sinks inside a changed file's diff region — an added, modified or rewritten-adjacent-context line counts, a pre-existing sink the diff leaves untouched does not — except where the diff changes how data flows *to* an untouched sink, and then cite both ends. Take `[boundary]` files first (direct source→sink exposure), then `[persistence]` (query injection, unsafe deserialization), and group the output per file as the quality lens does. Each hit carries the verbatim line, two lines of surrounding context, and `confidence: N/10` that user-controlled input reaches it; drop below 8. Sink classes, matched by concept rather than by idiom:

- **Command execution** — shell/process spawn taking user input.
- **Dynamic code / unsafe deserialization** — `eval` and dynamic constructors; deserializers that can execute code.
- **Query injection** — user input concatenated or interpolated into a string an external engine interprets (SQL, NoSQL operators, LDAP, XPath, string-built GraphQL). Parameterized queries are safe.
- **Explicit-trust rendering** — user input into a channel that interprets it as code/markup: explicit-trust APIs, raw-HTML markdown, unescaped ANSI to a TTY, template-engine raw blocks.
- **Path traversal** — user-controlled path components without normalization or an allowlist.
- **SSRF** — outbound requests with a user-controlled host or protocol, not merely a path.
- **Secrets in the diff** — literal credentials, keys, PEM blocks, connection strings with embedded passwords.
- **Missing trust-boundary check** — a traced sink reached from a boundary crossing (HTTP handler, RPC endpoint, IPC message, CLI flag reaching a privileged operation, webhook) with no upstream authorization or validation.

Out of scope for this lens: denial of service and rate limiting, hardening with no traced sink, theoretical races with no reproducer, client-side-only authn/authz, findings sourced only from an env var, CLI flag or UUID, and dependency CVEs (the advisory pass covers those). **Prefer false negatives** — a 🔴 needs an explicit source→sink trace, and hardening that is missing without one is not a finding.

## Step 4 — Coverage passes

**Predicate trace** (only when `HasGatingPredicate` and the quality lens returned ≥2 rows on one enum) — per predicate: inputs, what the matching branch promises, the consumer and its filter, and whether the promise holds. Output one row per predicate: `predicate file:line | inputs | promise | consumer file:line | consumer filter | fulfils? | verdict`. Flag a **false promise** (the matching branch depends on a consumer that excludes this entity) and a **stranded state** (state X is reachable but every conditional elsewhere excludes it).

**Interaction sweep** (skip when the changeset is a single file or the quality lens returned fewer than four observations) — group the findings by shared entity, state machine, workflow, data-flow path, API boundary, background process, or producer/consumer contract. Per group, look for: contradictory assumptions across layers; unreachable or non-terminal states; retry mechanisms made inert by another behaviour; duplicate processing from missing originators or idempotency keys; a guard in one layer invalidating a transition in another; one finding masking, amplifying or permanently triggering another; a stranded state; a false-promise predicate; a co-tenant filter gap where a new or terminal value falls through every consumer's filter. Return only findings with ≥2 `file:line` facts from different files. Where ordering, races or concurrency are claimed, name the primitive that *would* prevent it and why that primitive does not apply here — a speculative argument against an existing primitive means drop the finding.

**Gap finder** (skip when the changeset is a single file) — coverage arithmetic, done here rather than by another agent: `{in-scope files} − {files with at least one finding}` = uncovered files. Filter to `[boundary]`, `[persistence]`, `[hub]` and `[code]` files with a delta of ≥5 lines; drop `[test]` and `[config]`. For each, cite one risk-bearing line — the first added non-comment line, or the declaration header of an added function — and name the risk class in three to six words: state mutation, I/O, error path, conditional on mutable state, concurrent access, public API change. Maximum **5** gap findings; for a tree review the same arithmetic runs against exported symbols with no test and no error path. Emit each one as `G<ordinal> — file:line — \`<verbatim line>\` — {role-tag} — <risk class in 3–6 words>`. Gap findings are uncertain by nature: never 🔴.

## Step 5 — Reconcile

Do not start until precedents have returned (a tree review has none — the barrier is satisfied).

**Resolution integrity.** When precedents claim a finding is already resolved, run `git merge-base --is-ancestor <precedent-hash> <tip>` before believing it. An ancestor → mark `resolved-by: <hash>` and demote to 💭. Not an ancestor → context only, and say so in the precedent row. No git available → `resolution: unverified`.

**Severity, per lens** (🔴 fix before merge · 🟡 fix soon · 🔵 nice to have · 💭 discuss):

- **Quality** — 🔴 traced flow contradiction (dropped error path, missing validation on a sink, null dereference); 🟡 blast-radius × complexity-delta; 🔵 divergence from a nearby pattern; 💭 architecture concern with no concrete defect.
- **Security** — 🔴 a concrete user-reachable source→sink trace, with the boundary it crosses stated; 🟡 a concrete crypto defect (weak hash in an integrity role, non-constant-time comparison, hardcoded key material); 🔵 divergence from a secure example in the same file; 💭 architectural question.
- **Dependencies** — 🔴 critical/high advisory in a touched dependency, or a lockstep-contract violation; 🟡 moderate advisory, outdated major with a migration path, license incompatibility; 🔵 minor drift.
- **Interaction sweep** — 🔴/🟡 only. **Promotion rule:** when ≥2 findings share an entity or flow and combine into an emergent failure, the aggregate is 🔴 even if each constituent was 🟡 — the interaction *is* the defect.
- **Gap finder** — 🟡 uncovered risk-bearing region; 🔵 low-impact gap. Never 🔴.
- **Peer mirror** — every `Missing`/`Diverged` row is a finding, 🔵 base. Bump to 🟡 when the invariant is an emitted event, a precondition guard on a state-mutating method, or a persisted-field invariant; to 🔴 when it intersects a dispatch site the diff touches — a missing mirror on a dispatched invariant strands state silently.
- **Precedents** — where ≥2 prior commits touching the same symbol had a follow-up fix within 30 days, bump one tier (cap 🔴) and annotate the finding's title line `[precedent-weighted]`.

**Cascade detection, before emitting severities.** Emit a 🔴 cross-finding bullet when any of these triples fires: *{entity reaches state X} + {no event on that transition} + {consumer filter excludes X}* (silent stranded state); *{check-then-act on a shared resource} + {no ordering primitive} + {retry path}* (duplicate processing); *{spec A accepts Y} + {spec B rejects Y} + {a workflow depending on both}* (contradictory-predicate deadlock). Also check prior reviews in `.flow/artifacts/reviews/` — if a named cascade's constituents appear again, cite it and assert reproduction. A missed cascade is the most expensive error this review can make; prefer a false positive.

**Adjudication, where the harness offers it.** If this session exposes an adjudication tool — a second model that reviews a finding set before it is written — flush the findings to the conversation first, call it once, and paste what comes back **verbatim** as a blockquote at the top of the review's *Recommendation* section. Never re-parse its prose into findings and never call it from inside a pass. Where no such tool exists, run the sweep inline instead: for each of **data model / API surface / integration / scope / verification / performance**, ask whether the findings as a set hold up, and record the tension wherever two findings disagree about the same entity.

**Reconciled output** — one authoritative severity per finding, interaction findings carrying `I<n>` ids under the severity heading that matches their final tier, and each severity move recorded as a title-line annotation (`[precedent-weighted]`, `[cascade: <kind>]`, `[subsumed-by I<n>]`). Structural defects stay distinct findings even when related: a *stranded state* and a *false-promise predicate* in one subsystem are two defects unless narrative, fix and evidence are identical. A 🔴 disjunction must have checked whether the earlier one's mechanism is what makes the later possible; if so, emit one finding, not two.

## Step 6 — Verify every finding

Do not skip: this is the only step that stops a confident assertion the reviewer never opened a file to check. One verifier, over the reconciled map, **after** the pre-filter that drops findings whose file ∉ `InScopeFiles` (record the dropped count in the notes — on a back-merged branch this is where sidecar findings leave).

Per finding:

1. `grep -n` the verbatim quote in the cited file. Absent → **Falsified**. Present at a different line → rewrite the citation and continue.
2. Where the claim depends on code elsewhere (consumer filters, registrations, peer aggregates, upstream guards, downstream sinks), read those files — never reason from the patch alone.
3. A claim that a state is stranded, a predicate false-promise, or a precondition missing needs a concrete 2–3 line reproducer: who reaches the state, which guard rejects it, and which exit path the code does not provide. No reproducer → **Weakened**.
4. A finding marked resolved needs the resolving commit read on the reviewed branch to confirm the resolution is present at tip.

Tags: **Verified** (quote matches, claim reproduces, nothing contradicts) · **Weakened** (narrower than stated — demote one tier, rewrite the evidence line) · **Falsified** (quote does not match, or the code contradicts the claim — drop it; its id is retired, never reused).

One row per input finding, in this shape: `FINDING <id> | <tag> | <one-sentence justification citing a file:line>`.

Read every Weakened/Falsified justification, not just the tag: the justification is the evidence, and a tag that contradicts its own sentence is overridden by the sentence. Exactly one row per input finding — re-dispatch for any missing id. A cross-finding bullet whose constituents are now Falsified or Weakened is re-evaluated and dropped unless ≥2 Verified constituents from different files remain.

## Step 7 — Write the review document

`blockers_count` = the remaining 🔴 + 🟡 findings; `status: ready`; the `verification` tally (verified / weakened / falsified) in the frontmatter. Emit no verdict beyond that count — the review reports, it does not decide.

- The document format is this skill's `templates/review.md`, beside `SKILL.md` — frontmatter (`date`, `author`, `repository`, `branch`, `commit`, `review_type`, `scope`, `scope_strategy`, `in_scope_files_count`, `status`, `severity`, `verification`, `blockers_count`, `tags`) then Top Blockers, Legend, then findings grouped by severity H2, each with **Where** (`file:line`), **Code** (the verbatim line), **Why** (mechanism, one or two sentences), **Fix** (one imperative sentence) and optional **Alt**.
- **Where it goes.** A workflow driving this review (a gate reading `blockers_count`) collects the document from `.flow/artifacts/reviews/` — write it there. No workflow context: report in the conversation and write nothing at all.
- **Finding ids** are a lens prefix plus an ordinal — `Q` quality, `S` security, `G` gap, `I` interaction — stable across severity moves, with an ordinal never reused. The verifier's rows and the reconciliation annotations both key off them.
- **Title-line annotations** sit in square brackets on a finding's title line, at the point of demand: `[precedent-weighted]` (severity raised by the precedent weighting), `[cascade: <kind>]` (severity set by a cascade triple — `stranded-state`, `duplicate-processing`, `contradictory-predicate-deadlock`), `[subsumed-by <ID>]` (root cause subsumed by another finding, kept because its evidence is independently actionable).
- **Omit a section entirely** rather than leaving a placeholder: `## 💭 Discussion` with no 💭 findings, `## Pattern Analysis` when no peer pair existed, `## Impact` when the orientation pass found no inbound refs, `## Precedents` when there were none or the review is a tree review.
- **Not emitted at all**: verification outcomes restated in prose (the frontmatter `verification` tally is the only channel), the adjudication path or its failures, and `last_updated` fields — git already carries the timestamp and author for a write-once artifact.
- **Preserve the template's severity marks and frontmatter keys verbatim** — other tooling greps them.
- **Frontmatter values, with no sibling script.** Five fields are derived rather than stated: `date` from the current time (`date -u +%Y-%m-%dT%H:%M:%SZ`), `repository` from the remote's `owner/name` (`git remote get-url origin`, reduced) or the repository directory name, `branch` from `git rev-parse --abbrev-ref HEAD`, `commit` from `git rev-parse --short HEAD`, and `author` from the session's user — `unknown` is better than a guess. Everything else in the template comes from a pass output.
- Print the summary in this session:

  ```
  Review written to: .flow/artifacts/reviews/{filename}.md     (omit when nothing was written)
  Commit:       {short hash}
  Status:       {ready}
  Severity:     {C} critical · {I} important · {S} suggestions · {D} discussion
  Verification: {V} verified · {W} weakened · {F} falsified (dropped)
  Adjudication: {harness tool | inline sweep | none}
  Blockers:     {B} unresolved (🔴 + 🟡)
  Top items:
    1. {ID} — `file:line` — {headline}
  ```

  Read-only otherwise — write no log line; `remediate` owns that.

## Step 8 — Follow-ups

Answer questions about the review from the evidence already gathered. A follow-up that needs new analysis is a new scope — offer it, do not silently widen this one. Point at the next command (`remediate` to act on the findings, `declutter` for codebase-wide bloat) and never invoke another skill.

- **Append, never rewrite.** A follow-up that changes the review document adds a `## Follow-up {ISO 8601 timestamp}` section; the timestamp is the append marker. Retired ids stay retired, and new findings take new ordinals with the same lens prefix.
- **Re-dispatch narrowly.** One targeted pass at most, on the area in question — never the whole review again.
- **Re-invoke instead** when the diff itself moved (new commits, a different branch, a changed scope): that is a fresh review, not a follow-up.

## Hard rules

- **Read-only.** Never edit a reviewed file, a plan, or a log. The only write is the review document, and only when a workflow drives the run.
- **Evidence or nothing.** `file:line` plus the verbatim line; drop what you cannot quote.
- **No solution theatre.** Each finding carries one sentence of direction, which is what the next round acts on — not a patch, not a design, and never code written into the review.
- **Distinct defects stay distinct**; cascades are emitted once, as the aggregate.
- **Say what did not run.** A pass that was skipped, a specialist with no equivalent in this harness, a check that could not be executed — each is reported as not run, with the reason.
