# 分類精度ハーネス A0 レポート

**この数値は未調整(Scryfall keywords は候補集合であり絶対正解でない)。**

- 生成日時: 2026-06-21T04:23:39.738Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- 総 raw カード数: 17491
- CardDef 写像成功: 17491
- CardDef 写像失敗: 0
- キーワード FP候補(分類器のみ): 8
- キーワード FN候補(Scryfall のみ): 85

## ルールタグ別件数

| id | label | count |
|---|---:|---:|
| keyword.deathtouch | 接死 | 246 |
| keyword.defender | 防衛 | 115 |
| keyword.double-strike | 二段攻撃 | 80 |
| keyword.enchant | エンチャント | 454 |
| keyword.equip | 装備 | 404 |
| keyword.first-strike | 先制攻撃 | 190 |
| keyword.flash | 瞬速 | 422 |
| keyword.flying | 飛行 | 1837 |
| keyword.haste | 速攻 | 395 |
| keyword.hexproof | 呪禁 | 49 |
| keyword.indestructible | 破壊不能 | 78 |
| keyword.lifelink | 絆魂 | 276 |
| keyword.landwalk | 土地渡り | 31 |
| keyword.protection | プロテクション | 54 |
| keyword.reach | 到達 | 295 |
| keyword.shroud | 被覆 | 4 |
| keyword.trample | トランプル | 609 |
| keyword.vigilance | 警戒 | 501 |
| keyword.ward | 護法 | 176 |
| keyword.banding | バンド | 1 |
| keyword.rampage | ランページ | 1 |
| keyword.cumulative-upkeep | 累加アップキープ | 7 |
| keyword.flanking | 側面攻撃 | 5 |
| keyword.buyback | バイバック | 10 |
| keyword.shadow | シャドー | 7 |
| keyword.cycling | サイクリング | 226 |
| keyword.echo | エコー | 13 |
| keyword.horsemanship | 馬術 | 1 |
| keyword.fading | 消散 | 3 |
| keyword.kicker | キッカー | 109 |
| keyword.flashback | フラッシュバック | 125 |
| keyword.madness | マッドネス | 26 |
| keyword.fear | 畏怖 | 9 |
| keyword.morph | 変異 | 29 |
| keyword.provoke | 挑発 | 2 |
| keyword.storm | ストーム | 20 |
| keyword.affinity | 親和 | 51 |
| keyword.entwine | 双呪 | 8 |
| keyword.modular | 接合 | 6 |
| keyword.sunburst | 烈日 | 5 |
| keyword.bushido | 武士道 | 7 |
| keyword.splice | 連繋 | 4 |
| keyword.offering | 献身 | 1 |
| keyword.ninjutsu | 忍術 | 29 |
| keyword.epic | 歴伝 | 1 |
| keyword.convoke | 召集 | 78 |
| keyword.dredge | 発掘 | 9 |
| keyword.transmute | 変成 | 6 |
| keyword.bloodthirst | 狂喜 | 5 |
| keyword.haunt | 憑依 | 4 |
| keyword.replicate | 複製 | 11 |
| keyword.graft | 移植 | 4 |
| keyword.split-second | 刹那 | 9 |
| keyword.suspend | 待機 | 27 |
| keyword.vanishing | 消失 | 8 |
| keyword.delve | 探査 | 11 |
| keyword.fortify | 城砦化 | 1 |
| keyword.gravestorm | 墓地ストーム | 2 |
| keyword.champion | 覇権 | 5 |
| keyword.changeling | 多相 | 50 |
| keyword.evoke | 想起 | 22 |
| keyword.hideaway | 秘匿 | 15 |
| keyword.reinforce | 補強 | 2 |
| keyword.conspire | 共謀 | 2 |
| keyword.persist | 頑強 | 8 |
| keyword.wither | 萎縮 | 8 |
| keyword.retrace | 回顧 | 9 |
| keyword.devour | 貪食 | 8 |
| keyword.exalted | 賛美 | 9 |
| keyword.unearth | 蘇生 | 41 |
| keyword.cascade | 続唱 | 26 |
| keyword.annihilator | 滅殺 | 12 |
| keyword.level-up | Lvアップ | 13 |
| keyword.rebound | 反復 | 18 |
| keyword.infect | 感染 | 18 |
| keyword.battle-cry | 喊声 | 9 |
| keyword.living-weapon | 生体武器 | 11 |
| keyword.undying | 不死 | 13 |
| keyword.miracle | 奇跡 | 12 |
| keyword.soulbond | 結魂 | 11 |
| keyword.overload | 超過 | 17 |
| keyword.scavenge | 活用 | 7 |
| keyword.unleash | 解鎖 | 5 |
| keyword.cipher | 暗号 | 5 |
| keyword.evolve | 進化 | 13 |
| keyword.extort | 強請 | 13 |
| keyword.fuse | 融合 | 5 |
| keyword.bestow | 授与 | 13 |
| keyword.dethrone | 廃位 | 4 |
| keyword.outlast | 長久 | 5 |
| keyword.prowess | 果敢 | 56 |
| keyword.dash | 疾駆 | 6 |
| keyword.exploit | 濫用 | 14 |
| keyword.menace | 威迫 | 312 |
| keyword.renown | 高名 | 2 |
| keyword.awaken | 覚醒 | 3 |
| keyword.devoid | 欠色 | 55 |
| keyword.myriad | 無尽 | 21 |
| keyword.surge | 怒濤 | 2 |
| keyword.skulk | 潜伏 | 7 |
| keyword.emerge | 現出 | 11 |
| keyword.escalate | 増呪 | 6 |
| keyword.melee | 会戦 | 7 |
| keyword.crew | 搭乗 | 158 |
| keyword.fabricate | 製造 | 5 |
| keyword.partner | 共闘 | 68 |
| keyword.undaunted | 不抜 | 4 |
| keyword.improvise | 即席 | 11 |
| keyword.aftermath | 余波 | 10 |
| keyword.embalm | 不朽 | 3 |
| keyword.eternalize | 永遠 | 4 |
| keyword.afflict | 加虐 | 2 |
| keyword.ascend | 昇殿 | 12 |
| keyword.assist | 助力 | 1 |
| keyword.jump-start | 再活 | 5 |
| keyword.mentor | 教導 | 15 |
| keyword.afterlife | 死後 | 9 |
| keyword.riot | 暴動 | 4 |
| keyword.spectacle | 絢爛 | 5 |
| keyword.companion | 相棒 | 9 |
| keyword.mutate | 変容 | 6 |
| keyword.boast | 誇示 | 5 |
| keyword.foretell | 予顕 | 21 |
| keyword.demonstrate | 実演 | 4 |
| keyword.daybound | 日暮 | 35 |
| keyword.nightbound | 夜明 | 35 |
| keyword.disturb | 降霊 | 25 |
| keyword.decayed | 腐乱 | 1 |
| keyword.cleave | 切除 | 12 |
| keyword.training | 訓練 | 11 |
| keyword.compleated | 完成化 | 7 |
| keyword.reconfigure | 換装 | 17 |
| keyword.blitz | 奇襲 | 16 |
| keyword.casualty | 犠牲 | 15 |
| keyword.enlist | 後援 | 12 |
| keyword.read-ahead | 先読 | 10 |
| keyword.ravenous | 貪欲 | 12 |
| keyword.squad | 分隊 | 14 |
| keyword.space-sculptor | 空間彫刻家 | 1 |
| keyword.prototype | 試作 | 19 |
| keyword.toxic | 毒性 | 37 |
| keyword.for-mirrodin | ミラディンのために！ | 13 |
| keyword.backup | 賛助 | 25 |
| keyword.bargain | 協約 | 20 |
| keyword.craft | 作製 | 23 |
| keyword.disguise | 偽装 | 43 |
| keyword.offspring | 新生 | 20 |
| keyword.gift | 贈呈 | 24 |
| keyword.saddle | 騎乗 | 30 |
| keyword.impending | 兆候 | 5 |
| keyword.exhaust | 消尽 | 27 |
| keyword.mobilize | 動員 | 12 |
| keyword.station | 配備 | 31 |
| keyword.warp | ワープ | 32 |
| keyword.sneak | 奇襲潜入 | 27 |
| trigger.etb | 戦場に出たときの誘発 | 3689 |
| trigger.death | 死亡・墓地に置かれたときの誘発 | 810 |
| trigger.cast | 唱えたときの誘発 | 898 |
| trigger.attack | 攻撃したときの誘発 | 1340 |
| trigger.landfall | 上陸の誘発 | 243 |
| trigger.upkeep | アップキープ開始時の誘発 | 424 |
| trigger.cast-watcher | 呪文を唱えるたびの誘発 | 784 |
| trigger.etb-other | 他が戦場に出たときの誘発 | 584 |
| trigger.death-other | 他の死亡時の誘発 | 281 |
| trigger.attack-watcher | クリーチャー攻撃時の誘発 | 175 |
| action.draw | カードを引く | 2440 |
| action.create-token | トークン生成 | 2453 |
| action.proliferate | 増殖 | 81 |
| action.counter | 呪文や能力を打ち消す | 148 |
| action.card-counters | カウンターを置く・増やす | 1973 |
| action.sacrifice | 生け贄 | 1505 |
| action.exile | 追放 | 1543 |
| action.search | ライブラリーから探す | 607 |
| action.return | 墓地/追放から戻す | 746 |
| action.destroy | 破壊 | 855 |
| action.mill | 切削 | 383 |
| action.scry | 占術 | 292 |
| action.discard | 捨てる | 854 |
| action.shuffle | シャッフル | 655 |
| action.surveil | 諜報 | 197 |
| action.attach | 装備/付与 | 500 |
| concept.target | 対象 | 6313 |
| cost.additional | 追加コスト | 184 |
| cost.alternative | 代替コスト | 235 |
| concept.alt-cast | 代替キャスト | 260 |
| concept.cast-from-zone | 墓地/追放から唱える | 236 |
| effect.replacement | 置換効果 | 835 |

