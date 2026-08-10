# O4P-01L-R: control/access CR matrix

Status: requirements draft only. Base PLAN_SHA: `be3240e77e2c1cfc6be30707bbc3f052c2524b9a`.
No row below claims automation merely because the CR makes the outcome deterministic.

## Scope

This matrix defines the information, authority, and future command boundaries for control-changing effects, player-control effects, zone access, and the permissions that follow them. It covers ordinary Commander multiplayer semantics and the object/decision distinctions needed by the engine. It does not authorize implementation, alter existing contracts, or choose card-specific Oracle interpretations without verified English Oracle text.

Classification vocabulary is closed: `STRUCTURE_V1`, `QUERY_V1`, `OPERATION_V1`, `LAYER_DEPENDENCY_LATER`, `COMMAND_LATER`, `PROJECTION_LATER`, `OUT_OF_SCOPE`.

## Fixed ruleset

- Ruleset: `mtg-cr-2026-06-19`, effective 2026-06-19.
- Local authority: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`.
- Pinned SHA-256: `e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`.
- Oracle wording is authoritative for a card’s text (CR 108.1); printed text is not a rules substitute.
- Golden rules and impossibility: CR 101.1–101.3. A contradiction is not silently resolved by an automation guess.

## Object, permanent, and spell controller

| Rule | Requirement | Classification |
|---|---|---|
| CR 108.3–108.4a | Store card owner; cards without a controller answer controller queries with owner. | `STRUCTURE_V1` |
| CR 109.1, 109.4 | Objects include cards, copies, spells, permanents, abilities, tokens; only stack/battlefield objects normally have controllers. | `STRUCTURE_V1` |
| CR 110.1–110.2 | Permanent owner follows its card; default controller is the player under whose control it entered. | `STRUCTURE_V1` |
| CR 112.1–112.2 | A spell is a card on the stack; its default controller is the player who put it there. | `STRUCTURE_V1` |
| CR 405.4 | Activated ability controller is activator; triggered ability controller is source controller at trigger time; delayed triggers use CR 603.7d–f. | `QUERY_V1` |
| CR 109.5 | “You/your” resolves through the applicable object, would-be controller, owner, or ability controller. | `QUERY_V1` |

## Control effects

| Scenario / invariant | CR anchor | Classification |
|---|---|---|
| Indefinite theft with no duration lasts to game end. | CR 611.1–611.2a | `LAYER_DEPENDENCY_LATER` |
| End-of-turn theft expires at the stated boundary, not when source leaves. | CR 611.2a; CR 513.1 | `LAYER_DEPENDENCY_LATER` |
| “For as long as” theft starts, continuously checks its duration, and can fail to start or end before application. | CR 611.2b | `LAYER_DEPENDENCY_LATER` |
| Multiple control-changing effects apply in Layer 2, normally timestamp order; dependency can alter order. | CR 613.1b, 613.5, 613.7–613.8 | `LAYER_DEPENDENCY_LATER` |
| Source disappears after a resolved effect: the independent continuous effect remains for its duration. | CR 113.7a; CR 611.2a | `QUERY_V1` |
| Source changes controller after creating a resolved control effect: do not rebase the already-created effect unless its text says so. | CR 611.2c; CR 613.7 | `QUERY_V1` |
| Attached effect (Aura/equipment-like source) depends on the source’s continuing existence and applicable zone; attachment is separately tracked. | CR 303.4, 301.5; CR 611.3a–b | `LAYER_DEPENDENCY_LATER` |
| A permanent leaves and returns: it is a new object; a control effect does not follow it except CR 400.7 exceptions. | CR 400.7, 403.4 | `QUERY_V1` |
| Effect changes controller of a permanent spell and it resolves: the control change can carry to the permanent. | CR 400.7a; CR 110.2b | `LAYER_DEPENDENCY_LATER` |

## Layer 2 / order

Control-changing effects are Layer 2 (CR 613.1b). The engine must retain effect timestamp, affected-set semantics, duration, dependency inputs, and the distinction between an effect from resolution and a static effect. Resolved effects lock the affected set when they begin (CR 611.2c); static effects evaluate their text against the current game (CR 611.3a). Dependency is a later resolver concern (CR 613.8), not an array-sort heuristic. Classification: `LAYER_DEPENDENCY_LATER`.

## Duration

| Case | CR anchor | Classification |
|---|---|---|
| No stated duration | CR 611.2a | `QUERY_V1` |
| Until end of turn / next end step | CR 611.2a; CR 513.1 | `QUERY_V1` |
| Until a specified event, including temporary zone return | CR 610.3–610.3d | `QUERY_V1` |
| “For as long as” source/object/controller relation | CR 611.2b | `LAYER_DEPENDENCY_LATER` |
| Delayed trigger created by a one-shot effect | CR 610.2; CR 603.7 | `COMMAND_LATER` |

## Search

| Scenario | CR anchor | Classification |
|---|---|---|
| Search owner’s library for owner/opponent/qualified card | CR 701.19a–d; CR 108.3; CR 609.3 | `QUERY_V1` |
| Search a specified quantity or “up to” quantity | CR 701.19a, 701.19c | `QUERY_V1` |
| Fail to find when a search is instructed | CR 701.19b | `QUERY_V1` |
| Partial search followed by another instruction | CR 701.19a–b; CR 609.3 | `COMMAND_LATER` |
| Search is optional, mandatory, or controlled by “may” | CR 701.19a; CR 608.2d | `QUERY_V1` |
| Reveal searched card when instructed, then move it; otherwise do not infer reveal. | CR 701.19a; CR 701.20 | `OPERATION_V1` |
| Search plus shuffle, preserving the required library-order operation. | CR 401.2, 701.19a | `COMMAND_LATER` |

## Look / reveal

| Scenario | CR anchor | Classification |
|---|---|---|
| Look at a hidden card or top card without revealing it | CR 701.17; CR 401.5; CR 402.3 | `QUERY_V1` |
| Reveal one or more cards; revelation is public information for the stated interval. | CR 701.20 | `OPERATION_V1` |
| Top look/reveal and top-card replacement during casting/activation/special action | CR 401.5–401.6; CR 601.2i; CR 602.2 | `QUERY_V1` |
| Revealed hand remains a hidden zone; revelation does not make the hand public by default. | CR 400.2; CR 402.3; CR 701.20 | `PROJECTION_LATER` |
| No-reveal branch: a card may remain hidden when the effect does not instruct revelation. | CR 400.2; CR 701.20 | `QUERY_V1` |

## Hidden / public zones

| Zone rule | CR anchor | Classification |
|---|---|---|
| Each player has their own library, hand, graveyard; battlefield, stack, exile, command are shared. | CR 400.1 | `STRUCTURE_V1` |
| Library and hand are hidden; graveyard, battlefield, stack, exile, command are public unless cards are specifically face down. | CR 400.2 | `STRUCTURE_V1` |
| A card moved to another player’s library, hand, or graveyard goes to its owner’s corresponding zone. | CR 400.3 | `OPERATION_V1` |
| Library order cannot be inspected/reordered except where an effect or rule permits. | CR 400.5; CR 401.2 | `QUERY_V1` |
| Public-zone cards may be examined subject to a specific face-down rule. | CR 400.2; CR 404.2; CR 406.3 | `PROJECTION_LATER` |

## Face-down battlefield / stack / exile

| Scenario | CR anchor | Classification |
|---|---|---|
| Face-down permanent/spell has only the characteristics supplied by the enabling rule/effect. | CR 708.1–708.4 | `STRUCTURE_V1` |
| Controller may look at their own face-down permanent or stack spell, not another player’s. | CR 708.5 | `QUERY_V1` |
| Face-down permanent/spell must remain distinguishable from other face-down objects. | CR 708.6 | `PROJECTION_LATER` |
| Face-down battlefield object leaves: owner reveals it while moving. | CR 708.9 | `OPERATION_V1` |
| Face-down stack spell leaves to a non-battlefield zone: owner reveals it. | CR 708.9 | `OPERATION_V1` |
| Face-down exile has no characteristics; only an allowed player may look, and the permission can persist until leaving exile or shuffle. | CR 406.3–406.5 | `QUERY_V1` |
| Face-down exile pile identity and random selection when chooser cannot look. | CR 406.4 | `QUERY_V1` |
| Face-down exile persists as a distinct object/pile until a zone change; re-exile creates a new object. | CR 400.8; CR 406.7 | `STRUCTURE_V1` |

## Play permission

| Scenario | CR anchor | Classification |
|---|---|---|
| “Play a card” means play as a land or cast as a spell as appropriate. | CR 601.1a | `QUERY_V1` |
| Cast/play from exile, top of library, or an opponent-owned zone only when an effect/rule grants that permission and all normal requirements are met. | CR 601.2, 601.3; CR 611.3d; CR 400.7g–i | `QUERY_V1` |
| Permission belongs to the specified player, not automatically the card owner or permanent controller. | CR 601.3; CR 109.5 | `QUERY_V1` |
| Casting moves the card/copy to stack and creates a new spell object; play-as-land moves it to battlefield. | CR 601.2a; CR 305.1 | `OPERATION_V1` |
| A permission effect that tracks a card across the move to stack/battlefield follows only the CR 400.7 exceptions. | CR 400.7g–i | `COMMAND_LATER` |
| “May cast/play without paying” does not remove timing, targeting, or other requirements unless the effect says so. | CR 601.2, 601.3; CR 609.4 | `QUERY_V1` |

## Controlling another player

| Scenario | CR anchor | Classification |
|---|---|---|
| Full-turn control applies to the next turn the affected player actually takes and ends at the next turn’s beginning. | CR 723.1 | `STRUCTURE_V1` |
| Multiple player-control effects overwrite; latest created effect works. | CR 723.1a | `QUERY_V1` |
| A skipped turn delays the pending player-control effect. | CR 723.1b | `QUERY_V1` |
| Limited-duration player control is distinct from object control. | CR 723.2–723.3 | `STRUCTURE_V1` |
| Controller makes choices/decisions the controlled player is allowed or required to make, including play and spell/ability choices. | CR 723.5 | `OPERATION_V1` |
| Controlled player’s resources pay the controlled player’s costs; controller cannot use their own resources for those costs. | CR 723.5a | `QUERY_V1` |
| Controller cannot make choices not called for by rules/objects or tournament rules choices. | CR 723.5b | `QUERY_V1` |
| Controlled player may concede; controller cannot make them concede. | CR 723.6; CR 104.3a | `OPERATION_V1` |
| Controller continues making their own decisions while controlling another player. | CR 723.8 | `QUERY_V1` |

## Resource ownership

| Scenario | CR anchor | Classification |
|---|---|---|
| Owner is a persistent card property; controller is contextual and may change. | CR 108.3–108.4; CR 110.2 | `STRUCTURE_V1` |
| A player controlling another player uses only the controlled player’s cards, mana, and other resources. | CR 723.5a | `QUERY_V1` |
| Controlled objects remain under their normal controllers; player control does not mass-change object control. | CR 723.3 | `QUERY_V1` |
| Concession is a player action, not a spendable resource and not delegable by player-control effect. | CR 723.6; CR 104.3a | `OUT_OF_SCOPE` |

## Decision-maker visibility

| Scenario | CR anchor | Classification |
|---|---|---|
| Information visible to the controlled player is visible to the player controlling them. | CR 723.4 | `PROJECTION_LATER` |
| Information about cards outside the game visible to the controlled player is not thereby visible to the controller. | CR 723.4 | `PROJECTION_LATER` |
| Decision authority follows “player allowed/required to choose,” not merely object controller. | CR 723.5; CR 109.5 | `QUERY_V1` |
| A decision-specific effect may restrict or require actions without granting general player control. | CR 723.7; CR 609.4 | `QUERY_V1` |
| APNAP determines simultaneous choices; prior hidden choices remain hidden where CR permits. | CR 101.4–101.4d | `COMMAND_LATER` |

## Required state

The future state contract must be able to represent, without conflation: player identity, active player and turn/step; card owner; object incarnation/zone identity; zone and ordered contents; face-up/face-down status; permitted viewers; revealed intervals; permanent/spell/ability controller; effect source and timestamp; affected-set snapshot; duration/event watcher; Layer-2 dependency inputs; attached-object relation; permission actor, source zone, and permitted action; player-control actor/subject/duration; player resources; pending choices and decision authority; and public/private projections. Classification: `STRUCTURE_V1` for stable identity/ownership/zone/controller fields; `QUERY_V1` for derived authority and visibility; `PROJECTION_LATER` for audience-specific views.

## Acceptance tests

These are requirements scenarios, not implementation claims. A future executable replay must prove final `GameState`, not only emitted text.

1. Indefinite theft, EOT theft, multiple theft effects, source removal, source controller change, and attached-source removal resolve with CR 611/613 outcomes.
2. A stolen permanent leaves and returns as a new object; a stolen permanent spell’s control carries only under CR 400.7a.
3. A stack spell, copied spell, activated ability, and triggered ability report the correct owner/controller/source boundary under CR 109/112/405/707.
4. Search distinguishes owner’s library, opponent’s library, qualified cards, exact quantity, up-to quantity, fail-to-find, partial search, reveal, no-reveal, and required shuffle.
5. Look and reveal distinguish top-library access, top-card replacement during cast/activation, and a revealed hand that remains a hidden zone.
6. Face-down battlefield, stack, and exile preserve characteristics, permitted viewers, reveal-on-leave, pile identity, random selection, and exile persistence.
7. Permission tests cover cast/play from exile, top library, and opponent-owned zones, including normal timing and cost requirements.
8. Full-turn and limited player control cover overwrite, skipped turn, controlled resources/objects, controlled decisions, visibility, and concession.
9. A decision-specific authority test demonstrates that only the decision named by the effect is transferred; unrelated choices remain with the proper player.
10. A stale snapshot test rejects using old controller/visibility data after a relevant zone change, while retaining CR 400.7 last-known-information exceptions where applicable.

## DEFER

- `LAYER_DEPENDENCY_LATER`: full Layer 2 dependency graph, timestamp resolver, and continuous-effect affected-set engine.
- `COMMAND_LATER`: zone-moving command sequences, delayed triggers, search/shuffle transactions, cast/play transactions, and player-control turn commands.
- `PROJECTION_LATER`: audience-specific hidden information, revealed intervals, face-down permissions, and controlled-player visibility projection.
- `OUT_OF_SCOPE`: tournament-rule choices, external-game card information beyond the explicit CR/player-control boundary, unsupported Commander replacement/card-specific interactions, and concession as an automatable command under player control.
- Any card-specific interpretation that lacks pinned English Oracle text remains guided/manual; no partial control or access behavior is reported as automated.

## Contradictions

1. “Controller” is undefined for most cards outside the stack/battlefield (CR 108.4, 109.4), while UI/search language may colloquially say “controller”; the query must use owner fallback only where CR 108.4a applies.
2. Player control transfers choices but does not transfer object control (CR 723.3), and transfers visibility only for information visible to the controlled player (CR 723.4); a single generic `controllerId` cannot represent both.
3. Resolved control effects lock affected sets (CR 611.2c), static control effects reevaluate (CR 611.3a), and Layer 2 dependency can change order (CR 613.8); snapshotting alone is insufficient.
4. A face-down exile card is in a public zone but is not publicly knowable (CR 400.2, 406.3); zone visibility and card-face visibility must remain separate.
5. “Search” can be private, public, partial, optional, quantity-bounded, and followed by a reveal or shuffle (CR 701.19); one generic search operation would erase mandatory distinctions.
6. Zone changes create new objects (CR 400.7), but specified effects can track the new object (CR 400.7g–j); physical card identity and CR object identity must not be conflated.

