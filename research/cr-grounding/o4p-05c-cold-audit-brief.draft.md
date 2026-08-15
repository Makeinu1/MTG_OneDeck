# O4P-05C cold-audit brief

Milestone: `O4P-05C`

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Profile: `BROAD` (R3 security/privacy/release claim)

First read `.claude/audit-standing.md` and follow it exactly. You are a fresh
independent findings-only auditor. Do not edit any file, do not run the release
full check, do not use network/Cloudflare/GitHub, and do not delegate.

Authority:

- `research/cr-grounding/o4p-05c-release-gates.contract.draft.md`;
- `research/cr-grounding/o4p-05c-acceptance-brief.draft.md`;
- the candidate semantic/context fingerprints supplied in the delegation
  message.

Audit the frozen candidate for these claims:

1. the exact seven gates are closed on one fingerprint and the repository-local
   `mtg-cr-2026-06-19` pin;
2. every metric, order, authority, outcome, and fingerprint drift fails closed;
3. missing/extra/accessor/symbol/sparse/cycle/alias input cannot fake green;
4. success/failure results are fresh, complete, deterministic, deeply frozen,
   and input is not mutated, normalized, sorted, trimmed, deduplicated, merged,
   or coerced;
5. O4P-03C privacy/security/leakage and O4P-03D recovery/load/observability/
   long-room executable evidence and frozen production bytes are genuinely
   bound, not merely copied pass booleans;
6. no production/barrel import, Cloudflare/config/version/dependency/Core/UI/CR
   drift, deployment, network, secret, or 24-hour-soak overclaim exists;
7. the new verifier is registered exactly once after O4P-03D and before lint,
   cannot pass after predecessor/helper/review/production evidence drift, and
   does not weaken the old sequence; and
8. the Qwen zero-write failure and bounded Judge ownership are accurately
   recorded.

Run at minimum:

```text
npm run check:forbidden
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npx vitest run --project dom \
  src/online/cloudflare/__tests__/releaseGateEvidenceV1.test.ts \
  src/online/cloudflare/__tests__/review.o4p-05c-release-gates.test.ts \
  src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts \
  src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts \
  src/online/cloudflare/__tests__/evidenceHarnessV1.test.ts \
  src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts \
  src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts \
  src/test/architecture/review.o4p-05c-release-gates.test.ts
npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs
git diff --check
```

Temporarily break and restore at least the validator threshold/correlation,
one predecessor or production frozen hash, and the test-only import boundary.
Confirm byte-identical restoration with `git diff` and the supplied
fingerprints.

Return concise findings with severity and reachability, actual command output,
weakening/scope/vacuity conclusions, before/after fingerprints, and totals.
Only BLOCKER 0 / HIGH 0 may return `AUDIT-OK-PENDING-FULL-CHECK`.
