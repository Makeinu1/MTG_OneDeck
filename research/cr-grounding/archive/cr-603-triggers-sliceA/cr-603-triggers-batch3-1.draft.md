# cr-603 triggers/APNAP batch3-1 scoping draft

Status: implementer-lane draft only / non-claim. This draft does not implement
code and does not modify `docs/`, `review.*`, `CLAUDE.md`, `AGENTS.md`, the
ledger, or git state.

Scope source:
- `research/mydeck-scoring/gaps.json` measured rows: 521.
- Ledger planned candidate: `cr-603-triggers-apnap` batch3-1.
- Demand measured from raw `missingReadWrite` occurrences:
  `event:*` 87 + `delayed-trigger` 10 + `cast-timing:once-per-turn` 3 = 100.
- CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed
  2026-06-19.

## 1. Existing Substrate This Draft Assumes

- `PendingTrigger.stackPlacementBucket` already represents the two CR 603.3b
  placement buckets: ordinary triggers first, ability-triggered triggers second.
  Existing APNAP placement must be preserved rather than redesigned. Grounding:
  CR 603.3, CR 603.3b, CR 101.4, CR 117.5.

- `delayed-triggered` in grammar IR is only a triggered-shape classification.
  It currently follows the ordinary triggered path and does not schedule a
  future turn/phase event. Existing `PendingTrigger` has no `dueTurn`,
  `duePhase`, `scheduledFor`, or equivalent future scheduling field. Grounding:
  CR 603.7, CR 603.7a, CR 603.7b.

- Existing emitted `GameEvent` union is:
  `ZoneChangeEvent | DefeatAdvisoryEvent | DamageEvent | LifeChangeEvent |
  DrawEvent`. The relevant §34.18 envelope for this slice is therefore
  `zoneChange`, `damage`, `lifeChange`, and `draw`; other event families need a
  new event kind, a new semantic reason/cause on `ZoneChangeEvent`, or a
  deliberate out-of-envelope path. Grounding: CR 603.2, CR 603.6, CR 603.10a.

- `applyNextPhase` / `applyNextTurn` enter phases but do not currently promote
  future scheduled triggers. Beginning-of-upkeep and beginning-of-end-step
  triggers are collected only from current battlefield sources at the transition
  point. Grounding: CR 500.6, CR 503.1a, CR 513.1, CR 117.5.

## 2. CR Grounding

| CR | Draft use |
|---|---|
| 603.1 | Triggered abilities have a trigger condition and an effect. Use this as the base contract for compiler/classifier subscriptions. |
| 603.2 | A matching game event or game state causes the ability to trigger automatically; it does not resolve yet. Event subscription work belongs here. |
| 603.2c | One trigger event normally causes one trigger, but a single event can contain multiple occurrences. Needed for aggregate events such as "one or more" and simultaneous zone moves. |
| 603.2g | Prevented or replaced events do not trigger. Replacement/prevention integration is out of this slice unless explicitly chosen. |
| 603.2h | In the local 2026-06-19 CR, this is "Do this only once each turn", not triggered mana ability. It gates trigger creation if the indicated action was already taken this turn. |
| 603.3 | Once triggered, the controller puts the ability on the stack the next time a player would receive priority. |
| 603.3a | Ordinary trigger controller is source controller at trigger time; delayed trigger controller uses 603.7d-f. |
| 603.3b | Multiple pending triggers use APNAP, then ability-triggered bucket, and repeat around SBA/trigger fixed point. Existing implementation already covers the two buckets. |
| 603.3c / 700.2b | Modal triggered abilities choose modes when put on the stack; illegal/no mode can remove the ability. Treat as high-risk unless explicitly scoped. |
| 603.6 / 603.6c | Zone-change and leaves-the-battlefield triggers find moved objects by destination, with LTB as a common special family. |
| 603.7 / 603.7a | Delayed triggered abilities are created by resolving spells/abilities, replacement effects, or static permission actions, and trigger later. |
| 603.7b | A delayed trigger normally triggers only once unless it has a stated duration. Scheduled records need one-shot consumption. |
| 603.7c | A delayed trigger referring to a specific object can affect it across characteristic changes, but not if it is no longer in the expected zone/new-object identity. |
| 603.7d-f | Controller/source of delayed triggers depends on the creating spell, ability, or replacement effect. Scheduled records must store this source/controller data. |
| 603.10a | LTB, sacrifice, leaves-graveyard, public object to hand/library, and countered-spell triggers look back in time. Event snapshots/LKI are required. |
| 117.5 | Before priority, SBA are checked, triggers go on the stack, and this repeats. Batch3-1 must not bypass existing priority/APNAP placement. |
| 500.6 | Beginning-of-step/phase triggers trigger as the phase/step begins and go on the stack before priority. This is the promotion point for scheduled phase triggers. |
| 503.1a | Upkeep beginning triggers and triggers held from untap go on the stack before upkeep priority. |
| 513.2 | A delayed "beginning of the next end step" trigger created during the end step waits until the next turn's end step; the step does not back up. |
| 605.1b / 605.4a / 605.5a | Triggered mana ability grounding. Note: the brief names 603.2h for this, but the local CR places triggered mana ability criteria in 605.1b. A trigger from a mana ability that does not itself add mana is not a mana ability and uses normal triggered rules. |

