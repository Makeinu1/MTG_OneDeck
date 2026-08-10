# O4P-01L Control, Search, Rule Visibility, Play Permission & Decision Authority V1

Status: contract-frozen-draft / judge-owned contract. This document fixes the
additive Core API after the seven grounding lanes. It is not a claim that any
operation, command, event, projection, or UI exists until implementation and
independent audit succeed.

Milestone: O4P-01L
Base: PLAN_SHA=be3240e77e2c1cfc6be30707bbc3f052c2524b9a
Authority: user-ruling-2026-08-10
Rules authority: local pinned CR 2026-06-19, SHA-256
e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b

## 1. Judge ruling and lane adjudication

The seven named grounding lanes were run in two bounded waves because the brief
names R plus A through F while setting a maximum of six concurrent analysis
lanes. R's first worker timed out without a draft; the recovery R worker
produced the adopted matrix. No incomplete worker output is evidence.

Adopted evidence:

- o4p-01l-r-control-access-cr-matrix.draft.md
- o4p-01l-a-solo-control-access-reuse.draft.md
- o4p-01l-b-control-effect-continuity.draft.md
- o4p-01l-c-visibility-search.draft.md
- o4p-01l-d-play-permission.draft.md
- o4p-01l-e-decision-authority.draft.md
- o4p-01l-f-cross-slice-bundle.draft.md

The R draft used older search/Look labels in portions of its matrix. This
contract follows the fixed local text: play is CR 701.18, reveal/look is CR
701.20, search is CR 701.23, face-down exile is CR 406.3–406.4, face-down
controlled objects are CR 708.5, and player control is CR 723. No web CR
refresh or majority vote was used.

F proposed an eight-key root with a separate continuity slice and alternate
field names. That proposal is rejected. The user brief's six-field root and
its exact field order are authoritative; continuity is a field of Control.

## 2. Scope and fixed rules

O4P-01K's CoreTurnPriorityBundleV1 is wrapped by a new mode-neutral bundle.
The milestone represents control effects and continuity, rule-visibility
queries, search-session lifecycle, attempt-only play permissions, and player
decision authority. It does not move cards, execute spells, shuffle, emit
events, or produce a projection.

