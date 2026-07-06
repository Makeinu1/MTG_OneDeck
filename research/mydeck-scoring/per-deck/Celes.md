# Celes MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Celes | 99 | 95 | 4 | 178 | 33 (18.5%) | 103 (57.9%) | 42 (23.6%) | 49.6% |

Demand coverage: **49.6%** (399/804)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 81 |
| `substrate不足` | 61 |
| `scope境界(既知defer)` | 3 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `cost:activation` | 65 |
| `cost:tap` | 58 |
| `mana:write` | 50 |
| `tap-state:write` | 27 |
| `target:object-or-player` | 27 |
| `action:return` | 18 |
| `token:create` | 14 |
| `action:draw` | 13 |
| `action:sacrifice` | 12 |
| `action:exile` | 11 |
| `damage:write` | 11 |
| `action:discard` | 9 |
| `cost:nonmana` | 9 |
| `event:draw` | 8 |
| `cast-permission:from-zone` | 6 |
| `counter:write` | 6 |
| `event:other` | 6 |
| `object-identity:lki` | 5 |
| `event:discard` | 4 |
| `zone:library` | 4 |

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

## Unresolved

- line 7: 1 Bounty Agent — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 40: 1 Malakir Rebirth — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 49: 1 Angelic Renewal — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 64: 1 Desecrated Tomb — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
