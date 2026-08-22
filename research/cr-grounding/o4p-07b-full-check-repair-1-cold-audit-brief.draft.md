# O4P-07B Full-Check Repair 1 Cold Audit Brief

Date: 2026-08-23
Base SHA: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07b-full-check-repair-1.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

## Audit the repair delta

Compare the repaired candidate with the previously approved fingerprint
`0fa743d977a9f60da6cf4f71d1b4199a28b4b3c4c244267d4b4d0b88fbdfd1d9`
and verify:

1. Only the exact `../genesis/index` public import admission, the O4P-03A ->
   O4P-03B -> O4P-05C -> O4P-05D SHA-256 chain, and these two repair briefs
   were added to the approved candidate.
2. Each re-pinned hash equals the current intended authority byte-for-byte.
3. No other assertion, allowed import/source entry, timeout, dependency,
   production behavior, UI behavior, protocol meaning, or release requirement
   was changed.
4. The O4P-05D live untracked-protected-path rejection is unchanged and passes
   only because the complete candidate is explicitly staged.
5. All six historical verifier commands pass and remain non-vacuous.
6. Affected ESLint and `git diff --check` pass.

## Targeted commands

```sh
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx eslint scripts/checks/verify-online-cloudflare-runtime-persistence.ts scripts/checks/verify-online-cloudflare-websocket-recovery.ts scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts
git diff --check
```

Return `AUDIT-OK-PENDING-FINAL-FULL-CHECK` only when BLOCKER/HIGH/MEDIUM/LOW
are all zero.
