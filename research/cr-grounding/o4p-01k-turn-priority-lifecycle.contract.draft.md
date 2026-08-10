# O4P-01K Turn, Phase, Priority, SBA & Trigger Lifecycle V1

Status: judge-owned contract draft; frozen after CR grounding, not yet
integrated into production exports or machine checks.

Milestone: O4P-01K
Base: `PLAN_SHA=04e3268c0ca8e884153728590e0c2248a8edb458`
Authority: user-ruling-2026-08-10
Rules authority: pinned local CR 2026-06-19 only

## 1. Scope and fixed ruling

This additive Core slice represents turn position, turn-based-action
checkpoints, priority, consecutive passes, the SBA/trigger fixed-point
boundary, APNAP trigger placement, resolution-ready, cleanup, and active-player
rotation around the shipped `CoreStackTransactionBundleV1`.

The deterministic grounding is CR 101.4, 117.2d, 117.3-117.5, 500-506,
513-514, 603.3/603.3a-d, 703, and 704.1-704.3. CR 117.5 and 704.3 require
SBA checks before priority, repeated SBA checks after an applied batch, trigger
placement only after an SBA fixed point, a second fixed-point check after
placement, and priority only after stability. CR 603.3b requires ordinary
triggers first and ability-triggered triggers second, APNAP inside each bucket,
and controller-selected order within a group. CR 514.3a permits priority
during cleanup only after SBA/trigger work and requires a repeated cleanup after
the stack is empty and all players pass.

This contract does not evaluate concrete SBA conditions, detect triggers,
validate targets or modes, execute turn-based actions, resolve effects, expire
effects, or establish action legality. It never reports those later concerns as
automated.

## 2. Existing contract preservation

The following are unchanged: `ModeNeutralCoreObjectRegistrySliceV2`,
`ModeNeutralCoreObjectRuntimeSliceV2`, `ModeNeutralCoreStackAnnouncementSliceV1`,
`CoreStackTransactionBundleV1`, all O4P-01J transaction APIs, Core ObjectId V2
formats, existing fixtures, Solo `GameState`, Solo snapshots, and
`CURRENT_CONTRACT_VERSIONS`.

No optional fields are added to existing types. Object Registry does not gain
turn/phase/priority fields. Stack Transaction Bundle does not gain lifecycle
fields. The Registry's `activePlayerId` and `turnOrder` are the sole sources of
active player and player order. The lifecycle slice does not duplicate either.

The implementation is pure `src/engine/core/turn/**`; it imports no React,
DOM, Store, Zustand, Solo, Online, Cloudflare, WebSocket, IndexedDB, Scryfall,
`Date.now`, or `Math.random`.

## 3. Turn position

```ts
type CoreTurnPositionV1 =
  | { readonly phase: 'beginning'; readonly step: 'untap' | 'upkeep' | 'draw' }
  | { readonly phase: 'precombat-main'; readonly step: null }
  | {
      readonly phase: 'combat';
      readonly step:
        | 'beginning-of-combat'
        | 'declare-attackers'
        | 'declare-blockers'
        | 'combat-damage'
        | 'end-of-combat';
    }
  | { readonly phase: 'postcombat-main'; readonly step: null }
  | { readonly phase: 'ending'; readonly step: 'end' | 'cleanup' };
```

`CoreTurnLifecycleSliceV1` is:

```ts
{
  readonly kind: 'mode-neutral-core-turn-lifecycle-slice-v1';
  readonly turnNumber: number;          // safe integer >= 1
  readonly positionSequence: number;   // safe integer >= 0
  readonly position: CoreTurnPositionV1;
  readonly window: CoreTurnWindowV1;
}
```

`positionSequence` increments whenever the position changes, distinguishes
repeated combat-damage positions, resets to zero on the next turn, and rejects
safe-integer overflow. Extra turns/phases are not generated here, but the
position shape permits a repeated combat-damage step.

The factory input `CreateModeNeutralCoreTurnLifecycleSliceV1Input` contains the
four fields other than `kind` and is strict. It does not default, trim, sort,
deduplicate, or mutate input.

## 4. Lifecycle windows

`CoreTurnWindowV1` is exactly the following union and has no status, resolved,
countered, legal, or other fields:

