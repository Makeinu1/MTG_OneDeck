# Event Coverage Report

Measurement-only extraction for trigger event families, observer scopes, and intervening-if conditions.

## Summary

- Generated at: 2026-06-25T14:46:25.379Z
- Input: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- totalCards: 17491
- mappedCards: 17491
- trigger lines: 10060
- interveningIfCardCount: 827 (4.73%)
- multiFamily cards: 1542
- churn: 341/17491 changed (1.95%), baselineCards=17491, byFamily=enters +25, leaves +15, dies +34, zone +4, cast +44, attacks +33, blocks +3, damage +23, draw +1, discard +7, tap +3, counter +1, phase +45, other +83
- mapping failures: 0

## Per Family

| family | card count | line count | trigger line rate | examples |
|---|---:|---:|---:|---|
| enters | 3736 | 3834 | 38.11% | Bojuka Bog (rank 25); Solemn Simulacrum (rank 38); The One Ring (rank 89); Garruk's Uprising (rank 92); Garruk's Uprising (rank 92) |
| leaves | 204 | 206 | 2.05% | Animate Dead (rank 224); The Ozolith (rank 302); Marionette Apprentice (rank 556); Rancor (rank 793); Nadier's Nightblade (rank 843) |
| dies | 775 | 790 | 7.85% | Solemn Simulacrum (rank 38); Skullclamp (rank 41); Blood Artist (rank 138); Pitiless Plunderer (rank 229); Zulaport Cutthroat (rank 233) |
| zone | 107 | 108 | 1.07% | Syr Konrad, the Grim (rank 252); Bloodchief Ascension (rank 737); Kaya's Ghostform (rank 753); The Gitrog Monster (rank 890); Kozilek, Butcher of Truth (rank 1099) |
| cast | 878 | 913 | 9.08% | Path of Ancestry (rank 14); Rhystic Study (rank 43); Esper Sentinel (rank 76); Mystic Remora (rank 96); Storm-Kiln Artist (rank 209) |
| attacks | 1349 | 1372 | 13.64% | Sword of the Animist (rank 243); Etali, Primal Storm (rank 260); Sun Titan (rank 289); Kindred Discovery (rank 347); Goldspan Dragon (rank 401) |
| blocks | 78 | 79 | 0.79% | Smuggler's Copter (rank 1862); Grazilaxx, Illithid Scholar (rank 1878); Giggling Skitterspike (rank 2265); Elder Gargaroth (rank 2353); Anzrag, the Quake-Mole (rank 2706) |
| damage | 716 | 728 | 7.24% | Professional Face-Breaker (rank 216); Ragavan, Nimble Pilferer (rank 269); Toski, Bearer of Secrets (rank 381); Kutzil, Malamet Exemplar (rank 385); Bident of Thassa (rank 410) |
| draw | 116 | 118 | 1.17% | Smothering Tithe (rank 62); Orcish Bowmasters (rank 254); Faerie Mastermind (rank 327); Psychosis Crawler (rank 447); Sheoldred, the Apocalypse (rank 464) |
| discard | 65 | 71 | 0.71% | Necropotence (rank 503); Monument to Endurance (rank 1119); Waste Not (rank 1253); Waste Not (rank 1253); Waste Not (rank 1253) |
| sacrifice | 96 | 97 | 0.96% | Mirkwood Bats (rank 223); Mayhem Devil (rank 580); Tireless Tracker (rank 622); Captain Lannery Storm (rank 1145); Nuka-Cola Vending Machine (rank 1287) |
| tap | 72 | 73 | 0.73% | City of Brass (rank 97); Mesmeric Orb (rank 1082); Key to the City (rank 1323); Magda, Brazen Outlaw (rank 1330); Ghostly Pilferer (rank 1406) |
| counter | 61 | 61 | 0.61% | Midnight Clock (rank 610); Evolution Witness (rank 905); Terrasymbiosis (rank 981); Simic Ascendancy (rank 1262); Exemplar of Light (rank 1332) |
| life | 84 | 87 | 0.86% | Vito, Thorn of the Dusk Rose (rank 489); Sanguine Bond (rank 497); Exquisite Blood (rank 505); Enduring Tenacity (rank 858); Bloodthirsty Conqueror (rank 926) |
| phase | 1242 | 1285 | 12.77% | The One Ring (rank 89); Phyrexian Arena (rank 98); Mana Drain (rank 115); Black Market Connections (rank 132); Herald's Horn (rank 141) |
| other | 799 | 824 | 8.19% | Wild Growth (rank 211); Mirkwood Bats (rank 223); Utopia Sprawl (rank 341); Goldspan Dragon (rank 401); Crypt Ghast (rank 525) |

