# cr-608-resolution batch3-2 scoping draft

Status: draft-only / non-claim / no implementation.

Source inputs:
- `research/mydeck-scoring/gaps.json`: measured rows for `object-identity:lki` and `action:counter-spell`.
- CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed 2026-06-19.
- Existing substrate read-only survey: `ObjectSnapshot`, `objectIdOf`, `zoneChangeCounter`, `TargetSelection`, `sourceSnapshot`, `resolveStackTop`, `removeStackItem`, linked exile records, and activation envelope target storage.

This file does not update `docs/`, `review.*`, the ledger, or source code. Judge must re-check every CR interpretation before approving an implementation brief.

## Measured Demand

Raw demand confirmed from `research/mydeck-scoring/gaps.json`:

| tag | measured rows | notes |
|---|---:|---|
| `object-identity:lki` | 28 | Mixed bucket: true LKI reads, same-effect public-zone object finding, source/event identity, delayed object references, linked exile/copy boundaries. |
| `action:counter-spell` | 9 | Stack spell countering. Several rows have follow-up token/draw/mana/condition work beyond the counter action itself. |
| total | 37 | Matches plannedSequence[0] demand. |

### `object-identity:lki` Inventory

| # | deck | card | clause | classification for this scope |
|---:|---|---|---:|---|
| 1 | Celes | Extraction Specialist | 25 | Returned object receives a continuing restriction. Reuse target identity / CR 400.7j-style public-zone finding; actual restriction is layers/continuous-effect work, not this LKI core. |
| 2 | Celes | Skyclave Apparition | 32 | Linked exile/LTB reads exiled object owner and mana value. Existing `LinkedExileRecord` can carry identity/snapshot; token X/X and LTB wiring remain additional work. |
| 3 | Celes | Tersa Lightshatter | 45 | Random graveyard exile, then play permission for that exiled card this turn. Needs deterministic random choice plus cast/play permission from exile; not a narrow 608.2h read. |
| 4 | Celes | Path to Exile | 70 | Exile target creature, then read its controller for library search. Needs resolution-time target snapshot/LKI after the move; opponent library search remains outside this slice. |
| 5 | Celes | Advanced Reconstruction | 95 | Mill plus random graveyard exile, then play permission. Needs mill/random/play-permission substrate; no new stateful LKI claim here. |
| 6 | Gogo | Liberator, Urza's Battlethopter | 199 | Trigger compares mana spent to source power. Existing `sourceSnapshot` helps source LKI, but mana-spent provenance and effective power are separate event/layer work. |
| 7 | Gogo | Displacer Kitten | 200 | Same-resolution exile then return. Existing linked-exile `temporary-return` substrate is the closest fit; broad delayed blink remains manual. |
| 8 | Gogo | Rapid Hybridization | 217 | Destroy target creature, then read that creature's controller for token creation. Needs resolution-time target snapshot/LKI plus token command. |
| 9 | Gogo | Mana Drain | 219 | Counter target spell, then later use that spell's mana value. Needs stack target snapshot and delayed mana event; combines counter-spell with LKI. |
| 10 | Kefka | Ragavan, Nimble Pilferer | 324 | Exile top card of damaged player's library, then cast permission. Needs damage event player identity plus exile permission; outside narrow resolution LKI. |
| 11 | Kefka | Professional Face-Breaker | 350 | Sacrifice Treasure, exile top library card, then play permission. Cost plus exile permission; not a simple LKI read. |
| 12 | Kefka | Thassa, Deep-Dwelling | 358 | Same-resolution exile then return. Existing linked-exile `temporary-return` substrate covers the identity shape for one object. |
| 13 | Kefka | Gogo, Mysterious Mime | 362 | Copy target creature and refer to "that creature". Needs copy/layers/effective characteristics; keep manual for this slice. |
| 14 | Kefka | Ardyn, the Usurper | 374 | Exile graveyard creature card, then create a token copy of that card. Needs same-effect public-zone object finding plus copy-token support. |
| 15 | Kefka | Grave Researcher // Reanimate | 386 | Move target creature card from graveyard to battlefield, then read that card's mana value. Can reuse target snapshot/current object if mana value is available; needs resolution-time data, not activation-time characteristics. |
| 16 | Kefka | Feed the Swarm | 394 | Destroy target permanent, then read that permanent's mana value. Prime narrow LKI candidate: ZoneChangeEvent.before or resolution-time target snapshot should provide the value. |
| 17 | Kefka | Animate Dead | 408 | Aura return/attach plus later sacrifice "that creature". Needs attachment, LTB source tracking, and CR 400.7e/f-style object finding; high-risk defer. |
| 18 | Kefka | Necromancy | 420 | Same family as Animate Dead: return/attach plus later sacrifice. Needs attachment and delayed/LTB object tracking; high-risk defer. |
| 19 | Kefka | Sneak Attack | 428 | Put creature card onto battlefield, then delayed sacrifice that creature. Needs same-effect object capture plus delayed scheduler; defer unless trigger scheduler is in scope. |
| 20 | Muldrotha | Sakura-Tribe Elder | 526 | Sacrifice self, search, put selected basic land onto battlefield tapped, shuffle. Existing activation envelope plus guided library-search pattern covers identity of the selected card; no `resolutionContext` required for LKI. |
| 21 | Muldrotha | Springheart Nantuko | 529 | Copy attached creature. Needs attachment state plus copy/effective characteristics; manual/defer. |
| 22 | Muldrotha | Displacer Kitten | 542 | Same as #7. Existing linked-exile `temporary-return` substrate covers the one-object same-resolution identity path. |
| 23 | Muldrotha | Nature's Lore | 566 | Search selected Forest card, put onto battlefield, shuffle. Existing guided library-search selected-id command path should cover identity; not a new LKI primitive. |
| 24 | Muldrotha | Rampant Growth | 567 | Search selected basic land, put tapped, shuffle. Same as #23 plus tapped status. |
| 25 | Muldrotha | Emergent Ultimatum | 577 | Multi-card search/exile, opponent chooses one, shuffle/cast the rest. Multi-object choice and cast permission; high-risk defer. |
| 26 | Muldrotha | Kaya's Ghostform | 582 | Enchanted permanent dies or is exiled, then return that card. Needs zone-change trigger payload carrying the moved object, attachment identity, and CR 400.7e; likely not this narrow 608 slice. |
| 27 | Muldrotha | Vexing Bauble | 603 | Trigger observes a spell cast with no mana spent, then counters that spell. Needs cast-event stack object identity plus mana-spent provenance; counter action can reuse stack removal if the object is still present. |
| 28 | Muldrotha | Sunken Palace | 642 | Mana-spend link to the spell/ability cast or activated with that mana, then copy it. Existing `copyStackItem` is relevant, but mana provenance and object binding are missing; defer. |

