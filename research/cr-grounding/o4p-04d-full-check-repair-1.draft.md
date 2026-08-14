# O4P-04D full-check repair 1

Milestone: `O4P-04D`

Owner: Sol Judge

Auditor: `/root/o4p04d_cold_auditor`

## Trigger

The first formal release `npm run check` passed all verifiers, docs, lint, and
Core 226 files / 2,086 tests. In the DOM lane, 299 of 300 files and 2,079 of
2,080 tests passed. The existing O4P-03D recovery replay test then completed
its assertions in approximately 33.2 seconds and exceeded its explicit
30-second execution budget. The failure was a timeout under full-suite load,
not an assertion failure or an O4P-04D runtime defect.

An earlier sandbox-only attempt stopped at the second verifier because `tsx`
could not create its temporary IPC socket. It exercised no candidate tests and
is recorded as an environment invocation failure, not a release check result.

## Bounded Judge repair

Change only the failing Judge-owned test's timeout from 30 to 60 seconds. Keep
its body and every assertion byte unchanged. Register that exact predecessor
review path in the three existing O4P-04B/C/D candidate-path gates; do not use a
directory or wildcard broadening beyond the exact filename.

Do not change runtime, ordinary tests, contracts, Projection, Core, protocol,
Room, Cloudflare production behavior, dependencies, config, version, or DEFERs.

Run the complete O4P-03D review file, the complete 14-file O4P-04D combined
set, scoped ESLint, `npx tsc -b`, `npm run check:docs`, and `git diff --check`.
Freeze the repaired release tree and obtain independent re-audit before the
second and final local `npm run check`.