## Observer Distribution

| observer | card count | line count |
|---|---:|---:|
| any | 694 | 722 |
| controlled-set | 1200 | 1226 |
| opponent | 304 | 313 |
| self | 7154 | 8002 |
| unknown | 98 | 99 |

## Trigger Shape Distribution

| shape | card count | line count |
|---|---:|---:|
| at | 1242 | 1285 |
| when | 3932 | 4110 |
| whenever | 4498 | 4843 |

## Examples

### enters

- rank 25 《Bojuka Bog》: When this land enters
- rank 38 《Solemn Simulacrum》: When this creature enters
- rank 89 《The One Ring》: When The One Ring enters
- rank 92 《Garruk's Uprising》: When this enchantment enters
- rank 92 《Garruk's Uprising》: Whenever a creature you control with power 4 or greater enters
- rank 109 《Eternal Witness》: When this creature enters
- rank 143 《Chrome Mox》: When this artifact enters
- rank 172 《Mystic Sanctuary》: When this land enters untapped
- rank 180 《Tireless Provisioner》: Whenever a land you control enters
- rank 186 《Impact Tremors》: Whenever a creature you control enters
- rank 222 《Scute Swarm》: Whenever a land you control enters
- rank 224 《Animate Dead》: When this Aura enters
- rank 235 《The Great Henge》: Whenever a nontoken creature you control enters
- rank 240 《Mithril Coat》: When Mithril Coat enters
- rank 241 《Gray Merchant of Asphodel》: When this creature enters

### leaves

- rank 224 《Animate Dead》: When this Aura leaves the battlefield
- rank 302 《The Ozolith》: Whenever a creature you control leaves the battlefield
- rank 556 《Marionette Apprentice》: Whenever another creature or artifact you control is put into a graveyard from the battlefield
- rank 793 《Rancor》: When this Aura is put into a graveyard from the battlefield
- rank 843 《Nadier's Nightblade》: Whenever a token you control leaves the battlefield
- rank 860 《Scrap Trawler》: Whenever this creature dies or another artifact you control is put into a graveyard from the battlefield
- rank 948 《Ichor Wellspring》: When this artifact enters or is put into a graveyard from the battlefield
- rank 986 《Necromancy》: When this enchantment leaves the battlefield
- rank 1025 《Ugin, the Ineffable》: When that token leaves the battlefield
- rank 1117 《Titania, Protector of Argoth》: Whenever a land you control is put into a graveyard from the battlefield
- rank 1144 《Tarrian's Soulcleaver》: Whenever another artifact or creature is put into a graveyard from the battlefield
- rank 1160 《Starfield Mystic》: Whenever an enchantment you control is put into a graveyard from the battlefield
- rank 1192 《Skyclave Apparition》: When this creature leaves the battlefield
- rank 1434 《Marionette Master》: Whenever an artifact you control is put into a graveyard from the battlefield
- rank 1503 《Dour Port-Mage》: Whenever one or more other creatures you control leave the battlefield without dying

### dies

