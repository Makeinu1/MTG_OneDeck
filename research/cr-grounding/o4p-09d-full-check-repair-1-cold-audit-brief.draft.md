# O4P-09D Full-Check Repair 1 Cold-Audit Brief

Date: 2026-08-26
Semantic base SHA: `d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-09d-full-check-repair-1.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

## Audit the repair delta

Compare the repaired candidate with the previously accepted successor
fingerprint
`4b3b5ae40e3b149938f10260cf5b4b56d58380fce2adeab98e833b5350696bda`
and verify:

1. The executable repair contains only the exact SHA-256 re-pins for the four
   O4P-03A through O4P-03D verifiers and the two O4P-09D-changed Cloudflare
   production files in O4P-05C, plus the resulting O4P-05C SHA-256 re-pin in
   O4P-05D.
2. All seven re-pinned values equal the current intended authorities
   byte-for-byte.
3. The underlying historical verifiers changed in the already audited O4P-09D
   semantic candidate only to enumerate `projectionBudgetV1.ts` and admit the
   exact `../tabletopManual/index` runtime import; the two production files are
   the already audited O4P-09D persistence/runtime implementation.
4. No other assertion, allowlist/source entry, timeout, dependency, product
   behavior, UI/protocol meaning, ownership rule, or release requirement was
   changed or weakened.
5. All six historical verifier commands pass and remain non-vacuous; affected
   ESLint and `git diff --check` pass.
6. The successor manifest, ledger, audit record, and these two repair briefs
   remain secret-free and internally consistent.

## Targeted commands

```sh
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx eslint scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts
git diff --check
```

Return `O4P-09D-FULL-CHECK-REPAIR-AUDIT-OK` only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Full check and live release evidence
remain out of scope.
