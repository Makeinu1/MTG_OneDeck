# O4P-01G-B: Card Reincarnation & Runtime Reset Contract V1

> Implementer draft for the isolated O4P-01G-B pure-function slice. This is
> not a promoted contract, cold-audit record, integration declaration, or
> shipped feature declaration.

## Scope

`src/engine/core/transition/cardReincarnation.ts` provides the deterministic
incarnation/object-ID step used when a physical card becomes a new object,
plus the standard card-runtime reset value after a zone change. It does not
update Identity/Zone state, zones, object tables, commands, events, stores,
projections, persistence, or UI.

The incarnation helper accepts unknown input and permits only non-negative
safe integers. `Number.MAX_SAFE_INTEGER` is a valid current value but cannot
be advanced; it reports `INCARNATION_OVERFLOW`. Object-ID creation delegates
physical-card validation to the existing `isCoreBaseId`, advances through
`nextCoreCardIncarnationV1`, and formats through the existing
`coreCardObjectIdOf`. It does not trim, repair, or duplicate ID syntax.

## Runtime reset shape

`createDefaultCoreCardRuntimeAfterZoneChangeV1()` allocates a fresh frozen
`CoreCardObjectRuntimeStateV1` through the existing O4P-01F value-object
factories:

- orientation: `faceIndex: 0`, `faceDown: false`, `tapped: false`,
  `flipped: false`, `phasedOut: false`;
- counter/damage: `counters: []`, `markedDamage: 0`;
- attachment: `attachedTo: null`.

The root, orientation, counter/damage object and counters array, and
attachment object are frozen. No prior runtime value is accepted or carried
forward. `isDefaultCoreCardRuntimeAfterZoneChangeV1` strictly validates the
root and each existing value object, rejects missing/unknown/accessor/invalid
fields, and performs explicit structural comparison without relying only on
JSON serialization. It never mutates its input.

## Error vocabulary

The exact `CoreCardReincarnationErrorCode` union is:

`INVALID_PHYSICAL_CARD_ID`, `INVALID_CURRENT_INCARNATION`,
`INCARNATION_OVERFLOW`.

Failures throw `CoreCardReincarnationError` with the corresponding `code`.

## CR grounding

The model boundary is grounded in the pinned local Comprehensive Rules
`rule/Magic_The_Gathering_Comprehensive_Rules.txt` (SHA verified by the
repository check):

- CR 400.7: an object moving from one zone to another becomes a new object
  with no memory of, or relation to, its previous existence. The numeric
  incarnation is this engine's deterministic identity representation of that
  new-object step; CR 400.7 does not prescribe the numeric encoding.
- CR 122.2: counters on an object are not retained when it moves between
  zones. Resetting counters and marked damage to empty/zero is the bounded
  runtime consequence represented here.

The reset also clears orientation and attachment state as this slice's
standard engine policy for a newly represented object. Card-specific effects,
exceptions, replacement effects, and all zone legality remain outside this
pure reset helper.

## Verification and boundaries

The ordinary test file contains 19 tests covering exact errors, input
boundaries, delegation, deterministic allocation, strict structural
validation, all reset fields, freeze depth, altered tap/counter/damage/
attachment values, unknown/missing/accessor fields, nonmutation, and absence
of random/time/network/explicit-`any` dependencies.

Protected existing Identity/Zone, Runtime, fixture, package, script, version,
index, documentation, and review-owned files remain unchanged. No new
dependency is introduced.

## DEFER

- Applying a zone transition or changing Identity/Zone state
- Allocating/updating object tables and zone membership
- Trigger/event/command generation and undo/redo integration
- Replacement effects and CR exceptions to the new-object rule
- Card-specific counter, sticker, attachment, copy, commander, and
  characteristic-preservation behavior
- Barrel exports, runtime-slice integration, persistence, protocol, UI,
  independent cold audit, and release publication

## Status

`implemented-not-integrated`
