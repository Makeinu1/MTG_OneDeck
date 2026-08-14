# O4P-03D release full-check repair 1

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Owner: Sol Judge bounded surgery

## Trigger

The first substantive fingerprint-matched `npm run check` passed every
registered verifier, docs check, lint, and Core 226 files / 2,086 tests. The
DOM lane then failed only
`src/test/architecture/modeNeutralCoreBoundary.test.ts` because the new
production-evidence verifier imports the frozen mode-neutral Core fixture and
API from `scripts/online/o4p-03d-evidence.ts`, while the architecture test's
explicit verification-script allowlist did not yet identify that harness as a
verification-only consumer. DOM completed at 284 passed files / 1 failed file
and 2,007 passed tests / 1 failed test; build was skipped by the fail-closed
runner.

The earlier sandbox `tsx` `listen EPERM` was a non-execution. The identical
command was rerun in the allowed local environment before the substantive
result above.

## Frozen repair

The only semantic repair is one explicit allowlist entry in
`src/test/architecture/modeNeutralCoreBoundary.test.ts`:

- `scripts/online/o4p-03d-evidence.ts`

No production, harness, Judge `review.*`, contract, configuration, dependency,
workflow, or lower-layer source is changed by this repair. The allowlist
remains exact-path and does not broaden directory or pattern authority.

## Targeted evidence

- repaired architecture file: 1 file / 10 tests PASS;
- O4P-03D registered verifier: PASS;
- scoped ESLint: PASS;
- `git diff --check`: PASS.

## Gate

The independent cold auditor must confirm this repair closes the exact full-
check failure without weakening the boundary or altering the previously
audited candidate. BLOCKER/HIGH must remain zero. After metadata confirmation,
only the governance-maximum second/final fingerprint-matched `npm run check`
may run. Cloudflare deployment remains prohibited until that final check
passes unchanged.