- rank 38 《Solemn Simulacrum》: When this creature dies
- rank 41 《Skullclamp》: Whenever equipped creature dies
- rank 138 《Blood Artist》: Whenever this creature or another creature dies
- rank 229 《Pitiless Plunderer》: Whenever another creature you control dies
- rank 233 《Zulaport Cutthroat》: Whenever this creature or another creature you control dies
- rank 252 《Syr Konrad, the Grim》: Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard
- rank 257 《Morbid Opportunist》: Whenever one or more other creatures die
- rank 330 《Bastion of Remembrance》: Whenever a creature you control dies
- rank 494 《Enduring Vitality》: When Enduring Vitality dies
- rank 504 《The Meathook Massacre》: Whenever a creature an opponent controls dies
- rank 504 《The Meathook Massacre》: Whenever a creature you control dies
- rank 514 《Massacre Wurm》: Whenever a creature an opponent controls dies
- rank 556 《Marionette Apprentice》: Whenever another creature or artifact you control is put into a graveyard from the battlefield
- rank 567 《Grave Pact》: Whenever a creature you control dies
- rank 595 《Elas il-Kor, Sadistic Pilgrim》: Whenever another creature you control dies

### zone

- rank 252 《Syr Konrad, the Grim》: Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard
- rank 737 《Bloodchief Ascension》: Whenever a card is put into an opponent's graveyard from anywhere
- rank 753 《Kaya's Ghostform》: When enchanted permanent dies or is put into exile
- rank 890 《The Gitrog Monster》: Whenever one or more land cards are put into your graveyard from anywhere
- rank 1099 《Kozilek, Butcher of Truth》: When Kozilek is put into a graveyard from anywhere
- rank 1297 《Laelia, the Blade Reforged》: Whenever one or more cards are put into exile from your library and/or your graveyard
- rank 1310 《Hedge Shredder》: Whenever one or more land cards are put into your graveyard from your library
- rank 1326 《Ulamog, the Infinite Gyre》: When Ulamog is put into a graveyard from anywhere
- rank 1329 《Vigor》: When Vigor is put into a graveyard from anywhere
- rank 1351 《Insidious Roots》: Whenever one or more creature cards leave your graveyard
- rank 1386 《Agatha's Soul Cauldron》: When a creature card is exiled this way
- rank 1651 《Soulherder》: Whenever a creature is exiled from the battlefield
- rank 1881 《Teval's Judgment》: Whenever one or more cards leave your graveyard
- rank 2032 《Colossal Grave-Reaver》: Whenever one or more creature cards are put into your graveyard from your library
- rank 2224 《Prosper, Tome-Bound》: Whenever you play a card from exile

### cast

- rank 14 《Path of Ancestry》: When that mana is spent to cast a creature spell that shares a creature type with your commander
- rank 43 《Rhystic Study》: Whenever an opponent casts a spell
- rank 76 《Esper Sentinel》: Whenever an opponent casts their first noncreature spell each turn
- rank 96 《Mystic Remora》: Whenever an opponent casts a noncreature spell
- rank 209 《Storm-Kiln Artist》: Whenever you cast or copy an instant or sorcery spell
- rank 212 《Beast Whisperer》: Whenever you cast a creature spell
- rank 258 《Archmage Emeritus》: Whenever you cast or copy an instant or sorcery spell
- rank 267 《Hullbreaker Horror》: Whenever you cast a spell
- rank 354 《Vanquisher's Banner》: Whenever you cast a creature spell of the chosen type
- rank 374 《Aetherflux Reservoir》: Whenever you cast a spell
- rank 395 《Forgotten Ancient》: Whenever a player casts a spell
- rank 400 《Guttersnipe》: Whenever you cast an instant or sorcery spell
- rank 408 《Lotho, Corrupt Shirriff》: Whenever a player casts their second spell each turn
- rank 461 《Sram, Senior Edificer》: Whenever you cast an Aura, Equipment, or Vehicle spell
- rank 540 《Displacer Kitten》: Whenever you cast a noncreature spell

### attacks

