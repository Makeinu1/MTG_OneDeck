# cr-400-408 linked-exile substrate implementation draft

Status: implementer-lane draft only. This file summarizes the batch2-5
implementation for judge review; it does not update `docs/`, `review.*`, the
ledger, or git state.

## Implemented

- Added `GameState.linkedExiles: Record<string, LinkedExileRecord>` with the
  design-locked minimal record shape:
  `linkId`, `purpose`, `sourceObjectId`, `sourcePhysicalId`,
  `exiledPhysicalIds`, `exiledObjectIds`, `snapshot`, and `createdSequence`.
- Added `moveCard.linkedExileWrite?` as an optional payload. No new
  `GameCommand` variant was added.
- Linked-exile records are written only from the `ZoneChangeEvent` produced by
  the actual move to exile. The write requires `toZone === 'exile'`, `after`,
  `newObjectId`, and a current card still matching that exile object.
- `temporary-return` records are same-resolution only in this slice: the engine
  writes the record, verifies the recorded exile object is still current in
  exile, returns it to battlefield, sets controller to owner, and deletes the
  record.
- `exiled-with-source` records remain active until consumed. The consume helper
  requires both physical source id and current `objectIdOf(source)` to match the
  record; a source zone change rejects consumption.
- `initGame` initializes `linkedExiles: {}`. `restoreGame` normalizes missing or
  malformed `linkedExiles` to `{}`. `makeDraft` shallow-clones the container.
- Added a same-resolution Thassa-style compiler leaf for:
  `Exile [up to one] target ..., then return that card to the battlefield
[under its owner's control].`
- Added non-review engine and store tests covering substrate writes, source
  incarnation consume rejection, temporary-return guard/consume, legacy snapshot
  backfill, Thassa-style guided resolution, and Path-to-Exile simple no-record.

## CR grounding

- CR 400.7: zone changes create new objects, so both returned object guards and
  source-link consumption use object ids, not physical card ids alone.
- CR 400.7j: the same resolving effect can find the public-zone object it moved,
  which grounds same-resolution exile-then-return handling.
- CR 406.2 and 406.5: records are created only after a real move to exile and
  track exiled cards that need separate return/reference mechanisms.
- CR 406.6 and 607.2a: `exiled-with-source` consumption is limited to cards
  exiled by the linked instruction for that source object.
- CR 603.10a and 608.2h: return uses the current public-zone object only if it
  is still the recorded exile object; otherwise the stored snapshot is LKI for
  warning/no-op, not authority to move a different object.

## Judge-facing unresolved/deferred items

- Skyclave Apparition oracle-text recognition and token sizing remain deferred.
- True delayed future turn/phase return scheduling remains deferred until a
  turn-phase scheduler primitive exists.
- Multi-card links, face-down exile piles, player-specific private zones,
  replacement-origin linked exile, meld/merged, Adventure, foretell, plot, and
  craft remain out of scope.
- The implementation chooses immediate deletion over a `status` field for
  consumed/stale same-resolution records, matching the brief's minimal option.
