# M5 EDH Priority Analysis

目的: MTG_OneDeck のM5ルール補助に、公式CR用語分類、Scryfall keywords分類、Oracle text補助検出、EDH利用頻度、A-Eリスクを反映する。

## Source

- Scryfall snapshot: `game:paper date>=2021-06-19&unique=cards`
- Cards: 17,491
- Rules source: Magic Comprehensive Rules, effective 2026-04-17
- Priority: Scryfall `edhrec_rank`。低いrankほど重い。
- Current deck: このシェルからブラウザ localStorage の `mtg-onedeck:deck-cards` は読めないため、この実行では未適用。ユーザー指定どおりEDH頻度を優先する。

## Method

1. `docs/mtg-rule-terms.md` の分類に沿って、CR概念、CR 701キーワード処理、CR 702キーワード能力を正規タグ化した。
2. Scryfall `keywords` を `keyword-ability` / `keyword-action` / `ability-word` / `resource-token` に分離した。
3. Oracle text からETB、死亡誘発、唱えた時誘発、対象依存、置換/継続効果、マナ能力、ドロー、トークン、カウンター等を補助検出した。
4. `edhrec_rank` で重み付けした。deck weight は未適用。
5. A-Eリスクを付け、M5実装候補を並べた。

Score:

```text
top100 * 1000
+ top101-500 * 250
+ top501-1000 * 100
+ top1001-3000 * 20
+ top3001-10000 * 2
+ sum(1000 / (edhrec_rank + 999))
```

Risk は実装方法を決めるための値で、EDH順位の並び替えには使っていない。

## EDH優先タグ Top 25

