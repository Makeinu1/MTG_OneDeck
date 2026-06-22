# LLM Oracle Report

## Summary

- model: codex-clean-room
- generatedAt: 2026-06-23T00:00:00.000Z
- promptHash: a2248e4d314998d8a1d40959ea052cca10a12ea9ea9145e02c9fbc4b71a85e4a
- sampleSize: 192
- comparedCount: 192
- discrepancyRate: 18.23%
- unverifiableRate: 0.00%
- discrepancies: 35
- unresolvedGold: none

## Per Layer Confusion

| layer | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| L1a | 0 | 7 | 5 |
| L1b | 1 | 0 | 0 |
| L2 | 1 | 0 | 3 |
| L3 | 0 | 0 | 0 |
| L4 | 8 | 2 | 26 |
| L5 | 0 | 0 | 4 |
| L6 | 2 | 2 | 99 |
| L7a | 0 | 8 | 4 |
| L7b | 1 | 0 | 6 |
| L7c | 3 | 3 | 88 |
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
| -L4 | 7 | Karlach, Fury of Avernus; The Mycosynth Gardens; Cursed Mirror; Mirage Mirror; Shifting Woodland |
| +L1a | 7 | Phyrexian Metamorph; Sculpting Steel; Mirrormade; Helm of the Host; Spark Double |
| +L7a | 7 | Faeburrow Elder; Banner of Kinship; Storm-Kiln Artist; Shared Animosity; All That Glitters |
| -L7c | 3 | Not Dead After All; Urza's Saga; Inspiring Call |
| +L7c | 3 | The Ozolith; Spymaster's Vault; Rhythm of the Wild |
| +L4 | 2 | Enduring Vitality; Enduring Courage |
| -L1b | 1 | Necropotence |
| -L2 | 1 | Marvin, Murderous Mimic |
| -L4,-L6 | 1 | Thespian's Stage |
| -L6 | 1 | Bitterblossom |
| +L6 | 1 | Ragavan, Nimble Pilferer |
| +L6,+L7a,-L7b | 1 | Destiny Spinner |

## Discrepancies

| delta | oracleId | name | classifierOnly | oracleOnly | uncertain | attribution |
|---|---|---|---|---|---:|---|
| -L1b | 94a844d2-0574-45a7-b347-e0e329767c42 | Necropotence | L1b | (none) | no | null |
| -L2 | 22f0dbbb-9d8d-42bc-8903-fc0b65e00952 | Marvin, Murderous Mimic | L2 | (none) | no | null |
| -L4 | 037355be-71e7-4866-80a6-80352c304970 | Karlach, Fury of Avernus | L4 | (none) | no | null |
| -L4 | 03f5c566-825c-4c46-9c01-a2f9b1e70a13 | The Mycosynth Gardens | L4 | (none) | no | null |
| -L4 | 4d67e2a7-4aa7-44cc-853b-500d7aac046d | Cursed Mirror | L4 | (none) | no | null |
| -L4 | 6a84eda1-7e72-4b5a-849f-b6e177565aeb | Mirage Mirror | L4 | (none) | no | null |
| -L4 | 7c2a4fe5-43e8-4e20-bef2-0278d18afc4b | Shifting Woodland | L4 | (none) | no | null |
| -L4 | 8242cd78-6675-43b5-8924-0a88c3aa6f76 | Genji Glove | L4 | (none) | no | null |
| -L4 | afe2f7a4-9440-4d93-801f-a18b627efb21 | Great Train Heist | L4 | (none) | no | null |
| -L4,-L6 | b01e698b-608a-4fc7-8073-b01d044743ec | Thespian's Stage | L4, L6 | (none) | no | null |
| -L6 | fb868840-09fa-49b1-85cb-b08ad065e972 | Bitterblossom | L6 | (none) | no | null |
| -L7c | 380c367f-73ea-485f-a37b-5af0ba160893 | Not Dead After All | L7c | (none) | no | null |
| -L7c | 4c6a0c30-b547-4eff-8ff4-0ca25803c076 | Urza's Saga | L7c | (none) | no | null |
| -L7c | 9b9a10ff-5a5d-4df8-88aa-18d84ff9117c | Inspiring Call | L7c | (none) | no | null |
| +L1a | 340bbe8b-e987-4c3e-ab4e-9dee63e57d4f | Phyrexian Metamorph | (none) | L1a | no | null |
| +L1a | 6c85271c-c711-49b0-a72e-9e576c33714d | Sculpting Steel | (none) | L1a | no | null |
| +L1a | 79a71fe5-38ce-4bb5-aea0-c9b9a856d397 | Mirrormade | (none) | L1a | no | null |
| +L1a | 83b43aba-bf9c-4da2-967d-9daa632e97d2 | Helm of the Host | (none) | L1a | no | null |
| +L1a | 8dcb35e5-ae44-455f-86e3-4a77d496ff34 | Spark Double | (none) | L1a | no | null |
| +L1a | b9df2cdf-397c-458d-89cf-911568737ffa | Mockingbird | (none) | L1a | no | null |
| +L1a | c97957a2-8310-4cff-8aad-871b7901d124 | Caretaker's Talent | (none) | L1a | no | null |
| +L4 | 3577c47e-76d3-4659-b922-31c4b74be3a0 | Enduring Vitality | (none) | L4 | no | null |
| +L4 | b3de29cb-7d7d-4566-b5bf-37e571bd5d78 | Enduring Courage | (none) | L4 | no | null |
| +L6 | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | L6 | no | null |
| +L6,+L7a,-L7b | 7dd189f8-a23f-4b43-b0ef-fb174a9664ba | Destiny Spinner | L7b | L6, L7a | no | null |
| +L7a | 70a6f08e-854d-4e2f-9d8c-c45ec3231157 | Faeburrow Elder | (none) | L7a | no | null |
| +L7a | 8c220dbd-6572-4715-aae6-dd09a4252d68 | Banner of Kinship | (none) | L7a | no | null |
| +L7a | a145ff8c-5812-4bcb-bd16-9839dc25121d | Storm-Kiln Artist | (none) | L7a | no | null |
| +L7a | a27445db-33f2-4571-98b5-83206b797484 | Shared Animosity | (none) | L7a | no | null |
| +L7a | a4d751e0-41c1-4e90-853d-512f385acd81 | All That Glitters | (none) | L7a | no | null |
| +L7a | dbba75f5-2404-4bd5-982b-f6c4effa5316 | Ethereal Armor | (none) | L7a | no | null |
| +L7a | dca51281-fb21-45b6-beb4-1f13397caee2 | Blackblade Reforged | (none) | L7a | no | null |
| +L7c | 1946ded1-5f53-409f-b0a6-5433bb0357d2 | The Ozolith | (none) | L7c | no | null |
| +L7c | 69ddca4b-5cc0-45f3-b2e6-a047c8d601be | Spymaster's Vault | (none) | L7c | no | null |
| +L7c | acfa77fd-3610-4f12-9c3c-bd860ce91700 | Rhythm of the Wild | (none) | L7c | no | null |

