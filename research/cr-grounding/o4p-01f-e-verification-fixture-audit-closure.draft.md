# O4P-01F-E: Verification, Fixture & Audit Closure V1

> Implementer/judge closure draft. This file is not a promoted contract or a
> shipped declaration until the independent cold audit, release full check,
> commit, and GitHub Actions gates are recorded.

## Scope

O4P-01F-E closes the composite card runtime slice after O4P-01F-D. It adds a
committed runtime fixture, an executable verifier, and the machine-check step
that runs immediately after Core Identity/Zone verification. The canonical
machine check is now:

1. CR fixed-ruleset verification
2. version-contract verification
3. Solo preservation verification
4. Online-state architecture verification
5. Core Identity/Zone verification
6. Core Card Runtime verification
7. lint
8. test
9. build

The Core architecture boundary allowlist recognizes the runtime verifier as a
judge-owned verification script. A fast-check property test independently
permutes the complete ObjectId set and requires the same canonical JSON output
and frozen result for every permutation.

## Files

- `src/engine/core/fixtures/card-runtime-slice-v1.json`
- `scripts/checks/verify-mode-neutral-core-card-runtime.ts`
- `scripts/checks/machine-checks.mjs`
- `scripts/__tests__/machine-checks.test.mjs`
- `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- `src/engine/core/runtime/__tests__/cardRuntimeProperty.test.ts`
- `package.json` and `tsconfig.node.json` verification wiring

## Closure gates

- committed fixture validates against the committed Identity/Zone fixture;
- validator/factory parity, round-trip, deep freeze, canonical ObjectId order,
  and fail-closed cross-state cases are executable in the verifier;
- independent cold audit returns `AUDIT-OK-PENDING-FULL-CHECK` with
  BLOCKER/HIGH/MEDIUM all zero;
- the exact audited candidate passes `npm run check` and
  `npm run check:forbidden`;
- the resulting main commit's GitHub Actions workflow succeeds.

No version, Identity/Zone shape, effective controller, combat, token/copy,
ability, transition, projection, Online, or UI behavior is added.

## Status

`implemented-not-audited`