```ts
type CoreTurnWindowV1 =
  | {
      readonly kind: 'turn-based-action-required';
      readonly action:
        | 'untap-step-actions'
        | 'draw-step-draw'
        | 'precombat-main-actions';
      readonly playerId: CorePlayerId;
    }
  | {
      readonly kind: 'sba-check-required';
      readonly priorityRecipientPlayerId: CorePlayerId;
      readonly grantPriorityIfStable: boolean;
    }
  | {
      readonly kind: 'trigger-order-required';
      readonly priorityRecipientPlayerId: CorePlayerId;
      readonly grantPriorityIfStable: true;
      readonly pendingObjectIds: readonly CoreObjectId[];
      readonly ambiguousGroups: readonly CorePendingTriggerOrderGroupV1[];
    }
  | {
      readonly kind: 'priority';
      readonly cycleStartPlayerId: CorePlayerId;
      readonly holderPlayerId: CorePlayerId;
      readonly passedPlayerIds: readonly CorePlayerId[];
    }
  | { readonly kind: 'resolution-ready'; readonly objectId: CoreObjectId }
  | { readonly kind: 'position-advance-ready' }
  | {
      readonly kind: 'cleanup-discard-required';
      readonly playerId: CorePlayerId;
      readonly requiredCount: number;
    }
  | { readonly kind: 'cleanup-state-actions-required'; readonly playerId: CorePlayerId }
  | { readonly kind: 'cleanup-repeat-ready' }
  | { readonly kind: 'turn-advance-ready' };
```

Window/position invariants:

- Untap permits only `turn-based-action-required/untap-step-actions`.
- Draw and precombat main begin with their exact turn-based action windows.
- Cleanup windows are forbidden outside cleanup; cleanup forbids
  `position-advance-ready`.
- Cleanup-repeat and turn-advance windows are forbidden outside cleanup.
- `resolution-ready.objectId` equals the current stack top.
- `position-advance-ready` and `cleanup-repeat-ready` require an empty stack.
- `turn-advance-ready` requires cleanup position.
- All priority/SBA/trigger recipient and cleanup player IDs are seated.
- Priority cycleStart, holder, and passed IDs are seated. Passed IDs are unique,
  form the contiguous turn-order interval from cycleStart to just before holder,
  and never include holder.
- Trigger-order pending IDs equal the pending slice's complete ID set without
  reordering. Cleanup player IDs equal the Registry active player.

## 5. Pending committed triggers

```ts
type CoreTriggerStackPlacementBucketV1 = 'ordinary' | 'ability-triggered';

type CorePendingTriggeredAbilityV1 = {
  readonly stackPlacementBucket: CoreTriggerStackPlacementBucketV1;
  readonly object: CoreTriggeredAbilityObjectIdentityV2;
  readonly announcement: Extract<
    CoreStackAnnouncementRecordV1,
    { readonly kind: 'triggered-ability' }
  >;
};

type ModeNeutralCorePendingTriggerSliceV1 = {
  readonly kind: 'mode-neutral-core-pending-trigger-slice-v1';
  readonly pendingObjectIds: readonly CoreObjectId[];
  readonly byObject: Readonly<Record<CoreObjectId, CorePendingTriggeredAbilityV1>>;
};
```

The factory input is strict and contains `pendingObjectIds` and `byObject`.
The ID array and record key set must match exactly; ID array order is detection
and append order and is never sorted. Record keys are canonicalized in that
same ID order. Every ID is a canonical triggered-ability ID, has matching
triggered-ability kinds in object and announcement, has a seated controller,
is absent from Registry objects and all zones, and has a required ability-text
snapshot. The source ObjectId and target Objects may be historical/absent.
Mode, target, and other choice-in-progress state is not stored. Only committed,
detected, selected, stack-waiting triggers are represented.

## 6. Bundle

```ts
type CoreTurnPriorityBundleV1 = {
  readonly stackBundle: CoreStackTransactionBundleV1;
  readonly pendingTriggers: ModeNeutralCorePendingTriggerSliceV1;
  readonly lifecycle: ModeNeutralCoreTurnLifecycleSliceV1;
};
```

Canonical field order is `stackBundle`, `pendingTriggers`, `lifecycle`.
Validation order is Stack Transaction Bundle, Pending Trigger Slice against the
validated Registry, then Lifecycle against Registry/Stack/Pending. Bundle
factory and validator are strict, input-preserving, canonical, JSON-round-trip
safe, and deeply frozen.

