# 0010 — bundled skill: `security-review`

## Goal

Ship a `security-review` skill in the bundled set. No personal version to port — research how security-focused review skills work in the agent ecosystem, propose 2–3 designs, brainstorm to convergence, then implement.

## Decisions

**Discovery + design plan.** Implementation defined after the brainstorming step.

**Working definition.**
Audit pending changes on the current branch for security-relevant issues. Output is a structured report: severity, location (`file:line`), category (e.g. injection / authz / secrets / dependency / crypto / DoS-risk), explanation, recommended fix. Read-only — does not apply changes.

**Compared to `code-review`.**
- `code-review`: broad correctness / readability / conventions.
- `security-review`: single lens, deeper into one concern. Categories drawn from OWASP-style taxonomy.

**Scope.**
- Local diff only (v0). No whole-codebase audit, no dependency CVE scanning (that's `npm audit`'s job, not an LLM's).
- Focus on AppSec patterns visible in source: input validation, output encoding, authn/authz checks, hardcoded secrets, unsafe deserialization, command injection, SQL injection, path traversal, insecure crypto choices, race conditions in security-sensitive code.

**Out of scope.**
- Infrastructure / config review (Terraform, k8s). Different skill if useful.
- Threat-modeling at architecture level (way more than a per-diff skill can do).
- Dependency vulnerability scanning (tooling, not LLM).

**Research surface.**
- Anthropic's own `/security-review` if it exists in Claude Code — likely a reference point.
- Public AI-security-review prompts (there are several open-source attempts).
- OWASP Top 10 + CWE Top 25 as the category vocabulary.
- The Cloudflare workers-best-practices reference (found earlier) likely has security-adjacent material — worth a skim.

**Three candidate axes.**
1. **Severity taxonomy.** OWASP-style (Critical / High / Medium / Low / Info), or skill-specific (blocker / important / nit + category tag).
2. **False-positive control.** Aggressive (flag everything plausible) vs conservative (only flag when confident). Aggressive is safer for security; conservative is more usable.
3. **Output discipline.** Inline comments vs structured report at end vs single Markdown table. Affects review fatigue.

## Approach

Research-and-design. Implementation after brainstorming.

## Steps

1. **Research.**
   - Search for public Claude Code `/security-review` patterns (Anthropic blog posts, repos).
   - Find 2 public AI-security-review prompts; note category vocab + false-positive handling.
   - Pull the OWASP Top 10 (current) and CWE Top 25 lists for category framing.
   - Skim the Cloudflare workers-best-practices reference for relevant material.
2. **Draft three options.** Each with one paragraph + sample report excerpt:
   - Option A: OWASP-aligned categories, conservative confidence threshold (only flag when justification is concrete), report at end.
   - Option B: Aggressive flagging with explicit confidence per finding ("high / medium / low confidence"), Markdown table output.
   - Option C: Two-pass — first pass categorizes risk surface in the diff, second pass deep-dives the surfaces that matter. Slower but better precision.
3. **Compare.** Trade-offs: signal-to-noise, latency, output length, integrates-with-PR-comments-someday.
4. **Brainstorm with user.** Present + recommend. User picks / directs.
5. **Write implementation sub-plan.** SKILL.md, modes, tests.
6. **Execute** — `src/skills/security-review/SKILL.md`, README mention, target tests, marker safety as needed.

## Open questions

- Should this skill ever *apply* fixes (e.g. add escaping, add input validation)? Lean no — security mistakes from auto-fixing security issues are worse than no fix. Report-only.
- Should categories be a fixed list or open-ended? Lean fixed (OWASP/CWE rooted) — easier to scan a report when categories are bounded.
- Compose with `code-review` (run review first, security after) or independent? Probably independent — security review tolerates more noise than code review.
- Does it need access to dependency manifests (package.json) for context, or pure source review? Lean: read package.json if it exists, treat as informational only. Plan to confirm.

## Confidence

≥90% on this discovery plan.

## Design pass — converged decisions (2026-05-26)

Brainstorm resolved scope, severity, and noise posture. These override the originals where they differ; originals kept as the pre-brainstorm record. Reference point confirmed: Claude Code ships a built-in diff-scoped `/security-review`; building ours makes the same posture cross-agent (pi / opencode / copilot).

**Scope → diff by default, argument targets an area.** A no-arg run reviews the branch diff vs `origin`'s default branch — same surface and detection as `code-review` (`origin/HEAD` → `origin/main` → `origin/master`, merge-base to working tree). An argument redirects to a path for a standalone deep audit regardless of diff: `/security-review src/auth`. This also partially fills the "unchanged code is never audited" gap, on the security axis.

**Reads beyond the diff to trace exploitability.** Unlike `code-review`'s narrow dup-check reach, security-review *must* follow data flow — a tainted input in the diff may reach a sink outside it, or the guarding authz check may live elsewhere. Reading surrounding code to confirm whether a path is actually exploitable is core to the job, not scope creep.

**Severity → impact-based: Critical / High / Medium / Low / Info.** Tied to exploitability + impact, not merge-urgency (the axis security reviewers expect). Every finding also carries an OWASP/CWE-rooted category tag.

**Noise → conservative; a concrete exploit path is required to flag C/H/M/L.** Each such finding states how it would be abused. This is the primary defense against security-theater and hallucinated vulns. Findings with no concrete exploit path but real hardening value go under **Info**, kept sparse — the release valve so "require an exploit path" doesn't suppress legitimate defense-in-depth notes.

**Report-only.** Never applies fixes — a wrong security auto-fix is worse than none. Report mirrors `code-review`'s shape: grouped (by severity here), each finding = `file:line`, category, the exploit path, impact, recommended fix.

**Seam with `code-review`.** `code-review` flags *obvious* security issues as part of a broad pass and defers depth here; `security-review` is the dedicated deep pass you run when you want thoroughness on the security axis. Overlap on an obvious finding is fine — you don't run both routinely. No hard chaining; it may point, never auto-invokes.

**Decided defaults (veto-able).**
- *Categories:* fixed, OWASP Top 10 + CWE Top 25 rooted — a bounded list keeps the report scannable.
- *Dependencies:* read `package.json` / manifests for context only; no CVE scanning (that's `npm audit` / tooling, not an LLM).
- *Mode:* slash + auto, recommend auto (mirrors `code-review`); discourage `always`.
- *Out of scope (unchanged):* infra / IaC review, architecture-level threat modeling, dependency CVE scanning.

Purpose now locked at ≥98%. What remains is authoring: the SKILL.md body + a `bundle.test.ts` assertion. Research (OWASP/CWE lists, public prompts) optional — category vocab is well-established.
