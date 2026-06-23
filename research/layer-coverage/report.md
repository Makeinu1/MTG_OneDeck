# Layer Coverage Report

Measurement-only extraction for CR613 continuous-effect layers and CR604.3 CDA.

## Summary

- Generated at: 2026-06-23T04:09:42.518Z
- Input: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- totalCards: 17491
- mappedCards: 17491
- classified continuous lines: 7418
- cdaCardCount: 128
- multiLayer cards: 1684
- adjudication candidates: 914
- churn: 376/17491 changed (2.15%), baselineCards=17491, byLayer=L1a +51, L2 -91, L4 -113, L6 -4, L7c -109
- mapping failures: 0

## Per Layer

| layer | card count | line count | effect line rate | examples |
|---|---:|---:|---:|---|
| L1a | 112 | 113 | 1.52% | Phyrexian Metamorph (rank 305); Shifting Woodland (rank 365); Spark Double (rank 407); Cursed Mirror (rank 444); Thespian's Stage (rank 558) |
| L1b | 62 | 64 | 0.86% | Necropotence (rank 503); Beseech the Mirror (rank 894); Ugin, the Ineffable (rank 1025); Praetor's Grasp (rank 1617); Hoarding Broodlord (rank 1668) |
| L2 | 193 | 199 | 2.68% | Wishclaw Talisman (rank 510); Hellkite Tyrant (rank 784); Homeward Path (rank 1178); Alexios, Deimos of Kosmos (rank 1254); Coveted Jewel (rank 1293) |
| L3 | 4 | 4 | 0.05% | New Blood (rank 4248); Mind Bend (rank 15607); Crystal Spray (rank 19990); Magical Hack (rank 21754) |
| L4 | 532 | 549 | 7.40% | Urborg, Tomb of Yawgmoth (rank 72); Yavimaya, Cradle of Growth (rank 75); Roaming Throne (rank 133); Dryad of the Ilysian Grove (rank 291); Phyrexian Metamorph (rank 305) |
| L5 | 64 | 69 | 0.93% | Kenrith's Transformation (rank 690); Imprisoned in the Moon (rank 750); Amphibian Downpour (rank 1215); Leyline of the Guildpact (rank 1705); Song of the Dryads (rank 1794) |
| L6 | 2917 | 3035 | 40.91% | Swiftfoot Boots (rank 12); Lightning Greaves (rank 13); Heroic Intervention (rank 31); Chromatic Lantern (rank 81); The One Ring (rank 89) |
| L7a | 124 | 124 | 1.67% | Psychosis Crawler (rank 447); Adeline, Resplendent Cathar (rank 507); Ashaya, Soul of the Wild (rank 811); Lumra, Bellow of the Woods (rank 1190); Cultivator Colossus (rank 1568) |
| L7b | 269 | 282 | 3.80% | Darksteel Mutation (rank 576); Kenrith's Transformation (rank 690); Destiny Spinner (rank 911); Mirror Entity (rank 933); Cyberdrive Awakener (rank 1090) |
| L7c | 4282 | 4577 | 61.70% | Skullclamp (rank 41); Toxic Deluge (rank 67); Return of the Wildspeaker (rank 175); Hardened Scales (rank 188); Storm-Kiln Artist (rank 209) |
| L7d | 10 | 10 | 0.13% | Reverse the Polarity (rank 4938); Twisted Image (rank 7183); Inversion Behemoth (rank 10035); Aquamoeba (rank 16072); Merfolk Thaumaturgist (rank 19410) |

## Coverage Curve

| K | layer count | covered card count | covered card rate |
|---:|---:|---:|---:|
| 1 | 1 | 4282 | 24.48% |
| 3 | 3 | 6291 | 35.97% |
| 5 | 5 | 6429 | 36.76% |
| 7 | 7 | 6582 | 37.63% |
| all | 11 | 6658 | 38.07% |

## Examples

### L1a

