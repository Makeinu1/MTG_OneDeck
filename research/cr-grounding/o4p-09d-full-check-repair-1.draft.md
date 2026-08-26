# O4P-09D Full-Check Repair 1

Date: 2026-08-26
Semantic base SHA: `d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2`
Previously accepted successor fingerprint:
`4b3b5ae40e3b149938f10260cf5b4b56d58380fce2adeab98e833b5350696bda`
Owner: Judge

## Trigger

The host-authorized release `npm run check` passed every canonical gate through
the O4P-03D production verifier, then stopped in the O4P-05C release verifier.
O4P-09D had intentionally extended
`scripts/checks/verify-online-cloudflare-runtime-persistence.ts` with the new
`projectionBudgetV1.ts` production file and the audited
`../tabletopManual/index` import, while O4P-05C still pinned the predecessor
verifier bytes. The earlier sandbox-only start stopped before this evidence at
the local `tsx` IPC boundary and made no candidate change.

## Bounded deterministic repair

1. Re-pin only the four current audited O4P-03A through O4P-03D verifier
   hashes in `scripts/checks/verify-o4p-05c-release-gates.ts`:
   `ca8036138bbaf8ef16802501c329bbf2c8a259cc16be6b3a3247f5f7d008a6da`,
   `ea1a3b51c7cb913b1f9d4203c8088da29c0bd3bcff170f923448ac4961570a19`,
   `4a5e7b47de1e5a03a5633a1535103b0912d3b45e0978d5bc9145e4351c0ca1a6`,
   and `b62eaf95d8c3e0f9aa75e37d8c67acc96c00a0bbb2b66aba4f37b1f51d02696d`.
2. Re-pin only the two O4P-09D-changed Cloudflare production file hashes in
   the same O4P-05C verifier: persistence
   `1197ab9d0ea02f9ffe97c2ff4fe9fc06717f1a6ab4b49f0c94b81b3d9a61661d`
   and runtime
   `8dc53bca13b805e3965a74a3b35cfb70f19495fa63da704a1001e46e19e4dcb8`.
3. Re-pin only the resulting O4P-05C verifier hash in
   `scripts/checks/verify-o4p-05d-production-release-closure.ts`:
   `680db98d1346d3d8c2b81a158623e6089bdee8526e48ff978b25371ed7fa7079`.
4. Preserve every other assertion, allowlist/source entry, timeout,
   dependency, ownership rule, release requirement, and product byte.

No source under `src/`, review test, contract meaning, CR authority, public UI,
Worker protocol, or dependency changes in this repair.

## Required evidence

- The O4P-03A through O4P-03D and O4P-05C through O4P-05D executable
  verifiers all pass and remain non-vacuous.
- Affected ESLint and `git diff --check` pass.
- An independent fresh-context cold audit reports BLOCKER/HIGH 0 on the exact
  repaired successor fingerprint.
- The one allowed final `npm run check` passes on exactly those audited bytes
  before the replacement release push.
