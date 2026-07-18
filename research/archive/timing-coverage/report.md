# Timing Coverage Report

- Generated at: 2026-06-25T14:46:49.650Z
- Input: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- totalCards: 17491
- mappedCards: 17491
- mappingFailures: 0
- churn: 143/17491 (0.82%)

## Timing-step demand

| step | cards | examples |
|---|---:|---|
| begin-combat | 271 | The Ozolith; Helm of the Host; Unnatural Growth; Innkeeper's Talent; Loyal Apprentice |
| cleanup | 0 | - |
| declare-attackers | 0 | - |
| declare-blockers | 0 | - |
| draw | 16 | Mana Vault; Sylvan Library; Howling Mine; Rites of Flourishing; Kami of the Crescent Moon |
| end-combat | 0 | - |
| end-step | 477 | Braids, Arisen Nightmare; Underworld Breach; Conjurer's Closet; Growing Rites of Itlimoc // Itlimoc, Cradle of the Sun; Bloodchief Ascension |
| main-precombat | 47 | Black Market Connections; Ripples of Undeath; Black Market; Carpet of Flowers; Hulking Raptor |
| main-postcombat | 30 | Neheb, the Eternal; Carpet of Flowers; Sphinx of the Second Sun; Kona, Rescue Beastie; Frontier Siege |
| other | 10 | Mana Drain; Citadel Siege; Champions of Minas Tirith; Legion's Initiative; Overencumbered |
| turn | 0 | - |
| untap | 19 | Seedborn Muse; Unwinding Clock; Bender's Waterskin; Dazzling Theater // Prop Room; Drumbellower |
| upkeep | 404 | The One Ring; Phyrexian Arena; Herald's Horn; Mana Vault; Inventors' Fair |

## Cast-timing distribution

| cast timing | cards |
|---|---:|
| combat-only | 7 |
| flash | 473 |
| none | 16537 |
| once-per-turn | 66 |
| sorcery-speed | 386 |
| your-turn-only | 35 |

## Juncture-scope distribution

| scope | cards |
|---|---:|
| any | 146 |
| controlled-set | 0 |
| opponent | 36 |
| self | 1030 |
| unknown | 57 |

## SBA-modifier demand

| modifier | cards |
|---|---:|
| indestructible | 393 |
| poison | 121 |
| regenerate | 49 |
| cantLose | 8 |
| cantWin | 7 |
| losesGame | 26 |
| winsGame | 0 |

## Representative timing lines

### begin-combat

- 《The Ozolith》: At the beginning of combat on your turn, if The Ozolith has counters on it, you may move all counters from The Ozolith onto target creature.
- 《Helm of the Host》: At the beginning of combat on your turn, create a token that's a copy of equipped creature, except the token isn't legendary. That token gains haste.
- 《Unnatural Growth》: At the beginning of each combat, double the power and toughness of each creature you control until end of turn.
- 《Innkeeper's Talent》: At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.
- 《Loyal Apprentice》: Lieutenant — At the beginning of combat on your turn, if you control your commander, create a 1/1 colorless Thopter artifact creature token with flying. That token gains haste u...
- 《Moraug, Fury of Akoum》: Landfall — Whenever a land you control enters, if it's your main phase, there's an additional combat phase after this phase. At the beginning of that combat, untap all creatures...
- 《Zopandrel, Hunger Dominus》: At the beginning of each combat, double the power and toughness of each creature you control until end of turn.
- 《Xenagos, God of Revels》: At the beginning of combat on your turn, another target creature you control gains haste and gets +X/+X until end of turn, where X is that creature's power.
- 《Odric, Lunarch Marshal》: At the beginning of each combat, creatures you control gain first strike until end of turn if a creature you control has first strike. The same is true for flying, deathtouch, d...
- 《Full Throttle》: At the beginning of each combat this turn, untap all creatures that attacked this turn.
- 《Sting, the Glinting Dagger》: At the beginning of each combat, untap equipped creature.
- 《Legion Warboss》: At the beginning of combat on your turn, create a 1/1 red Goblin creature token. That token gains haste until end of turn and attacks this combat if able.
- 《Proft's Eidetic Memory》: At the beginning of combat on your turn, if you've drawn more than one card this turn, put X +1/+1 counters on target creature you control, where X is the number of cards you've...
- 《Ouroboroid》: At the beginning of combat on your turn, put X +1/+1 counters on each creature you control, where X is this creature's power.
- 《Halana and Alena, Partners》: At the beginning of combat on your turn, put X +1/+1 counters on another target creature you control, where X is Halana and Alena's power. That creature gains haste until end of...

