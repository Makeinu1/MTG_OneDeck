# Event Oracle Report

## Summary

- model: gpt-5-codex-clean-room
- generatedAt: 2026-06-23T10:40:13.094Z
- promptHash: 18a3c20ad1a39eda8a5d53fe08dcb83ae78b04f17d5068ba5be924606022b8a3
- sampleSize: 203
- comparedCount: 203
- familyDiscrepancyRate: 3.94%
- observerDiscrepancyRate: 6.40%
- interveningIfDiscrepancyRate: 0.00%
- unverifiableRate: 2.46%
- discrepancies: 20
- attributionDistribution: substrate=0, compiler=9, oracle=1, ambiguous=10, null=0
- unresolvedGold: none

## Per Family Confusion

| family | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| enters | 0 | 0 | 91 |
| leaves | 1 | 3 | 3 |
| dies | 2 | 0 | 24 |
| zone | 0 | 1 | 4 |
| cast | 0 | 1 | 24 |
| attacks | 0 | 1 | 16 |
| blocks | 0 | 0 | 0 |
| damage | 0 | 0 | 15 |
| draw | 0 | 1 | 9 |
| discard | 0 | 0 | 1 |
| sacrifice | 0 | 0 | 4 |
| tap | 0 | 0 | 2 |
| counter | 0 | 0 | 4 |
| life | 0 | 0 | 8 |
| phase | 0 | 0 | 34 |
| other | 1 | 1 | 16 |

## Per Observer Confusion

| observer | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| self | 1 | 2 | 140 |
| opponent | 1 | 0 | 25 |
| any | 3 | 9 | 20 |
| controlled-set | 0 | 0 | 39 |
| unknown | 6 | 0 | 0 |

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
| +@any,-@unknown | 6 | Utopia Sprawl; Skullclamp; Wild Growth; Fertile Ground; Sword of Feast and Famine |
| -@any | 2 | Laelia, the Blade Reforged; The Gitrog Monster |
| +leaves,-dies | 2 | Ichor Wellspring; Titania, Protector of Argoth |
| -leaves | 1 | Animate Dead |
| +@any | 1 | Blood Artist |
| +@any,-@opponent | 1 | Curiosity |
| +@any,-@self | 1 | Underworld Breach |
| +@self,-@any | 1 | Caged Sun |
| +attacks,-other | 1 | Curse of Opulence |
| +cast,+draw | 1 | Trouble in Pairs |
| +leaves | 1 | Marionette Apprentice |
| +other | 1 | Mirkwood Bats |
| +zone,+@self | 1 | Syr Konrad, the Grim |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 9 |
| oracle | 1 |
| ambiguous | 10 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | familyClassifierOnly | familyOracleOnly | observerClassifierOnly | observerOracleOnly | if | uncertain | attribution |
|---|---|---|---|---|---|---|---|---:|---|
| -@any | a0be9bb2-3234-4c6c-b8ce-0879b1f43003 | Laelia, the Blade Reforged | (none) | (none) | any | (none) | agree | no | compiler |
| -@any | a5e54d2b-aad8-4ddd-af4b-13668913762b | The Gitrog Monster | (none) | (none) | any | (none) | agree | yes | compiler |
| -leaves | c0d8fef4-65f4-4769-982d-b397d2b7e977 | Animate Dead | leaves | (none) | (none) | (none) | agree | no | oracle |
| +@any | 310f141c-7f37-4729-aed6-dd9c09db448d | Blood Artist | (none) | (none) | (none) | any | agree | no | compiler |
| +@any,-@opponent | 223fa044-d387-4884-bf4e-75f1b61c6a46 | Curiosity | (none) | (none) | opponent | any | agree | no | ambiguous |
| +@any,-@self | 27e0948b-9916-473b-8d8c-a51bdfbc7457 | Underworld Breach | (none) | (none) | self | any | agree | no | compiler |
| +@any,-@unknown | 00d8efa6-a2d9-4249-8da7-b45173675329 | Utopia Sprawl | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@any,-@unknown | 65986c1b-8e51-4604-b685-d82fa7d1263a | Skullclamp | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@any,-@unknown | 706ae742-1807-44b7-a4fa-f2e26f61519a | Wild Growth | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@any,-@unknown | cf14d4e5-5965-45ad-97f7-26facf2884b5 | Fertile Ground | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@any,-@unknown | d0901053-6de0-46d0-9ee3-8d40510236c1 | Sword of Feast and Famine | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@any,-@unknown | d79cbc61-6c15-48ea-bbba-3cffb819ccba | Sword of the Animist | (none) | (none) | unknown | any | agree | no | ambiguous |
| +@self,-@any | 09b895ff-e729-48d1-bfc1-ea5fd7adda6a | Caged Sun | (none) | (none) | any | self | agree | no | compiler |
| +attacks,-other | ba0d3df2-3acf-46d7-8d64-8d67d1579adc | Curse of Opulence | other | attacks | (none) | (none) | agree | yes | compiler |
| +cast,+draw | f349f58b-8cc8-45e4-9565-2b46fdf976c9 | Trouble in Pairs | (none) | cast, draw | (none) | (none) | agree | no | compiler |
| +leaves | 726d9d2c-736a-4852-9938-a0f50d8fd89f | Marionette Apprentice | (none) | leaves | (none) | (none) | agree | no | ambiguous |
| +leaves,-dies | 5b5ef43b-13fd-4461-8d2d-18be65e9a790 | Ichor Wellspring | dies | leaves | (none) | (none) | agree | no | ambiguous |
| +leaves,-dies | d0ade00d-a496-441d-9b7e-7dc033d3292c | Titania, Protector of Argoth | dies | leaves | (none) | (none) | agree | no | ambiguous |
| +other | 0636b6c3-0662-420a-b30d-f0a14e7c512d | Mirkwood Bats | (none) | other | (none) | (none) | agree | no | compiler |
| +zone,+@self | 14c3ff84-1e82-4606-a433-869fc52cc382 | Syr Konrad, the Grim | (none) | zone | (none) | self | agree | no | compiler |

