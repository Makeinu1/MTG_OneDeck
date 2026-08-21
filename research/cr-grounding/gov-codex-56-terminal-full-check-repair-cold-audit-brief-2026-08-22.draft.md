# GOV-CODEX-56-2026-08 Terminal Full-Check Repair Cold-Audit Brief

Milestone: `GOV-CODEX-56-2026-08`
Repair base HEAD: `2aa0a32525e962b38d081feb38bfa3273575086e`
Failed exact-head run: `32508883145`
Failed build job: `96855156944`
Role: fresh-context findings-only full-check repair auditor

Audit only this brief and the bounded change to
`src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`.
Read the immutable governance audit record and CI reauthorization packet only
as evidence. Do not edit files, run `npm run check`, mutate git, push, deploy,
or claim Pages success.

## Failure

The clean-checkout release check passed Core 227 files/2093 tests. DOM then
passed 324 files and failed exactly one file/test in the governance review;
2202 tests passed and one was skipped out of 2204 total. The assertion rejected
the committed CI reauthorization brief as an unexpected candidate path. Build,
diff-base resolution, ownership, artifact upload, and Pages deploy were skipped
after the test failure. Machine-check total was 727053 milliseconds.

## Repair candidate

The review's exact allowed-path set adds only:

- the already committed CI reauthorization brief;
- the already committed CI reauthorization record;
- this terminal full-check repair brief; and
- the future archive record that will contain only this audit's exact outcome.

The repair does not add a pattern, directory, product path, contract path,
dependency, workflow, ledger change, or runtime allowance. Removing the four
lines restores the failing base review. The pre-repair review fails
non-vacuously on the two committed reauthorization paths; after repair the
targeted governance/O4P-06F/operations review set must pass.

## Required audit

Confirm the failure evidence and counts against GitHub run `32508883145`.
Confirm the base/head relationship and that current committed product,
contract, workflow, ledger, dependency, CR, and deployment bytes are unchanged.
Confirm every added allowed path is exact and governance-only, the archive path
is reserved solely for this audit outcome, and no wildcard or future product
escape is introduced. Confirm targeted review tests, affected ESLint, docs,
and diff checks pass and no release full check was rerun locally.

Return BLOCKER/HIGH/MEDIUM/LOW with exact evidence. Return
`AUDIT-OK-PENDING-FINAL-EXACT-HEAD-CI` only if exact. Approval authorizes only
the bounded repair/audit-record commit and its expected ownership flow; it does
not authorize shipment before a subsequent exact-head green CI and Pages
closure.
