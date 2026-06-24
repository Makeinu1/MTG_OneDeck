# Golden Replay Report

Generated: 2026-06-24T11:23:28.089Z

## Summary

- Cases: 13
- PASS: 13
- FAIL: 0
- Cases with unverifiable behavior: 9 (69.23%)

| Case | Source deck | Result | Events | Trigger candidates | Limitations |
| --- | --- | --- | ---: | ---: | ---: |
| Muldrotha / Baleful Strix ETB draw | Muldrotha | PASS | 5 | 1 | 0 |
| Muldrotha / Ice-Fang Coatl ETB draw | Muldrotha | PASS | 5 | 1 | 0 |
| Celes / Enduring Innocence watches another creature | Celes | PASS | 5 | 0 | 1 |
| Celes / Liliana watches a creature die | Celes | PASS | 5 | 1 | 0 |
| Celes / Karmic Guide ETB candidate | Celes | PASS | 1 | 1 | 1 |
| Gogo / Rhystic Study watches a cast | Gogo | PASS | 3 | 1 | 1 |
| Gogo / Displacer Kitten watches a noncreature cast | Gogo | PASS | 5 | 1 | 1 |
| Gogo / Coveted Jewel ETB draw three | Gogo | PASS | 7 | 1 | 0 |
| Kefka / Niv-Mizzet observes a draw | Kefka | PASS | 2 | 1 | 1 |
| Kefka / Scrawling Crawler upkeep candidate | Kefka | PASS | 1 | 1 | 1 |
| Muldrotha / Tatyova landfall stack resolution | Muldrotha | PASS | 3 | 1 | 1 |
| Muldrotha / Ruin Crab landfall candidate | Muldrotha | PASS | 1 | 1 | 1 |
| Celes / Sun Titan ETB with attack-path gap | Celes | PASS | 1 | 1 | 2 |

## Differences

- none

## Unverifiable Behavior

- Celes / Enduring Innocence watches another creature: The runtime watcher classifier currently misses the singular verb in 'one or more other creatures ... enter'; the manually stacked ability still resolves.
- Celes / Karmic Guide ETB candidate: Target selection and returning a graveyard creature are guided/manual, so only candidate emission is measured.
- Gogo / Rhystic Study watches a cast: The opponent-payment choice and Rhystic Study draw are not placed on the stack in this case.
- Gogo / Displacer Kitten watches a noncreature cast: Displacer Kitten target selection and blink resolution are guided/manual and are not expected.
- Kefka / Niv-Mizzet observes a draw: The damage target for Niv-Mizzet's draw trigger is guided/manual, so resolution is not expected.
- Kefka / Scrawling Crawler upkeep candidate: Opponent draw and opponent life are not represented as command targets, so the upkeep ability is not resolved.
- Muldrotha / Tatyova landfall stack resolution: The compound 'gain life and draw' effect currently compiles as non-auto, so stack removal is measured without life or draw changes.
- Muldrotha / Ruin Crab landfall candidate: Opponent libraries are not modeled in GameState, so opponent mill is not expected.
- Celes / Sun Titan ETB with attack-path gap: Attack declaration is a store action rather than a GameCommand, so the attack half is recorded as unverifiable by this command-sequence harness.
- Celes / Sun Titan ETB with attack-path gap: Target selection and returning a graveyard permanent are guided/manual, so resolution is not expected.

## Measurement Notes

- Execution events are deterministic state-transition records derived before and after each `applyCommand` call.
- Trigger candidates use the same pure detector as the runtime store.
- Remaining stack items are resolved after the listed command sequence unless `autoResolveStack` is false.

