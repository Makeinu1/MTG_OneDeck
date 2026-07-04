# plannedSequence batch2 candidate draft

Status: Codex implementer draft only. Do not treat this as a judge decision or ledger update.

Sources read:
- `research/mydeck-scoring/summary.md`
- `research/mydeck-scoring/report.json`
- `research/mydeck-scoring/gaps.json`
- `research/cr-grounding/cr-backbone-ledger.json` (read only)
- `docs/engine-spec.md` section 34
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (2026-06-19)

Demand source: `report.json.missingDemandCounts`, cross-checked by grouping `gaps.json[].missingReadWrite`. The scoring snapshot was generated on 2026-07-02, so some top demand may already have partial or shipped substrate in the current ledger. This draft records substrate sufficiency, not final priority.

Order: raw MyDeck demand descending by the highest relevant missing read/write count.

## 1. `cr-602-605-activation-mana-residual`

- (a) Proposed domainId: `cr-602-605-activation-mana-residual`
- (b) CR grounding: CR 602.2 - "To activate an ability is to put it onto the stack and pay its costs, so that it will eventually resolve and have its effect."
- (c) MyDeck demand: `cost:activation=232`, `cost:tap=201`, `mana:write=150`, `cost:nonmana=58` (`report.json.missingDemandCounts`; same counts reproduced from `gaps.json[].missingReadWrite` grouping).
- (d) S-phase / substrate sufficiency: engine-spec §34.19 S-ACTIVATED-ABILITY envelope = high/shipped for cost, target, stack/no-stack, atomicity; §34.11 S-EVENTS/MANA item 6 = high/shipped for literal/guided mana write catalog; §34.18 event envelope = partial for downstream damage/life/draw side effects. Residual candidate should be effect-consumer coverage/audit only, not a full re-open of shipped envelopes.
- (e) plannedSequence note draft: "MyDeck 最大 raw demand(cost:activation 232/cost:tap 201/mana:write 150)。§34.19 activation envelope と §34.11 mana-write catalog は shipped 済みなので、次候補にするなら residual audit + effect consumer 接続のみ。CR 602/605 正本。"
- (f) Golden candidates: Mother of Runes; Priest of Fell Rites; Sol Ring.

## 2. `cr-110-permanent-status-tap-state`

- (a) Proposed domainId: `cr-110-permanent-status-tap-state`
- (b) CR grounding: CR 110.5 - "A permanent's status is its physical state."
- (c) MyDeck demand: `tap-state:write=108`, plus adjacent `cost:tap=201` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.19 covers self `{T}` activation cost; §34.13/§34.14 cover combat attacker tap and combat state; §34.12 has cleanup surrogate for marked damage, not general tap; §34.17 player-specific zones is drafted and relevant for "put onto battlefield tapped" owner routing; §34.18 provides zone-change/draw/life event envelope but not general tap/untap event. Sufficiency: medium.
- (e) plannedSequence note draft: "tap-state:write 108 は ETB tapped / put-onto-battlefield tapped / tap another permanent が混在。既存 §34.19 は cost tap、§34.13/34.14 は combat tap まで。CR 110.5/701.26 正本で permanent status write の leaf/substrate 境界を切る。"
- (f) Golden candidates: Bojuka Bog; Evolving Wilds; Relic of Legends.

## 3. `cr-115-targets`

- (a) Proposed domainId: `cr-115-targets`
- (b) CR grounding: CR 115.1c - "The target(s) are chosen as the ability is activated; see rule 602.2b."
- (c) MyDeck demand: `target:object-or-player=97` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.19 target envelope = high for activated abilities; §34.18 event envelope = useful for target-linked effects; §34.17 player-specific zones = drafted and needed for target player library/hand/graveyard cases; ledger `cr-115-targets` status = drafted with no golden. Sufficiency: medium.
- (e) plannedSequence note draft: "target:object-or-player 97。§34.19 で activation-time target 保存はあるが、CR 115 全般(target spell/trigger/guided target filters/legality)は drafted。Path/Skyclave/Mother 系を target envelope 上に接続。CR 115 正本。"
- (f) Golden candidates: Mother of Runes; Path to Exile; Skyclave Apparition.

