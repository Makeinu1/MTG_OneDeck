# Muldrotha MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Muldrotha | 96 | 93 | 3 | 146 | 49 (33.6%) | 96 (65.8%) | 1 (0.7%) | 73.8% |

Demand coverage: **73.8%** (545/738)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 84 |
| `substrate不足` | 8 |
| `scope境界(既知defer)` | 5 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `tap-state:write` | 27 |
| `action:search` | 15 |
| `action:shuffle` | 15 |
| `action:sacrifice` | 10 |
| `object-identity:lki` | 9 |
| `target:object-or-player` | 9 |
| `action:draw` | 7 |
| `action:exile` | 7 |
| `action:return` | 6 |
| `cost:activation` | 6 |
| `zone:library` | 6 |
| `cost:nonmana` | 5 |
| `event:draw` | 5 |
| `life:write` | 5 |
| `mana:write` | 5 |
| `token:create` | 5 |
| `action:mill` | 4 |
| `action:reveal` | 4 |
| `event:life` | 4 |
| `action:surveil` | 3 |

## 代表ギャップ

- Muldrotha / Muldrotha, the Gravetide: partial / scope境界(既知defer) / missing `cast-permission:from-zone` — "During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard."
- Muldrotha / Hedron Crab: partial / catalog未写 / missing `action:mill`, `target:object-or-player` — "Landfall — Whenever a land you control enters, target player mills three cards."
- Muldrotha / Ruin Crab: partial / catalog未写 / missing `action:mill` — "Landfall — Whenever a land you control enters, each opponent mills three cards."
- Muldrotha / Spore Frog: partial / scope境界(既知defer) / missing `prevention` — "Sacrifice this creature: Prevent all combat damage that would be dealt this turn."
- Muldrotha / Sylvan Safekeeper: partial / catalog未写 / missing `action:sacrifice`, `cost:activation`, `cost:nonmana`, `target:object-or-player` — "Sacrifice a land: Target creature you control gains shroud until end of turn."
- Muldrotha / Haywire Mite: partial / catalog未写 / missing `event:life` — "When this creature dies, you gain 2 life."
- Muldrotha / Baleful Strix: partial / catalog未写 / missing `event:draw` — "When this creature enters, draw a card."
- Muldrotha / Ice-Fang Coatl: partial / catalog未写 / missing `event:draw` — "When this creature enters, draw a card."
- Muldrotha / Accursed Marauder: partial / catalog未写 / missing `action:sacrifice`, `event:sacrifice` — "When this creature enters, each player sacrifices a nontoken creature of their choice."
- Muldrotha / Aftermath Analyst: partial / catalog未写 / missing `event:zone`, `zone:graveyard`, `zone:library` — "When this creature enters, mill three cards."
- Muldrotha / Aftermath Analyst: partial / catalog未写 / missing `action:return`, `tap-state:write` — "{3}{G}, Sacrifice this creature: Return all land cards from your graveyard to the battlefield tapped."
- Muldrotha / Lotus Cobra: partial / substrate不足 / missing `mana:write` — "Landfall — Whenever a land you control enters, add one mana of any color."

## Unresolved

- line 27: 1 Scholar of the Lost Trove — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 74: 1 Ice Tunnel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 99: 1 Zagoth Triome — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
