# LLM Oracle Report

## Summary

- model: codex-clean-room
- generatedAt: 2026-06-23T00:00:00.000Z
- promptHash: a2248e4d314998d8a1d40959ea052cca10a12ea9ea9145e02c9fbc4b71a85e4a
- sampleSize: 192
- comparedCount: 192
- discrepancyRate: 8.33%
- unverifiableRate: 0.00%
- discrepancies: 16
- attributionDistribution: substrate=0, compiler=2, oracle=9, ambiguous=5, null=0
- unresolvedGold: none

## Per Layer Confusion

| layer | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| L1a | 0 | 2 | 10 |
| L1b | 1 | 0 | 0 |
| L2 | 0 | 0 | 3 |
| L3 | 0 | 0 | 0 |
| L4 | 0 | 0 | 28 |
| L5 | 0 | 0 | 4 |
| L6 | 1 | 2 | 99 |
| L7a | 0 | 8 | 4 |
| L7b | 1 | 0 | 6 |
| L7c | 0 | 3 | 88 |
| L7d | 0 | 0 | 0 |

## Gold Calibration

| layer | precision | recall | support |
|---|---:|---:|---:|
| L1a | 0.00% | 0.00% | 0 |
| L1b | 0.00% | 0.00% | 0 |
| L2 | 100.00% | 100.00% | 1 |
| L3 | 0.00% | 0.00% | 0 |
| L4 | 100.00% | 100.00% | 8 |
| L5 | 100.00% | 100.00% | 1 |
| L6 | 100.00% | 100.00% | 7 |
| L7a | 100.00% | 100.00% | 1 |
| L7b | 100.00% | 100.00% | 4 |
| L7c | 100.00% | 100.00% | 5 |
| L7d | 0.00% | 0.00% | 0 |

## Clusters

| signature | count | examples |
|---|---:|---|
| +L7a | 7 | Faeburrow Elder; Banner of Kinship; Storm-Kiln Artist; Shared Animosity; All That Glitters |
| +L7c | 3 | The Ozolith; Spymaster's Vault; Rhythm of the Wild |
| +L1a | 2 | Helm of the Host; Caretaker's Talent |
| -L1b | 1 | Necropotence |
| -L6 | 1 | Bitterblossom |
| +L6 | 1 | Ragavan, Nimble Pilferer |
| +L6,+L7a,-L7b | 1 | Destiny Spinner |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 2 |
| oracle | 9 |
| ambiguous | 5 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | classifierOnly | oracleOnly | uncertain | attribution |
|---|---|---|---|---|---:|---|
| -L1b | 94a844d2-0574-45a7-b347-e0e329767c42 | Necropotence | L1b | (none) | no | compiler |
| -L6 | fb868840-09fa-49b1-85cb-b08ad065e972 | Bitterblossom | L6 | (none) | no | compiler |
| +L1a | 83b43aba-bf9c-4da2-967d-9daa632e97d2 | Helm of the Host | (none) | L1a | no | ambiguous |
| +L1a | c97957a2-8310-4cff-8aad-871b7901d124 | Caretaker's Talent | (none) | L1a | no | ambiguous |
| +L6 | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | L6 | no | oracle |
| +L6,+L7a,-L7b | 7dd189f8-a23f-4b43-b0ef-fb174a9664ba | Destiny Spinner | L7b | L6, L7a | no | ambiguous |
| +L7a | 70a6f08e-854d-4e2f-9d8c-c45ec3231157 | Faeburrow Elder | (none) | L7a | no | oracle |
| +L7a | 8c220dbd-6572-4715-aae6-dd09a4252d68 | Banner of Kinship | (none) | L7a | no | oracle |
| +L7a | a145ff8c-5812-4bcb-bd16-9839dc25121d | Storm-Kiln Artist | (none) | L7a | no | oracle |
| +L7a | a27445db-33f2-4571-98b5-83206b797484 | Shared Animosity | (none) | L7a | no | oracle |
| +L7a | a4d751e0-41c1-4e90-853d-512f385acd81 | All That Glitters | (none) | L7a | no | oracle |
| +L7a | dbba75f5-2404-4bd5-982b-f6c4effa5316 | Ethereal Armor | (none) | L7a | no | oracle |
| +L7a | dca51281-fb21-45b6-beb4-1f13397caee2 | Blackblade Reforged | (none) | L7a | no | oracle |
| +L7c | 1946ded1-5f53-409f-b0a6-5433bb0357d2 | The Ozolith | (none) | L7c | no | ambiguous |
| +L7c | 69ddca4b-5cc0-45f3-b2e6-a047c8d601be | Spymaster's Vault | (none) | L7c | no | ambiguous |
| +L7c | acfa77fd-3610-4f12-9c3c-bd860ce91700 | Rhythm of the Wild | (none) | L7c | no | oracle |