## 4. `cr-701-sacrifice-leaf`

- (a) Proposed domainId: `cr-701-sacrifice-leaf`
- (b) CR grounding: CR 701.21a - "To sacrifice a permanent, its controller moves it from the battlefield directly to its owner's graveyard."
- (c) MyDeck demand: `action:sacrifice=74`, `cost:nonmana=58`, `event:sacrifice=9` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.19 nonmana cost components = high for sacrifice-as-cost envelope; §34.18 zone-change event envelope = high for movement, but no dedicated sacrifice event; §34.17 player-specific graveyard = drafted and needed for owner routing; ledger `cr-701-keyword-actions-frequent` = implemented-not-green. Sufficiency: medium-high for cost sacrifice, medium for effect/each-player sacrifice.
- (e) plannedSequence note draft: "action:sacrifice 74 は cr-701 action 動詞最大。§34.19 nonmana cost はあるため self/non-self sacrifice cost を command 化しやすい。effect sacrifice と event:sacrifice は §34.18 zone-change cause を足して leaf 化。CR 701.21 正本。"
- (f) Golden candidates: Cathar Commando; Accursed Marauder; Sakura-Tribe Elder.

## 5. `cr-121-draw-action-leaf`

- (a) Proposed domainId: `cr-121-draw-action-leaf`
- (b) CR grounding: CR 121.2 - "Cards may only be drawn one at a time."
- (c) MyDeck demand: `action:draw=65`, `event:draw=25` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.18 S-EVENTS life/damage/draw envelope = high/shipped for DrawEvent, empty-library attempt, and multi-draw individual event shape; §34.17 player-specific zones = drafted and relevant for each-player/opponent draw; ledger `cr-121-drawing` = implemented-not-green. Sufficiency: high for P1 draw, medium for each player/opponent draw.
- (e) plannedSequence note draft: "action:draw 65/event:draw 25。§34.18 draw envelope は shipped 済みなので、leaf compiler は `Draw N`/discard-then-draw/wheel 系を individual DrawEvent へ載せる候補。each-player draw は §34.17 後に正直化。CR 121 正本。"
- (f) Golden candidates: Gitaxian Probe; Celes, Rune Knight; Mind Stone.

## 6. `cr-701-search-shuffle-leaf`

- (a) Proposed domainId: `cr-701-search-shuffle-leaf`
- (b) CR grounding: CR 701.23a - "To search for a card in a zone, look at all cards in that zone (even if it's a hidden zone) and find a card that matches the given description."
- (c) MyDeck demand: `action:search=36`, `action:shuffle=36`, `zone:library=15` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.17 player-specific library/hand/graveyard = drafted and important for target-player library search; §34.18 zone-change envelope = high for moving found cards; §34.19 activation envelope = high for fetch-land costs; deterministic shuffle must use command payload order per engine discipline. Sufficiency: medium for P1 solo fetch/search, lower for target player's library.
- (e) plannedSequence note draft: "search/shuffle は 36/36 で同数。fetch land/ramp/tutor が実デッキで広く踏む。§34.17 player-specific library 未実装のため P1 search から切るか、zonesByPlayer 実装後に正直化。CR 701.23/701.24 正本。"
- (f) Golden candidates: Evolving Wilds; Fabled Passage; Nature's Lore.

## 7. `cr-701-exile-lki-leaf`

- (a) Proposed domainId: `cr-701-exile-lki-leaf`
- (b) CR grounding: CR 701.13a - "To exile an object, move it to the exile zone from wherever it is."
- (c) MyDeck demand: `action:exile=35`, adjacent `object-identity:lki=28` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.18 event envelope = high for zone-change event surface; ledger `cr-400-408-zones-lki` = review-green for new-object/LKI core; §34.17 player-specific zones = drafted for owner routing; §34.19 target envelope = high for activated targeted exile. Sufficiency: medium-high for simple targeted exile, medium for blink/linked-exile/exiled-with.
- (e) plannedSequence note draft: "action:exile 35/object-identity:lki 28。simple exile は zone-change + LKI core 上に載るが、Skyclave/Thassa/linked exile は exiled object reference を要する。CR 701.13/400.7 正本。"
- (f) Golden candidates: Path to Exile; Skyclave Apparition; Thassa, Deep-Dwelling.

