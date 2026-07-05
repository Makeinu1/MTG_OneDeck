# cr-400-408 linked exile / LKI design-lock draft

Status: implementer-lane draft only. No code, `docs/`, `review.*`,
`CLAUDE.md`, `AGENTS.md`, ledger, or git changes are made by this draft.

Promotion target: a future `engine-spec` §34 design-lock section, following the
same spec-first shape as §34.17 S-ZONES and §34.19 activation envelope. This
draft freezes the linked-exile substrate before the implementation slice. The
CR authority is `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to
2026-06-19.

## 1. Contract Summary

- Linked exile is not generic exile. A plain "exile target creature" effect is
  still a normal zone move into exile and must not create a linked-exile record
  unless a later instruction or linked ability needs to refer to that exiled
  object. Grounding: CR 406.1, CR 406.2, CR 406.5, CR 406.6, CR 607.2a.

- A linked-exile record is a state record for exiled cards that may return later
  or be referred to by abilities of the object/effect that exiled them. The
  record exists because CR requires separate tracking for exiled cards with
  distinct return/use mechanisms and for "exiled with [this object]" links.
  Grounding: CR 406.5, CR 406.6, CR 607.2a, CR 607.2b.

- The record must be built from the authoritative `ZoneChangeEvent` produced by
  the actual move into exile, not from a precomputed target selection, because
  zone movement creates a new object and the before/after object ids and LKI
  snapshots are already single-sourced there. Grounding: CR 400.7, CR 400.7j,
  CR 406.2, CR 608.2h.

- `purpose: 'temporary-return'` covers blink-style effects that exile an object
  only so a same-resolution or delayed return can find exactly that exiled
  object. Grounding: CR 400.7j, CR 406.1, CR 406.5, CR 603.10a, CR 608.2h.

- `purpose: 'exiled-with-source'` covers linked abilities printed on the same
  object where one ability exiles cards and another refers to "the exiled cards"
  or cards "exiled with [this object]." Grounding: CR 406.6, CR 607.2a,
  CR 607.2b.

## 2. Existing Substrate This Draft Relies On

- `CardInstance.id` is the physical card id and `CardInstance.zoneChangeCounter`
  feeds `objectIdOf(card)`, so a single physical card has distinct object
  incarnations across zone changes. Grounding: CR 400.7.

- `ObjectSnapshot` already stores `physicalCardId`, `objectId`, `defId`, `zone`,
  `ownerId`, optional `controllerId`, face/tap/counter state, and type/power/
  toughness information. Linked exile should reuse that shape for LKI rather
  than invent a second snapshot form. Grounding: CR 400.7, CR 603.10a,
  CR 608.2h.

- `ZoneChangeEvent` already stores `eventId`, `sequence`, `reason`,
  `physicalCardId`, `oldObjectId`, optional `newObjectId`, `fromZone`,
  optional `toZone`, and `before`/`after` snapshots. Linked exile must copy the
  exiled card data from this event after a successful move to exile. Grounding:
  CR 400.7, CR 400.7j, CR 406.2, CR 608.2h.

- `PendingTrigger` already stores `sourceId`, `sourceObjectId`, `sourceSnapshot`,
  `controllerId`, and `eventId`; delayed linked-exile returns should reuse this
  trigger placement path instead of adding a second pending-trigger queue.
  Grounding: CR 603.10a, CR 608.2h.

## 3. Concrete Type Contract

Recommended state addition: add `linkedExile` to `GameState` as a
`Record<LinkedExileId, LinkedExileRecord>`, not an array. The record form gives
deterministic lookup by link id and avoids order-sensitive semantics; any UI
iteration must sort by `createdAtEventSequence` and then `linkedExileId`.
Grounding: CR 406.5, CR 406.6, CR 607.2a.

Suggested TypeScript definitions for `src/engine/types.ts`:

```ts
export type LinkedExilePurpose = 'temporary-return' | 'exiled-with-source';

export type EffectLinkId = string;
export type LinkedExileId = string;

export type LinkedExileStatus = 'active' | 'consumed' | 'stale-noop';

