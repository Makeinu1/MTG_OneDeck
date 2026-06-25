# Classifier Parity Report

Generated: 2026-06-25T02:42:23.021Z

## Summary

- Snapshot cards: 17491
- Mapped cards: 17491
- Mapping failures: 0
- Comparable cards: 6448
- Divergent cards: 0 (0.00%)
- Comparable family checks: 7154
- Mismatched family checks: 0 (0.00%)
- Direction: research-only 0, runtime-only 0

## Mapping

| Research EventFamily | Runtime RuleTag | Rationale |
| --- | --- | --- |
| enters | `trigger.etb`, `trigger.etb-other`, `trigger.landfall` | Runtime splits self, watcher, and landfall entry triggers. |
| dies | `trigger.death`, `trigger.death-other` | Runtime splits self-death and watcher death triggers. |
| leaves | `trigger.leaves`, `trigger.leaves-other` | Runtime splits self and watcher leaves-the-battlefield triggers (CR 603.6c). |
| cast | `trigger.cast`, `trigger.cast-watcher` | Runtime splits spell-local and battlefield watcher cast triggers. |
| attacks | `trigger.attack`, `trigger.attack-watcher` | Runtime splits attacker-local and battlefield watcher attack triggers. |
| draw | `trigger.draw` | Both sides represent draw-trigger conditions. |
| sacrifice | `trigger.sacrifice` | Both sides represent sacrifice-trigger conditions. |

## Allowed Differences

| Axis | Research classifier | Runtime classifier | Rationale |
| --- | --- | --- | --- |
| observer | ObserverScope(any/controlled-set/opponent/self/unknown) | no observer axis | Runtime trigger tags encode event kind, not observer scope. |
| risk/layer/confidence | no risk or automation metadata | RuleRisk, RuleAutomationLayer, confidence | Metadata axes are intentionally outside event-family parity. |
| unmapped event families | zone, blocks, discard, tap, counter, life, other | no corresponding trigger tags | Runtime has no same-granularity trigger tag for these families. |
| phase | all beginning-of phase/step triggers | trigger.upkeep and trigger.end-step only | Research phase is broader than the two runtime phase tags. |
| damage | combat and noncombat damage triggers | trigger.combat-damage only | Research damage is broader than runtime combat damage. |

## Per-family Divergence

| Family | Checks | Mismatches | Rate | Research only | Runtime only |
| --- | ---: | ---: | ---: | ---: | ---: |
| enters | 3736 | 0 | 0.00% | 0 | 0 |
| dies | 775 | 0 | 0.00% | 0 | 0 |
| leaves | 204 | 0 | 0.00% | 0 | 0 |
| cast | 878 | 0 | 0.00% | 0 | 0 |
| attacks | 1349 | 0 | 0.00% | 0 | 0 |
| draw | 116 | 0 | 0.00% | 0 | 0 |
| sacrifice | 96 | 0 | 0.00% | 0 | 0 |

## Mismatch Examples (top 30)

| Card | EDHREC rank | Direction/family | Research families | Runtime trigger tags |
| --- | ---: | --- | --- | --- |

## All Mismatch Cards

- none

## Notes

- Divergence is measured only for mapped event families; allowed axes are excluded from numerator and denominator.
- A mapped family agrees when the research family presence equals the presence of any corresponding runtime tag.
- `report.json` contains every card comparison and mismatch record for machine analysis.