## キーワード別件数(常磐木のみ)

| keyword | label | classifier | Scryfall候補 | FP候補 | FN候補 |
|---|---:|---:|---:|---:|---:|
| deathtouch | 接死 | 246 | 251 | 0 | 5 |
| defender | 防衛 | 115 | 115 | 0 | 0 |
| double-strike | 二段攻撃 | 80 | 82 | 0 | 2 |
| enchant | エンチャント | 454 | 458 | 0 | 4 |
| equip | 装備 | 404 | 411 | 8 | 15 |
| first-strike | 先制攻撃 | 190 | 194 | 0 | 4 |
| flash | 瞬速 | 422 | 423 | 0 | 1 |
| flying | 飛行 | 1837 | 1844 | 0 | 7 |
| haste | 速攻 | 395 | 399 | 0 | 4 |
| hexproof | 呪禁 | 49 | 51 | 0 | 2 |
| indestructible | 破壊不能 | 78 | 81 | 0 | 3 |
| lifelink | 絆魂 | 276 | 283 | 0 | 7 |
| protection | プロテクション | 54 | 58 | 0 | 4 |
| reach | 到達 | 295 | 298 | 0 | 3 |
| trample | トランプル | 609 | 616 | 0 | 7 |
| vigilance | 警戒 | 501 | 508 | 0 | 7 |
| ward | 護法 | 176 | 182 | 0 | 6 |
| menace | 威迫 | 312 | 316 | 0 | 4 |

