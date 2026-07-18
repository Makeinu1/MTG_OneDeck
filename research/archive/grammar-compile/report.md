# 文法コンパイル分析 Phase G4 レポート

**この数値は未調整(候補分布であり絶対正解でない)。G4 では起動型コスト精算の候補分布を追加する。**

activation frontier=cost auto/起動型行、fully-playable=cost auto かつ effect decision が auto または guided の起動型行/起動型行。

## 1. 総数

- 生成日時: 2026-07-04T05:34:52.831Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- raw: 17491
- 写像成功: 17491
- 写像失敗: 0
- 能力行数: 34821
- 効果保有行数: 21896
- G1 full 行数: 13591
- auto effect 行数: 2024
- guided effect 行数: 1891
- 旧 full 基準 auto 行数: 1940
- アトム出現数: 32574

### 写像失敗 top-N

- なし

## 2. activation frontier

| metric | count | rate |
|---|---:|---:|
| activated lines | 5103 | 100.00% |
| activation frontier | 3885 | 76.13% |
| fully-playable | 1190 | 23.32% |
| manual cost | 1218 | 23.87% |

### cost 要素分布

| bucket | lines | rate |
|---|---:|---:|
| tap-only | 1602 | 31.39% |
| mana | 1057 | 20.71% |
| sac-self | 58 | 1.14% |
| compound | 1168 | 22.89% |
| manual | 1218 | 23.87% |

## 3. executable frontier

executable frontier=auto/effect 行、guided frontier=(auto+guided)/effect 行。旧 G2 full 基準 auto 14.18% とは分母が異なる。

| shape | label | ability lines | effect lines | G1 full | auto | guided | manual | executable rate | guided frontier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| overall | 全体 | 34821 | 21896 | 13591 | 2024 | 1891 | 17981 | 9.24% | 17.88% |
| activated | 起動型 | 5103 | 4532 | 2796 | 937 | 499 | 3096 | 20.68% | 31.69% |
| triggered | 誘発型 | 8969 | 8048 | 5085 | 786 | 668 | 6594 | 9.77% | 18.07% |
| delayed-triggered | 遅延誘発型 | 100 | 93 | 49 | 0 | 3 | 90 | 0.00% | 3.23% |
| replacement | 置換 | 824 | 592 | 471 | 0 | 5 | 587 | 0.00% | 0.84% |
| static | 常在型 | 7032 | 4444 | 3600 | 63 | 115 | 4266 | 1.42% | 4.01% |
| spell | 呪文本体 | 4619 | 4083 | 1497 | 236 | 601 | 3246 | 5.78% | 20.50% |
| keyword | 純キーワード | 8174 | 104 | 93 | 2 | 0 | 102 | 1.92% | 1.92% |

## 4. atom 別内訳

| atom | occurrence count | auto lines | guided lines | manual lines |
|---|---:|---:|---:|---:|
| effect.create-token | 2802 | 244 | 122 | 2371 |
| effect.pump | 2622 | 0 | 84 | 2501 |
| effect.draw | 2499 | 772 | 210 | 1471 |
| effect.exile | 2209 | 0 | 211 | 1687 |
| effect.counter-plus | 2086 | 0 | 264 | 1779 |
| effect.damage | 1978 | 0 | 95 | 1750 |
| effect.tap | 1758 | 0 | 172 | 1555 |
| effect.add-mana | 1676 | 713 | 206 | 743 |
| effect.return | 1541 | 0 | 152 | 1342 |
| effect.grant-keyword | 1353 | 0 | 72 | 1257 |
| effect.gain-life | 990 | 210 | 74 | 701 |
| effect.destroy | 956 | 0 | 402 | 480 |
| effect.restriction | 923 | 0 | 12 | 905 |
| effect.sacrifice | 883 | 14 | 37 | 778 |
| effect.discard | 782 | 0 | 130 | 594 |
| effect.reveal | 764 | 0 | 23 | 658 |
| effect.copy | 752 | 0 | 20 | 554 |
| effect.shuffle | 743 | 0 | 22 | 710 |
| effect.put-onto-battlefield | 724 | 0 | 19 | 674 |
| effect.lose-life | 721 | 74 | 46 | 593 |

### prompt.kind 分布

| kind | prompt count | guided line count |
|---|---:|---:|
| target | 834 | 814 |
| modal | 483 | 483 |
| scry-surveil | 307 | 307 |
| mana | 203 | 203 |
| discard | 91 | 91 |
| sacrifice | 6 | 6 |

