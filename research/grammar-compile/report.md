# 文法コンパイル分析 Phase G2 レポート

**この数値は未調整(候補分布であり絶対正解でない)。G2 は G1 full 行のうち安全に自動実行できる候補分布。**

## 1. 総数

- 生成日時: 2026-06-21T15:03:20.716Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- raw: 17491
- 写像成功: 17491
- 写像失敗: 0
- 能力行数: 36116
- 効果保有行数: 22507
- G1 full 行数: 13078
- G2 auto full 行数: 1854
- アトム出現数: 31831

### 写像失敗 top-N

- なし

## 2. executable frontier

G1 IR 表現フロンティア sanity anchor: full/effect line rate 58.11%。

| shape | label | line count | G1 full | G2 auto | G2 manual | auto/full rate |
|---|---:|---:|---:|---:|---:|---:|
| overall | 全体 | 36116 | 13078 | 1854 | 11224 | 14.18% |
| activated | 起動型 | 5103 | 2674 | 900 | 1774 | 33.66% |
| triggered | 誘発型 | 8972 | 4888 | 670 | 4218 | 13.71% |
| delayed-triggered | 遅延誘発型 | 97 | 49 | 0 | 49 | 0.00% |
| replacement | 置換 | 825 | 471 | 14 | 457 | 2.97% |
| static | 常在型 | 7561 | 3549 | 49 | 3500 | 1.38% |
| spell | 呪文本体 | 5384 | 1354 | 219 | 1135 | 16.17% |
| keyword | 純キーワード | 8174 | 93 | 2 | 91 | 2.15% |

## 3. atom 別内訳

| atom | occurrence count | auto full lines | manual full lines |
|---|---:|---:|---:|
| effect.create-token | 2802 | 149 | 1853 |
| effect.pump | 2622 | 0 | 1761 |
| effect.draw | 2499 | 741 | 1086 |
| effect.exile | 2209 | 0 | 657 |
| effect.counter-plus | 2086 | 0 | 1209 |
| effect.damage | 1978 | 0 | 720 |
| effect.tap | 1758 | 0 | 974 |
| effect.add-mana | 1676 | 683 | 737 |
| effect.return | 1541 | 0 | 483 |
| effect.grant-keyword | 1353 | 0 | 528 |
| effect.gain-life | 990 | 218 | 447 |
| effect.destroy | 956 | 0 | 141 |
| effect.restriction | 923 | 0 | 646 |
| effect.sacrifice | 883 | 0 | 535 |
| effect.discard | 782 | 0 | 499 |
| effect.reveal | 764 | 0 | 128 |
| effect.copy | 752 | 0 | 249 |
| effect.put-onto-battlefield | 724 | 0 | 204 |
| effect.lose-life | 721 | 72 | 391 |
| effect.search | 658 | 0 | 37 |

### reasons 分布

| reason | full line count | full line rate |
|---|---:|---:|
| needs-target | 7478 | 57.18% |
| needs-parse | 4896 | 37.44% |
| variable-count | 1427 | 10.91% |
| needs-choice | 1018 | 7.78% |
| optional | 938 | 7.17% |
| ambiguous-mana | 659 | 5.04% |
| no-command | 22 | 0.17% |

## 4. 自動実行候補 top-N

- activated / commands 2 / face 0 / 《Cryptbreaker》: Tap three untapped Zombies you control: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Faerie Dreamthief》: {2}{B}, Exile this card from your graveyard: You draw a card and you lose 1 life.
- activated / commands 2 / face 1 / 《Grasping Shadows // Shadows' Lair》: {B}, {T}, Remove a dread counter from this land: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Greta, Sweettooth Scourge》: {1}{B}, Sacrifice a Food: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Infernal Idol》: {1}{B}{B}, {T}, Sacrifice this artifact: You draw two cards and you lose 2 life.
- activated / commands 2 / face 0 / 《Izzet Generatorium》: {T}: Draw a card. Activate only if you've paid or lost four or more {E} this turn.
- activated / commands 2 / face 0 / 《Metalspinner's Puzzleknot》: {2}{B}, Sacrifice this artifact: You draw a card and you lose 1 life.
- activated / commands 2 / face 0 / 《Pristine Talisman》: {T}: Add {C}. You gain 1 life.
- activated / commands 2 / face 0 / 《Reckless Lackey》: {2}{R}, Sacrifice this creature: Draw a card and create a Treasure token.
- activated / commands 2 / face 0 / 《Reckoner Bankbuster》: {2}, {T}, Remove a charge counter from this Vehicle: Draw a card. Then if there are no charge counters on this Vehicle, create a Treasure token and a 1/1 colorless Pilot creatur...
- activated / commands 2 / face 0 / 《Redrock Sentinel》: {2}, {T}, Sacrifice a land: Draw a card and create a Treasure token.
- activated / commands 2 / face 0 / 《River of Tears》: {T}: Add {U}. If you played a land this turn, add {B} instead.
- activated / commands 2 / face 0 / 《Sarevok's Tome》: {T}: Add {C}. If you have the initiative, add {C}{C} instead.
- activated / commands 2 / face 0 / 《Scaled Nurturer》: {T}: Add {G}. When you spend this mana to cast a Dragon creature spell, you gain 2 life.
- activated / commands 2 / face 0 / 《The Great Henge》: {T}: Add {G}{G}. You gain 2 life.
- activated / commands 2 / face 0 / 《Undermountain Adventurer》: {T}: Add {G}{G}. If you've completed a dungeon, add six {G} instead.
- activated / commands 1 / face 0 / 《Abandoned Air Temple》: {T}: Add {W}.
- activated / commands 1 / face 0 / 《Abstergo Entertainment》: {T}: Add {C}.
- activated / commands 1 / face 0 / 《Abundant Countryside》: {T}: Add {C}.
- activated / commands 1 / face 0 / 《Academy Ruins》: {T}: Add {C}.

