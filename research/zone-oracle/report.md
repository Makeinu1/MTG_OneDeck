# Zone Oracle Report

## Summary

- model: gpt-5-codex-clean-room
- generatedAt: 2026-06-24T03:48:14.155Z
- promptHash: 82483561734ebd319c35087febb592db80be60709eae239ae1b7e373d3b42720
- sampleSize: 189
- comparedCount: 187
- zoneDiscrepancyRate: 19.79%
- crossPlayerDiscrepancyRate: 6.42%
- crossPlayerClassifierOnly: 0
- crossPlayerOracleOnly: 12
- ownershipDiscrepancyRate: 5.88%
- playerScopeDiscrepancyRate: 13.90%
- unverifiableRate: 0.00%
- discrepancies: 61
- attributionDistribution: substrate=0, compiler=21, oracle=21, ambiguous=19, null=0
- unresolvedGold: none

## Per Zone Confusion

| zone | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| battlefield | 1 | 12 | 116 |
| command | 0 | 0 | 1 |
| exile | 0 | 1 | 45 |
| graveyard | 0 | 0 | 29 |
| hand | 0 | 5 | 38 |
| library | 0 | 2 | 64 |
| stack | 0 | 27 | 14 |

## Per Player Scope Confusion

| scope | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| controller | 0 | 15 | 11 |
| each-opponent | 0 | 0 | 44 |
| each-player | 1 | 0 | 12 |
| owner | 0 | 7 | 19 |
| target-player | 0 | 1 | 30 |
| unknown | 0 | 0 | 0 |
| you | 7 | 1 | 150 |

## Gold Calibration

| zone | precision | recall | support |
|---|---:|---:|---:|
| battlefield | 100.00% | 100.00% | 4 |
| command | 0.00% | 0.00% | 0 |
| exile | 100.00% | 100.00% | 2 |
| graveyard | 100.00% | 100.00% | 6 |
| hand | 100.00% | 100.00% | 8 |
| library | 100.00% | 100.00% | 5 |
| stack | 0.00% | 0.00% | 0 |

## Clusters

