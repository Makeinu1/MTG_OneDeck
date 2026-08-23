# O4P-07C Full-Check Repair 3 Cold-Audit Brief

Date: 2026-08-23
Base SHA: `85c9f1532b9d82282a441f40bc010c3e1e0e5400`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07c-full-check-repair-3.draft.md`

Read only. Do not edit, stage, commit, push, run full `npm run check`, deploy,
or browse. Return BLOCKER/HIGH/MEDIUM/LOW findings and the frozen staged
fingerprint supplied by the Judge.

Verify that the complete staged delta contains only the five executable
verifier files and these two repair briefs. Recompute every frozen SHA-256 in
the affected O3A/O3B/O3C -> O5C -> O5D chain. Confirm the six review repins,
three downstream Cloudflare-verifier repins, and one O5C-to-O5D repin are exact;
the changed O4P-07A review has no exact `scripts/checks` pin; and no allowlist,
assertion, source path, command, ownership rule, or release meaning changed.

Run only the five affected verifiers directly with the repository's TypeScript
loader, affected ESLint, and `git diff --check`. Treat a sandbox-only `tsx` IPC
failure as environment noise only if the equivalent direct execution succeeds.

Confirm Actions `32632994186` / job `97178491909` failed only at the stale
O4P-03A review hash before lint, tests, build, O4P-07C production verification,
ownership, or Pages. Do not claim full-check success.

Return `O4P-07C-FULL-CHECK-REPAIR-3-AUDIT-OK` only when all findings are zero.
Do not start another full check; a new user exception remains required.
