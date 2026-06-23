# Event Oracle Report

## Summary

- model: gpt-5-codex-clean-room
- generatedAt: 2026-06-23T10:40:13.094Z
- promptHash: 18a3c20ad1a39eda8a5d53fe08dcb83ae78b04f17d5068ba5be924606022b8a3
- sampleSize: 203
- comparedCount: 203
- familyDiscrepancyRate: 0.49%
- observerDiscrepancyRate: 0.00%
- interveningIfDiscrepancyRate: 0.00%
- unverifiableRate: 2.46%
- discrepancies: 1
- attributionDistribution: substrate=0, compiler=0, oracle=1, ambiguous=0, null=0
- unresolvedGold: none

## Per Family Confusion

| family | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| enters | 0 | 0 | 91 |
| leaves | 1 | 0 | 6 |
| dies | 0 | 0 | 24 |
| zone | 0 | 0 | 5 |
| cast | 0 | 0 | 25 |
| attacks | 0 | 0 | 17 |
| blocks | 0 | 0 | 0 |
| damage | 0 | 0 | 15 |
| draw | 0 | 0 | 10 |
| discard | 0 | 0 | 1 |
| sacrifice | 0 | 0 | 4 |
| tap | 0 | 0 | 2 |
| counter | 0 | 0 | 4 |
| life | 0 | 0 | 8 |
| phase | 0 | 0 | 34 |
| other | 0 | 0 | 17 |

## Per Observer Confusion

| observer | classifierOnly | oracleOnly | agreeBoth |
|---|---:|---:|---:|
| self | 0 | 0 | 142 |
| opponent | 0 | 0 | 25 |
| any | 0 | 0 | 29 |
| controlled-set | 0 | 0 | 39 |
| unknown | 0 | 0 | 0 |

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
| -leaves | 1 | Animate Dead |

## Attribution Distribution

| attribution | count |
|---|---:|
| substrate | 0 |
| compiler | 0 |
| oracle | 1 |
| ambiguous | 0 |
| null | 0 |

## Discrepancies

| delta | oracleId | name | familyClassifierOnly | familyOracleOnly | observerClassifierOnly | observerOracleOnly | if | uncertain | attribution |
|---|---|---|---|---|---|---|---|---:|---|
| -leaves | c0d8fef4-65f4-4769-982d-b397d2b7e977 | Animate Dead | leaves | (none) | (none) | (none) | agree | no | oracle |