Pinned rules used for the contract include CR 101.2 and 101.4 (cannot effects
and simultaneous choices), CR 108.3–108.4, 109.4, 110.2 and 112.2
(owner/controller distinctions), CR 302.6 (continuous control for the
controller's most recent turn), CR 400.1–400.7 (zones and new objects), CR
401.2/401.5 (library and top-card access), CR 402.3 (hand), CR 406.3–406.4
(face-down exile), CR 506.4 (combat consequence boundary), CR 601 and 609,
CR 611.2c and CR 613.1b/613.7/613.8 (affected sets, Layer 2 and dependency),
CR 701.18/701.20/701.23 (play, reveal/look, search), CR 708.5 (face-down
objects), CR 723 (controlling another player), and CR 800.4 (player exit).

The current milestone uses explicit caller-owned control order. It does not
implement a general CR 613 dependency graph, all continuous-effect layers,
combat removal, player exit, or a full spell/cast legality evaluator.

## 3. Existing contract preservation

The following remain byte/shape compatible and are not extended with optional
fields:

- Object Registry V2 and Object Runtime V2;
- Stack Announcement V1 and Stack Transaction V1;
- Turn Priority Bundle V1;
- existing Core ObjectId formats and fixtures;
- Solo GameState, Solo Snapshot, and all Solo commands;
- CURRENT_CONTRACT_VERSIONS, SNAPSHOT_VERSION, and all protocol/schema
  version vectors.

The new files live under src/engine/core/rules/**. They are pure, additive,
JSON-round-trippable functions. Registry V2 remains the only source of
players, turn order, active player, object identity, and zone contents. Turn
Priority remains the only source of turn/priority state. The rules bundle does
not duplicate those values.

## 4. Rule-key, zone-reference, and duration foundation

~~~
type CoreRuleKeyV1 = string;

type CoreRuleZoneRefV1 =
  | { readonly kind: 'player-zone'; readonly playerId: CorePlayerId;
      readonly zone: 'library' | 'hand' | 'graveyard' }
  | { readonly kind: 'shared-zone';
      readonly zone: 'battlefield' | 'stack' | 'exile' | 'command' };
~~~

CoreRuleKeyV1 is 1–128 ASCII characters, begins with an ASCII letter or
digit, and then contains only ASCII letters, digits, ., _, or -. It must not
contain colon, slash, backslash, whitespace, control characters, or the unsafe
names __proto__, prototype, and constructor. It is an opaque rule identity,
never a UI string. A rule key is validated without trimming, normalizing, or
locale comparison.

The exact generic duration used by Visibility is:

~~~
type CoreRuleDurationV1 =
  | { readonly kind: 'indefinite' }
  | { readonly kind: 'until-end-of-turn'; readonly turnNumber: number }
  | { readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }
  | { readonly kind: 'manual' };
~~~

Turn numbers are safe integers. Domain-specific duration unions below are
closed and are not widened by implementers.

## 5. Control Effect Slice

~~~
type CoreControlEffectDurationV1 =
  | { readonly kind: 'indefinite' }
  | { readonly kind: 'until-end-of-turn'; readonly turnNumber: number }
  | { readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }
  | { readonly kind: 'while-source-controlled-by';
      readonly sourceObjectId: CoreObjectId;
      readonly controllerPlayerId: CorePlayerId }
  | { readonly kind: 'while-source-attached-to-target';
      readonly sourceObjectId: CoreObjectId }
  | { readonly kind: 'manual' };

type CoreControlEffectV1 = {
  readonly targetObjectId: CoreObjectId;
  readonly gainingControllerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CoreControlEffectDurationV1;
};

type CoreControlContinuityV1 = {
  readonly controllerPlayerId: CorePlayerId;
  readonly continuousSinceMostRecentTurnBegan: boolean;
};

type ModeNeutralCoreControlSliceV1 = {
  readonly kind: 'mode-neutral-core-control-slice-v1';
  readonly effectOrder: readonly CoreRuleKeyV1[];
  readonly byEffect: Readonly<Record<CoreRuleKeyV1, CoreControlEffectV1>>;
  readonly continuityByObject:
    Readonly<Record<CoreObjectId, CoreControlContinuityV1>>;
};
~~~

effectOrder is the sole Layer-2 application order. Its key set equals the
byEffect key set exactly, duplicate keys are rejected, and multiple effects
for one target are allowed. Applying the ordered active effects over the
registry's base controller yields the effective controller; the last
applicable ordered effect wins. A target must be a battlefield card/token,
stack card, or stack spell-copy. Activated and triggered ability objects are
not controllable targets in this slice.

The continuity key set equals the battlefield card/token ObjectId set exactly.
Each controllerPlayerId equals the corresponding effective controller. When
the effective controller changes, continuity becomes false. At that player's
turn start, markCoreControlledPermanentsAtTurnStartV1 may set all permanents
currently controlled by that player to true. The query
coreHasContinuousControlSinceTurnStartV1 reads this explicit state; it does
not infer CR 302.6 from a Solo enteredTurn field.

Required operations are:

- currentCoreObjectControllerV1
- applyCoreControlEffectV1
- removeCoreControlEffectV1
- replaceCoreControlEffectOrderV1
- markCoreControlledPermanentsAtTurnStartV1
- expireCoreControlEffectsAtTurnBoundaryV1
- coreHasContinuousControlSinceTurnStartV1

All successful operations return a fresh validated frozen slice/result and
include controllerChangedObjectIds. Removing an effect recalculates the
prior ordered result. while-source-controlled-by does not trigger automatic
dependency ordering; the caller must explicitly remove/update it when its
condition is known. Combat removal is O4P-01M.

## 6. Decision Authority Slice

~~~
type CoreDecisionAuthorityScopeV1 =
  | { readonly kind: 'pending-next-turn' }
  | { readonly kind: 'active-turn'; readonly turnNumber: number }
  | { readonly kind: 'decision'; readonly decisionKey: CoreRuleKeyV1 }
  | { readonly kind: 'search-session'; readonly searchSessionId: CoreRuleKeyV1 }
  | { readonly kind: 'all-game-decisions' };

type CoreDecisionAuthorityV1 = {
  readonly controlledPlayerId: CorePlayerId;
  readonly decisionMakerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly scope: CoreDecisionAuthorityScopeV1;
};

type ModeNeutralCoreDecisionAuthoritySliceV1 = {
  readonly kind: 'mode-neutral-core-decision-authority-slice-v1';
  readonly authorityOrder: readonly CoreRuleKeyV1[];
  readonly byAuthority:
    Readonly<Record<CoreRuleKeyV1, CoreDecisionAuthorityV1>>;
};
~~~

authorityOrder and byAuthority keys must match exactly. Multiple authorities
for one controlled player are allowed. The last applicable authority in order
wins; scope matching is exact, with all-game-decisions acting as the broad
scope and decision/search scopes acting only for their named context.

Decision Authority never changes object controllers, active player, turn order,
or resource ownership. The rules actor is controlledPlayerId; the decision
maker is decisionMakerPlayerId; costs use the controlled player's resources.
Concession and tournament/outside-the-game choices are excluded. Required
operations are addCoreDecisionAuthorityV1, removeCoreDecisionAuthorityV1,
coreDecisionMakerForV1, activateCorePendingDecisionAuthoritiesAtTurnStartV1,
and expireCoreDecisionAuthoritiesAfterTurnV1. Pending-next-turn authorities
activate on the next turn the affected player actually takes, including after
a skipped turn; active-turn authorities expire after their matching turn.

## 7. Visibility Slice

~~~
type CoreVisibilitySubjectV1 =
  | { readonly kind: 'object'; readonly objectId: CoreObjectId }
  | { readonly kind: 'zone'; readonly zone: CoreRuleZoneRefV1 }
  | { readonly kind: 'top-of-library'; readonly playerId: CorePlayerId;
      readonly count: number };

type CoreVisibilityAudienceV1 =
  | { readonly kind: 'all-players' }
  | { readonly kind: 'players'; readonly playerIds: readonly CorePlayerId[] };

type CoreVisibilityModeV1 = 'look' | 'reveal';

type CoreVisibilityGrantV1 = {
  readonly subject: CoreVisibilitySubjectV1;
  readonly audience: CoreVisibilityAudienceV1;
  readonly mode: CoreVisibilityModeV1;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CoreRuleDurationV1;
};

type ModeNeutralCoreVisibilitySliceV1 = {
  readonly kind: 'mode-neutral-core-visibility-slice-v1';
  readonly grantOrder: readonly CoreRuleKeyV1[];
  readonly byGrant: Readonly<Record<CoreRuleKeyV1, CoreVisibilityGrantV1>>;
};
~~~

Reveal requires audience.kind === all-players; look may name specific players.
Audience IDs are unique and canonicalized in code-unit order. A top count is
a positive safe integer. Grant order and record keys match exactly. Matching
grants are additive; order is canonical grant identity order and does not
silently revoke the default rules.

coreCanPlayerViewObjectIdentityV1(bundle, viewerPlayerId, objectId,
optionalDecisionContext) returns only an in-game identity-view decision. It
does not create a Player/Table/Spectator projection.

Default rules are:

1. A player may view their own hand; a library object is hidden by default even
   from its owner.
2. A face-up object in a public zone is visible to all players.
3. A face-down battlefield or stack object is visible only to its effective
   controller (CR 708.5).
4. A face-down exile object is hidden unless an applicable grant or explicit
   search-session rule permits that viewer; CR 406.3 persistence is retained
   until the object leaves exile or is part of a shuffled pile.
5. The Searcher/rules actor and Selector/decision maker may view search
   candidates for the open session.
6. In-game information visible to a controlled player is also visible to the
   applicable decision maker; outside-the-game information is never granted.

## 8. Search Session Slice

~~~
type CoreSearchPortionV1 =
  | { readonly kind: 'all' }
  | { readonly kind: 'top'; readonly count: number };

type CoreSearchCriteriaV1 =
  | { readonly kind: 'quantity'; readonly minimum: number; readonly maximum: number }
  | { readonly kind: 'qualified'; readonly criteriaKey: CoreRuleKeyV1;
      readonly minimum: number; readonly maximum: number;
      readonly mayFailToFind: boolean };

type CoreSearchSessionV1 = {
  readonly rulesActorPlayerId: CorePlayerId;
  readonly selectorPlayerId: CorePlayerId;
  readonly zone: CoreRuleZoneRefV1;
  readonly portion: CoreSearchPortionV1;
  readonly candidateObjectIds: readonly CoreObjectId[];
  readonly criteria: CoreSearchCriteriaV1;
  readonly revealFound: boolean;
  readonly shuffleAfter: boolean;
};

type ModeNeutralCoreSearchSessionSliceV1 = {
  readonly kind: 'mode-neutral-core-search-session-slice-v1';
  readonly sessionOrder: readonly CoreRuleKeyV1[];
  readonly bySession: Readonly<Record<CoreRuleKeyV1, CoreSearchSessionV1>>;
};
~~~

openCoreSearchSessionV1 snapshots the requested zone portion in zone order,
derives selectorPlayerId from Decision Authority for the search-session
context, and never changes hidden-zone contents. completeCoreSearchSessionV1
accepts selected IDs only when they are unique members of the candidate
snapshot, meet the quantity/qualified bounds, and the current zone portion is
exactly the same snapshot. A stale snapshot is rejected. Qualified criteria
are opaque criteriaKey data; Oracle/filter evaluation is not performed.
mayFailToFind permits a qualified search to select fewer than its minimum;
quantity searches require the requested minimum or as many as the snapshot
contains, within maximum.

Completion removes the session and returns selected IDs in current zone order,
revealFound, and shuffleAfter. It performs no card movement, no shuffle, and
no Reveal Event. cancelCoreSearchSessionV1 removes the session without
changing any zone. The Searcher/rules actor and Selector are intentionally
separate.

## 9. Play Permission Slice

~~~
type CorePlayPermissionActionV1 = 'cast-spell' | 'play-land' | 'play-card';

type CorePlayPermissionSubjectV1 =
  | { readonly kind: 'object'; readonly objectId: CoreObjectId;
      readonly expectedZone: CoreRuleZoneRefV1 }
  | { readonly kind: 'top-of-library'; readonly playerId: CorePlayerId };

type CorePlayPermissionDurationV1 =
  | { readonly kind: 'indefinite' }
  | { readonly kind: 'until-end-of-turn'; readonly turnNumber: number }
  | { readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }
  | { readonly kind: 'single-use' }
  | { readonly kind: 'manual' };

type CorePlayPermissionV1 = {
  readonly allowedPlayerId: CorePlayerId;
  readonly action: CorePlayPermissionActionV1;
  readonly subject: CorePlayPermissionSubjectV1;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CorePlayPermissionDurationV1;
};

type ModeNeutralCorePlayPermissionSliceV1 = {
  readonly kind: 'mode-neutral-core-play-permission-slice-v1';
  readonly permissionOrder: readonly CoreRuleKeyV1[];
  readonly byPermission:
    Readonly<Record<CoreRuleKeyV1, CorePlayPermissionV1>>;
};
~~~

addCorePlayPermissionV1, removeCorePlayPermissionV1,
consumeCorePlayPermissionV1, findCorePlayPermissionsV1, and
coreCanPlayerAttemptPlayObjectV1 are required. The attempt query checks
permission subject, allowed player, current object zone, top-library position,
and face-down identity visibility. It does not check timing, card type, mana,
total cost, payment, land count, color identity, or Commander tax. It returns
permission to attempt, not full cast/play legality. Single-use consumption
removes the last matching ordered permission and returns a fresh slice; it does
not move the object.

## 10. Root bundle and lifecycle

The exact root has six fields and no kind or extension field:

~~~
type CoreRuleAuthorityBundleV1 = {
  readonly turnPriorityBundle: CoreTurnPriorityBundleV1;
  readonly control: ModeNeutralCoreControlSliceV1;
  readonly visibility: ModeNeutralCoreVisibilitySliceV1;
  readonly searchSessions: ModeNeutralCoreSearchSessionSliceV1;
  readonly playPermissions: ModeNeutralCorePlayPermissionSliceV1;
  readonly decisionAuthorities: ModeNeutralCoreDecisionAuthoritySliceV1;
};
~~~

Factory input has the same six fields. Canonical field order is exactly the
order above. Validation order is:

1. Turn Priority Bundle;
2. Control;
3. Decision Authority;
4. Search Session;
5. Visibility;
6. Play Permission;
7. cross-slice invariants.

validateCoreRuleAuthorityBundleV1, createCoreRuleAuthorityBundleV1,
expireCoreRuleAuthorityAtTurnBoundaryV1,
pruneCoreRuleAuthorityForMissingSourcesV1, and
activateCoreRuleAuthorityAtTurnStartV1 are required. Expiry removes
until-EOT ControlEffects, VisibilityGrants, PlayPermissions, and active-turn
DecisionAuthorities at the explicit turn boundary, updates continuity for
controller changes, and leaves Search Sessions intact. It uses the canonical
Turn Lifecycle turn number, never a clock or duplicate temporal field.

Missing-source pruning removes while-source-exists effects/grants/permissions
and while-source-attached-to-target control effects when their required source
is absent under the owning contract. It does not infer or automatically
reorder while-source-controlled-by; the caller must explicitly remove it.
Control/continuity parity, order/key-set equality, current object/zone
references, seated-player references, and decision/search/visibility/play
cross-slice references are validated atomically. A failed operation returns no
partial bundle.

## 11. Validation and operation errors

The closed validation code union is:

~~~
INVALID_ROOT, INVALID_TURN_PRIORITY_BUNDLE, INVALID_CONTROL_SLICE,
INVALID_VISIBILITY_SLICE, INVALID_SEARCH_SESSION_SLICE,
INVALID_PLAY_PERMISSION_SLICE, INVALID_DECISION_AUTHORITY_SLICE,
MISSING_FIELD, UNKNOWN_FIELD, INVALID_TYPE, INVALID_LITERAL, INVALID_ID,
UNSAFE_RECORD_KEY, INVALID_STRING, INVALID_INTEGER, INVALID_ARRAY,
INVALID_ORDER, DUPLICATE_VALUE, PLAYER_NOT_SEATED, OBJECT_NOT_FOUND,
OBJECT_NOT_CONTROLLABLE, EFFECT_SET_MISMATCH, CONTINUITY_SET_MISMATCH,
CONTINUITY_CONTROLLER_MISMATCH, GRANT_SET_MISMATCH, SESSION_SET_MISMATCH,
PERMISSION_SET_MISMATCH, AUTHORITY_SET_MISMATCH, SEARCH_SNAPSHOT_MISMATCH,
DECISION_AUTHORITY_MISMATCH, VISIBILITY_RULE_MISMATCH,
PLAY_SUBJECT_MISMATCH, CROSS_SLICE_MISMATCH
~~~

The closed operation-error code union is:

~~~
INVALID_RULE_AUTHORITY_BUNDLE, INVALID_OPERATION_INPUT, ID_COLLISION,
EFFECT_NOT_FOUND, GRANT_NOT_FOUND, SESSION_NOT_FOUND, PERMISSION_NOT_FOUND,
AUTHORITY_NOT_FOUND, EFFECT_ORDER_INVALID, OBJECT_NOT_CONTROLLABLE,
SEARCH_SNAPSHOT_STALE, SEARCH_SELECTION_INVALID,
DECISION_AUTHORITY_MISSING, PLAY_PERMISSION_MISSING,
TURN_BOUNDARY_MISMATCH, CANDIDATE_INVALID
~~~

Implementers must not add codes. If a proposed operation needs a new code it
returns the proposal to the judge before implementation.

## 12. Canonicalization and hostile-input boundary

Every slice uses its order array as the sole semantic order. Record keys are
emitted in that order. Audience IDs and selected search IDs are canonicalized
as specified (audience IDs in code-unit order; selected IDs in zone order).
Validators reject unknown fields, symbols, accessors, non-enumerable fields,
unsafe prototypes, unsafe keys, invalid IDs, defaults, trimming, duplicate
values, and malformed descriptors. They never sort an order array, mutate the
input, deduplicate input, or delete a zero-valued field. Success returns a
fresh deeply frozen graph; failure returns deterministic complete issues. No
localeCompare, Math.random, Date.now, network access, or implicit wall clock
is permitted.

The canonical result must satisfy JSON round-trip equality and remain safe
against hostile getters, symbols, prototype pollution keys, and non-enumerable
properties. Property tests must demonstrate these properties non-vacuously.

## 13. Public exports

The final additive exports are from src/engine/core/rules/index.ts and
src/engine/core/index.ts:

- CoreRuleKeyV1, CoreRuleZoneRefV1, CoreRuleDurationV1;
- all Control duration/effect/continuity/slice types and seven control
  functions;
- all Visibility subject/audience/mode/grant/slice types and the identity
  query;
- all Search portion/criteria/session/slice types and open/complete/cancel;
- all Play action/subject/duration/permission/slice types and five play
  functions;
- all Decision scope/authority/slice types and five decision functions;
- CoreRuleAuthorityBundleV1, CreateCoreRuleAuthorityBundleV1Input, the
  validator/factory, three bundle lifecycle operations, and all validation/
  operation error types.

No existing barrel export is changed until integration. No Solo or Online
barrel is added.

## 14. Acceptance pins and explicit DEFER

Review and architecture acceptance must cover valid bundle/root preservation;
indefinite/EOT/multiple ordered control and restoration; continuity changes and
turn-start marking; stack spell/copy and ability rejection; source pruning;
default own-hand/library/public/face-down visibility; persistent face-down
exile grants; top look/reveal and controlled-player visibility; outside-game
exclusion; owner/opponent/qualified/quantity/fail-to-find/reveal/no-reveal and
stale search; selector versus rules actor; no movement/no shuffle; object/top
library/face-down-exile attempt permissions and single-use consumption; pending,
active, and decision-specific authority; last-wins; active-player/object/
resource/concession boundaries; expiry; input non-mutation; canonical JSON;
deep freeze; Solo/O4P-01G–K preservation; and forbidden imports.

Explicitly deferred: Network Projection, Player/Table/Spectator Projection,
WebSocket, Cloudflare, Room, authentication/capability tokens, UI/Search UI,
revision, commandId, Typed Command/Event, replay, deterministic randomness,
card movement, shuffle execution, Reveal Event, Cast/Play command,
search-criteria/Oracle evaluation, timing/card-type/cast/land legality,
mana/cost/payment, Commander tax, Combat and combat removal, Haste,
full continuous-effect layers, CR 613 dependency graph, Copy execution,
player concession/exit, outside-the-game/sideboard/Wish/tournament choices,
and any Online runtime.

## 15. Freeze gate

This contract is complete only when the judge commits it with the grounding
drafts, after JSON/diff checks, before Acceptance Author or implementation
lanes. The commit is the source of truth for all subsequent worktrees. A
contract correction changes the base SHA and requires affected acceptance and
implementation lanes to restart; it is never silently patched into a
candidate.