### `action:counter-spell` Inventory

| # | deck | card | clause | immediate counter scope |
|---:|---|---|---:|---|
| 1 | Gogo | Pact of Negation | 210 | Pure `Counter target spell` for the immediate action; card-level upkeep drawback is separate text. |
| 2 | Gogo | An Offer You Can't Refuse | 212 | Counter noncreature spell, then controller creates two Treasure tokens. Counter core plus controller LKI/token follow-up. |
| 3 | Gogo | Flusterstorm | 213 | Counter instant/sorcery spell unless controller pays `{1}`. Requires resolution-time pay choice; not first simple auto. |
| 4 | Gogo | Swan Song | 218 | Counter enchantment/instant/sorcery spell, then controller creates a Bird token. Counter core plus controller LKI/token follow-up. |
| 5 | Gogo | Mana Drain | 219 | Counter target spell, then delayed mana equal to that spell's mana value. Counter core plus stack-target LKI/delayed mana. |
| 6 | Gogo | Fierce Guardianship | 221 | Counter target noncreature spell. Good immediate counter golden with stack type filter. |
| 7 | Kefka | Arcane Denial | 377 | Counter target spell, then delayed optional draws. Counter core plus delayed trigger/controller tracking. |
| 8 | Muldrotha | Swan Song | 555 | Same as #4. |
| 9 | Muldrotha | Long River's Pull | 559 | Counter target creature spell, or gift/instead counter target spell. Needs gift/modal/instead handling; not first simple auto. |

## CR Grounding

