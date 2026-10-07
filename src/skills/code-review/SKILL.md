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

## Project conventions
If the project carries them — `docs/goals.md`, `docs/conventions.md`, or `.flow/guidance/**/architecture.md` — read them first; they override these defaults.

## Dispatch contract — who does the work

The analysis runs in specialist passes, not in this session:

- **Subagents are the default.** Dispatch each pass through the harness's subagent mechanism (`subagent`, `Task`, an Agent tool — whatever this harness exposes) so that tool calls, intermediate findings and the search trail never enter the session. What comes back is findings and the verdict; nothing else.
- **Check availability first.** No subagent mechanism → run the passes yourself, in the order below, as **one bounded single pass**: apply the surfaces and sink classes to the highest-risk files and say plainly which files you did not reach. Do not silently pretend the passes ran.
- **A direct invocation wins.** The user typing the command, or saying "run it here" / "no subagent", means do it inline.

Role names below (`integration-scanner`, `precedent-locator`, `codebase-analyzer`, `diff-auditor`, `peer-comparator`, `claim-verifier`) describe the *job*, not an agent type: map each to whatever this harness offers, and where a named specialist is missing, do that job yourself or state that it did not run.

**Context isolation is load-bearing.** A pass receives the changed-file list, the Discovery Map and the patch path — never another pass's findings, with one deliberate exception: the predicates table from the quality lens is handed to the interaction sweep verbatim. Sharing more produces overlapping findings, inflated severity and burned tokens.

## Step 1 — Resolve scope and assemble the diff

Determine the scope spec from the argument the user supplied. Empty → `auto`. Ambiguous (prose, mixed list, an unresolvable ref) → ask one clarifying question with the same four options below, then continue.

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

2. **Confirm the strategy** — `first-parent` (`auto`, PR branch, commit list) uses `<range>` **and** `<fp_flag>`; `explicit-range` (hash, `A..B`) uses `<range>` without it; `working-tree` (`commit` / `staged` / `working`) uses the working-tree commands, no range; `tree` (`--folder` / `--file`) reviews tracked files as complete entities and **skips precedents** (there is no creation history to compare).

3. **Assemble the union of changes**, not the endpoint diff, so reverted intermediate work stays visible. Save the patch once with generous context — `git log "<range>" <fp_flag> --patch --reverse --no-merges -U30 > <patch_path>` — and never re-run `git log --patch` to slice windows later. Working-tree and tree strategies have their equivalents (`git diff [--cached] -U30`, `git show HEAD -U30`, and for a tree a `<null_tree>` diff of the enumeration the helper returned). A patch over ~1 MB drops to `-U10`; **never `-U0`** — the surrounding context is what lets a pass judge a change without a second read.

4. **Derive the review's working sets**:
   - `ChangedFiles` — the helper's `---changed-files---` block.
   - `InScopeFiles` — what the author actually wrote. For `first-parent` it is the union of each feature commit's own `--name-only` delta, which drops back-merge sidecars that `ChangedFiles` carries. For every other strategy it equals `ChangedFiles`. Invariant: `InScopeFiles ⊆ ChangedFiles`.
   - `ManifestChanged` — `ChangedFiles` touches a dependency manifest or lockfile, or a peer/optional/dev-dependency field.
   - `HasGatingPredicate` — the diff adds or modifies a status/enum predicate, or introduces a value into an enum other predicates already gate. Not merely the presence of a guard.
   - `PeerPairs` — new files paired with an existing peer at HEAD by stem similarity, interface/impl shape, or a shared role suffix (`Handler`, `Service`, `Repository`, `Reducer`, `Strategy`, `Policy`, …). Pairs where both files are new, or the peer is absent, are dropped.
   - Role tags per file, for ordering: `[boundary]` (security-sensitive) → `[persistence]` → `[hub]` (blast-radius amplifier) → `[code]` → `[config]` → `[test]` last.

5. **Bail out when there is nothing to review**: empty `ChangedFiles` → print `No changes in scope {scope}. Exiting.` and write nothing.

## Evidence contract

Binding on every pass, every finding, every justification:

```
file:line — `<verbatim line>` — <note>
```

The line is quoted literally from the file. **Omit any finding whose line you cannot quote verbatim.** Passes return evidence only: no severity, no recommendations, no prose outside their own format. Severity is assigned once, in reconciliation.

## Step 2 — Orientation passes (parallel)

Dispatch together; they consume only `ChangedFiles`, the manifest diff and `PeerPairs`, never each other's output.

