# MyDeck Playability Census (static compiler coverage)

Generated: 2026-08-05T02:02:24.682Z

## Re-run

`npx tsx scripts/mydeck-scoring/census.ts`

## What this measures

Every resolved card's oracle ability lines are run through the REAL engine compiler (`parseAbilityIR` + `compileAbilityIR` from `src/engine/grammar/`), not a blind regex heuristic. Each line is bucketed by `compiled.decision`: `auto` (engine fully resolves it), `guided` (engine needs a player choice/target — a prompt), or `manual` (engine cannot resolve it at all).

CompileContext per card: { sourceId: <instance-like id>, def, commanderColorIdentity: <deck commander colorIdentity intersected with WUBRG> }. No live GameState exists in this static census, so commanderColorIdentity is derived directly from the deck entry file's Commander card (line 2 of each Mydeck/<deck>.txt), matching commanderColorIdentityForState() in src/engine/commands.ts. allowLibrarySearchComposite/libraryShuffleOrder left at defaults (undefined).

- local snapshot: `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`
- optional fallback file: `research/mydeck-scoring/scryfall-fallback.cards.json`

## Per-deck summary

| deck | entries | resolved | unresolved | auto cards | guided cards | manual cards | auto lines | guided lines | manual lines |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Celes | 99 | 95 | 4 | 11 | 8 | 76 | 33/180 | 19/180 | 128/180 |
| Gogo | 83 | 76 | 7 | 6 | 8 | 62 | 20/144 | 20/144 | 104/144 |
| Kefka | 103 | 99 | 4 | 12 | 6 | 81 | 34/192 | 14/192 | 144/192 |
| Muldrotha | 96 | 93 | 3 | 12 | 12 | 69 | 22/148 | 16/148 | 110/148 |
| ALL | 381 | 363 | 18 | 41 | 34 | 288 | 109/664 | 69/664 | 486/664 |

## Cross-deck recurring gaps

### Unsupported cards (worst line = manual) recurring across >1 deck

| key | decks affected | occurrences |
|---|---|---:|
| `Fabled Passage` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `Blasphemous Act` | Celes, Kefka | 2 |
| `Blasphemous Edict` | Kefka, Muldrotha | 2 |
| `Blood Crypt` | Celes, Kefka | 2 |
| `Chthonian Nightmare` | Celes, Muldrotha | 2 |
| `Fable of the Mirror-Breaker // Reflection of Kiki-Jiki` | Celes, Kefka | 2 |
| `Flooded Strand` | Gogo, Muldrotha | 2 |
| `Graven Cairns` | Celes, Kefka | 2 |
| `Haunted Ridge` | Celes, Kefka | 2 |
| `Luxury Suite` | Celes, Kefka | 2 |
| `Magus of the Wheel` | Celes, Kefka | 2 |
| `Mana Vault` | Gogo, Muldrotha | 2 |
| `Misty Rainforest` | Gogo, Muldrotha | 2 |
| `Mystic Sanctuary` | Gogo, Muldrotha | 2 |
| `Polluted Delta` | Gogo, Muldrotha | 2 |
| `Sulfurous Springs` | Celes, Kefka | 2 |
| `Swan Song` | Gogo, Muldrotha | 2 |
| `Talisman of Indulgence` | Celes, Kefka | 2 |
| `The One Ring` | Gogo, Muldrotha | 2 |
| `Toxic Deluge` | Kefka, Muldrotha | 2 |
| `Watery Grave` | Kefka, Muldrotha | 2 |

### Needs-click cards (worst line = guided) recurring across >1 deck

| key | decks affected | occurrences |
|---|---|---:|
| `Arcane Signet` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `Command Tower` | Celes, Kefka, Muldrotha | 3 |
| `Accursed Marauder` | Celes, Muldrotha | 2 |
| `Displacer Kitten` | Gogo, Muldrotha | 2 |
| `Exotic Orchard` | Celes, Kefka | 2 |
| `Fellwar Stone` | Gogo, Kefka | 2 |
| `Lotus Petal` | Gogo, Muldrotha | 2 |

### Manual-reason patterns recurring across >1 deck

| key | decks affected | occurrences |
|---|---|---:|
| `needs-choice` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `needs-parse` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `needs-target` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `no-command` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `no-effect` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `optional` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `variable-count` | Celes, Gogo, Kefka, Muldrotha | 4 |
| `ambiguous-mana` | Celes, Kefka, Muldrotha | 3 |

## Unresolved (not found in snapshot)

