# O4P-06B CI Timeout Stabilization

Date: 2026-08-21
Owner: Judge
Base SHA: `d9ca6fca3b82096ffb9c16a520af549495b6edee`
Failed exact-head Actions run: `32401127773`

## Failure

The exact-head CI full check passed every verifier and reached the DOM suite,
then the first O4P-06B Judge review case exceeded its explicit `60_000` ms
timeout on the slower GitHub runner. The same complete case passed locally in
the final full check. No assertion, product, build, or earlier gate failed.

## Allowed change

In
`src/online/headless/__tests__/review.o4p-06b-playable-table-command-surface.test.ts`,
change only the first review case timeout from `60_000` to `120_000`.

The test body, assertions, real-deck inputs, Protocol/Core paths, replay,
projection, secrecy checks, other test timeouts, product source, generated API,
contracts, manifest, package/lock/config/workflow, dependencies, versions, and
ledger must remain byte-identical.

## Verification

Run the single review file, targeted ESLint, `npx tsc -b`, and
`git diff --check`. Confirm the test file diff is exactly one numeric timeout
line and record elapsed time. Do not run `npm run check`, mutate git, use the
network, or change any other file. Freeze for independent cold reauthorization
before commit and push.
