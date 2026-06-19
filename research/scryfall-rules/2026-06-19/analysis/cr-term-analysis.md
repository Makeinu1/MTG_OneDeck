# CR Term Analysis

Source: Magic: The Gathering Comprehensive Rules, effective 2026-04-17.

Dataset: 17491 cards from `game:paper date>=2021-06-19&unique=cards`.

## Concepts

| 用語 | 種別 | CR | 扱い | 件数 | 上位1000 | 上位3000 | 代表例 |
|---|---|---|---|---:|---:|---:|---|
| object/card/permanent/token/spell | game-concept |  | state-model | 10195 | 488 | 1576 | Path of Ancestry (#14)<br>Path to Exile (#15)<br>Counterspell (#16) |
| zones | game-concept |  | state-model | 6605 | 311 | 1020 | Reliquary Tower (#10)<br>Swords to Plowshares (#11)<br>Path of Ancestry (#14) |
| targets | game-concept |  | advisory | 6775 | 213 | 785 | Swords to Plowshares (#11)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13) |
| continuous effects/layers | effect-kind |  | advisory | 6230 | 179 | 748 | Reliquary Tower (#10)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13) |
| cost/payment | game-concept |  | warning-advisory | 2315 | 138 | 391 | Polluted Delta (#36)<br>Flooded Strand (#39)<br>Misty Rainforest (#40) |
| replacement/prevention effects | effect-kind |  | advisory | 910 | 48 | 155 | Jeska's Will (#102)<br>Gemstone Caverns (#179)<br>Hardened Scales (#188) |
| state-based actions | game-concept |  | advisory | 1030 | 35 | 147 | Solemn Simulacrum (#38)<br>Skullclamp (#41)<br>Blood Artist (#138) |
| priority/timing | game-concept |  | advisory | 972 | 20 | 93 | Swiftfoot Boots (#12)<br>Mana Drain (#115)<br>Black Market Connections (#132) |
| commander-specific | variant |  | semi-automatic | 290 | 18 | 55 | Command Tower (#2)<br>Arcane Signet (#3)<br>Path of Ancestry (#14) |
| activated/triggered/static abilities | ability-kind |  | state-model | 95 | 9 | 34 | Roaming Throne (#133)<br>Panharmonicon (#261)<br>Strionic Resonator (#572) |

## Keyword Actions

| 用語 | 種別 | CR | 扱い | 件数 | 上位1000 | 上位3000 | 代表例 |
|---|---|---|---|---:|---:|---:|---|
| Cast | keyword-action | 701.5 | semi-automatic | 3781 | 156 | 571 | Path of Ancestry (#14)<br>Blasphemous Act (#22)<br>Rhystic Study (#43) |
| Create | keyword-action | 701.7 | semi-automatic | 2965 | 84 | 422 | Beast Within (#24)<br>An Offer You Can't Refuse (#35)<br>Generous Gift (#58) |
| Sacrifice | keyword-action | 701.21 | semi-automatic | 2487 | 126 | 403 | Evolving Wilds (#18)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28) |
| Exile | keyword-action | 701.13 | semi-automatic | 2500 | 69 | 304 | Swords to Plowshares (#11)<br>Path to Exile (#15)<br>Bojuka Bog (#25) |
| Shuffle | keyword-action | 701.24 | primitive | 785 | 84 | 214 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20) |
| Search | keyword-action | 701.23 | semi-automatic | 675 | 82 | 199 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20) |
| Destroy | keyword-action | 701.8 | semi-automatic | 995 | 62 | 179 | Beast Within (#24)<br>Generous Gift (#58)<br>Boseiju, Who Endures (#78) |
| Discard | keyword-action | 701.9 | primitive | 999 | 39 | 140 | Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Faithless Looting (#94) |
| Activate | keyword-action | 701.2 | primitive | 943 | 43 | 131 | Temple of the False God (#74)<br>Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90) |
| Reveal | keyword-action | 701.20 | primitive | 712 | 35 | 118 | Cultivate (#20)<br>Kodama's Reach (#37)<br>Enlightened Tutor (#122) |
| Play | keyword-action | 701.18 | primitive | 386 | 24 | 76 | Jeska's Will (#102)<br>Mosswort Bridge (#191)<br>Professional Face-Breaker (#216) |
| Counter | keyword-action | 701.6 | semi-automatic | 225 | 20 | 50 | Counterspell (#16)<br>An Offer You Can't Refuse (#35)<br>Negate (#54) |
| Scry | keyword-action | 701.22 | primitive | 299 | 18 | 41 | Path of Ancestry (#14)<br>Opt (#213)<br>Preordain (#218) |
| Mill | keyword-action | 701.17 | primitive | 268 | 8 | 36 | Takenuma, Abandoned Mire (#244)<br>Ripples of Undeath (#542)<br>Six (#555) |
| Attach | keyword-action | 701.3 | semi-automatic | 322 | 9 | 34 | Swiftfoot Boots (#12)<br>Animate Dead (#224)<br>Mithril Coat (#240) |
| Proliferate | keyword-action | 701.34 | primitive | 82 | 7 | 31 | Karn's Bastion (#202)<br>Evolution Sage (#405)<br>Cankerbloom (#732) |
| Double | keyword-action | 701.10 | warning-advisory | 99 | 5 | 27 | Unnatural Growth (#454)<br>Mossborn Hydra (#827)<br>Solphim, Mayhem Dominus (#871) |
| Surveil | keyword-action | 701.25 | primitive | 200 | 11 | 19 | Consider (#382)<br>Undercity Sewers (#433)<br>Underground Mortuary (#472) |
| Transform | keyword-action | 701.27 | semi-automatic | 184 | 3 | 15 | Growing Rites of Itlimoc // Itlimoc, Cradle of the Sun (#557)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Ojer Taq, Deepest Foundation // Temple of Civilization (#828) |
| Regenerate | keyword-action | 701.19 | warning-advisory | 49 | 0 | 11 | Swarmyard (#1022)<br>Nightscape Familiar (#1152)<br>Asceticism (#1294) |
| The Ring Tempts You | keyword-action | 701.54 | advisory | 54 | 1 | 7 | Boromir, Warden of the Tower (#817)<br>Fiery Inscription (#1113)<br>Call of the Ring (#1395) |
| Goad | keyword-action | 701.15 | semi-automatic | 57 | 1 | 7 | Disrupt Decorum (#887)<br>Grenzo, Havoc Raiser (#1627)<br>Vengeful Ancestor (#2028) |
| Discover | keyword-action | 701.57 | semi-automatic | 30 | 1 | 6 | Chimil, the Inner Sun (#804)<br>Brass's Tunnel-Grinder // Tecutlan, the Searing Rift (#1509)<br>Trumpeting Carnosaur (#1618) |
| Amass | keyword-action | 701.47 | advisory | 44 | 1 | 5 | Orcish Bowmasters (#254)<br>Dreadhorde Invasion (#1448)<br>Barad-dûr (#1814) |
| Exchange | keyword-action | 701.12 | semi-automatic | 19 | 0 | 4 | Volatile Stormdrake (#1911)<br>Oko, Thief of Crowns (#1979)<br>Tree of Perdition (#1994) |
| Investigate | keyword-action | 701.16 | primitive | 121 | 1 | 3 | Tireless Tracker (#622)<br>Forensic Gadgeteer (#1373)<br>Tamiyo's Journal (#2496) |
| Earthbend | keyword-action | 701.66 | advisory | 37 | 0 | 3 | Badgermole Cub (#1555)<br>Ba Sing Se (#1970)<br>Earthbender Ascension (#2553) |
| Adapt | keyword-action | 701.46 | advisory | 22 | 2 | 3 | Incubation Druid (#649)<br>Evolution Witness (#905)<br>Basking Broodscale (#2077) |
| Populate | keyword-action | 701.36 | semi-automatic | 15 | 0 | 2 | Rootborn Defenses (#1311)<br>Sundering Growth (#2609) |
| Exert | keyword-action | 701.43 | advisory | 15 | 1 | 2 | Arena of Glory (#384)<br>Combat Celebrant (#1008) |
| Airbend | keyword-action | 701.65 | advisory | 14 | 0 | 2 | Avatar's Wrath (#1980)<br>Airbender Ascension (#2878) |
| Triple | keyword-action | 701.11 | warning-advisory | 5 | 2 | 2 | City on Fire (#825)<br>Fiery Emancipation (#854) |
| Manifest | keyword-action | 701.40 | semi-automatic | 43 | 0 | 1 | Kozilek, the Broken Reality (#2395) |
| Blight | keyword-action | 701.68 | advisory | 28 | 0 | 1 | Rottenmouth Viper (#2822) |
| Vote | keyword-action | 701.38 | advisory | 22 | 0 | 1 | Expropriate (#2474) |
| Monstrosity | keyword-action | 701.37 | advisory | 16 | 0 | 1 | Giggling Skitterspike (#2265) |
| Support | keyword-action | 701.41 | semi-automatic | 12 | 0 | 1 | Together Forever (#2434) |
| Forage | keyword-action | 701.61 | advisory | 8 | 0 | 1 | Camellia, the Seedmiser (#2559) |
| Meld | keyword-action | 701.42 | advisory | 7 | 0 | 1 | Gisela, the Broken Blade (#2570) |
| Harness | keyword-action | 701.64 | advisory | 2 | 0 | 1 | The Soul Stone (#1229) |
| Venture into the Dungeon | keyword-action | 701.49 | semi-automatic | 38 | 0 | 0 |  |
| Incubate | keyword-action | 701.53 | advisory | 32 | 0 | 0 |  |
| Manifest Dread | keyword-action | 701.62 | advisory | 30 | 0 | 0 |  |
| Waterbend | keyword-action | 701.67 | advisory | 29 | 0 | 0 |  |
| Collect Evidence | keyword-action | 701.59 | semi-automatic | 24 | 0 | 0 |  |
| Fight | keyword-action | 701.14 | semi-automatic | 22 | 0 | 0 |  |
| Open an Attraction | keyword-action | 701.51 | semi-automatic | 45 | 0 | 0 |  |
| Suspect | keyword-action | 701.60 | semi-automatic | 20 | 0 | 0 |  |
| Behold | keyword-action | 701.4 | semi-automatic | 20 | 0 | 0 |  |
| Convert | keyword-action | 701.28 | advisory | 15 | 0 | 0 |  |
| Cloak | keyword-action | 701.58 | semi-automatic | 11 | 0 | 0 |  |
| Time Travel | keyword-action | 701.56 | advisory | 9 | 0 | 0 |  |
| Planeswalk | keyword-action | 701.31 | advisory | 8 | 0 | 0 |  |
| Connive | keyword-action | 701.50 | semi-automatic | 7 | 0 | 0 |  |
| Explore | keyword-action | 701.44 | semi-automatic | 5 | 0 | 0 |  |
| Bolster | keyword-action | 701.39 | warning-advisory | 6 | 0 | 0 |  |
| Detain | keyword-action | 701.35 | advisory | 5 | 0 | 0 |  |
| Clash | keyword-action | 701.30 | advisory | 4 | 0 | 0 |  |
| Learn | keyword-action | 701.48 | semi-automatic | 3 | 0 | 0 |  |
| Roll to Visit Your Attractions | keyword-action | 701.52 | semi-automatic | 3 | 0 | 0 |  |
| Fateseal | keyword-action | 701.29 | warning-advisory | 2 | 0 | 0 |  |
| Face a Villainous Choice | keyword-action | 701.55 | advisory | 1 | 0 | 0 |  |
| Abandon | keyword-action | 701.33 | advisory | 1 | 0 | 0 |  |

## Keyword Abilities

| 用語 | 種別 | CR | 扱い | 件数 | 上位1000 | 上位3000 | 代表例 |
|---|---|---|---|---:|---:|---:|---|
| Flying | keyword-ability | 702.9 | warning | 1844 | 30 | 211 | Birds of Paradise (#33)<br>Ornithopter of Paradise (#221)<br>Mirkwood Bats (#223) |
| Trample | keyword-ability | 702.19 | warning | 616 | 6 | 77 | Rampaging Baloths (#364)<br>Ghalta, Primal Hunger (#474)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761) |
| Equip | keyword-ability | 702.6 | semi-automatic | 411 | 22 | 75 | Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Skullclamp (#41) |
| Enchant | keyword-ability | 702.5 | semi-automatic | 458 | 14 | 49 | Wild Growth (#211)<br>Animate Dead (#224)<br>Utopia Sprawl (#341) |
| Flash | keyword-ability | 702.8 | warning | 423 | 12 | 46 | Mithril Coat (#240)<br>Orcish Bowmasters (#254)<br>Hullbreaker Horror (#267) |
| Vigilance | keyword-ability | 702.20 | warning | 508 | 12 | 45 | Sun Titan (#289)<br>Loran of the Third Path (#352)<br>Enduring Vitality (#494) |
| Cycling | keyword-ability | 702.29 | semi-automatic | 224 | 18 | 43 | Ash Barrens (#192)<br>Jetmir's Garden (#353)<br>Ketria Triome (#355) |
| Lifelink | keyword-ability | 702.15 | warning | 283 | 4 | 41 | Mangara, the Diplomat (#626)<br>Danitha Capashen, Paragon (#788)<br>Enduring Innocence (#803) |
| Indestructible | keyword-ability | 702.12 | warning | 81 | 9 | 38 | The One Ring (#89)<br>Mithril Coat (#240)<br>Darksteel Citadel (#283) |
| Haste | keyword-ability | 702.10 | warning | 399 | 6 | 36 | Craterhoof Behemoth (#328)<br>Anger (#351)<br>Goldspan Dragon (#401) |
| Deathtouch | keyword-ability | 702.2 | warning | 251 | 5 | 31 | Baleful Strix (#356)<br>Sheoldred, the Apocalypse (#464)<br>Elas il-Kor, Sadistic Pilgrim (#595) |
| Reach | keyword-ability | 702.17 | warning | 298 | 4 | 29 | Six (#555)<br>Ancient Greenwarden (#670)<br>Kodama of the West Tree (#820) |
| First Strike | keyword-ability | 702.7 | warning | 194 | 2 | 25 | Knight of the White Orchid (#619)<br>Danitha Capashen, Paragon (#788)<br>Combustible Gearhulk (#1006) |
| Ward | keyword-ability | 702.21 | warning | 182 | 3 | 20 | Roaming Throne (#133)<br>Hexing Squelcher (#903)<br>Kappa Cannoneer (#969) |
| Menace | keyword-ability | 702.111 | warning | 316 | 2 | 19 | Professional Face-Breaker (#216)<br>Noxious Gearhulk (#961)<br>Junji, the Midnight Sky (#1212) |
| Flashback | keyword-ability | 702.34 | warning-advisory | 137 | 3 | 17 | Faithless Looting (#94)<br>Sevinne's Reclamation (#337)<br>Dread Return (#521) |
| Defender | keyword-ability | 702.3 | warning | 115 | 1 | 16 | Crashing Drawbridge (#988)<br>Wall of Omens (#1080)<br>Electrostatic Field (#1495) |
| Crew | keyword-ability | 702.122 | semi-automatic | 158 | 0 | 10 | Hedge Shredder (#1310)<br>Smuggler's Copter (#1862)<br>Imposter Mech (#2163) |
| Changeling | keyword-ability | 702.73 | advisory | 50 | 4 | 10 | Realmwalker (#603)<br>Changeling Outcast (#635)<br>Taurean Mauler (#931) |
| Kicker | keyword-ability | 702.33 | warning-advisory | 109 | 2 | 9 | Tear Asunder (#877)<br>Rite of Replication (#924)<br>Maddening Cacophony (#1641) |
| Overload | keyword-ability | 702.96 | warning-advisory | 17 | 4 | 9 | Cyclonic Rift (#51)<br>Vandalblast (#101)<br>Damn (#336) |
| Double Strike | keyword-ability | 702.4 | warning | 82 | 0 | 8 | Lizard Blades (#1338)<br>Zetalpa, Primal Dawn (#1640)<br>Bronze Guardian (#1901) |
| Convoke | keyword-ability | 702.51 | warning-advisory | 79 | 3 | 8 | Chord of Calling (#532)<br>Clever Concealment (#621)<br>City on Fire (#825) |
| Gift | keyword-ability | 702.174 | advisory | 24 | 2 | 8 | Dawn's Truce (#368)<br>Into the Flood Maw (#751)<br>Long River's Pull (#1478) |
| Spree | keyword-ability | 702.172 | warning-advisory | 21 | 1 | 8 | Return the Favor (#658)<br>Three Steps Ahead (#1103)<br>Great Train Heist (#1111) |
| Devoid | keyword-ability | 702.114 | advisory | 55 | 0 | 7 | Basking Broodscale (#2077)<br>Sowing Mycospawn (#2084)<br>Slip Through Space (#2237) |
| Protection | keyword-ability | 702.16 | warning | 58 | 2 | 7 | Yawgmoth, Thran Physician (#816)<br>Karmic Guide (#939)<br>Stonecoil Serpent (#1511) |
| Station | keyword-ability | 702.184 | semi-automatic | 31 | 0 | 7 | Evendo, Waking Haven (#1180)<br>Uthros, Titanic Godcore (#1628)<br>Exploration Broodship (#1817) |
| Ninjutsu | keyword-ability | 702.49 | semi-automatic | 28 | 0 | 7 | Nashi, Moon Sage's Scion (#1913)<br>Fallen Shinobi (#1995)<br>Prosperous Thief (#2438) |
| Evoke | keyword-ability | 702.74 | warning-advisory | 22 | 1 | 7 | Mulldrifter (#573)<br>Endurance (#1360)<br>Shriekmaw (#1526) |
| Storm | keyword-ability | 702.40 | advisory | 20 | 3 | 7 | Flusterstorm (#310)<br>Grapeshot (#712)<br>Brain Freeze (#790) |
| Ascend | keyword-ability | 702.131 | advisory | 12 | 1 | 7 | Wayward Swordtooth (#966)<br>Twilight Prophet (#1074)<br>Ocelot Pride (#1118) |
| Partner | keyword-ability | 702.124 | advisory | 86 | 1 | 6 | Kodama of the East Tree (#952)<br>Sakashima of a Thousand Faces (#1083)<br>Kediss, Emberclaw Familiar (#1155) |
| Prowess | keyword-ability | 702.108 | trigger-assist | 57 | 3 | 6 | Pinnacle Monk // Mystic Peak (#533)<br>Harmonic Prodigy (#679)<br>Stormcatch Mentor (#977) |
| Toxic | keyword-ability | 702.164 | advisory | 37 | 0 | 6 | Skrelv, Defector Mite (#1132)<br>Myr Convert (#2410)<br>Bloated Contaminator (#2592) |
| Warp | keyword-ability | 702.185 | warning-advisory | 32 | 0 | 6 | Exalted Sunborn (#1654)<br>Weftstalker Ardent (#1734)<br>Haliya, Guided by Light (#1829) |
| Annihilator | keyword-ability | 702.86 | advisory | 12 | 0 | 6 | Kozilek, Butcher of Truth (#1099)<br>Artisan of Kozilek (#1134)<br>Ulamog, the Infinite Gyre (#1326) |
| Hexproof | keyword-ability | 702.11 | warning | 51 | 1 | 5 | Lotus Field (#925)<br>Valgavoth's Lair (#1691)<br>Volatile Stormdrake (#1911) |
| Affinity | keyword-ability | 702.41 | warning-advisory | 51 | 3 | 4 | Emry, Lurker of the Loch (#611)<br>Thought Monitor (#769)<br>Thoughtcast (#941) |
| Cascade | keyword-ability | 702.85 | advisory | 26 | 0 | 4 | Apex Devastator (#1049)<br>Maelstrom Wanderer (#1633)<br>Call Forth the Tempest (#1894) |
| Offspring | keyword-ability | 702.175 | advisory | 20 | 1 | 4 | Coruscation Mage (#805)<br>Agate Instigator (#1175)<br>Starscape Cleric (#2055) |
| Hideaway | keyword-ability | 702.75 | advisory | 15 | 3 | 4 | Mosswort Bridge (#191)<br>Windbrisk Heights (#650)<br>Spinerock Knoll (#749) |
| Evolve | keyword-ability | 702.100 | advisory | 13 | 1 | 4 | Gyre Sage (#824)<br>Pollywog Prodigy (#1093)<br>Fathom Mage (#1713) |
| Split Second | keyword-ability | 702.61 | advisory | 9 | 1 | 4 | Krosan Grip (#606)<br>Legolas's Quick Reflexes (#1523)<br>Angel's Grace (#2053) |
| Unearth | keyword-ability | 702.84 | semi-automatic | 41 | 0 | 3 | Molten Gatekeeper (#1225)<br>Cityscape Leveler (#2166)<br>Priest of Fell Rites (#2663) |
| Plot | keyword-ability | 702.170 | semi-automatic | 39 | 0 | 3 | Aven Interrupter (#1838)<br>Railway Brawler (#2382)<br>Outcaster Trailblazer (#2941) |
| Landwalk | keyword-ability | 702.14 | advisory | 28 | 2 | 3 | Sheoldred, Whispering One (#694)<br>Chatterfang, Squirrel General (#987)<br>Cold-Eyed Selkie (#1961) |
| Suspend | keyword-ability | 702.62 | warning-advisory | 27 | 0 | 3 | Search for Tomorrow (#1676)<br>Rousing Refrain (#2762)<br>Ancestral Vision (#2971) |
| Foretell | keyword-ability | 702.143 | warning-advisory | 21 | 0 | 3 | Delayed Blast Fireball (#1352)<br>Ravenform (#1832)<br>Saw It Coming (#2889) |
| Infect | keyword-ability | 702.90 | advisory | 19 | 0 | 3 | Blightsteel Colossus (#1043)<br>Plague Myr (#2095)<br>Skithiryx, the Blight Dragon (#2689) |
| Rebound | keyword-ability | 702.88 | advisory | 18 | 1 | 3 | Ephemerate (#443)<br>Quantum Misalignment (#1956)<br>Transpose (#2979) |
| Reconfigure | keyword-ability | 702.151 | semi-automatic | 17 | 0 | 3 | The Reality Chip (#1017)<br>Lizard Blades (#1338)<br>Lion Sash (#1680) |
| Miracle | keyword-ability | 702.94 | advisory | 12 | 0 | 3 | Reforge the Soul (#1708)<br>Temporal Mastery (#2591)<br>Metamorphosis Fanatic (#2997) |
| Delve | keyword-ability | 702.66 | warning-advisory | 11 | 2 | 3 | Dig Through Time (#614)<br>Treasure Cruise (#615)<br>Temporal Trespass (#2970) |
| Living Weapon | keyword-ability | 702.92 | advisory | 11 | 0 | 3 | Nettlecyst (#1023)<br>Kaldra Compleat (#1679)<br>Bitterthorn, Nissa's Animus (#2090) |
| Improvise | keyword-ability | 702.126 | warning-advisory | 11 | 1 | 3 | Kappa Cannoneer (#969)<br>Whir of Invention (#1308)<br>Organic Extinction (#1315) |
| Dredge | keyword-ability | 702.52 | advisory | 9 | 1 | 3 | Life from the Loam (#680)<br>Dakmor Salvage (#1283)<br>Golgari Grave-Troll (#2594) |
| Persist | keyword-ability | 702.79 | advisory | 9 | 0 | 3 | Glen Elendra Archmage (#1620)<br>Puppeteer Clique (#2539)<br>Persistent Constrictor (#2750) |
| Umbra Armor | keyword-ability | 702.89 | advisory | 5 | 1 | 3 | Bear Umbra (#878)<br>Snake Umbra (#1474)<br>Hyena Umbra (#2573) |
| Impending | keyword-ability | 702.176 | advisory | 5 | 0 | 3 | Overlord of the Hauntwoods (#1799)<br>Overlord of the Balemurk (#2279)<br>Overlord of the Floodpits (#2973) |
| Start Your Engines! | keyword-ability | 702.179 | advisory | 40 | 0 | 2 | Muraganda Raceway (#1578)<br>Amonkhet Raceway (#2572) |
| Max Speed | keyword-ability | 702.178 | advisory | 34 | 0 | 2 | Muraganda Raceway (#1578)<br>Amonkhet Raceway (#2572) |
| Madness | keyword-ability | 702.35 | warning-advisory | 27 | 0 | 2 | Emrakul, the World Anew (#2384)<br>Necrogoyf (#2924) |
| Myriad | keyword-ability | 702.116 | advisory | 21 | 0 | 2 | Battle Angels of Tyr (#1743)<br>Goldlust Triad (#2194) |
| Encore | keyword-ability | 702.141 | advisory | 16 | 0 | 2 | Impulsive Pilferer (#1711)<br>Phyrexian Triniform (#2934) |
| Escape | keyword-ability | 702.138 | advisory | 16 | 0 | 2 | Uro, Titan of Nature's Wrath (#1451)<br>Woe Strider (#1671) |
| Mentor | keyword-ability | 702.134 | advisory | 16 | 0 | 2 | Legion Warboss (#1780)<br>Danny Pink (#2768) |
| Extort | keyword-ability | 702.101 | advisory | 13 | 2 | 2 | Blind Obedience (#481)<br>Crypt Ghast (#525) |
| Solved | keyword-ability | 702.169 | advisory | 13 | 0 | 2 | Case of the Locked Hothouse (#1358)<br>Case of the Ransacked Lab (#2561) |
| Exalted | keyword-ability | 702.83 | advisory | 10 | 2 | 2 | Ignoble Hierarch (#529)<br>Noble Hierarch (#783) |
| Intimidate | keyword-ability | 702.13 | advisory | 8 | 0 | 2 | Mikaeus, the Unhallowed (#1264)<br>Sepulchral Primordial (#2185) |
| Shadow | keyword-ability | 702.28 | advisory | 8 | 1 | 2 | Dauthi Voidwalker (#378)<br>Nether Traitor (#2526) |
| Transmute | keyword-ability | 702.53 | advisory | 6 | 1 | 2 | Muddle the Mixture (#665)<br>Drift of Phantasms (#2921) |
| Fabricate | keyword-ability | 702.123 | advisory | 5 | 1 | 2 | Marionette Apprentice (#556)<br>Marionette Master (#1434) |
| Outlast | keyword-ability | 702.107 | advisory | 6 | 0 | 2 | Abzan Falconer (#1391)<br>Envoy of the Ancestors (#2471) |
| Eternalize | keyword-ability | 702.129 | advisory | 4 | 1 | 2 | Fanatic of Rhonas (#428)<br>Timeless Witness (#1252) |
| Dethrone | keyword-ability | 702.105 | advisory | 4 | 0 | 2 | Scourge of the Throne (#1280)<br>Treasonous Ogre (#2314) |
| Morph | keyword-ability | 702.37 | advisory | 29 | 0 | 1 | Grim Haruspex (#1101) |
| Bargain | keyword-ability | 702.166 | advisory | 20 | 1 | 1 | Beseech the Mirror (#894) |
| Job Select | keyword-ability | 702.182 | trigger-assist | 19 | 0 | 1 | Black Mage's Rod (#2831) |
| Blitz | keyword-ability | 702.152 | advisory | 17 | 0 | 1 | Jaxis, the Troublemaker (#1685) |
| Mayhem | keyword-ability | 702.187 | warning-advisory | 16 | 0 | 1 | Chameleon, Master of Disguise (#2541) |
| Bestow | keyword-ability | 702.103 | advisory | 14 | 1 | 1 | Springheart Nantuko (#683) |
| Undying | keyword-ability | 702.93 | advisory | 15 | 0 | 1 | Gleeful Arsonist (#2718) |
| Mobilize | keyword-ability | 702.181 | trigger-assist | 13 | 1 | 1 | Voice of Victory (#586) |
| Exploit | keyword-ability | 702.110 | advisory | 14 | 0 | 1 | Sidisi, Undead Vizier (#2681) |
| Ravenous | keyword-ability | 702.156 | advisory | 12 | 0 | 1 | Jacked Rabbit (#2114) |
| Echo | keyword-ability | 702.30 | advisory | 13 | 1 | 1 | Karmic Guide (#939) |
| Freerunning | keyword-ability | 702.173 | warning-advisory | 12 | 0 | 1 | Overpowering Attack (#1840) |
| Cleave | keyword-ability | 702.148 | advisory | 12 | 0 | 1 | Wash Away (#2866) |
| Harmonize | keyword-ability | 702.180 | warning-advisory | 11 | 0 | 1 | Nature's Rhythm (#1051) |
| Soulbond | keyword-ability | 702.95 | advisory | 11 | 0 | 1 | Deadeye Navigator (#1454) |
| Companion | keyword-ability | 702.139 | advisory | 10 | 0 | 1 | Lurrus of the Dream-Den (#2704) |
| Aftermath | keyword-ability | 702.127 | advisory | 10 | 1 | 1 | Dusk // Dawn (#920) |
| Buyback | keyword-ability | 702.27 | warning-advisory | 10 | 0 | 1 | Constant Mists (#2375) |
| Battle Cry | keyword-ability | 702.91 | advisory | 10 | 0 | 1 | Hero of Bladehold (#1953) |
| Fear | keyword-ability | 702.36 | advisory | 9 | 0 | 1 | Shriekmaw (#1526) |
| Devour | keyword-ability | 702.82 | advisory | 8 | 0 | 1 | Mycoloth (#2105) |
| Vanishing | keyword-ability | 702.63 | advisory | 8 | 0 | 1 | Dreamtide Whale (#1172) |
| Entwine | keyword-ability | 702.42 | advisory | 8 | 0 | 1 | Tooth and Nail (#2788) |
