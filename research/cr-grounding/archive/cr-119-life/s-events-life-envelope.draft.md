# S-EVENTS Life/Damage/Draw Event Envelope Draft

Draft lane only. Do not copy to `docs/engine-spec.md` until judge review.
This file is a contract draft only; it must not be treated as implementation.

Domain: `cr-119-life`
Ledger lane/status at drafting time: `backbone` / `implemented-not-green`
Planned-sequence role: S-EVENTS entry slice for damage, life loss/gain, draw,
and zone-change event envelope. This draft is paired with
`research/cr-grounding/s-events-life-golden.draft.md`.

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19.
Pinned local source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
(`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` sha256
`e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`).

Relevant CR refs: 104.3b, 117.5, 119, 120, 121, 400.1, 400.3, 400.6,
400.7, 603.2, 603.2g, 603.3, 603.6, 603.10, 614, 615, 704.3, 704.5a,
704.5b.

## 0. Current Substrate Survey

- `src/engine/events.ts` does not exist at drafting time. Event types live in
  `src/engine/types.ts`, and event emission is implemented inside
  `src/engine/commands.ts`.
- `GameState.eventLog` is `GameEvent[]`. `GameEvent` is currently
  `ZoneChangeEvent | DefeatAdvisoryEvent`. `initGame` initializes
  `eventLog: []`; `makeDraft` clones an existing `eventLog` or treats a missing
  one as `[]`; `restoreGame` also backfills missing `eventLog` to `[]`
  ([[snapshot-forward-compat]]).
- `pushEvent` assigns `sequence = max(existing event.sequence) + 1` and
  `eventId = e${sequence}`. `causeCommandId` exists on `ZoneChangeEvent` but is
  not currently populated.
- `ZoneChangeEvent` already has `type`, `eventId`, `sequence`,
  `simultaneousGroupId`, `causeCommandId`, `reason`, `physicalCardId`,
  `oldObjectId`, `newObjectId`, `fromZone`, `toZone`,
  `replacementApplied`, `sbaApplied`, `before`, and `after`.
  Same-zone reordering does not emit an event. Token/copy disappearance is
  represented as a zone-change-like terminal event.
- `DefeatAdvisoryEvent` is an advisory-only event for state-based loss
  findings. It carries `sbaApplied`, `playerRef`, `defeatReason`, and
  `advisory: true`; it deliberately has `never` card/zone fields.
- `AbilityTriggeredEvent`, `ActivatedManaAbilityEvent`, and `ManaAddedEvent`
  interfaces exist in `src/engine/types.ts`, but they are not members of
  `GameEvent`. Mana transaction events are transaction-local in
  `src/engine/manaTransaction.ts`.
- There is no dedicated `damage`, `lifeChange`, or `draw` event in
  `GameState.eventLog`. `adjustLife` and unblocked combat damage mutate
  `life` / `opponentLife`; `markDamage` mutates `damageMarked`; `draw` moves a
  card from `library` to `hand`, increments `drawnThisTurn`, and uses
  `emptyLibraryDrawAttemptedSinceLastSba` for CR 704.5b. Those paths do not
  currently emit a CR 119/120/121 envelope.
- Store trigger collection currently consumes newly appended `ZoneChangeEvent`
  entries from `eventLog`. Non-zone trigger candidates are still synthetic or
  heuristic paths; `docs/engine-spec.md` §34.1 C-C reserves S-EVENTS as the
  event-subscription source of truth.

## 1. Proposed engine-spec Section Draft

### 34.18 S-EVENTS: life/damage/draw/zone-change event envelope

**Position**: This is the first S-EVENTS substrate slice after the existing
Z2/Z3 `ZoneChangeEvent` scaffold. It freezes the common event envelope for
CR 119 life change, CR 120 damage, CR 121 draw, and CR 400.6 zone-change events,
so later replacement/prevention and triggered-ability subscribers can hook the
same surface. Trigger subscription remains the §34.1 C-C architecture:
triggered abilities match game events and wait for the priority loop before
stack placement (CR 603.2, 603.3, 117.5, 704.3).

