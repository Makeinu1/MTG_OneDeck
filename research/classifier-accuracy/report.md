# 分類精度ハーネス A0 レポート

**この数値は未調整(Scryfall keywords は候補集合であり絶対正解でない)。**

- 生成日時: 2026-06-21T10:10:07.704Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- 総 raw カード数: 17491
- CardDef 写像成功: 17491
- CardDef 写像失敗: 0
- キーワード FP候補(分類器のみ): 2
- キーワード FN候補(Scryfall のみ): 67
- 誘発ファミリー FP候補(タグ有り/probe疑わしい): 0
- 誘発ファミリー FN候補(probe一致/タグ無し): 5912

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
| trigger.end-step | エンドステップ開始時の誘発 | 447 |
| trigger.draw | カードを引いたときの誘発 | 115 |
| trigger.sacrifice | 生け贄に捧げたときの誘発 | 96 |
| trigger.combat-damage | 戦闘ダメージを与えたときの誘発 | 569 |
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

## 誘発ファミリー候補(裁定対象)

**この数値は未調整(Scryfall keywords は候補集合であり絶対正解でない)。 誘発probeは判定ではなく、人間が見るための広網候補リスト。**

| family | tag | label | classifier | probe | FP候補 | FN候補 |
|---|---|---:|---:|---:|---:|---:|
| end-step | trigger.end-step | エンドステップ開始時の誘発 | 447 | 824 | 0 | 377 |
| draw | trigger.draw | カードを引いたときの誘発 | 115 | 2976 | 0 | 2861 |
| sacrifice | trigger.sacrifice | 生け贄に捧げたときの誘発 | 96 | 2440 | 0 | 2344 |
| combat-damage | trigger.combat-damage | 戦闘ダメージを与えたときの誘発 | 569 | 899 | 0 | 330 |

### FN候補 上位20/ファミリー(probe一致・タグ無し)

#### エンドステップ開始時の誘発 (trigger.end-step)

