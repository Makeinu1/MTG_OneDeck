# Layer Coverage Report

Measurement-only extraction for CR613 continuous-effect layers and CR604.3 CDA.

## Summary

- Generated at: 2026-06-22T22:27:05.971Z
- Input: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- totalCards: 17491
- mappedCards: 17491
- classified continuous lines: 5318
- cdaCardCount: 128
- multiLayer cards: 1244
- adjudication candidates: 1396
- mapping failures: 0

## Per Layer

| layer | card count | line count | effect line rate | examples |
|---|---:|---:|---:|---|
| L1a | 60 | 60 | 1.13% | Shifting Woodland (rank 365); Cursed Mirror (rank 444); Thespian's Stage (rank 558); The Mycosynth Gardens (rank 870); Mirage Mirror (rank 1267) |
| L1b | 62 | 64 | 1.20% | Necropotence (rank 503); Beseech the Mirror (rank 894); Ugin, the Ineffable (rank 1025); Praetor's Grasp (rank 1617); Hoarding Broodlord (rank 1668) |
| L2 | 281 | 290 | 5.45% | Wishclaw Talisman (rank 510); Hellkite Tyrant (rank 784); Ripples of Potential (rank 994); Ocelot Pride (rank 1118); Marvin, Murderous Mimic (rank 1167) |
| L3 | 4 | 4 | 0.08% | New Blood (rank 4248); Mind Bend (rank 15607); Crystal Spray (rank 19990); Magical Hack (rank 21754) |
| L4 | 506 | 523 | 9.83% | Urborg, Tomb of Yawgmoth (rank 72); Yavimaya, Cradle of Growth (rank 75); Roaming Throne (rank 133); Dryad of the Ilysian Grove (rank 291); Phyrexian Metamorph (rank 305) |
| L5 | 64 | 69 | 1.30% | Kenrith's Transformation (rank 690); Imprisoned in the Moon (rank 750); Amphibian Downpour (rank 1215); Leyline of the Guildpact (rank 1705); Song of the Dryads (rank 1794) |
| L6 | 2574 | 2667 | 50.15% | Swiftfoot Boots (rank 12); Lightning Greaves (rank 13); Heroic Intervention (rank 31); The One Ring (rank 89); Garruk's Uprising (rank 92) |
| L7a | 124 | 124 | 2.33% | Psychosis Crawler (rank 447); Adeline, Resplendent Cathar (rank 507); Ashaya, Soul of the Wild (rank 811); Lumra, Bellow of the Woods (rank 1190); Cultivator Colossus (rank 1568) |
| L7b | 147 | 158 | 2.97% | Darksteel Mutation (rank 576); Kenrith's Transformation (rank 690); Mirror Entity (rank 933); Amphibian Downpour (rank 1215); Tezzeret the Seeker (rank 1661) |
| L7c | 2506 | 2585 | 48.61% | Skullclamp (rank 41); Toxic Deluge (rank 67); Return of the Wildspeaker (rank 175); Storm-Kiln Artist (rank 209); Animate Dead (rank 224) |
| L7d | 10 | 10 | 0.19% | Reverse the Polarity (rank 4938); Twisted Image (rank 7183); Inversion Behemoth (rank 10035); Aquamoeba (rank 16072); Merfolk Thaumaturgist (rank 19410) |

## Coverage Curve

| K | layer count | covered card count | covered card rate |
|---:|---:|---:|---:|
| 1 | 1 | 2574 | 14.72% |
| 3 | 3 | 4549 | 26.01% |
| 5 | 5 | 4751 | 27.16% |
| 7 | 7 | 4871 | 27.85% |
| all | 11 | 4937 | 28.23% |

## Examples

### L1a

