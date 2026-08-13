# O4P-03C CI Node 22 SQLite compatibility repair audit brief

Milestone: `O4P-03C`

Base candidate commit: `4cd1a351c29baff1714a55c959acf5d7b5485a70`

Failed exact-head Actions run: `31750144276`

Read only this brief, the two changed files, the failed CI evidence named
below, and the already-authorized O4P-03C contract/audit record as needed. Do
not edit files, deploy Cloudflare, or run the release `npm run check`.

## Detected failure

The first candidate Actions run passed all registered verifiers, docs, lint,
Core 226 files / 2,086 tests, and 281 of 282 DOM files. The remaining Judge
file did not execute on the workflow's Node 22 runtime because Vite could not
bundle the static value import of `node:sqlite` from
`src/online/cloudflare/__tests__/reviewSqliteStorage.ts`. Build, forbidden scan,
and Pages were consequently skipped. This is a real release-gate defect, not a
test retry or a production security finding.

## Bounded repair

The repair scope is exactly:

- `src/online/cloudflare/__tests__/reviewSqliteStorage.ts`: retain the erased
  `SQLInputValue` type import, but load the runtime `DatabaseSync` export using
  `createRequire(import.meta.url)` from the Node 22-known `node:module`
  built-in;
- `scripts/checks/verify-online-cloudflare-capability-abuse-control.ts`: update
  only the frozen SHA-256 for that helper to
  `138aaabc1aee8152632baf2e978042667801f74cb005c7f0d09f08aeb3db2bd5`.

No production, contract, assertion, fixture, dependency, workflow,
configuration, Cloudflare, Pages, or lower-layer byte changed.

## Targeted evidence

- Node 24 DOM Judge file: 1 file / 11 tests PASS;
- exact Node 22 DOM Judge file: 1 file / 11 tests PASS, including real
  in-memory SQLite execution;
- O4P-03C verifier: PASS;
- scoped ESLint on both changed files: PASS;
- `git diff --check`: PASS.

Confirm that the runtime import no longer reaches Vite's Node 22 static
`node:sqlite` resolver, the type import is erased, the helper still uses the
real Node SQLite implementation and closes all databases, the verifier freezes
the exact helper bytes, and the change cannot affect production behavior or
weaken a Judge assertion. Return findings classified BLOCKER/HIGH/MEDIUM/LOW.
A clean result authorizes post-repair metadata confirmation and the governance
maximum second/final release full check; it does not authorize ship or
Cloudflare deployment.