- rank 243 《Sword of the Animist》: Whenever equipped creature attacks
- rank 260 《Etali, Primal Storm》: Whenever Etali attacks
- rank 289 《Sun Titan》: Whenever this creature enters or attacks
- rank 347 《Kindred Discovery》: Whenever a creature you control of the chosen type enters or attacks
- rank 401 《Goldspan Dragon》: Whenever this creature attacks or becomes the target of a spell
- rank 507 《Adeline, Resplendent Cathar》: Whenever you attack
- rank 555 《Six》: Whenever Six attacks
- rank 564 《Beastmaster Ascension》: Whenever a creature you control attacks
- rank 626 《Mangara, the Diplomat》: Whenever an opponent attacks with creatures
- rank 630 《Trouble in Pairs》: Whenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn
- rank 663 《Shared Animosity》: Whenever a creature you control attacks
- rank 678 《Goreclaw, Terror of Qal Sisma》: Whenever Goreclaw attacks
- rank 709 《Curse of Opulence》: Whenever enchanted player is attacked
- rank 734 《Aqueous Form》: Whenever enchanted creature attacks
- rank 826 《Aurelia, the Warleader》: Whenever Aurelia attacks for the first time each turn

### blocks

- rank 1862 《Smuggler's Copter》: Whenever this Vehicle attacks or blocks
- rank 1878 《Grazilaxx, Illithid Scholar》: Whenever a creature you control becomes blocked
- rank 2265 《Giggling Skitterspike》: Whenever this creature attacks, blocks, or becomes the target of a spell
- rank 2353 《Elder Gargaroth》: Whenever this creature attacks or blocks
- rank 2706 《Anzrag, the Quake-Mole》: Whenever Anzrag becomes blocked
- rank 3075 《Brimaz, King of Oreskos》: Whenever Brimaz blocks a creature
- rank 3097 《Savvy Hunter》: Whenever this creature attacks or blocks
- rank 3672 《Infiltration Lens》: Whenever equipped creature becomes blocked by a creature
- rank 4185 《The Restoration of Eiganjo // Architect of Restoration》: Whenever this creature attacks or blocks
- rank 4534 《Azusa's Many Journeys // Likeness of the Seeker》: Whenever this creature becomes blocked
- rank 4652 《Wand of Orcus》: Whenever equipped creature attacks or blocks
- rank 4679 《Ichorclaw Myr》: Whenever this creature becomes blocked
- rank 5076 《Ashcoat of the Shadow Swarm》: Whenever Ashcoat attacks or blocks
- rank 5306 《Kangee, Sky Warden》: Whenever Kangee blocks
- rank 5372 《Sapphire Dragon // Psionic Pulse》: Whenever this creature attacks or blocks

### damage

- rank 216 《Professional Face-Breaker》: Whenever one or more creatures you control deal combat damage to a player
- rank 269 《Ragavan, Nimble Pilferer》: Whenever Ragavan deals combat damage to a player
- rank 381 《Toski, Bearer of Secrets》: Whenever a creature you control deals combat damage to a player
- rank 385 《Kutzil, Malamet Exemplar》: Whenever one or more creatures you control each with power greater than its base power deals combat damage to a player
- rank 410 《Bident of Thassa》: Whenever a creature you control deals combat damage to a player
- rank 458 《Ohran Frostfang》: Whenever a creature you control deals combat damage to a player
- rank 543 《Sword of Feast and Famine》: Whenever equipped creature deals combat damage to a player
- rank 594 《Curiosity》: Whenever enchanted creature deals damage to an opponent
- rank 645 《Ancient Copper Dragon》: Whenever this creature deals combat damage to a player
- rank 761 《Etali, Primal Conqueror // Etali, Primal Sickness》: Whenever Etali deals combat damage to a player
- rank 784 《Hellkite Tyrant》: Whenever this creature deals combat damage to a player
- rank 786 《Brash Taunter》: Whenever this creature is dealt damage
- rank 820 《Kodama of the West Tree》: Whenever a modified creature you control deals combat damage to a player
- rank 831 《Thrummingbird》: Whenever this creature deals combat damage to a player
- rank 867 《Enduring Curiosity》: Whenever a creature you control deals combat damage to a player

### draw

