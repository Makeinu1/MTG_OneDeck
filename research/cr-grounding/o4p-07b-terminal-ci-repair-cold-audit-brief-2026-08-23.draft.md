# O4P-07B terminal CI repair cold-audit brief

Date: 2026-08-23
Role: read-only protected-review repair auditor
Base HEAD: `39b1f8da0950ce381b5268332836aadca4d512b5`
Candidate diff SHA-256: `b735c8a07812673c7b4c17feb421fb4ad5890e79f6ecaae917e560313fd3596b`

Audit only the uncommitted single-literal changes in:

- `src/test/architecture/review.o4p-06-roadmap-registration.test.ts`;
- `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`.

Actions `32607455316` checked out the base HEAD and failed only because both
historical review tests expected active program `O4P-07.nextDomainId` to remain
`O4P-07B` after O4P-07B had been marked `shipped`. The candidate changes each
expectation to `O4P-07C` and changes no other assertion.

Verify adversarially that:

1. `research/cr-grounding/cr-backbone-ledger.json` has O4P-07B `shipped` and
   O4P-07C `pending` in both `domains` and `plannedSequence`;
2. `npm run codex:context -- --domain O4P-07C` projects active-program
   `nextDomainId: O4P-07C` with healthy ledger state;
3. the two candidate files differ from base only by the exact two literals and
   do not weaken historical, authorization, or fail-closed assertions;
4. targeted DOM execution of both files passes 2 files / 12 tests;
5. no uncommitted product/runtime path is present. This brief is Judge-owned
   audit metadata and is outside the candidate diff fingerprint above.

Do not edit, commit, push, deploy, run full `npm run check`, or perform product
work. Return BLOCKER/HIGH/MEDIUM/LOW, the recomputed candidate fingerprint, and
`O4P-07B-TERMINAL-CI-REPAIR-APPROVED` only if exact.
