# Zone Oracle Report

## Summary

- model: gpt-5-codex-clean-room-v4
- generatedAt: 2026-06-24T11:02:33.782Z
- promptHash: 180d5bcdbe0d6b9800fd6683f37f22db65acfeb84130cc339463902c301a9756
- sampleSize: 189
- comparedCount: 187
- zoneDiscrepancyRate: 7.49%
- crossPlayerDiscrepancyRate: 2.67%
- crossPlayerClassifierOnly: 0
- crossPlayerOracleOnly: 5
- ownershipDiscrepancyRate: 2.67%
- playerScopeDiscrepancyRate: 10.16%
- unverifiableRate: 5.82%
- discrepancies: 36
- attributionDistribution: substrate=0, compiler=16, oracle=4, ambiguous=9, null=7
- unresolvedGold: none

## Per Zone Confusion

| zone | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| battlefield | 1 | 4 | 140 |
| command | 0 | 0 | 1 |
| exile | 0 | 1 | 45 |
| graveyard | 0 | 2 | 68 |
| hand | 0 | 4 | 53 |
| library | 0 | 2 | 76 |
| stack | 0 | 2 | 14 |

## Per Player Scope Confusion

| scope | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| controller | 3 | 0 | 8 |
| each-opponent | 1 | 0 | 43 |
| each-player | 1 | 0 | 12 |
| owner | 0 | 6 | 19 |
| target-player | 0 | 1 | 30 |
| unknown | 0 | 0 | 0 |
| you | 4 | 6 | 154 |

## Gold Calibration

| zone | precision | recall | support |
|---|---:|---:|---:|
| battlefield | 80.00% | 100.00% | 4 |
| command | 0.00% | 0.00% | 0 |
| exile | 100.00% | 100.00% | 2 |
| graveyard | 75.00% | 100.00% | 6 |
| hand | 88.89% | 100.00% | 8 |
| library | 83.33% | 100.00% | 5 |
| stack | 0.00% | 0.00% | 0 |

## Clusters

| signature | count | examples |
|---|---:|---|
| +@you | 5 | Soul-Guide Lantern; Mishra's Bauble; Stone of Erech; Flusterstorm; Cavern of Souls |
| +@owner | 4 | Brainstealer Dragon; Laughing Jasper Flint; Dauthi Voidwalker; Kefka, Dancing Mad |
| +battlefield | 3 | Teferi's Protection; Sensei's Divining Top; Aetherize |
| +x | 3 | Witch Enchanter // Witch-Blessed Meadow; The Meathook Massacre; Accursed Marauder |
| +library | 2 | Syr Konrad, the Grim; Path of Ancestry |
| +stack | 2 | Sink into Stupor // Soporific Springs; Hullbreaker Horror |
| +x,-@you | 2 | Blasphemous Edict; Massacre Wurm |
| -@controller | 1 | Demolition Field |
| -@controller,-@you | 1 | Ashiok, Dream Render |
| -@each-player | 1 | Nautiloid Ship |
| -@you | 1 | Boggart Trawler // Boggart Bog |
| -battlefield | 1 | Blasphemous Act |
| @both,+@owner | 1 | Puppeteer Clique |
| @controller | 1 | Gray Merchant of Asphodel |
| +@target-player,-@each-opponent | 1 | Lord Skitter, Sewer King |
| +@you,-@controller | 1 | Assassin's Trophy |
| +battlefield,+hand,@controller | 1 | Nashi, Moon Sage's Scion |
| +exile,+hand | 1 | Inevitable Betrayal |
| +graveyard | 1 | An Offer You Can't Refuse |
| +graveyard,@controller | 1 | Urza's Saga |
| +hand | 1 | Ephemerate |
| +hand,@owner,+@owner | 1 | Ragavan, Nimble Pilferer |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 16 |
| oracle | 4 |
| ambiguous | 9 |
| null | 7 |

## Discrepancies