- rank 62 《Smothering Tithe》: Whenever an opponent draws a card
- rank 254 《Orcish Bowmasters》: whenever an opponent draws a card except the first one they draw in each of their draw steps
- rank 327 《Faerie Mastermind》: Whenever an opponent draws their second card each turn
- rank 447 《Psychosis Crawler》: Whenever you draw a card
- rank 464 《Sheoldred, the Apocalypse》: Whenever an opponent draws a card
- rank 464 《Sheoldred, the Apocalypse》: Whenever you draw a card
- rank 630 《Trouble in Pairs》: Whenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn
- rank 646 《Wizard Class》: Whenever you draw a card
- rank 655 《Consecrated Sphinx》: Whenever an opponent draws a card
- rank 664 《Scrawling Crawler》: Whenever an opponent draws a card
- rank 719 《Chasm Skulker》: Whenever you draw a card
- rank 731 《Niv-Mizzet, Parun》: Whenever you draw a card
- rank 1020 《Razorkin Needlehead》: Whenever an opponent draws a card
- rank 1393 《Tataru Taru》: Whenever an opponent draws a card
- rank 1398 《Ominous Seas》: Whenever you draw a card

### discard

- rank 503 《Necropotence》: Whenever you discard a card
- rank 1119 《Monument to Endurance》: Whenever you discard a card
- rank 1253 《Waste Not》: Whenever an opponent discards a creature card
- rank 1253 《Waste Not》: Whenever an opponent discards a land card
- rank 1253 《Waste Not》: Whenever an opponent discards a noncreature
- rank 1376 《Archfiend of Ifnir》: Whenever you cycle or discard another card
- rank 1909 《Inti, Seneschal of the Sun》: Whenever you discard one or more cards
- rank 1951 《Sangromancer》: Whenever an opponent discards a card
- rank 1965 《Containment Construct》: Whenever you discard a card
- rank 1998 《Glint-Horn Buccaneer》: Whenever you discard a card
- rank 2216 《Bone Miser》: Whenever you discard a creature card
- rank 2216 《Bone Miser》: Whenever you discard a land card
- rank 2216 《Bone Miser》: Whenever you discard a noncreature
- rank 2453 《Liliana's Caress》: Whenever an opponent discards a card
- rank 2487 《Aclazotz, Deepest Betrayal // Temple of the Dead》: Whenever an opponent discards a land card

### sacrifice

- rank 223 《Mirkwood Bats》: Whenever you create or sacrifice a token
- rank 580 《Mayhem Devil》: Whenever a player sacrifices a permanent
- rank 622 《Tireless Tracker》: Whenever you sacrifice a Clue
- rank 1145 《Captain Lannery Storm》: Whenever you sacrifice a Treasure
- rank 1287 《Nuka-Cola Vending Machine》: Whenever you sacrifice a Food
- rank 1399 《Crime Novelist》: Whenever you sacrifice an artifact
- rank 1510 《It That Betrays》: Whenever an opponent sacrifices a nontoken permanent
- rank 1646 《Mazirek, Kraul Death Priest》: Whenever a player sacrifices another permanent
- rank 1863 《Juri, Master of the Revue》: Whenever you sacrifice a permanent
- rank 1886 《Korvold, Fae-Cursed King》: Whenever you sacrifice a permanent
- rank 2559 《Camellia, the Seedmiser》: Whenever you sacrifice one or more Foods
- rank 2671 《Carmen, Cruel Skymarcher》: Whenever a player sacrifices a permanent
- rank 2769 《Heaped Harvest》: when you sacrifice it
- rank 2812 《Ravenous Squirrel》: Whenever you sacrifice an artifact or creature
- rank 3208 《Rapacious Guest》: Whenever you sacrifice a Food

### tap

- rank 97 《City of Brass》: Whenever this land becomes tapped
- rank 1082 《Mesmeric Orb》: Whenever a permanent becomes untapped
- rank 1323 《Key to the City》: Whenever this artifact becomes untapped
- rank 1330 《Magda, Brazen Outlaw》: Whenever a Dwarf you control becomes tapped
- rank 1406 《Ghostly Pilferer》: Whenever this creature becomes untapped
- rank 3503 《Kilo, Apogee Mind》: Whenever Kilo becomes tapped
- rank 4291 《Verity Circle》: Whenever a creature an opponent controls becomes tapped
- rank 4465 《Armored Scrapgorger》: Whenever this creature becomes tapped
- rank 4625 《Deeproot Pilgrimage》: Whenever one or more nontoken Merfolk you control become tapped
- rank 5292 《Scaretiller》: Whenever this creature becomes tapped
- rank 6564 《Emmara, Soul of the Accord》: Whenever Emmara becomes tapped
- rank 6868 《Immersturm Predator》: Whenever this creature becomes tapped
- rank 6928 《The Ninth Doctor》: Whenever The Ninth Doctor becomes untapped during your untap step
- rank 7202 《Gran-Gran》: Whenever Gran-Gran becomes tapped
- rank 7578 《Phyrexian Atlas》: Whenever this artifact becomes tapped

