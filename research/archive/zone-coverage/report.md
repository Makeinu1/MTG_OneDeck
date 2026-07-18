# Zone Coverage Report

Measurement-only extraction for zone access, cross-player zone access, ownership language, and player scopes.

## Summary

- Generated at: 2026-06-25T14:46:34.225Z
- Input: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- totalCards: 17491
- mappedCards: 17491
- cards with zones: 12372 (70.73%)
- cross-player cards: 1067 (6.10%)
- multi-zone cards: 8396 (48.00%)
- churn: 0/17491 changed (0.00%), baselineCards=17491, byZone=none
- mapping failures: 0

## Zone Demand

| zone | card count | card rate | examples |
|---|---:|---:|---|
| battlefield | 9518 | 54.42% | Swords to Plowshares (rank 11); Path of Ancestry (rank 14); Path to Exile (rank 15); Evolving Wilds (rank 18); Cultivate (rank 20) |
| command | 36 | 0.21% | Command Beacon (rank 183); Opal Palace (rank 637); Hellkite Courser (rank 1908); Thunderclap Drake (rank 2110); The Ur-Dragon (rank 2577) |
| exile | 1788 | 10.22% | Swords to Plowshares (rank 11); Path to Exile (rank 15); Bojuka Bog (rank 25); Jeska's Will (rank 102); Teferi's Protection (rank 105) |
| graveyard | 5538 | 31.66% | Evolving Wilds (rank 18); Beast Within (rank 24); Bojuka Bog (rank 25); Myriad Landscape (rank 27); Terramorphic Expanse (rank 28) |
| hand | 4377 | 25.02% | Reliquary Tower (rank 10); Cultivate (rank 20); Thought Vessel (rank 21); Mind Stone (rank 32); Kodama's Reach (rank 37) |
| library | 4076 | 23.30% | Path to Exile (rank 15); Evolving Wilds (rank 18); Cultivate (rank 20); Farseek (rank 23); Rampant Growth (rank 26) |
| stack | 208 | 1.19% | Counterspell (rank 16); An Offer You Can't Refuse (rank 35); Negate (rank 54); Arcane Denial (rank 56); Swan Song (rank 73) |

## Cross-player Zone Access

- 1067 cards (6.10%)

- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 25 《Bojuka Bog》: When this land enters, exile target player's graveyard.
- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 43 《Rhystic Study》: Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.
- rank 51 《Cyclonic Rift》: Return target nonland permanent you don't control to its owner's hand.
- rank 62 《Smothering Tithe》: Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.
- rank 76 《Esper Sentinel》: Whenever an opponent casts their first noncreature spell each turn, draw a card unless that player pays {X}, where X is this creature's power.
- rank 78 《Boseiju, Who Endures》: Channel — {1}{G}, Discard this card: Destroy target artifact, enchantment, or nonbasic land an opponent controls. That player may search their library for a land card with a bas...
- rank 96 《Mystic Remora》: Whenever an opponent casts a noncreature spell, you may draw a card unless that player pays {4}.
- rank 102 《Jeska's Will》: Choose one. If you control a commander as you cast this spell, you may choose both instead. • Add {R} for each card in target opponent's hand. • Exile the top three cards of you...
- rank 124 《Assassin's Trophy》: Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.
- rank 152 《Windfall》: Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.
- rank 177 《Sink into Stupor // Soporific Springs》: Return target spell or nonland permanent an opponent controls to its owner's hand.
- rank 231 《Sign in Blood》: Target player draws two cards and loses 2 life.
- rank 252 《Syr Konrad, the Grim》: Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, Syr Konrad deals 1...

## Ownership Distribution

| ownership | card count | card rate | examples |
|---|---:|---:|---|
| both | 508 | 2.90% | Cyclonic Rift (rank 51); Otawara, Soaring City (rank 90); Sink into Stupor // Soporific Springs (rank 177); Hullbreaker Horror (rank 267); Simic Growth Chamber (rank 285) |
| controller | 6076 | 34.74% | Exotic Orchard (rank 9); Swords to Plowshares (rank 11); Path to Exile (rank 15); Fellwar Stone (rank 17); Beast Within (rank 24) |
| none | 10421 | 59.58% | Sol Ring (rank 1); Command Tower (rank 2); Arcane Signet (rank 3); Reliquary Tower (rank 10); Swiftfoot Boots (rank 12) |
| owner | 486 | 2.78% | Chaos Warp (rank 30); Sensei's Divining Top (rank 226); Force of Negation (rank 266); Snap (rank 268); Aetherize (rank 307) |

