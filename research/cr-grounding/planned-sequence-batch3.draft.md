# plannedSequence batch3 candidate draft

Status: draft-only / non-claim.

Source inputs:
- `research/mydeck-scoring/gaps.json`: 521 rows measured; demand is raw `missingReadWrite` occurrence count.
- `research/cr-grounding/cr-backbone-ledger.json`: `plannedSequence` is empty; `selectionRule` says refill candidates by MyDeck demand, then judge fills the ledger.
- CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` fixed at 2026-06-19.

This file does not decide priority, scope, or ledger updates. Final plannedSequence selection remains judge-owned.

## Excluded Before Candidate Selection

These high raw-demand tags are not proposed as batch3 candidates here because the ledger marks the corresponding catalog/substrate as already shipped in batch1/batch2 or directly called out by the brief as filled: `cost:activation` 232, `cost:tap` 201, `mana:write` 150, `tap-state:write` 108, battlefield target filter `target:object-or-player` 97, shipped frequent action leaves such as self/single `action:sacrifice` 74, fixed `action:draw` 65, shipped nonmana cost forms `cost:nonmana` 58, shipped search/shuffle/ramp leaves where applicable, simple exile/discard, source-backed noncombat damage, predefined/custom token creation, strict reanimation, linked exile, and `zonesByPlayer` storage.

Remaining candidates below therefore focus on gaps that still map to non-shipped ledger domains, plus one explicitly flagged residual leaf under a shipped domain.

## Candidate Demand Order

| demand | domainId | status in ledger | demand tags included | note |
|---:|---|---|---|---|
| 100 | `cr-603-triggers-apnap` | `implemented-not-green` | all `event:*` tags 87 + `delayed-trigger` 10 + `cast-timing:once-per-turn` 3 | trigger/event substrate and delayed trigger scheduling |
| 37 | `cr-608-resolution` | `drafted` | `object-identity:lki` 28 + `action:counter-spell` 9 | resolution-time LKI / stack spell countering; related to `cr-109-objects` and `cr-112-spells` |
| 23 | `cr-701-keyword-actions-frequent` | `shipped` | `action:mill` 10 + `action:surveil` 6 + `action:reveal` 6 + `action:scry` 1 | residual leaf only; domain itself is shipped, judge should confirm whether to reopen or split |
| 22 | `cr-122-counters` | `implemented-not-green` | `counter:write` 14 + `event:counter` 8 | counter write/event leaf and counter-specific state semantics |
| 13 | `cr-604-611-612-613-layers-continuous` | `drafted` | `layer:L4` 10 + `layer:L6` 2 + `layer:L1b` 1 | minimal effective-characteristics/layer substrate |
| 12 | `cr-614-615-616-replacement-prevention` | `drafted` | `replacement` 11 + `prevention` 1 | replacement/prevention effects, especially ETB replacement and damage prevention |
| 10 | `cr-601-casting-stack` | `implemented-not-green` | `cast-permission:from-zone` 10 | cast/play permission from graveyard/exile and stack entry hooks |
| 10 | `cr-modal-target-optional-variable` | `drafted` | `choice:mode-or-value` 10 | modal/value choice envelope, target coupling, variable choice |

## Candidate Details

### `cr-603-triggers-apnap`

- Demand: 100 = `event:*` 87 + `delayed-trigger` 10 + `cast-timing:once-per-turn` 3.
- CR grounding: 603.1, 603.2, 603.2h, 603.3, 603.3b, 603.3c, 603.4, 603.6, 603.7, 603.10a, 117.5, 101.4.
- Golden candidate cards from gaps:
  - `Baleful Strix`: ETB draw trigger (`event:draw`).
  - `Banon, the Returners' Leader`: attack trigger with discard/draw event reads.
  - `Bloodchief Ascension`: life-loss/counter trigger with intervening condition.
  - `Arcane Denial`: delayed upkeep draw trigger.
  - `Defiled Crypt // Cadaver Lab` / `Enduring Innocence` / `Tataru Taru`: "triggers only once each turn" cases.
- Possible scope sketch:
  - Auto/guided substrate for event subscriptions that already have emitted events: draw, discard, sacrifice, counter placement, damage, life change, zone/card-left-graveyard, attack/block/cast/enter predicates.
  - Add delayed trigger records for "at the beginning of the next ...", especially next upkeep/end step, without silently executing unsupported future timing.
  - Preserve APNAP/two-bucket semantics; use manual fallback for underspecified event predicates, complex "for as long as", and triggers requiring unsupported derived state.

### `cr-608-resolution`

