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