- rank 365 《Shifting Woodland》: becomes a copy of target permanent card in your graveyard until end of turn
- rank 444 《Cursed Mirror》: become a copy of any creature on the battlefield until end of turn, except it has haste
- rank 558 《Thespian's Stage》: becomes a copy of target land, except it has this ability
- rank 870 《The Mycosynth Gardens》: becomes a copy of target nontoken artifact you control with mana value X
- rank 1267 《Mirage Mirror》: becomes a copy of target artifact, creature, enchantment, or land until end of turn
- rank 1540 《Silent Hallcreeper》: becomes a copy of another target creature you control
- rank 2050 《Likeness Looter》: becomes a copy of target creature card in your graveyard with mana value X, except it has flying and this ability
- rank 2054 《Sarkhan, Soul Aflame》: become a copy of it until end of turn, except its name is Sarkhan, Soul Aflame and it's legendary in addition to its other types
- rank 2092 《Brudiclad, Telchor Engineer》: becomes a copy of that token
- rank 2392 《Saheeli, Sublime Artificer》: becomes a copy of another target artifact or creature you control until end of turn, except it's an artifact in addition to its other types
- rank 2964 《Gogo, Mysterious Mime》: become a copy of another target creature you control until end of turn, except its name is Gogo, Mysterious Mime
- rank 3054 《Court of Vantress》: become a copy of it, except it has this ability
- rank 3690 《Sunfrill Imitator》: become a copy of another target Dinosaur you control, except its name is Sunfrill Imitator and it has this ability
- rank 4473 《Nanogene Conversion》: becomes a copy of that creature until end of turn, except it isn't legendary
- rank 4781 《Irma, Part-Time Mutant》: becomes a copy of up to one other target creature you control, except her name is Irma, Part-Time Mutant and she has this ability

### L1b

- rank 503 《Necropotence》: face down
- rank 894 《Beseech the Mirror》: face down, then shuffle
- rank 1025 《Ugin, the Ineffable》: face down and look at it
- rank 1617 《Praetor's Grasp》: face down
- rank 1668 《Hoarding Broodlord》: face down, then shuffle
- rank 1950 《Gonti, Lord of Luxury》: face down, then put the rest on the bottom of that library in a random order
- rank 2482 《Rev, Tithe Extractor》: face down
- rank 2684 《Gonti, Night Minister》: face down
- rank 3028 《Yedora, Grave Gardener》: face down under its owner's control
- rank 3106 《Thief of Sanity》: face down, then put the rest into their graveyard
- rank 3149 《Decadent Dragon // Expensive Taste》: face down
- rank 3728 《Vivien, Champion of the Wilds》: face down and put the rest on the bottom of your library in any order
- rank 4030 《Unable to Scream》: face down, it can't be turned face up
- rank 4186 《Siphon Insight》: face down and put the other on the bottom of that library
- rank 4612 《Outrageous Robbery》: face down

### L2

- rank 510 《Wishclaw Talisman》: gains control of this artifact
- rank 784 《Hellkite Tyrant》: gain control of all artifacts that player controls
- rank 994 《Ripples of Potential》: you control that had a counter put on them this way
- rank 1118 《Ocelot Pride》: you control that entered this turn, create a token that's a copy of it
- rank 1167 《Marvin, Murderous Mimic》: you control that don't have the same name as this creature
- rank 1178 《Homeward Path》: gains control of all creatures they own
- rank 1254 《Alexios, Deimos of Kosmos》: gains control of Alexios, untaps it, and puts a +1/+1 counter on it
- rank 1293 《Coveted Jewel》: gains control of this artifact
- rank 1446 《Treasure Nabber》: gain control of that artifact until the end of your next turn
- rank 1631 《Secret Tunnel》: you control that share a creature type can't be blocked this turn
- rank 1757 《Seize the Spotlight》: gain control of a creature that player controls until end of turn
- rank 1766 《Archmage's Charm》: Gain control of target nonland permanent with mana value 1 or less
- rank 1782 《Humble Defector》: gains control of this creature
- rank 1797 《Sage's Reverie》: you control that's attached to a creature
- rank 1840 《Overpowering Attack》: you control that attacked this turn

### L3

- rank 4248 《New Blood》: Change the text of that creature by replacing all instances of one creature type with Vampire
- rank 15607 《Mind Bend》: Change the text of target permanent by replacing all instances of one color word with another or one basic land type with another
- rank 19990 《Crystal Spray》: Change the text of target spell or permanent by replacing all instances of one color word with another or one basic land type with another until end of turn
- rank 21754 《Magical Hack》: Change the text of target spell or permanent by replacing all instances of one basic land type with another

### L4