## マナ能力照合(参考)

- Scryfall produced_mana あり: 1842
- 分類器マナ関連タグあり: 414
- 現分類器に専用のマナ能力タグがない場合、この節は件数のみ。

### produced_mana 色別件数

| id | label | count |
|---|---:|---:|
| B | B | 851 |
| C | C | 480 |
| G | G | 911 |
| R | R | 938 |
| U | U | 850 |
| W | W | 822 |

### 分類器マナ関連タグ件数

| id | label | count |
|---|---:|---:|
| keyword.protection | プロテクション | 1 |
| keyword.ward | 護法 | 1 |
| keyword.companion | 相棒 | 5 |
| keyword.boast | 誇示 | 2 |
| trigger.etb | 戦場に出たときの誘発 | 2 |
| trigger.death | 死亡・墓地に置かれたときの誘発 | 1 |
| trigger.cast | 唱えたときの誘発 | 34 |
| trigger.attack | 攻撃したときの誘発 | 1 |
| trigger.etb-other | 他が戦場に出たときの誘発 | 1 |
| trigger.attack-watcher | クリーチャー攻撃時の誘発 | 1 |
| action.draw | カードを引く | 1 |
| action.card-counters | カウンターを置く・増やす | 4 |
| action.return | 墓地/追放から戻す | 120 |
| cost.alternative | 代替コスト | 235 |
| concept.cast-from-zone | 墓地/追放から唱える | 23 |
| effect.replacement | 置換効果 | 3 |

## 型由来サマリ(参考)

| id | label | count |
|---|---:|---:|
| creature | Creature | 9744 |
| land | Land | 930 |
| artifact | Artifact | 2208 |
| enchantment | Enchantment | 1801 |
| instant | Instant | 1894 |
| sorcery | Sorcery | 1892 |
| planeswalker | Planeswalker | 213 |
| battle | Battle | 36 |

## キーワード FP候補 上位20(分類器のみ)