- 未調整 / probe一致/タグ無し 《Abuelo, Ancestral Echo》: Flying, ward {2} {1}{W}{U}: Exile another target creature or artifact you control. Return it to the battlefield under its owner's control at the beginning of the next end step.
- 未調整 / probe一致/タグ無し 《Aethermage's Touch》: Reveal the top four cards of your library. You may put a creature card from among them onto the battlefield. It gains "At the beginning of your end step, return this creature to...
- 未調整 / probe一致/タグ無し 《Ajani, Adversary of Tyrants》: +1: Put a +1/+1 counter on each of up to two target creatures. −2: Return target creature card with mana value 2 or less from your graveyard to the battlefield. −7: You get an e...
- 未調整 / probe一致/タグ無し 《All-Fates Stalker》: When this creature enters, exile up to one target non-Assassin creature until this creature leaves the battlefield. Warp {1}{W} (You may cast this card from your hand for its wa...
- 未調整 / probe一致/タグ無し 《Alora, Merry Thief》: Whenever you attack, up to one target attacking creature can't be blocked this turn. Return that creature to its owner's hand at the beginning of the next end step. Choose a Bac...
- 未調整 / probe一致/タグ無し 《Amphin Mutineer》: When this creature enters, exile up to one target non-Salamander creature. That creature's controller creates a 4/3 blue Salamander Warrior creature token. Encore {4}{U}{U} ({4}...
- 未調整 / probe一致/タグ無し 《Angel of Indemnity》: Flying, lifelink When this creature enters, return target permanent card with mana value 4 or less from your graveyard to the battlefield. Encore {6}{W}{W} ({6}{W}{W}, Exile thi...
- 未調整 / probe一致/タグ無し 《Angelic Favor》: If you control a Plains, you may tap an untapped creature you control rather than pay this spell's mana cost. Cast this spell only during combat. Create a 4/4 white Angel creatu...
- 未調整 / probe一致/タグ無し 《Angrath, the Flame-Chained》: +1: Each opponent discards a card and loses 2 life. −3: Gain control of target creature until end of turn. Untap it. It gains haste until end of turn. Sacrifice it at the beginn...
- 未調整 / probe一致/タグ無し 《Anticausal Vestige》: When this creature leaves the battlefield, draw a card, then you may put a permanent card with mana value less than or equal to the number of lands you control from your hand on...
- 未調整 / probe一致/タグ無し 《Anzrag's Rampage》: Destroy all artifacts you don't control, then exile the top X cards of your library, where X is the number of artifacts that were put into graveyards from the battlefield this t...
- 未調整 / probe一致/タグ無し 《Apple of Eden, Isu Relic》: {T}, Pay 4 life, Sacrifice Apple of Eden: Look at target opponent's hand and exile those cards face down. You may play those cards this turn, and mana of any type can be spent t...
- 未調整 / probe一致/タグ無し 《Apprentice Necromancer》: {B}, {T}, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. That creature gains haste. At the beginning of the next end step, sacrific...
- 未調整 / probe一致/タグ無し 《Archfiend of Sorrows》: Flying When this creature enters, creatures your opponents control get -2/-2 until end of turn. Unearth {3}{B}{B} ({3}{B}{B}: Return this card from your graveyard to the battlef...
- 未調整 / probe一致/タグ無し 《Arms Race》: {3}{R}: You may put an artifact card from your hand onto the battlefield. That artifact gains haste. Sacrifice it at the beginning of the next end step.
- 未調整 / probe一致/タグ無し 《Artificer's Dragon》: Flying {R}: Artifact creatures you control get +1/+0 until end of turn. Unearth {3}{R}{R} ({3}{R}{R}: Return this card from your graveyard to the battlefield. It gains haste. Ex...
- 未調整 / probe一致/タグ無し 《Ashling, the Limitless》: Elemental permanent spells you cast from your hand gain evoke {4} as you cast them. (If you cast a spell for its evoke cost, it's sacrificed when it enters.) Whenever you sacrif...
- 未調整 / probe一致/タグ無し 《Ashnod's Harvester》: Whenever this creature attacks, exile target card from a graveyard. Unearth {1}{B} ({1}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at...
- 未調整 / probe一致/タグ無し 《Attack-in-the-Box》: Whenever this creature attacks, you may have it get +4/+0 until end of turn. If you do, sacrifice it at the beginning of the next end step.
- 未調整 / probe一致/タグ無し 《Avenger of the Fallen》: Deathtouch Mobilize X, where X is the number of creature cards in your graveyard. (Whenever this creature attacks, create X tapped and attacking 1/1 red Warrior creature tokens....

#### カードを引いたときの誘発 (trigger.draw)

- 未調整 / probe一致/タグ無し 《A.I.M. Scientists》: When this creature enters, it connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.) Basic landcycling {2} ({2}, Di...
- 未調整 / probe一致/タグ無し 《Aang's Defense》: Target blocking creature you control gets +2/+2 until end of turn. Draw a card.
- 未調整 / probe一致/タグ無し 《Abandon Attachments》: You may discard a card. If you do, draw two cards.
- 未調整 / probe一致/タグ無し 《Aberrant》: Ravenous (This creature enters with X +1/+1 counters on it. If X is 5 or more, draw a card when it enters.) Trample Heavy Power Hammer — Whenever this creature deals combat dama...
- 未調整 / probe一致/タグ無し 《Abundance》: If you would draw a card, you may instead choose land or nonland and reveal cards from the top of your library until you reveal a card of the chosen kind. Put that card into you...
- 未調整 / probe一致/タグ無し 《Abundant Growth》: Enchant land When this Aura enters, draw a card. Enchanted land has "{T}: Add one mana of any color."
- 未調整 / probe一致/タグ無し 《Abzan Beastmaster》: At the beginning of your upkeep, draw a card if you control the creature with the greatest toughness or tied for the greatest toughness.
- 未調整 / probe一致/タグ無し 《Abzan Charm》: Choose one — • Exile target creature with power 3 or greater. • You draw two cards and you lose 2 life. • Distribute two +1/+1 counters among one or two target creatures.
- 未調整 / probe一致/タグ無し 《Academy Loremaster》: At the beginning of each player's draw step, that player may draw an additional card. If they do, spells they cast this turn cost {2} more to cast.
- 未調整 / probe一致/タグ無し 《Academy Wall》: Defender Whenever you cast an instant or sorcery spell, you may draw a card. If you do, discard a card. This ability triggers only once each turn.
- 未調整 / probe一致/タグ無し 《Accumulated Knowledge》: Draw a card, then draw cards equal to the number of cards named Accumulated Knowledge in all graveyards.
- 未調整 / probe一致/タグ無し 《Aclazotz, Deepest Betrayal // Temple of the Dead》: Flying, lifelink Whenever Aclazotz attacks, each opponent discards a card. For each opponent who can't, you draw a card. Whenever an opponent discards a land card, create a 1/1...
- 未調整 / probe一致/タグ無し 《Acolyte Hybrid》: Heavy Rock Cutter — Whenever this creature attacks, destroy up to one target artifact. If an artifact is destroyed this way, its controller draws a card.
- 未調整 / probe一致/タグ無し 《Acquisition Octopus》: Whenever this creature or equipped creature deals combat damage to a player, draw a card. Reconfigure {2} ({2}: Attach to target creature you control; or unattach from a creatur...
- 未調整 / probe一致/タグ無し 《Acrobatic Maneuver》: Exile target creature you control, then return that card to the battlefield under its owner's control. Draw a card.
- 未調整 / probe一致/タグ無し 《Action News Crew》: Vigilance Channel — {6}, Discard this card: Put a +1/+1 counter on each creature you control. Draw a card.
- 未調整 / probe一致/タグ無し 《Adrestia》: Islandwalk (This creature can't be blocked as long as defending player controls an Island.) Whenever Adrestia attacks, if an Assassin crewed it this turn, draw a card. Adrestia...
- 未調整 / probe一致/タグ無し 《Advancing the Spirit》: When this enchantment enters, draw a card. You may pay {0} rather than pay the power-up cost of the first power-up ability you activate during each of your turns.
- 未調整 / probe一致/タグ無し 《Adventure Awaits》: Look at the top five cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random orde...
- 未調整 / probe一致/タグ無し 《Adventurer's Airship》: Flying Whenever this Vehicle attacks, draw a card, then discard a card. Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artif...

#### 生け贄に捧げたときの誘発 (trigger.sacrifice)

- 未調整 / probe一致/タグ無し 《A Killer Among Us》: When this enchantment enters, create a 1/1 white Human creature token, a 1/1 blue Merfolk creature token, and a 1/1 red Goblin creature token. Then secretly choose Human, Merfol...
- 未調整 / probe一致/タグ無し 《A Little Chat》: Casualty 1 (As you cast this spell, you may sacrifice a creature with power 1 or greater. When you do, copy this spell.) Look at the top two cards of your library. Put one of th...
- 未調整 / probe一致/タグ無し 《Aang's Iceberg》: Flash When this enchantment enters, exile up to one other target nonland permanent until this enchantment leaves the battlefield. Waterbend {3}: Sacrifice this enchantment. If y...
- 未調整 / probe一致/タグ無し 《Abyssal Gorestalker》: When this creature enters, each player sacrifices two creatures of their choice.
- 未調整 / probe一致/タグ無し 《Abzan Monument》: When this artifact enters, search your library for a basic Plains, Swamp, or Forest card, reveal it, put it into your hand, then shuffle. {1}{W}{B}{G}, {T}, Sacrifice this artif...
- 未調整 / probe一致/タグ無し 《Accursed Marauder》: When this creature enters, each player sacrifices a nontoken creature of their choice.
- 未調整 / probe一致/タグ無し 《Ace, Fearless Rebel》: Nitro-9 — Whenever Ace attacks, you may sacrifice an artifact. When you do, put a +1/+1 counter on Ace, then it fights up to one target creature defending player controls. Docto...
- 未調整 / probe一致/タグ無し 《Acererak the Archlich》: When Acererak enters, if you haven't completed Tomb of Annihilation, return Acererak to its owner's hand and venture into the dungeon. Whenever Acererak attacks, for each oppone...
- 未調整 / probe一致/タグ無し 《Acolyte of Aclazotz》: {T}, Sacrifice another creature or artifact: Each opponent loses 1 life and you gain 1 life.
- 未調整 / probe一致/タグ無し 《Adric, Mathematical Genius》: {2}{U}, {T}: Copy target activated or triggered ability you control. You may choose new targets for the copy. Ultimate Sacrifice — {1}{U}, Sacrifice Adric: Counter target activa...
- 未調整 / probe一致/タグ無し 《Aether Spellbomb》: {U}, Sacrifice this artifact: Return target creature to its owner's hand. {1}, Sacrifice this artifact: Draw a card.
- 未調整 / probe一致/タグ無し 《Aetherjacket》: Flying, vigilance {2}, {T}, Sacrifice this creature: Destroy another target artifact. Activate only as a sorcery.
- 未調整 / probe一致/タグ無し 《Aftermath Analyst》: When this creature enters, mill three cards. (Put the top three cards of your library into your graveyard.) {3}{G}, Sacrifice this creature: Return all land cards from your grav...
- 未調整 / probe一致/タグ無し 《Agatha's Champion》: Bargain (You may sacrifice an artifact, enchantment, or token as you cast this spell.) Trample When this creature enters, if it was bargained, it fights up to one target creatur...
- 未調整 / probe一致/タグ無し 《Age of Ultron》: (As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) I — For each opponent, destroy up to one target nonartifact creature that player control...
- 未調整 / probe一致/タグ無し 《Agency Coroner》: {2}{B}, Sacrifice another creature: Draw a card. If the sacrificed creature was suspected, draw two cards instead.
- 未調整 / probe一致/タグ無し 《Agent 13, Sharon Carter》: Whenever a creature you control attacks alone, investigate. (Create a Clue token. It's an artifact with "{2}, Sacrifice this token: Draw a card.")
- 未調整 / probe一致/タグ無し 《Agent's Toolkit》: This artifact enters with a +1/+1 counter, a flying counter, a deathtouch counter, and a shield counter on it. (If it would be dealt damage or destroyed, remove a shield counter...
- 未調整 / probe一致/タグ無し 《Aggressive Mining》: You can't play lands. Sacrifice a land: Draw two cards. Activate only once each turn.
- 未調整 / probe一致/タグ無し 《Ahriman》: Flying, deathtouch {3}, Sacrifice another creature or artifact: Draw a card.

#### 戦闘ダメージを与えたときの誘発 (trigger.combat-damage)

- 未調整 / probe一致/タグ無し 《Abandon Reason》: Up to two target creatures each get +1/+0 and gain first strike until end of turn. (They deal combat damage before creatures without first strike.) Madness {1}{R} (If you discar...
- 未調整 / probe一致/タグ無し 《Achilles Davenport》: Freerunning {U}{B} (You may cast this spell for its freerunning cost if you dealt combat damage to a player this turn with an Assassin or commander.) Menace (This creature can't...
- 未調整 / probe一致/タグ無し 《Admiral Beckett Brass》: Other Pirates you control get +1/+1. At the beginning of your end step, gain control of target nonland permanent controlled by a player who was dealt combat damage by three or m...
- 未調整 / probe一致/タグ無し 《Aggressive Mammoth》: Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.) Other creatures you control have trample.
- 未調整 / probe一致/タグ無し 《Ancient Lumberknot》: Each creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.
- 未調整 / probe一致/タグ無し 《Annex Sentry》: Toxic 1 (Players dealt combat damage by this creature also get a poison counter.) When this creature enters, exile target artifact or creature an opponent controls with mana val...
- 未調整 / probe一致/タグ無し 《Arachnogenesis》: Create X 1/2 green Spider creature tokens with reach, where X is the number of creatures attacking you. Prevent all combat damage that would be dealt this turn by non-Spider cre...
- 未調整 / probe一致/タグ無し 《Arcades, the Strategist》: Flying, vigilance Whenever a creature you control with defender enters, draw a card. Each creature you control with defender assigns combat damage equal to its toughness rather...
- 未調整 / probe一致/タグ無し 《Arcane Heist》: You may cast target instant or sorcery card from an opponent's graveyard without paying its mana cost. If that spell would be put into their graveyard, exile it instead. Cipher...
- 未調整 / probe一致/タグ無し 《Archon of Coronation》: Flying When this creature enters, you become the monarch. As long as you're the monarch, damage doesn't cause you to lose life. (When a creature deals combat damage to you, its...
- 未調整 / probe一致/タグ無し 《Aspirant's Ascent》: Until end of turn, target creature gets +1/+3 and gains flying and toxic 1. (Players dealt combat damage by that creature also get a poison counter.)
- 未調整 / probe一致/タグ無し 《Assassin Gauntlet》: When this Equipment enters, attach it to up to one target creature you control. Tap all creatures target opponent controls. Equipped creature gets +1/+1 and has "Whenever this c...
- 未調整 / probe一致/タグ無し 《Assault Formation》: Each creature you control assigns combat damage equal to its toughness rather than its power. {G}: Target creature with defender can attack this turn as though it didn't have de...
- 未調整 / probe一致/タグ無し 《Audacity》: Enchant creature Enchanted creature gets +2/+0 and has trample. (It can deal excess combat damage to the player or planeswalker it's attacking.) When this Aura is put into a gra...
- 未調整 / probe一致/タグ無し 《Baldin, Century Herdmaster》: During your turn, each creature assigns combat damage equal to its toughness rather than its power. Whenever Baldin attacks, up to one hundred target creatures each get +0/+X un...
- 未調整 / probe一致/タグ無し 《Ball Lightning》: Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.) Haste (This creature can attack and {T} as soon as it comes under your contro...
- 未調整 / probe一致/タグ無し 《Baloth Woodcrasher》: Landfall — Whenever a land you control enters, this creature gets +4/+4 and gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's...
- 未調整 / probe一致/タグ無し 《Bark of Doran》: Equipped creature gets +0/+1. As long as equipped creature's toughness is greater than its power, it assigns combat damage equal to its toughness rather than its power. Equip {1...
- 未調整 / probe一致/タグ無し 《Basilica Shepherd》: Flying When this creature enters, create two 1/1 colorless Phyrexian Mite artifact creature tokens with toxic 1 and "This token can't block." (Players dealt combat damage by the...
- 未調整 / probe一致/タグ無し 《Battlefield Promotion》: Put a +1/+1 counter on target creature. That creature gains first strike until end of turn. You gain 2 life. (A creature with first strike deals combat damage before creatures w...

### FP候補 上位20/ファミリー(タグ有り・probe疑わしい)

#### エンドステップ開始時の誘発 (trigger.end-step)

- なし

#### カードを引いたときの誘発 (trigger.draw)

- なし

#### 生け贄に捧げたときの誘発 (trigger.sacrifice)

- なし

#### 戦闘ダメージを与えたときの誘発 (trigger.combat-damage)

- なし

## 写像失敗 上位20

- なし

