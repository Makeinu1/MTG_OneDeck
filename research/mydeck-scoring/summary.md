# MyDeck 設計採点サマリ

Generated: 2026-07-13T10:59:47.042Z

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
| ALL | 381 | 363 | 18 | 654 | 347 (53.1%) | 299 (45.7%) | 8 (1.2%) | 77.1% |
| Celes | 99 | 95 | 4 | 178 | 98 (55.1%) | 79 (44.4%) | 1 (0.6%) | 78.1% |
| Gogo | 83 | 76 | 7 | 141 | 81 (57.4%) | 56 (39.7%) | 4 (2.8%) | 80.5% |
| Kefka | 103 | 99 | 4 | 189 | 98 (51.9%) | 89 (47.1%) | 2 (1.1%) | 72.8% |
| Muldrotha | 96 | 93 | 3 | 146 | 70 (47.9%) | 75 (51.4%) | 1 (0.7%) | 78.5% |

Overall demand coverage: **77.1%** (2334/3028)
Unresolved entries: **18**

## ギャップ候補カテゴリ

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 231 |
| `substrate不足` | 52 |
| `scope境界(既知defer)` | 21 |
| `曖昧` | 3 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `target:object-or-player` | 63 |
| `action:draw` | 40 |
| `tap-state:write` | 40 |
| `action:sacrifice` | 33 |
| `damage:write` | 33 |
| `action:discard` | 31 |
| `action:return` | 29 |
| `action:exile` | 28 |
| `object-identity:lki` | 28 |
| `event:draw` | 25 |
| `token:create` | 24 |
| `cost:activation` | 19 |
| `life:write` | 15 |
| `zone:library` | 15 |
| `counter:write` | 13 |
| `action:search` | 12 |
| `action:shuffle` | 12 |
| `cost:nonmana` | 12 |
| `cost:tap` | 11 |
| `replacement` | 11 |

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
- Celes / Mother of Runes: partial / substrate不足 / missing `target:object-or-player` — "{T}: Target creature you control gains protection from the color of your choice until end of turn."
- Celes / Banon, the Returners' Leader: partial / catalog未写 / missing `action:discard`, `action:draw`, `event:discard`, `event:draw` — "Whenever you attack, you may pay {1} and discard a card. If you do, draw a card."
- Celes / Priest of Fell Rites: partial / catalog未写 / missing `action:return`, `target:object-or-player` — "{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery."
- Celes / Tataru Taru: partial / catalog未写 / missing `action:draw`, `event:draw`, `player-scope:each-opponent`, `target:object-or-player` — "When Tataru Taru enters, you draw a card and target opponent may draw a card."
- Celes / Tataru Taru: partial / catalog未写 / missing `action:draw`, `cast-timing:once-per-turn`, `layer:L4`, `tap-state:write`, `token:create` — "Scions' Secretary — Whenever an opponent draws a card, if it isn't that player's turn, create a tapped Treasure token. This ability triggers only once each turn."
- Celes / Accursed Marauder: partial / catalog未写 / missing `action:sacrifice`, `event:sacrifice` — "When this creature enters, each player sacrifices a nontoken creature of their choice."
- Celes / Timeline Culler: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "You may cast this card from your graveyard using its warp ability."
- Celes / Fear of Missing Out: partial / catalog未写 / missing `event:discard`, `event:draw` — "When this creature enters, discard a card, then draw a card."
- Celes / Fear of Missing Out: partial / catalog未写 / missing `layer:L4`, `tap-state:write`, `target:object-or-player` — "Delirium — Whenever this creature attacks for the first time each turn, if there are four or more card types among cards in your graveyard, untap target creature. After this phase, there is an additional combat phase."
- Celes / Gau, Feral Youth: partial / catalog未写 / missing `counter:write` — "Rage — Whenever Gau attacks, put a +1/+1 counter on it."

## 注意

低被覆は失敗判定ではない。未写像の分布を Slice3/4 以後の下面入力として使うための M0 採点である。