- 装備(equip / 分類器のみ) 《Bureau Headmaster》: Equipment spells you cast cost {1} less to cast. Equip abilities you activate cost {1} less to activate.
- 装備(equip / 分類器のみ) 《Cloud, Planet's Champion》: During your turn, as long as Cloud is equipped, it has double strike and indestructible. (This creature deals both first-strike and regular combat damage. Damage and effects tha...
- 装備(equip / 分類器のみ) 《Éowyn, Lady of Rohan》: At the beginning of combat on your turn, target creature gains your choice of first strike or vigilance until end of turn. If that creature is equipped, it gains first strike an...
- 装備(equip / 分類器のみ) 《Excalibur, Sword of Eden》: This spell costs {X} less to cast, where X is the total mana value of historic permanents you control. (Artifacts, legendaries, and Sagas are historic.) Equipped creature gets +...
- 装備(equip / 分類器のみ) 《Fighter Class》: (Gain the next level as a sorcery to add its ability.) When this Class enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle. {1}{R}{...
- 装備(equip / 分類器のみ) 《Helitrooper》: Flying Whenever this creature attacks, another target attacking creature gains flying until end of turn. Equip abilities you activate that target this creature cost {2} less to...
- 装備(equip / 分類器のみ) 《Mjölnir, Hammer of Thor》: When Mjölnir enters, it deals 4 damage to up to one target creature. Double all damage equipped creature would deal. Equip worthy {1} (A creature is worthy if it's a legendary n...
- 装備(equip / 分類器のみ) 《Strong Back》: Enchant creature Equip abilities you activate that target enchanted creature cost {3} less to activate. Aura spells you cast that target enchanted creature cost {3} less to cast...

## キーワード FN候補 上位20(Scryfall のみ)

- 装備(equip / Scryfallのみ) 《Astrologian's Planisphere》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature is a Wizard in addition to its other types and has...
- 装備(equip / Scryfallのみ) 《Bard's Bow》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2, has reach, and is a Bard in addition t...
- 装備(equip / Scryfallのみ) 《Belt of Giant Strength》: Equipped creature has base power and toughness 10/10. Equip {10}. This ability costs {X} less to activate, where X is the power of the creature it targets.
- 装備(equip / Scryfallのみ) 《Blue Mage's Cane》: Job select Equipped creature gets +0/+2, is a Wizard in addition to its other types, and has "Whenever this creature attacks, exile up to one target instant or sorcery card from...
- 装備(equip / Scryfallのみ) 《Dancer's Chakrams》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2, has lifelink and "Other commanders you...
- 装備(equip / Scryfallのみ) 《Dark Knight's Greatsword》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +3/+0 and is a Knight in addition to its othe...
- 装備(equip / Scryfallのみ) 《Dragoon's Lance》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +1/+0 and is a Knight in addition to its othe...
- 装備(equip / Scryfallのみ) 《Machinist's Arsenal》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2 for each artifact you control and is an...
- 装備(equip / Scryfallのみ) 《My Precious // Allure of Power》: Equipped creature has hexproof and can't be blocked. Equip—{2}, Pay 2 life. / As an additional cost to cast this spell, sacrifice a creature. Draw two cards.
- 装備(equip / Scryfallのみ) 《Ninja's Blades》: Job select Equipped creature gets +1/+1, is a Ninja in addition to its other types, and has "Whenever this creature deals combat damage to a player, draw a card, then discard a...
- 装備(equip / Scryfallのみ) 《Paladin's Arms》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+1, has ward {1}, and is a Knight in addit...
- 装備(equip / Scryfallのみ) 《Reaper's Scythe》: Job select At the beginning of your end step, put a soul counter on this Equipment for each player who lost life this turn. Equipped creature gets +1/+1 for each soul counter on...
- 装備(equip / Scryfallのみ) 《Sage's Nouliths》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +1/+0, has "Whenever this creature attacks, u...
- 装備(equip / Scryfallのみ) 《Samurai's Katana》: Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2, has trample and haste, and is a Samura...
- 装備(equip / Scryfallのみ) 《Summoner's Grimoire》: Job select Equipped creature is a Shaman in addition to its other types and has "Whenever this creature attacks, you may put a creature card from your hand onto the battlefield....
- 飛行(flying / Scryfallのみ) 《Ancestral Hot Dog Minotaur》: {TK}{TK} — Afflict 2 (Whenever this creature becomes blocked, defending player loses 2 life.) {TK}{TK}{TK} — Flying {TK}{TK} — 1/4 {TK}{TK}{TK}{TK}{TK} — 8/6
- 飛行(flying / Scryfallのみ) 《Celebr-8000》: At the beginning of combat on your turn, roll two six-sided dice. For each result of 1, this creature gets +1/+1 until end of turn. For each other result, it gains the indicated...
- 飛行(flying / Scryfallのみ) 《Elbrus, the Binding Blade // Withengar Unbound》: Equipped creature gets +1/+0. When equipped creature deals combat damage to a player, unattach Elbrus, then transform it. Equip {1} / Flying, intimidate, trample (A creature wit...
- 飛行(flying / Scryfallのみ) 《Goddric, Cloaked Reveler》: Haste Celebration — As long as two or more nonland permanents entered the battlefield under your control this turn, Goddric is a Dragon with base power and toughness 4/4, flying...
- 飛行(flying / Scryfallのみ) 《Nalathni Dragon》: Flying; banding (Any creatures with banding, and up to one without, can attack in a band. Bands are blocked as a group. If any creatures with banding you control are blocking or...

## 写像失敗 上位20

- なし

