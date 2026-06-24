# Zone Oracle Report

## Summary

- model: gpt-5-codex-clean-room-v2
- generatedAt: 2026-06-24T04:44:38.854Z
- promptHash: e5930f9e78a75beb2f43a920c2c7075f15fbf4e3325f9c6d5633f2d41d7ccca9
- sampleSize: 189
- comparedCount: 187
- zoneDiscrepancyRate: 10.70%
- crossPlayerDiscrepancyRate: 0.00%
- crossPlayerClassifierOnly: 0
- crossPlayerOracleOnly: 0
- ownershipDiscrepancyRate: 2.67%
- playerScopeDiscrepancyRate: 10.70%
- unverifiableRate: 11.64%
- discrepancies: 38
- attributionDistribution: substrate=0, compiler=17, oracle=14, ambiguous=7, null=0
- unresolvedGold: none

## Per Zone Confusion

| zone | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| battlefield | 1 | 11 | 132 |
| command | 0 | 0 | 1 |
| exile | 0 | 1 | 45 |
| graveyard | 1 | 0 | 38 |
| hand | 0 | 4 | 53 |
| library | 0 | 2 | 76 |
| stack | 0 | 2 | 14 |

## Per Player Scope Confusion

| scope | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| controller | 3 | 0 | 8 |
| each-opponent | 3 | 0 | 41 |
| each-player | 3 | 0 | 10 |
| owner | 0 | 6 | 19 |
| target-player | 0 | 0 | 30 |
| unknown | 0 | 0 | 0 |
| you | 6 | 1 | 152 |

## Gold Calibration

| zone | precision | recall | support |
|---|---:|---:|---:|
| battlefield | 57.14% | 100.00% | 4 |
| command | 0.00% | 0.00% | 0 |
| exile | 100.00% | 100.00% | 2 |
| graveyard | 75.00% | 100.00% | 6 |
| hand | 88.89% | 100.00% | 8 |
| library | 83.33% | 100.00% | 5 |
| stack | 0.00% | 0.00% | 0 |

## Clusters

