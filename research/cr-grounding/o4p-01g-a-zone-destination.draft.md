# O4P-01G-A Zone Destination & Placement Contract V1

Status: `implemented-not-integrated`

Base: `ca4abbffb6e4c6dcc49925c744190984aab2cf40`

## Grounding

- `src/engine/core/ids.ts` is the existing Core ID authority. Player IDs use
  `isCoreBaseId`, so this slice does not introduce a second player-ID grammar.
- `CorePhysicalCardV1.ownerPlayerId` in `src/engine/core/cardDefinition.ts`
  supplies the owner for `owner-library`, `owner-hand`, and `owner-graveyard`.
  These destination values intentionally carry no player field.
- Existing Core validators establish descriptor-based input reading, sorted
  issue reporting, and frozen canonical success values. This slice follows
  those conventions without changing the existing Identity, Zone, or Runtime
  slices.

## Contract

`CoreLibraryPlacementV1` is exactly `top`, `bottom`, or `index` with a
non-negative safe integer. Library length checking is outside this value
object's responsibility.

`CoreCardZoneDestinationV1` is exactly the seven destination branches:

- `owner-library` with a placement;
- `owner-hand`;
- `owner-graveyard`;
- `battlefield` with `baseControllerPlayerId`;
- `stack` with `baseControllerPlayerId`;
- `exile`;
- `command`.

Owner-scoped destinations derive their player from the PhysicalCard owner.
Only battlefield and stack carry a base controller. No source-zone field or
same-zone reorder operation is represented.

Validation accepts only strict plain-object input, rejects accessors,
non-enumerable fields, symbols, unknown branch fields, and invalid IDs or
indices. Issues are sorted by path and then code. Successful values are fresh,
deeply frozen, and emitted in fixed field order. The factory delegates solely
to the validator and throws `CoreZoneDestinationCreationError` for invalid
input.

## Scope boundary

Implemented files:

- `src/engine/core/transition/zoneDestination.ts`
- `src/engine/core/transition/__tests__/zoneDestination.test.ts`

This draft is not judge-integrated: no state, command, existing slice, public
barrel export, fixture, package file, or script was changed. No claim is made
that a transition or state update is implemented.
