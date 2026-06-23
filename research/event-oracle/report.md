# Event Oracle Report

## Summary

- model: gpt-5-codex-clean-room
- generatedAt: 2026-06-23T00:00:00.000Z
- promptHash: d17ce0f0f5779177f82f7d0bb6e7f1a5d2c07f7937c2d57d605317135b6736b8
- sampleSize: 203
- comparedCount: 203
- familyDiscrepancyRate: 7.88%
- observerDiscrepancyRate: 12.32%
- interveningIfDiscrepancyRate: 0.00%
- unverifiableRate: 0.00%
- discrepancies: 29
- attributionDistribution: substrate=0, compiler=0, oracle=28, ambiguous=1, null=0
- unresolvedGold: none

## Per Family Confusion

| family | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| enters | 0 | 0 | 91 |
| leaves | 0 | 0 | 4 |
| dies | 0 | 0 | 26 |
| zone | 0 | 0 | 4 |
| cast | 0 | 0 | 24 |
| attacks | 0 | 0 | 16 |
| blocks | 0 | 0 | 0 |
| damage | 0 | 0 | 15 |
| draw | 1 | 0 | 8 |
| discard | 0 | 0 | 1 |
| sacrifice | 0 | 0 | 4 |
| tap | 0 | 3 | 2 |
| counter | 0 | 0 | 4 |
| life | 0 | 0 | 8 |
| phase | 0 | 12 | 34 |
| other | 3 | 0 | 14 |

## Per Observer Confusion

| observer | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| self | 6 | 3 | 135 |
| opponent | 0 | 0 | 26 |
| any | 1 | 14 | 22 |
| controlled-set | 0 | 1 | 39 |
| unknown | 1 | 7 | 6 |

## Gold Calibration

| family | precision | recall | support |
|---|---:|---:|---:|
| enters | 100.00% | 100.00% | 6 |
| leaves | 0.00% | 0.00% | 0 |
| dies | 100.00% | 100.00% | 4 |
| zone | 0.00% | 0.00% | 0 |
| cast | 100.00% | 100.00% | 4 |
| attacks | 0.00% | 0.00% | 0 |
| blocks | 0.00% | 0.00% | 0 |
| damage | 0.00% | 0.00% | 0 |
| draw | 100.00% | 100.00% | 1 |
| discard | 100.00% | 100.00% | 1 |
| sacrifice | 0.00% | 0.00% | 0 |
| tap | 0.00% | 0.00% | 0 |
| counter | 100.00% | 100.00% | 1 |
| life | 0.00% | 0.00% | 0 |
| phase | 100.00% | 100.00% | 3 |
| other | 100.00% | 100.00% | 1 |

## Clusters