export interface LinkedExileSourceRef {
  physicalCardId: PhysicalCardId;
  objectId: ObjectId;
  snapshot: ObjectSnapshot;
  abilityLineIndex?: number;
}

export interface LinkedExileZoneChangeRef {
  zoneChangeEventId: ZoneChangeEvent['eventId'];
  zoneChangeEventSequence: ZoneChangeEvent['sequence'];
  physicalCardId: PhysicalCardId;
  oldObjectId: ObjectId;
  newObjectId: ObjectId;
  fromZone: ZoneChangeEvent['fromZone'];
  toZone: 'exile';
  before: ObjectSnapshot;
  after: ObjectSnapshot;
}

export type LinkedExileReturnSpec =
  | {
      kind: 'same-resolution';
      controllerId?: PlayerId;
    }
  | {
      kind: 'delayed-trigger';
      triggerId: 'trigger.delayed-linked-exile-return';
      duePhase: 'end';
      dueTurn: number;
      controllerId?: PlayerId;
    };

export interface LinkedExileRecordBase {
  linkedExileId: LinkedExileId;
  effectLinkId: EffectLinkId;
  source: LinkedExileSourceRef;
  exiledObjects: LinkedExileZoneChangeRef[];
  createdAtEventId: ZoneChangeEvent['eventId'];
  createdAtEventSequence: ZoneChangeEvent['sequence'];
  status: LinkedExileStatus;
  consumedBy?: {
    commandType: 'returnLinkedExile' | 'consumeLinkedExileRecord';
    reason:
      | 'returned'
      | 'exiled-with-source-resolved'
      | 'stale-noop'
      | 'manual-cleared';
    eventId?: string;
  };
}

export interface TemporaryReturnLinkedExileRecord extends LinkedExileRecordBase {
  purpose: 'temporary-return';
  returnSpec: LinkedExileReturnSpec;
}

export interface ExiledWithSourceLinkedExileRecord extends LinkedExileRecordBase {
  purpose: 'exiled-with-source';
  returnSpec?: never;
}

export type LinkedExileRecord =
  | TemporaryReturnLinkedExileRecord
  | ExiledWithSourceLinkedExileRecord;

export interface PendingLinkedExilePayload {
  kind: 'linked-exile-return';
  linkedExileId: LinkedExileId;
  controllerId?: PlayerId;
}

// Optional additions to existing transport objects.
export interface PendingTrigger {
  linkedExilePayload?: PendingLinkedExilePayload;
}

export interface CardInstance {
  linkedExilePayload?: PendingLinkedExilePayload;
}

