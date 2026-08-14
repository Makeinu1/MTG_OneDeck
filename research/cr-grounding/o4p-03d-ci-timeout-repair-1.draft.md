# O4P-03D CI timeout repair 1

Date: 2026-08-14
Owner: Sol judge/orchestrator
Candidate head: `9ea1adde18058c02236b9b7f8e9edeb88ef2ca79`
Failed Actions run: `31769101186`

## Failure

The exact-head run passed every registered verifier, including O4P-03D, and
passed lint. Core passed 226 files / 2,086 tests. DOM passed 284 of 285 files
and 2,004 tests; the only failures were timeouts in three real-SQLite Judge
tests in
`src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts`:

- checkpoint 64 / replay-cap rejection: default 5 seconds;
- presence/reconnect/all-disconnected replay: explicit 15 seconds;
- checkpoint-CAS rollback: default 5 seconds.

The run reported no assertion mismatch. The remaining test, build, forbidden,
and Pages lanes were skipped after the timeout-only failure.

## Authorized repair

Set only those three per-test timeout arguments to `30_000` milliseconds and
refresh only the matching frozen Judge-file hash in the O4P-03D verifier to
`97f4cd8962556a9e5f7cff443ea3ed8b15830ade5f39be560881080a8ab9760b`.

Do not change test bodies, assertions, fixtures, production source,
configuration, dependencies, workflow, Cloudflare resources, or any other
frozen hash. The timeout is a CI resource-contention allowance, not a semantic
acceptance condition.

## Verification and gates

- run the exact Judge file on the current local Node and Node 22 environments;
- run the O4P-03D verifier, scoped ESLint/TypeScript, and `git diff --check`;
- independently cold-audit exact diff and non-weakening before commit/push;
- do not run a third local `npm run check`;
- exact-head CI remains responsible for the complete check, forbidden scan,
  build, and Pages evidence.
