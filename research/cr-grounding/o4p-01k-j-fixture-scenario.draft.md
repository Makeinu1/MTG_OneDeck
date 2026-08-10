# O4P-01K-J Fixture and Scenario Assets

Status: implemented-not-integrated
Base: `COORDINATOR_SHA=527c7bd89871a5df3220a7efec2109bdb65a076c`
Scope: additive fixture JSON and ordinary scenario tests only.

## Fixture

`src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json` reuses the
O4P-01J canonical `PC*` and synthetic stack object IDs and public
Registry/Runtime/Announcement shapes. It contains four seated players with
`P2` active, an upkeep SBA boundary, a nonempty mixed stack, and five pending
trigger records. The pending records cover all four controllers, ordinary and
ability-triggered buckets, and two ordinary triggers controlled by `P2`.

The JSON document includes explicit expected values for APNAP groups, manual
and deterministic order, bottom-to-top placement, priority boundaries, cleanup,
exceptional cleanup priority, repeated cleanup, and next-turn rotation.

## Scenario assets

`turnPriorityFixtureV1.test.ts` loads the JSON, validates the public bundle,
checks JSON round-trip preservation, and pins the four-player, active-player,
upkeep, mixed-stack, pending-trigger, cleanup, and rotation metadata.

`turnPriorityScenarioV1.test.ts` executes:

- SBA fixed point, manual trigger ordering, trigger placement, one pass, all
  passes to resolution-ready, resolution removal, and priority action reset;
- deterministic single-trigger order and empty-stack all-pass position advance;
- cleanup discard with maximum override `none`, marked-damage clearing while
  preserving counters and phasing, exceptional priority, repeated cleanup, and
  rotation to the next active player.

No public index, production code, Solo/store/UI/Online integration, review test,
ledger, machine-check source, or release metadata is changed by this lane.

## DEFER

Concrete SBA evaluation, trigger detection, choice legality, effect resolution,
discard selection, and production integration remain deferred to the governed
O4P-01K follow-up lanes.