- Celes:7 1 Bounty Agent
- Celes:40 1 Malakir Rebirth
- Celes:49 1 Angelic Renewal
- Celes:64 1 Desecrated Tomb
- Gogo:22 1 Dispel
- Gogo:28 1 Censor
- Gogo:29 1 Mage's Guile
- Gogo:31 1 Blue Sun's Zenith
- Gogo:32 1 Capsize
- Gogo:43 1 Jeweled Amulet
- Gogo:79 1 Magosi, the Waterveil
- Kefka:27 1 Malakir Rebirth
- Kefka:41 1 Whispering Madness
- Kefka:51 1 Megrim
- Kefka:77 1 Emergence Zone
- Muldrotha:27 1 Scholar of the Lost Trove
- Muldrotha:74 1 Ice Tunnel
- Muldrotha:99 1 Zagoth Triome

## Celes — unsupported cards (UNSUPPORTED)

- Advanced Reconstruction
- Alesha, Who Laughs at Fate
- Alesha, Who Smiles at Death
- Ascend from Avernus
- Ash Barrens
- Banon, the Returners' Leader
- Battlefield Forge
- Blasphemous Act
- Blood Crypt
- Bojuka Bog
- Carnage, Crimson Chaos
- Cathar Commando
- Caves of Koilos
- Celes, Rune Knight
- Chainer, Nightmare Adept
- Chthonian Nightmare
- Clifftop Retreat
- Damn
- Defiled Crypt // Cadaver Lab
- Dragonskull Summit
- Emeritus of Truce // Swords to Plowshares
- Enduring Innocence
- Extraction Specialist
- Fable of the Mirror-Breaker // Reflection of Kiki-Jiki
- Fabled Passage
- Fear of Missing Out
- Fetid Heath
- Gau, Feral Youth
- General Leo Cristophe
- Geothermal Bog
- Godless Shrine
- Graven Cairns
- Haunted Ridge
- Isolated Chapel
- Karmic Guide
- Liliana, Dreadhorde General
- Lurrus of the Dream-Den
- Luxury Suite
- Magus of the Wheel
- Mog, Moogle Warrior
- Mother of Runes
- Naktamun Lorespinner // Wheel of Fortune
- Nomad Outpost
- On Wings of Gold
- Path of Ancestry
- Path to Exile
- Plaza of Heroes
- Priest of Fell Rites
- Quintorius, Field Historian
- Rejoin the Fight
- Rite of Oblivion
- Rogue's Passage
- Rugged Prairie
- Sacred Foundry
- Selfless Spirit
- Serra Paragon
- Sevinne's Reclamation
- Shattered Sanctum
- Skeleton Crew
- Skyclave Apparition
- Spectator Seating
- Squall, SeeD Mercenary
- Sulfurous Springs
- Summon: Knights of Round
- Sun Titan
- Sundown Pass
- Sunlit Marsh
- Talisman of Conviction
- Talisman of Hierarchy
- Talisman of Indulgence
- Tataru Taru
- Terra, Herald of Hope
- Tersa Lightshatter
- Timeline Culler
- Tormod, the Desecrator
- Vault of Champions

## Celes — needs-click cards (NEEDS-CLICK)

- Accursed Marauder
- Akroma's Will
- Arcane Signet
- Command Tower
- Evolving Wilds
- Exotic Orchard
- Relic of Legends
- Teval's Judgment

## Gogo — unsupported cards (UNSUPPORTED)

- An Offer You Can't Refuse
- Aphetto Alchemist
- Basalt Monolith
- Coveted Jewel
- Etherium Sculptor
- Everflowing Chalice
- Fabled Passage
- Fatestitcher
- Fierce Guardianship
- Flooded Strand
- Flusterstorm
- Forensic Gadgeteer
- Gitaxian Probe
- Gogo, Master of Mimicry
- High Tide
- Ioreth of the Healing House
- Ipnu Rivulet
- Kelpie Guide
- Liberator, Urza's Battlethopter
- Lonely Sandbar
- Lotus Field
- Mana Drain
- Mana Vault
- Manifold Key
- Marvin, Murderous Mimic
- Misdirection
- Misty Rainforest
- Mox Amber
- Mystic Remora
- Mystic Sanctuary
- Omen Hawker
- Otawara, Soaring City
- Pact of Negation
- Phyrexian Metamorph
- Polluted Delta
- Pongify
- Radiant Lotus
- Rapid Hybridization
- Remote Isle
- Reshape
- Rhystic Study
- Rings of Brighthearth
- Sapphire Medallion
- Scalding Tarn
- Sewer-veillance Cam
- Swan Song
- Teferi, Temporal Archmage
- Tezzeret the Seeker
- The Enigma Jewel // Locus of Enlightenment
- The Eternity Elevator
- The Millennium Calendar
- The One Ring
- Thought Vessel
- Thousand-Year Elixir
- Training Grounds
- Unstoppable Plan
- Unwinding Clock
- Urza's Saga
- Vhal, Candlekeep Researcher
- Vizier of Tumbling Sands
- Waxen Shapethief
- Whir of Invention

## Gogo — needs-click cards (NEEDS-CLICK)

- Arcane Signet
- Deserted Temple
- Displacer Kitten
- Fellwar Stone
- Forensic Researcher
- Gilded Lotus
- Lotus Petal
- Voltaic Key