## 3. gaps.json Measurement

### 3.1 Raw demand

| family | raw occurrences | unique rows/cards note |
|---|---:|---|
| `event:*` | 87 | 68 rows, 53 unique card names |
| `delayed-trigger` | 10 | 7 unique card names; `Fable of the Mirror-Breaker` and `Mishra's Bauble` repeat across decks, `Arcane Denial` has two delayed draw clauses |
| `cast-timing:once-per-turn` | 3 | 3 unique card names |

### 3.2 `event:*` sub-tag occurrence counts

| tag | raw occurrences | representative cards from gaps |
|---|---:|---|
| `event:draw` | 25 | `Celes, Rune Knight`; `Enduring Innocence`; `Niv-Mizzet, Parun`; `Rhystic Study`; `Waste Not` |
| `event:life` | 10 | `The One Ring`; `Scrawling Crawler`; `Bloodchief Ascension`; `Uro, Titan of Nature's Wrath` |
| `event:discard` | 10 | `Celes, Rune Knight`; `Fear of Missing Out`; `Kefka, Court Mage // Kefka, Ruler of Ruin`; `Dragon Mage` |
| `event:sacrifice` | 9 | `Accursed Marauder`; `Lotus Field`; `Uro, Titan of Nature's Wrath`; `Animate Dead` |
| `event:other` | 9 | `Skeleton Crew`; `Tormod, the Desecrator`; `Forbidden Orchard`; `The Enigma Jewel // Locus of Enlightenment`; `Vizier of Tumbling Sands` |
| `event:counter` | 8 | `Alesha, Who Laughs at Fate`; `Bloodchief Ascension`; `The Millennium Calendar`; `Vivi Ornitier` |
| `event:damage` | 7 | `Gau, Feral Youth`; `Mana Vault`; `Niv-Mizzet, Parun`; `Vivi Ornitier` |
| `event:zone` | 3 | `Advanced Reconstruction`; `Aftermath Analyst`; `Emperor of Bones` |
| `event:attacks` | 2 | `Extraction Specialist`; `Gogo, Mysterious Mime` |
| `event:blocks` | 1 | `Extraction Specialist` |
| `event:cast` | 1 | `Kefka, Dancing Mad` |
| `event:enters` | 1 | `Emperor of Bones` |
| `event:phase` | 1 | `Emperor of Bones` |

## 4. `event:*` Classification

This classification is intentionally split by implementation substrate, not by
rules importance. "Leaf" means the event is already emitted in the §34.18
`GameEvent` envelope and the missing work is mostly compiler/classifier
subscription plus trigger payload filtering. "New/enriched emit" means the
semantic event is not currently emitted as such; it needs either a new
`GameEvent` member, a semantically precise `ZoneChangeReason`/cause enrichment,
or an explicit judge-approved non-envelope path.

### 4.1 Existing emitted substrate: subscription/classifier leaf

Subtotal: 52 of 87 `event:*` occurrences.

