# O4P-09E Full-Check Repair 2

Date: 2026-08-27
Derived candidate base SHA: `cb686d93ff6e05a10e95a7f55799112480d3b2cb`
Predecessor candidate: O4P-09E full-check repair 1
Owner: Judge

## Repair-required trigger

The predecessor candidate exhausted its two functional release full-check
invocations. The first exposed and repaired historical guard impact. The final
invocation passed every verifier, docs, and lint gate, then its Core project
reported 228/229 files and 2118/2119 tests passed before one unchanged test hit
the default 5-second timeout at 5.168 seconds. It emitted no assertion failure.

The exact failed file immediately passed alone: 1 file, 5 tests, 187 ms test
time. Product, rule, acceptance, and manifest bytes remained unchanged. Per the
candidate-counter policy, the exhausted predecessor receives no third full
check. This derived candidate retains cumulative usage and the same acceptance
and release authority.

## Bounded correction

1. Add only `{ timeout: 15000 }` to the existing test
   `rejects pending triggers at priority and resolution-ready public boundaries`
   in
   `src/engine/core/turn/__tests__/turnPriorityBundleValidationV1.test.ts`.
2. Do not change the test body, assertions, fixture, production implementation,
   test runner defaults, dependency, contract, or acceptance meaning.
3. Add only these two repair records and that exact test path to the explicit,
   wildcard-free O4P-09E successor set in the historical O4P-09C guard.

The 15-second ceiling is local to one deterministic boundary test. It is not a
global timeout increase and does not turn a hang into a pass.

## Required evidence

- The exact test passes alone and the complete Core project reruns from the
  beginning with all 229 files / 2119 tests passing.
- The O4P-09C historical guard and complete architecture suite pass.
- `npm run check:docs`, affected ESLint, and `git diff --check` pass.
- The existing independent cold-auditor lineage reports BLOCKER/HIGH 0 on the
  exact derived-candidate fingerprint.
- Only after that audit, this derived candidate may consume its one normal
  canonical `npm run check`; cumulative predecessor counts remain recorded and
  are not presented as reset telemetry.

## Targeted evidence

- Exact file: 1/1 file, 5/5 tests PASS; 216 ms test time.
- Complete Core project: 229/229 files, 2119/2119 tests PASS; 142.69 seconds.
- Complete architecture suite: 52/52 files, 233/233 tests PASS; 102.17 seconds.
- `check:docs`, affected ESLint, and `git diff --check`: PASS.

## Exact-head CI ownership stop and Judge reauthorization

- Actions run: `33087655508`
- Build job: `98571631262`
- Diff base: `b8f851794ce8051811093093adc8b22196f3d4c2`
- Exact head: `f9f1f961b318a0498691b454d1d4d9592cb461d7`
- Exact-head `npm run check`: PASS
- Sole stop: `npm run check:forbidden -- --diff b8f851794ce8051811093093adc8b22196f3d4c2`
- Pages: skipped because ownership stopped the build job

The Judge reowns exactly the following already audited bytes under the user's
2026-08-27 end-to-end release authority. No wildcard or unstated path is
authorized.

### NEEDS-REAUTH (12)

- `docs/contracts/manifest.json`
- `docs/generated/engine-api.md`
- `research/cr-grounding/cr-backbone-ledger.json`
- `research/cr-grounding/o4p-09e-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-09e-browser-evidence.draft.md`
- `research/cr-grounding/o4p-09e-cold-audit-brief.draft.md`
- `research/cr-grounding/o4p-09e-full-check-repair-1-cold-audit-brief.draft.md`
- `research/cr-grounding/o4p-09e-full-check-repair-1.draft.md`
- `research/cr-grounding/o4p-09e-full-check-repair-2-cold-audit-brief.draft.md`
- `research/cr-grounding/o4p-09e-full-check-repair-2.draft.md`
- `research/cr-grounding/o4p-09e-implementation-brief.draft.md`
- `research/cr-grounding/o4p-09e-repair-record.draft.md`

### FORBIDDEN / Judge-owned (29)

- `research/cr-grounding/o4p-09e-visibility-decisions.contract.draft.md`
- `src/engine/core/closure/__tests__/commandV1.test.ts`
- `src/engine/core/closure/applyCommandV1.ts`
- `src/engine/core/closure/commandV1.ts`
- `src/engine/core/closure/domainEventV1.ts`
- `src/engine/core/rules/__tests__/searchSessionV1.test.ts`
- `src/engine/core/rules/__tests__/visibilityGrantOperationsV1.test.ts`
- `src/engine/core/rules/index.ts`
- `src/engine/core/rules/ruleDurationV1.ts`
- `src/engine/core/rules/searchSessionOperationsV1.ts`
- `src/engine/core/rules/visibilityGrantOperationsV1.ts`
- `src/engine/core/rules/visibilityGrantV1.ts`
- `src/engine/core/tabletop/operationsV1.ts`
- `src/engine/core/turn/__tests__/turnPriorityBundleValidationV1.test.ts`
- `src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts`
- `src/online/projection/__tests__/review.o4p-02d-audience-projection.test.ts`
- `src/test/architecture/review.gov-codex-57-autonomy-player-journey.test.ts`
- `src/test/architecture/review.o4p-01h-core-boundary.test.ts`
- `src/test/architecture/review.o4p-01l-rule-authority-boundary.test.ts`
- `src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts`
- `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts`
- `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts`
- `src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts`
- `src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts`
- `src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts`
- `src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts`
- `src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts`
- `src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts`
- `src/test/architecture/review.o4p-09e-visibility-decisions.test.ts`

This reauthorization derives only from the product/evidence audit, repair 1
bytes audit, manifest-reanchor audit, repair 2 audit, local canonical full-check
PASS, and exact-head CI full-check PASS already recorded for these immutable
bytes. The replacement commit changes only this record and its audit addendum.