## Player Scope Distribution

| player scope | card count | card rate | examples |
|---|---:|---:|---|
| controller | 395 | 2.26% | Swords to Plowshares (rank 11); Path to Exile (rank 15); Beast Within (rank 24); An Offer You Can't Refuse (rank 35); Arcane Denial (rank 56) |
| each-opponent | 1881 | 10.75% | Exotic Orchard (rank 9); Fellwar Stone (rank 17); Rhystic Study (rank 43); Smothering Tithe (rank 62); Esper Sentinel (rank 76) |
| each-player | 1116 | 6.38% | Windfall (rank 152); Professional Face-Breaker (rank 216); Syr Konrad, the Grim (rank 252); Etali, Primal Storm (rank 260); Ragavan, Nimble Pilferer (rank 269) |
| owner | 799 | 4.57% | Chaos Warp (rank 30); Cyclonic Rift (rank 51); Otawara, Soaring City (rank 90); Sink into Stupor // Soporific Springs (rank 177); Sensei's Divining Top (rank 226) |
| target-player | 790 | 4.52% | Bojuka Bog (rank 25); Jeska's Will (rank 102); Blood Artist (rank 138); Boros Charm (rank 176); Sign in Blood (rank 231) |
| unknown | 166 | 0.95% | Curse of Opulence (rank 709); Kogla, the Titan Ape (rank 1186); Scourge of the Throne (rank 1280); Ulamog, the Ceaseless Hunger (rank 1291); Open the Way (rank 1658) |
| you | 11991 | 68.56% | Command Tower (rank 2); Arcane Signet (rank 3); Reliquary Tower (rank 10); Path of Ancestry (rank 14); Evolving Wilds (rank 18) |

## Zone Examples

### battlefield

- rank 11 《Swords to Plowshares》: Exile target creature. Its controller gains life equal to its power.
- rank 14 《Path of Ancestry》: This land enters tapped.
- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 22 《Blasphemous Act》: This spell costs {1} less to cast for each creature on the battlefield.
- rank 23 《Farseek》: Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.
- rank 24 《Beast Within》: Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
- rank 25 《Bojuka Bog》: This land enters tapped.
- rank 26 《Rampant Growth》: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 27 《Myriad Landscape》: This land enters tapped.
- rank 28 《Terramorphic Expanse》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 29 《Nature's Lore》: Search your library for a Forest card, put that card onto the battlefield, then shuffle.
- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 32 《Mind Stone》: {1}, {T}, Sacrifice this artifact: Draw a card.

### command

- rank 183 《Command Beacon》: {T}, Sacrifice this land: Put your commander into your hand from the command zone.
- rank 637 《Opal Palace》: {1}, {T}: Add one mana of any color in your commander's color identity. If you spend this mana to cast your commander, it enters with a number of additional +1/+1 counters on it...
- rank 1908 《Hellkite Courser》: When this creature enters, you may put a commander you own from the command zone onto the battlefield. It gains haste. Return it to the command zone at the beginning of the next...
- rank 2110 《Thunderclap Drake》: {2}{U}, Sacrifice this creature: When you next cast an instant or sorcery spell this turn, copy it for each time you've cast your commander from the command zone this game. You...
- rank 2577 《The Ur-Dragon》: Eminence — As long as The Ur-Dragon is in the command zone or on the battlefield, other Dragon spells you cast cost {1} less to cast.
- rank 2834 《Derevi, Empyrial Tactician》: {1}{G}{W}{U}: Put Derevi onto the battlefield from the command zone.
- rank 2999 《Geode Golem》: Whenever this creature deals combat damage to a player, you may cast your commander from the command zone without paying its mana cost.
- rank 3094 《Edgar Markov》: Eminence — Whenever you cast another Vampire spell, if Edgar is in the command zone or on the battlefield, create a 1/1 black Vampire creature token.
- rank 3302 《Stinging Study》: You draw X cards and you lose X life, where X is the mana value of a commander you own on the battlefield or in the command zone.
- rank 3661 《Tevesh Szat, Doom of Fools》: −10: Gain control of all commanders. Put all commanders from the command zone onto the battlefield under your control.
- rank 4182 《Study Hall》: {1}, {T}: Add one mana of any color. When you spend this mana to cast your commander, scry X, where X is the number of times it's been cast from the command zone this game.
- rank 4308 《Jeska, Thrice Reborn》: Jeska enters with a loyalty counter on her for each time you've cast a commander from the command zone this game.
- rank 5483 《Liesa, Shroud of Dusk》: Rather than pay {2} for each previous time you've cast this spell from the command zone this game, pay 2 life that many times.
- rank 5672 《Majestic Genesis》: Reveal the top X cards of your library, where X is the greatest mana value of a commander you own on the battlefield or in the command zone. You may put any number of permanent...
- rank 5803 《Campfire》: {2}, {T}, Exile this artifact: Put all commanders you own from the command zone and from your graveyard into your hand. Then shuffle your graveyard into your library.

