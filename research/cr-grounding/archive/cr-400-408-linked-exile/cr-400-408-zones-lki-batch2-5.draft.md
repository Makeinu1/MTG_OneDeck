# cr-400-408-zones-lki batch2-5 implementer scoping draft

Status: implementer-lane draft only. J0 mode is not active, so this file does not update
`docs/`, `review.*`, or `research/cr-grounding/cr-backbone-ledger.json`.

## Planned slice

Ledger plannedSequence batch2-5:

`cr-400-408-zones-lki`: linked exile / LKI = `action:exile 35` plus
`object-identity:lki 28`. Simple exile is already covered by the grammar leaf, and the
core domain is already `review-green` for zone-change-new-object/LKI.

The planned note names Path to Exile, Skyclave Apparition, and Thassa, Deep-Dwelling as
candidate goldens. Those are not one uniform behavior:

- Path to Exile is simple target exile plus opponent library search. The exile half is already
  simple `moveCard -> exile`; the opponent-search half is still outside the current single-player
  library substrate.
- Skyclave Apparition needs a link from the exiled object to a later leaves-the-battlefield
  trigger that creates a token using the exiled card's mana value.
- Thassa, Deep-Dwelling / blink effects need a temporary exile record that a delayed trigger can
  return to battlefield later, usually under owner's control.

## Current substrate evidence

Existing core pieces already present:

- `CardInstance.zoneChangeCounter` and `objectIdOf(card)` model CR 400.7 new-object identity.
- `ObjectSnapshot` records physical id, object id, zone, controller/owner, face, tapped state,
  counters, type line, power, and toughness.
- `ZoneChangeEvent` records `before` and optional `after` snapshots, old/new object ids,
  from/to zones, reason, replacement/SBA markers, and optional simultaneous group.
- `moveCardInternal()` always routes non-same-zone moves through `resetCardForZoneChange()` and
  `pushZoneChangeEvent()`.
- The golden `cr-zone-change-new-object-lki` pins that a battlefield-to-exile move:
  - increments object identity,
  - resets tapped/counters on the new object,
  - logs before/after snapshots,
  - creates an LTB pending trigger from the before snapshot.

Relevant evidence files:

- `src/engine/types.ts`
- `src/engine/commands.ts`
- `src/engine/__tests__/zoneChangeEvents.test.ts`
- `src/store/__tests__/crGroundingGoldenCases.test.ts`

## CR grounding

- CR 400.7: an object moving zones becomes a new object with no memory of its prior existence
  except for listed exceptions.
- CR 400.7e: zone-change triggers can find the new object in the public destination zone when
  the ability triggers.
- CR 400.7j: if an effect or cost moves an object to a public zone, other parts of that same
  effect or ability can find that object.
- CR 406.1/406.2: exile is a holding zone; exiling means putting an object into that zone.
- CR 406.5: exiled cards that might return or matter later should be kept in separate piles to
  track their respective return mechanisms.
- CR 406.6 and 607.2a/b: "exiled with [this object]" references are linked abilities and only
  see cards exiled by the linked exile instruction.
- CR 603.10a / 608.2h: triggered/resolving abilities may use last known information when the
  relevant object is no longer in the expected zone.

## Proposed implementation shape for a future brief

Do not start by adding generic linked-exile state for all cards. The narrow next step should be
a guided/effect-level link record emitted only when a single effect moves a known object to exile
and a later part of the same effect needs to find that object.

Suggested substrate:

- Add an explicit `exileLinkId` or `linkedEffectId` to an effect/ability resolution context, not
  to arbitrary `moveCard` calls.
- Store a small linked-exile record keyed by that id:
  - source physical id / source object id / source snapshot,
  - exiled physical card ids,
  - exiled old/new object ids,
  - before/after snapshots from the actual `ZoneChangeEvent`,
  - purpose such as `temporary-return` or `exiled-with-source`.
- Build records from the authoritative `ZoneChangeEvent` returned by `moveCardInternal()` so LKI
  and new-object identity stay single-sourced.
- For temporary blink, consume the record when the delayed return resolves and use the current
  object only if it is still in exile with the recorded object id; otherwise warn/manual-noop.
- For "exiled with this" permanents, treat the link as owned by the source object incarnation.
  If the source changes zones and becomes a new object, the old link should not attach to the new
  object unless a CR 400.7 exception explicitly says so.

## High-risk boundaries to keep manual

- Face-down exile piles and permission-to-look rules (CR 406.3/406.4).
- Multiple cards exiled at once and later referred to as "the exiled cards" until a reviewer-owned
  multi-card link contract exists.
- Player-specific library/hand/graveyard routing.
- Opponent library search from Path to Exile.
- Replacement-effect linked exile such as Leyline-style replacement until replacement/prevention
  events are fully authoritative for this path.
- Meld/merged permanents, Adventure/foretell/plot/craft-specific exile identities, and other
  card-family exceptions.

## Suggested golden/review pins

Future judge-owned pins should distinguish these cases:

- Simple target exile remains guided `moveCard -> exile` and does not create a linked-exile record.
- One-shot temporary blink: exile a target, record the zone-change event, then return only that
  recorded object from exile to battlefield.
- Source-object identity: an `exiled with [this object]` record is tied to the source object's
  object id and does not survive source zone-change as if it were the same object.
- LKI: if the exiled object leaves exile before the delayed return, the return branch is a warning
  or no-op, not a blind move of the same physical card from another zone.

## Proposed judge decision

Keep this as a future implementation slice after the current `cr-701-keyword-actions-frequent`
ambiguity is resolved. The existing LKI core is strong enough to build on, but linked exile should
not be silently folded into generic `moveCard` because CR 406.5/406.6/607 require source/effect
specific tracking.

## Non-claims

- No code is implemented in this draft.
- No docs, review tests, or ledger body were changed.
- This draft does not claim `cr-400-408-zones-lki` batch2-5 is complete or shipped.