| tag or slice | count | existing event source | draft scope |
|---|---:|---|---|
| `event:draw` | 25 | `DrawEvent` | Subscribe to player/result/card draw events. Current draw trigger detection also uses `drawnThisTurn`; eventLog should be the authoritative leaf if this slice formalizes event subscriptions. Grounding: CR 603.2, CR 117.5. |
| `event:life` | 10 | `LifeChangeEvent` | Subscribe by player/direction/delta and aggregate "lost life this turn" only if the judge includes turn aggregation. Grounding: CR 603.2, CR 603.2g. |
| `event:damage` | 7 | `DamageEvent` | Subscribe by source/target/combat flag. Source-less `markDamage` is not a `DamageEvent`, so damage-marking-only paths remain manual/deferred. Grounding: CR 603.2, CR 510.3a. |
| `event:zone` | 3 | `ZoneChangeEvent` | Generic zone movement leaf, including mill/exile/move cases where a zone move event already exists. Grounding: CR 603.6, CR 603.10a. |
| `event:enters` | 1 | `ZoneChangeEvent` to battlefield | Existing ETB substrate already uses `event.after` snapshots; this is a classifier/predicate leaf if not tied to delayed scheduling. Grounding: CR 603.6a. |
| `event:cast` | 1 | `ZoneChangeEvent` reason `cast` to stack | Existing cast watcher can subscribe to stack-entry cast zone changes. `Kefka, Dancing Mad` also has "this way" tracking, so the card as a whole is high-risk. Grounding: CR 603.2, CR 603.10a for countered-spell/LKI adjacency. |
| `event:other` leaves-graveyard slice | 5 | `ZoneChangeEvent` from graveyard | `Skeleton Crew`, `Tormod`, `Quintorius`, `On Wings of Gold`, and `Defiled Crypt` "cards leave your graveyard" can be represented as zone-change predicates. Grounding: CR 603.10a. |

### 4.2 New or enriched emit path required

Subtotal: 35 of 87 `event:*` occurrences.

| tag or slice | count | why not leaf-only | possible minimal primitive |
|---|---:|---|---|
| `event:discard` | 10 | A discard is structurally hand -> graveyard, but the current envelope has no discard semantic. A pure hand-to-graveyard predicate would over-trigger on non-discard moves. | Either add `DiscardEvent`, or enrich `ZoneChangeEvent` with `reason: 'discard'` / command cause and subscribe to that. Grounding: CR 603.2, CR 603.10a by analogy to public/zone-change LKI. |
| `event:sacrifice` | 9 | Sacrifice is not just any battlefield departure; CR 603.10a explicitly lists sacrifice triggers as look-back exceptions. Existing cost/move paths do not emit a sacrifice semantic. | Add `SacrificeEvent`, or add `ZoneChangeReason: 'sacrifice'` with before snapshot and sacrificed player/controller. Grounding: CR 603.10a. |
| `event:counter` | 8 | `addCounters` mutates object counters but no counter-placement/change event is emitted. | Add `CounterChangeEvent` / `CounterPlacedEvent` with source, target snapshot before/after, counter type, and delta. State-trigger cards such as `The Millennium Calendar` may still need manual gating. Grounding: CR 603.2, CR 603.8, CR 603.10a adjacency for LKI-style trigger checks. |
| `event:attacks` | 2 | Attack trigger candidates have an existing non-envelope helper, but the §34.18 eventLog does not emit attack declarations. | Either keep the existing attack helper as an approved non-envelope trigger path, or add `AttackDeclaredEvent` if event subscriptions must be eventLog-based. Grounding: CR 508.2a, CR 508.3a-e, CR 117.5. |
| `event:blocks` | 1 | No block declaration event is in §34.18. The observed `Extraction Specialist` row is also a continuing "can't attack or block" restriction, not a clean trigger subscription. | Defer as continuous restriction, or add `BlockDeclaredEvent` only if combat trigger coverage is in scope. Grounding: CR 509.2a, CR 509.3a-g. |
| `event:phase` | 1 | Phase entry is implicit; no eventLog phase event exists, and true delayed future scheduling is absent. | Use scheduled trigger promotion at phase entry rather than a generic phase event unless judge wants phase events in the envelope. Grounding: CR 500.6, CR 513.2, CR 603.7. |
| `event:other` non-zone slice | 4 | `Forbidden Orchard` needs a mana-activation/mana-added trigger source; `The Enigma Jewel` needs activated-ability observation; `Vizier of Tumbling Sands` needs cycling; `Defiled Crypt` needs room unlock. None are current §34.18 events. | Split these to later slices or add narrow event kinds only if selected: `ManaAbilityEvent`/`ManaAddedEvent` bridge, `AbilityActivatedEvent`, `CycleEvent`, `RoomUnlockedEvent`. Grounding: CR 603.2, CR 605.1b, CR 605.5a. |