| signature | count | examples |
|---|---:|---|
| +battlefield | 9 | Teferi's Protection; Jeska's Will; Bolas's Citadel; Gaea's Anthem; Stone of Erech |
| -@you | 5 | Gitaxian Probe; Blasphemous Edict; Boggart Trawler // Boggart Bog; Mana Drain; Massacre Wurm |
| +@owner | 3 | Brainstealer Dragon; Dauthi Voidwalker; Kefka, Dancing Mad |
| -@controller | 2 | Demolition Field; Assassin's Trophy |
| -@each-player | 2 | Professional Face-Breaker; Nautiloid Ship |
| @controller | 2 | Gray Merchant of Asphodel; Urza's Saga |
| +stack | 2 | Sink into Stupor // Soporific Springs; Hullbreaker Horror |
| -@controller,-@you | 1 | Ashiok, Dream Render |
| -@each-opponent | 1 | Impact Tremors |
| -battlefield | 1 | Gonti, Lord of Luxury |
| -graveyard,-@each-opponent | 1 | Gix, Yawgmoth Praetor |
| @both,+@owner | 1 | Puppeteer Clique |
| +@you | 1 | Cavern of Souls |
| +battlefield,+@owner | 1 | Laughing Jasper Flint |
| +battlefield,+hand,@controller | 1 | Nashi, Moon Sage's Scion |
| +exile,+hand | 1 | Inevitable Betrayal |
| +hand | 1 | Ephemerate |
| +hand,@owner,+@owner,-@each-player | 1 | Ragavan, Nimble Pilferer |
| +library | 1 | Path of Ancestry |
| +library,-@each-opponent | 1 | Syr Konrad, the Grim |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 17 |
| oracle | 14 |
| ambiguous | 7 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | zoneClassifierOnly | zoneOracleOnly | crossPlayer | ownership | scopeClassifierOnly | scopeOracleOnly | uncertain | attribution |
|---|---|---|---|---|---|---|---|---|---:|---|
| -@controller | 93953926-a644-49bb-9b5a-4c8f19114c7e | Demolition Field | (none) | (none) | agree | agree | controller | (none) | no | oracle |
| -@controller | ac10d218-f9a6-4058-9cda-a15ca1b0b7b5 | Assassin's Trophy | (none) | (none) | agree | agree | controller | (none) | no | oracle |
| -@controller,-@you | 93723b12-db34-4047-885e-8606415b1553 | Ashiok, Dream Render | (none) | (none) | agree | agree | controller, you | (none) | no | ambiguous |
| -@each-opponent | 9242cd3e-1a71-4700-8182-9c1005616033 | Impact Tremors | (none) | (none) | agree | agree | each-opponent | (none) | no | oracle |
| -@each-player | 04152e7a-969c-4858-841b-0a569a9fc1bf | Professional Face-Breaker | (none) | (none) | agree | agree | each-player | (none) | no | oracle |
| -@each-player | 613a8774-165e-4cf6-ad43-124f9ffc9980 | Nautiloid Ship | (none) | (none) | agree | agree | each-player | (none) | no | oracle |
| -@you | 1d67f5ff-1fce-45e5-b6a1-416c569351e2 | Gitaxian Probe | (none) | (none) | agree | agree | you | (none) | no | compiler |
| -@you | 6cf50e21-0f60-4e9a-b910-ebe1bad2a29e | Blasphemous Edict | (none) | (none) | agree | agree | you | (none) | no | oracle |
| -@you | 727f3201-1cfc-4ab2-9dfe-be4f7251f42f | Boggart Trawler // Boggart Bog | (none) | (none) | agree | agree | you | (none) | no | oracle |
| -@you | 74d3277a-38e5-4732-afed-084a56148f20 | Mana Drain | (none) | (none) | agree | agree | you | (none) | no | oracle |
| -@you | 93cf50cf-0ecc-4d3e-abea-778c1ebacec4 | Massacre Wurm | (none) | (none) | agree | agree | you | (none) | yes | compiler |
| -battlefield | d5be0ff6-39d9-4f9f-a028-e62dc38463f2 | Gonti, Lord of Luxury | battlefield | (none) | agree | agree | (none) | (none) | no | oracle |
| -graveyard,-@each-opponent | 928d977e-cff0-4e0e-83bb-16d73a754f35 | Gix, Yawgmoth Praetor | graveyard | (none) | agree | agree | each-opponent | (none) | no | compiler |
| @both,+@owner | 00e0b103-892c-49b3-836d-867fff197bbd | Puppeteer Clique | (none) | (none) | agree | classifier=controller, oracle=both | (none) | owner | no | ambiguous |
| @controller | 38f3b157-0df4-409b-89cc-086e1531cd5b | Gray Merchant of Asphodel | (none) | (none) | agree | classifier=none, oracle=controller | (none) | (none) | no | oracle |
| @controller | 4c6a0c30-b547-4eff-8ff4-0ca25803c076 | Urza's Saga | (none) | (none) | agree | classifier=none, oracle=controller | (none) | (none) | no | ambiguous |
| +@owner | 13cb958f-1e66-4219-901a-ff58275c8475 | Brainstealer Dragon | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@owner | f1c2dbe2-fbe0-4058-bdf1-91d1b1832786 | Dauthi Voidwalker | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@owner | fe5690d3-547b-4ce9-8e94-77fdc0e9c5c6 | Kefka, Dancing Mad | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@you | 89ca686a-7c72-4d8f-9290-e89635624a83 | Cavern of Souls | (none) | (none) | agree | agree | (none) | you | no | ambiguous |
| +battlefield | 0d4ecdb1-ec90-497f-a7a4-1c68092b8757 | Teferi's Protection | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 0fd114c4-092b-4e28-b0dc-ef529f3bc73e | Jeska's Will | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 2bd111bb-ce02-414c-b5b7-e0e037d8d96b | Bolas's Citadel | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 3754dce0-3e97-406f-8807-a4942a222c41 | Gaea's Anthem | (none) | battlefield | agree | agree | (none) | (none) | no | oracle |
| +battlefield | 73dad679-1edb-41c9-9d43-56dc93c3e9fe | Stone of Erech | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 7c779721-cd1b-4696-9ae9-68ccc284ed2a | Aetherize | (none) | battlefield | agree | agree | (none) | (none) | yes | compiler |
| +battlefield | cd0d7141-46d2-4aa3-bc77-6b3b4513803e | Control Magic | (none) | battlefield | agree | agree | (none) | (none) | no | oracle |
| +battlefield | d09c9cba-fdd2-479b-ad5d-d05181c3e3f9 | Fierce Guardianship | (none) | battlefield | agree | agree | (none) | (none) | no | oracle |
| +battlefield | d2d9ecea-7925-420e-98b9-2f87f41f387c | Land Tax | (none) | battlefield | agree | agree | (none) | (none) | no | oracle |
| +battlefield,+@owner | bd7c5a8b-cf62-41e1-a664-b16e3e5d142b | Laughing Jasper Flint | (none) | battlefield | agree | agree | (none) | owner | no | compiler |
| +battlefield,+hand,@controller | d04b6c2c-50fc-464d-9991-230efec70d2b | Nashi, Moon Sage's Scion | (none) | battlefield, hand | agree | classifier=none, oracle=controller | (none) | (none) | no | compiler |
| +exile,+hand | aa5e9269-b1db-4bf0-a548-24f999f60e44 | Inevitable Betrayal | (none) | exile, hand | agree | agree | (none) | (none) | no | compiler |
| +hand | 0fd57894-b917-41c8-a394-360d1d31b236 | Ephemerate | (none) | hand | agree | agree | (none) | (none) | no | compiler |
| +hand,@owner,+@owner,-@each-player | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | hand | agree | classifier=none, oracle=owner | each-player | owner | no | compiler |
| +library | b473e293-59e3-4e04-acf2-622604aeb25f | Path of Ancestry | (none) | library | agree | agree | (none) | (none) | no | compiler |
| +library,-@each-opponent | 14c3ff84-1e82-4606-a433-869fc52cc382 | Syr Konrad, the Grim | (none) | library | agree | agree | each-opponent | (none) | no | compiler |
| +stack | bcc6eece-75ea-494c-b33a-d4477d504e0b | Sink into Stupor // Soporific Springs | (none) | stack | classifier=true, oracle=false | agree | (none) | (none) | yes | compiler |
| +stack | d4a84e78-d9b9-4c67-8a4b-4329e65f0f15 | Hullbreaker Horror | (none) | stack | classifier=true, oracle=false | agree | (none) | (none) | yes | compiler |