### cleanup

- none

### declare-attackers

- none

### declare-blockers

- none

### draw

- 《Mana Vault》: At the beginning of your draw step, if this artifact is tapped, it deals 1 damage to you.
- 《Sylvan Library》: At the beginning of your draw step, you may draw two additional cards. If you do, choose two cards in your hand drawn this turn. For each of those cards, pay 4 life or put the c...
- 《Howling Mine》: At the beginning of each player's draw step, if this artifact is untapped, that player draws an additional card.
- 《Rites of Flourishing》: At the beginning of each player's draw step, that player draws an additional card.
- 《Kami of the Crescent Moon》: At the beginning of each player's draw step, that player draws an additional card.
- 《Teferi's Puzzle Box》: At the beginning of each player's draw step, that player puts the cards in their hand on the bottom of their library in any order, then draws that many cards.
- 《Dictate of Kruphix》: At the beginning of each player's draw step, that player draws an additional card.
- 《Font of Mythos》: At the beginning of each player's draw step, that player draws two additional cards.
- 《Spiteful Visions》: At the beginning of each player's draw step, that player draws an additional card.
- 《The Immortal Sun》: At the beginning of your draw step, draw an additional card.
- 《Nekusar, the Mindrazer》: At the beginning of each player's draw step, that player draws an additional card.
- 《Bandit's Talent》: At the beginning of your draw step, draw an additional card for each opponent who has one or fewer cards in hand.
- 《Lord Skitter's Blessing》: At the beginning of your draw step, if you control an enchanted creature, you lose 1 life and you draw an additional card.
- 《Curse of Obsession》: At the beginning of enchanted player's draw step, that player draws two additional cards.
- 《Mornsong Aria》: At the beginning of each player's draw step, that player loses 3 life, searches their library for a card, puts it into their hand, then shuffles.

### end-combat

- none

### end-step

- 《Braids, Arisen Nightmare》: At the beginning of your end step, you may sacrifice an artifact, creature, enchantment, land, or planeswalker. If you do, each opponent may sacrifice a permanent of their choic...
- 《Underworld Breach》: At the beginning of the end step, sacrifice this enchantment.
- 《Conjurer's Closet》: At the beginning of your end step, you may exile target creature you control, then return that card to the battlefield under your control.
- 《Growing Rites of Itlimoc // Itlimoc, Cradle of the Sun》: At the beginning of your end step, if you control four or more creatures, transform Growing Rites of Itlimoc.
- 《Bloodchief Ascension》: At the beginning of each end step, if an opponent lost 2 or more life this turn, you may put a quest counter on this enchantment.
- 《Chimil, the Inner Sun》: At the beginning of your end step, discover 5.
- 《Wilderness Reclamation》: At the beginning of your end step, untap all lands you control.
- 《Teleportation Circle》: At the beginning of your end step, exile up to one target artifact or creature you control, then return that card to the battlefield under its owner's control.
- 《Ocelot Pride》: At the beginning of your end step, if you gained life this turn, create a 1/1 white Cat creature token. Then if you have the city's blessing, for each token you control that ent...
- 《Keeper of the Accord》: At the beginning of each opponent's end step, if that player controls more creatures than you, create a 1/1 white Soldier creature token.
- 《Mahadi, Emporium Master》: At the beginning of your end step, create a Treasure token for each creature that died this turn.
- 《Thassa, Deep-Dwelling》: At the beginning of your end step, exile up to one other target creature you control, then return that card to the battlefield under your control.
- 《Palantír of Orthanc》: At the beginning of your end step, put an influence counter on Palantír of Orthanc and scry 2. Then target opponent may have you draw a card. If that player doesn't, you mill X...
- 《Jadar, Ghoulcaller of Nephalia》: At the beginning of your end step, if you control no creatures with decayed, create a 2/2 black Zombie creature token with decayed.
- 《Meren of Clan Nel Toth》: At the beginning of your end step, choose target creature card in your graveyard. If that card's mana value is less than or equal to the number of experience counters you have,...

### main-precombat