- rank 72 《Urborg, Tomb of Yawgmoth》: is a Swamp in addition to its other land types
- rank 75 《Yavimaya, Cradle of Growth》: is a Forest in addition to its other land types
- rank 133 《Roaming Throne》: in addition to its other types
- rank 291 《Dryad of the Ilysian Grove》: are every basic land type in addition to their other types
- rank 305 《Phyrexian Metamorph》: in addition to its other types
- rank 365 《Shifting Woodland》: becomes a copy of target permanent card in your graveyard until end of turn
- rank 444 《Cursed Mirror》: become a copy of any creature on the battlefield until end of turn, except it has haste
- rank 485 《Maskwood Nexus》: are every creature type
- rank 509 《Liquimetal Torque》: becomes an artifact in addition to its other types until end of turn
- rank 549 《Brotherhood Regalia》: is an Assassin in addition to its other types, and can't be blocked
- rank 558 《Thespian's Stage》: becomes a copy of target land, except it has this ability
- rank 576 《Darksteel Mutation》: is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types
- rank 690 《Kenrith's Transformation》: is a green Elk creature with base power and toughness 3/3
- rank 701 《Aggravated Assault》: is an additional combat phase followed by an additional main phase
- rank 750 《Imprisoned in the Moon》: is a colorless land with and loses all other card types and abilities

### L5

- rank 690 《Kenrith's Transformation》: is a green Elk creature with base power and toughness 3/3
- rank 750 《Imprisoned in the Moon》: is a colorless land with and loses all other card types and abilities
- rank 1215 《Amphibian Downpour》: is a blue Frog creature with base power and toughness 1/1
- rank 1705 《Leyline of the Guildpact》: is all colors
- rank 1794 《Song of the Dryads》: is a colorless Forest land
- rank 1944 《Witness Protection》: is a green and white Citizen creature with base power and toughness 1/1 named Legitimate Businessperson
- rank 1979 《Oko, Thief of Crowns》: becomes a green Elk creature with base power and toughness 3/3
- rank 1993 《Liliana, Death's Majesty》: is a black Zombie in addition to its other colors and types
- rank 2057 《Mycosynth Lattice》: are colorless
- rank 2502 《Crimson Wisps》: becomes red and gains haste until end of turn
- rank 3423 《Nim Deathmantle》: is a black Zombie
- rank 3489 《Steel of the Godhead》: is blue, it gets +1/+1 and can't be blocked
- rank 3489 《Steel of the Godhead》: is white, it gets +1/+1 and has lifelink
- rank 3611 《Eaten by Piranhas》: is a black Skeleton creature with base power and toughness 1/1
- rank 3719 《Unctus, Grand Metatect》: becomes a blue artifact in addition to its other colors and types

### L6

- rank 12 《Swiftfoot Boots》: has hexproof and haste
- rank 13 《Lightning Greaves》: has haste and shroud
- rank 31 《Heroic Intervention》: gain hexproof and indestructible until end of turn
- rank 89 《The One Ring》: gain protection from everything until your next turn
- rank 92 《Garruk's Uprising》: have trample
- rank 105 《Teferi's Protection》: gain protection from everything
- rank 176 《Boros Charm》: gain indestructible until end of turn
- rank 184 《Flawless Maneuver》: gain indestructible until end of turn
- rank 195 《Akroma's Will》: gain flying, vigilance, and double strike until end of turn
- rank 207 《Rhythm of the Wild》: have riot
- rank 240 《Mithril Coat》: has indestructible
- rank 259 《Basilisk Collar》: has deathtouch and lifelink
- rank 272 《Inspiring Call》: gain indestructible until end of turn
- rank 326 《Whispersilk Cloak》: has shroud
- rank 328 《Craterhoof Behemoth》: gain trample and get +X/+X until end of turn, where X is the number of creatures you control

### L7a

- rank 447 《Psychosis Crawler》: power and toughness are each equal to the number of cards in your hand
- rank 507 《Adeline, Resplendent Cathar》: power is equal to the number of creatures you control
- rank 811 《Ashaya, Soul of the Wild》: power and toughness are each equal to the number of lands you control
- rank 1190 《Lumra, Bellow of the Woods》: power and toughness are each equal to the number of lands you control
- rank 1568 《Cultivator Colossus》: power and toughness are each equal to the number of lands you control
- rank 1608 《Consuming Aberration》: power and toughness are each equal to the number of cards in your opponents' graveyards
- rank 1712 《Daxos, Blessed by the Sun》: toughness is equal to your devotion to white
- rank 1816 《Nighthawk Scavenger》: power is equal to 1 plus the number of card types among cards in your opponents' graveyards
- rank 1901 《Bronze Guardian》: power is equal to the number of artifacts you control
- rank 2102 《Body of Knowledge》: power and toughness are each equal to the number of cards in your hand
- rank 2128 《Master of Etherium》: power and toughness are each equal to the number of artifacts you control
- rank 2201 《Beanstalk Giant // Fertile Footsteps》: power and toughness are each equal to the number of lands you control
- rank 2391 《Haughty Djinn》: power is equal to the number of instant and sorcery cards in your graveyard
- rank 2555 《Karn, Legacy Reforged》: power and toughness are each equal to the greatest mana value among artifacts you control
- rank 2606 《Greensleeves, Maro-Sorcerer》: power and toughness are each equal to the number of lands you control

