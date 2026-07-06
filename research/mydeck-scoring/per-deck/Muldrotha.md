# Muldrotha MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Muldrotha | 96 | 93 | 3 | 146 | 29 (19.9%) | 104 (71.2%) | 13 (8.9%) | 54.2% |

Demand coverage: **54.2%** (400/738)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 95 |
| `substrate不足` | 19 |
| `scope境界(既知defer)` | 3 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `cost:activation` | 40 |
| `action:sacrifice` | 30 |
| `cost:tap` | 29 |
| `tap-state:write` | 29 |
| `cost:nonmana` | 26 |
| `action:search` | 19 |
| `action:shuffle` | 19 |
| `mana:write` | 18 |
| `action:draw` | 15 |
| `target:object-or-player` | 14 |
| `action:exile` | 9 |
| `object-identity:lki` | 9 |
| `action:return` | 7 |
| `life:write` | 7 |
| `zone:library` | 6 |
| `action:mill` | 5 |
| `event:draw` | 5 |
| `token:create` | 5 |
| `action:reveal` | 4 |
| `event:life` | 4 |

## 代表ギャップ

- Muldrotha / Muldrotha, the Gravetide: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard."
- Muldrotha / Hedron Crab: partial / catalog未写 / missing `action:mill`, `target:object-or-player` — "Landfall — Whenever a land you control enters, target player mills three cards."
- Muldrotha / Ruin Crab: partial / catalog未写 / missing `action:mill` — "Landfall — Whenever a land you control enters, each opponent mills three cards."
- Muldrotha / Spore Frog: partial / catalog未写 / missing `action:sacrifice`, `cost:activation`, `cost:nonmana`, `prevention` — "Sacrifice this creature: Prevent all combat damage that would be dealt this turn."
- Muldrotha / Sylvan Safekeeper: partial / catalog未写 / missing `action:sacrifice`, `cost:activation`, `cost:nonmana`, `target:object-or-player` — "Sacrifice a land: Target creature you control gains shroud until end of turn."
- Muldrotha / Haywire Mite: partial / catalog未写 / missing `event:life`, `life:write` — "When this creature dies, you gain 2 life."
- Muldrotha / Haywire Mite: partial / catalog未写 / missing `action:exile`, `action:sacrifice`, `cost:activation`, `cost:nonmana`, `target:object-or-player` — "{G}, Sacrifice this creature: Exile target noncreature artifact or noncreature enchantment."
- Muldrotha / Baleful Strix: partial / catalog未写 / missing `action:draw`, `event:draw` — "When this creature enters, draw a card."
- Muldrotha / Ice-Fang Coatl: partial / catalog未写 / missing `action:draw`, `event:draw` — "When this creature enters, draw a card."
- Muldrotha / Accursed Marauder: partial / catalog未写 / missing `action:sacrifice`, `event:sacrifice` — "When this creature enters, each player sacrifices a nontoken creature of their choice."
- Muldrotha / Aftermath Analyst: partial / catalog未写 / missing `action:mill`, `event:zone`, `zone:graveyard`, `zone:library` — "When this creature enters, mill three cards."
- Muldrotha / Aftermath Analyst: partial / catalog未写 / missing `action:return`, `action:sacrifice`, `cost:activation`, `cost:nonmana`, `tap-state:write` — "{3}{G}, Sacrifice this creature: Return all land cards from your graveyard to the battlefield tapped."

## Unresolved

- line 27: 1 Scholar of the Lost Trove — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 74: 1 Ice Tunnel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 99: 1 Zagoth Triome — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