### counter

- rank 610 《Midnight Clock》: When the twelfth hour counter is put on this artifact
- rank 905 《Evolution Witness》: Whenever one or more +1/+1 counters are put on this creature
- rank 981 《Terrasymbiosis》: Whenever you put one or more +1/+1 counters on a creature you control
- rank 1262 《Simic Ascendancy》: Whenever one or more +1/+1 counters are put on a creature you control
- rank 1332 《Exemplar of Light》: Whenever you put one or more +1/+1 counters on this creature
- rank 1400 《All Will Be One》: Whenever you put one or more counters on a permanent or player
- rank 1713 《Fathom Mage》: Whenever a +1/+1 counter is put on this creature
- rank 2077 《Basking Broodscale》: Whenever one or more +1/+1 counters are put on this creature
- rank 2257 《Scurry Oak》: Whenever one or more +1/+1 counters are put on this creature
- rank 2654 《Dusk Legion Duelist》: Whenever one or more +1/+1 counters are put on this creature
- rank 3384 《Hollowmurk Siege》: Whenever a counter is put on a creature you control
- rank 3480 《Generous Patron》: Whenever you put one or more counters on a creature you don't control
- rank 3556 《Stocking the Pantry》: Whenever you put one or more +1/+1 counters on a creature you control
- rank 3707 《Wildwood Scourge》: Whenever one or more +1/+1 counters are put on another non-Hydra creature you control
- rank 3864 《Shalai and Hallar》: Whenever one or more +1/+1 counters are put on a creature you control

### life

- rank 489 《Vito, Thorn of the Dusk Rose》: Whenever you gain life
- rank 497 《Sanguine Bond》: Whenever you gain life
- rank 505 《Exquisite Blood》: Whenever an opponent loses life
- rank 858 《Enduring Tenacity》: Whenever you gain life
- rank 926 《Bloodthirsty Conqueror》: Whenever an opponent loses life
- rank 962 《Mindcrank》: Whenever an opponent loses life
- rank 1018 《Heliod, Sun-Crowned》: Whenever you gain life
- rank 1100 《Vilis, Broker of Blood》: Whenever you lose life
- rank 1104 《Marauding Blight-Priest》: Whenever you gain life
- rank 1116 《Well of Lost Dreams》: Whenever you gain life
- rank 1332 《Exemplar of Light》: Whenever you gain life
- rank 1484 《Cleric Class》: Whenever you gain life
- rank 1490 《Archangel of Thune》: Whenever you gain life
- rank 1868 《Elenda's Hierophant》: Whenever you gain life
- rank 2020 《Wedding Ring》: Whenever an opponent who controls an artifact named Wedding Ring gains life during their turn

### phase

- rank 89 《The One Ring》: At the beginning of your upkeep
- rank 98 《Phyrexian Arena》: At the beginning of your upkeep
- rank 115 《Mana Drain》: At the beginning of your next main phase
- rank 132 《Black Market Connections》: At the beginning of your first main phase
- rank 141 《Herald's Horn》: At the beginning of your upkeep
- rank 144 《Mana Vault》: At the beginning of your draw step
- rank 144 《Mana Vault》: At the beginning of your upkeep
- rank 256 《Sylvan Library》: At the beginning of your draw step
- rank 279 《Inventors' Fair》: At the beginning of your upkeep
- rank 288 《Braids, Arisen Nightmare》: At the beginning of your end step
- rank 302 《The Ozolith》: At the beginning of combat on your turn
- rank 359 《Pact of Negation》: At the beginning of your next upkeep
- rank 388 《Underworld Breach》: At the beginning of the end step
- rank 391 《Land Tax》: At the beginning of your upkeep
- rank 395 《Forgotten Ancient》: At the beginning of your upkeep

