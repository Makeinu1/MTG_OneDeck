# S-EVENTS Life/Damage/Draw Event Envelope Golden Draft

Draft lane only. Do not edit `research/cr-grounding/golden-cases.json` or any
`review.*` test from this draft. Judge/reviewer may later promote selected
cases after independent CR verification.

Domain: `cr-119-life`
Paired contract draft:
`research/cr-grounding/s-events-life-envelope.draft.md`

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19.
Pinned local source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`.

## 0. Current Substrate Survey

- There is no `src/engine/events.ts` at drafting time. Event types and
  `GameState.eventLog` are currently defined in `src/engine/types.ts`.
- `GameEvent` is currently `ZoneChangeEvent | DefeatAdvisoryEvent`; new
  damage/life/draw events must be additive union members and must not rename
  the existing `type` discriminant.
- Current `ZoneChangeEvent` already pins `eventId`, `sequence`, before/after
  `ObjectSnapshot`, `fromZone`, `toZone`, `reason`, replacement/SBA metadata,
  and same-zone reorder exclusion.
- Current life, damage, and draw paths mutate state and/or emit zone-change or
  defeat-advisory events, but they do not emit dedicated CR 119/120/121
  envelope events.

## 1. Golden Case Candidates

### G1. `cr-events-life-gain-envelope`

CR refs: 119.1c, 119.3, 119.9, 119.10.

Setup: start a normal Commander game with P1 at 40 life (CR 119.1c).

Action: apply a deterministic life-gain command/effect equivalent to "you gain
3 life."

Expected event delta:

- Exactly one `lifeChange` event is appended.
- `type: 'lifeChange'`, `playerId: 'P1'`, `delta: 3`,
  `direction: 'gain'`, `previousLife: 40`, `nextLife: 43`.
- `eventId` and `sequence` are deterministic from the prior `eventLog`.
- `source` / `cause` identifies the command/effect path.

Adversarial extension: a 0 life-gain instruction emits no `lifeChange` event
and does not satisfy "gains life" subscriptions (CR 119.9, 119.10).

### G2. `cr-events-life-loss-envelope`

CR refs: 119.1c, 119.3, 119.4, 119.5, 104.3b, 119.6, 704.5a.

Setup: start a normal Commander game with P1 at 40 life (CR 119.1c).

Action: apply a deterministic life-loss command/effect equivalent to "you lose
2 life" or a cost payment of 2 life.

Expected event delta:

- Exactly one `lifeChange` event is appended.
- `delta: -2`, `direction: 'loss'`, `previousLife: 40`, `nextLife: 38`.
- If the life change is a payment, `cause` records a cost/payment cause rather
  than damage.

Adversarial extension: reducing life to 0 or less appends the `lifeChange`
event and then only the existing advisory loss event at the SBA boundary; the
app must not hard-enforce a loss outside its advisory sandbox (CR 104.3b,
119.6, 704.5a).

### G3. `cr-events-damage-result-links-to-life-loss`

CR refs: 120.1, 120.3a, 120.4b, 120.4c, 119.2, 510.2.

Setup: use a future source-backed damage command or an already source-backed
combat path. The source and target must be explicit enough to satisfy CR 120.1
and CR 120.7.

Action: a source deals 3 non-infect damage to a player.

Expected event delta:

- One trigger-eligible `damage` event is appended with `amount: 3`,
  a CR-legal `source`, a player `target`, and `combatDamage` set correctly.
- One `lifeChange` loss event is appended for the damage result.
- The `lifeChange` carries `causeEventId` or `sourceEventId` pointing to the
  `damage` event.
- If multiple damage packets are simultaneous, their events share a
  `simultaneousGroupId`; life results remain deterministically linked to the
  packet(s).

Scope note: this is a shape/golden candidate, not a demand to implement combat
auto attribution in this slice. The source must be supplied by the command or a
later combat slice before this case becomes executable.

### G4. `cr-events-damage-source-boundary`

CR refs: 120.1, 120.7, 120.8, 603.2g.

Setup: use the legacy source-less `markDamage` style operation on a creature.

Action: mark 2 damage without a CR-legal source.

Expected boundary:

- The operation must not emit a trigger-eligible CR 120 `damage` event unless
  the command has been extended with a source.
- If a manual diagnostic event is introduced later, it must be distinguishable
  from CR damage subscriptions, for example by `triggerEligible: false` or by a
  different event kind.

Adversarial extension: amount 0 emits no CR damage event and does not trigger
damage-dealt subscriptions (CR 120.8, 603.2g).

### G5. `cr-events-draw-single-card-envelope`

CR refs: 121.1, 121.5, 400.6.

Setup: P1 library has at least one known top card.

Action: `draw` one card.

Expected event delta:

- A `ZoneChangeEvent` records library to hand for the physical card
  (CR 400.6).
- A successful `draw` event is appended with `result: 'drawn'`,
  `playerId: 'P1'`, the drawn card identity, before/after object ids or
  snapshots, and `zoneChangeEventId` pointing to the library-to-hand event.
- The draw event is distinct from a mere zone change so "draw" replacement and
  trigger logic can distinguish it from non-draw movement (CR 121.5).

### G6. `cr-events-multi-draw-is-per-card`

CR refs: 121.2, 121.2c.

Setup: P1 library has at least two known top cards.

Action: `draw` two cards.

Expected event delta:

- Two successful `draw` events are appended, one per individual draw.
- Their order matches the top-card order at each draw.
- They share the same command/effect cause but have distinct `sequence` and
  `eventId`.
- No aggregate "draw two" event replaces the individual draw events.

Adversarial extension: when player-specific zones later exist, multi-player
draw instructions follow active-player-then-turn-order before each player's
individual draw sequence (CR 121.2c). That extension is blocked on
§34.17/S-ZONES.

### G7. `cr-events-empty-library-draw-attempt`

CR refs: 121.4, 704.5b, 603.2g.

Setup: P1 library is empty.

Action: `draw` one card.

Expected event delta:

- A `draw` event is appended with `result: 'empty-library-attempt'`.
- No successful card identity, no `zoneChangeEventId`, and no library-to-hand
  `ZoneChangeEvent` are present.
- The event is not matched by successful "whenever you draw" subscriptions.
- The existing 704.5b advisory path may use this event or its derived flag to
  create an `emptyLibraryDraw` advisory at the SBA boundary.

Adversarial extension: milling from an empty library emits no draw-attempt
event and no 704.5b advisory, because non-draw library movement is not a draw
(CR 121.5, 704.5b).

### G8. `cr-events-zone-change-envelope-backcompat`

CR refs: 400.6, 400.7, 603.6, 603.10.

Setup: move a creature from battlefield to graveyard after changing tapped
state and counters.

Action: perform a true zone change.

Expected event delta:

- Existing `ZoneChangeEvent` shape remains valid: `type: 'zoneChange'`,
  physical id, old/new object ids, from/to zones, `before`, and `after`.
- `before` preserves last-known state for leaves-the-battlefield style checks;
  `after` represents the new object in the destination zone.
- Same-zone reordering emits no zone-change event.

Adversarial extension: token cease/copy cease terminal events remain
backward-compatible `ZoneChangeEvent` entries and do not require the new
life/draw/damage fields.

### G9. `cr-events-private-zone-owner-metadata-late`

CR refs: 400.1, 400.3, 400.6.

Setup: this case is blocked until §34.17 `zonesByPlayer` is implemented.

Action: a player-specific draw or private-zone move occurs.

Expected event delta:

- `ZoneChangeEvent` / `DrawEvent` includes optional `fromZoneOwnerId` and
  `toZoneOwnerId` for library/hand/graveyard.
- Shared zones may omit zone-owner metadata.
- Legacy flat P1 snapshots without these optional fields still restore.

### G10. `cr-events-union-extension-does-not-break-old-golden`

CR refs: 400.6, 400.7, 704.5a, 704.5b.

Setup: run existing executable CR-grounding cases that inspect
`ZoneChangeEvent` and `DefeatAdvisoryEvent`.

Action: execute old cases after adding `damage`, `lifeChange`, and `draw` union
members.

Expected result:

- Existing assertions that filter `event.type === 'zoneChange'` or
  `event.type === 'defeatAdvisory'` still pass.
- Existing `DefeatAdvisoryEvent` `never` card/zone fields remain unchanged.
- Existing `restoreGame` backfill for missing `eventLog` still returns `[]`.

### G11. `cr-events-snapshot-forward-compat`

CR refs: 400.7, 704.5a, 704.5b.

Setup: create legacy snapshots with:

- no `eventLog`;
- old `ZoneChangeEvent` entries lacking future optional envelope fields;
- old `DefeatAdvisoryEvent` entries only.

Action: `restoreGame` each snapshot.

Expected result:

- Missing `eventLog` backfills to `[]`.
- Old events remain readable and are not rewritten into incompatible shapes.
- New optional fields default to `undefined`; no `CACHE_SCHEMA_VERSION` change
  is required by this union extension alone.

### G12. `cr-events-I14-same-input-same-event-delta`

CR refs: 603.2, 603.2g, 400.6, 119.3, 120.8, 121.2.

Setup: generate a fixed state and a fixed command from deterministic command
payloads. Include at least one case each for life change, draw, zone change,
and source-backed damage once available.

Action: deep-clone the exact same state twice, apply the exact same command to
both, and compare appended `eventLog` entries.

Expected result:

- Appended event arrays are deeply equal.
- Event ids and sequences match because the starting `eventLog` is identical.
- No event field depends on Date/time, runtime object iteration order, UI
  transient state, or RNG reads during `applyCommand`.

Adversarial extension: for shuffle or any randomizable command, the command
payload must already contain the chosen order. Same state plus same order
produces the same events; a different precomputed order is a different command.

## 2. Reviewer-Owned Pin Candidates

These are candidate names and assertions only. Implementation agents must not
author or edit these `review.*` files.

- `src/store/__tests__/review.s-events-life-envelope.test.ts`
  - Pins life gain/loss event shape, zero-life-gain no-event, life<=0 advisory
    boundary, and union extension compatibility.
  - CR refs: 119.3, 119.9, 119.10, 104.3b, 119.6, 704.5a.
- `src/store/__tests__/review.s-events-draw-envelope.test.ts`
  - Pins successful draw event, multi-draw one-event-per-card, empty-library
    draw attempt, and mill-not-draw.
  - CR refs: 121.1, 121.2, 121.4, 121.5, 704.5b.
- `src/store/__tests__/review.s-events-damage-envelope.test.ts`
  - Pins source-backed damage packet shape, damage-to-player life-loss linkage,
    source-less manual boundary, and zero-damage no-event.
  - CR refs: 120.1, 120.3a, 120.4b, 120.4c, 120.7, 120.8, 119.2.
- `src/engine/__tests__/review.event-determinism.test.ts`
  - Pins I14 by applying the same state+command twice and comparing appended
    event deltas across life/draw/zone-change/damage cases.
  - CR refs: 603.2, 603.2g, 400.6, 119.3, 120.8, 121.2.
- `src/store/__tests__/review.event-envelope-forward-compat.test.ts`
  - Pins `restoreGame` compatibility for missing `eventLog` and legacy event
    entries after union extension.
  - CR refs: 400.7, 704.5a, 704.5b.

## 3. Implementation-Owned Test Candidates

These are safe for implementation agents only after a judge-approved brief
promotes the contract.

- `src/engine/__tests__/eventEnvelope.test.ts`: narrow unit tests for event
  factory helpers, deterministic ids, and event-delta comparison.
- `src/store/__tests__/crGroundingGoldenCases.test.ts`: judge-promoted golden
  ids from this draft may be wired here after `golden-cases.json` is updated by
  the judge.
- Existing `src/engine/__tests__/zoneChangeEvents.test.ts` should remain green
  without weakening; it is the backcompat guard for `ZoneChangeEvent`.

## 4. Explicit Non-Goals for Golden Promotion

- Do not require a CR 614/615 replacement/prevention engine in these cases.
  The cases may assert metadata slots but not replacement/prevention behavior
  (CR 614, 615).
- Do not require real-card triggered ability detection. The event shape can be
  tested without deciding which oracle text subscribes to it (CR 603.2,
  603.3).
- Do not require combat commander-damage auto attribution, trample, infect,
  wither, lifelink, toxic, prevention, or regeneration. Those are later
  damage-result slices (CR 120.3, 120.4, 903.10a).
- Do not require player-specific library/hand/graveyard storage before §34.17
  is implemented. Optional zone owner metadata can be tested only after
  `zonesByPlayer` lands (CR 400.1, 400.3, 400.6).