- **Integration map** (`integration-scanner`) — inbound references, outbound dependencies, and infrastructure wiring for the changed files. Flag auth-boundary crossings (middleware, guards, interceptors, authorize-style decorators) and config/DI/event registration touching those paths. Connections only — no quality analysis.
- **Precedents** (`precedent-locator`) — skipped for a tree review. Similar past changes, their blast radius and their follow-up fixes: a prior fix within 30 days of a sibling change is evidence about this one.
- **Dependencies** (only when `ManifestChanged`) — the touched manifests and lockfiles: version drift, lockstep violations across a monorepo, and major-version moves without a migration path.
- **CVE / advisories** (only when `ManifestChanged`) — `name@version` pairs parsed from the manifest diff, checked against advisories. Evidence only; no fix versions invented.
- **Peer mirror** (`peer-comparator`) — for each `PeerPairs` tuple, enumerate the peer's public surface as rows: public methods, emitted events, state transitions with their preconditions, injected collaborators, persisted fields, and registrations into dispatch tables. One row per peer invariant: `peer_site | new_site | status | delta`, where status ∈ `Mirrored` / `Missing` / `Diverged` / `Intentionally-absent`. `Intentionally-absent` needs an explicit cite — a comment, a commit-message line, or a type constraint that makes it inapplicable; when in doubt, `Missing`.

The orchestrator builds the **Discovery Map** inline from Step 1 while those run: `ChangedFiles` with `(+A -B)` and role tags, the top-level symbols each file touches, `ManifestChanged`, `ReviewType`, and the commit-message context where a range exists. It is the only context the next step receives.

Wait for the integration map and — when dispatched — the peer mirror before continuing: the next passes read both. Precedents must be in before reconciliation; dependencies and advisories merge there too.

## Step 3 — Lens passes (parallel)

Each lens receives the Discovery Map verbatim, plus the patch path (or, for a tree review with more than ten files, the file list to read directly — a full-tree patch would flood the session).

### Quality lens — the surfaces

Per file, form a model of what the file does and what the diff changes, then walk every surface whose **trigger** applies. The triggers are mechanical — each names a condition in the diff that decides whether the surface applies — so the walk is checkable rather than a matter of taste, and a surface that fires is reported even when the finding is mild:

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

File-oriented, with an **in-scope rule**: report only sinks inside a changed file's diff region, except where the diff changes how data flows *to* an untouched sink — then cite both ends. Each hit carries the verbatim line, two lines of surrounding context, and `confidence: N/10` that user-controlled input reaches it; drop below 8. Sink classes, matched by concept rather than by idiom:

- **Command execution** — shell/process spawn taking user input.
- **Dynamic code / unsafe deserialization** — `eval` and dynamic constructors; deserializers that can execute code.
- **Query injection** — user input concatenated or interpolated into a string an external engine interprets (SQL, NoSQL operators, LDAP, XPath, string-built GraphQL). Parameterized queries are safe.
- **Explicit-trust rendering** — user input into a channel that interprets it as code/markup: explicit-trust APIs, raw-HTML markdown, unescaped ANSI to a TTY, template-engine raw blocks.
- **Path traversal** — user-controlled path components without normalization or an allowlist.
- **SSRF** — outbound requests with a user-controlled host or protocol, not merely a path.
- **Secrets in the diff** — literal credentials, keys, PEM blocks, connection strings with embedded passwords.
- **Missing trust-boundary check** — a traced sink reached from a boundary crossing (HTTP handler, RPC endpoint, IPC message, CLI flag reaching a privileged operation, webhook) with no upstream authorization or validation.

Out of scope for this lens: denial of service and rate limiting, hardening with no traced sink, theoretical races with no reproducer, client-side-only authn/authz, findings sourced only from an env var, CLI flag or UUID, and dependency CVEs (the advisory pass covers those).

## Step 4 — Coverage passes

**Predicate trace** (only when `HasGatingPredicate` and the quality lens returned ≥2 rows on one enum) — per predicate: inputs, what the matching branch promises, the consumer and its filter, and whether the promise holds. Flag a **false promise** (the matching branch depends on a consumer that excludes this entity) and a **stranded state** (state X is reachable but every conditional elsewhere excludes it).

**Interaction sweep** (skip when the changeset is a single file or the quality lens returned fewer than four observations) — group the findings by shared entity, state machine, workflow, data-flow path, API boundary, background process, or producer/consumer contract. Per group, look for: contradictory assumptions across layers; unreachable or non-terminal states; retry mechanisms made inert by another behaviour; duplicate processing from missing originators or idempotency keys; a guard in one layer invalidating a transition in another; one finding masking, amplifying or permanently triggering another; a stranded state; a false-promise predicate; a co-tenant filter gap where a new or terminal value falls through every consumer's filter. Return only findings with ≥2 `file:line` facts from different files. Where ordering, races or concurrency are claimed, name the primitive that *would* prevent it and why that primitive does not apply here — a speculative argument against an existing primitive means drop the finding.

