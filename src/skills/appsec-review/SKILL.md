---
name: appsec-review
version: "0.1.0"
description: Deep, read-only security audit of the changes on this branch (local vs origin's default branch), or a path you name. Conservative — flags a vulnerability only with a concrete exploit path, ranked Critical/High/Medium/Low/Info with an OWASP/CWE category. Auto-activates on "security review / check this for vulnerabilities". Reports; never edits.
slug: appsec-review
---
# appsec-review

Deep security lens on *the changes*: is this delta exploitable? Activates on "security review this / check for vulnerabilities", or `/appsec-review`. This is the dedicated deep pass — `code-review` flags *obvious* security issues in passing and defers depth here. Report-only: a wrong security fix is worse than none.

## Scope
- Default: the branch diff vs the repo's default branch on `origin`. Find it with `git symbolic-ref refs/remotes/origin/HEAD` (fall back to `origin/main`, then `origin/master`); diff its merge-base with `HEAD` against the working tree.
- An argument redirects to a path for a standalone audit regardless of diff: `/appsec-review src/auth`.
- **Read beyond the scope to judge exploitability** — follow a tainted input to its sink, check whether a guard exists elsewhere. You can't rate a path you haven't traced.

## What to hunt
- Injection (SQL / command / template), unsafe deserialization, path traversal.
- Missing or broken authn/authz checks; trust-boundary crossings.
- Hardcoded secrets, leaked credentials, secrets in logs.
- Insecure crypto (weak algorithms, static IVs/keys, predictable randomness).
- Unvalidated input, missing output encoding, SSRF, open redirects.
- Races in security-sensitive code (auth, payment, file access).
- Read `package.json` / manifests for context only — no CVE scanning (that's `npm audit`'s job, not yours).

## Calibrate — conservative
- Flag a Critical/High/Medium/Low finding **only with a concrete exploit path**: name the entry point, the flow, and how an attacker abuses it. No path, no flag.
- Hardening worth mentioning but not demonstrably exploitable → **Info**, kept sparse. Don't pad.
- No security theater, no restating safe code as a risk. A clean diff gets a clean bill.

## Report
- Group by severity: **Critical / High / Medium / Low / Info**. Each: `file:line`, OWASP/CWE category, the exploit path, the impact, a recommended fix.
- Read-only — write nothing into files, never auto-invoke another skill. End with a one-line verdict: no issues found / fix-before-merge / needs-deeper-look.
