# Q4 Codex Verification

Last updated: 2026-06-30
Fixed CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19

Purpose: record the Codex-owned part of M0-FREEZE Q4. This is not Fable final approval.

## Current conclusion

Codex verification for Q4 passes.

Fable final approval is now recorded in `m0-freeze-execution-queue.md` and `m0-freeze-decision-record.md`, so Q5 is unblocked. The approval record also says Q5 should start in a new session from S-CHOICE/S-TURN; do not treat this Codex verification artifact alone as authorization to skip the session boundary.

## Evidence

Preflight:

- `node research/cr-grounding/verify-m0-freeze-preflight.mjs`
- Result: pass
- Reported state: Q1 docs contract applied; Q1 decision record recorded; Q2 scorecard overlay wiring applied.

Codex audit consistency:

- `node research/cr-grounding/verify-q4-codex-audit.mjs`
- Result: pass
- Checks Q1 docs contract verifier, Q2 scorecard output verifier, source overlay vs embedded scorecard overlay, total `frozen` equation, scorecard Markdown sections, status preservation, and required docs anchors.
- Reports Fable final approval separately. Current result: recorded.

Q2/Q3 scorecard output:

- `node research/cr-grounding/verify-q2-scorecard-output.mjs`
- Result: pass
- `research/m-contract-gate/scorecard.json` contains `legacyFrozen`, `crGroundingOverlay`, `crGroundingOverlayApproved`, `crGroundingOverlayProblems`, and total `frozen`.
- `research/m-contract-gate/scorecard.md` displays `CR-grounding Overlay`, `R-FREEZE Designs`, `PARTIAL`, `PASS(core)`, `PASS(boundary)`, and remaining boundaries.

Targeted review:

- `npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot`
- Result: 3 files passed, 45 tests passed.

Machine checks:

- `npm run lint`: pass
- `npx tsc --noEmit`: pass
- `npx vitest run`: 280 files passed, 3020 tests passed
- `npm run build`: pass

## Stop-condition check

- `docs/engine-spec.md` includes the overlay input, status vocabulary, `remainingBoundary` requirement, and `frozen = legacyFrozen && crGroundingOverlayApproved`.
- `docs/acceptance.md` includes CRG status rows and the rule that `PARTIAL` / `PASS(core)` / `PASS(boundary)` require remaining boundaries.
- `scripts/m-contract-gate.ts` reads `research/cr-grounding/m0-freeze-overlay.json`.
- `scripts/lib/mContractGate.ts` rejects missing overlay, `FAIL`, unknown treatment, and partial/core/boundary conditions without `remainingBoundary`.
- Scorecard JSON and Markdown preserve `PARTIAL`, `PASS(core)`, and `PASS(boundary)`.
- Final approval record is present. `research/cr-grounding/m0-freeze-execution-queue.md` lists `M0-FREEZE final approval` as approved by Fable.

## Next required owner action

Start Q5 in a new session from S-CHOICE/S-TURN, following `post-freeze-codex-brief.md`.