| delta | oracleId | name | zoneClassifierOnly | zoneOracleOnly | crossPlayer | ownership | scopeClassifierOnly | scopeOracleOnly | uncertain | attribution |
|---|---|---|---|---|---|---|---|---|---:|---|
| -@controller | 93953926-a644-49bb-9b5a-4c8f19114c7e | Demolition Field | (none) | (none) | agree | agree | controller | (none) | no | null |
| -@controller,-@you | 93723b12-db34-4047-885e-8606415b1553 | Ashiok, Dream Render | (none) | (none) | agree | agree | controller, you | (none) | no | oracle |
| -@each-player | 613a8774-165e-4cf6-ad43-124f9ffc9980 | Nautiloid Ship | (none) | (none) | agree | agree | each-player | (none) | no | oracle |
| -@you | 727f3201-1cfc-4ab2-9dfe-be4f7251f42f | Boggart Trawler // Boggart Bog | (none) | (none) | agree | agree | you | (none) | no | null |
| -battlefield | 7a2484a9-04fd-41a0-8224-610c1c07ed10 | Blasphemous Act | battlefield | (none) | agree | agree | (none) | (none) | no | oracle |
| @both,+@owner | 00e0b103-892c-49b3-836d-867fff197bbd | Puppeteer Clique | (none) | (none) | agree | classifier=controller, oracle=both | (none) | owner | no | ambiguous |
| @controller | 38f3b157-0df4-409b-89cc-086e1531cd5b | Gray Merchant of Asphodel | (none) | (none) | agree | classifier=none, oracle=controller | (none) | (none) | no | ambiguous |
| +@owner | 13cb958f-1e66-4219-901a-ff58275c8475 | Brainstealer Dragon | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@owner | bd7c5a8b-cf62-41e1-a664-b16e3e5d142b | Laughing Jasper Flint | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@owner | f1c2dbe2-fbe0-4058-bdf1-91d1b1832786 | Dauthi Voidwalker | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@owner | fe5690d3-547b-4ce9-8e94-77fdc0e9c5c6 | Kefka, Dancing Mad | (none) | (none) | agree | agree | (none) | owner | no | ambiguous |
| +@target-player,-@each-opponent | f5bed085-bb7a-4250-9599-b2a8a95e6b6f | Lord Skitter, Sewer King | (none) | (none) | agree | agree | each-opponent | target-player | no | null |
| +@you | 1b5e6560-ff2e-4475-96cb-63f64c8a86db | Soul-Guide Lantern | (none) | (none) | agree | agree | (none) | you | no | compiler |
| +@you | 63afc3d1-7653-476e-838f-fc18d4a62a21 | Mishra's Bauble | (none) | (none) | agree | agree | (none) | you | no | compiler |
| +@you | 73dad679-1edb-41c9-9d43-56dc93c3e9fe | Stone of Erech | (none) | (none) | agree | agree | (none) | you | no | compiler |
| +@you | 86bf58f2-7f25-4e10-b797-25e0e8e67769 | Flusterstorm | (none) | (none) | agree | agree | (none) | you | no | compiler |
| +@you | 89ca686a-7c72-4d8f-9290-e89635624a83 | Cavern of Souls | (none) | (none) | agree | agree | (none) | you | no | compiler |
| +@you,-@controller | ac10d218-f9a6-4058-9cda-a15ca1b0b7b5 | Assassin's Trophy | (none) | (none) | agree | agree | controller | you | no | null |
| +battlefield | 0d4ecdb1-ec90-497f-a7a4-1c68092b8757 | Teferi's Protection | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 13575cf9-65c1-4861-b21e-eb2155e07766 | Sensei's Divining Top | (none) | battlefield | agree | agree | (none) | (none) | no | null |
| +battlefield | 7c779721-cd1b-4696-9ae9-68ccc284ed2a | Aetherize | (none) | battlefield | agree | agree | (none) | (none) | yes | compiler |
| +battlefield,+hand,@controller | d04b6c2c-50fc-464d-9991-230efec70d2b | Nashi, Moon Sage's Scion | (none) | battlefield, hand | agree | classifier=none, oracle=controller | (none) | (none) | no | ambiguous |
| +exile,+hand | aa5e9269-b1db-4bf0-a548-24f999f60e44 | Inevitable Betrayal | (none) | exile, hand | agree | agree | (none) | (none) | no | compiler |
| +graveyard | 234a734b-ba28-4f1b-9d01-3c3e7d516590 | An Offer You Can't Refuse | (none) | graveyard | agree | agree | (none) | (none) | yes | null |
| +graveyard,@controller | 4c6a0c30-b547-4eff-8ff4-0ca25803c076 | Urza's Saga | (none) | graveyard | agree | classifier=none, oracle=controller | (none) | (none) | no | ambiguous |
| +hand | 0fd57894-b917-41c8-a394-360d1d31b236 | Ephemerate | (none) | hand | agree | agree | (none) | (none) | no | compiler |
| +hand,@owner,+@owner | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | hand | agree | classifier=none, oracle=owner | (none) | owner | no | ambiguous |
| +library | 14c3ff84-1e82-4606-a433-869fc52cc382 | Syr Konrad, the Grim | (none) | library | agree | agree | (none) | (none) | no | compiler |
| +library | b473e293-59e3-4e04-acf2-622604aeb25f | Path of Ancestry | (none) | library | agree | agree | (none) | (none) | no | compiler |
| +stack | bcc6eece-75ea-494c-b33a-d4477d504e0b | Sink into Stupor // Soporific Springs | (none) | stack | agree | agree | (none) | (none) | no | compiler |
| +stack | d4a84e78-d9b9-4c67-8a4b-4329e65f0f15 | Hullbreaker Horror | (none) | stack | agree | agree | (none) | (none) | no | compiler |
| +x | 0355249a-8e4e-41db-9cea-1b901faffbe6 | Witch Enchanter // Witch-Blessed Meadow | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | 127de52b-df75-4342-95a0-20d84c5bf916 | The Meathook Massacre | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | d8ad23a1-0b43-48ea-9fbe-d89b29194509 | Accursed Marauder | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | null |
| +x,-@you | 6cf50e21-0f60-4e9a-b910-ebe1bad2a29e | Blasphemous Edict | (none) | (none) | classifier=false, oracle=true | agree | you | (none) | no | oracle |
| +x,-@you | 93cf50cf-0ecc-4d3e-abea-778c1ebacec4 | Massacre Wurm | (none) | (none) | classifier=false, oracle=true | agree | you | (none) | no | compiler |