**CR grounding**:

- Life changes are event-worthy only when a player's life total changes by a
  nonzero amount. Effects that gain or lose life adjust the life total
  (CR 119.3); paying life is life loss (CR 119.4); setting a life total produces
  the necessary gain or loss (CR 119.5). A 0 life gain is not a life-gain event
  (CR 119.9, 119.10).
- Damage to a player normally causes life loss, but damage and life loss are
  distinct event surfaces: damage is dealt by a source (CR 120.1, 120.7), then
  damage results are processed, including player life loss (CR 120.3a,
  120.4b-c, 119.2). Damage amount 0 does not create a damage event (CR 120.8).
- Drawing a card is the movement of the top card of a player's library to that
  player's hand (CR 121.1). Multiple draws are individual draws, not one
  aggregate draw event (CR 121.2). Moving cards from library to hand without
  the word "draw" is not a draw (CR 121.5). Empty-library draw attempts matter
  for the later SBA loss check (CR 121.4, 704.5b).
- A zone-change event is determined before the object moves, and replacement
  effects can modify that event before the move occurs (CR 400.6, 614.1,
  614.6). The moved object becomes a new object after the zone change
  (CR 400.7). Zone-change triggers and last-known-information style checks need
  before/after snapshots (CR 603.6, 603.10).
- Replacement and prevention effects watch events as they would happen
  (CR 614.1, 615.1). This slice freezes the envelope and hook points only; the
  actual replacement/prevention engine is out of scope for this slice
  (CR 614, 615).

**Envelope compatibility rule**: The TypeScript discriminant remains `type`,
not a new mandatory `kind`, because existing `ZoneChangeEvent` tests and
consumers already read `event.type`. In prose, "event kind" means the existing
`type` discriminant. `ZoneChangeEvent` remains structurally valid; new event
kinds are added to the `GameEvent` union without renaming or deleting existing
fields.

**Common base fields for new event kinds**:

```ts
type KnownEventKind = 'zoneChange' | 'defeatAdvisory' | 'damage' | 'lifeChange' | 'draw';
type NewEnvelopeEventKind = 'damage' | 'lifeChange' | 'draw';

interface EventEnvelopeBase {
  type: NewEnvelopeEventKind;
  eventId: string;
  sequence: number;
  simultaneousGroupId?: string;
  causeCommandId?: string;
  causeEventId?: string;
  cause: EventCause;
  replacementApplied?: string | string[];
  preventionApplied?: string | string[];
  determinismRef?: EventDeterminismRef;
}
```

- `eventId` and `sequence` are assigned deterministically from the input state
  and command. The current `e${sequence}` convention may remain for
  `GameState.eventLog` events. Transaction-local mana event ids stay outside
  this `GameEvent` union unless a later judge-owned slice promotes them.
- `simultaneousGroupId` groups events that are simultaneous under CR, such as
  combat damage dealt simultaneously (CR 510.2, 120.4) or a batch of SBAs
  performed as one event (CR 704.3). A single event may use its own `eventId` as
  the implicit group id.
- `causeCommandId` is optional for backward compatibility because current
  `GameCommand` values do not carry ids. New emitters should preserve at least
  deterministic `cause.type` / `commandType` metadata, and may fill
  `causeCommandId` after a command-id envelope exists.
- `causeEventId` links derived events. For example, damage to a player creates
  a `damage` event and the resulting `lifeChange` can point back to that damage
  event (CR 120.3a, 120.4c, 119.2).
- `replacementApplied` and `preventionApplied` are metadata hooks only in this
  slice. They record what later CR 614/615 machinery applied; they do not imply
  that this slice implements replacement/prevention resolution (CR 614, 615).
- `determinismRef` may point at precomputed command payload choices such as a
  shuffle order. Event emission must not read RNG; randomness is already
  resolved into the command payload before `applyCommand` runs.

**Source and target references**:

