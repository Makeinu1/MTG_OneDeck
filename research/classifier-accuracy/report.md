# 分類精度ハーネス A0 レポート

**この数値は未調整(Scryfall keywords は候補集合であり絶対正解でない)。**

- 生成日時: 2026-06-21T05:37:42.841Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- 総 raw カード数: 17491
- CardDef 写像成功: 17491
- CardDef 写像失敗: 0
- キーワード FP候補(分類器のみ): 2
- キーワード FN候補(Scryfall のみ): 67

## ルールタグ別件数

| id | label | count |
|---|---:|---:|
| keyword.deathtouch | 接死 | 246 |
| keyword.defender | 防衛 | 115 |
| keyword.double-strike | 二段攻撃 | 80 |
| keyword.enchant | エンチャント | 454 |
| keyword.equip | 装備 | 411 |
| keyword.first-strike | 先制攻撃 | 191 |
| keyword.flash | 瞬速 | 423 |
| keyword.flying | 飛行 | 1839 |
| keyword.haste | 速攻 | 395 |
| keyword.hexproof | 呪禁 | 49 |
| keyword.indestructible | 破壊不能 | 78 |
| keyword.lifelink | 絆魂 | 276 |
| keyword.landwalk | 土地渡り | 30 |
| keyword.protection | プロテクション | 54 |
| keyword.reach | 到達 | 296 |
| keyword.shroud | 被覆 | 4 |
| keyword.trample | トランプル | 609 |
| keyword.vigilance | 警戒 | 501 |
| keyword.ward | 護法 | 176 |
| keyword.banding | バンド | 3 |
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
| keyword.convoke | 召集 | 79 |
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
| concept.target | 対象 | 6314 |
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
| equip | 装備 | 411 | 411 | 2 | 2 |
| first-strike | 先制攻撃 | 191 | 194 | 0 | 3 |
| flash | 瞬速 | 423 | 423 | 0 | 0 |
| flying | 飛行 | 1839 | 1844 | 0 | 5 |
| haste | 速攻 | 395 | 399 | 0 | 4 |
| hexproof | 呪禁 | 49 | 51 | 0 | 2 |
| indestructible | 破壊不能 | 78 | 81 | 0 | 3 |
| lifelink | 絆魂 | 276 | 283 | 0 | 7 |
| protection | プロテクション | 54 | 58 | 0 | 4 |
| reach | 到達 | 296 | 298 | 0 | 2 |
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