### reasons 分布

| reason | effect line count | effect line rate |
|---|---:|---:|
| needs-target | 12839 | 58.64% |
| needs-parse | 9101 | 41.56% |
| optional | 2475 | 11.30% |
| variable-count | 2434 | 11.12% |
| needs-choice | 1747 | 7.98% |
| no-command | 552 | 2.52% |
| ambiguous-mana | 343 | 1.57% |

## 5. 自動実行候補 top-N

- activated / commands 5 / face 0 / 《Crystal Quarry》: {5}, {T}: Add {W}{U}{B}{R}{G}.
- activated / commands 5 / face 0 / 《Jenson Carthalion, Druid Exile》: {5}, {T}: Add {W}{U}{B}{R}{G}.
- activated / commands 5 / face 0 / 《Timeless Lotus》: {T}: Add {W}{U}{B}{R}{G}.
- activated / commands 2 / face 0 / 《Arixmethes, Slumbering Isle》: {T}: Add {G}{U}.
- activated / commands 2 / face 0 / 《Azorius Chancery》: {T}: Add {W}{U}.
- activated / commands 2 / face 0 / 《Azorius Signet》: {1}, {T}: Add {W}{U}.
- activated / commands 2 / face 0 / 《Boros Garrison》: {T}: Add {R}{W}.
- activated / commands 2 / face 0 / 《Boros Signet》: {1}, {T}: Add {R}{W}.
- activated / commands 2 / face 0 / 《Cirith Ungol Patrol》: {1}, {T}, Sacrifice another creature: Draw a card, then create a Food token.
- activated / commands 2 / face 0 / 《Cryptbreaker》: Tap three untapped Zombies you control: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Darkwater Catacombs》: {1}, {T}: Add {U}{B}.
- activated / commands 2 / face 0 / 《Desolate Mire》: {1}, {T}: Add {W}{B}.
- activated / commands 2 / face 0 / 《Dimir Aqueduct》: {T}: Add {U}{B}.
- activated / commands 2 / face 0 / 《Dimir Signet》: {1}, {T}: Add {U}{B}.
- activated / commands 2 / face 0 / 《Faerie Dreamthief》: {2}{B}, Exile this card from your graveyard: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Ferrous Lake》: {1}, {T}: Add {U}{R}.
- activated / commands 2 / face 0 / 《Golgari Rot Farm》: {T}: Add {B}{G}.
- activated / commands 2 / face 0 / 《Golgari Signet》: {1}, {T}: Add {B}{G}.
- activated / commands 2 / face 1 / 《Grasping Shadows // Shadows' Lair》: {B}, {T}, Remove a dread counter from this land: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Greta, Sweettooth Scourge》: {1}{B}, Sacrifice a Food: You draw a card and you lose 1 life.

## 6. 誘導候補 top-N

- activated / commands 2 / face 0 / 《Collector's Vault》: {2}, {T}: Draw a card, then discard a card. Create a Treasure token.
- activated / commands 2 / face 0 / 《Daily Bugle Newspaper》: {2}, {T}: Draw a card, then discard a card. Create a Treasure token.
- activated / commands 2 / face 0 / 《Izoni, Center of the Web》: Sacrifice four tokens: Surveil 2, then draw two cards. You gain 2 life.
- activated / commands 1 / face 0 / 《Agna Qel'a》: {2}{U}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Arcade Gannon》: {T}: Draw a card, then discard a card. Put a quest counter on Arcade Gannon.
- activated / commands 1 / face 0 / 《Bag of Holding》: {2}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Captain of Umbar》: {1}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Chromatic Sphere》: {1}, {T}, Sacrifice this artifact: Add one mana of any color. Draw a card.
- activated / commands 1 / face 0 / 《Currency Converter》: {2}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Desolate Lighthouse》: {1}{U}{R}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Dragonborn Looter》: {1}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Erratic Visionary》: {1}{U}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Found Footage》: {2}, Sacrifice this artifact: Surveil 2, then draw a card.
- activated / commands 1 / face 0 / 《Furtive Analyst》: {2}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Geyser Leaper》: Waterbend {4}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Harrier Strix》: {2}{U}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Improbable Alliance》: {4}{U}{R}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Jalum Tome》: {2}, {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Kitsa, Otterball Elite》: {T}: Draw a card, then discard a card.
- activated / commands 1 / face 0 / 《Likeness Looter》: {T}: Draw a card, then discard a card.