### L7b

- rank 576 《Darksteel Mutation》: base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types
- rank 690 《Kenrith's Transformation》: base power and toughness 3/3
- rank 933 《Mirror Entity》: base power and toughness X/X and gain all creature types
- rank 1215 《Amphibian Downpour》: base power and toughness 1/1
- rank 1661 《Tezzeret the Seeker》: base power and toughness 5/5 until end of turn
- rank 1732 《Allosaurus Shepherd》: base power and toughness 5/5 and becomes a Dinosaur in addition to its other creature types
- rank 1944 《Witness Protection》: base power and toughness 1/1 named Legitimate Businessperson
- rank 1979 《Oko, Thief of Crowns》: base power and toughness 3/3
- rank 2248 《Lignify》: base power and toughness 0/4 and loses all abilities
- rank 2727 《Super State》: base power and toughness 9/9 and has flying, first strike, trample, and haste
- rank 2745 《Jolrael, Mwonvuli Recluse》: base power and toughness X/X, where X is the number of cards in your hand
- rank 3025 《Flayer of Loyalties》: base power and toughness 10/10 and gains trample, annihilator 2, and haste
- rank 3402 《Aettir and Priwen》: base power and toughness X/X, where X is your life total
- rank 3411 《Wrecking Ball Arm》: base power and toughness 7/7 and can't be blocked by creatures with power 2 or less
- rank 3611 《Eaten by Piranhas》: base power and toughness 1/1

### L7c

- rank 41 《Skullclamp》: gets +1/-1
- rank 67 《Toxic Deluge》: get -X/-X until end of turn
- rank 175 《Return of the Wildspeaker》: get +3/+3 until end of turn
- rank 209 《Storm-Kiln Artist》: gets +1/+0 for each artifact you control
- rank 224 《Animate Dead》: gets -1/-0
- rank 225 《Patchwork Banner》: get +1/+1
- rank 243 《Sword of the Animist》: gets +1/+1
- rank 328 《Craterhoof Behemoth》: get +X/+X until end of turn, where X is the number of creatures you control
- rank 329 《Shadowspear》: gets +1/+1 and has trample and lifelink
- rank 331 《Finale of Devastation》: get +X/+X and gain haste until end of turn
- rank 339 《Blackblade Reforged》: gets +1/+1 for each land you control
- rank 354 《Vanquisher's Banner》: get +1/+1
- rank 389 《Kessig Wolf Run》: gets +X/+0 and gains trample until end of turn
- rank 504 《The Meathook Massacre》: gets -X/-X until end of turn
- rank 514 《Massacre Wurm》: get -2/-2 until end of turn

### L7d

- rank 4938 《Reverse the Polarity》: Switch each creature's power and toughness until end of turn
- rank 7183 《Twisted Image》: Switch target creature's power and toughness until end of turn
- rank 10035 《Inversion Behemoth》: switch the power and toughness of each of any number of target creatures until end of turn
- rank 16072 《Aquamoeba》: Switch this creature's power and toughness until end of turn
- rank 19410 《Merfolk Thaumaturgist》: Switch target creature's power and toughness until end of turn
- rank 20071 《Inside Out》: Switch target creature's power and toughness until end of turn
- rank 20307 《Turtleshell Changeling》: Switch this creature's power and toughness until end of turn
- rank 23138 《About Face》: Switch target creature's power and toughness until end of turn
- rank 30987 《Flatman》: Switch Flatman's power and toughness until end of turn
- unranked 《Unstable Robot Dragon》: Switch this creature's power and toughness until end of turn


## Multi Layer Cards