```ts
type EventSourceRef =
  | { kind: 'object'; physicalCardId: PhysicalCardId; objectId: ObjectId; snapshot?: ObjectSnapshot }
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'command'; commandType: string }
  | { kind: 'system'; ruleRef: string };

type EventTargetRef =
  | { kind: 'player'; playerId: PlayerId; lifeLabel?: string }
  | { kind: 'object'; physicalCardId: PhysicalCardId; objectId: ObjectId; snapshot?: ObjectSnapshot }
  | { kind: 'zone'; zone: ZoneId; zoneOwnerId?: PlayerId };
```

- Damage events that are trigger-eligible under CR 120 must have a source
  object or another CR-legal source reference, because damage is dealt by a
  source (CR 120.1, 120.7). A source-less manual "mark damage" operation must
  not counterfeit a trigger-eligible CR 120 damage event; if a manual diagnostic
  event is later added, it must be outside the CR 120 trigger surface
  (CR 120.1, 603.2g).
- Player targets use `PlayerId` first. `lifeLabel` may remain as the app bridge
  for existing `opponentLife`, but CR identity is the player (CR 400.1,
  119.3, 104.3b).
- Private-zone targets may include `zoneOwnerId` once §34.17
  `zonesByPlayer` lands. Until then, zone owner metadata is optional and
  existing flat P1 private-zone snapshots remain valid. This follows the
  already frozen §34.17 design-lock for CR 400.1/400.3/400.6.

**New event kind: `lifeChange`**:

```ts
interface LifeChangeEvent extends EventEnvelopeBase {
  type: 'lifeChange';
  playerId: PlayerId;
  lifeLabel?: string;
  delta: number;
  previousLife: number;
  nextLife: number;
  direction: 'gain' | 'loss';
  source?: EventSourceRef;
  sourceEventId?: string;
}
```

- `delta > 0` is `gain`; `delta < 0` is `loss`. `delta === 0` emits no
  `lifeChange` event because 0 life gain is not a life-gain event and a 0 delta
  does not change a life total (CR 119.3, 119.9, 119.10).
- Damage-caused life loss should set `sourceEventId` / `causeEventId` to the
  corresponding `damage` event. This preserves the CR distinction between the
  damage event and its life-loss result (CR 120.3a, 120.4c, 119.2).
- Life total 0 or less is not itself an immediate enforced game loss in this
  app; it continues to create an advisory at the SBA boundary. The advisory is
  grounded in CR 104.3b, 119.6, and 704.5a and remains sandbox-warning only.

**New event kind: `damage`**:

```ts
interface DamageEvent extends EventEnvelopeBase {
  type: 'damage';
  source: EventSourceRef;
  target: EventTargetRef;
  amount: number;
  combatDamage: boolean;
  damageResultEventIds?: string[];
}
```

- `amount` must be positive. A would-be 0 damage packet emits no `damage` event
  and therefore cannot trigger damage-dealt abilities (CR 120.8, 603.2g).
- `combatDamage` distinguishes CR 510.2 combat damage from effect damage while
  sharing the same CR 120 damage envelope. Combat damage is dealt
  simultaneously after assignment (CR 510.1, 510.2).
- `damageResultEventIds` may link to result events such as `lifeChange`,
  damage-marked state changes, loyalty counter changes, poison counters,
  wither/infect counters, or lifelink life gain. This slice freezes the link
  surface; it does not implement the full result matrix (CR 120.3a-h).

**New event kind: `draw`**:

```ts
interface DrawEvent extends EventEnvelopeBase {
  type: 'draw';
  playerId: PlayerId;
  result: 'drawn' | 'empty-library-attempt';
  drawOrdinal?: number;
  physicalCardId?: PhysicalCardId;
  oldObjectId?: ObjectId;
  newObjectId?: ObjectId;
  fromZoneOwnerId?: PlayerId;
  toZoneOwnerId?: PlayerId;
  zoneChangeEventId?: string;
  before?: ObjectSnapshot;
  after?: ObjectSnapshot;
}
```

- Successful draws use `result: 'drawn'` and should link to the corresponding
  library-to-hand `ZoneChangeEvent` through `zoneChangeEventId` (CR 121.1,
  400.6).
