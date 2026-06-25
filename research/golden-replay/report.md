# Golden Replay Report

Generated: 2026-06-25T13:40:32.073Z

## Summary

- Cases: 32
- PASS: 32
- FAIL: 0
- Verified: 24
- Pure scope-boundary: 5
- Runtime-gap: 3
- In-scope: 27
- Verified in-scope rate: 88.89%

## Per Deck

| Source deck | Total | Verified | Pure scope-boundary | Runtime-gap |
| --- | ---: | ---: | ---: | ---: |
| Celes | 8 | 6 | 1 | 1 |
| Gogo | 8 | 6 | 1 | 1 |
| Kefka | 8 | 6 | 2 | 0 |
| Muldrotha | 8 | 6 | 1 | 1 |

## Cases

| Case | Source deck | Result | Classification | Events | Trigger candidates | Unverifiable |
| --- | --- | --- | --- | ---: | ---: | ---: |
| Muldrotha / Baleful Strix ETB draw | Muldrotha | PASS | verified | 5 | 1 | 0 |
| Muldrotha / Ice-Fang Coatl ETB draw | Muldrotha | PASS | verified | 5 | 1 | 0 |
| Celes / Enduring Innocence watches another creature | Celes | PASS | verified | 5 | 1 | 0 |
| Celes / Liliana watches a creature die | Celes | PASS | verified | 5 | 1 | 0 |
| Celes / Karmic Guide ETB candidate | Celes | PASS | runtimeGap | 1 | 1 | 1 |
| Gogo / Rhystic Study opponent-cast boundary | Gogo | PASS | pureScopeBoundary | 0 | 0 | 1 |
| Gogo / Displacer Kitten watches a noncreature cast | Gogo | PASS | runtimeGap | 5 | 1 | 1 |
| Gogo / Coveted Jewel ETB draw three | Gogo | PASS | verified | 7 | 1 | 0 |
| Kefka / Niv-Mizzet observes a draw | Kefka | PASS | pureScopeBoundary | 2 | 1 | 1 |
| Kefka / Scrawling Crawler upkeep candidate | Kefka | PASS | pureScopeBoundary | 1 | 1 | 1 |
| Muldrotha / Tatyova landfall stack resolution | Muldrotha | PASS | runtimeGap | 3 | 1 | 1 |
| Muldrotha / Ruin Crab landfall candidate | Muldrotha | PASS | pureScopeBoundary | 1 | 1 | 1 |
| Celes / Sun Titan attack declaration boundary | Celes | PASS | pureScopeBoundary | 0 | 0 | 1 |
| Celes / Sol Ring activated mana | Celes | PASS | verified | 3 | 0 | 0 |
| Celes / Talisman of Conviction colorless mana | Celes | PASS | verified | 3 | 0 | 0 |
| Celes / Talisman of Hierarchy colorless mana | Celes | PASS | verified | 3 | 0 | 0 |
| Celes / Talisman of Indulgence colorless mana | Celes | PASS | verified | 3 | 0 | 0 |
| Gogo / Sol Ring activated mana | Gogo | PASS | verified | 3 | 0 | 0 |
| Gogo / Mana Vault activated mana | Gogo | PASS | verified | 3 | 0 | 0 |
| Gogo / Mind Stone activated mana | Gogo | PASS | verified | 3 | 0 | 0 |
| Gogo / Thought Vessel activated mana | Gogo | PASS | verified | 3 | 0 | 0 |
| Gogo / Thran Dynamo activated mana | Gogo | PASS | verified | 3 | 0 | 0 |
| Kefka / Sol Ring activated mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Kefka / Talisman of Creativity colorless mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Kefka / Talisman of Dominance colorless mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Kefka / Talisman of Indulgence colorless mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Kefka / Arena of Glory red mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Kefka / Daily Bugle Building colorless mana | Kefka | PASS | verified | 3 | 0 | 0 |
| Muldrotha / Haywire Mite death life gain | Muldrotha | PASS | verified | 4 | 1 | 0 |
| Muldrotha / Aftermath Analyst ETB mill three | Muldrotha | PASS | verified | 6 | 1 | 0 |
| Muldrotha / Doomsday Excruciator upkeep draw | Muldrotha | PASS | verified | 5 | 1 | 0 |
| Muldrotha / Sol Ring activated mana | Muldrotha | PASS | verified | 3 | 0 | 0 |

## Differences

- none

## Unverifiable Behavior

- Celes / Karmic Guide ETB candidate [runtime-gap] (src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets): The replay can emit Karmic Guide's ETB candidate, but guided target selection cannot choose a creature card in the graveyard and apply the return command.
- Gogo / Rhystic Study opponent-cast boundary [scope-boundary] (engine-spec §34.5 (opponent zones/events are unmodeled)): An opponent spell-cast event and that opponent's optional payment are outside the single-player command and zone model.
- Gogo / Displacer Kitten watches a noncreature cast [runtime-gap] (src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets): The cast watcher is detected, but the replay cannot yet answer the guided target prompt and execute Displacer Kitten's exile-and-return sequence.
- Kefka / Niv-Mizzet observes a draw [scope-boundary] (engine-spec §34.5; CR 115): Niv-Mizzet's draw trigger requires choosing any target, including a player or opponent, and player targeting remains manual in the single-player state model.
- Kefka / Scrawling Crawler upkeep candidate [scope-boundary] (engine-spec §34.5 (opponent zones are unmodeled)): The upkeep ability draws for each player, but opponent libraries, hands, and draw events are not represented by GameState.
- Muldrotha / Tatyova landfall stack resolution [runtime-gap] (src/engine/grammar/index.ts: classifyAbilityShape / src/engine/grammar/compile.ts: compileAbilityIR): The ability-word-prefixed landfall line is classified as static during stack resolution, so the otherwise auto-capable gain-life and draw atoms do not execute.
- Muldrotha / Ruin Crab landfall candidate [scope-boundary] (engine-spec §34.5 (opponent zones are unmodeled)): Ruin Crab mills each opponent, but opponent libraries and graveyards are not represented by GameState.
- Celes / Sun Titan attack declaration boundary [scope-boundary] (engine-spec §25.3 declareAttack; §34.5): Attack declaration is a store action rather than a GameCommand, so the command-sequence replay cannot produce Sun Titan's attack event.

## Notes

- Celes / Enduring Innocence watches another creature: M-GATE-2 (CR 603.6a): the runtime watcher classifier now detects the plural verb in 'one or more other creatures ... enter', so the watcher trigger candidate is auto-detected when Mother of Runes (power 1) enters.

## Measurement Notes

- Execution events are deterministic state-transition records derived before and after each `applyCommand` call.
- Trigger candidates use the same pure detector as the runtime store.
- Remaining stack items are resolved after the listed command sequence unless `autoResolveStack` is false.

