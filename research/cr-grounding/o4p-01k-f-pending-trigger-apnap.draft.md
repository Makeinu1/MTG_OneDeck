# O4P-01K-F Pending Trigger and APNAP V1

Status: `implemented-not-integrated`.

Foundation: `FOUNDATION_SHA=038433ad026d62c11cf5118c2c675ba0f6b49738`.
Frozen parent contract: `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`, sections 5 and 7.

## Implemented boundary

This additive Core turn slice implements:

- `ModeNeutralCorePendingTriggerSliceV1` with the exact root fields
  `kind`, `pendingObjectIds`, and `byObject`.
- strict descriptor-safe validation against the O4P-01H/V2 triggered ability
  identity and the O4P-01I triggered announcement record;
- exact pending ID/key parity, detection/append order preservation, deep-frozen
  fresh results, nonmutation, historical source references, and rejection of
  registry/zone collisions;
- append of explicitly keyed committed pending records, preserving caller
  order and failing atomically on malformed records or collisions;
- APNAP order as a rotation of the registry `turnOrder` beginning at
  `activePlayerId`;
- ordinary-bucket then ability-triggered-bucket groups, APNAP controller order,
  and same-controller order preservation;
- `deterministic-order` versus `manual-order-required` analysis; and
- ordered-list validation that requires the complete pending set exactly once,
  permits arbitrary order only within one controller/bucket group, and rejects
  bucket/controller crossings.

## Explicit defer

No stack placement is performed. `placeCorePendingTriggersOnStackV1`, the
turn-priority Full Bundle, lifecycle coordinator, Core index integration,
Solo/Store/UI/Online integration, review tests, machine-check registration,
and package changes remain outside this slice.

## Changed files

- `src/engine/core/turn/pendingTriggerV1.ts`
- `src/engine/core/turn/pendingTriggerValidationV1.ts`
- `src/engine/core/turn/triggerApnapV1.ts`
- `src/engine/core/turn/__tests__/pendingTriggerV1.test.ts`
- `src/engine/core/turn/__tests__/triggerApnapV1.test.ts`
- `src/engine/core/turn/__tests__/triggerApnapPropertyV1.test.ts`

No git operation, index edit, Full Bundle, or protected-file edit was performed.
