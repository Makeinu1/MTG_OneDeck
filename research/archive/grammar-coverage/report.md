# 文法カバレッジ分析 Phase G0 レポート

**この数値は未調整(候補分布であり絶対正解でない)。probe は人間裁定用の広網候補。**

Baleful Strix などの draw は誘発タグの draw 除外規則とは別に、効果アトムとして数える。

## 1. 総数

- 生成日時: 2026-06-21T11:04:16.469Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- raw: 17491
- 写像成功: 17491
- 写像失敗: 0
- 能力行数: 36116
- 効果保有行数: 22632
- アトム出現数: 31802

## 2. 能力タイプ分布

| shape | label | card count | line count |
|---|---:|---:|---:|
| activated | 起動型 | 4027 | 5103 |
| triggered | 誘発型 | 7762 | 8972 |
| delayed-triggered | 遅延誘発型 | 96 | 97 |
| replacement | 置換 | 806 | 825 |
| static | 常在型 | 5484 | 7561 |
| spell | 呪文本体 | 3721 | 5384 |
| keyword | 純キーワード | 6951 | 8174 |

## 3. 効果アトム頻度ランキング

| atom | label | card count | line count |
|---|---:|---:|---:|
| effect.create-token | トークンを生成する | 2607 | 2764 |
| effect.pump | 修整する | 2506 | 2591 |
| effect.draw | カードを引く | 2452 | 2564 |
| effect.damage | ダメージを与える | 2316 | 2457 |
| effect.counter-plus | カウンターを置く | 1876 | 2093 |
| effect.tap | タップする | 1768 | 1827 |
| effect.exile | 追放する | 1660 | 1956 |
| effect.add-mana | マナを加える | 1458 | 1662 |
| effect.return | 戻す | 1452 | 1505 |
| effect.grant-keyword | キーワードを得る | 1294 | 1338 |
| effect.gain-life | ライフを得る | 1026 | 1060 |
| effect.destroy | 破壊する | 872 | 921 |
| effect.restriction | 禁止する | 870 | 917 |
| effect.sacrifice | 生け贄に捧げる | 863 | 926 |
| effect.discard | 捨てる | 744 | 784 |
| effect.lose-life | ライフを失う | 695 | 731 |
| effect.put-onto-battlefield | 戦場に出す | 689 | 695 |
| effect.reveal | 公開する | 669 | 681 |
| effect.search | 探す | 614 | 622 |
| effect.untap | アンタップする | 575 | 612 |
| effect.copy | コピーする | 555 | 583 |
| effect.mill | 切削する | 385 | 397 |
| effect.treasure | 宝物 | 325 | 344 |
| effect.scry | 占術を行う | 292 | 305 |
| effect.attach | つける | 271 | 283 |
| effect.counter-spell | 呪文を打ち消す | 233 | 236 |
| effect.transform | 変身する | 224 | 282 |
| effect.surveil | 諜報を行う | 198 | 198 |
| effect.gain-control | コントロールを得る | 163 | 168 |
| effect.energy | エネルギー・カウンター | 93 | 127 |
| effect.loyalty | 忠誠度 | 52 | 57 |
| effect.poison | 毒カウンター | 49 | 49 |
| effect.extra-turn | 追加ターン | 39 | 39 |
| effect.experience | 経験カウンター | 15 | 28 |

## 4. 累積カバレッジ曲線

効果保有行を母数に、アトムをカード数降順で並べた上位 K による未調整カバレッジ。

| K | atom count | カバー行数 | カバー行率 | アトム出現カバー数 | アトム出現カバー率 | 自動化可能フロンティア行数 | 自動化可能フロンティア |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | 5 | 7486 | 33.08% | 12469 | 39.21% | 5625 | 24.85% |
| 10 | 10 | 13552 | 59.88% | 20757 | 65.27% | 9584 | 42.35% |
| 15 | 15 | 17166 | 75.85% | 25365 | 79.76% | 11889 | 52.53% |
| 20 | 20 | 19634 | 86.75% | 28706 | 90.26% | 13760 | 60.80% |
| all | 34 | 22632 | 100.00% | 31802 | 100.00% | 15706 | 69.40% |

## 5. 構文分布

| construct | label | effect line count | effect line rate |
|---|---:|---:|---:|
| construct.target | 対象 | 6403 | 28.29% |
| construct.you-control | あなたがコントロール | 4593 | 20.29% |
| construct.may | 任意 | 2523 | 11.15% |
| construct.choose-modal | モード選択 | 1241 | 5.48% |
| construct.variable-x | X変数 | 1150 | 5.08% |
| construct.each-player | 各プレイヤー/対戦相手 | 1090 | 4.82% |
| construct.for-each | 数え上げ | 911 | 4.03% |
| construct.intervening-if | if節つき誘発 | 785 | 3.47% |

## 6. 裁定候補

効果候補行だが既知アトムを1つも検出できなかった行。語彙の取りこぼし発見用。

- activated / face 0 / 《Academy Ruins》: {1}{U}, {T}: Put target artifact card from your graveyard on top of your library.
- activated / face 0 / 《Accursed Duneyard》: {2}, {T}: Regenerate target Shade, Skeleton, Specter, Spirit, Vampire, Wraith, or Zombie.
- activated / face 0 / 《Adric, Mathematical Genius》: Ultimate Sacrifice — {1}{U}, Sacrifice Adric: Counter target activated or triggered ability.
- activated / face 0 / 《Advanced Reconstruction》: {1}{R}: Level 2
- activated / face 0 / 《Advanced Reconstruction》: {1}{R}: Level 3
- activated / face 0 / 《Aetheric Amplifier》: {4}, {T}: Choose one. Activate only as a sorcery.
- activated / face 0 / 《Aetherworks Marvel》: {T}, Pay six {E}: Look at the top six cards of your library. You may cast a spell from among them without paying its mana cost. Put the rest on the bottom of your library in a r...
- activated / face 0 / 《Alchemist's Assistant》: Renew — {1}{B}, Exile this card from your graveyard: Put a lifelink counter on target creature. Activate only as a sorcery.
- activated / face 0 / 《Alchemist's Refuge》: {G}{U}, {T}: You may cast spells this turn as though they had flash.
- activated / face 0 / 《Alchemist's Talent》: {1}{R}: Level 2
- activated / face 0 / 《Alchemist's Talent》: {4}{R}: Level 3
- activated / face 0 / 《Allosaurus Shepherd》: {4}{G}{G}: Until end of turn, each Elf creature you control has base power and toughness 5/5 and becomes a Dinosaur in addition to its other creature types.
- activated / face 0 / 《Alloy Animist》: {2}{G}: Until end of turn, target noncreature artifact you control becomes a 4/4 artifact creature.
- activated / face 0 / 《Alpha Deathclaw》: {5}{B}{G}: Monstrosity 4.
- activated / face 0 / 《Amoeboid Changeling》: {T}: Target creature gains all creature types until end of turn.
- activated / face 0 / 《Amoeboid Changeling》: {T}: Target creature loses all creature types until end of turn.
- activated / face 0 / 《Ancient Silverback》: {G}: Regenerate this creature.
- activated / face 0 / 《Anzrag, the Quake-Mole》: {3}{R}{R}{G}{G}: Anzrag must be blocked each combat this turn if able.
- activated / face 0 / 《Aquamoeba》: Discard a card: Switch this creature's power and toughness until end of turn.
- activated / face 0 / 《Arcade Cabinet》: {2}, {T}, Sacrifice a token: Double the number of each kind of counter on target creature.

## 7. 写像失敗 top-N

- なし

