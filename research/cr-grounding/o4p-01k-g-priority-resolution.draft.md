# O4P-01K-G Priority, Pass, and Resolution Boundary

Status: `implemented-not-integrated`

Foundation: `038433ad026d62c11cf5118c2c675ba0f6b49738`
Role: implementer, independent worktree, `fork_context:false`

## Boundary

This additive component owns only priority-cycle accounting and the explicit
resolution removal boundary. It uses the O4P-01J stack bundle as an immutable
input and does not create the O4P-01K Full Bundle. The coordinator lane owns
integration with pending triggers and the complete lifecycle bundle.

`startCorePriorityCycleV1` derives the initial cycle from the Registry's
seated `activePlayerId`. `passCorePriorityV1` validates the exact holder and
the contiguous passed chain, rotates one player in Registry turn order, and
records one all-pass result: the exact current stack top, an empty-stack
position advance, or cleanup repetition. `resumeCoreAfterPriorityActionV1`
clears the pass chain and enters the stabilization boundary for the acting
player without executing or representing the action.

`completeCoreResolutionAfterRemovalV1` accepts only an O4P-01J
`CoreStackRemovalResultV1` that removes the captured current top. It replaces
the supplied stack bundle and enters an SBA-check boundary for the Registry
active player. It never resolves effects, applies SBAs, retargets, or removes
an object by position. A middle removal is therefore a structural O4P-01J
operation, not a resolution event.

## Evidence and deferrals

Ordinary/property tests cover seated and contiguous validation, wrong-holder
and stale pass rejection, one-pass rotation and wrap, all-pass branches,
action reset, exact top identity, middle-removal rejection at the resolution
boundary, input nonmutation, and deep freezing. Targeted lint, build, and
`check:forbidden` are required before handoff.

Deferred to the coordinator or later milestones: Full Bundle creation and
exports, pending-trigger/APNAP integration, SBA evaluation, trigger
detection/placement, action legality and execution, target/mode legality,
effect resolution, and production/Store/Solo/Online/UI integration.
