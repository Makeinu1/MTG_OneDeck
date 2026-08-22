# O4P-07A terminal full-check repair cold-audit brief

Date: 2026-08-22
Role: read-only R3/BROAD terminal repair auditor
Base / failed exact HEAD: `c2a22caa84ab477f79188c5f6848e6a6c4279460`
Failed Actions run: `32568531533`

## Goal

Audit the smallest correction for the exact-head full-check failure after
O4P-07A terminal ledger promotion. The failure was limited to two historical
Judge-owned review assertions that still expected `activeProgram.nextDomainId`
to be `O4P-07A`; the shipped ledger correctly projects `O4P-07B`.

## Frozen candidate scope

Only these paths may differ from the base:

- `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`
- `src/test/architecture/review.o4p-06-roadmap-registration.test.ts`
- this brief

Each review change must be exactly one expected value from `O4P-07A` to
`O4P-07B`. Product source, ledger, contracts, workflow, dependency, and
O4P-07B implementation bytes must not change.

## Required evidence

- Confirm Actions `32568531533` failed only because these two assertions
  expected `O4P-07A` while receiving `O4P-07B`; Core passed and DOM reported
  328 passing files, two failing files, 2,234 passing tests, one skipped.
- Confirm targeted DOM execution of the two files passes 2 files / 12 tests,
  targeted ESLint passes, and `git diff --check` passes.
- Confirm both ledger collections mark O4P-07A shipped, O4P-07B/O4P-07C
  pending, and the active program projects O4P-07B.
- Confirm the correction repairs expectations without weakening assertions or
  starting O4P-07B.
- Recompute the canonical full-tree fingerprint and report findings as
  BLOCKER/HIGH/MEDIUM/LOW.

Do not edit, commit, push, deploy, run the full `npm run check`, or begin
O4P-07B. Approval is `O4P-07A-TERMINAL-FULL-CHECK-REPAIR-APPROVED` only when
all findings are zero.