| 順位 | タグ | Risk | Layer | Top1000 | Top3000 | Score | 代表例 |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | Mana / mana abilities | A | primitive | 382 | 762 | 117,440.704 | Sol Ring (#1)<br>Command Tower (#2)<br>Arcane Signet (#3)<br>Exotic Orchard (#9)<br>Reliquary Tower (#10)<br>Path of Ancestry (#14)<br>Fellwar Stone (#17)<br>Rogue's Passage (#19) |
| 2 | Zone movement / zone references | B | semi-automatic | 311 | 1,020 | 102,555.955 | Reliquary Tower (#10)<br>Swords to Plowshares (#11)<br>Path of Ancestry (#14)<br>Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Thought Vessel (#21)<br>Blasphemous Act (#22) |
| 3 | Target-dependent text | E | advisory | 213 | 785 | 67,416.138 | Swords to Plowshares (#11)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Path to Exile (#15)<br>Counterspell (#16)<br>Rogue's Passage (#19)<br>Beast Within (#24)<br>Bojuka Bog (#25) |
| 4 | Cost / payment modifiers | D | warning | 132 | 349 | 50,127.398 | Blasphemous Act (#22)<br>Polluted Delta (#36)<br>Flooded Strand (#39)<br>Misty Rainforest (#40)<br>Bloodstained Mire (#42)<br>Windswept Heath (#45)<br>Verdant Catacombs (#47)<br>Wooded Foothills (#48) |
| 5 | CR 701 Cast | B | semi-automatic | 156 | 571 | 45,350.727 | Path of Ancestry (#14)<br>Blasphemous Act (#22)<br>Rhystic Study (#43)<br>Cyclonic Rift (#51)<br>Toxic Deluge (#67)<br>Esper Sentinel (#76)<br>Deflecting Swat (#79)<br>Fierce Guardianship (#80) |
| 6 | CR 701 Sacrifice | B | semi-automatic | 126 | 402 | 44,418.319 | Evolving Wilds (#18)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Mind Stone (#32)<br>An Offer You Can't Refuse (#35)<br>Polluted Delta (#36)<br>Flooded Strand (#39)<br>Misty Rainforest (#40) |
| 7 | Draw cards | A | primitive | 143 | 448 | 42,391.599 | Mind Stone (#32)<br>Solemn Simulacrum (#38)<br>Skullclamp (#41)<br>Rhystic Study (#43)<br>Commander's Sphere (#46)<br>Arcane Denial (#56)<br>Brainstorm (#71)<br>Esper Sentinel (#76) |
| 8 | CR 701 Shuffle | A | primitive | 87 | 226 | 39,118.45 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Farseek (#23)<br>Rampant Growth (#26)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Nature's Lore (#29) |
| 9 | Continuous effects / layers | E | advisory | 149 | 488 | 37,906.796 | Reliquary Tower (#10)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Rogue's Passage (#19)<br>Thought Vessel (#21)<br>Skullclamp (#41)<br>Chromatic Lantern (#81)<br>Garruk's Uprising (#92) |
| 10 | CR 701 Search | B | semi-automatic | 82 | 199 | 36,957.641 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Farseek (#23)<br>Rampant Growth (#26)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Nature's Lore (#29) |
| 11 | ETB / enters trigger | C | trigger-assist | 149 | 471 | 36,079.95 | Bojuka Bog (#25)<br>Solemn Simulacrum (#38)<br>The One Ring (#89)<br>Garruk's Uprising (#92)<br>Eternal Witness (#109)<br>Chrome Mox (#143)<br>Mystic Sanctuary (#172)<br>Tireless Provisioner (#180) |
| 12 | Replacement / prevention effects | E | advisory | 98 | 257 | 29,461.642 | Watery Grave (#52)<br>Godless Shrine (#61)<br>Breeding Pool (#63)<br>Hallowed Fountain (#65)<br>Steam Vents (#66)<br>Stomping Ground (#68)<br>Blood Crypt (#69)<br>Overgrown Tomb (#70) |
| 13 | CR 701 Create | B | semi-automatic | 88 | 432 | 27,848.817 | Beast Within (#24)<br>An Offer You Can't Refuse (#35)<br>Generous Gift (#58)<br>Smothering Tithe (#62)<br>Swan Song (#73)<br>Urza's Saga (#121)<br>Deadly Dispute (#128)<br>Black Market Connections (#132) |
| 14 | Create token | B | semi-automatic | 88 | 431 | 27,823.915 | Beast Within (#24)<br>An Offer You Can't Refuse (#35)<br>Generous Gift (#58)<br>Smothering Tithe (#62)<br>Swan Song (#73)<br>Urza's Saga (#121)<br>Deadly Dispute (#128)<br>Black Market Connections (#132) |
| 15 | CR 701 Exile | B | semi-automatic | 69 | 304 | 21,553.078 | Swords to Plowshares (#11)<br>Path to Exile (#15)<br>Bojuka Bog (#25)<br>Faithless Looting (#94)<br>Jeska's Will (#102)<br>Teferi's Protection (#105)<br>Deadly Rollick (#112)<br>Chrome Mox (#143) |
| 16 | CR 701 Destroy | B | semi-automatic | 62 | 183 | 17,267.719 | Beast Within (#24)<br>Generous Gift (#58)<br>Boseiju, Who Endures (#78)<br>Feed the Swarm (#88)<br>Vandalblast (#101)<br>Assassin's Trophy (#124)<br>Abrade (#149)<br>Pongify (#156) |
| 17 | Upkeep / end step trigger | C | trigger-assist | 40 | 249 | 15,429.699 | Arcane Denial (#56)<br>The One Ring (#89)<br>Mystic Remora (#96)<br>Phyrexian Arena (#98)<br>Herald's Horn (#141)<br>Mana Vault (#144)<br>Sylvan Library (#256)<br>Ragavan, Nimble Pilferer (#269) |
| 18 | Card counters | B | semi-automatic | 53 | 270 | 14,562.849 | Mystic Remora (#96)<br>Gemstone Caverns (#179)<br>Doubling Season (#198)<br>The Great Henge (#235)<br>Everflowing Chalice (#251)<br>Inspiring Call (#272)<br>Avenger of Zendikar (#274)<br>The Ozolith (#302) |
| 19 | CR 701 Discard | A | primitive | 45 | 168 | 12,972.888 | Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Faithless Looting (#94)<br>Frantic Search (#104)<br>Windfall (#152)<br>Big Score (#160)<br>Ash Barrens (#192)<br>Thrill of Possibility (#203) |
| 20 | CR 701 Activate | A | primitive | 44 | 149 | 12,113.843 | Temple of the False God (#74)<br>Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Idol of Oblivion (#197)<br>Secluded Courtyard (#227)<br>Mox Opal (#238)<br>Takenuma, Abandoned Mire (#244)<br>Grand Abolisher (#250) |
| 21 | CR 701 Reveal | A | primitive | 37 | 122 | 11,440.574 | Cultivate (#20)<br>Chaos Warp (#30)<br>Kodama's Reach (#37)<br>Enlightened Tutor (#122)<br>Herald's Horn (#141)<br>Mystical Tutor (#147)<br>Worldly Tutor (#165)<br>Ash Barrens (#192) |
| 22 | Dies / leaves battlefield trigger | C | trigger-assist | 36 | 159 | 10,264.294 | Solemn Simulacrum (#38)<br>Skullclamp (#41)<br>Blood Artist (#138)<br>Animate Dead (#224)<br>Pitiless Plunderer (#229)<br>Zulaport Cutthroat (#233)<br>Syr Konrad, the Grim (#252)<br>Morbid Opportunist (#257) |
| 23 | keyword-ability: Flying | E | advisory | 30 | 211 | 9,872.949 | Birds of Paradise (#33)<br>Ornithopter of Paradise (#221)<br>Mirkwood Bats (#223)<br>Faerie Mastermind (#327)<br>Baleful Strix (#356)<br>Goldspan Dragon (#401)<br>Welcoming Vampire (#429)<br>Terror of the Peaks (#513) |
| 24 | Cast / copy trigger | C | trigger-assist | 33 | 167 | 9,336.164 | Path of Ancestry (#14)<br>Storm-Kiln Artist (#209)<br>Beast Whisperer (#212)<br>Archmage Emeritus (#258)<br>Hullbreaker Horror (#267)<br>Flusterstorm (#310)<br>Vanquisher's Banner (#354)<br>Aetherflux Reservoir (#374) |
| 25 | Return from graveyard / exile | B | semi-automatic | 25 | 162 | 8,518.275 | Faithless Looting (#94)<br>Eternal Witness (#109)<br>Buried Ruin (#200)<br>Takenuma, Abandoned Mire (#244)<br>Sun Titan (#289)<br>Bala Ged Recovery // Bala Ged Sanctuary (#318)<br>Sevinne's Reclamation (#337)<br>Underworld Breach (#388) |

## M5実装候補キュー

| 優先 | 候補 | Risk | Layer | Top1000 | Top3000 | 実装方針 |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 1 | ETB / enters trigger | C | trigger-assist | 149 | 471 | battlefield entry後に誘発候補として表示し、ユーザー選択でstackへ積む。 |
| 2 | Mana / mana abilities | A | primitive | 382 | 762 | 既存の tapForMana/addMana 候補。EDHで最頻出のため分類レポートへ必ず出す。 |
| 3 | CR 701 Cast | B | semi-automatic | 156 | 571 | 通常キャスト/ゾーン外キャスト/代替コストに分けて候補化。 |
| 4 | Draw cards | A | primitive | 143 | 448 | 既存drawコマンド候補。枚数が曖昧ならユーザー入力。 |
| 5 | Create token | B | semi-automatic | 88 | 431 | トークン生成ダイアログのプリセット候補。数/色/P/T/タップ状態はユーザー確定。 |
| 6 | CR 701 Create | B | semi-automatic | 88 | 432 | トークン作成候補。内容はユーザー確定。 |
| 7 | CR 701 Sacrifice | B | semi-automatic | 126 | 402 | 生け贄対象選択後に一括処理。 |
| 8 | CR 701 Exile | B | semi-automatic | 69 | 304 | 追放候補。戻る期限/追放元は警告。 |
| 9 | Card counters | B | semi-automatic | 53 | 270 | +1/+1等のカウンター追加/削除候補。打ち消しとは分離。 |
| 10 | CR 701 Shuffle | A | primitive | 87 | 226 | ライブラリーシャッフル候補。 |
| 11 | CR 701 Search | B | semi-automatic | 82 | 199 | 検索フィルタ/公開/移動先をユーザー確定。 |
| 12 | Cast / copy trigger | C | trigger-assist | 33 | 167 | castToStack/copy作成後に誘発候補として表示。 |
| 13 | Dies / leaves battlefield trigger | C | trigger-assist | 36 | 159 | battlefieldから離れたイベント後に誘発候補として表示。 |
| 14 | Attack trigger | C | trigger-assist | 22 | 149 | declareAttack後に攻撃誘発候補として表示。 |
| 15 | resource-token: Treasure | A | primitive | 24 | 89 | Treasure のトークンプリセット候補。 |
| 16 | CR 701 Discard | A | primitive | 45 | 168 | 捨てる候補。ランダム/選択式は分ける。 |
| 17 | CR 701 Destroy | B | semi-automatic | 62 | 183 | 破壊候補。破壊不能/再生は警告。 |
| 18 | keyword-ability: Equip | B | semi-automatic | 22 | 75 | Equip は能力ごとの警告/候補へ分岐。 |
| 19 | CR 701 Scry | A | primitive | 18 | 41 | 既存占術UIへ接続。 |
| 20 | CR 701 Mill | A | primitive | 14 | 61 | 既存millコマンドへ接続。 |
| 21 | keyword-ability: Cycling | B | semi-automatic | 18 | 43 | Cycling は能力ごとの警告/候補へ分岐。 |
| 22 | Landfall / land enters trigger | C | trigger-assist | 15 | 37 | 土地が戦場に出た後に誘発候補として表示。 |
| 23 | CR 701 Proliferate | A | primitive | 7 | 31 | 既存proliferateAllを候補化。 |

## Scryfall Keywords 分離 Top 30

| 順位 | 分類 | Keyword | Family | Risk | Top3000 | 代表例 |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | keyword-ability | Flying | evergreen | E | 211 | Birds of Paradise (#33)<br>Ornithopter of Paradise (#221)<br>Mirkwood Bats (#223)<br>Faerie Mastermind (#327)<br>Baleful Strix (#356)<br>Goldspan Dragon (#401)<br>Welcoming Vampire (#429)<br>Terror of the Peaks (#513) |
| 2 | resource-token | Treasure | resource-token | A | 89 | An Offer You Can't Refuse (#35)<br>Smothering Tithe (#62)<br>Deadly Dispute (#128)<br>Black Market Connections (#132)<br>Big Score (#160)<br>Tireless Provisioner (#180)<br>Storm-Kiln Artist (#209)<br>Professional Face-Breaker (#216) |
| 3 | keyword-ability | Equip | object-state | B | 75 | Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Skullclamp (#41)<br>Mithril Coat (#240)<br>Sword of the Animist (#243)<br>Basilisk Collar (#259)<br>Whispersilk Cloak (#326)<br>Shadowspear (#329) |
| 4 | keyword-action | Scry | keyword-action | A | 42 | Path of Ancestry (#14)<br>Opt (#213)<br>Preordain (#218)<br>Viscera Seer (#253)<br>Temple of Epiphany (#270)<br>Temple of Silence (#278)<br>Temple of Triumph (#292)<br>Temple of Mystery (#300) |
| 5 | keyword-ability | Cycling | alternate-activation | B | 43 | Ash Barrens (#192)<br>Jetmir's Garden (#353)<br>Ketria Triome (#355)<br>Spara's Headquarters (#394)<br>Raffine's Tower (#416)<br>Xander's Lounge (#469)<br>Ziatora's Proving Ground (#512)<br>Sheltered Thicket (#629) |
| 6 | ability-word | Landfall | ability-word-condition | C | 37 | Tireless Provisioner (#180)<br>Scute Swarm (#222)<br>Avenger of Zendikar (#274)<br>Lotus Cobra (#320)<br>Rampaging Baloths (#364)<br>Evolution Sage (#405)<br>Tatyova, Benthic Druid (#463)<br>Felidar Retreat (#488) |
| 7 | keyword-action | Mill | keyword-action | A | 61 | Takenuma, Abandoned Mire (#244)<br>Syr Konrad, the Grim (#252)<br>Ripples of Undeath (#542)<br>Six (#555)<br>Tibalt's Trickery (#587)<br>Emry, Lurker of the Loch (#611)<br>Altar of Dementia (#617)<br>Stitcher's Supplier (#636) |
| 8 | keyword-ability | Indestructible | evergreen | E | 38 | The One Ring (#89)<br>Mithril Coat (#240)<br>Darksteel Citadel (#283)<br>Toski, Bearer of Secrets (#381)<br>Purphoros, God of the Forge (#653)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Avacyn, Angel of Hope (#768)<br>Brash Taunter (#786) |
| 9 | keyword-ability | Enchant | object-state | B | 49 | Wild Growth (#211)<br>Animate Dead (#224)<br>Utopia Sprawl (#341)<br>Darksteel Mutation (#576)<br>Curiosity (#594)<br>All That Glitters (#602)<br>Kenrith's Transformation (#690)<br>Curse of Opulence (#709) |
| 10 | keyword-ability | Trample | evergreen | E | 77 | Rampaging Baloths (#364)<br>Ghalta, Primal Hunger (#474)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Hellkite Tyrant (#784)<br>Mossborn Hydra (#827)<br>Managorger Hydra (#937)<br>Nyxbloom Ancient (#1002)<br>Blightsteel Colossus (#1043) |
| 11 | keyword-ability | Flash | evergreen | E | 46 | Mithril Coat (#240)<br>Orcish Bowmasters (#254)<br>Hullbreaker Horror (#267)<br>Faerie Mastermind (#327)<br>Opposition Agent (#539)<br>Hydroelectric Specimen // Hydroelectric Laboratory (#616)<br>Dualcaster Mage (#634)<br>Archivist of Oghma (#667) |
| 12 | keyword-ability | Vigilance | evergreen | E | 45 | Sun Titan (#289)<br>Loran of the Third Path (#352)<br>Enduring Vitality (#494)<br>Adeline, Resplendent Cathar (#507)<br>Faeburrow Elder (#515)<br>Avacyn, Angel of Hope (#768)<br>Danitha Capashen, Paragon (#788)<br>Elesh Norn, Grand Cenobite (#808) |
| 13 | keyword-ability | Channel | alternate-activation | E | 7 | Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Takenuma, Abandoned Mire (#244)<br>Eiganjo, Seat of the Empire (#376)<br>Sokenzan, Crucible of Defiance (#957)<br>Shigeki, Jukai Visionary (#1644)<br>Touch the Spirit Realm (#1810)<br>Colossal Skyturtle (#3732) |
| 14 | keyword-ability | Haste | evergreen | E | 36 | Craterhoof Behemoth (#328)<br>Anger (#351)<br>Goldspan Dragon (#401)<br>Loyal Apprentice (#723)<br>Aurelia, the Warleader (#826)<br>Stormcatch Mentor (#977)<br>Yahenni, Undying Partisan (#1005)<br>Captain Lannery Storm (#1145) |
| 15 | keyword-action | Surveil | keyword-action | A | 19 | Consider (#382)<br>Undercity Sewers (#433)<br>Underground Mortuary (#472)<br>Hedge Maze (#545)<br>Raucous Theater (#562)<br>Shadowy Backstreet (#563)<br>Thundering Falls (#625)<br>Commercial District (#644) |
| 16 | keyword-ability | Flashback | cost-and-cast | D | 17 | Faithless Looting (#94)<br>Sevinne's Reclamation (#337)<br>Dread Return (#521)<br>Strike It Rich (#1091)<br>Past in Flames (#1274)<br>Deep Analysis (#1440)<br>Bulk Up (#1737)<br>Seize the Day (#1742) |
| 17 | keyword-ability | Overload | cost-and-cast | D | 9 | Cyclonic Rift (#51)<br>Vandalblast (#101)<br>Damn (#336)<br>Mizzix's Mastery (#794)<br>Eldritch Immunity (#1957)<br>Winds of Abandon (#2088)<br>Fangs of Kalonia (#2419)<br>Spectacular Showdown (#2630) |
| 18 | keyword-action | Proliferate | keyword-action | A | 31 | Karn's Bastion (#202)<br>Evolution Sage (#405)<br>Cankerbloom (#732)<br>Yawgmoth, Thran Physician (#816)<br>Thrummingbird (#831)<br>Tezzeret's Gambit (#923)<br>Ripples of Potential (#994)<br>Inexorable Tide (#1027) |
| 19 | keyword-ability | Deathtouch | evergreen | E | 31 | Baleful Strix (#356)<br>Sheoldred, the Apocalypse (#464)<br>Elas il-Kor, Sadistic Pilgrim (#595)<br>The Gitrog Monster (#890)<br>Bloodthirsty Conqueror (#926)<br>Wurmcoil Engine (#1030)<br>Grave Titan (#1383)<br>Acidic Slime (#1418) |
| 20 | keyword-ability | Lifelink | evergreen | E | 41 | Mangara, the Diplomat (#626)<br>Danitha Capashen, Paragon (#788)<br>Enduring Innocence (#803)<br>Serra Ascendant (#992)<br>Wurmcoil Engine (#1030)<br>K'rrik, Son of Yawgmoth (#1069)<br>Ocelot Pride (#1118)<br>Archon of Sun's Grace (#1150) |
| 21 | keyword-action | Double | other-keyword | B | 28 | Unnatural Growth (#454)<br>Mossborn Hydra (#827)<br>Solphim, Mayhem Dominus (#871)<br>Twinflame Tyrant (#879)<br>Bristly Bill, Spine Sower (#901)<br>Kalonian Hydra (#1094)<br>Gisela, Blade of Goldnight (#1125)<br>Zopandrel, Hunger Dominus (#1154) |
| 22 | resource-token | Food | resource-token | A | 18 | Tireless Provisioner (#180)<br>Academy Manufactor (#263)<br>Peregrin Took (#774)<br>Gilded Goose (#780)<br>The Shire (#1137)<br>Rosie Cotton of South Lane (#1228)<br>Nuka-Cola Vending Machine (#1287)<br>The Battle of Bywater (#1831) |
| 23 | keyword-ability | Reach | evergreen | E | 29 | Six (#555)<br>Ancient Greenwarden (#670)<br>Kodama of the West Tree (#820)<br>Kodama of the East Tree (#952)<br>Arasta of the Endless Web (#1011)<br>Zopandrel, Hunger Dominus (#1154)<br>Lumra, Bellow of the Woods (#1190)<br>Invasion of Ikoria // Zilortha, Apex of Ikoria (#1276) |
| 24 | keyword-ability | Cumulative upkeep | other-keyword | E | 1 | Mystic Remora (#96)<br>Braid of Fire (#4144)<br>Karplusan Minotaur (#9500)<br>Elephant Grass (#10125)<br>Vexing Sphinx (#21340)<br>Phyrexian Etchings (#22196)<br>Jötun Owl Keeper (#25634) |
| 25 | keyword-ability | Ward | evergreen | D | 20 | Roaming Throne (#133)<br>Hexing Squelcher (#903)<br>Kappa Cannoneer (#969)<br>Valgavoth, Terror Eater (#1384)<br>Miirym, Sentinel Wyrm (#1409)<br>Adrix and Nev, Twincasters (#1411)<br>Ulamog, the Defiler (#1532)<br>Bronze Guardian (#1901) |
| 26 | keyword-ability | Menace | evergreen | E | 19 | Professional Face-Breaker (#216)<br>Noxious Gearhulk (#961)<br>Junji, the Midnight Sky (#1212)<br>Kozilek, the Great Distortion (#1508)<br>Massacre Girl (#1603)<br>Massacre Girl, Known Killer (#1638)<br>Sheoldred // The True Scriptures (#1871)<br>Stormfist Crusader (#1902) |
| 27 | keyword-action | Transform | object-state | B | 19 | Growing Rites of Itlimoc // Itlimoc, Cradle of the Sun (#557)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Ojer Taq, Deepest Foundation // Temple of Civilization (#828)<br>Invasion of Ikoria // Zilortha, Apex of Ikoria (#1276)<br>Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel (#1405)<br>Westvale Abbey // Ormendahl, Profane Prince (#1432)<br>Ojer Axonil, Deepest Might // Temple of Power (#1464)<br>Brass's Tunnel-Grinder // Tecutlan, the Searing Rift (#1509) |
| 28 | keyword-ability | First strike | evergreen | E | 25 | Knight of the White Orchid (#619)<br>Danitha Capashen, Paragon (#788)<br>Combustible Gearhulk (#1006)<br>Ocelot Pride (#1118)<br>Gisela, Blade of Goldnight (#1125)<br>Bonehoard Dracosaur (#1349)<br>Glissa Sunslayer (#1436)<br>Thalia, Heretic Cathar (#1447) |
| 29 | ability-word | Magecraft | ability-word-condition | C | 6 | Storm-Kiln Artist (#209)<br>Archmage Emeritus (#258)<br>Veyran, Voice of Duality (#791)<br>Ashling, Flame Dancer (#1542)<br>Professor Onyx (#2361)<br>Sedgemoor Witch (#2381)<br>Witherbloom Apprentice (#4564)<br>Deekah, Fractal Theorist (#4902) |
| 30 | ability-word | Metalcraft | ability-word-condition | C | 4 | Mox Opal (#238)<br>Dispatch (#486)<br>Puresteel Paladin (#613)<br>Urza's Workshop (#2394)<br>Molten Psyche (#3777)<br>Galvanic Blast (#4884)<br>Indomitable Archangel (#6705)<br>Brotherhood Scribe (#7106) |

## Risk別

### A: 決定的プリミティブ

| タグ | Layer | Top3000 | 代表例 |
| --- | --- | ---: | --- |
| Mana / mana abilities | primitive | 762 | Sol Ring (#1)<br>Command Tower (#2)<br>Arcane Signet (#3)<br>Exotic Orchard (#9)<br>Reliquary Tower (#10)<br>Path of Ancestry (#14)<br>Fellwar Stone (#17)<br>Rogue's Passage (#19) |
| Draw cards | primitive | 448 | Mind Stone (#32)<br>Solemn Simulacrum (#38)<br>Skullclamp (#41)<br>Rhystic Study (#43)<br>Commander's Sphere (#46)<br>Arcane Denial (#56)<br>Brainstorm (#71)<br>Esper Sentinel (#76) |
| CR 701 Shuffle | primitive | 226 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Farseek (#23)<br>Rampant Growth (#26)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Nature's Lore (#29) |
| CR 701 Discard | primitive | 168 | Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Faithless Looting (#94)<br>Frantic Search (#104)<br>Windfall (#152)<br>Big Score (#160)<br>Ash Barrens (#192)<br>Thrill of Possibility (#203) |
| CR 701 Activate | primitive | 149 | Temple of the False God (#74)<br>Boseiju, Who Endures (#78)<br>Otawara, Soaring City (#90)<br>Idol of Oblivion (#197)<br>Secluded Courtyard (#227)<br>Mox Opal (#238)<br>Takenuma, Abandoned Mire (#244)<br>Grand Abolisher (#250) |
| CR 701 Reveal | primitive | 122 | Cultivate (#20)<br>Chaos Warp (#30)<br>Kodama's Reach (#37)<br>Enlightened Tutor (#122)<br>Herald's Horn (#141)<br>Mystical Tutor (#147)<br>Worldly Tutor (#165)<br>Ash Barrens (#192) |
| resource-token: Treasure | primitive | 89 | An Offer You Can't Refuse (#35)<br>Smothering Tithe (#62)<br>Deadly Dispute (#128)<br>Black Market Connections (#132)<br>Big Score (#160)<br>Tireless Provisioner (#180)<br>Storm-Kiln Artist (#209)<br>Professional Face-Breaker (#216) |
| keyword-action: Scry | primitive | 42 | Path of Ancestry (#14)<br>Opt (#213)<br>Preordain (#218)<br>Viscera Seer (#253)<br>Temple of Epiphany (#270)<br>Temple of Silence (#278)<br>Temple of Triumph (#292)<br>Temple of Mystery (#300) |

### B: 対象選択つき一括処理

| タグ | Layer | Top3000 | 代表例 |
| --- | --- | ---: | --- |
| Zone movement / zone references | semi-automatic | 1,020 | Reliquary Tower (#10)<br>Swords to Plowshares (#11)<br>Path of Ancestry (#14)<br>Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Thought Vessel (#21)<br>Blasphemous Act (#22) |
| CR 701 Cast | semi-automatic | 571 | Path of Ancestry (#14)<br>Blasphemous Act (#22)<br>Rhystic Study (#43)<br>Cyclonic Rift (#51)<br>Toxic Deluge (#67)<br>Esper Sentinel (#76)<br>Deflecting Swat (#79)<br>Fierce Guardianship (#80) |
| CR 701 Sacrifice | semi-automatic | 402 | Evolving Wilds (#18)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Mind Stone (#32)<br>An Offer You Can't Refuse (#35)<br>Polluted Delta (#36)<br>Flooded Strand (#39)<br>Misty Rainforest (#40) |
| CR 701 Search | semi-automatic | 199 | Path to Exile (#15)<br>Evolving Wilds (#18)<br>Cultivate (#20)<br>Farseek (#23)<br>Rampant Growth (#26)<br>Myriad Landscape (#27)<br>Terramorphic Expanse (#28)<br>Nature's Lore (#29) |
| CR 701 Create | semi-automatic | 432 | Beast Within (#24)<br>An Offer You Can't Refuse (#35)<br>Generous Gift (#58)<br>Smothering Tithe (#62)<br>Swan Song (#73)<br>Urza's Saga (#121)<br>Deadly Dispute (#128)<br>Black Market Connections (#132) |
| Create token | semi-automatic | 431 | Beast Within (#24)<br>An Offer You Can't Refuse (#35)<br>Generous Gift (#58)<br>Smothering Tithe (#62)<br>Swan Song (#73)<br>Urza's Saga (#121)<br>Deadly Dispute (#128)<br>Black Market Connections (#132) |
| CR 701 Exile | semi-automatic | 304 | Swords to Plowshares (#11)<br>Path to Exile (#15)<br>Bojuka Bog (#25)<br>Faithless Looting (#94)<br>Jeska's Will (#102)<br>Teferi's Protection (#105)<br>Deadly Rollick (#112)<br>Chrome Mox (#143) |
| CR 701 Destroy | semi-automatic | 183 | Beast Within (#24)<br>Generous Gift (#58)<br>Boseiju, Who Endures (#78)<br>Feed the Swarm (#88)<br>Vandalblast (#101)<br>Assassin's Trophy (#124)<br>Abrade (#149)<br>Pongify (#156) |

### C: 誘発候補

| タグ | Layer | Top3000 | 代表例 |
| --- | --- | ---: | --- |
| ETB / enters trigger | trigger-assist | 471 | Bojuka Bog (#25)<br>Solemn Simulacrum (#38)<br>The One Ring (#89)<br>Garruk's Uprising (#92)<br>Eternal Witness (#109)<br>Chrome Mox (#143)<br>Mystic Sanctuary (#172)<br>Tireless Provisioner (#180) |
| Upkeep / end step trigger | trigger-assist | 249 | Arcane Denial (#56)<br>The One Ring (#89)<br>Mystic Remora (#96)<br>Phyrexian Arena (#98)<br>Herald's Horn (#141)<br>Mana Vault (#144)<br>Sylvan Library (#256)<br>Ragavan, Nimble Pilferer (#269) |
| Dies / leaves battlefield trigger | trigger-assist | 159 | Solemn Simulacrum (#38)<br>Skullclamp (#41)<br>Blood Artist (#138)<br>Animate Dead (#224)<br>Pitiless Plunderer (#229)<br>Zulaport Cutthroat (#233)<br>Syr Konrad, the Grim (#252)<br>Morbid Opportunist (#257) |
| Cast / copy trigger | trigger-assist | 167 | Path of Ancestry (#14)<br>Storm-Kiln Artist (#209)<br>Beast Whisperer (#212)<br>Archmage Emeritus (#258)<br>Hullbreaker Horror (#267)<br>Flusterstorm (#310)<br>Vanquisher's Banner (#354)<br>Aetherflux Reservoir (#374) |
| Attack trigger | trigger-assist | 149 | Sword of the Animist (#243)<br>Etali, Primal Storm (#260)<br>Sun Titan (#289)<br>Kindred Discovery (#347)<br>Goldspan Dragon (#401)<br>Adeline, Resplendent Cathar (#507)<br>Ignoble Hierarch (#529)<br>Six (#555) |
| Landfall / land enters trigger | trigger-assist | 37 | Tireless Provisioner (#180)<br>Scute Swarm (#222)<br>Avenger of Zendikar (#274)<br>Lotus Cobra (#320)<br>Rampaging Baloths (#364)<br>Evolution Sage (#405)<br>Tatyova, Benthic Druid (#463)<br>Felidar Retreat (#488) |
| ability-word: Landfall | trigger-assist | 37 | Tireless Provisioner (#180)<br>Scute Swarm (#222)<br>Avenger of Zendikar (#274)<br>Lotus Cobra (#320)<br>Rampaging Baloths (#364)<br>Evolution Sage (#405)<br>Tatyova, Benthic Druid (#463)<br>Felidar Retreat (#488) |
| ability-word: Magecraft | trigger-assist | 6 | Storm-Kiln Artist (#209)<br>Archmage Emeritus (#258)<br>Veyran, Voice of Duality (#791)<br>Ashling, Flame Dancer (#1542)<br>Professor Onyx (#2361)<br>Sedgemoor Witch (#2381)<br>Witherbloom Apprentice (#4564)<br>Deekah, Fractal Theorist (#4902) |

### D: コスト/タイミング警告

| タグ | Layer | Top3000 | 代表例 |
| --- | --- | ---: | --- |
| Cost / payment modifiers | warning | 349 | Blasphemous Act (#22)<br>Polluted Delta (#36)<br>Flooded Strand (#39)<br>Misty Rainforest (#40)<br>Bloodstained Mire (#42)<br>Windswept Heath (#45)<br>Verdant Catacombs (#47)<br>Wooded Foothills (#48) |
| keyword-ability: Flashback | warning | 17 | Faithless Looting (#94)<br>Sevinne's Reclamation (#337)<br>Dread Return (#521)<br>Strike It Rich (#1091)<br>Past in Flames (#1274)<br>Deep Analysis (#1440)<br>Bulk Up (#1737)<br>Seize the Day (#1742) |
| keyword-ability: Overload | warning | 9 | Cyclonic Rift (#51)<br>Vandalblast (#101)<br>Damn (#336)<br>Mizzix's Mastery (#794)<br>Eldritch Immunity (#1957)<br>Winds of Abandon (#2088)<br>Fangs of Kalonia (#2419)<br>Spectacular Showdown (#2630) |
| keyword-ability: Ward | warning | 20 | Roaming Throne (#133)<br>Hexing Squelcher (#903)<br>Kappa Cannoneer (#969)<br>Valgavoth, Terror Eater (#1384)<br>Miirym, Sentinel Wyrm (#1409)<br>Adrix and Nev, Twincasters (#1411)<br>Ulamog, the Defiler (#1532)<br>Bronze Guardian (#1901) |
| keyword-ability: Convoke | warning | 8 | Chord of Calling (#532)<br>Clever Concealment (#621)<br>City on Fire (#825)<br>Hour of Reckoning (#1015)<br>Lethal Scheme (#1450)<br>Hoarding Broodlord (#1668)<br>Bennie Bracks, Zoologist (#1788)<br>March of the Multitudes (#2903) |
| keyword-ability: Kicker | warning | 9 | Tear Asunder (#877)<br>Rite of Replication (#924)<br>Maddening Cacophony (#1641)<br>Galadriel's Dismissal (#1729)<br>Orim's Chant (#2038)<br>Sowing Mycospawn (#2084)<br>Thieving Skydiver (#2221)<br>Inscription of Abundance (#2300) |
| keyword-ability: Affinity | warning | 4 | Emry, Lurker of the Loch (#611)<br>Thought Monitor (#769)<br>Thoughtcast (#941)<br>Junk Winder (#1774)<br>Mycosynth Golem (#3421)<br>Voyage Home (#4055)<br>Demonic Junker (#4610)<br>Banquet Guests (#4642) |
| keyword-ability: Spree | warning | 8 | Return the Favor (#658)<br>Three Steps Ahead (#1103)<br>Great Train Heist (#1111)<br>Insatiable Avarice (#1129)<br>Requisition Raid (#1268)<br>Smuggler's Surprise (#1551)<br>Lively Dirge (#1731)<br>Final Showdown (#2167) |

### E: 助言のみ

| タグ | Layer | Top3000 | 代表例 |
| --- | --- | ---: | --- |
| Target-dependent text | advisory | 785 | Swords to Plowshares (#11)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Path to Exile (#15)<br>Counterspell (#16)<br>Rogue's Passage (#19)<br>Beast Within (#24)<br>Bojuka Bog (#25) |
| Continuous effects / layers | advisory | 488 | Reliquary Tower (#10)<br>Swiftfoot Boots (#12)<br>Lightning Greaves (#13)<br>Rogue's Passage (#19)<br>Thought Vessel (#21)<br>Skullclamp (#41)<br>Chromatic Lantern (#81)<br>Garruk's Uprising (#92) |
| Replacement / prevention effects | advisory | 257 | Watery Grave (#52)<br>Godless Shrine (#61)<br>Breeding Pool (#63)<br>Hallowed Fountain (#65)<br>Steam Vents (#66)<br>Stomping Ground (#68)<br>Blood Crypt (#69)<br>Overgrown Tomb (#70) |
| keyword-ability: Flying | advisory | 211 | Birds of Paradise (#33)<br>Ornithopter of Paradise (#221)<br>Mirkwood Bats (#223)<br>Faerie Mastermind (#327)<br>Baleful Strix (#356)<br>Goldspan Dragon (#401)<br>Welcoming Vampire (#429)<br>Terror of the Peaks (#513) |
| keyword-ability: Indestructible | advisory | 38 | The One Ring (#89)<br>Mithril Coat (#240)<br>Darksteel Citadel (#283)<br>Toski, Bearer of Secrets (#381)<br>Purphoros, God of the Forge (#653)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Avacyn, Angel of Hope (#768)<br>Brash Taunter (#786) |
| keyword-ability: Trample | advisory | 77 | Rampaging Baloths (#364)<br>Ghalta, Primal Hunger (#474)<br>Etali, Primal Conqueror // Etali, Primal Sickness (#761)<br>Hellkite Tyrant (#784)<br>Mossborn Hydra (#827)<br>Managorger Hydra (#937)<br>Nyxbloom Ancient (#1002)<br>Blightsteel Colossus (#1043) |
| keyword-ability: Flash | advisory | 46 | Mithril Coat (#240)<br>Orcish Bowmasters (#254)<br>Hullbreaker Horror (#267)<br>Faerie Mastermind (#327)<br>Opposition Agent (#539)<br>Hydroelectric Specimen // Hydroelectric Laboratory (#616)<br>Dualcaster Mage (#634)<br>Archivist of Oghma (#667) |
| keyword-ability: Vigilance | advisory | 45 | Sun Titan (#289)<br>Loran of the Third Path (#352)<br>Enduring Vitality (#494)<br>Adeline, Resplendent Cathar (#507)<br>Faeburrow Elder (#515)<br>Avacyn, Angel of Hope (#768)<br>Danitha Capashen, Paragon (#788)<br>Elesh Norn, Grand Cenobite (#808) |

## M5への反映

- M5.1ではまず `CardDef.edhrecRank` と `CardDef.keywords` を保存し、`classifyCardRules(def)` がこの分析と同じタグを返すようにする。
- M5.1のデッキ別レポートは、現在デッキの `InitDeckCard[]` を `CardDef` 単位で分類し、上記EDH順位のタグと交差させる。
- M5.2以降の候補表示は、このファイルの `implementationQueue` の順に切る。対象依存・置換・継続効果は上位でも助言に留める。
- `counter` は CR 701.6 の打ち消しと CR 122 のカウンターを分離済み。実装でも別タグにする。