export interface GameState {
  // Existing fields omitted.
  linkedExile: Record<LinkedExileId, LinkedExileRecord>;
}
```

Field requirements:

- `linkedExileId` is the primary key in `GameState.linkedExile`; it must be
  supplied by the command payload and must be deterministic for the resolving
  effect instance, for example `${stackObjectId}:line:${abilityLineIndex}:exile:${slotId}`.
  Grounding: CR 406.5, CR 406.6, CR 607.2a.

- `effectLinkId` groups records created by the same effect/ability resolution
  instruction; in this slice it will normally equal `linkedExileId`, but the
  separate field leaves room for future multi-card "the exiled cards" support.
  Grounding: CR 406.6, CR 607.2a.

- `source.physicalCardId`, `source.objectId`, and `source.snapshot` identify the
  source object incarnation that created the link or whose printed linked
  ability owns it. The source identity is not recomputed from current
  `state.cards[source.physicalCardId]` when the link is consumed. Grounding:
  CR 400.7, CR 406.6, CR 607.2a.

- `exiledObjects[]` is the authoritative representation of the exiled physical
  card ids, exiled old object ids, exiled new object ids, and before/after
  snapshots. These values must be copied from the successful `ZoneChangeEvent`
  where `toZone === 'exile'` and `after` exists. Grounding: CR 400.7,
  CR 400.7j, CR 406.2, CR 608.2h.

- The `LinkedExileRecord` union makes `returnSpec` required when
  `purpose === 'temporary-return'` and impossible when the record only supports
  "exiled with [this object]" lookup. Same-resolution blink uses
  `kind: 'same-resolution'`; "at the beginning of the next end step" effects
  use `kind: 'delayed-trigger'`. Grounding: CR 400.7j, CR 406.5, CR 603.10a,
  CR 608.2h.

- `linkedExilePayload` is optional on existing trigger/stack transport objects,
  so legacy pending triggers and stack abilities do not need snapshot backfill;
  only delayed linked-exile return triggers carry it. Grounding: CR 603.10a,
  CR 608.2h.

- `status` remains `active` until the return/link consumer resolves; a stale
  delayed return marks `stale-noop` instead of moving a physical card that is no
  longer the recorded exile object. Grounding: CR 400.7, CR 603.10a,
  CR 608.2h.

## 4. Snapshot Forward Compatibility

- `initGame` must initialize `linkedExile: {}` because CR 406.5/406.6 tracking
  is game state, not derived display state. Grounding: CR 406.5, CR 406.6.

- `restoreGame` must backfill missing `state.linkedExile` to `{}` before any
  UI/store path reads the restored state; legacy snapshots saved before this
  field existed must not crash. Grounding: CR 406.5 plus project
  snapshot-forward-compat discipline.

- `normalizeSnapshotState` should treat absent or non-record `linkedExile` as
  `{}` and should drop malformed records rather than reconstructing links from
  `eventLog`, because CR-linked identity depends on effect/source context that
  is not necessarily recoverable from zone moves alone. Grounding: CR 406.5,
  CR 406.6, CR 607.2a, CR 607.2b.

- `SNAPSHOT_VERSION` in `src/data/gameSnapshot.ts` should not be bumped merely
  for this optional, backfilled field; the current project pattern is to keep
  the version stable when `restoreGame` can normalize an added `GameState`
  field. A version bump is only needed if judge decides old saved games must be
  discarded instead of normalized. Grounding: CR 406.5 plus project
  snapshot-forward-compat discipline.

- `createDraft` in `commands.ts` must shallow-clone `state.linkedExile` before
  command mutation, just as it clones `eventLog`, `pendingTriggers`, and other
  mutable state containers; otherwise `applyCommand` would mutate input state
  and violate deterministic immutable engine discipline. Grounding: CR 406.5
  tracking as state, plus existing engine immutability invariant.

Proposed invariant labels for judge numbering:

- `I-linked-exile-forward-compat`: restoring a snapshot whose `state` lacks
  `linkedExile` yields a live `GameState` with `linkedExile` equal to `{}` and
  no crash in trigger candidate, undo/redo, or save paths. Grounding:
  CR 406.5, CR 406.6.

- `I-linked-exile-record-event-authority`: every active record entry has
  `exiledObjects[n].toZone === 'exile'`, a defined `newObjectId`, and
  `before`/`after` snapshots copied from the `ZoneChangeEvent` named by
  `zoneChangeEventId`. Grounding: CR 400.7, CR 400.7j, CR 406.2, CR 608.2h.

- `I-linked-exile-source-incarnation`: an `exiled-with-source` record is
  consumable only by a source reference whose physical id and object id both
  equal `record.source.physicalCardId` and `record.source.objectId`. Grounding:
  CR 400.7, CR 406.6, CR 607.2a, CR 607.2b.

- `I-linked-exile-return-current-object-guard`: `returnLinkedExile` may move a
  card only when `state.cards[physicalCardId]` exists, `zone === 'exile'`, and
  `objectIdOf(currentCard) === recorded.newObjectId`; otherwise it emits a
  warning/no-op and marks the record stale. Grounding: CR 400.7, CR 603.10a,
  CR 608.2h.

## 5. Object-Identity Semantics

- `exiled-with-source` records attach to the source object's CR 400.7
  incarnation, not merely to the physical card id. Store
  `record.source.objectId = objectIdOf(sourceCard)` or the equivalent
  `sourceSnapshot.objectId` at link creation time. Grounding: CR 400.7,
  CR 406.6, CR 607.2a.

- When checking whether a current source object can read or consume an
  `exiled-with-source` record, require both
  `current.id === record.source.physicalCardId` and
  `objectIdOf(current) === record.source.objectId`. Same physical card with a
  different `zoneChangeCounter` is a different object and must not inherit the
  old link. Grounding: CR 400.7, CR 406.6, CR 607.2a.

- A source zone change that creates a new object does not transfer old
  `exiled-with-source` links to the new object unless a future card-family rule
  or explicit CR 400.7 exception says so. The required 400.7 exceptions here
  let effects/triggers find moved objects in public zones; they do not create a
  generic "same source after zone change" inheritance rule. Grounding:
  CR 400.7, CR 400.7e, CR 400.7j, CR 406.6, CR 607.2a.

- For a leaves-the-battlefield source trigger, match the trigger's
  `sourceSnapshot.objectId` or the causing `ZoneChangeEvent.before.objectId`
  against `record.source.objectId`; do not use the post-move source card's new
  object id. Grounding: CR 400.7, CR 603.10a, CR 608.2h.

- If the source left before the ETB exile instruction resolved, a record may
  still be created from the resolving ETB ability's source snapshot, but no
  future new incarnation of that physical source may consume it as "this
  object." Grounding: CR 400.7, CR 406.6, CR 607.2a.

## 6. Blink / Temporary-Return Semantics

- Temporary blink resolution is: move the selected object to exile, create the
  linked-exile record from that move's `ZoneChangeEvent`, and later return only
  the recorded exile object. Grounding: CR 400.7j, CR 406.1, CR 406.2,
  CR 406.5, CR 608.2h.

- The return step must not search by physical card id alone. It must verify the
  current card is still in exile and still has the recorded `newObjectId`;
  otherwise the return is a warning/no-op and no blind move occurs from
  battlefield, graveyard, command, hand, or library. Grounding: CR 400.7,
  CR 603.10a, CR 608.2h.

- If the recorded object is still in exile, `returnLinkedExile` moves that
  current object to battlefield, producing a normal `ZoneChangeEvent` and a new
  object id for the returned permanent. Grounding: CR 400.7, CR 406.2,
  CR 608.2h.

- If the delayed return needs LKI for text, labels, mana value, or warnings
  after the object left exile, it must read the stored snapshots in
  `record.exiledObjects[]`; LKI may inform the warning/effect, but it is not a
  license to move a no-longer-present object. Grounding: CR 603.10a,
  CR 608.2h.

- Delayed blink should use existing `GameState.pendingTriggers`: at the due
  trigger point, append a `PendingTrigger` with
  `triggerId: 'trigger.delayed-linked-exile-return'`, `sourceId` /
  `sourceObjectId` / `sourceSnapshot` copied from the record, and a payload of
  `{ kind: 'linked-exile-return', linkedExileId, controllerId }`. Grounding:
  CR 603.10a, CR 608.2h.

- The stack ability created from that pending trigger must carry the same
  `linkedExileId` payload so resolving the stack item can dispatch
  `returnLinkedExile`; this keeps the delayed trigger on the same placement and
  priority path as ordinary triggers. Grounding: CR 603.10a, CR 608.2h.

- Same-resolution blink can dispatch `returnLinkedExile` in the same guided
  resolution after `exileLinkedObject`; delayed blink must wait for the due
  `pendingTriggers` path. Grounding: CR 400.7j, CR 603.10a, CR 608.2h.

## 7. Determinism and Command Policy

- Keep existing `moveCard` for simple exile; `effect.exile` in the current
  grammar leaf should remain a plain `moveCard` unless the parsed/effect
  context explicitly requires linked tracking. Grounding: CR 406.1, CR 406.2,
  CR 406.5, CR 406.6.

- Add a minimal linked move command because generic `moveCard` cannot know the
  effect/link id, source object snapshot, purpose, or return timing required by
  CR linked-exile tracking. Grounding: CR 406.5, CR 406.6, CR 607.2a.

- Add a guarded return command because generic `moveCard` cannot express "move
  only if this exact recorded exile object is still in exile." Grounding:
  CR 400.7, CR 603.10a, CR 608.2h.

- Add a non-move consume command for `exiled-with-source` effects like Skyclave
  Apparition where the linked card is read to produce another effect rather
  than returned to battlefield. Grounding: CR 406.6, CR 607.2a, CR 608.2h.

Suggested `GameCommand` additions:

```ts
export type GameCommand =
  | {
      type: 'exileLinkedObject';
      cardId: PhysicalCardId;
      linkedExileId: LinkedExileId;
      effectLinkId: EffectLinkId;
      purpose: LinkedExilePurpose;
      source: LinkedExileSourceRef;
      returnSpec?: LinkedExileReturnSpec;
      position?: 'bottom';
      reason?: Extract<ZoneChangeReason, 'move' | 'resolve'>;
    }
  | {
      type: 'returnLinkedExile';
      linkedExileId: LinkedExileId;
      to: 'battlefield';
      controllerId?: PlayerId;
    }
  | {
      type: 'consumeLinkedExileRecord';
      linkedExileId: LinkedExileId;
      reason: 'exiled-with-source-resolved' | 'manual-cleared' | 'stale-noop';
    };
