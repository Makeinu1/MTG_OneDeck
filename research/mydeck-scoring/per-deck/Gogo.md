# Gogo MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Gogo | 83 | 76 | 7 | 141 | 35 (24.8%) | 70 (49.6%) | 36 (25.5%) | 45.0% |

Demand coverage: **45.0%** (265/589)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 72 |
| `substrate不足` | 32 |
| `scope境界(既知defer)` | 1 |
| `曖昧` | 1 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `cost:activation` | 56 |
| `cost:tap` | 53 |
| `target:object-or-player` | 35 |
| `tap-state:write` | 34 |
| `mana:write` | 29 |
| `action:sacrifice` | 15 |
| `cost:nonmana` | 14 |
| `action:draw` | 10 |
| `action:search` | 9 |
| `action:shuffle` | 9 |
| `zone:battlefield` | 7 |
| `action:counter-spell` | 6 |
| `event:draw` | 4 |
| `object-identity:lki` | 4 |
| `token:create` | 4 |
| `action:exile` | 3 |
| `counter:write` | 3 |
| `action:destroy` | 2 |
| `action:return` | 2 |
| `choice:mode-or-value` | 2 |

## 代表ギャップ

- Gogo / Gogo, Master of Mimicry: partial / substrate不足 / missing `cost:activation`, `cost:tap`, `target:object-or-player` — "{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may choose new targets for the copies. This ability can't be copied and X can't be 0."
- Gogo / Omen Hawker: gap / substrate不足 / missing `cost:activation`, `cost:tap`, `mana:write` — "{T}: Add {C}{U}. Spend this mana only to activate abilities."
- Gogo / Aphetto Alchemist: gap / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player` — "{T}: Untap target artifact or creature."
- Gogo / Forensic Researcher: partial / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "{T}: Untap another target permanent you control."
- Gogo / Forensic Researcher: partial / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player` — "{T}, Collect evidence 3: Tap target creature you don't control."
- Gogo / Ioreth of the Healing House: gap / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "{T}: Untap another target permanent."
- Gogo / Ioreth of the Healing House: gap / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player` — "{T}: Untap two other target legendary creatures."
- Gogo / Kelpie Guide: partial / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "{T}: Untap another target permanent you control."
- Gogo / Kelpie Guide: partial / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "{T}: Tap target permanent. Activate only if you control eight or more lands."
- Gogo / Vizier of Tumbling Sands: gap / catalog未写 / missing `cost:activation`, `cost:tap`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "{T}: Untap another target permanent."
- Gogo / Vizier of Tumbling Sands: partial / catalog未写 / missing `event:other`, `tap-state:write`, `target:object-or-player`, `zone:battlefield` — "When you cycle this card, untap target permanent."
- Gogo / Liberator, Urza's Battlethopter: partial / catalog未写 / missing `counter:write`, `event:counter`, `object-identity:lki` — "Whenever you cast a spell, if the amount of mana spent to cast that spell is greater than Liberator's power, put a +1/+1 counter on Liberator."

## Unresolved

- line 22: 1 Dispel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 28: 1 Censor — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 29: 1 Mage's Guile — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 31: 1 Blue Sun's Zenith — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 32: 1 Capsize — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 43: 1 Jeweled Amulet — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 79: 1 Magosi, the Waterveil — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
