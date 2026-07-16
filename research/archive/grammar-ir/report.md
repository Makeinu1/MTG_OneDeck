# 文法IR分析 Phase G1 レポート

**この数値は未調整(候補分布であり絶対正解でない)。IR は targetless 表現の候補分布。**

## 1. 総数

- 生成日時: 2026-06-21T11:31:42.154Z
- 入力: research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json
- raw: 17491
- 写像成功: 17491
- 写像失敗: 0
- 能力行数: 36116
- 効果保有行数: 22507
- アトム出現数: 31831

### 写像失敗 top-N

- なし

## 2. parse status 分布

| status | line count | line rate |
|---|---:|---:|
| full | 13078 | 36.21% |
| partial | 9429 | 26.11% |
| none | 13609 | 37.68% |

## 3. IR 表現フロンティア

G0 自動化フロンティア sanity anchor: 上位20 atom 60.8% / 全34 atom 69.4%。

| shape | label | line count | effect line count | full | partial | none | full/effect line rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| overall | 全体 | 36116 | 22507 | 13078 | 9429 | 13609 | 58.11% |
| activated | 起動型 | 5103 | 4502 | 2674 | 1828 | 601 | 59.40% |
| triggered | 誘発型 | 8972 | 7881 | 4888 | 2993 | 1091 | 62.02% |
| delayed-triggered | 遅延誘発型 | 97 | 90 | 49 | 41 | 7 | 54.44% |
| replacement | 置換 | 825 | 581 | 471 | 110 | 244 | 81.07% |
| static | 常在型 | 7561 | 4891 | 3549 | 1342 | 2670 | 72.56% |
| spell | 呪文本体 | 5384 | 4458 | 1354 | 3104 | 926 | 30.37% |
| keyword | 純キーワード | 8174 | 104 | 93 | 11 | 8070 | 89.42% |

## 4. ruleRef 検証

### 無効 ruleRef

- なし

### atom 未割当の CR §701 keyword-action top-N

- 未割当総数: 53

| ruleRef | keyword action |
|---|---|
| 701.2 | Activate |
| 701.4 | Behold |
| 701.5 | Cast |
| 701.10 | Double |
| 701.11 | Triple |
| 701.12 | Exchange |
| 701.14 | Fight |
| 701.15 | Goad |
| 701.16 | Investigate |
| 701.18 | Play |
| 701.19 | Regenerate |
| 701.24 | Shuffle |
| 701.28 | Convert |
| 701.29 | Fateseal |
| 701.30 | Clash |
| 701.31 | Planeswalk |
| 701.32 | Set in Motion |
| 701.33 | Abandon |
| 701.34 | Proliferate |
| 701.35 | Detain |

## 5. blocker 分布

| blocker | line count | line rate |
|---|---:|---:|
| construct.target | 7025 | 19.45% |
| construct.choose-modal | 1883 | 5.21% |
| unknown-atom | 3595 | 9.95% |
| no-atom | 13609 | 37.68% |

## 6. 裁定候補

partial/none の代表行。targetless IR の次段階で語彙・構文を増やす候補。

- partial / triggered / face 0 / construct.choose-modal / 《Glorfindel, Dauntless Rescuer》: Whenever you scry, choose one and Glorfindel gets +1/+1 until end of turn.
- partial / triggered / face 0 / construct.choose-modal / 《Zuko, Conflicted》: At the beginning of your first main phase, choose one that hasn't been chosen and you lose 2 life —
- partial / replacement / face 0 / construct.choose-modal / 《Rankle and Torbran》: • If a source would deal damage to a player or battle this turn, it deals that much damage plus 2 instead.
- partial / static / face 0 / construct.choose-modal / 《Abiding Grace》: • You gain 1 life.
- partial / static / face 0 / construct.choose-modal / 《Aether Channeler》: • Create a 1/1 white Bird creature token with flying.
- partial / static / face 0 / construct.choose-modal / 《Aether Channeler》: • Draw a card.
- partial / static / face 0 / construct.choose-modal / 《Ainok Guide》: • Put a +1/+1 counter on this creature.
- partial / static / face 0 / construct.choose-modal / 《Ao, the Dawn Sky》: • Put two +1/+1 counters on each permanent you control that's a creature or Vehicle.
- partial / static / face 0 / construct.choose-modal / 《Apothecary Stomper》: • You gain 4 life.
- partial / static / face 0 / construct.choose-modal / 《Arbalest Engineers》: • Create a tapped Powerstone token.
- partial / static / face 0 / construct.choose-modal / 《Astarion, the Decadent》: • Friends — You gain life equal to the amount of life you gained this turn.
- partial / static / face 0 / construct.choose-modal / 《Atsushi, the Blazing Sky》: • Create three Treasure tokens.
- partial / static / face 0 / construct.choose-modal / 《Avengers Quinjet》: • You may put a Hero creature card from your hand onto the battlefield.
- partial / static / face 0 / construct.choose-modal / 《Baleful Beholder》: • Antimagic Cone — Each opponent sacrifices an enchantment of their choice.
- partial / static / face 0 / construct.choose-modal / 《Baleful Beholder》: • Fear Ray — Creatures you control gain menace until end of turn.
- partial / static / face 0 / construct.choose-modal / 《Balloon Stand》: • Create a 1/1 red Balloon creature token with flying.
- partial / static / face 0 / construct.choose-modal / 《Barrensteppe Siege》: • Abzan — At the beginning of your end step, put a +1/+1 counter on each creature you control.
- partial / static / face 0 / construct.choose-modal / 《Barrensteppe Siege》: • Mardu — At the beginning of your end step, if a creature died under your control this turn, each opponent sacrifices a creature of their choice.
- partial / static / face 0 / construct.choose-modal / 《Bill Ferny, Bree Swindler》: • Create a Treasure token.
- partial / static / face 0 / construct.choose-modal / 《Black Market Connections》: • Buy Information — Draw a card. You lose 2 life.