- 装備(equip / 分類器のみ) 《Excalibur, Sword of Eden》: This spell costs {X} less to cast, where X is the total mana value of historic permanents you control. (Artifacts, legendaries, and Sagas are historic.) Equipped creature gets +...
- 装備(equip / 分類器のみ) 《Mjölnir, Hammer of Thor》: When Mjölnir enters, it deals 4 damage to up to one target creature. Double all damage equipped creature would deal. Equip worthy {1} (A creature is worthy if it's a legendary n...

## キーワード FN候補 上位20(Scryfall のみ)

- 絆魂(lifelink / Scryfallのみ) 《Celebr-8000》: At the beginning of combat on your turn, roll two six-sided dice. For each result of 1, this creature gets +1/+1 until end of turn. For each other result, it gains the indicated...
- 絆魂(lifelink / Scryfallのみ) 《Contortionist Otter Storm》: {TK}{TK} — {T}: Target creature gains haste until end of turn. {TK}{TK}{TK}{TK} — Deathtouch, lifelink {TK}{TK} — 5/1 {TK}{TK}{TK} — 3/5
- 絆魂(lifelink / Scryfallのみ) 《Hungry for More》: Create a 3/1 black and red Vampire creature token with trample, lifelink, and haste. Sacrifice it at the beginning of the next end step. Flashback {1}{B}{R} (You may cast this c...
- 絆魂(lifelink / Scryfallのみ) 《Mystic Doom Sandwich》: {TK}{TK} — Lifelink {TK}{TK}{TK} — This creature must be blocked if able. Whenever this creature becomes blocked, it gets +1/+1 until end of turn for each creature blocking it....
- 絆魂(lifelink / Scryfallのみ) 《Odric, Blood-Cursed》: When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelin...
- 絆魂(lifelink / Scryfallのみ) 《Reluctant Role Model》: Survival — At the beginning of your second main phase, if this creature is tapped, put a flying, lifelink, or +1/+1 counter on it. Whenever this creature or another creature you...
- 絆魂(lifelink / Scryfallのみ) 《Zur, Eternal Schemer》: Flying Enchantment creatures you control have deathtouch, lifelink, and hexproof. {1}{W}: Target non-Aura enchantment you control becomes a creature in addition to its other typ...
- トランプル(trample / Scryfallのみ) 《Commander Mustard》: Vigilance Other Soldiers you control have vigilance, trample, and haste. {2}{R}{W}: Until end of turn, Soldiers you control gain "Whenever this creature attacks, it deals 1 dama...
- トランプル(trample / Scryfallのみ) 《Elbrus, the Binding Blade // Withengar Unbound》: Equipped creature gets +1/+0. When equipped creature deals combat damage to a player, unattach Elbrus, then transform it. Equip {1} / Flying, intimidate, trample (A creature wit...
- トランプル(trample / Scryfallのみ) 《Jetpack Death Seltzer》: {TK}{TK} — Trample {TK}{TK}{TK} — {3}: Monstrosity 3. (If this creature isn't monstrous, put three +1/+1 counters on it and it becomes monstrous.) {TK}{TK}{TK} — 2/7 {TK}{TK}{TK...
- トランプル(trample / Scryfallのみ) 《Odric, Blood-Cursed》: When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelin...
- トランプル(trample / Scryfallのみ) 《Ozai, the Phoenix King》: Trample, firebending 4, haste If you would lose unspent mana, that mana becomes red instead. Ozai has flying and indestructible as long as you have six or more unspent mana.
- トランプル(trample / Scryfallのみ) 《Super State》: Enchant creature you control Enchanted creature has base power and toughness 9/9 and has flying, first strike, trample, and haste. Whenever enchanted creature deals combat damag...
- トランプル(trample / Scryfallのみ) 《The Coming of Galactus》: (As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) I — Destroy up to one target nonland permanent. II, III — Each opponent loses 2 life. IV...
- 警戒(vigilance / Scryfallのみ) 《Aragorn, Company Leader》: Whenever the Ring tempts you, if you chose a creature other than Aragorn as your Ring-bearer, put your choice of a counter from among first strike, vigilance, deathtouch, and li...
- 警戒(vigilance / Scryfallのみ) 《Battle at the Helvault》: (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I, II — For each player, exile up to one target non-Saga, nonland permanent that player...
- 警戒(vigilance / Scryfallのみ) 《Blink》: (As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) I, III — Choose target creature. Its owner shuffles it into their library, then investiga...
- 警戒(vigilance / Scryfallのみ) 《Celebr-8000》: At the beginning of combat on your turn, roll two six-sided dice. For each result of 1, this creature gets +1/+1 until end of turn. For each other result, it gains the indicated...
- 警戒(vigilance / Scryfallのみ) 《Narrow-Minded Baloney Fireworks》: {TK}{TK} — Whenever this creature attacks, you gain 2 life. {TK}{TK}{TK} — Vigilance, reach {TK}{TK} — 2/4 {TK}{TK}{TK}{TK}{TK} — 7/7
- 警戒(vigilance / Scryfallのみ) 《Spooky Clown Mox》: {TK}{TK} — Vigilance {TK}{TK}{TK}{TK} — {1}, {T}: Tap target creature. {TK}{TK} — 1/5 {TK}{TK}{TK} — 5/4

## 写像失敗 上位20

- なし