- CR 608.2b: targets are rechecked on resolution. A target that left the zone it was in when targeted is illegal. If all targets are illegal, the spell/ability does not resolve and a spell goes to its owner's graveyard. Illegal targets do not provide information for parts that need that information.
- CR 608.2d: choices not already made during casting/activation/trigger placement are made while applying the resolving effect. This is the anchor for `unless its controller pays {1}`, random/choice prompts, and modal/gift boundaries.
- CR 608.2h: if an effect needs information from a specific object, use current information if the object is in the expected public zone; otherwise use last known information. This is the narrow grounding for Feed the Swarm / Rapid Hybridization / Mana Drain-style reads.
- CR 113.7a: activated/triggered abilities exist independently of their source. If source information is checked later and the source is gone from the expected zone, use LKI.
- CR 400.7: a zone move creates a new object with no memory of the previous existence except listed exceptions.
- CR 400.7e: zone-change triggers can find the new object in the public destination zone when the ability triggered.
- CR 400.7j is also relevant even though this draft does not claim it broadly: if an effect causes an object to move to a public zone, other parts of that effect can find that object. This is the likely rule for same-resolution "that card" after a public-zone move. Broad 400.7 exceptions remain manual unless separately goldened.
- CR 701.6a: countering cancels a spell or ability, removes it from the stack, it does not resolve, and a countered spell goes to its owner's graveyard.
- CR 701.6b: no costs are refunded for a countered spell or ability. This is separate from 701.6a in the local CR text.

## Existing Substrate Read

- `CardInstance.zoneChangeCounter` and `objectIdOf(card)` already model CR 400.7 object incarnation: physical id remains stable, object id changes only on true zone changes.
- `ObjectSnapshot` currently stores physical id, object id, def id, zone, owner/controller, token/commander flags, face index, tapped, counters, type line, power, and toughness. It does not currently store mana value, colors, keywords/effective characteristics, attachments, mana spent, spell costs paid, or a full layer-applied characteristic set.
- `TargetSelection.selection.snapshot` stores the chosen object at target-selection time. This is good for object identity and activation/cast-time target binding, but it is not enough for all CR 608.2h characteristic reads because the target's characteristics may change between targeting and resolution. True resolution LKI needs a resolution-time snapshot or `ZoneChangeEvent.before`.
- `moveCardInternal` emits `ZoneChangeEvent` with `before` and optional `after` snapshots. Existing linked-exile record writing already demonstrates a useful pattern: derive records from the actual zone-change event instead of trusting stale physical ids.
- `resolveStackTop` compiles/resolves stack item effects and applies generated commands, but the current flat command application path does not expose "previous command's moved object snapshot" to later commands in the same resolving effect.
- `removeStackItem` already removes an arbitrary stack item. For non-ability spells it moves the object to graveyard and logs it as countered; for abilities it deletes the ability object. This is close to CR 701.6a, but a first `counter target spell` slice must filter out abilities and may need a semantic `counter` reason/event if later triggers care about "countered".
- `TargetFilter`/`eligibleTargets` currently cover battlefield and graveyard object targets. There is no stack-target filter for "target spell" yet.

## Object LKI Scope Split

### Reuse Existing Mechanisms

These can be scoped as extensions of existing patterns, with no persistent `GameState.resolutionContext` unless implementation proves otherwise:

- Same-resolution temporary return (`Displacer Kitten`, `Thassa, Deep-Dwelling`): already fits linked-exile `temporary-return` and CR 400.7j/608.2h return guard. New work should avoid reopening delayed-return scope.
- Simple library-search selected object identity (`Nature's Lore`, `Rampant Growth`, `Sakura-Tribe Elder`): existing guided library search can carry the selected physical id in command payload and move/tap/shuffle deterministically. This does not require a general LKI system.
- Linked exile/LTB identity (`Skyclave Apparition`): existing `LinkedExileRecord` can preserve source object id and exiled object snapshot. Remaining work is token X/X and LTB trigger integration, not the identity substrate itself.
- Activation/source LKI (`Liberator` source reference, activated ability source references): existing `sourceSnapshot`/activation envelope pattern is the right starting point, but additional effective characteristics/mana-spent event data may be required.

### Needs A Resolution-Time Read Path

These should not use activation-time target characteristics as a shortcut. The resolver needs current-at-resolution information, then LKI if the effect itself moves the object before a later instruction reads it.