Judge note: `event:discard` and `event:sacrifice` can be implemented either as
new `GameEvent` union members or as semantically precise `ZoneChangeEvent`
reasons. They are not classified as leaf-only because the existing event does
not currently distinguish the required game action.

## 5. delayed-trigger Scope

Measured rows: 10 raw occurrences, 7 unique card names.

Representative measured cards:
- `Fable of the Mirror-Breaker // Reflection of Kiki-Jiki`: copy token, then
  sacrifice it at the beginning of the next end step.
- `Mishra's Bauble`: draw a card at the beginning of the next turn's upkeep.
- `Arcane Denial`: controller may draw, and you draw, at the beginning of the
  next turn's upkeep.
- `Hide on the Ceiling`: return exiled cards at the beginning of the next end
  step.
- `Devastating Onslaught`: copy tokens, then sacrifice them at the beginning of
  the next end step.
- `Sneak Attack`: put a creature onto the battlefield, then sacrifice it at the
  beginning of the next end step.
- `Emperor of Bones`: return an exiled card with finality/haste, then sacrifice
  it at the beginning of the next end step.

### Option A: extend `PendingTrigger` with a schedule field

Sketch:

```ts
interface PendingTrigger {
  // existing fields...
  schedule?: {
    kind: 'phase-begin';
    turn: number;
    phase: 'upkeep' | 'end';
    consumeOnTrigger: true;
    createdAtTurn: number;
    createdAtPhase: Phase;
  };
}
```

Behavior:
- Resolver/compiler creates a scheduled `PendingTrigger` when the delayed
  trigger is created, not when the future step arrives. Grounding: CR 603.7a.
- UI/APNAP placement ignores scheduled triggers until their phase/turn arrives.
- `applyNextPhase` / `applyNextTurn` promotes matching scheduled triggers to
  ordinary pending triggers at phase entry. Grounding: CR 500.6, CR 117.5.
- Promotion consumes the schedule after the delayed trigger triggers once unless
  a stated duration is represented later. Grounding: CR 603.7b.
- `createdAtPhase === 'end'` and "next end step" must schedule the next turn's
  end step, not the current end step. Grounding: CR 513.2.

Pros:
- Reuses existing `PendingTrigger`, `stackPlacementBucket`, APNAP ordering, and
  pending trigger UI.
- Keeps the created delayed trigger close to the source/controller snapshot.

Risks:
- Ready pending triggers and future scheduled triggers share one array, so every
  consumer must filter by schedule readiness.
- Adding fields to `PendingTrigger` requires snapshot backfill in `restoreGame`.
  Grounding: project invariant I16 / forward-compatible snapshots.

### Option B: add a separate `scheduledTriggers` queue

Sketch:

```ts
interface ScheduledTrigger {
  scheduledTriggerId: string;
  trigger: PendingTrigger;
  scheduledFor: { kind: 'phase-begin'; turn: number; phase: 'upkeep' | 'end' };
  consumeOnTrigger: true;
}
```

Behavior:
- Store future delayed triggers outside `pendingTriggers`.
- Phase/turn transition moves due records into `pendingTriggers`.
- Existing APNAP and manual stack placement only see ready triggers.

Pros:
- Clear separation between "future scheduled" and "ready for stack placement".
- Lower risk of existing pending trigger UI showing future triggers.

Risks:
- Requires a new `GameState` field and restore backfill.
- Requires new remove/undo/serialization paths.

### Option C: reminder-only/manual delayed trigger record

Sketch:
- Detect delayed-trigger text and create a log/reminder or non-stackable marker.
- Do not auto-promote to pending triggers.

Pros:
- Lowest engine risk.
- Honest manual fallback for broad delayed-trigger text.

