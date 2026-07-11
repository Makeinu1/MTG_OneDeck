# Kefka MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Kefka | 103 | 99 | 4 | 189 | 74 (39.2%) | 113 (59.8%) | 2 (1.1%) | 68.7% |

Demand coverage: **68.7%** (616/897)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 79 |
| `substrate不足` | 33 |
| `scope境界(既知defer)` | 3 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `mana:write` | 22 |
| `action:discard` | 21 |
| `action:draw` | 20 |
| `damage:write` | 19 |
| `target:object-or-player` | 17 |
| `tap-state:write` | 14 |
| `action:exile` | 12 |
| `action:sacrifice` | 12 |
| `object-identity:lki` | 10 |
| `event:draw` | 8 |
| `delayed-trigger` | 7 |
| `life:write` | 7 |
| `token:create` | 7 |
| `layer:L4` | 6 |
| `action:search` | 5 |
| `action:shuffle` | 5 |
| `attachment:write` | 5 |
| `cost:activation` | 5 |
| `event:discard` | 5 |
| `timing:end-step` | 5 |

## 代表ギャップ

- Kefka / Kefka, Court Mage // Kefka, Ruler of Ruin: partial / catalog未写 / missing `action:discard`, `action:draw`, `event:discard`, `event:draw` — "Whenever Kefka enters or attacks, each player discards a card. Then you draw a card for each card type among cards discarded this way."
- Kefka / Kefka, Court Mage // Kefka, Ruler of Ruin: partial / catalog未写 / missing `action:sacrifice`, `transform:write` — "{8}: Each opponent sacrifices a permanent of their choice. Transform Kefka. Activate only as a sorcery."
- Kefka / Kefka, Court Mage // Kefka, Ruler of Ruin: partial / catalog未写 / missing `action:draw`, `event:draw`, `life:write` — "Whenever an opponent loses life during your turn, you draw that many cards."
- Kefka / Ragavan, Nimble Pilferer: partial / catalog未写 / missing `action:exile`, `damage:write`, `object-identity:lki`, `token:create` — "Whenever Ragavan deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card."
- Kefka / Norman Osborn // Green Goblin: partial / substrate不足 / missing `damage:write` — "Whenever Norman Osborn deals combat damage to a player, he connives."
- Kefka / Norman Osborn // Green Goblin: partial / substrate不足 / missing `transform:write` — "{1}{U}{B}{R}: Transform Norman Osborn. Activate only as a sorcery."
- Kefka / Norman Osborn // Green Goblin: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "Spells you cast from your graveyard cost {2} less to cast."
- Kefka / Emperor of Bones: partial / catalog未写 / missing `action:exile`, `target:object-or-player` — "At the beginning of combat on your turn, exile up to one target card from a graveyard."
- Kefka / Emperor of Bones: partial / catalog未写 / missing `action:exile`, `action:sacrifice`, `counter:write`, `delayed-trigger`, `event:enters`, `event:phase`, `event:sacrifice`, `event:zone`, `layer:L4`, `timing:end-step` — "Whenever one or more +1/+1 counters are put on this creature, put a creature card exiled with this creature onto the battlefield under your control with a finality counter on it. It gains haste. Sacrifice it at the be..."
- Kefka / Emet-Selch, Unsundered // Hades, Sorcerer of Eld: partial / catalog未写 / missing `event:discard`, `event:draw` — "Whenever Emet-Selch enters or attacks, draw a card, then discard a card."
- Kefka / Emet-Selch, Unsundered // Hades, Sorcerer of Eld: partial / substrate不足 / missing `transform:write` — "At the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform Emet-Selch."
- Kefka / Emet-Selch, Unsundered // Hades, Sorcerer of Eld: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "Echo of the Lost — During your turn, you may play cards from your graveyard."

## Unresolved

- line 27: 1 Malakir Rebirth — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 41: 1 Whispering Madness — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 51: 1 Megrim — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 77: 1 Emergence Zone — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
