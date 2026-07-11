# Gogo MyDeck 採点

## KPI

| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Gogo | 83 | 76 | 7 | 141 | 65 (46.1%) | 72 (51.1%) | 4 (2.8%) | 76.6% |

Demand coverage: **76.6%** (451/589)

## ギャップ候補カテゴリ top

| candidate category | gap rows |
|---|---:|
| `catalog未写` | 58 |
| `substrate不足` | 15 |
| `scope境界(既知defer)` | 2 |
| `曖昧` | 1 |

## Missing read/write top

| missing demand | occurrences |
|---|---:|
| `tap-state:write` | 19 |
| `target:object-or-player` | 16 |
| `action:search` | 9 |
| `action:shuffle` | 9 |
| `mana:write` | 8 |
| `zone:battlefield` | 7 |
| `action:counter-spell` | 6 |
| `action:sacrifice` | 5 |
| `cost:activation` | 5 |
| `action:draw` | 4 |
| `cost:tap` | 4 |
| `event:draw` | 4 |
| `object-identity:lki` | 4 |
| `cost:nonmana` | 3 |
| `counter:write` | 3 |
| `token:create` | 3 |
| `action:exile` | 2 |
| `action:return` | 2 |
| `choice:mode-or-value` | 2 |
| `event:counter` | 2 |

## 代表ギャップ

- Gogo / Gogo, Master of Mimicry: partial / substrate不足 / missing `cost:activation`, `cost:tap`, `target:object-or-player` — "{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may choose new targets for the copies. This ability can't be copied and X can't be 0."
- Gogo / Omen Hawker: partial / substrate不足 / missing `mana:write` — "{T}: Add {C}{U}. Spend this mana only to activate abilities."
- Gogo / Forensic Researcher: partial / catalog未写 / missing `zone:battlefield` — "{T}: Untap another target permanent you control."
- Gogo / Forensic Researcher: partial / substrate不足 / missing `cost:activation`, `cost:tap` — "{T}, Collect evidence 3: Tap target creature you don't control."
- Gogo / Ioreth of the Healing House: partial / catalog未写 / missing `zone:battlefield` — "{T}: Untap another target permanent."
- Gogo / Ioreth of the Healing House: partial / substrate不足 / missing `target:object-or-player` — "{T}: Untap two other target legendary creatures."
- Gogo / Kelpie Guide: partial / catalog未写 / missing `zone:battlefield` — "{T}: Untap another target permanent you control."
- Gogo / Kelpie Guide: partial / catalog未写 / missing `target:object-or-player`, `zone:battlefield` — "{T}: Tap target permanent. Activate only if you control eight or more lands."
- Gogo / Vizier of Tumbling Sands: partial / catalog未写 / missing `zone:battlefield` — "{T}: Untap another target permanent."
- Gogo / Vizier of Tumbling Sands: partial / catalog未写 / missing `event:other`, `zone:battlefield` — "When you cycle this card, untap target permanent."
- Gogo / Liberator, Urza's Battlethopter: partial / catalog未写 / missing `counter:write`, `event:counter`, `object-identity:lki` — "Whenever you cast a spell, if the amount of mana spent to cast that spell is greater than Liberator's power, put a +1/+1 counter on Liberator."
- Gogo / Displacer Kitten: partial / catalog未写 / missing `action:return`, `object-identity:lki` — "Avoidance — Whenever you cast a noncreature spell, exile up to one target nonland permanent you control, then return that card to the battlefield under its owner's control."

## Unresolved

- line 22: 1 Dispel — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 28: 1 Censor — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 29: 1 Mage's Guile — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 31: 1 Blue Sun's Zenith — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 32: 1 Capsize — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 43: 1 Jeweled Amulet — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
- line 79: 1 Magosi, the Waterveil — Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.