- 《Craterhoof Behemoth》: L6, L7c
- 《Shadowspear》: L6, L7c
- 《Finale of Devastation》: L6, L7c
- 《Shifting Woodland》: L1a, L4
- 《Kessig Wolf Run》: L6, L7c
- 《Cursed Mirror》: L1a, L4, L6
- 《Commander's Plate》: L6, L7c
- 《Sword of Feast and Famine》: L6, L7c
- 《Brotherhood Regalia》: L4, L6
- 《Overwhelming Stampede》: L6, L7c
- 《Thespian's Stage》: L1a, L4, L6
- 《The Reaver Cleaver》: L6, L7c
- 《Darksteel Mutation》: L4, L6, L7b
- 《Intangible Virtue》: L6, L7c
- 《Goreclaw, Terror of Qal Sisma》: L6, L7c
- 《Rising of the Day》: L6, L7c
- 《Kenrith's Transformation》: L4, L5, L6, L7b
- 《Imprisoned in the Moon》: L4, L5, L6
- 《Tyvar's Stand》: L6, L7c
- 《Mockingbird》: L4, L6
- 《Flowering of the White Tree》: L6, L7c
- 《Champion's Helm》: L6, L7c
- 《Rancor》: L6, L7c
- 《Hammer of Nazahn》: L6, L7c
- 《Ashaya, Soul of the Wild》: L4, L7a
- 《The Mycosynth Gardens》: L1a, L4
- 《Sword of Hearth and Home》: L6, L7c
- 《Colossus Hammer》: L6, L7c
- 《Excalibur, Sword of Eden》: L6, L7c
- 《Loxodon Warhammer》: L6, L7c
- 《Bastion Protector》: L6, L7c
- 《Serra Ascendant》: L6, L7c
- 《Karlach, Fury of Avernus》: L4, L6
- 《Ethereal Armor》: L6, L7c
- 《Tyrite Sanctum》: L4, L6
- 《Great Train Heist》: L4, L6, L7c
- 《Marvin, Murderous Mimic》: L2, L6
- 《Enduring Courage》: L6, L7c
- 《Xenagos, God of Revels》: L6, L7c
- 《Amphibian Downpour》: L4, L5, L6, L7b
- 《Triumph of the Hordes》: L6, L7c
- 《Slayers' Stronghold》: L6, L7c
- 《Moonshaker Cavalry》: L6, L7c
- 《Alexios, Deimos of Kosmos》: L2, L6
- 《Mikaeus, the Unhallowed》: L6, L7c
- 《Mirage Mirror》: L1a, L4
- 《Embercleave》: L6, L7c
- 《Genji Glove》: L4, L6
- 《Vraska, Betrayal's Sting》: L4, L6
- 《Lavaspur Boots》: L6, L7c

## Adjudication Candidates