- Demand: 37 = `object-identity:lki` 28 + `action:counter-spell` 9.
- CR grounding: 608.2b, 608.2d, 608.2h, 113.7a, 400.7, 400.7e, 400.7j, 701.6a, 112.1, 405.
- Golden candidate cards from gaps:
  - `Feed the Swarm`: target permanent mana value via LKI after destruction.
  - `Mana Drain`: countered spell mana value used by a delayed/add-mana effect.
  - `Arcane Denial` / `An Offer You Can't Refuse`: counter target spell plus follow-up effects.
  - `Extraction Specialist`: returned object receives a continuing "can't attack or block" restriction.
  - `Kaya's Ghostform` / `Animate Dead`: public-zone object finding and source/attached object LKI.
- Possible scope sketch:
  - Add a narrow `resolutionContext`/LKI read path for information needed by the same resolving spell or ability.
  - Cover simple "counter target spell" on stack: target spell object leaves stack to owner graveyard, no cost refund, no effect resolution.
  - Keep copies, multi-target partial resolution, all-target-illegal generalization, and broad 400.7 exceptions manual unless explicitly goldened.

### `cr-701-keyword-actions-frequent` residual leaf

- Demand: 23 = `action:mill` 10 + `action:surveil` 6 + `action:reveal` 6 + `action:scry` 1.
- Ledger note: main domain status is `shipped`; this is a residual leaf candidate only because these tags remain unfilled in `gaps.json`. Judge should decide whether this belongs in a new leaf domain or a reopened `cr-701` follow-up.
- CR grounding: 701.17a-d (mill), 701.20a-e (reveal/look), 701.22a-d (scry), 701.25a-d (surveil), 121.5, 400.7j.
- Golden candidate cards from gaps:
  - `Aftermath Analyst`: ETB mill three.
  - `Grave Researcher // Reanimate`: surveil 1 then condition.
  - `The Clone Saga`: surveil 3.
  - `Cultivate` / `Kodama's Reach` / `Flare of Cultivation`: reveal searched cards.
  - `Path of Ancestry`: scry 1 after mana-spend trigger.
- Possible scope sketch:
  - Auto/guided fixed-count self-library mill and surveil with deterministic chosen ordering/moves.
  - Reveal/look metadata for already-selected cards without moving zones.
  - Scry fixed N with player-chosen top/bottom ordering encoded in command payload.
  - Manual for multi-player simultaneous scry, hidden-zone irreversible reveal edge cases, replacement-modified mill, and any unsupported search composite.

### `cr-122-counters`

- Demand: 22 = `counter:write` 14 + `event:counter` 8.
- CR grounding: 122.1, 122.1a, 122.1b, 122.1c, 122.1h, 122.2, 122.3, 122.4, 122.6, 122.7, 704.5c, 704.5q.
- Golden candidate cards from gaps:
  - `Alesha, Who Laughs at Fate`: put a +1/+1 counter on itself.
  - `Bloodchief Ascension`: quest counters and "three or more quest counters" condition.
  - `Celes, Rune Knight`: put +1/+1 counters on each creature you control.
  - `Emperor of Bones`: finality counter plus "whenever counters are put" trigger.
  - `The One Ring`: burden counter count then draw that many.
- Possible scope sketch:
  - Auto/guided fixed counter writes to battlefield permanents and players where target set is already determined.
  - Emit counter-placement event so `event:counter` trigger predicates can observe it.
  - Keep shield/stun/finality replacement semantics, battle defense, rad counters, and Saga lore counters manual/deferred unless chosen as separate scope.

### `cr-604-611-612-613-layers-continuous`

- Demand: 13 = `layer:L4` 10 + `layer:L6` 2 + `layer:L1b` 1.
- CR grounding: 604.1, 604.3, 611.2, 611.2a, 611.2c, 611.2e, 612.1, 613.1, 613.1a, 613.1d, 613.1f, 613.10, 613.11.
- Golden candidate cards from gaps:
  - `Devastating Onslaught`: tokens gain haste until end of turn.
  - `Fable of the Mirror-Breaker // Reflection of Kiki-Jiki`: copy token gains haste.
  - `Gogo, Mysterious Mime`: temporary copy/name/PT effect.
  - `Fear of Missing Out` / `Grave Researcher // Reanimate`: card-type counts in graveyard.
  - `Path of Ancestry`: shared creature type condition.
- Possible scope sketch:
  - Minimal `computeEffectiveCharacteristics` entrance for L4 type/subtype checks and L6 granted keyword/ability effects needed by other leaves.
  - Start with bounded until-EOT grants and read-only characteristic queries for conditions.
  - Manual for dependency graph, timestamps beyond simple latest effect, copy layer completeness, text-changing, and control-changing effects.