- 《Black Market Connections》: At the beginning of your first main phase, choose one or more — • Sell Contraband — Create a Treasure token. You lose 1 life. • Buy Information — Draw a card. You lose 2 life. •...
- 《Ripples of Undeath》: At the beginning of your first main phase, mill three cards. Then you may pay {1} and 3 life. If you do, put a card from among those cards into your hand.
- 《Black Market》: At the beginning of your first main phase, add {B} for each charge counter on this enchantment.
- 《Carpet of Flowers》: At the beginning of each of your main phases, if you haven't added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target...
- 《Hulking Raptor》: At the beginning of your first main phase, add {G}{G}.
- 《Thousand Moons Smithy // Barracks of the Thousand》: At the beginning of your first main phase, you may tap five untapped artifacts and/or creatures you control. If you do, transform Thousand Moons Smithy.
- 《Party Thrasher》: At the beginning of your first main phase, you may discard a card. If you do, exile the top two cards of your library, then choose one of them. You may play that card this turn.
- 《Frontier Siege》: As this enchantment enters, choose Khans or Dragons. • Khans — At the beginning of each of your main phases, add {G}{G}. • Dragons — Whenever a creature you control with flying...
- 《Coalition Relic》: At the beginning of your first main phase, remove all charge counters from this artifact. Add one mana of any color for each charge counter removed this way.
- 《Klothys, God of Destiny》: At the beginning of your first main phase, exile target card from a graveyard. If it was a land card, add {R} or {G}. Otherwise, you gain 2 life and Klothys deals 2 damage to ea...
- 《Shadow of the Goblin》: Unreliable Visions — At the beginning of your first main phase, discard a card. If you do, draw a card.
- 《Omnath, Locus of All》: At the beginning of your first main phase, look at the top card of your library. You may reveal that card if it has three or more colored mana symbols in its mana cost. If you d...
- 《Sab-Sunen, Luxa Embodied》: At the beginning of your first main phase, put a +1/+1 counter on Sab-Sunen. Then if it has an odd number of counters on it, draw two cards.
- 《Plasm Capture》: Counter target spell. At the beginning of your next first main phase, add X mana in any combination of colors, where X is that spell's mana value.
- 《Ashling, Rekindled // Ashling, Rimebound》: At the beginning of your first main phase, you may pay {U}. If you do, transform Ashling.

### main-postcombat

- 《Neheb, the Eternal》: At the beginning of each of your postcombat main phases, add {R} for each 1 life your opponents have lost this turn.
- 《Carpet of Flowers》: At the beginning of each of your main phases, if you haven't added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target...
- 《Sphinx of the Second Sun》: At the beginning of each of your postcombat main phases, there is an additional beginning phase after this phase.
- 《Kona, Rescue Beastie》: Survival — At the beginning of your second main phase, if Kona is tapped, you may put a permanent card from your hand onto the battlefield.
- 《Frontier Siege》: As this enchantment enters, choose Khans or Dragons. • Khans — At the beginning of each of your main phases, add {G}{G}. • Dragons — Whenever a creature you control with flying...
- 《Lost Monarch of Ifnir》: At the beginning of your second main phase, if a player was dealt combat damage by a Zombie this turn, mill three cards, then you may return a creature card from your graveyard...
- 《Florian, Voldaren Scion》: At the beginning of each of your postcombat main phases, look at the top X cards of your library, where X is the total amount of life your opponents lost this turn. Exile one of...
- 《Shadow of the Second Sun》: At the beginning of each of enchanted player's postcombat main phases, there is an additional beginning phase after this phase.
- 《Sorin of House Markov // Sorin, Ravenous Neonate》: At the beginning of each of your postcombat main phases, if you gained 3 or more life this turn, exile Sorin, then return him to the battlefield transformed under his owner's co...
- 《Tymna the Weaver》: At the beginning of each of your postcombat main phases, you may pay X life, where X is the number of opponents that were dealt combat damage this turn. If you do, draw X cards.
- 《Reluctant Role Model》: Survival — At the beginning of your second main phase, if this creature is tapped, put a flying, lifelink, or +1/+1 counter on it.
- 《Ninja Pizza》: At the beginning of your second main phase, create a Food token.
- 《Scheming Silvertongue // Sign in Blood》: At the beginning of your second main phase, if you gained 2 or more life this turn, this creature becomes prepared.
- 《Cynical Loner》: Survival — At the beginning of your second main phase, if this creature is tapped, you may search your library for a card, put it into your graveyard, then shuffle.
- 《Fireglass Mentor》: At the beginning of your second main phase, if an opponent lost life this turn, exile the top two cards of your library. Choose one of them. Until end of turn, you may play that...

### other

