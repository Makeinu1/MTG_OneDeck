# O4P-04B full-check repair 1

Milestone: `O4P-04B`

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Owner: Sol Judge

## Trigger

The fingerprint-matched release `npm run check` passed every verifier, docs,
lint, and Core 226 files / 2,086 tests. DOM passed 288 of 293 files and 2,046 of
2,051 tests; exactly five older architecture tests rejected the additive
`src/online/tableDisplay` directory or the exact
`TableDisplay.tsx` -> `online/tableDisplay/index.ts` public import. No O4P-04B
model, component, ordinary test, or Judge acceptance test failed.

## Authorized bounded repair

The Judge may change only:

1. the fixed Online-root enumerations in
   `o4p01iStackAnnouncementBoundary.test.ts`,
   `review.o4p-02d-audience-projection-boundary.test.ts`, and
   `review.o4p-02e-local-room-gate-boundary.test.ts` to include exactly
   `tableDisplay`;
2. the existing exact Personal Workbench public-import carve-outs in
   `review.o4p-01h-core-boundary.test.ts` and `soloOnlineBoundary.test.ts` to
   also allow exactly
   `src/components/online/TableDisplay.tsx` ->
   `src/online/tableDisplay/index.ts`;
3. O4P-04B architecture scope evidence, this repair record, audit record, and
   in-place O4P-04B ledger metadata needed to prove the repair.

No other component, source, test assertion, import direction, Online module,
App/root entry, dependency, config, version, cache schema, workflow, contract
clause, or deferred O4P-04C behavior may change. All existing negative probes
must remain active. Run the five repaired architecture files together with the
four O4P-04B targeted files, then obtain independent focused re-audit before a
final release full-check rerun.