- Empty-library attempts use `result: 'empty-library-attempt'`, carry no card
  identity, and are not successful draw events for "whenever you draw" matching.
  They are the event evidence for the later 704.5b advisory (CR 121.4, 704.5b,
  603.2g).
- A multi-draw instruction emits one `DrawEvent` per individual draw in order,
  with a shared cause and increasing `drawOrdinal`; it must not compress draws
  into one aggregate event (CR 121.2).
- Moving a card from library to hand without a draw instruction emits a
  `ZoneChangeEvent` but no successful `DrawEvent` (CR 121.5, 400.6).

**Existing event kind: `zoneChange`**:

- Existing `ZoneChangeEvent` is kept as-is for backward compatibility. It
  already carries before/after object snapshots needed by zone-change triggers
  and LKI-style checks (CR 400.6, 400.7, 603.6, 603.10).
- Future player-specific private zones may add optional `fromZoneOwnerId` and
  `toZoneOwnerId` without invalidating old events. Actual private-zone storage
  remains governed by the §34.17 design-lock (CR 400.1, 400.3, 400.6).
- Same-zone reordering remains non-event for this envelope unless a later CR
  slice identifies a rule-visible event. This preserves the existing Z2
  contract and the CR 400.6 "move from one zone to another" boundary.

**I14: event determinism**:

- I14 is concretized as: for any identical `GameState` and identical
  `GameCommand`, `applyCommand` returns an identical appended event sequence
  and identical event ids. "Identical state" includes the preexisting
  `eventLog`, so `sequence`/`eventId` are part of deterministic replay.
- Event emission must not depend on wall-clock time, object insertion order that
  is not explicitly sorted, UI-only labels except as stable bridge metadata, or
  RNG read during `applyCommand`. Random choices must already be present in the
  command payload.
- Candidate implementation-owned unit: for selected commands, deep-clone a
  frozen state twice, apply the same command to both, and compare
  `eventLog.slice(previousEventCount)`.
- Candidate reviewer-owned property: extend the existing `review.properties`
  random walk with an I14 branch that applies the generated command to two
  cloned states and asserts identical event deltas. Include at least life
  change, draw, zone change, and any source-backed damage command once it
  exists.
- Candidate replay pin: a fixed command sequence that includes draw, life
  gain/loss, zone change, token cease, and defeat advisory must serialize and
  replay to the same `eventLog`.

**Snapshot forward compatibility**:

- Missing `eventLog` continues to restore as `[]`; legacy `ZoneChangeEvent` and
  `DefeatAdvisoryEvent` entries without new optional fields remain valid
  ([[snapshot-forward-compat]]).
- Because this slice adds union members rather than a new required `GameState`
  field, no `CACHE_SCHEMA_VERSION` change is required by this contract draft.
  If the judge later promotes a required state field, that field must be
  backfilled in `restoreGame` before implementation.

**Scope boundaries for this slice**:

- Replacement and prevention application engines are deferred to a later
  backbone/late-backbone slice. This slice only reserves
  `replacementApplied` / `preventionApplied` metadata and the "would happen"
  hook shape (CR 614, 615).
- Real-card triggered ability detection is deferred. This slice freezes event
  shapes that observers can subscribe to; C-GRAMMAR/S-ABILITY decides which
  oracle text maps to which subscription (CR 603.2, 603.3).
- Combat source attribution beyond already modeled vanilla combat is deferred.
  A trigger-eligible `damage` event must have a CR-legal source; the slice must
  not infer commander damage, trample, infect, wither, lifelink, toxic, or
  prevention results unless a later slice supplies that source/result logic
  (CR 120.3, 120.4, 903.10a).
- Player-specific private zones are not implemented here. The envelope only
  leaves optional `zoneOwnerId` fields so the §34.17 design-lock can connect
  later without rewriting event consumers (CR 400.1, 400.3, 400.6).
- `ActivatedManaAbilityEvent` and `ManaAddedEvent` remain transaction-local per
  §34.11 unless a future judge-owned slice explicitly promotes them into the
  global `GameEvent` union (CR 605.1b/605.4a are outside this domain).