| signature | count | examples |
|---|---:|---|
| +stack | 12 | Etali, Primal Storm; Jeska's Will; The One Ring; Rousing Refrain; Court of Locthwain |
| +battlefield | 8 | Deadly Rollick; An Offer You Can't Refuse; Rakdos Charm; Command Beacon; Jace, the Mind Sculptor |
| +x | 6 | Chaos Warp; Windfall; Demolition Field; Assassin's Trophy; Path to Exile |
| -@you | 5 | Witch Enchanter // Witch-Blessed Meadow; Blasphemous Edict; Boggart Trawler // Boggart Bog; Ashiok, Dream Render; Portent |
| +@controller | 3 | Titania's Command; Captain N'ghathrod; Lord Skitter, Sewer King |
| +stack,@both,+@controller,+@owner | 3 | Brainstealer Dragon; Laughing Jasper Flint; Valgavoth, Terror Eater |
| +x,+@controller | 3 | Living Death; Boseiju, Who Endures; Cyclonic Rift |
| @controller | 2 | Gray Merchant of Asphodel; Urza's Saga |
| +stack,@owner,+@owner | 2 | Dauthi Voidwalker; Kefka, Dancing Mad |
| -@each-player | 1 | Nautiloid Ship |
| @both,+@controller,+@owner | 1 | Puppeteer Clique |
| +@controller,-@you | 1 | Massacre Wurm |
| +@target-player | 1 | Soul-Guide Lantern |
| +@you | 1 | Flusterstorm |
| +battlefield,+@controller | 1 | Stone of Erech |
| +battlefield,+hand,+stack,@controller | 1 | Nashi, Moon Sage's Scion |
| +battlefield,+hand,+stack,+x,@owner,+@owner | 1 | Ragavan, Nimble Pilferer |
| +battlefield,+stack,@controller | 1 | Bolas's Citadel |
| +exile,+hand,+stack | 1 | Inevitable Betrayal |
| +hand,+stack | 1 | Gix, Yawgmoth Praetor |
| +hand,+stack,+@controller | 1 | Ephemerate |
| +library,+stack | 1 | Path of Ancestry |
| +library,+x | 1 | Syr Konrad, the Grim |
| +stack,-battlefield | 1 | Gonti, Lord of Luxury |
| +stack,+@controller | 1 | Hullbreaker Horror |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 21 |
| oracle | 21 |
| ambiguous | 19 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | zoneClassifierOnly | zoneOracleOnly | crossPlayer | ownership | scopeClassifierOnly | scopeOracleOnly | uncertain | attribution |
|---|---|---|---|---|---|---|---|---|---:|---|
| -@each-player | 613a8774-165e-4cf6-ad43-124f9ffc9980 | Nautiloid Ship | (none) | (none) | agree | agree | each-player | (none) | no | ambiguous |
| -@you | 0355249a-8e4e-41db-9cea-1b901faffbe6 | Witch Enchanter // Witch-Blessed Meadow | (none) | (none) | agree | agree | you | (none) | no | ambiguous |
| -@you | 6cf50e21-0f60-4e9a-b910-ebe1bad2a29e | Blasphemous Edict | (none) | (none) | agree | agree | you | (none) | no | ambiguous |
| -@you | 727f3201-1cfc-4ab2-9dfe-be4f7251f42f | Boggart Trawler // Boggart Bog | (none) | (none) | agree | agree | you | (none) | no | ambiguous |
| -@you | 93723b12-db34-4047-885e-8606415b1553 | Ashiok, Dream Render | (none) | (none) | agree | agree | you | (none) | no | ambiguous |
| -@you | e744dbb6-2d56-462a-8d49-d79c73944048 | Portent | (none) | (none) | agree | agree | you | (none) | no | ambiguous |
| @both,+@controller,+@owner | 00e0b103-892c-49b3-836d-867fff197bbd | Puppeteer Clique | (none) | (none) | agree | classifier=controller, oracle=both | (none) | controller, owner | no | ambiguous |
| @controller | 38f3b157-0df4-409b-89cc-086e1531cd5b | Gray Merchant of Asphodel | (none) | (none) | agree | classifier=none, oracle=controller | (none) | (none) | no | oracle |
| @controller | 4c6a0c30-b547-4eff-8ff4-0ca25803c076 | Urza's Saga | (none) | (none) | agree | classifier=none, oracle=controller | (none) | (none) | no | ambiguous |
| +@controller | 7aae0a3d-8882-4485-a126-f06ea6593dcb | Titania's Command | (none) | (none) | agree | agree | (none) | controller | no | ambiguous |
| +@controller | cfb23c6b-6e4a-4fc9-b3bb-a3ddc2ba06b8 | Captain N'ghathrod | (none) | (none) | agree | agree | (none) | controller | no | ambiguous |
| +@controller | f5bed085-bb7a-4250-9599-b2a8a95e6b6f | Lord Skitter, Sewer King | (none) | (none) | agree | agree | (none) | controller | no | ambiguous |
| +@controller,-@you | 93cf50cf-0ecc-4d3e-abea-778c1ebacec4 | Massacre Wurm | (none) | (none) | agree | agree | you | controller | no | ambiguous |
| +@target-player | 1b5e6560-ff2e-4475-96cb-63f64c8a86db | Soul-Guide Lantern | (none) | (none) | agree | agree | (none) | target-player | no | compiler |
| +@you | 86bf58f2-7f25-4e10-b797-25e0e8e67769 | Flusterstorm | (none) | (none) | agree | agree | (none) | you | no | ambiguous |
| +battlefield | 0456ec64-2c81-4763-a352-8ff64a4c3d6b | Deadly Rollick | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 234a734b-ba28-4f1b-9d01-3c3e7d516590 | An Offer You Can't Refuse | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 5e62b51d-faec-4aa0-9504-cf2c282d08ea | Rakdos Charm | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 7e8c2a18-e404-40ff-a9e0-ec3eeb6d576e | Command Beacon | (none) | battlefield | agree | agree | (none) | (none) | no | oracle |
| +battlefield | 7f77a84e-5a4b-4834-aefa-3cecc175ae8e | Jace, the Mind Sculptor | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | 8ddfc283-c9b4-41a5-af88-cf0068e986cc | Swan Song | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | b1544f21-7e98-461b-aed5-e748b0168c52 | Swords to Plowshares | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield | ecc435e2-deb1-420a-a79f-01dd08747314 | Pyroblast | (none) | battlefield | agree | agree | (none) | (none) | no | compiler |
| +battlefield,+@controller | 73dad679-1edb-41c9-9d43-56dc93c3e9fe | Stone of Erech | (none) | battlefield | agree | agree | (none) | controller | no | compiler |
| +battlefield,+hand,+stack,@controller | d04b6c2c-50fc-464d-9991-230efec70d2b | Nashi, Moon Sage's Scion | (none) | battlefield, hand, stack | agree | classifier=none, oracle=controller | (none) | (none) | no | oracle |
| +battlefield,+hand,+stack,+x,@owner,+@owner | 37108cd4-bbab-4ce3-9ed6-f60e8422e703 | Ragavan, Nimble Pilferer | (none) | battlefield, hand, stack | classifier=false, oracle=true | classifier=none, oracle=owner | (none) | owner | no | compiler |
| +battlefield,+stack,@controller | 2bd111bb-ce02-414c-b5b7-e0e037d8d96b | Bolas's Citadel | (none) | battlefield, stack | agree | classifier=none, oracle=controller | (none) | (none) | no | oracle |
| +exile,+hand,+stack | aa5e9269-b1db-4bf0-a548-24f999f60e44 | Inevitable Betrayal | (none) | exile, hand, stack | agree | agree | (none) | (none) | no | oracle |
| +hand,+stack | 928d977e-cff0-4e0e-83bb-16d73a754f35 | Gix, Yawgmoth Praetor | (none) | hand, stack | agree | agree | (none) | (none) | no | oracle |
| +hand,+stack,+@controller | 0fd57894-b917-41c8-a394-360d1d31b236 | Ephemerate | (none) | hand, stack | agree | agree | (none) | controller | no | oracle |
| +library,+stack | b473e293-59e3-4e04-acf2-622604aeb25f | Path of Ancestry | (none) | library, stack | agree | agree | (none) | (none) | no | oracle |
| +library,+x | 14c3ff84-1e82-4606-a433-869fc52cc382 | Syr Konrad, the Grim | (none) | library | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +stack | 078def07-ae5d-4591-8db6-d156834aab97 | Etali, Primal Storm | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 0fd114c4-092b-4e28-b0dc-ef529f3bc73e | Jeska's Will | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 3aa83ed2-f48b-4ce6-a614-2c54ddf50538 | The One Ring | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 515c522f-51d5-4f6d-b9b1-ea3c7f6a378e | Rousing Refrain | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 6106ba65-f07b-41ec-8b59-e052bbde5529 | Court of Locthwain | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 6807167a-e290-4259-940e-3cbbfa75d0a1 | Stolen Strategy | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 6d56aeb1-0a50-46b6-abdb-cd6575a98dc3 | Praetor's Grasp | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 7a3e50a5-c163-4c41-b62d-d52c233c55b7 | Dire Fleet Daredevil | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | 89ca686a-7c72-4d8f-9290-e89635624a83 | Cavern of Souls | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | aee82122-d13e-4175-b499-9dde718e4da9 | Siphon Insight | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | c02c5547-b9c9-4b2d-9d12-e87bfba8f2d2 | Herald's Horn | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack | f8e17f4f-080d-4bba-bd05-ca27e94ccecc | Terror of the Peaks | (none) | stack | agree | agree | (none) | (none) | no | oracle |
| +stack,-battlefield | d5be0ff6-39d9-4f9f-a028-e62dc38463f2 | Gonti, Lord of Luxury | battlefield | stack | agree | agree | (none) | (none) | no | ambiguous |
| +stack,@both,+@controller,+@owner | 13cb958f-1e66-4219-901a-ff58275c8475 | Brainstealer Dragon | (none) | stack | agree | classifier=controller, oracle=both | (none) | controller, owner | no | ambiguous |
| +stack,@both,+@controller,+@owner | bd7c5a8b-cf62-41e1-a664-b16e3e5d142b | Laughing Jasper Flint | (none) | stack | agree | classifier=controller, oracle=both | (none) | controller, owner | no | ambiguous |
| +stack,@both,+@controller,+@owner | cae3ec72-436d-4086-9dcb-17b3d92ad5c4 | Valgavoth, Terror Eater | (none) | stack | agree | classifier=controller, oracle=both | (none) | controller, owner | no | ambiguous |
| +stack,@owner,+@owner | f1c2dbe2-fbe0-4058-bdf1-91d1b1832786 | Dauthi Voidwalker | (none) | stack | agree | classifier=none, oracle=owner | (none) | owner | no | ambiguous |
| +stack,@owner,+@owner | fe5690d3-547b-4ce9-8e94-77fdc0e9c5c6 | Kefka, Dancing Mad | (none) | stack | agree | classifier=none, oracle=owner | (none) | owner | no | ambiguous |
| +stack,+@controller | d4a84e78-d9b9-4c67-8a4b-4329e65f0f15 | Hullbreaker Horror | (none) | stack | agree | agree | (none) | controller | no | oracle |
| +stack,+x,+@controller,-@you | bcc6eece-75ea-494c-b33a-d4477d504e0b | Sink into Stupor // Soporific Springs | (none) | stack | classifier=false, oracle=true | agree | you | controller | no | compiler |
| +x | 07a0cba9-8768-4fd9-a3d5-b0f83b4bf8e8 | Chaos Warp | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | 08becc07-28bc-4a2f-a6b0-28a2998d2f50 | Windfall | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | 93953926-a644-49bb-9b5a-4c8f19114c7e | Demolition Field | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | ac10d218-f9a6-4058-9cda-a15ca1b0b7b5 | Assassin's Trophy | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | d683d985-9888-4d21-8b5f-69e69ce4a03b | Path to Exile | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x | edd8d1e8-be43-4c38-bb3a-83081fbaf0b5 | Thoughtseize | (none) | (none) | classifier=false, oracle=true | agree | (none) | (none) | no | compiler |
| +x,+@controller | 9e6a3df4-67a3-452e-a6ef-f04dbadb21ef | Living Death | (none) | (none) | classifier=false, oracle=true | agree | (none) | controller | no | compiler |
| +x,+@controller | bf1341dd-41a3-49f6-87ec-63170dde4324 | Boseiju, Who Endures | (none) | (none) | classifier=false, oracle=true | agree | (none) | controller | no | compiler |
| +x,+@controller | d75b9c82-1b49-4c3e-a1b5-aeef57d6644b | Cyclonic Rift | (none) | (none) | classifier=false, oracle=true | agree | (none) | controller | no | compiler |