| signature | count | examples |
|---|---:|---|
| +phase,+@any | 11 | Professional Face-Breaker; Kutzil, Malamet Exemplar; Ragavan, Nimble Pilferer; Ancient Copper Dragon; Etali, Primal Conqueror // Etali, Primal Sickness |
| +@unknown,-@self | 5 | Black Market; Underworld Breach; Ripples of Undeath; Black Market Connections; Pact of Negation |
| +@self | 3 | Kindred Discovery; Dragon Tempest; Trouble in Pairs |
| +tap,-other | 3 | Forsaken Monument; Mirari's Wake; Crypt Ghast |
| +@any | 2 | Thopter Spy Network; Hellkite Tyrant |
| -draw | 1 | Orcish Bowmasters |
| +@controlled-set,-@self | 1 | Terrasymbiosis |
| +@unknown | 1 | Rosie Cotton of South Lane |
| +@unknown,-@any | 1 | Kardur, Doomscourge |
| +phase,+@any,-@unknown | 1 | Sword of Feast and Famine |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 0 |
| oracle | 28 |
| ambiguous | 1 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | familyClassifierOnly | familyOracleOnly | observerClassifierOnly | observerOracleOnly | if | uncertain | attribution |
|---|---|---|---|---|---|---|---|---:|---|
| -draw | ea5103f5-27e0-4eb1-902c-7f34652d6bf3 | Orcish Bowmasters | draw | (none) | (none) | (none) | agree | no | oracle |
| +@any | 49be65fd-3755-410d-b0dc-2e5861ea2552 | Thopter Spy Network | (none) | (none) | (none) | any | agree | no | oracle |
| +@any | d9b066ff-9519-415c-ae17-bfea703c9889 | Hellkite Tyrant | (none) | (none) | (none) | any | agree | no | oracle |
| +@controlled-set,-@self | 4ac94586-3ac7-4ade-af31-ad0d0e3ffc4a | Terrasymbiosis | (none) | (none) | self | controlled-set | agree | no | ambiguous |
| +@self | 005ee549-1bf5-478f-bc3f-3e791bd7eecf | Kindred Discovery | (none) | (none) | (none) | self | agree | no | oracle |
| +@self | b9bacb46-fd1d-459b-81c2-d7d08fe73848 | Dragon Tempest | (none) | (none) | (none) | self | agree | no | oracle |
| +@self | f349f58b-8cc8-45e4-9565-2b46fdf976c9 | Trouble in Pairs | (none) | (none) | (none) | self | agree | no | oracle |
| +@unknown | 168d5711-4459-440f-8de4-aabffd47c44d | Rosie Cotton of South Lane | (none) | (none) | (none) | unknown | agree | no | oracle |
| +@unknown,-@any | bc14356c-3a1a-47af-9a6e-2b449de0331f | Kardur, Doomscourge | (none) | (none) | any | unknown | agree | no | oracle |
| +@unknown,-@self | 21338b71-37f5-4121-9b84-565025ebcd17 | Black Market | (none) | (none) | self | unknown | agree | no | oracle |
| +@unknown,-@self | 27e0948b-9916-473b-8d8c-a51bdfbc7457 | Underworld Breach | (none) | (none) | self | unknown | agree | no | oracle |
| +@unknown,-@self | 2acf8e34-9215-4a72-a24f-09d3bdd0083a | Ripples of Undeath | (none) | (none) | self | unknown | agree | no | oracle |
| +@unknown,-@self | d2664f28-49e1-46f8-a863-b217e961a57c | Black Market Connections | (none) | (none) | self | unknown | agree | no | oracle |
| +@unknown,-@self | f3e213a4-ba5a-468a-93b3-c0a34e1bd725 | Pact of Negation | (none) | (none) | self | unknown | agree | no | oracle |
| +phase,+@any | 04152e7a-969c-4858-841b-0a569a9fc1bf | Professional Face-Breaker | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | 3233af43-7826-4895-b67e-03c6102c2cd5 | Kutzil, Malamet Exemplar | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | 48daee9d-ddaf-410f-8c3a-12fa1064ab56 | Ancient Copper Dragon | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | 7514e401-7aa1-405d-9f7a-312b4e630cc2 | Etali, Primal Conqueror // Etali, Primal Sickness | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | 9d2460c3-8eeb-4f35-b6f6-748c478664c7 | Enduring Curiosity | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | a8e707ec-ce77-4bc5-8c76-5ea3e81e8c7f | Toski, Bearer of Secrets | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | b99ada26-9a61-4175-9fb8-15a106960220 | Ohran Frostfang | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | d69b1e68-8d8e-460b-9eb4-6a68be886197 | Kodama of the West Tree | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | e1afaef7-9fa3-4662-a95f-adfb0da9fd11 | Bident of Thassa | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any | eac94269-4baa-4b8e-a0fd-d6b227d1cde3 | Thrummingbird | (none) | phase | (none) | any | agree | no | oracle |
| +phase,+@any,-@unknown | d0901053-6de0-46d0-9ee3-8d40510236c1 | Sword of Feast and Famine | (none) | phase | unknown | any | agree | no | oracle |
| +tap,-other | 7777fab1-df3f-467f-b9e2-46dd2bd2166e | Forsaken Monument | other | tap | (none) | (none) | agree | no | oracle |
| +tap,-other | 852657c0-18a4-4b28-b9ae-7728acdb5044 | Mirari's Wake | other | tap | (none) | (none) | agree | no | oracle |
| +tap,-other | a3c8d817-7949-4dae-b9f5-f9d952479270 | Crypt Ghast | other | tap | (none) | (none) | agree | no | oracle |