- rank 305 《Phyrexian Metamorph》: enter as a copy of any artifact or creature on the battlefield, except it's an artifact in addition to its other types
- rank 365 《Shifting Woodland》: becomes a copy of target permanent card in your graveyard until end of turn
- rank 407 《Spark Double》: enter as a copy of a creature or planeswalker you control, except it enters with an additional +1/+1 counter on it if it's a creature, it enters with an addi...
- rank 444 《Cursed Mirror》: become a copy of any creature on the battlefield until end of turn, except it has haste
- rank 558 《Thespian's Stage》: becomes a copy of target land, except it has this ability
- rank 671 《Sculpting Steel》: enter as a copy of any artifact on the battlefield
- rank 764 《Mockingbird》: enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast this creature, except it's a Bird i...
- rank 870 《The Mycosynth Gardens》: becomes a copy of target nontoken artifact you control with mana value X
- rank 909 《Vesuva》: as a copy of any land on the battlefield
- rank 1083 《Sakashima of a Thousand Faces》: enter as a copy of another creature you control, except it has Sakashima's other abilities
- rank 1194 《Mirrormade》: enter as a copy of any artifact or enchantment on the battlefield
- rank 1267 《Mirage Mirror》: becomes a copy of target artifact, creature, enchantment, or land until end of turn
- rank 1289 《Clever Impersonator》: enter as a copy of any nonland permanent on the battlefield
- rank 1387 《Phantasmal Image》: enter as a copy of any creature on the battlefield, except it's an Illusion in addition to its other types and it has "When this creature becomes the target...
- rank 1540 《Silent Hallcreeper》: becomes a copy of another target creature you control

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
- rank 1178 《Homeward Path》: gains control of all creatures they own
- rank 1254 《Alexios, Deimos of Kosmos》: gains control of Alexios, untaps it, and puts a +1/+1 counter on it
- rank 1293 《Coveted Jewel》: gains control of this artifact
- rank 1446 《Treasure Nabber》: gain control of that artifact until the end of your next turn
- rank 1757 《Seize the Spotlight》: gain control of a creature that player controls until end of turn
- rank 1766 《Archmage's Charm》: Gain control of target nonland permanent with mana value 1 or less
- rank 1782 《Humble Defector》: gains control of this creature
- rank 1842 《Emrakul, the Promised End》: gain control of target opponent during that player's next turn
- rank 1911 《Volatile Stormdrake》: exchange control of this creature and target creature an opponent controls
- rank 1945 《Insurrection》: gain control of them until end of turn
- rank 1979 《Oko, Thief of Crowns》: Exchange control of target artifact or creature you control and target creature an opponent controls with power 3 or less
- rank 2101 《Agent of Treachery》: gain control of target permanent
- rank 2113 《Invert Polarity》: gain control of that spell and you may choose new targets for it

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
- rank 485 《Maskwood Nexus》: are every creature type
- rank 494 《Enduring Vitality》: . It's an enchantment
- rank 509 《Liquimetal Torque》: becomes an artifact in addition to its other types until end of turn
- rank 549 《Brotherhood Regalia》: is an Assassin in addition to its other types, and can't be blocked
- rank 576 《Darksteel Mutation》: is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types
- rank 653 《Purphoros, God of the Forge》: isn't a creature
- rank 690 《Kenrith's Transformation》: is a green Elk creature with base power and toughness 3/3
- rank 750 《Imprisoned in the Moon》: is a colorless land with and loses all other card types and abilities
- rank 764 《Mockingbird》: in addition to its other types and it has flying
- rank 803 《Enduring Innocence》: . It's an enchantment

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
- rank 81 《Chromatic Lantern》: have "{T}: Add one mana of any color."
- rank 89 《The One Ring》: gain protection from everything until your next turn
- rank 92 《Garruk's Uprising》: have trample
- rank 105 《Teferi's Protection》: gain protection from everything
- rank 121 《Urza's Saga》: gains "{2}, {T}: Create a 0/0 colorless Construct artifact creature token with 'This token gets +1/+1 for each artifact you control.'"
- rank 121 《Urza's Saga》: gains "{T}: Add {C}."
- rank 176 《Boros Charm》: gain indestructible until end of turn
- rank 184 《Flawless Maneuver》: gain indestructible until end of turn
- rank 195 《Akroma's Will》: gain flying, vigilance, and double strike until end of turn
- rank 207 《Rhythm of the Wild》: have riot
- rank 224 《Animate Dead》: gains "enchant creature put onto the battlefield with this Aura." Return enchanted creature card to the battlefield under your control and attach this Aura t...
- rank 240 《Mithril Coat》: has indestructible

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
- rank 911 《Destiny Spinner》: becomes an X/X Elemental creature with trample and haste until end of turn, where X is the number of enchantments you control
- rank 933 《Mirror Entity》: base power and toughness X/X and gain all creature types
- rank 1090 《Cyberdrive Awakener》: becomes a 4/4 artifact creature until end of turn
- rank 1215 《Amphibian Downpour》: base power and toughness 1/1
- rank 1586 《Nissa, Who Shakes the World》: becomes a 0/0 Elemental creature with vigilance and haste that's still a land
- rank 1661 《Tezzeret the Seeker》: base power and toughness 5/5 until end of turn
- rank 1732 《Allosaurus Shepherd》: base power and toughness 5/5 and becomes a Dinosaur in addition to its other creature types
- rank 1893 《Mutavault》: becomes a 2/2 creature with all creature types until end of turn
- rank 1944 《Witness Protection》: base power and toughness 1/1 named Legitimate Businessperson
- rank 1979 《Oko, Thief of Crowns》: base power and toughness 3/3
- rank 2014 《Inkmoth Nexus》: becomes a 1/1 Phyrexian Blinkmoth artifact creature with flying and infect until end of turn
- rank 2248 《Lignify》: base power and toughness 0/4 and loses all abilities
- rank 2374 《Lair of the Hydra》: becomes an X/X green Hydra creature

