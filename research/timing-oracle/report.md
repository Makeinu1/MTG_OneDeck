# Timing Oracle Report

- Model: gpt-5.5-clean-room
- Generated at: 2026-06-25T00:00:00.000Z
- Prompt hash: `0ec68246151d9b19bc18ff88413c38e4f77163ce4389a605f80c81bb4b51467a`
- Sample size: 196
- Compared count: 195
- Juncture discrepancy rate: 4.10%
- Juncture-scope discrepancy rate: 2.05%
- Cast-timing discrepancy rate: 2.05%
- Unverifiable rate: 1.53%

## Gold calibration

- Unresolved gold: none

| step | precision | recall | support |
|---|---:|---:|---:|
| begin-combat | 100.00% | 100.00% | 1 |
| cleanup | 0.00% | 0.00% | 0 |
| declare-attackers | 0.00% | 0.00% | 0 |
| declare-blockers | 0.00% | 0.00% | 0 |
| draw | 100.00% | 100.00% | 1 |
| end-combat | 0.00% | 0.00% | 0 |
| end-step | 100.00% | 100.00% | 1 |
| main-precombat | 0.00% | 0.00% | 0 |
| main-postcombat | 0.00% | 0.00% | 0 |
| other | 0.00% | 0.00% | 0 |
| turn | 0.00% | 0.00% | 0 |
| untap | 100.00% | 100.00% | 1 |
| upkeep | 100.00% | 100.00% | 4 |

## Discrepancy clusters

- `+end-step`: 6 (Lagomos, Hand of Hatred, Whip of Erebos, Urabrask's Forge, Rite of the Raging Storm, Rionya, Fire Dancer)
- `+@self,-@unknown`: 3 (Phelia, Exuberant Shepherd, Moraug, Fury of Akoum, Final Fortune)
- `+sorcery-speed,-none`: 2 (Innkeeper's Talent, Dazzling Theater // Prop Room)
- `+@any,-@unknown`: 1 (Underworld Breach)
- `+cleanup`: 1 (Necromancy)
- `+sorcery-speed`: 1 (Teferi, Time Raveler)
- `+your-turn-only`: 1 (Forge Anew)
- `-other`: 1 (Mana Drain)

## Discrepancies

- 《Underworld Breach》 `+@any,-@unknown` (juncture=agree, scope=diff, cast=agree, uncertain=false)
- 《Phelia, Exuberant Shepherd》 `+@self,-@unknown` (juncture=agree, scope=diff, cast=agree, uncertain=false)
- 《Moraug, Fury of Akoum》 `+@self,-@unknown` (juncture=agree, scope=diff, cast=agree, uncertain=false)
- 《Final Fortune》 `+@self,-@unknown` (juncture=agree, scope=diff, cast=agree, uncertain=false)
- 《Necromancy》 `+cleanup` (juncture=diff, scope=agree, cast=agree, uncertain=true)
- 《Lagomos, Hand of Hatred》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=false)
- 《Whip of Erebos》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=false)
- 《Urabrask's Forge》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=false)
- 《Rite of the Raging Storm》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=false)
- 《Rionya, Fire Dancer》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=false)
- 《The Scarab God》 `+end-step` (juncture=diff, scope=agree, cast=agree, uncertain=true)
- 《Teferi, Time Raveler》 `+sorcery-speed` (juncture=agree, scope=agree, cast=diff, uncertain=false)
- 《Innkeeper's Talent》 `+sorcery-speed,-none` (juncture=agree, scope=agree, cast=diff, uncertain=false)
- 《Dazzling Theater // Prop Room》 `+sorcery-speed,-none` (juncture=agree, scope=agree, cast=diff, uncertain=false)
- 《Forge Anew》 `+your-turn-only` (juncture=agree, scope=agree, cast=diff, uncertain=false)
- 《Mana Drain》 `-other` (juncture=diff, scope=agree, cast=agree, uncertain=true)