Risks:
- Does not close the `delayed-trigger` demand as automation.
- Leaves cards such as `Mishra's Bauble`, `Arcane Denial`, and `Hide on the
  Ceiling` manual.

Minimum required details for either A or B:
- Store source snapshot and controller using CR 603.7d-f.
- Store object references/LKI for delayed effects that return/sacrifice a
  particular object. Grounding: CR 603.7c, CR 400.7, CR 603.10a.
- Store absolute due turn/phase after applying "next end step" / "next turn's
  upkeep" semantics. Grounding: CR 500.6, CR 503.1a, CR 513.2.
- Scheduled trigger promotion should create normal pending triggers, not place
  them directly on the stack, so CR 603.3b APNAP placement remains intact.

## 6. `cast-timing:once-per-turn` Scope

Measured rows: 3.

Representative cards:
- `Enduring Innocence`: other power-2-or-less creatures enter, draw a card;
  triggers only once each turn.
- `Defiled Crypt // Cadaver Lab`: one or more cards leave your graveyard, make a
  token; triggers only once each turn.
- `Tataru Taru`: opponent draws off-turn, make tapped Treasure; triggers only
  once each turn.

Draft primitive:
- Treat this tag as a trigger frequency gate, not a casting timing permission.
  Grounding: local CR 603.2h.
- Add per-turn trigger-consumption state keyed by:
  `(sourceObjectId, abilityLineIndex or triggerId, controllerId, turn)`.
- Apply the gate before adding a pending trigger. If the gate is consumed this
  turn, the event is observed but no pending trigger is created. Grounding:
  CR 603.2h, CR 603.3.
- Reset naturally by turn number rather than mutating/clearing a global map if
  possible. If a state field is added, `restoreGame` needs backfill.
- If the source changes zones and becomes a new object, the `sourceObjectId`
  key should prevent the old object consumption from incorrectly applying to the
  new object. Grounding: CR 400.7.

High-risk once-per-turn edges:
- `Tataru Taru` needs opponent draw events. Current `DrawEvent` creation is
  P1-centric, so this may require player-scoped draw support before it can be a
  golden auto case.
- "one or more" aggregation requires simultaneous-group-aware trigger creation,
  not one trigger per individual object if one event contains multiple moves.
  Grounding: CR 603.2c.
- Texts with intervening-if conditions still need trigger-time and
  resolution-time checks if included. Grounding: CR 603.4.

## 7. High-Risk Boundaries to Keep Manual or Defer

- Modal triggered abilities unless a mode-choice envelope is explicitly added.
  Grounding: CR 603.3c, CR 700.2b.