### exile

- rank 11 《Swords to Plowshares》: Exile target creature. Its controller gains life equal to its power.
- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 25 《Bojuka Bog》: When this land enters, exile target player's graveyard.
- rank 102 《Jeska's Will》: Choose one. If you control a commander as you cast this spell, you may choose both instead. • Add {R} for each card in target opponent's hand. • Exile the top three cards of you...
- rank 105 《Teferi's Protection》: Exile Teferi's Protection.
- rank 112 《Deadly Rollick》: Exile target creature.
- rank 143 《Chrome Mox》: Imprint — When this artifact enters, you may exile a nonartifact, nonland card from your hand.
- rank 153 《Anguished Unmaking》: Exile target nonland permanent. You lose 3 life.
- rank 161 《Farewell》: Choose one or more — • Exile all artifacts. • Exile all creatures. • Exile all enchantments. • Exile all graveyards.
- rank 179 《Gemstone Caverns》: If this card is in your opening hand and you're not the starting player, you may begin the game with Gemstone Caverns on the battlefield with a luck counter on it. If you do, ex...
- rank 190 《Force of Will》: You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.
- rank 191 《Mosswort Bridge》: {G}, {T}: You may play the exiled card without paying its mana cost if creatures you control have total power 10 or greater.
- rank 216 《Professional Face-Breaker》: Sacrifice a Treasure: Exile the top card of your library. You may play that card this turn.
- rank 260 《Etali, Primal Storm》: Whenever Etali attacks, exile the top card of each player's library, then you may cast any number of spells from among those cards without paying their mana costs.
- rank 266 《Force of Negation》: If it's not your turn, you may exile a blue card from your hand rather than pay this spell's mana cost.

### graveyard

- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 24 《Beast Within》: Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
- rank 25 《Bojuka Bog》: When this land enters, exile target player's graveyard.
- rank 27 《Myriad Landscape》: {2}, {T}, Sacrifice this land: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.
- rank 28 《Terramorphic Expanse》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 32 《Mind Stone》: {1}, {T}, Sacrifice this artifact: Draw a card.
- rank 36 《Polluted Delta》: {T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.
- rank 38 《Solemn Simulacrum》: When this creature dies, you may draw a card.
- rank 39 《Flooded Strand》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.
- rank 40 《Misty Rainforest》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Forest or Island card, put it onto the battlefield, then shuffle.
- rank 41 《Skullclamp》: Whenever equipped creature dies, draw two cards.
- rank 42 《Bloodstained Mire》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Swamp or Mountain card, put it onto the battlefield, then shuffle.
- rank 45 《Windswept Heath》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Forest or Plains card, put it onto the battlefield, then shuffle.
- rank 46 《Commander's Sphere》: Sacrifice this artifact: Draw a card.
- rank 47 《Verdant Catacombs》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Swamp or Forest card, put it onto the battlefield, then shuffle.

### hand

- rank 10 《Reliquary Tower》: You have no maximum hand size.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 21 《Thought Vessel》: You have no maximum hand size.
- rank 32 《Mind Stone》: {1}, {T}, Sacrifice this artifact: Draw a card.
- rank 37 《Kodama's Reach》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 38 《Solemn Simulacrum》: When this creature dies, you may draw a card.
- rank 41 《Skullclamp》: Whenever equipped creature dies, draw two cards.
- rank 43 《Rhystic Study》: Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.
- rank 46 《Commander's Sphere》: Sacrifice this artifact: Draw a card.
- rank 51 《Cyclonic Rift》: Return target nonland permanent you don't control to its owner's hand.
- rank 56 《Arcane Denial》: Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.
- rank 59 《Demonic Tutor》: Search your library for a card, put that card into your hand, then shuffle.
- rank 62 《Smothering Tithe》: Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.
- rank 71 《Brainstorm》: Draw three cards, then put two cards from your hand on top of your library in any order.
- rank 76 《Esper Sentinel》: Whenever an opponent casts their first noncreature spell each turn, draw a card unless that player pays {X}, where X is this creature's power.

### library

- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 23 《Farseek》: Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.
- rank 26 《Rampant Growth》: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 27 《Myriad Landscape》: {2}, {T}, Sacrifice this land: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.
- rank 28 《Terramorphic Expanse》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 29 《Nature's Lore》: Search your library for a Forest card, put that card onto the battlefield, then shuffle.
- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 32 《Mind Stone》: {1}, {T}, Sacrifice this artifact: Draw a card.
- rank 36 《Polluted Delta》: {T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.
- rank 37 《Kodama's Reach》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 38 《Solemn Simulacrum》: When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 39 《Flooded Strand》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.
- rank 40 《Misty Rainforest》: {T}, Pay 1 life, Sacrifice this land: Search your library for a Forest or Island card, put it onto the battlefield, then shuffle.

### stack

- rank 16 《Counterspell》: Counter target spell.
- rank 35 《An Offer You Can't Refuse》: Counter target noncreature spell. Its controller creates two Treasure tokens.
- rank 54 《Negate》: Counter target noncreature spell.
- rank 56 《Arcane Denial》: Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.
- rank 73 《Swan Song》: Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.
- rank 80 《Fierce Guardianship》: Counter target noncreature spell.
- rank 115 《Mana Drain》: Counter target spell. At the beginning of your next main phase, add an amount of {C} equal to that spell's mana value.
- rank 190 《Force of Will》: Counter target spell.
- rank 249 《Dovin's Veto》: Counter target noncreature spell.
- rank 266 《Force of Negation》: Counter target noncreature spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.
- rank 310 《Flusterstorm》: Counter target instant or sorcery spell unless its controller pays {1}.
- rank 359 《Pact of Negation》: Counter target spell.
- rank 452 《Mental Misstep》: Counter target spell with mana value 1.
- rank 456 《Pyroblast》: Choose one — • Counter target spell if it's blue. • Destroy target permanent if it's blue.
- rank 587 《Tibalt's Trickery》: Counter target spell. Choose 1, 2, or 3 at random. Its controller mills that many cards, then exiles cards from the top of their library until they exile a nonland card with a d...


## Ownership Examples

### both

- rank 51 《Cyclonic Rift》: Return target nonland permanent you don't control to its owner's hand.
- rank 90 《Otawara, Soaring City》: Channel — {3}{U}, Discard this card: Return target artifact, creature, enchantment, or planeswalker to its owner's hand. This ability costs {1} less to activate for each legenda...
- rank 177 《Sink into Stupor // Soporific Springs》: Return target spell or nonland permanent an opponent controls to its owner's hand.
- rank 267 《Hullbreaker Horror》: Whenever you cast a spell, choose up to one — • Return target spell you don't control to its owner's hand. • Return target nonland permanent to its owner's hand.
- rank 285 《Simic Growth Chamber》: When this land enters, return a land you control to its owner's hand.
- rank 317 《Golgari Rot Farm》: When this land enters, return a land you control to its owner's hand.
- rank 343 《Dimir Aqueduct》: When this land enters, return a land you control to its owner's hand.
- rank 380 《Orzhov Basilica》: When this land enters, return a land you control to its owner's hand.
- rank 397 《Izzet Boilerworks》: When this land enters, return a land you control to its owner's hand.
- rank 415 《Gruul Turf》: When this land enters, return a land you control to its owner's hand.
- rank 440 《Azorius Chancery》: When this land enters, return a land you control to its owner's hand.
- rank 443 《Ephemerate》: Exile target creature you control, then return it to the battlefield under its owner's control.
- rank 466 《Boros Garrison》: When this land enters, return a land you control to its owner's hand.
- rank 477 《Rakdos Carnarium》: When this land enters, return a land you control to its owner's hand.
- rank 485 《Maskwood Nexus》: Creatures you control are every creature type. The same is true for creature spells you control and creature cards you own that aren't on the battlefield.

### controller

- rank 9 《Exotic Orchard》: {T}: Add one mana of any color that a land an opponent controls could produce.
- rank 11 《Swords to Plowshares》: Exile target creature. Its controller gains life equal to its power.
- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 17 《Fellwar Stone》: {T}: Add one mana of any color that a land an opponent controls could produce.
- rank 24 《Beast Within》: Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
- rank 31 《Heroic Intervention》: Permanents you control gain hexproof and indestructible until end of turn.
- rank 35 《An Offer You Can't Refuse》: Counter target noncreature spell. Its controller creates two Treasure tokens.
- rank 53 《Fabled Passage》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.
- rank 56 《Arcane Denial》: Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.
- rank 57 《Reanimate》: Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card's mana value.
- rank 58 《Generous Gift》: Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.
- rank 73 《Swan Song》: Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.
- rank 74 《Temple of the False God》: {T}: Add {C}{C}. Activate only if you control five or more lands.
- rank 78 《Boseiju, Who Endures》: Channel — {1}{G}, Discard this card: Destroy target artifact, enchantment, or nonbasic land an opponent controls. That player may search their library for a land card with a bas...
- rank 79 《Deflecting Swat》: If you control a commander, you may cast this spell without paying its mana cost.

### none

- rank 1 《Sol Ring》: {T}: Add {C}{C}.
- rank 2 《Command Tower》: {T}: Add one mana of any color in your commander's color identity.
- rank 3 《Arcane Signet》: {T}: Add one mana of any color in your commander's color identity.
- rank 10 《Reliquary Tower》: You have no maximum hand size.
- rank 12 《Swiftfoot Boots》: Equipped creature has hexproof and haste.
- rank 13 《Lightning Greaves》: Equipped creature has haste and shroud.
- rank 14 《Path of Ancestry》: This land enters tapped.
- rank 16 《Counterspell》: Counter target spell.
- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 19 《Rogue's Passage》: {T}: Add {C}.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 21 《Thought Vessel》: You have no maximum hand size.
- rank 22 《Blasphemous Act》: This spell costs {1} less to cast for each creature on the battlefield.
- rank 23 《Farseek》: Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.
- rank 25 《Bojuka Bog》: This land enters tapped.

### owner

- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 226 《Sensei's Divining Top》: {T}: Draw a card, then put this artifact on top of its owner's library.
- rank 266 《Force of Negation》: Counter target noncreature spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.
- rank 268 《Snap》: Return target creature to its owner's hand. Untap up to two lands.
- rank 307 《Aetherize》: Return all attacking creatures to their owner's hand.
- rank 378 《Dauthi Voidwalker》: {T}, Sacrifice this creature: Choose an exiled card an opponent owns with a void counter on it. You may play it this turn without paying its mana cost.
- rank 550 《Green Sun's Zenith》: Search your library for a green creature card with mana value X or less, put it onto the battlefield, then shuffle. Shuffle Green Sun's Zenith into its owner's library.
- rank 609 《Noxious Revival》: Put target card from a graveyard on top of its owner's library.
- rank 639 《Reprieve》: Return target spell to its owner's hand.
- rank 752 《Narset's Reversal》: Copy target instant or sorcery spell, then return it to its owner's hand. You may choose new targets for the copy.
- rank 793 《Rancor》: When this Aura is put into a graveyard from the battlefield, return it to its owner's hand.
- rank 1019 《Approach of the Second Sun》: If this spell was cast from your hand and you've cast another spell named Approach of the Second Sun this game, you win the game. Otherwise, put Approach of the Second Sun into...
- rank 1043 《Blightsteel Colossus》: If Blightsteel Colossus would be put into a graveyard from anywhere, reveal Blightsteel Colossus and shuffle it into its owner's library instead.
- rank 1072 《Raise the Palisade》: Choose a creature type. Return all creatures that aren't of the chosen type to their owners' hands.
- rank 1099 《Kozilek, Butcher of Truth》: When Kozilek is put into a graveyard from anywhere, its owner shuffles their graveyard into their library.


## Player Scope Examples

### controller

- rank 11 《Swords to Plowshares》: Exile target creature. Its controller gains life equal to its power.
- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 24 《Beast Within》: Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
- rank 35 《An Offer You Can't Refuse》: Counter target noncreature spell. Its controller creates two Treasure tokens.
- rank 56 《Arcane Denial》: Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.
- rank 58 《Generous Gift》: Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.
- rank 73 《Swan Song》: Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.
- rank 117 《Propaganda》: Creatures can't attack you unless their controller pays {2} for each creature they control that's attacking you.
- rank 124 《Assassin's Trophy》: Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.
- rank 156 《Pongify》: Destroy target creature. It can't be regenerated. Its controller creates a 3/3 green Ape creature token.
- rank 163 《Ghostly Prison》: Creatures can't attack you unless their controller pays {2} for each creature they control that's attacking you.
- rank 194 《Stroke of Midnight》: Destroy target nonland permanent. Its controller creates a 1/1 white Human creature token.
- rank 210 《Rapid Hybridization》: Destroy target creature. It can't be regenerated. That creature's controller creates a 3/3 green Frog Lizard creature token.
- rank 211 《Wild Growth》: Whenever enchanted land is tapped for mana, its controller adds an additional {G}.
- rank 224 《Animate Dead》: When this Aura enters, if it's on the battlefield, it loses and gains Return enchanted creature card to the battlefield under your control and attach this Aura to it. When this...

### each-opponent

- rank 9 《Exotic Orchard》: {T}: Add one mana of any color that a land an opponent controls could produce.
- rank 17 《Fellwar Stone》: {T}: Add one mana of any color that a land an opponent controls could produce.
- rank 43 《Rhystic Study》: Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.
- rank 62 《Smothering Tithe》: Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.
- rank 76 《Esper Sentinel》: Whenever an opponent casts their first noncreature spell each turn, draw a card unless that player pays {X}, where X is this creature's power.
- rank 78 《Boseiju, Who Endures》: Channel — {1}{G}, Discard this card: Destroy target artifact, enchantment, or nonbasic land an opponent controls. That player may search their library for a land card with a bas...
- rank 88 《Feed the Swarm》: Destroy target creature or enchantment an opponent controls. You lose life equal to that permanent's mana value.
- rank 96 《Mystic Remora》: Whenever an opponent casts a noncreature spell, you may draw a card unless that player pays {4}.
- rank 124 《Assassin's Trophy》: Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.
- rank 139 《Morphic Pool》: This land enters tapped unless you have two or more opponents.
- rank 146 《Rejuvenating Springs》: This land enters tapped unless you have two or more opponents.
- rank 150 《Training Center》: This land enters tapped unless you have two or more opponents.
- rank 164 《Luxury Suite》: This land enters tapped unless you have two or more opponents.
- rank 166 《Sea of Clouds》: This land enters tapped unless you have two or more opponents.
- rank 169 《Vault of Champions》: This land enters tapped unless you have two or more opponents.

### each-player

- rank 152 《Windfall》: Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.
- rank 216 《Professional Face-Breaker》: Whenever one or more creatures you control deal combat damage to a player, create a Treasure token.
- rank 252 《Syr Konrad, the Grim》: {1}{B}: Each player mills a card.
- rank 260 《Etali, Primal Storm》: Whenever Etali attacks, exile the top card of each player's library, then you may cast any number of spells from among those cards without paying their mana costs.
- rank 269 《Ragavan, Nimble Pilferer》: Whenever Ragavan deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card.
- rank 280 《Seedborn Muse》: Untap all permanents you control during each other player's untap step.
- rank 327 《Faerie Mastermind》: {3}{U}: Each player draws a card.
- rank 381 《Toski, Bearer of Secrets》: Whenever a creature you control deals combat damage to a player, draw a card.
- rank 385 《Kutzil, Malamet Exemplar》: Whenever one or more creatures you control each with power greater than its base power deals combat damage to a player, draw a card.
- rank 395 《Forgotten Ancient》: Whenever a player casts a spell, you may put a +1/+1 counter on this creature.
- rank 408 《Lotho, Corrupt Shirriff》: Whenever a player casts their second spell each turn, you lose 1 life and create a Treasure token.
- rank 410 《Bident of Thassa》: Whenever a creature you control deals combat damage to a player, you may draw a card.
- rank 431 《Geier Reach Sanitarium》: {2}, {T}: Each player draws a card, then discards a card.
- rank 458 《Ohran Frostfang》: Whenever a creature you control deals combat damage to a player, draw a card.
- rank 467 《Accursed Marauder》: When this creature enters, each player sacrifices a nontoken creature of their choice.

### owner

- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 51 《Cyclonic Rift》: Return target nonland permanent you don't control to its owner's hand.
- rank 90 《Otawara, Soaring City》: Channel — {3}{U}, Discard this card: Return target artifact, creature, enchantment, or planeswalker to its owner's hand. This ability costs {1} less to activate for each legenda...
- rank 177 《Sink into Stupor // Soporific Springs》: Return target spell or nonland permanent an opponent controls to its owner's hand.
- rank 226 《Sensei's Divining Top》: {T}: Draw a card, then put this artifact on top of its owner's library.
- rank 266 《Force of Negation》: Counter target noncreature spell. If that spell is countered this way, exile it instead of putting it into its owner's graveyard.
- rank 267 《Hullbreaker Horror》: Whenever you cast a spell, choose up to one — • Return target spell you don't control to its owner's hand. • Return target nonland permanent to its owner's hand.
- rank 268 《Snap》: Return target creature to its owner's hand. Untap up to two lands.
- rank 285 《Simic Growth Chamber》: When this land enters, return a land you control to its owner's hand.
- rank 307 《Aetherize》: Return all attacking creatures to their owner's hand.
- rank 317 《Golgari Rot Farm》: When this land enters, return a land you control to its owner's hand.
- rank 343 《Dimir Aqueduct》: When this land enters, return a land you control to its owner's hand.
- rank 380 《Orzhov Basilica》: When this land enters, return a land you control to its owner's hand.
- rank 397 《Izzet Boilerworks》: When this land enters, return a land you control to its owner's hand.
- rank 415 《Gruul Turf》: When this land enters, return a land you control to its owner's hand.

### target-player

- rank 25 《Bojuka Bog》: When this land enters, exile target player's graveyard.
- rank 102 《Jeska's Will》: Choose one. If you control a commander as you cast this spell, you may choose both instead. • Add {R} for each card in target opponent's hand. • Exile the top three cards of you...
- rank 138 《Blood Artist》: Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.
- rank 176 《Boros Charm》: Choose one — • Boros Charm deals 4 damage to target player or planeswalker. • Permanents you control gain indestructible until end of turn. • Target creature gains double strike...
- rank 231 《Sign in Blood》: Target player draws two cards and loses 2 life.
- rank 324 《Rakdos Charm》: Choose one — • Exile target player's graveyard. • Destroy target artifact. • Each creature deals 1 damage to its controller.
- rank 352 《Loran of the Third Path》: {T}: You and target opponent each draw a card.
- rank 489 《Vito, Thorn of the Dusk Rose》: Whenever you gain life, target opponent loses that much life.
- rank 497 《Sanguine Bond》: Whenever you gain life, target opponent loses that much life.
- rank 526 《Gitaxian Probe》: Look at target player's hand.
- rank 617 《Altar of Dementia》: Sacrifice a creature: Target player mills cards equal to the sacrificed creature's power.
- rank 657 《Boggart Trawler // Boggart Bog》: When this creature enters, exile target player's graveyard.
- rank 691 《Forbidden Orchard》: Whenever you tap this land for mana, target opponent creates a 1/1 colorless Spirit creature token.
- rank 786 《Brash Taunter》: Whenever this creature is dealt damage, it deals that much damage to target opponent.
- rank 790 《Brain Freeze》: Target player mills three cards.

### unknown

- rank 709 《Curse of Opulence》: Enchant player
- rank 1186 《Kogla, the Titan Ape》: Whenever Kogla attacks, destroy target artifact or enchantment defending player controls.
- rank 1280 《Scourge of the Throne》: Whenever this creature attacks for the first time each turn, if it's attacking the player with the most life or tied for most life, untap all attacking creatures. After this pha...
- rank 1291 《Ulamog, the Ceaseless Hunger》: Whenever Ulamog attacks, defending player exiles the top twenty cards of their library.
- rank 1658 《Open the Way》: X can't be greater than the number of players in the game.
- rank 1841 《Scheming Symmetry》: Choose two target players. Each of them searches their library for a card, then shuffles and puts that card on top.
- rank 2004 《Grafdigger's Cage》: Players can't cast spells from graveyards or libraries.
- rank 2057 《Mycosynth Lattice》: Players may spend mana as though it were mana of any color.
- rank 2058 《Everybody Lives!》: All creatures gain hexproof and indestructible until end of turn. Players gain hexproof until end of turn. Players can't lose life this turn and players can't lose the game or w...
- rank 2177 《Generous Plunderer》: Whenever this creature attacks, it deals damage to defending player equal to the number of artifacts they control.
- rank 2250 《Stuffy Doll》: Whenever this creature is dealt damage, it deals that much damage to the chosen player.
- rank 2325 《Dictate of the Twin Gods》: If a source would deal damage to a permanent or player, it deals double that damage to that permanent or player instead.
- rank 2489 《Rampaging Ferocidon》: Players can't gain life.
- rank 2504 《The Immortal Sun》: Players can't activate planeswalkers' loyalty abilities.
- rank 2649 《Aerial Extortionist》: Whenever another player casts a spell from anywhere other than their hand, draw a card.

### you

- rank 2 《Command Tower》: {T}: Add one mana of any color in your commander's color identity.
- rank 3 《Arcane Signet》: {T}: Add one mana of any color in your commander's color identity.
- rank 10 《Reliquary Tower》: You have no maximum hand size.
- rank 14 《Path of Ancestry》: {T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1.
- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 21 《Thought Vessel》: You have no maximum hand size.
- rank 23 《Farseek》: Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.
- rank 26 《Rampant Growth》: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 27 《Myriad Landscape》: {2}, {T}, Sacrifice this land: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.
- rank 28 《Terramorphic Expanse》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 29 《Nature's Lore》: Search your library for a Forest card, put that card onto the battlefield, then shuffle.
- rank 31 《Heroic Intervention》: Permanents you control gain hexproof and indestructible until end of turn.
- rank 36 《Polluted Delta》: {T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.
- rank 37 《Kodama's Reach》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.


## Multi-zone Examples

- rank 11 《Swords to Plowshares》: Exile target creature. Its controller gains life equal to its power.
- rank 15 《Path to Exile》: Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 18 《Evolving Wilds》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 20 《Cultivate》: Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
- rank 23 《Farseek》: Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.
- rank 24 《Beast Within》: Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
- rank 25 《Bojuka Bog》: When this land enters, exile target player's graveyard.
- rank 26 《Rampant Growth》: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
- rank 27 《Myriad Landscape》: {2}, {T}, Sacrifice this land: Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle.
- rank 28 《Terramorphic Expanse》: {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
- rank 29 《Nature's Lore》: Search your library for a Forest card, put that card onto the battlefield, then shuffle.
- rank 30 《Chaos Warp》: The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.
- rank 32 《Mind Stone》: {1}, {T}, Sacrifice this artifact: Draw a card.
- rank 35 《An Offer You Can't Refuse》: Counter target noncreature spell. Its controller creates two Treasure tokens.
- rank 36 《Polluted Delta》: {T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.

## Mapping Failures

- none