### L7c

- rank 41 《Skullclamp》: gets +1/-1
- rank 67 《Toxic Deluge》: get -X/-X until end of turn
- rank 175 《Return of the Wildspeaker》: get +3/+3 until end of turn
- rank 188 《Hardened Scales》: +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead
- rank 209 《Storm-Kiln Artist》: gets +1/+0 for each artifact you control
- rank 224 《Animate Dead》: gets -1/-0
- rank 225 《Patchwork Banner》: get +1/+1
- rank 235 《The Great Henge》: +1/+1 counter on it and draw a card
- rank 243 《Sword of the Animist》: gets +1/+1
- rank 274 《Avenger of Zendikar》: +1/+1 counter on each Plant creature you control
- rank 328 《Craterhoof Behemoth》: get +X/+X until end of turn, where X is the number of creatures you control
- rank 329 《Shadowspear》: gets +1/+1 and has trample and lifelink
- rank 331 《Finale of Devastation》: get +X/+X and gain haste until end of turn
- rank 339 《Blackblade Reforged》: gets +1/+1 for each land you control
- rank 354 《Vanquisher's Banner》: get +1/+1

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

- 《Animate Dead》: L6, L7c
- 《Phyrexian Metamorph》: L1a, L4
- 《Craterhoof Behemoth》: L6, L7c
- 《Shadowspear》: L6, L7c
- 《Finale of Devastation》: L6, L7c
- 《Kessig Wolf Run》: L6, L7c
- 《Spark Double》: L1a, L7c
- 《Cursed Mirror》: L1a, L6
- 《Snakeskin Veil》: L6, L7c
- 《Felidar Retreat》: L6, L7c
- 《Enduring Vitality》: L4, L6
- 《Commander's Plate》: L6, L7c
- 《Unbreakable Formation》: L6, L7c
- 《Sword of Feast and Famine》: L6, L7c
- 《Brotherhood Regalia》: L4, L6
- 《Overwhelming Stampede》: L6, L7c
- 《The Reaver Cleaver》: L6, L7c
- 《Darksteel Mutation》: L4, L6, L7b
- 《Intangible Virtue》: L6, L7c
- 《Purphoros, God of the Forge》: L4, L7c
- 《Goreclaw, Terror of Qal Sisma》: L6, L7c
- 《Rising of the Day》: L6, L7c
- 《Kenrith's Transformation》: L4, L5, L6, L7b
- 《Innkeeper's Talent》: L6, L7c
- 《Revitalizing Repast // Old-Growth Grove》: L6, L7c
- 《Imprisoned in the Moon》: L4, L5, L6
- 《Tyvar's Stand》: L6, L7c
- 《Mockingbird》: L1a, L4, L6
- 《Flowering of the White Tree》: L6, L7c
- 《Champion's Helm》: L6, L7c
- 《Rancor》: L6, L7c
- 《Hammer of Nazahn》: L6, L7c
- 《Ashaya, Soul of the Wild》: L4, L7a
- 《Rishkar, Peema Renegade》: L6, L7c
- 《Elspeth, Storm Slayer》: L6, L7c
- 《Bear Umbra》: L6, L7c
- 《Sword of Hearth and Home》: L6, L7c
- 《Colossus Hammer》: L6, L7c
- 《Destiny Spinner》: L4, L7b
- 《Excalibur, Sword of Eden》: L6, L7c
- 《Loxodon Warhammer》: L6, L7c
- 《Bastion Protector》: L6, L7c
- 《Serra Ascendant》: L6, L7c
- 《Yahenni, Undying Partisan》: L6, L7c
- 《Heliod, Sun-Crowned》: L4, L6, L7c
- 《Ethereal Armor》: L6, L7c
- 《Tyrite Sanctum》: L4, L6, L7c
- 《Metallic Mimic》: L4, L7c
- 《Sakashima of a Thousand Faces》: L1a, L6
- 《Cyberdrive Awakener》: L4, L6, L7b