- `Feed the Swarm`: destroy target permanent, then lose life equal to that permanent's mana value. The relevant value should come from the target as it existed immediately before destruction, or current information if still in the expected public zone when read. Grounding: CR 608.2h, 400.7.
- `Rapid Hybridization`: destroy target creature, then that creature's controller creates a token. Needs controller from the object as it last existed before destruction. Grounding: CR 608.2h, 400.7.
- `Path to Exile`: exile target creature, then its controller may search. Needs controller LKI, but opponent library search remains a separate player-zone/search scope. Grounding: CR 608.2h, 400.7.
- `Grave Researcher // Reanimate`: put target creature card onto battlefield, then lose life equal to that card's mana value. Because the effect moved the object to a public zone, the same effect may find it there; if the implementation instead reads before/after snapshots, it must keep the CR 400.7j boundary explicit.
- `Mana Drain`: countered target spell's mana value must be captured before the target leaves stack and passed to delayed mana. Grounding: CR 608.2h, 701.6a, 701.6b.

Implementation shape options for judge decision:

- Ephemeral resolver context: while applying one effect line, collect selected target snapshots and zone-change event `before/after` snapshots, then let later effect fragments request named facts such as `target[0].manaValue` or `target[0].controllerId`.
- Command-payload expansion: build concrete follow-up commands at resolution after target recheck, using the target's resolution-time snapshot. This keeps `GameState` additive changes low but may require `buildGuidedCommands` to receive state/snapshot context.
- Persistent `resolutionContext` in `GameState`: likely overkill for this slice unless delayed triggers need to serialize captured object facts. If used, it must be transient/cleared and backfilled safely, which increases snapshot risk.

### Manual/Defer Boundaries

Keep these manual/deferred in this batch unless the judge explicitly splits them into separate goldens:

- Copies and layer/effective-characteristics cases: `Gogo, Mysterious Mime`, `Springheart Nantuko`, `Ardyn`, `Sunken Palace`.
- Multiple objects or opponent choices: `Emergent Ultimatum`.
- Delayed object references requiring a future scheduler: `Sneak Attack`, `Mana Drain` delayed mana, `Arcane Denial` delayed draw, and broad "at the beginning of the next ..." effects.
- Attachment/Aura LTB families: `Animate Dead`, `Necromancy`, `Kaya's Ghostform`, unless the implementation brief explicitly includes attachment and zone-change-trigger payload work.
- Broad CR 400.7 exception coverage beyond 400.7e/400.7j representatives.
- Multi-target partial resolution and all-target-illegal generalization beyond the narrow single-target rows selected for this slice.

## Counter-Spell Scope

Narrow first slice:

- Guided target prompt for a single `target ... spell` on the stack.
- Candidate set: `state.zones.stack` items that are not `isAbility`; exclude the resolving counter spell itself where applicable.
- Type filter from stack spell type line:
  - `target spell`: any non-ability stack spell.
  - `target noncreature spell`: stack spell whose type line does not include `Creature`.
  - `target creature spell`: stack spell whose type line includes `Creature`.
  - `target instant or sorcery spell`: stack spell whose type line includes `Instant` or `Sorcery`.
  - `target enchantment, instant, or sorcery spell`: stack spell whose type line includes one of those types.
- Resolution action: emit existing `removeStackItem(targetId)` or equivalent. For spells, this removes the target from stack to graveyard and prevents later resolution; no cost refund is attempted. Grounding: CR 701.6a, 701.6b.

Open implementation question:

- Existing `removeStackItem` is probably enough for state transition, so a new `counterSpell` command is not required for the first state slice.
- If reviewer goldens need an explicit "countered" event/reason, prefer the smallest semantic extension to `removeStackItem`/`ZoneChangeReason` over a new command, unless the judge wants countering to be a first-class command surface.
- The CR wording says owner's graveyard. Current core `moveCardInternal(..., 'graveyard')` uses the shared `zones.graveyard` path; exact player-specific owner routing should be called out as existing-zone-substrate dependent and not overclaimed.

Counter rows that should remain manual/deferred for this batch:

- `Flusterstorm`: "unless its controller pays {1}" is a CR 608.2d resolution-time choice/payment.
- `Long River's Pull`: gift/instead branch and target-class broadening.
- `An Offer You Can't Refuse` / `Swan Song`: counter core is fine, but controller token creation needs captured controller and token creation follow-up.
- `Mana Drain` / `Arcane Denial`: counter core is fine, but delayed mana/draw requires captured LKI and delayed trigger scheduling.

## Golden Candidates

Recommended minimal goldens if the judge splits the implementation:

| category | candidate | expected focus | CR refs |
|---|---|---|---|
| Pure counter target spell | Fierce Guardianship or Pact of Negation effect line | Stack target selected, target spell leaves stack to graveyard, no refund, target does not resolve. | 608.2b, 701.6a, 701.6b |
| Stack type filter | Fierce Guardianship | Noncreature stack spell eligible; creature spell not eligible. | 608.2b, 701.6a |
| Counter + LKI capture | Mana Drain | Countered spell's mana value captured before stack move; delayed mana can be deferred if scheduler not in scope. | 608.2h, 701.6a, 701.6b |
| Same-resolution LKI read | Feed the Swarm | Destroy target permanent, then use that permanent's mana value from LKI for life loss. | 608.2h, 400.7 |
| Controller LKI read | Rapid Hybridization or Path to Exile | Target leaves battlefield, then controller information remains available for follow-up. | 608.2h, 400.7 |
| Public-zone same-effect finding | Grave Researcher // Reanimate | Target creature card moves from graveyard to battlefield, then "that card" mana value is read without confusing physical id with old object id. | 400.7, 400.7j, 608.2h |
| Existing linked-exile reuse | Displacer Kitten or Thassa, Deep-Dwelling | Same-resolution exile-return remains on existing linked-exile path; no new delayed-return claim. | 400.7j, 608.2h |
| High-risk defer pin | Animate Dead or Kaya's Ghostform | Mark as manual/defer unless attachment + LTB object payload is explicitly approved. | 400.7e, 608.2h, 113.7a |

If the judge keeps one combined implementation slice, the minimal acceptance surface should still avoid broad 400.7 exception claims and should not claim all-target-illegal/multi-target partial resolution unless review goldens are authored for those cases.

## Judge Decision Points

1. `resolutionContext` vs pattern extension:
   - Preferred first attempt: extend existing `ObjectSnapshot`/`TargetSelection`/`ZoneChangeEvent.before` patterns with an ephemeral resolver context or resolution-time command generation.
   - Introduce persistent `GameState.resolutionContext` only if delayed/future effects need serialized captured facts in this slice.
   - Judge should decide whether `ObjectSnapshot` must add `manaValue` now. Without it, Feed the Swarm and Mana Drain cannot be cleanly goldened.

2. Counter command surface:
   - Preferred first attempt: compile guided `counter target spell` to existing `removeStackItem(targetId)` after adding stack-target filtering.
   - Add a new command only if the judge wants countering to be a first-class semantic event or if owner-graveyard routing cannot be represented by existing movement.
   - If no new command is added, decide whether `ZoneChangeReason` needs a `counter` value for future trigger/event consumers.

3. Split or combine:
   - Safer split: first implement stack target filtering + pure counter action; second implement LKI reads for Feed the Swarm/Rapid/Mana Drain.
   - If combined, keep the scope to single-target effects and explicit golden rows. Do not include copies, delayed scheduling, attachment LTB, multi-target partial resolution, or broad 400.7 exceptions.

4. Target legality:
   - Current stored-target guard checks object id and expected zone for guided targets. Judge should decide whether this batch must re-run the full type/controller filter at resolution for stack spells and battlefield targets, or whether object id + expected zone + narrow type check is enough for first goldens.

5. Owner/controller/player-zone precision:
   - Countered spells must go to owner's graveyard under CR 701.6a. The implementation brief should state whether current shared `graveyard` is acceptable for this app slice or whether `zonesByPlayer` routing must be used first.

## Non-Claim

This draft is scoping only. It does not assert implementation completeness, does not modify the CR ledger, does not update docs or review tests, and does not claim any green status. Broad CR 400.7 exceptions, copies, delayed scheduling, attachment/LTB semantics, and multi-target partial resolution remain manual/defer unless the judge explicitly approves them with goldens.