### other

- rank 211 《Wild Growth》: Whenever enchanted land is tapped for mana
- rank 223 《Mirkwood Bats》: Whenever you create or sacrifice a token
- rank 341 《Utopia Sprawl》: Whenever enchanted Forest is tapped for mana
- rank 401 《Goldspan Dragon》: Whenever this creature attacks or becomes the target of a spell
- rank 525 《Crypt Ghast》: Whenever you tap a Swamp for mana
- rank 646 《Wizard Class》: When this Class becomes level 2
- rank 662 《Caretaker's Talent》: When this Class becomes level 2
- rank 667 《Archivist of Oghma》: Whenever an opponent searches their library
- rank 668 《Mirari's Wake》: Whenever you tap a land for mana
- rank 691 《Forbidden Orchard》: Whenever you tap this land for mana
- rank 707 《Riveteers Overlook》: When you do
- rank 806 《High Tide》: whenever a player taps an Island for mana
- rank 873 《Forsaken Monument》: Whenever you tap a permanent for {C}
- rank 876 《Caged Sun》: Whenever a land's ability causes you to add one or more mana of the chosen color
- rank 902 《Burgeoning》: Whenever an opponent plays a land


## Multi Family Cards

- 《Solemn Simulacrum》: dies, enters
- 《The One Ring》: enters, phase
- 《Mirkwood Bats》: other, sacrifice
- 《Animate Dead》: enters, leaves
- 《Syr Konrad, the Grim》: dies, zone
- 《Orcish Bowmasters》: draw, enters
- 《Sun Titan》: attacks, enters
- 《The Ozolith》: leaves, phase
- 《Bastion of Remembrance》: dies, enters
- 《Kindred Discovery》: attacks, enters
- 《Forgotten Ancient》: cast, phase
- 《Goldspan Dragon》: attacks, other
- 《The Meathook Massacre》: dies, enters
- 《Massacre Wurm》: dies, enters
- 《Marionette Apprentice》: dies, leaves
- 《Growing Rites of Itlimoc // Itlimoc, Cradle of the Sun》: enters, phase
- 《Elas il-Kor, Sadistic Pilgrim》: dies, enters
- 《Midnight Clock》: counter, phase
- 《Tireless Tracker》: enters, sacrifice
- 《Mangara, the Diplomat》: attacks, cast
- 《Trouble in Pairs》: attacks, cast, draw
- 《Stitcher's Supplier》: dies, enters
- 《Wizard Class》: draw, other
- 《Black Market》: dies, phase
- 《Caretaker's Talent》: enters, other
- 《Scrawling Crawler》: draw, phase
- 《Riveteers Overlook》: enters, other
- 《Chasm Skulker》: dies, draw
- 《Niv-Mizzet, Parun》: cast, draw
- 《Bloodchief Ascension》: phase, zone
- 《Kaya's Ghostform》: dies, zone
- 《Etali, Primal Conqueror // Etali, Primal Sickness》: damage, enters
- 《Hellkite Tyrant》: damage, phase
- 《Enduring Innocence》: dies, enters
- 《Enduring Tenacity》: dies, life
- 《Scrap Trawler》: dies, leaves
- 《Enduring Curiosity》: damage, dies
- 《Forsaken Monument》: cast, other
- 《Myr Battlesphere》: attacks, enters
- 《The Gitrog Monster》: phase, zone
- 《Thopter Spy Network》: damage, phase
- 《Omnath, Locus of Rage》: dies, enters
- 《Ichor Wellspring》: enters, leaves
- 《Cabaretti Courtyard》: enters, other
- 《Kardur, Doomscourge》: dies, enters
- 《Necromancy》: enters, leaves
- 《Moraug, Fury of Akoum》: enters, phase
- 《Up the Beanstalk》: cast, enters
- 《Portal to Phyrexia》: enters, phase
- 《Kozilek, Butcher of Truth》: cast, zone

## Mapping Failures

- none