## Adjudication Candidates

- 《Reliquary Tower》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Thought Vessel》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Roaming Throne》: If a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time. (continuous-looking line without layer tag)
- 《The Great Henge》: This spell costs {X} less to cast, where X is the greatest power among creatures you control. (continuous-looking line without layer tag)
- 《Ragavan, Nimble Pilferer》: Whenever Ragavan deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card. (continuous-looking line without layer tag)
- 《Decanter of Endless Water》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《The Ozolith》: At the beginning of combat on your turn, if The Ozolith has counters on it, you may move all counters from The Ozolith onto target creature. (continuous-looking line without layer tag)
- 《Pact of Negation》: At the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game. (continuous-looking line without layer tag)
- 《Thassa's Oracle》: When this creature enters, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of... (continuous-looking line without layer tag)
- 《Cabal Ritual》: Threshold — Add {B}{B}{B}{B}{B} instead if there are seven or more cards in your graveyard. (continuous-looking line without layer tag)
- 《Ghalta, Primal Hunger》: This spell costs {X} less to cast, where X is the total power of creatures you control. (continuous-looking line without layer tag)
- 《Blasphemous Edict》: You may pay {B} rather than pay this spell's mana cost if there are thirteen or more creatures on the battlefield. (continuous-looking line without layer tag)
- 《Opposition Agent》: While an opponent is searching their library, they exile each card they find. You may play those cards for as long as they remain exiled, and you may spend mana as though it wer... (continuous-looking line without layer tag)
- 《Wizard Class》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Sphere of Safety》: Creatures can't attack you or planeswalkers you control unless their controller pays {X} for each of those creatures, where X is the number of enchantments you control. (continuous-looking line without layer tag)
- 《Banner of Kinship》: As this artifact enters, choose a creature type. This artifact enters with a fellowship counter on it for each creature you control of the chosen type. (continuous-looking line without layer tag)
- 《Gravecrawler》: You may cast this card from your graveyard as long as you control a Zombie. (continuous-looking line without layer tag)
- 《Leyline of Anticipation》: If this card is in your opening hand, you may begin the game with it on the battlefield. (continuous-looking line without layer tag)
- 《Urza, Lord High Artificer》: {5}: Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost. (continuous-looking line without layer tag)
- 《High Tide》: Until end of turn, whenever a player taps an Island for mana, that player adds an additional {U}. (continuous-looking line without layer tag)
- 《Excalibur, Sword of Eden》: This spell costs {X} less to cast, where X is the total mana value of historic permanents you control. (continuous-looking line without layer tag)
- 《Wayward Swordtooth》: This creature can't attack or block unless you have the city's blessing. (continuous-looking line without layer tag)
- 《Kardur, Doomscourge》: When Kardur enters, until your next turn, creatures your opponents control attack each combat if able and attack a player other than you if able. (continuous-looking line without layer tag)
- 《Promise of Loyalty》: Each player puts a vow counter on a creature they control and sacrifices the rest. Each of those creatures can't attack you or planeswalkers you control for as long as it has a... (continuous-looking line without layer tag)
- 《The Reality Chip》: As long as The Reality Chip is attached to a creature, you may play lands and cast spells from the top of your library. (continuous-looking line without layer tag)
- 《Nezahal, Primal Tide》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Kozilek, Butcher of Truth》: When Kozilek is put into a graveyard from anywhere, its owner shuffles their graveyard into their library. (continuous-looking line without layer tag)
- 《Augur of Autumn》: Coven — As long as you control three or more creatures with different powers, you may cast creature spells from the top of your library. (continuous-looking line without layer tag)
- 《Teferi, Time Raveler》: +1: Until your next turn, you may cast sorcery spells as though they had flash. (continuous-looking line without layer tag)
- 《Spymaster's Vault》: {B}, {T}: Target creature you control connives X, where X is the number of creatures that died this turn. (continuous-looking line without layer tag)
- 《Neheb, the Eternal》: At the beginning of each of your postcombat main phases, add {R} for each 1 life your opponents have lost this turn. (continuous-looking line without layer tag)
- 《Simic Ascendancy》: At the beginning of your upkeep, if this enchantment has twenty or more growth counters on it, you win the game. (continuous-looking line without layer tag)
- 《Past in Flames》: Each instant and sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost. (continuous-looking line without layer tag)
- 《Invasion of Ikoria // Zilortha, Apex of Ikoria》: For each non-Human creature you control, you may have that creature assign its combat damage as though it weren't blocked. (continuous-looking line without layer tag)
- 《Ulamog, the Infinite Gyre》: When Ulamog is put into a graveyard from anywhere, its owner shuffles their graveyard into their library. (continuous-looking line without layer tag)
- 《Vigor》: When Vigor is put into a graveyard from anywhere, shuffle it into its owner's library. (continuous-looking line without layer tag)
- 《Vraska, Betrayal's Sting》: −9: If target player has fewer than nine poison counters, they get a number of poison counters equal to the difference. (continuous-looking line without layer tag)
- 《Conqueror's Flail》: As long as this Equipment is attached to a creature, your opponents can't cast spells during your turn. (continuous-looking line without layer tag)
- 《Snapcaster Mage》: When this creature enters, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost. (continuous-looking line without layer tag)
- 《Cavern-Hoard Dragon》: This spell costs {X} less to cast, where X is the greatest number of artifacts an opponent controls. (continuous-looking line without layer tag)
- 《Triskaidekaphile》: At the beginning of your upkeep, if you have exactly thirteen cards in your hand, you win the game. (continuous-looking line without layer tag)
- 《Triskaidekaphile》: You have no maximum hand size. (continuous-looking line without layer tag)
- 《Apex Altisaur》: Enrage — Whenever this creature is dealt damage, it fights up to one target creature you don't control. (continuous-looking line without layer tag)
- 《Leyline Axe》: If this card is in your opening hand, you may begin the game with it on the battlefield. (continuous-looking line without layer tag)
- 《Final Fortune》: Take an extra turn after this one. At the beginning of that turn's end step, you lose the game. (continuous-looking line without layer tag)
- 《Brass's Tunnel-Grinder // Tecutlan, the Searing Rift》: At the beginning of your end step, if you descended this turn, put a bore counter on Brass's Tunnel-Grinder. Then if there are three or more bore counters on it, remove those co... (continuous-looking line without layer tag)
- 《Brass's Tunnel-Grinder // Tecutlan, the Searing Rift》: Whenever you cast a permanent spell using mana produced by Tecutlan, discover X, where X is that spell's mana value. (continuous-looking line without layer tag)
- 《Ashling, Flame Dancer》: You don't lose unspent red mana as steps and phases end. (continuous-looking line without layer tag)
- 《Full Throttle》: After this main phase, there are two additional combat phases. (continuous-looking line without layer tag)
- 《The Skullspore Nexus》: {2}, {T}: Double target creature's power until end of turn. (continuous-looking line without layer tag)

## Mapping Failures

- none