```

Command behavior:

- `exileLinkedObject` calls `moveCardInternal(cardId, 'exile', position ?? 'bottom', true, reason ?? 'resolve')`; it creates a record only if that call returns a `ZoneChangeEvent` whose `toZone` is `'exile'`, `newObjectId` is defined, and `after` is defined. Grounding: CR 400.7, CR 400.7j, CR 406.2.

- `exileLinkedObject` must not fabricate a record when the move is same-zone,
  when the object ceases to exist without a current exiled object, or when the
  destination is not exile; those cases are warning/manual, not fake green.
  Grounding: CR 400.7, CR 406.2, CR 608.2h.

- `returnLinkedExile` reads exactly one active `temporary-return` record in the
  first implementation slice; multi-card returns remain manual until the judge
  accepts the multi-card contract. Grounding: CR 406.5, CR 406.6, CR 607.2a.

- `returnLinkedExile` marks the record `consumed` after a successful return and
  `stale-noop` after a failed current-object guard; delayed triggers resolve
  once and must not keep retrying forever. Grounding: CR 603.10a, CR 608.2h.

- `consumeLinkedExileRecord` marks an `exiled-with-source` record consumed after
  the linked ability uses its LKI/current exile information; it does not move
  the exiled card. Grounding: CR 406.6, CR 607.2a, CR 608.2h.

- No new randomness is introduced; all link ids, return timing, card choices,
  and controller choices must be in command payloads. Existing deterministic
  shuffle policy remains unchanged. Grounding: CR 400.7j, CR 406.5.

## 8. Scope Boundaries

- Face-down exile piles, permission-to-look rules, and random choice from a
  face-down exile pile are manual/deferred; this draft stores face-up
  `ObjectSnapshot` data and does not model hidden exile visibility. Grounding:
  CR 406.3, CR 406.4.

- Multi-card "the exiled cards" links are manually/deferred beyond the single
  recorded-object implementation slice, even though the record type uses
  `exiledObjects[]` for future shape compatibility. Grounding: CR 406.6,
  CR 607.2a, CR 607.2b.

- Player-specific library/hand/graveyard and owner routing remain owned by
  S-ZONES; linked exile in this slice writes only the shared exile zone and does
  not solve opponent library, hand, or graveyard storage. Grounding: CR 400.1,
  CR 400.3, CR 406.1, CR 406.2.

- Path to Exile's exile instruction may be represented by plain `moveCard`, but
  the opponent library search and owner/player-specific library routing remain
  manual/deferred until S-ZONES/search-player support exists. Grounding:
  CR 400.1, CR 400.3, CR 406.2.

- Replacement-effect linked exile is manual/deferred; this draft handles
  linked records produced by resolving spell/ability instructions, not
  replacement events. Grounding: CR 400.6, CR 607.2b.

- Melded permanents and merged permanents are manual/deferred because one object
  can be represented by multiple cards and CR can require finding/returning all
  resulting objects, not a single physical card id. Grounding: CR 400.7,
  CR 712.21c, CR 730.3c.

- Adventure, foretell, plot, and craft are manual/deferred because those card
  families create exile permissions/statuses that are not just temporary-return
  or exiled-with-source records. Grounding: CR 715.3d, CR 702.143a,
  CR 702.143e, CR 702.170a, CR 702.170d, CR 702.167a, CR 702.167c.

## 9. Golden / Review Pin Candidates

These are judge-owned future tests. The implementation agent must not edit
`review.*` files; this draft only proposes cases.

1. `cr-linked-exile-simple-target-exile-does-not-record`
   - Card: Path to Exile, limited to the exile instruction.
   - Fixture: spell on stack targets a battlefield creature.
   - Steps: resolve/guided target, execute plain exile.
   - Required observations: target moves to exile, `ZoneChangeEvent` records
     before/after object ids, `state.linkedExile` remains `{}`.
   - Must not: create a linked-exile record for a simple target exile.
   - Grounding: CR 406.1, CR 406.2, CR 406.5, CR 406.6.

2. `cr-linked-exile-one-shot-blink-returns-recorded-object-only`
   - Card: Thassa, Deep-Dwelling or a minimal test card with "exile ... then
     return that card to the battlefield".
   - Fixture: source trigger/ability exiles one target creature.
   - Steps: `exileLinkedObject` creates a `temporary-return` record; the return
     step dispatches `returnLinkedExile`.
   - Required observations: only the object whose current `objectIdOf(card)`
     equals the recorded `newObjectId` is returned to battlefield; the return
     creates a new battlefield object id and consumes the record.
   - Must not: return another incarnation of the same physical card.
   - Grounding: CR 400.7, CR 400.7j, CR 406.5, CR 608.2h.

3. `cr-linked-exile-source-zone-change-does-not-inherit-link`
   - Card: Skyclave Apparition or a minimal linked-ability permanent.
   - Fixture: source object A exiles target with an `exiled-with-source` record;
     the same physical source card later leaves and re-enters as object B.
   - Steps: attempt to resolve/use the old link from object B.
   - Required observations: lookup by `objectIdOf(currentSource)` rejects object
     B; only source object A's LTB/source snapshot can consume the old record.
   - Must not: match by physical source card id alone.
   - Grounding: CR 400.7, CR 406.6, CR 607.2a, CR 603.10a.

4. `cr-linked-exile-temporary-return-early-leave-warn-noop`
   - Card: Thassa, Deep-Dwelling or a minimal delayed blink card.
   - Fixture: target is exiled into a `temporary-return` record, then manually
     moved out of exile before the delayed return resolves.
   - Steps: due delayed trigger reaches `pendingTriggers`, stack item resolves,
     `returnLinkedExile` checks current object guard.
   - Required observations: warning/no-op, no zone move from the card's current
     non-exile zone, record marked `stale-noop`, and LKI text may use stored
     `before`/`after` snapshots.
   - Must not: move the same physical card from graveyard/hand/battlefield just
     because its physical id matches.
   - Grounding: CR 400.7, CR 603.10a, CR 608.2h.

5. `cr-linked-exile-skyclave-lki-token-uses-linked-card`
   - Card: Skyclave Apparition.
   - Fixture: ETB linked exile records a nonland nontoken permanent; source LTB
     later resolves.
   - Steps: use `consumeLinkedExileRecord` and existing token creation path.
   - Required observations: linked card lookup is restricted to the record
     created by Skyclave's exile instruction; token sizing reads current exile
     object if still present or record LKI if needed; record is consumed once.
   - Must not: use any other card in exile or any record from another source
     object incarnation.
   - Grounding: CR 400.7, CR 406.6, CR 607.2a, CR 608.2h.

6. `cr-linked-exile-legacy-snapshot-backfill`
   - Card: minimal deck.
   - Fixture: snapshot state with `linkedExile` property deleted.
   - Steps: call `restoreGame(snapshot)`.
   - Required observations: restored state has `linkedExile: {}`, normal trigger
     collection and save paths do not throw.
   - Must not: require a `SNAPSHOT_VERSION` bump for this additive backfill.
   - Grounding: CR 406.5, CR 406.6 plus project snapshot-forward-compat
     discipline.

## 10. CR Grounding Matrix

| CR ref | Design use |
| --- | --- |
| CR 400.7 | `objectIdOf` separates physical card id from zone incarnation; source links and return guards must use object id, not card id alone. |
| CR 400.7e | LTB/zone-change triggers can refer to new public-zone objects only through explicit exception logic; not a generic source-link inheritance rule. |
| CR 400.7j | Same effect/cost may find the public-zone object it moved; `exileLinkedObject` captures that moved exile object from the `ZoneChangeEvent`. |
| CR 406.1 | Exile is a holding zone; some exile is temporary and needs record tracking. |
| CR 406.2 | Exiling means putting the object into exile; records require a successful move to `toZone: 'exile'`. |
| CR 406.3 | Face-down exile visibility is deferred/manual. |
| CR 406.4 | Face-down exile piles and random selection from inaccessible piles are deferred/manual. |
| CR 406.5 | Exiled cards with different return/use mechanisms must be separately tracked; `GameState.linkedExile` is that substrate. |
| CR 406.6 | "The exiled cards" and "exiled with [this object]" are linked ability references, not global exile scans. |
| CR 607.2a | Triggered/activated linked exile records only the cards exiled by the linked instruction. |
| CR 607.2b | Replacement-effect linked exile is real but deferred until replacement events are authoritative. |
| CR 603.10a | Delayed/zone-change trigger resolution may need LKI; pending trigger payload should carry the linked-exile id and source snapshot. |
| CR 608.2h | Current information is used only if the expected public-zone object is still there; otherwise LKI informs the effect/warning, not blind movement. |

## 11. Promotion Skeleton

If the judge accepts this design, promote the following outline to a future
`engine-spec` section:

1. Title: `34.xx S-LINKED-EXILE / LKI substrate(CR 400.7 + 406 + 607)`.

2. State contract: add
   `GameState.linkedExile: Record<LinkedExileId, LinkedExileRecord>`; initialize
   and restore-backfill to `{}`. Grounding: CR 406.5, CR 406.6.

3. Type contract: promote `LinkedExilePurpose`, `EffectLinkId`,
   `LinkedExileId`, `LinkedExileSourceRef`, `LinkedExileZoneChangeRef`,
   `LinkedExileReturnSpec`, and `LinkedExileRecord`. Grounding: CR 400.7,
   CR 406.5, CR 406.6, CR 607.2a.

4. Command contract: simple exile stays `moveCard`; linked exile uses
   `exileLinkedObject`, guarded temporary return uses `returnLinkedExile`, and
   non-return linked consumption uses `consumeLinkedExileRecord`. Grounding:
   CR 400.7, CR 406.2, CR 406.5, CR 607.2a, CR 608.2h.

5. Trigger contract: delayed temporary returns reuse `pendingTriggers` with a
   linked-exile payload and resolve through `returnLinkedExile`. Grounding:
   CR 603.10a, CR 608.2h.

6. Object identity contract: `exiled-with-source` records are tied to
   `record.source.objectId`; source zone changes do not transfer the link to a
   new object. Grounding: CR 400.7, CR 406.6, CR 607.2a.

7. Invariants: promote the four provisional `I-linked-exile-*` labels above
   when implementation begins. Grounding: CR 400.7, CR 406.5, CR 406.6,
   CR 607.2a, CR 603.10a, CR 608.2h.

8. Golden/review hooks: author judge-owned tests for simple exile no-record,
   one-shot blink, source reincarnation rejection, early-leave warn/no-op,
   Skyclave linked token, and legacy snapshot backfill. Grounding: CR 400.7,
   CR 406.1, CR 406.2, CR 406.5, CR 406.6, CR 607.2a, CR 603.10a,
   CR 608.2h.

9. Scope boundary: keep face-down exile piles, multi-card linked piles,
   player-specific private zones, Path to Exile opponent search, replacement
   linked exile, meld/merged, Adventure, foretell, plot, and craft outside this
   implementation slice. Grounding: CR 400.1, CR 400.3, CR 406.3, CR 406.4,
   CR 607.2b, CR 712.21c, CR 730.3c, CR 715.3d, CR 702.143a, CR 702.170a,
   CR 702.167a.