- Intervening-if and "this turn" aggregate state such as `Bloodchief Ascension`
  ("opponent lost 2 or more life this turn") and `Gau, Feral Youth` ("a card
  left your graveyard this turn") unless a turn-event aggregation substrate is
  selected. Grounding: CR 603.4, CR 603.2.

- State triggers such as `The Millennium Calendar` ("When there are 1,000 or
  more time counters...") unless CR 603.8 state-trigger rearming is explicitly
  scoped. Grounding: CR 603.8.

- `Extraction Specialist` style "can't attack or block for as long as..."
  continuous restrictions. These are not event subscription leaves and should
  remain in layers/duration scope. Grounding: CR 506.3, CR 508.1c, CR 509.1b.

- "This way" provenance across later actions, especially `Kefka, Dancing Mad`
  tracking spells cast from cards exiled by that effect. This needs permission
  records/provenance, not just a cast event. Grounding: CR 603.2, CR 400.7.

- Replacement/prevention interactions. If an event is prevented or replaced, it
  may not trigger. This slice should not fake-green replacement correctness.
  Grounding: CR 603.2g.

- Delayed "next end step" created during an end step. Must schedule the next
  turn's end step; do not retroactively trigger in the current end step.
  Grounding: CR 513.2.

- Triggered mana abilities and mana-adjacent triggers. `Forbidden Orchard`
  triggers from tapping for mana but does not itself add mana, so it should use
  normal triggered rules, while true triggered mana abilities use CR 605.1b and
  CR 605.4a. Do not route all mana-adjacent triggers through `PendingManaTrigger`.

- Multi-player/opponent events where the current event envelope is P1-centric,
  especially opponent draw/life cases. Keep manual until player-scoped event
  emission is verified.

## 8. Golden Candidate Cards by Category

| category | primary candidates | why |
|---|---|---|
| Existing draw/life/damage event leaf | `Niv-Mizzet, Parun`; `Scrawling Crawler`; `The One Ring`; `Mana Vault` | Exercises draw subscription, life loss, sourceful damage, and beginning-step trigger placement. |
| Existing zone-change leaf | `Baleful Strix`; `Liliana, Dreadhorde General`; `Skeleton Crew`; `Tormod, the Desecrator` | ETB/death/leaves-graveyard can ride `ZoneChangeEvent` plus snapshots. |
| New discard/sacrifice semantic event | `Fear of Missing Out`; `Celes, Rune Knight`; `Accursed Marauder`; `Lotus Field`; `Uro, Titan of Nature's Wrath` | Forces action-specific event semantics beyond generic zone moves. |
| New counter event | `Alesha, Who Laughs at Fate`; `The Millennium Calendar`; `Bloodchief Ascension`; `Vivi Ornitier` | Requires counter placement/change event and exposes state-trigger risk. |
| Combat event or non-envelope helper | `Gogo, Mysterious Mime`; `Extraction Specialist` | Shows attack/block event/restriction boundary; likely not a first automation target. |
| Delayed trigger scheduling | `Mishra's Bauble`; `Arcane Denial`; `Hide on the Ceiling`; `Fable of the Mirror-Breaker // Reflection of Kiki-Jiki`; `Sneak Attack`; `Emperor of Bones` | Covers next upkeep, next end step, delayed return, delayed sacrifice, object identity. |
| Once-per-turn trigger gate | `Enduring Innocence`; `Defiled Crypt // Cadaver Lab`; `Tataru Taru` | Covers source/ability/turn gating and player-scope edge. |
| Manual/defer boundary | `Kefka, Dancing Mad`; `The Millennium Calendar`; `Bloodchief Ascension`; `Extraction Specialist` | Provenance, state triggers, intervening-if/turn aggregation, and continuous restrictions are larger than this leaf. |

## 9. Judge Decision Points

1. Choose delayed-trigger primitive shape:
   - Option A: scheduled field on `PendingTrigger`.
   - Option B: separate `scheduledTriggers` queue.
   - Option C: reminder-only/manual record.

2. Choose event expansion scope:
   - Leaf-only first: implement subscriptions for the 52 occurrences already
     represented by `draw`, `lifeChange`, `damage`, and `zoneChange`.
   - Add semantic zone-action events in same slice: `discard` and `sacrifice`
     as new events or precise `ZoneChangeReason` values.
   - Add counter/combat/mana/ability/cycling/room events now or defer them.

3. Decide whether `event:discard` and `event:sacrifice` should be new
   `GameEvent` union members or enriched `ZoneChangeEvent` semantics. Both can
   satisfy CR 603.10a if before snapshots and action semantics are precise.

4. Decide whether attack/block should stay on existing non-envelope helper
   paths or be promoted into eventLog as combat declaration events.

5. Decide whether once-per-turn gating uses a new `GameState` consumed-trigger
   ledger or a derived turn-number record attached to pending generation.

6. Decide whether modal triggers, intervening-if checks, and state triggers are
   in or out of batch3-1. Draft recommendation: keep them out unless each has a
   narrow golden.

7. Decide whether batch3-1 is too large for one implementation slice. Draft
   split candidates:
   - Slice A: event subscription leaf for already emitted events (52) plus
     once-per-turn gate for a narrow existing-event golden.
   - Slice B: delayed-trigger scheduling primitive and delayed golden cards.
   - Slice C: semantic new events (`discard`, `sacrifice`, `counter`) and their
     trigger subscriptions.

8. Confirm CR numbering: local fixed CR has `603.2h` as once-per-turn trigger
   gating; triggered mana ability criteria are `605.1b` with stack exception
   `605.4a`.

## 10. Non-Claim

This draft is scoping only. It does not claim implementation, does not update
the ledger, does not update docs, and does not modify review-owned tests.
Judge should re-check the CR clauses and demand arithmetic before approving any
implementation brief.