- 《Reliquary Tower》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Thought Vessel》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Chromatic Lantern》: Lands you control have (continuous-looking line without layer tag)
- 《Urza's Saga》: I — This Saga gains (continuous-looking line without layer tag)
- 《Urza's Saga》: II — This Saga gains (continuous-looking line without layer tag)
- 《Roaming Throne》: If a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time. (continuous-looking line without layer tag)
- 《Hardened Scales》: If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead. (continuous-looking line without layer tag)
- 《The Great Henge》: This spell costs {X} less to cast, where X is the greatest power among creatures you control. (continuous-looking line without layer tag)
- 《Ragavan, Nimble Pilferer》: Whenever Ragavan deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card. (continuous-looking line without layer tag)
- 《Decanter of Endless Water》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《The Ozolith》: At the beginning of combat on your turn, if The Ozolith has counters on it, you may move all counters from The Ozolith onto target creature. (continuous-looking line without layer tag)
- 《Pact of Negation》: At the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game. (continuous-looking line without layer tag)
- 《Branching Evolution》: If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead. (continuous-looking line without layer tag)
- 《Goldspan Dragon》: Treasures you control have (continuous-looking line without layer tag)
- 《Kami of Whispered Hopes》: If one or more +1/+1 counters would be put on a permanent you control, that many plus one +1/+1 counters are put on that permanent instead. (continuous-looking line without layer tag)
- 《Spark Double》: You may have this creature enter as a copy of a creature or planeswalker you control, except it enters with an additional +1/+1 counter on it if it's a creature, it enters with... (continuous-looking line without layer tag)
- 《Thassa's Oracle》: When this creature enters, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of... (continuous-looking line without layer tag)
- 《Unnatural Growth》: At the beginning of each combat, double the power and toughness of each creature you control until end of turn. (continuous-looking line without layer tag)
- 《Cabal Ritual》: Threshold — Add {B}{B}{B}{B}{B} instead if there are seven or more cards in your graveyard. (continuous-looking line without layer tag)
- 《Ghalta, Primal Hunger》: This spell costs {X} less to cast, where X is the total power of creatures you control. (continuous-looking line without layer tag)
- 《Enduring Vitality》: Creatures you control have (continuous-looking line without layer tag)
- 《Blasphemous Edict》: You may pay {B} rather than pay this spell's mana cost if there are thirteen or more creatures on the battlefield. (continuous-looking line without layer tag)
- 《Opposition Agent》: While an opponent is searching their library, they exile each card they find. You may play those cards for as long as they remain exiled, and you may spend mana as though it wer... (continuous-looking line without layer tag)
- 《Wizard Class》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Ozolith, the Shattered Spire》: If one or more +1/+1 counters would be put on an artifact or creature you control, that many plus one +1/+1 counters are put on it instead. (continuous-looking line without layer tag)
- 《Purphoros, God of the Forge》: As long as your devotion to red is less than five, Purphoros isn't a creature. (continuous-looking line without layer tag)
- 《Sphere of Safety》: Creatures can't attack you or planeswalkers you control unless their controller pays {X} for each of those creatures, where X is the number of enchantments you control. (continuous-looking line without layer tag)
- 《Sculpting Steel》: You may have this artifact enter as a copy of any artifact on the battlefield. (continuous-looking line without layer tag)
- 《Banner of Kinship》: As this artifact enters, choose a creature type. This artifact enters with a fellowship counter on it for each creature you control of the chosen type. (continuous-looking line without layer tag)
- 《Gravecrawler》: You may cast this card from your graveyard as long as you control a Zombie. (continuous-looking line without layer tag)
- 《Leyline of Anticipation》: If this card is in your opening hand, you may begin the game with it on the battlefield. (continuous-looking line without layer tag)
- 《Cryptolith Rite》: Creatures you control have (continuous-looking line without layer tag)
- 《The World Tree》: As long as you control six or more lands, lands you control have (continuous-looking line without layer tag)
- 《Urza, Lord High Artificer》: {5}: Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost. (continuous-looking line without layer tag)
- 《High Tide》: Until end of turn, whenever a player taps an Island for mana, that player adds an additional {U}. (continuous-looking line without layer tag)
- 《Rishkar, Peema Renegade》: Each creature you control with a counter on it has (continuous-looking line without layer tag)
- 《The Earth Crystal》: If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead. (continuous-looking line without layer tag)
- 《Jaheira, Friend of the Forest》: Tokens you control have (continuous-looking line without layer tag)
- 《Hexing Squelcher》: Other creatures you control have (continuous-looking line without layer tag)
- 《Destiny Spinner》: {3}{G}: Target land you control becomes an X/X Elemental creature with trample and haste until end of turn, where X is the number of enchantments you control. It's still a land. (continuous-looking line without layer tag)
- 《Excalibur, Sword of Eden》: This spell costs {X} less to cast, where X is the total mana value of historic permanents you control. (continuous-looking line without layer tag)
- 《Wayward Swordtooth》: This creature can't attack or block unless you have the city's blessing. (continuous-looking line without layer tag)
- 《Kardur, Doomscourge》: When Kardur enters, until your next turn, creatures your opponents control attack each combat if able and attack a player other than you if able. (continuous-looking line without layer tag)
- 《Promise of Loyalty》: Each player puts a vow counter on a creature they control and sacrifices the rest. Each of those creatures can't attack you or planeswalkers you control for as long as it has a... (continuous-looking line without layer tag)
- 《The Reality Chip》: As long as The Reality Chip is attached to a creature, you may play lands and cast spells from the top of your library. (continuous-looking line without layer tag)
- 《Heliod, Sun-Crowned》: As long as your devotion to white is less than five, Heliod isn't a creature. (continuous-looking line without layer tag)
- 《Nezahal, Primal Tide》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Metallic Mimic》: Each other creature you control of the chosen type enters with an additional +1/+1 counter on it. (continuous-looking line without layer tag)
- 《Not Dead After All》: Until end of turn, target creature you control gains (continuous-looking line without layer tag)
- 《Cyberdrive Awakener》: When this creature enters, each noncreature artifact you control becomes a 4/4 artifact creature until end of turn. (continuous-looking line without layer tag)

## Mapping Failures

- none

