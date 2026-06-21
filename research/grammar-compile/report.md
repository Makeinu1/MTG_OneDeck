# 文法コンパイル分析 Phase G3 レポート

**この数値は未調整(候補分布であり絶対正解でない)。G3 では分母を full→effect 行へ変更して再ベースラインする。**

## 1. 総数

- 生成日時: 2026-06-21T15:48:31.004Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- raw: 17491
- 写像成功: 17491
- 写像失敗: 0
- 能力行数: 34821
- 効果保有行数: 21855
- G1 full 行数: 13081
- auto effect 行数: 2013
- guided effect 行数: 1566
- 旧 full 基準 auto 行数: 1854
- アトム出現数: 31831

### 写像失敗 top-N

- なし

## 2. executable frontier

executable frontier=auto/effect 行、guided frontier=(auto+guided)/effect 行。旧 G2 full 基準 auto 14.18% とは分母が異なる。

| shape | label | ability lines | effect lines | G1 full | auto | guided | manual | executable rate | guided frontier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| overall | 全体 | 34821 | 21855 | 13081 | 2013 | 1566 | 18276 | 9.21% | 16.38% |
| activated | 起動型 | 5103 | 4521 | 2674 | 980 | 279 | 3262 | 21.68% | 27.85% |
| triggered | 誘発型 | 8969 | 8033 | 4890 | 728 | 572 | 6733 | 9.06% | 16.18% |
| delayed-triggered | 遅延誘発型 | 100 | 93 | 49 | 0 | 3 | 90 | 0.00% | 3.23% |
| replacement | 置換 | 824 | 592 | 471 | 14 | 6 | 572 | 2.36% | 3.38% |
| static | 常在型 | 7032 | 4440 | 3549 | 56 | 97 | 4287 | 1.26% | 3.45% |
| spell | 呪文本体 | 4619 | 4072 | 1355 | 233 | 609 | 3230 | 5.72% | 20.68% |
| keyword | 純キーワード | 8174 | 104 | 93 | 2 | 0 | 102 | 1.92% | 1.92% |

## 3. atom 別内訳

| atom | occurrence count | auto lines | guided lines | manual lines |
|---|---:|---:|---:|---:|
| effect.create-token | 2802 | 160 | 114 | 2463 |
| effect.pump | 2622 | 0 | 84 | 2501 |
| effect.draw | 2499 | 809 | 127 | 1517 |
| effect.exile | 2209 | 0 | 217 | 1681 |
| effect.counter-plus | 2086 | 0 | 187 | 1856 |
| effect.damage | 1978 | 0 | 95 | 1750 |
| effect.tap | 1758 | 0 | 178 | 1549 |
| effect.add-mana | 1676 | 742 | 4 | 916 |
| effect.return | 1541 | 0 | 156 | 1338 |
| effect.grant-keyword | 1353 | 0 | 72 | 1257 |
| effect.gain-life | 990 | 231 | 80 | 674 |
| effect.destroy | 956 | 0 | 419 | 463 |
| effect.restriction | 923 | 0 | 12 | 905 |
| effect.sacrifice | 883 | 0 | 43 | 786 |
| effect.discard | 782 | 0 | 39 | 685 |
| effect.reveal | 764 | 0 | 23 | 658 |
| effect.copy | 752 | 0 | 20 | 554 |
| effect.put-onto-battlefield | 724 | 0 | 19 | 674 |
| effect.lose-life | 721 | 77 | 47 | 589 |
| effect.search | 658 | 0 | 19 | 600 |

### prompt.kind 分布

| kind | prompt count | guided line count |
|---|---:|---:|
| target | 800 | 772 |
| modal | 483 | 483 |
| scry-surveil | 329 | 329 |

### reasons 分布

| reason | effect line count | effect line rate |
|---|---:|---:|
| needs-target | 13310 | 60.90% |
| needs-parse | 7369 | 33.72% |
| optional | 2469 | 11.30% |
| variable-count | 2431 | 11.12% |
| needs-choice | 1776 | 8.13% |
| ambiguous-mana | 794 | 3.63% |
| no-command | 38 | 0.17% |

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

## 5. 誘導候補 top-N

- activated / commands 2 / face 0 / 《Izoni, Center of the Web》: Sacrifice four tokens: Surveil 2, then draw two cards. You gain 2 life.
- activated / commands 1 / face 0 / 《Cryptex》: Sacrifice this artifact: Surveil 3, then draw three cards. Activate only if this artifact has five or more unlock counters on it.
- activated / commands 1 / face 0 / 《Found Footage》: {2}, Sacrifice this artifact: Surveil 2, then draw a card.
- activated / commands 1 / face 0 / 《Lapis Orb of Dragonkind》: {T}: Add {U}. When you spend this mana to cast a Dragon creature spell, scry 2.
- activated / commands 1 / face 0 / 《Senu, Keen-Eyed Protector》: {T}, Exile Senu: You gain 2 life and scry 2.
- activated / commands 1 / face 0 / 《Serum Sovereign》: {U}, Remove an oil counter from this creature: Draw a card, then scry 2.
- activated / commands 1 / face 0 / 《Stone Docent》: {W}, Exile this card from your graveyard: You gain 2 life. Surveil 1. Activate only as a sorcery.
- activated / commands 1 / face 0 / 《Surgical Skullbomb》: {2}{U}, Sacrifice this artifact: Return target creature to its owner's hand. Draw a card. Activate only as a sorcery.
- activated / commands 0 / face 0 / 《Aboshan, Cephalid Emperor》: Tap an untapped Octopus you control: Tap target permanent.
- activated / commands 0 / face 0 / 《Adorned Crocodile》: Renew — {B}, Exile this card from your graveyard: Put a +1/+1 counter on target creature. Activate only as a sorcery.
- activated / commands 0 / face 0 / 《Aether Spellbomb》: {U}, Sacrifice this artifact: Return target creature to its owner's hand.
- activated / commands 0 / face 0 / 《Aetherjacket》: {2}, {T}, Sacrifice this creature: Destroy another target artifact. Activate only as a sorcery.
- activated / commands 0 / face 0 / 《Agent of Kotis》: Renew — {3}{U}, Exile this card from your graveyard: Put two +1/+1 counters on target creature. Activate only as a sorcery.
- activated / commands 0 / face 0 / 《Alpha Guard》: {T}: Untap another target permanent whose name starts with the chosen letter.
- activated / commands 0 / face 0 / 《Angelic Shield》: Sacrifice this enchantment: Return target creature to its owner's hand.
- activated / commands 0 / face 0 / 《Aphetto Alchemist》: {T}: Untap target artifact or creature.
- activated / commands 0 / face 0 / 《Arashin Sunshield》: {W}, {T}: Tap target creature.
- activated / commands 0 / face 0 / 《Arwen Undómiel》: {4}{G}{U}: Scry 2.
- activated / commands 0 / face 0 / 《Avacynian Priest》: {1}, {T}: Tap target non-Human creature.
- activated / commands 0 / face 0 / 《Ayli, Eternal Pilgrim》: {1}{W}{B}, Sacrifice another creature: Exile target nonland permanent. Activate only if you have at least 10 life more than your starting life total.