## 7. APNAP and trigger placement

```ts
coreApnapPlayerOrderV1(objectRegistry)
```

returns `turnOrder` circularly rotated so `activePlayerId` is first. The
judge-owned group type is:

```ts
type CorePendingTriggerOrderGroupV1 = {
  readonly stackPlacementBucket: CoreTriggerStackPlacementBucketV1;
  readonly controllerPlayerId: CorePlayerId;
  readonly pendingObjectIds: readonly CoreObjectId[];
};
```

Groups are ordered by ordinary bucket then APNAP controller order, followed by
ability-triggered bucket then APNAP controller order. IDs inside one controller
group preserve the controller's chosen order. `analyzeCorePendingTriggerPlacementV1`
returns `deterministic-order` when every group has zero or one ID, otherwise
`manual-order-required`.

`appendCorePendingTriggeredAbilitiesV1` adds committed pending records without
mutating input and rejects collisions, zone presence, missing seated
controllers, kind mismatches, and invalid announcements.

`placeCorePendingTriggersOnStackV1(bundle, orderedObjectIds)` requires every
pending ID exactly once, preserves bucket and APNAP group order, allows
arbitrary order only inside each group, and treats `orderedObjectIds` as
bottom-to-top placement order. It sequentially uses
`commitCoreSyntheticStackObjectV1`; object identity and announcement are added
together. Any failure returns an operation error and leaves the input bundle
unchanged. On success all pending triggers are removed, the stack is updated,
and lifecycle returns to `sba-check-required` with the same priority recipient
and `grantPriorityIfStable=true`. The stack is not silently resolved.

## 8. SBA fixed-point coordinator

```ts
type CoreSbaCheckOutcomeV1 = { readonly actionsWereApplied: boolean };
```

`recordCoreSbaCheckOutcomeV1(bundle, outcome)` requires an SBA window and does
not apply any SBA. The caller reports whether it already applied a batch.

- `actionsWereApplied=true`: keep the SBA window, preserve recipient and flag,
  and raise cleanup's false flag to true. Do not place triggers.
- `actionsWereApplied=false` with pending triggers: enter trigger-order window,
  preserve all pending IDs/groups, and set the flag true.
- `actionsWereApplied=false` with no pending triggers and flag true: enter
  priority with cycleStart=holder=recipient and no passed IDs.
- `actionsWereApplied=false` with no pending triggers and flag false: enter
  `turn-advance-ready` for stable cleanup completion.

The coordinator never infers `actionsWereApplied` from a state diff. Evidence
of applied SBA belongs to the later O4P-01N Command/Event layer.

## 9. Priority, pass, and action return

`passCorePriorityV1(bundle, playerId)` requires a priority window and the exact
current holder. It appends the holder to the passed chain. If not all players
have passed, it advances to the next turn-order player while preserving the
cycle start. If all pass, it enters `resolution-ready` with the current stack
top when the stack is nonempty; it enters `position-advance-ready` when the
stack is empty outside cleanup; and it enters `cleanup-repeat-ready` when the
stack is empty in cleanup. It never mutates input and deep-freezes success.

`resumeCoreAfterPriorityActionV1(bundle, actingPlayerId)` requires the current
priority holder to be the acting player, clears the pass chain, leaves
Registry/Runtime/Stack/Announcements/Pending unchanged, and enters
`sba-check-required` with `priorityRecipientPlayerId=actingPlayerId` and
`grantPriorityIfStable=true`. It does not check action legality or perform the
action.

## 10. Resolution-ready boundary

`completeCoreResolutionAfterRemovalV1(bundle, stackRemovalResult)` requires the
current window to be resolution-ready, requires its ObjectId to equal both the
current stack top and `removedObjectId`, and requires the supplied O4P-01J
removal result Bundle to strictly validate and no longer contain the removed
ObjectId. It replaces `stackBundle` with `removalResult.bundle`, preserves
pending triggers, and enters `sba-check-required` with active player as the
priority recipient and `grantPriorityIfStable=true`. It performs no effect,
counter, status, or resolution-reason work. Middle removal is structural only
and never a positional substitute for the captured top.

## 11. Position and turn-based checkpoints