**Gap finder** (skip when the changeset is a single file) — coverage arithmetic, done here rather than by another agent: `{in-scope files} − {files with at least one finding}` = uncovered files. Filter to `[boundary]`, `[persistence]`, `[hub]` and `[code]` files with a delta of ≥5 lines; drop `[test]` and `[config]`. For each, cite one risk-bearing line — the first added non-comment line, or the declaration header of an added function — and name the risk class in three to six words: state mutation, I/O, error path, conditional on mutable state, concurrent access, public API change. Maximum **5** gap findings; for a tree review the same arithmetic runs against exported symbols with no test and no error path. Gap findings are uncertain by nature: never 🔴.

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

**Reconciled output** — one authoritative severity per finding, interaction findings carrying `I<n>` ids under the severity heading that matches their final tier, and each severity move recorded as a title-line annotation (`[precedent-weighted]`, `[cascade: <kind>]`, `[subsumed-by I<n>]`). Structural defects stay distinct findings even when related: a *stranded state* and a *false-promise predicate* in one subsystem are two defects unless narrative, fix and evidence are identical. A 🔴 disjunction must have checked whether the earlier one's mechanism is what makes the later possible; if so, emit one finding, not two.

## Step 6 — Verify every finding

Do not skip: this is the only step that stops a confident assertion the reviewer never opened a file to check. One verifier, over the reconciled map, **after** the pre-filter that drops findings whose file ∉ `InScopeFiles` (record the dropped count in the notes — on a back-merged branch this is where sidecar findings leave).

Per finding:

1. `grep -n` the verbatim quote in the cited file. Absent → **Falsified**. Present at a different line → rewrite the citation and continue.
2. Where the claim depends on code elsewhere (consumer filters, registrations, peer aggregates, upstream guards, downstream sinks), read those files — never reason from the patch alone.
3. A claim that a state is stranded, a predicate false-promise, or a precondition missing needs a concrete 2–3 line reproducer: who reaches the state, which guard rejects it, and which exit path the code does not provide. No reproducer → **Weakened**.
4. A finding marked resolved needs the resolving commit read on the reviewed branch to confirm the resolution is present at tip.

Tags: **Verified** (quote matches, claim reproduces, nothing contradicts) · **Weakened** (narrower than stated — demote one tier, rewrite the evidence line) · **Falsified** (quote does not match, or the code contradicts the claim — drop it; its id is retired, never reused).

Read every Weakened/Falsified justification, not just the tag: the justification is the evidence, and a tag that contradicts its own sentence is overridden by the sentence. Exactly one row per input finding — re-dispatch for any missing id. A cross-finding bullet whose constituents are now Falsified or Weakened is re-evaluated and dropped unless ≥2 Verified constituents from different files remain.

## Step 7 — Write the review document

`blockers_count` = the remaining 🔴 + 🟡 findings; `status: ready`; the `verification` tally (verified / weakened / falsified) in the frontmatter. Emit no verdict beyond that count — the review reports, it does not decide.

- The document format is this skill's `templates/review.md`, beside `SKILL.md` — frontmatter (`date`, `author`, `repository`, `branch`, `commit`, `review_type`, `scope`, `scope_strategy`, `in_scope_files_count`, `status`, `severity`, `verification`, `blockers_count`, `tags`) then Top Blockers, Legend, then findings grouped by severity H2, each with **Where** (`file:line`), **Code** (the verbatim line), **Why** (mechanism, one or two sentences), **Fix** (one imperative sentence) and optional **Alt**.
- **Where it goes.** A workflow driving this review (a gate reading `blockers_count`) collects the document from `.flow/artifacts/reviews/` — write it there. No workflow context: report in the conversation and write nothing at all.
- Print the summary in this session: `Commit`, `Status`, the severity counts, and the Top Blockers lines. Read-only otherwise — write no log line; `remediate` owns that.

## Step 8 — Follow-ups

Answer questions about the review from the evidence already gathered. A follow-up that needs new analysis is a new scope — offer it, do not silently widen this one. Point at the next command (`remediate` to act on the findings, `declutter` for codebase-wide bloat) and never invoke another skill.

## Hard rules

- **Read-only.** Never edit a reviewed file, a plan, or a log. The only write is the review document, and only when a workflow drives the run.
- **Evidence or nothing.** `file:line` plus the verbatim line; drop what you cannot quote.
- **No solution theatre.** Each finding carries one sentence of direction, which is what the next round acts on — not a patch, not a design, and never code written into the review.
- **Distinct defects stay distinct**; cascades are emitted once, as the aggregate.
- **Say what did not run.** A pass that was skipped, a specialist with no equivalent in this harness, a check that could not be executed — each is reported as not run, with the reason.
