# O4P-05C Judge-owned acceptance brief

Milestone: `O4P-05C`

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Contract: `research/cr-grounding/o4p-05c-release-gates.contract.draft.md`

Risk / audit lane: `R3 / BROAD`

## Implementer-owned ordinary evidence

The Qwen implementer may edit only these exact files, one bounded packet at a
time:

1. `src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts`;
2. `src/online/cloudflare/__tests__/releaseGateEvidenceV1.test.ts`.

It must implement the contract's strict test-only validator and ordinary red/
green evidence. It must not edit any `review.*`, production source, barrel,
script, package, docs/research, ledger, loop state, config, dependency, git, or
deployment path. It must not run `npm run check`.

## Judge-owned acceptance

1. The exact seven gate order, authority mapping, thresholds, and local ruleset
   id pass once on a common semantic fingerprint.
2. Each gate fact and each common-fingerprint correlation fails independently
   when drifted.
3. Missing, extra, reordered, duplicated, unknown-key, accessor, symbol,
   sparse-array, cyclic, and aliased inputs fail closed with deterministic
   complete issues.
4. Inputs remain byte/descriptor-identical; success and failure outputs are
   fresh and deeply frozen; no sort/trim/deduplicate/merge/coercion occurs.
5. Current O4P-03C privacy/security/leakage and O4P-03D recovery/load/
   observability/long-room Judge and ordinary evidence all pass.
6. Current O4P-03A/B/C/D registered verifiers pass and the O4P-05C verifier
   binds their exact successor authority.
7. No production Cloudflare/configuration/evidence-harness semantic drift is
   hidden behind the aggregate; any drift blocks historical-evidence reuse.
8. The aggregator remains test-only: no barrel export, production import,
   network/storage/environment/random/clock/DOM access, dependency, version,
   runtime, UI, or CR-pin drift.
9. O4P-05C is registered exactly once after the O4P-03D verifier and before
   lint, with no weakening of the existing machine-check sequence.
10. Independent cold audit returns BLOCKER/HIGH zero at the frozen candidate,
    the same fingerprint passes one release full check, and exact-head CI/
    forbidden/build/Pages plus served assets and clean worktree are green.

## Targeted commands

```text
npx vitest run --project dom \
  src/online/cloudflare/__tests__/releaseGateEvidenceV1.test.ts \
  src/online/cloudflare/__tests__/review.o4p-05c-release-gates.test.ts \
  src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts \
  src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts \
  src/online/cloudflare/__tests__/evidenceHarnessV1.test.ts \
  src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts \
  src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts \
  src/test/architecture/review.o4p-05c-release-gates.test.ts
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run check:forbidden
git diff --check
```

The release full check is reserved until the independent matching cold audit
returns BLOCKER/HIGH zero.