`advanceCoreTurnPositionV1(bundle, { nextPosition })` requires
`position-advance-ready`, increments `positionSequence` with overflow refusal,
empties every player mana pool at the phase/step boundary, and changes no other
Registry, Runtime, Stack, or Pending field. Allowed transitions are:

```text
upkeep -> draw
draw -> precombat-main
precombat-main -> beginning-of-combat
beginning-of-combat -> declare-attackers
declare-attackers -> declare-blockers | end-of-combat
declare-blockers -> combat-damage | end-of-combat
combat-damage -> combat-damage | end-of-combat
end-of-combat -> postcombat-main
postcombat-main -> end
end -> cleanup
```

Untap to upkeep is only completed by the untap checkpoint. Draw and precombat
main receive their exact turn-based action windows. All other non-cleanup
positions enter SBA check for active player. Cleanup re-evaluates hand size and
enters discard-required or state-actions-required. Selecting combat branches is
the caller's responsibility; no combat state is designed here.

`completeCoreTurnBasedActionCheckpointV1(bundle, action)` requires a matching
turn-based window. It performs no actual untap, draw, Saga, or other action. The
untap action moves to upkeep and increments positionSequence, then enters SBA
check. Draw and precombat actions remain in position and enter SBA check. No
completion event is stored.

## 12. Cleanup

Maximum hand size is 7 for `null`, zero/discard-none for `"none"`, and the
numeric override for a number. Discard required count is
`max(0, activePlayerHandCount - maximumHandSize)`.

`completeCoreCleanupDiscardCheckpointV1(bundle)` requires cleanup discard
window, rechecks current hand size, requires it to be at or below maximum, does
not record card choice or discard, and enters cleanup state-actions-required.

`applyCoreCleanupStateActionsV1(bundle)` requires cleanup state-actions window,
sets every Runtime card/token `markedDamage` to zero including phased-out
objects, empties all mana pools, preserves counters/orientation/attachments and
phased-out objects, and enters SBA check for the active player with
`grantPriorityIfStable=false`. It may return boundary metadata
`{ readonly kind: 'until-end-of-turn-boundary'; readonly turnNumber: number }`
but does not delete ControlEffect or other effects.

If cleanup SBA is applied, the caller records `actionsWereApplied=true` and the
window yields priority. If cleanup triggers are pending, placement yields
priority. After cleanup priority, empty stack, and all-player pass, the window
is `cleanup-repeat-ready`. `startCoreRepeatedCleanupV1` keeps cleanup position,
increments positionSequence, and recalculates discard/state-action requirement.

## 13. Next turn

`advanceCoreToNextTurnV1(bundle)` requires `turn-advance-ready`, cleanup
position, empty Stack, and empty Pending. It increments turnNumber with
overflow refusal, rotates Registry activePlayerId to the next turn-order
player, sets positionSequence=0 and position=beginning/untap, and creates the
new active player's untap checkpoint. It resets every player's
`landsPlayedThisTurn`, `spellsCastThisTurn`, and `drawnThisTurn` and empties all
mana pools. Life, poison, energy, experience, mulliganCount, and maximum hand
size overrides remain unchanged, as do Runtime objects, positions, counters,
and other card state. It does not generate or process extra/skipped turns.

## 14. Strict validation and operation errors

The exact validation code union is:

```text
INVALID_ROOT INVALID_STACK_BUNDLE INVALID_PENDING_TRIGGER_SLICE
INVALID_LIFECYCLE_SLICE MISSING_FIELD UNKNOWN_FIELD INVALID_TYPE INVALID_LITERAL
INVALID_ID INVALID_INTEGER INVALID_ARRAY INVALID_ORDER DUPLICATE_VALUE
INVALID_POSITION INVALID_WINDOW_FOR_POSITION INVALID_PRIORITY_PLAYER
INVALID_PASS_SEQUENCE RESOLUTION_OBJECT_MISMATCH PENDING_TRIGGER_SET_MISMATCH
PENDING_TRIGGER_KIND_MISMATCH PENDING_TRIGGER_COLLISION INVALID_TRIGGER_ORDER
INVALID_CLEANUP_REQUIREMENT CROSS_SLICE_MISMATCH
```

The exact operation error code union is:

```text
INVALID_TURN_PRIORITY_BUNDLE INVALID_OPERATION_INPUT WINDOW_MISMATCH
PLAYER_NOT_SEATED NOT_PRIORITY_HOLDER INVALID_PASS_SEQUENCE TOP_STACK_MISMATCH
TRIGGER_ORDER_INVALID TRIGGER_COMMIT_FAILED POSITION_TRANSITION_INVALID
TURN_BASED_ACTION_MISMATCH CLEANUP_DISCARD_INCOMPLETE RESOLUTION_REMOVAL_MISMATCH
TURN_NUMBER_OVERFLOW POSITION_SEQUENCE_OVERFLOW CANDIDATE_INVALID
```

All validators reject null, arrays used as records, class instances, Date,
Map, Set, accessors, non-enumerable fields, symbol fields, sparse arrays,
array extra properties, missing and unknown fields. They return every issue in
fixed order, preserve input, never coerce/trim/sort/deduplicate/default, and
return a distinct deeply frozen success object. Broad assertions and `any` are
forbidden. Canonical array orders are preserved for turnOrder, Stack,
pendingObjectIds, passedPlayerIds, and group IDs; `localeCompare`,
`Math.random`, `Date.now`, and JSON-stringification-only semantic comparison
are forbidden.

## 15. Canonical order and public exports

Canonical field order is:

```text
Bundle: stackBundle, pendingTriggers, lifecycle
Pending slice: kind, pendingObjectIds, byObject
Pending record: stackPlacementBucket, object, announcement
Lifecycle: kind, turnNumber, positionSequence, position, window
Priority window: kind, cycleStartPlayerId, holderPlayerId, passedPlayerIds
SBA window: kind, priorityRecipientPlayerId, grantPriorityIfStable
Trigger window: kind, priorityRecipientPlayerId, grantPriorityIfStable,
                pendingObjectIds, ambiguousGroups
```

Final exports are from `src/engine/core/turn/index.ts` and
`src/engine/core/index.ts`: the position, lifecycle/window types and factory,
pending trigger types/factory, bundle types/factory/validator, APNAP analysis
and placement, append, SBA outcome/coordinator, pass/resume, resolution
boundary, position advance, checkpoint, cleanup, repeat cleanup, next turn, and
the exact validation/operation error types.

No `CURRENT_CONTRACT_VERSIONS`, `SNAPSHOT_VERSION`, or other version axis is
changed; this is additive and not connected to Solo, Online, protocol, or UI.

## 16. Acceptance pins and required evidence

Independent review tests must pin valid/invalid bundle and each slice,
single-source active player/turn order, untap no-priority, checkpoints,
priority/pass/reset, all-pass outcomes, stale/top resolution identity,
pending collision and historical source, ordinary/APNAP/ability-triggered
ordering, deterministic/manual order, atomic placement, SBA repeat and
placement recheck, cleanup normal/exceptional/repeat, discard override, damage
clear with counter/attachment/phased-out preservation, mana clear, next-turn
rotation/reset, canonical JSON, deep freeze, and input non-mutation. They must
also pin that no concrete SBA catalog, effect resolution, Solo change, or
Online runtime exists.

Normal/property/architecture evidence must cover the same invariants, plus a
Compiler-API import boundary scan for store/components/online/React/Zustand/DOM,
dynamic/type-only/re-export imports, forbidden time/random APIs, and product
runtime non-integration.

## 17. Explicit DEFER and release gate

DEFER to later milestones: concrete CR 704 evaluator and applications, trigger
detection/subscriptions, trigger choice legality, full effect resolution,
target/mode legality, cost/payment, priority action legality, combat, extra
turn/phase/step generation, skipped-turn processing, Day/Night, Saga,
Attraction, Untap restrictions, draw replacements, cleanup discard selection,
effect expiry deletion, Control/Permission/Search/Visibility/Play/Decision
Authority, Command/Event, actor/decisionMaker, deterministic randomness,
replay/revision, Projection, Room, Cloudflare, WebSocket, UI, and Solo
integration.

Before implementation, the five grounding lanes are `analyzed-not-integrated`.
After implementation, lanes are `implemented-not-integrated` until the frozen
candidate receives an independent cold audit. BLOCKER/HIGH findings prohibit
ship. `AUDIT-OK-PENDING-FULL-CHECK` is not ship approval. The final full check
must run once on the identical audited fingerprint, followed by GitHub Actions
and Pages evidence before the ledger entries can become `shipped`.