- 《Mana Drain》: Counter target spell. At the beginning of your next main phase, add an amount of {C} equal to that spell's mana value.
- 《Citadel Siege》: As this enchantment enters, choose Khans or Dragons. • Khans — At the beginning of combat on your turn, put two +1/+1 counters on target creature you control. • Dragons — At the...
- 《Champions of Minas Tirith》: At the beginning of combat on each opponent's turn, if you're the monarch, that opponent may pay {X}, where X is the number of cards in their hand. If they don't, they can't att...
- 《Legion's Initiative》: {R}{W}, Exile this enchantment: Exile all creatures you control. At the beginning of the next combat, return those cards to the battlefield under their owner's control and those...
- 《Overencumbered》: At the beginning of combat on enchanted opponent's turn, that player may pay {1} for each artifact they control. If they don't, creatures can't attack this combat.
- 《Kitt Kanto, Mayhem Diva》: At the beginning of combat on each player's turn, you may tap two untapped creatures you control. When you do, target creature that player controls gets +2/+2 and gains trample...
- 《Web of Inertia》: At the beginning of combat on each opponent's turn, that player may exile a card from their graveyard. If the player doesn't, creatures they control can't attack you this turn.
- 《Feral Encounter》: Look at the top five cards of your library. You may exile a creature card from among them. Put the rest on the bottom of your library in a random order. You may cast the exiled...
- 《Vivien's Stampede》: At the beginning of the next main phase this turn, draw a card for each player who was dealt combat damage this turn.
- 《Ertai's Meddling》: At the beginning of each of that player's upkeeps, if that card is exiled, remove a delay counter from it. If the card has no delay counters on it, the player puts it onto the s...

### turn

- none

### untap

- 《Seedborn Muse》: Untap all permanents you control during each other player's untap step.
- 《Unwinding Clock》: Untap all artifacts you control during each other player's untap step.
- 《Bender's Waterskin》: Untap this artifact during each other player's untap step.
- 《Dazzling Theater // Prop Room》: Untap each creature you control during each other player's untap step.
- 《Drumbellower》: Untap all creatures you control during each other player's untap step.
- 《Endbringer》: Untap this creature during each other player's untap step.
- 《Murkfiend Liege》: Untap all green and/or blue creatures you control during each other player's untap step.
- 《The Millennium Calendar》: Whenever you untap one or more permanents during your untap step, put that many time counters on The Millennium Calendar.
- 《The Ninth Doctor》: Into the TARDIS — Whenever The Ninth Doctor becomes untapped during your untap step, you get an additional upkeep step after this step.
- 《Coffin Queen》: You may choose not to untap this creature during your untap step.
- 《Immovable Rod》: You may choose not to untap this artifact during your untap step.
- 《The Pandorica》: You may choose not to untap The Pandorica during your untap step.
- 《Ohabi Caleria》: Untap all Archers you control during each other player's untap step.
- 《The Blackstaff of Waterdeep》: You may choose not to untap The Blackstaff of Waterdeep during your untap step.
- 《Thousand Moons Infantry》: Untap this creature during each other player's untap step.

### upkeep

- 《The One Ring》: At the beginning of your upkeep, you lose 1 life for each burden counter on The One Ring.
- 《Phyrexian Arena》: At the beginning of your upkeep, you draw a card and you lose 1 life.
- 《Herald's Horn》: At the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand.
- 《Mana Vault》: At the beginning of your upkeep, you may pay {4}. If you do, untap this artifact.
- 《Inventors' Fair》: At the beginning of your upkeep, if you control three or more artifacts, you gain 1 life.
- 《Pact of Negation》: At the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game.
- 《Land Tax》: At the beginning of your upkeep, if an opponent controls more lands than you, you may search your library for up to three basic land cards, reveal them, put them into your hand,...
- 《Forgotten Ancient》: At the beginning of your upkeep, you may move any number of +1/+1 counters from this creature onto other creatures.
- 《Bitterblossom》: At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.
- 《Midnight Clock》: At the beginning of each upkeep, put an hour counter on this artifact.
- 《Scrawling Crawler》: At the beginning of your upkeep, each player draws a card.
- 《Ophiomancer》: At the beginning of each upkeep, if you control no Snakes, create a 1/1 black Snake creature token with deathtouch.
- 《Sheoldred, Whispering One》: At the beginning of your upkeep, return target creature card from your graveyard to the battlefield.
- 《Hellkite Tyrant》: At the beginning of your upkeep, if you control twenty or more artifacts, you win the game.
- 《Descent into Avernus》: At the beginning of your upkeep, put two descent counters on this enchantment. Then each player creates X Treasure tokens and this enchantment deals X damage to each player, whe...

