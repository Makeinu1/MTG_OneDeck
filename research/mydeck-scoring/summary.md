# MyDeck 設計採点サマリ

Generated: 2026-07-04T04:12:24.344Z

## 再実行

`npx tsx scripts/mydeck-scoring/score.ts`

## 入力と前提

- local snapshot: `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`
- optional fallback file: `research/mydeck-scoring/scryfall-fallback.cards.json` (存在すれば snapshot 後に読む)
- oracleText は英語 Scryfall データのみを使用。printedText は使わない。
- 盲列挙はこのスクリプト内の demand probe、モデル照合は既存 layer/event/zone/timing classifier を使用。

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 381 | 363 | 18 | 654 | 133 (20.3%) | 386 (59.0%) | 135 (20.6%) | 49.3% |
| Celes | 99 | 95 | 4 | 178 | 33 (18.5%) | 103 (57.9%) | 42 (23.6%) | 49.6% |
| Gogo | 83 | 76 | 7 | 141 | 35 (24.8%) | 70 (49.6%) | 36 (25.5%) | 45.0% |
| Kefka | 103 | 99 | 4 | 189 | 36 (19.0%) | 109 (57.7%) | 44 (23.3%) | 47.8% |
| Muldrotha | 96 | 93 | 3 | 146 | 29 (19.9%) | 104 (71.2%) | 13 (8.9%) | 54.2% |

Overall demand coverage: **49.3%** (1493/3028)
Unresolved entries: **18**

## ギャップ候補カテゴリ

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 331 |
| `substrate不足` | 179 |
| `scope境界(既知defer)` | 10 |
| `曖昧` | 1 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `cost:activation` | 232 |
| `cost:tap` | 201 |
| `mana:write` | 150 |
| `tap-state:write` | 108 |
| `target:object-or-player` | 97 |
| `action:sacrifice` | 74 |
| `action:draw` | 65 |
| `cost:nonmana` | 58 |
| `action:search` | 36 |
| `action:shuffle` | 36 |
| `action:exile` | 35 |
| `action:discard` | 34 |
| `damage:write` | 33 |
| `token:create` | 32 |
| `action:return` | 31 |
| `object-identity:lki` | 28 |
| `event:draw` | 25 |
| `life:write` | 17 |
| `zone:library` | 15 |
| `counter:write` | 14 |

## Unresolved

- Celes:7 1 Bounty Agent — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Celes:40 1 Malakir Rebirth — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Celes:49 1 Angelic Renewal — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Celes:64 1 Desecrated Tomb — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:22 1 Dispel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:28 1 Censor — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:29 1 Mage's Guile — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:31 1 Blue Sun's Zenith — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:32 1 Capsize — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:43 1 Jeweled Amulet — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Gogo:79 1 Magosi, the Waterveil — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Kefka:27 1 Malakir Rebirth — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Kefka:41 1 Whispering Madness — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Kefka:51 1 Megrim — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Kefka:77 1 Emergence Zone — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Muldrotha:27 1 Scholar of the Lost Trove — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Muldrotha:74 1 Ice Tunnel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- Muldrotha:99 1 Zagoth Triome — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.

## 代表ギャップ

- Celes / Celes, Rune Knight: partial / catalog未写 / missing `action:discard`, `action:draw`, `event:discard`, `event:draw` — "When Celes enters, discard any number of cards, then draw that many cards plus one."
- Celes / Celes, Rune Knight: partial / catalog未写 / missing `cast-permission:from-zone`, `counter:write`, `event:counter` — "Whenever one or more other creatures you control enter, if one or more of them entered from a graveyard or was cast from a graveyard, put a +1/+1 counter on each creature you control."
- Celes / Mother of Runes: partial / substrate不足 / missing `cost:activation`, `cost:tap`, `target:object-or-player` — "{T}: Target creature you control gains protection from the color of your choice until end of turn."
- Celes / Banon, the Returners' Leader: partial / catalog未写 / missing `action:discard`, `action:draw`, `event:discard`, `event:draw` — "Whenever you attack, you may pay {1} and discard a card. If you do, draw a card."
- Celes / Cathar Commando: partial / catalog未写 / missing `action:destroy`, `action:sacrifice`, `cost:activation`, `cost:nonmana`, `target:object-or-player` — "{1}, Sacrifice this creature: Destroy target artifact or enchantment."
- Celes / Priest of Fell Rites: partial / catalog未写 / missing `action:return`, `action:sacrifice`, `cost:activation`, `cost:nonmana`, `cost:tap`, `target:object-or-player` — "{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery."
- Celes / Selfless Spirit: partial / catalog未写 / missing `action:sacrifice`, `cost:activation`, `cost:nonmana` — "Sacrifice this creature: Creatures you control gain indestructible until end of turn."
- Celes / Tataru Taru: partial / catalog未写 / missing `action:draw`, `event:draw`, `player-scope:each-opponent`, `target:object-or-player` — "When Tataru Taru enters, you draw a card and target opponent may draw a card."
- Celes / Tataru Taru: partial / catalog未写 / missing `action:draw`, `cast-timing:once-per-turn`, `layer:L4`, `tap-state:write`, `token:create` — "Scions' Secretary — Whenever an opponent draws a card, if it isn't that player's turn, create a tapped Treasure token. This ability triggers only once each turn."
- Celes / Accursed Marauder: partial / catalog未写 / missing `action:sacrifice`, `event:sacrifice` — "When this creature enters, each player sacrifices a nontoken creature of their choice."
- Celes / Timeline Culler: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "You may cast this card from your graveyard using its warp ability."
- Celes / Fear of Missing Out: partial / catalog未写 / missing `action:discard`, `action:draw`, `event:discard`, `event:draw` — "When this creature enters, discard a card, then draw a card."

## 注意

低被覆は失敗判定ではない。未写像の分布を Slice3/4 以後の下面入力として使うための M0 採点である。
