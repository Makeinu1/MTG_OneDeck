# O4P-01K-I Boundary Coordinator V1

Status: implemented-not-integrated. Implementer lane only.

Base: `e0bc038bc9e4c2fcdea6a611ccc72b8fe69fb7a2`
Contract: `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`

## Goal

Add the CoreTurnPriorityBundleV1 coordinator boundary around the existing
O4P-01F/G/H slices and O4P-01J stack transaction APIs. Preserve the component
contracts, make the bundle strict/canonical/deeply frozen and non-mutating, and
implement only the SBA fixed-point and committed-trigger placement boundaries.

## Allowed implementation files

- `src/engine/core/turn/turnPriorityBundleV1.ts`
- `src/engine/core/turn/turnPriorityBundleValidationV1.ts`
- `src/engine/core/turn/sbaTriggerBoundaryV1.ts`
- `src/engine/core/turn/triggerPlacementV1.ts`
- the five named normal/property coordinator tests
- this draft brief

No index integration, git operation, ledger/docs/AGENTS/package/review/machine-
check changes, O4P-01G/H/I/J changes, Solo, Store, UI, or Online changes.

## Acceptance boundary

- Bundle field order is `stackBundle`, `pendingTriggers`, `lifecycle`.
- Validation order is Stack, Pending against the validated Registry, then
  Lifecycle against Registry/Stack/Pending.
- Factory and validator are strict, input-preserving, canonical,
  JSON-round-trip safe, and deeply frozen.
- `recordCoreSbaCheckOutcomeV1` follows the four fixed-point branches in the
  frozen contract, including cleanup false-flag elevation.
- Trigger placement validates the exact APNAP/group order, commits each
  object+announcement sequentially through
  `commitCoreSyntheticStackObjectV1`, is atomic on failure, clears pending only
  after success, and returns to SBA with the original recipient.
- Concrete SBA conditions, detection, resolution, combat, legality,
  Command/Event, Online, UI, and Solo remain deferred.

## Verification

Targeted coordinator tests, strict eslint for every changed file, `npm run
build`, `npm run check:forbidden`, and `git diff --check` are required. This
lane does not commit, integrate exports, run a cold audit, or claim shipped.