## Kefka — unsupported cards (UNSUPPORTED)

- Animate Dead
- Arcane Denial
- Ardyn, the Usurper
- Arena of Glory
- Blackcleave Cliffs
- Blasphemous Act
- Blasphemous Edict
- Blood Crypt
- Bloodchief Ascension
- Cascade Bluffs
- Cool but Rude
- Corporeal Projection
- Daily Bugle Building
- Dark Deal
- Darkslick Shores
- Deflecting Swat
- Devastating Onslaught
- Dismember
- Dragon Mage
- Emet-Selch, Unsundered // Hades, Sorcerer of Eld
- Emperor of Bones
- Fable of the Mirror-Breaker // Reflection of Kiki-Jiki
- Fabled Passage
- Faithless Looting
- Fiery Islet
- Forbidden Orchard
- Frantic Search
- Geier Reach Sanitarium
- Gogo, Mysterious Mime
- Grave Researcher // Reanimate
- Graven Cairns
- Grixis Panorama
- Harmonic Prodigy
- Haunted Ridge
- Hide on the Ceiling
- Jace's Archivist
- Kefka, Court Mage // Kefka, Ruler of Ruin
- Kefka, Dancing Mad
- Kuja, Genome Sorcerer // Trance Kuja, Fate Defied
- Lavaspur Boots
- Lightning Greaves
- Liliana's Caress
- Luxury Suite
- Magus of the Wheel
- Mount Doom
- Necromancy
- Nightscape Familiar
- Niv-Mizzet, Parun
- Norman Osborn // Green Goblin
- Professional Face-Breaker
- Ragavan, Nimble Pilferer
- Raucous Theater
- Relic of Sauron
- Rousing Refrain
- Scrawling Crawler
- Seething Landscape
- Shivan Reef
- Sneak Attack
- Snort
- Spellseeker
- Stormcarved Coast
- Sulfurous Springs
- Tainted Isle
- Talisman of Creativity
- Talisman of Dominance
- Talisman of Indulgence
- Thassa, Deep-Dwelling
- The Clone Saga
- The Master, Multiplied
- The Warring Triad
- Toxic Deluge
- Training Center
- Underground River
- Vandalblast
- Vivi Ornitier
- Waste Not
- Watery Grave
- Wheel of Fate
- Wheel of Misfortune
- Windfall
- Xander's Lounge

## Kefka — needs-click cards (NEEDS-CLICK)

- Arcane Signet
- Command Tower
- Exotic Orchard
- Feed the Swarm
- Fellwar Stone
- Will of the Jeskai

## Muldrotha — unsupported cards (UNSUPPORTED)

- Aftermath Analyst
- Aminatou's Augury
- Baleful Strix
- Binding the Old Gods
- Blasphemous Edict
- Bloodstained Mire
- Breach the Multiverse
- Breeding Pool
- Chthonian Nightmare
- Consuming Aberration
- Culling Ritual
- Cultivate
- Doomsday Excruciator
- Emergent Ultimatum
- Eternal Witness
- Explore
- Fabled Passage
- Farseek
- Field of the Dead
- Flare of Cultivation
- Flooded Strand
- Foreboding Landscape
- Glacier Godmaw
- Glarb, Calamity's Augur
- Growth Spiral
- Hedron Crab
- Ice-Fang Coatl
- Icetill Explorer
- Kaya's Ghostform
- Kodama's Reach
- Last March of the Ents
- Long River's Pull
- Lotus Cobra
- Mana Vault
- Misty Rainforest
- Momentum Breaker
- Muldrotha, the Gravetide
- Mystic Sanctuary
- Nuclear Fallout
- Nurturing Peatland
- Overgrown Tomb
- Pernicious Deed
- Planar Genesis
- Polluted Delta
- Rimewood Falls
- Shifting Woodland
- Simic Growth Chamber
- Spelunking
- Springheart Nantuko
- Sunken Palace
- Swan Song
- Sylvan Safekeeper
- Tatyova, Benthic Druid
- The One Ring
- Tireless Provisioner
- Toxic Deluge
- Traveling Chocobo
- Ugin, the Spirit Dragon
- Undercity Sewers
- Underground Mortuary
- Undergrowth Stadium
- Uro, Titan of Nature's Wrath
- Verdant Catacombs
- Vexing Bauble
- Watery Grave
- Windswept Heath
- Wooded Foothills
- Woodland Chasm
- Yavimaya, Cradle of Growth

## Muldrotha — needs-click cards (NEEDS-CLICK)

- Accursed Marauder
- Aether Spellbomb
- Arcane Signet
- Command Tower
- Displacer Kitten
- Haywire Mite
- Lotus Petal
- Nature's Lore
- Rampant Growth
- Sakura-Tribe Elder
- Sheoldred's Edict
- Three Visits
