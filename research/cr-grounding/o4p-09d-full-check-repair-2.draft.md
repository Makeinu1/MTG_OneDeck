# O4P-09D Full-Check Repair 2

Date: 2026-08-26
Semantic base SHA: `d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2`
Previously accepted successor fingerprint:
`c0d9c66d9799d74adb78b3b612feab6aa7d62a55002899fc02621cf7674eb4a3`
Owner: Judge

## Trigger

The final local release `npm run check` passed every static verifier, docs,
O4P-05C/O4P-05D, and lint. Core Vitest then passed 227 files and 2111 tests;
the sole failure was the normal O4P-09D boundary test
`bounds note and manual-stack collections atomically at the final allowed item`,
which completed its work in 31.325 seconds and hit its explicit 30-second
timeout. No assertion or product behavior failed.

## Bounded deterministic repair

1. Change only that test's explicit timeout from `30_000` to `60_000` in
   `src/engine/core/tabletop/__tests__/tabletopCommandsV1.test.ts`.
2. Preserve the complete test body, both 128-item loops, all acceptance and
   atomic-overflow assertions, production bytes, configs, and dependencies.
3. Preserve every other timeout and test.

The exact focused test passed in 25.05 seconds after the change; scoped ESLint
and `git diff --check` passed. This is correction wave 2, the final permitted
wave. No further local release full check is permitted; exact-head CI owns the
remaining canonical `npm run check` evidence.

## Required evidence

- A fresh-context cold audit independently confirms the one-literal delta,
  unchanged test semantics, and BLOCKER/HIGH 0.
- The focused test, scoped ESLint, docs/ledger consistency, release preflight,
  and exact candidate fingerprint remain green.
- Exact-head CI passes the canonical full check, ownership gate, build, and
  Pages deploy before terminal shipment.