### `cr-614-615-616-replacement-prevention`

- Demand: 12 = `replacement` 11 + `prevention` 1.
- CR grounding: 614.1, 614.1a-d, 614.10, 614.11, 614.12, 614.15, 614.17, 615.1, 615.1a, 615.10, 615.12, 616.1.
- Golden candidate cards from gaps:
  - `Blood Crypt` / `Breeding Pool` / `Godless Shrine` / `Watery Grave`: "As this land enters, you may pay 2 life. If you don't, it enters tapped."
  - `Everflowing Chalice`: enters with charge counters for kicker count.
  - `Emet-Selch, Unsundered // Hades, Sorcerer of Eld`: graveyard replacement to exile.
  - `Spore Frog`: prevent all combat damage this turn.
  - `Kuja, Genome Sorcerer // Trance Kuja, Fate Defied`: damage doubling replacement.
- Possible scope sketch:
  - Bounded ETB replacement for self-entering shockland-style "pay 2 life or enters tapped".
  - Narrow graveyard-to-exile replacement hook for a single controller/source.
  - Single-turn combat damage prevention shield as advisory/guided until damage-prevention integration is selected.
  - Manual for multiple competing replacement/prevention effects, regeneration, draw replacement, and damage-doubling arithmetic unless separately goldened.

### `cr-601-casting-stack`

- Demand: 10 = `cast-permission:from-zone` 10.
- CR grounding: 601.2a, 601.2b, 601.2f, 601.2i, 113.6e, 113.6f, 400.7g, 400.7h, 701.18a-b, 702.187, 702.180, 702.185.
- Golden candidate cards from gaps:
  - `Lurrus of the Dream-Den`: once each turn cast permanent spell from graveyard with mana value cap.
  - `Muldrotha, the Gravetide`: play land and cast permanent spells of each type from graveyard.
  - `Chainer, Nightmare Adept`: discard cost creates creature-spell-from-graveyard permission.
  - `Icetill Explorer`: play lands from graveyard.
  - `Sevinne's Reclamation`: spell was cast from graveyard follow-up.
- Possible scope sketch:
  - Guided permission records for "you may play/cast [bounded object class] from your graveyard this turn/during your turn/once this turn".
  - Track source permission and consumed-once constraints without implementing full CR 601 casting procedure.
  - Manual for free-cast, alternative-cost stacking, multi-type-per-turn accounting, copied spells, and broad exile permission.

### `cr-modal-target-optional-variable`

- Demand: 10 = `choice:mode-or-value` 10.
- CR grounding: 700.2, 700.2a-i, 601.2b, 601.2c, 603.3c, 608.2d, 107.3a.
- Golden candidate cards from gaps:
  - `Akroma's Will`: choose one / choose both if commander condition.
  - `Sheoldred's Edict`: modal opponent sacrifice choice.
  - `Mount Doom`: choose up to two creatures, then destroy the rest.
  - `Radiant Lotus`: choose a color and target player mana amount tied to sacrificed artifacts.
  - `Teval's Judgment`: choose a mode that has not been chosen this turn.
- Possible scope sketch:
  - Guided mode/value choice envelope that stores chosen modes/values before command generation or stack placement.
  - Couple chosen modes to target requirements only where target filters already support the target type.
  - Manual for "choose both" conditional complexity, repeated modes, pawprint modes, opponent-chosen modes, and variable target counts unless explicitly selected.

## STOP-Flagged Demand, Not Candidate Body

These map to `judge: "user-stop"` / pruned or deferred-by-demand ledger domains, so they are excluded from the candidate body. The numbers below are raw `missingReadWrite` occurrences from matching rows and are only flags, not priority claims.

| raw demand | domainId | judge | evidence |
|---:|---|---|---|
| 44 | `cr-714-sagas-deferred-by-demand` | `user-stop` | `Fable of the Mirror-Breaker`, `The Clone Saga`, `Urza's Saga`, `Binding the Old Gods`, `Summon: Knights of Round` rows have nonzero gaps. |
| 17 | `cr-716-719-720-721-722-new-card-frames-deferred-by-demand` | `user-stop` | Class/Room/Preparation-style rows: `Advanced Reconstruction`, `Cool but Rude`, `Defiled Crypt // Cadaver Lab`, `Grave Researcher // Reanimate`, `Emeritus of Truce // Swords to Plowshares`. |

## Non-Claim

This draft presents CR grounding plus measured demand only. It does not choose priority, finalize scope, reopen shipped domains, modify the ledger, or update docs. Judge should re-check CR text and demand arithmetic before filling `plannedSequence`.