## 8. `cr-120-damage-write-event`

- (a) Proposed domainId: `cr-120-damage-write-event`
- (b) CR grounding: CR 120.1 - "An object that deals damage is the source of that damage."
- (c) MyDeck demand: `damage:write=33`, `event:damage=7`, adjacent `life:write=17` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.12 damage-marked substrate = medium-high for creature marked damage and 704.5g/h; §34.14 combat slice 2 = medium-high for combat player life damage; §34.18 damage event = type-only with source-backed emission deferred; §34.15 defeat advisory = available for life zero. Sufficiency: medium.
- (e) plannedSequence note draft: "damage:write 33 は combat 以外の source-backed damage が中心。§34.18 damage は type-only なので DamageEvent emission + damage-result link(lifeChange/marked damage)を追加する候補。replacement/prevention は §34.5/614/615 carry。CR 120 正本。"
- (f) Golden candidates: Blasphemous Act; Talisman of Conviction; Niv-Mizzet, Parun.

## 9. `cr-111-token-create-modifiers`

- (a) Proposed domainId: `cr-111-token-create-modifiers`
- (b) CR grounding: CR 111.10 - "Some effects instruct a player to create a predefined token."
- (c) MyDeck demand: `token:create=32`, adjacent `tap-state:write=108` for tapped tokens (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: ledger `cr-111-tokens` is shipped for selected predefined tokens and token dies-before-ceases; §34.10 priority loop supports token-created trigger placement; §34.18 event envelope can carry zone-change/event evidence; §34.19 activation envelope covers activated token creation such as Reflection of Kiki-Jiki. Sufficiency: high for fixed Treasure/Clue/Food/Blood, medium-low for arbitrary creature tokens, tapped tokens, variable P/T, copy tokens.
- (e) plannedSequence note draft: "token:create 32。cr-111 predefined leaf は一部 shipped 済みだが、実デッキは tapped Treasure/custom creature token/copy token が残る。既存 token substrate を使い、custom/tapped/copy を auto/guided/manual に正直分類。CR 111.10/701.7 正本。"
- (f) Golden candidates: Tataru Taru; Liliana, Dreadhorde General; Ragavan, Nimble Pilferer.

## 10. `cr-400-return-zone-change-leaf`

- (a) Proposed domainId: `cr-400-return-zone-change-leaf`
- (b) CR grounding: CR 400.6 - "If an object would move from one zone to another, determine what event is moving the object."
- (c) MyDeck demand: `action:return=31`, adjacent `object-identity:lki=28`, `target:object-or-player=97`, `tap-state:write=108` (`report.json.missingDemandCounts`; cross-checked via `gaps.json` grouping).
- (d) S-phase / substrate sufficiency: §34.17 player-specific zones = drafted and important for graveyard-to-battlefield/hand owner routing; §34.18 zone-change/draw/life event envelope = high for movement surface; ledger `cr-400-408-zones-lki` = review-green for new object/LKI; §34.19 target envelope = high for activated returns. Sufficiency: medium.
- (e) plannedSequence note draft: "action:return 31 は reanimation/blink/fetch result に広く出る。zone-change/LKI core はあるが、owner routing と tapped/attacking modifiers は §34.17/110 status 依存。単純 graveyard→battlefield/hand から leaf 化候補。CR 400.6/400.7 正本。"
- (f) Golden candidates: Karmic Guide; Sun Titan; Priest of Fell Rites.

## Omitted near-head demand noted for judge

- `action:discard=34` is not listed as a batch2 candidate because the current ledger says discard leaf shipped in `cr-701-keyword-actions-frequent` after the 2026-07-02 MyDeck scoring snapshot. If the judge wants raw demand only, it slots between `action:exile=35` and `damage:write=33`.
- `action:destroy=11`, `replacement=11`, `counter:write=14`, and `cast-permission:from-zone=10` remain visible but lower than the 10 candidates above by raw demand.
