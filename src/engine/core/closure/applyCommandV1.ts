import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import type { CorePlayerZonesV1 } from '../identityZoneState';
import { createCoreCommanderDamageProvenanceLedgerV1, recordCoreCommanderDamageProvenanceV1 } from '../commander/commanderDamageProvenanceV1';
import { createCoreCommanderDamageStateV1, coreCommanderDamageAgainstV1, recordCoreCommanderDamageV1 } from '../commander/commanderDamageV1';
import { recordCoreCommanderCastV1 } from '../commander/commanderTaxV1';
import { addCoreCombatContextAttackV1, addCoreCombatContextBlockV1, reconcileCoreCombatContextForPlayerExitV1, setCoreCombatContextStepV1 } from '../combat/combatContextV1';
import { createModeNeutralCoreObjectRegistryStateV2, createModeNeutralCoreObjectRuntimeStateV2, type ModeNeutralCoreObjectRegistryStateV2, type ModeNeutralCoreObjectRuntimeStateV2 } from '../object/objectRegistryStateV2';
import { createCoreCardObjectIdentityV2 } from '../object/tokenObjectV2';
import { createDefaultCoreCardRuntimeAfterZoneChangeV1 } from '../transition/cardReincarnation';
import { createModeNeutralCoreStackAnnouncementSliceV1 } from '../stack/stackAnnouncementSliceV1';
import { commitCoreCardSpellToStackV1 } from '../stack/transaction/cardSpellCommitV1';
import { removeCoreStackObjectV1 } from '../stack/transaction/stackRemovalV1';
import type { CoreStackTransactionBundleV1 } from '../stack/transaction/stackTransactionBundleV1';
import { passCorePriorityV1 } from '../turn/priorityPassV1';
import { startCorePriorityCycleV1 } from '../turn/priorityPassV1';
import { completeCoreResolutionAfterRemovalV1 } from '../turn/resolutionBoundaryV1';
import { createCoreTurnPriorityBundleV1 } from '../turn/turnPriorityBundleV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turn/turnLifecycleV1';
import { reconcileCorePlayerExitV1, type CorePlayerExitReferenceBundleV1 } from '../player-lifecycle/playerExitReconciliationV1';
import { applyCoreControlEffectV1, createModeNeutralCoreControlSliceV1 } from '../rules/controlEffectV1';
import { coreDecisionMakerForV1, createModeNeutralCoreDecisionAuthoritySliceV1, removeCoreDecisionAuthorityV1 } from '../rules/decisionAuthorityV1';
import { completeCoreSearchSessionV1, openCoreSearchSessionV1 } from '../rules/searchSessionOperationsV1';
import { closeCoreVisibilityGrantV1, openCoreVisibilityGrantV1, pruneCoreVisibilityGrantsV1 } from '../rules/visibilityGrantOperationsV1';
import { createModeNeutralCoreSearchSessionSliceV1 } from '../rules/searchSessionV1';
import { createCoreRuleAuthorityBundleV1 } from '../rules/ruleAuthorityBundleV1';
import { applyCoreRecordedZoneOrderV1, validateCoreRandomZoneOrderV1 } from './randomZoneOrderV1';
import { coreCanonicalDigestFromValueV1 } from './canonicalV1';
import { createCoreDomainEventV1, type CoreDomainEventPayloadV1 } from './domainEventV1';
import { validateCoreCommandV1, type CoreCommandPayloadV1, type CoreCommandV1 } from './commandV1';
import type { CoreTabletopCommandPayloadV1 } from '../tabletop/commandV1';
import { createCoreTabletopManualStateV1, type CoreTabletopManualStateV1, type CoreTabletopRecentResolutionV1 } from '../tabletop/manualStateV1';
import { createCoreCorrectionWarningV1, validateCoreCorrectionReasonV1 } from './correctionV1';
import { createModeNeutralCoreRootV1, validateModeNeutralCoreRootV1 } from './rootValidationV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';
import type { CoreCommandIssueV1, CoreCommandResultV1, CoreCommandWarningV1 } from './commandResultV1';
import { applyCoreTabletopPayloadV1 } from '../tabletop/operationsV1';
import { drawCoreTabletopCardsV1, untapCoreTabletopPermanentsV1 } from '../tabletop/operationsV1';
import {
  advanceCoreToNextTurnV1,
  advanceCoreTurnPositionV1,
  completeCoreTurnBasedActionCheckpointV1,
  skipCoreFirstTurnDrawV1,
} from '../turn/turnAdvanceV1';

type Raw = Record<string, unknown>;
function isTabletopPayload(value: CoreCommandPayloadV1): value is CoreTabletopCommandPayloadV1 {
  return value.kind.startsWith('table-');
}
type HandlerResult = Readonly<{ readonly root: ModeNeutralCoreRootV1; readonly payloads: readonly CoreDomainEventPayloadV1[]; readonly warnings: readonly CoreCommandWarningV1[] }>;

function safeIssue(error: unknown, fallbackPath = ''): CoreCommandIssueV1 {
  if (error && typeof error === 'object') {
    const values = (error as { readonly issues?: unknown }).issues;
    if (Array.isArray(values) && values.length > 0) {
      const first: unknown = (values as readonly unknown[])[0];
      if (first && typeof first === 'object') {
        const row = first as Record<string, unknown>;
        return Object.freeze({ code: typeof row.code === 'string' ? row.code : 'OPERATION_FAILED', path: typeof row.path === 'string' ? row.path : fallbackPath, message: typeof row.message === 'string' ? row.message : 'Core operation failed' });
      }
    }
  }
  return Object.freeze({ code: 'OPERATION_FAILED', path: fallbackPath, message: 'Core operation failed' });
}

function currentStackSteward(root: ModeNeutralCoreRootV1, objectId: CoreObjectId | null): CorePlayerId | null {
  if (objectId === null) return stackBundle(root).objectRegistry.activePlayerId;
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined) return null;
  if (object.kind === 'activated-ability' || object.kind === 'triggered-ability') return object.controllerPlayerId;
  if (object.kind === 'spell-copy') return object.controllerPlayerId;
  // The steward is the player who added the object to the stack.  For cards
  // this immutable provenance is the card incarnation's base controller;
  // current control effects must not rewrite the response authority.
  return object.baseControllerPlayerId;
}

/** The only player permitted to undo a shared assisted-table shortcut. */
export function coreUndoAuthorizedPlayerV1(root: ModeNeutralCoreRootV1): CorePlayerId | null {
  if ((root.tabletopManual?.priorityHolds ?? []).length > 0) return null;
  const top = stackBundle(root).objectRegistry.zones.shared.stack.at(-1) ?? null;
  return currentStackSteward(root, top);
}

export function isCoreUndoAuthorizedPlayerV1(root: ModeNeutralCoreRootV1, playerId: CorePlayerId): boolean {
  return coreUndoAuthorizedPlayerV1(root) === playerId;
}

function requireSteward(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, path: string): void {
  const lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const top = stackBundle(root).objectRegistry.zones.shared.stack.at(-1) ?? null;
  if (currentStackSteward(root, top) !== actorPlayerId) adapterFailure('STEWARD_REQUIRED', path, 'Only the current stack steward may advance or resolve');
  if ((root.tabletopManual?.priorityHolds ?? []).length > 0) adapterFailure('PRIORITY_HOLD_ACTIVE', path, 'Active priority HOLD blocks advance or resolve');
  if (lifecycle.window.kind === 'resolution-ready' && top !== lifecycle.window.objectId) adapterFailure('TOP_STACK_MISMATCH', path, 'Resolution-ready object is not the current stack top');
}
function adapterFailure(code: string, path: string, message: string): never {
  throw new CoreCommandAdapterError(code, path, message);
}
class CoreCommandAdapterError extends Error {
  readonly issues: readonly CoreCommandIssueV1[];
  constructor(code: string, path: string, message: string) { super(message); this.name = 'CoreCommandAdapterError'; this.issues = Object.freeze([{ code, path, message }]); }
}
function reject(root: ModeNeutralCoreRootV1, issues: readonly CoreCommandIssueV1[], digest = ''): CoreCommandResultV1 {
  const frozen = Object.freeze(issues.map((value) => Object.freeze({ ...value })));
  const events: readonly [] = Object.freeze([]);
  const warnings: readonly [] = Object.freeze([]);
  return Object.freeze({ status: 'rejected', root, events, warnings, issues: frozen, beforeStateDigest: digest, afterStateDigest: digest });
}
function registryWith(registry: ModeNeutralCoreObjectRegistryStateV2, updates: Partial<ModeNeutralCoreObjectRegistryStateV2>): ModeNeutralCoreObjectRegistryStateV2 {
  return createModeNeutralCoreObjectRegistryStateV2({
    players: updates.players ?? registry.players,
    turnOrder: updates.turnOrder ?? registry.turnOrder,
    activePlayerId: updates.activePlayerId ?? registry.activePlayerId,
    cardDefinitions: updates.cardDefinitions ?? registry.cardDefinitions,
    physicalCards: updates.physicalCards ?? registry.physicalCards,
    objects: updates.objects ?? registry.objects,
    zones: updates.zones ?? registry.zones,
  });
}
function zonesWith(registry: ModeNeutralCoreObjectRegistryStateV2, zone: CoreRuleZoneRefV1Like, values: readonly CoreObjectId[]): ModeNeutralCoreObjectRegistryStateV2['zones'] {
  const byPlayer = Object.create(null) as Record<CorePlayerId, CorePlayerZonesV1>;
  for (const playerId of registry.turnOrder) byPlayer[playerId] = registry.zones.byPlayer[playerId];
  const shared = { ...registry.zones.shared };
  if (zone.kind === 'player-zone') byPlayer[zone.playerId] = { ...registry.zones.byPlayer[zone.playerId], [zone.zone]: Object.freeze(values.slice()) };
  else shared[zone.zone] = Object.freeze(values.slice());
  return Object.freeze({ byPlayer: Object.freeze(byPlayer), shared: Object.freeze(shared) });
}
type CoreRuleZoneRefV1Like = Readonly<{ readonly kind: 'player-zone'; readonly playerId: CorePlayerId; readonly zone: 'library' | 'hand' | 'graveyard' } | Readonly<{ readonly kind: 'shared-zone'; readonly zone: 'battlefield' | 'stack' | 'exile' | 'command' }>>;
function stackBundle(root: ModeNeutralCoreRootV1): CoreStackTransactionBundleV1 { return root.ruleAuthority.turnPriorityBundle.stackBundle; }
function replaceStackBundle(root: ModeNeutralCoreRootV1, nextStack: CoreStackTransactionBundleV1, nextLifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle): ModeNeutralCoreRootV1 {
  const nextTurn = createCoreTurnPriorityBundleV1({ stackBundle: nextStack, pendingTriggers: root.ruleAuthority.turnPriorityBundle.pendingTriggers, lifecycle: nextLifecycle });
  // Stack commits/removals can make a source-bound or object-subject grant
  // stale.  Prune against the next stack before root validation so the
  // accepted transition remains atomic and emits closure at the outer
  // command boundary rather than failing on a dangling object reference.
  const visibility = pruneCoreVisibilityGrantsV1(root.ruleAuthority.visibility, {
    registry: nextStack.objectRegistry,
    currentSequence: root.acceptedCommandCount + 1,
    activePlayerIds: activePlayerIds(root),
    searchSessionIds: root.ruleAuthority.searchSessions.sessionOrder,
    currentTurnNumber: nextLifecycle.turnNumber,
  }).value;
  const nextAuthority = createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle: nextTurn, visibility });
  return createModeNeutralCoreRootV1({ ...root, ruleAuthority: nextAuthority });
}
function replaceAuthority(root: ModeNeutralCoreRootV1, patch: Partial<ModeNeutralCoreRootV1['ruleAuthority']>): ModeNeutralCoreRootV1 {
  return createModeNeutralCoreRootV1({ ...root, ruleAuthority: createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, ...patch }) });
}
function activePlayerIds(root: ModeNeutralCoreRootV1): readonly CorePlayerId[] { return root.playerLifecycle.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId); }
function reconcileTabletopManualStateForPlayerExit(
  state: CoreTabletopManualStateV1 | undefined,
  exitingPlayerId: CorePlayerId,
  survivingPublicStackObjectIds: readonly CoreObjectId[],
): CoreTabletopManualStateV1 | undefined {
  if (state === undefined) return undefined;
  const survivingSources = new Set(survivingPublicStackObjectIds);
  const notes: Record<string, CoreTabletopManualStateV1['notes'][string]> = Object.create(null) as Record<string, CoreTabletopManualStateV1['notes'][string]>;
  const noteOrder: string[] = [];
  for (const noteId of state.noteOrder) {
    const note = state.notes[noteId];
    if (note === undefined || note.authorPlayerId === exitingPlayerId) continue;
    notes[noteId] = note;
    noteOrder.push(noteId);
  }
  const stackEntries = state.stackEntries.filter((entry) => (
    entry.authorPlayerId !== exitingPlayerId
      && (entry.sourceObjectId === null || survivingSources.has(entry.sourceObjectId))
  ));
  return createCoreTabletopManualStateV1({ notes, noteOrder, stackEntries, priorityHolds: state.priorityHolds.filter((hold) => hold.playerId !== exitingPlayerId), recentResolution: state.recentResolution });
}
function zoneIds(registry: ModeNeutralCoreObjectRegistryStateV2, zone: CoreRuleZoneRefV1Like): readonly CoreObjectId[] { return zone.kind === 'player-zone' ? registry.zones.byPlayer[zone.playerId][zone.zone] : registry.zones.shared[zone.zone]; }
function objectOwner(registry: ModeNeutralCoreObjectRegistryStateV2, objectId: CoreObjectId): CorePlayerId | null {
  const object = registry.objects[objectId] as unknown as Raw | undefined;
  if (!object) return null;
  if (object.kind === 'card') {
    const physical = registry.physicalCards[object.physicalCardId as CorePhysicalCardId];
    return physical?.ownerPlayerId ?? null;
  }
  return typeof object.ownerPlayerId === 'string' ? object.ownerPlayerId as CorePlayerId : null;
}
function objectController(root: ModeNeutralCoreRootV1, objectId: CoreObjectId): CorePlayerId | null {
  const registry = stackBundle(root).objectRegistry; const object = registry.objects[objectId] as unknown as Raw | undefined;
  if (!object) return null;
  let controller = typeof object.baseControllerPlayerId === 'string' ? object.baseControllerPlayerId as CorePlayerId : typeof object.controllerPlayerId === 'string' ? object.controllerPlayerId as CorePlayerId : null;
  for (const key of root.ruleAuthority.control.effectOrder) { const effect = root.ruleAuthority.control.byEffect[key]; if (effect.targetObjectId === objectId) controller = effect.gainingControllerPlayerId; }
  return controller;
}
function allObjectIds(registry: ModeNeutralCoreObjectRegistryStateV2): readonly CoreObjectId[] {
  const result: CoreObjectId[] = [];
  for (const playerId of registry.turnOrder) for (const zone of ['library', 'hand', 'graveyard'] as const) result.push(...registry.zones.byPlayer[playerId][zone]);
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) result.push(...registry.zones.shared[zone]);
  return result;
}
function objectLocation(registry: ModeNeutralCoreObjectRegistryStateV2, objectId: CoreObjectId): { kind: 'player-zone'; playerId: CorePlayerId; zone: string } | { kind: 'shared-zone'; zone: string } | null {
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) if (zones[zone].includes(objectId)) return { kind: 'player-zone', playerId, zone };
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) if (registry.zones.shared[zone].includes(objectId)) return { kind: 'shared-zone', zone };
  return null;
}
function removeFromZones(registry: ModeNeutralCoreObjectRegistryStateV2, ids: ReadonlySet<string>): ModeNeutralCoreObjectRegistryStateV2['zones'] {
  const byPlayer: Raw = Object.create(null) as Raw;
  for (const playerId of registry.turnOrder) byPlayer[playerId] = Object.freeze({ library: Object.freeze(registry.zones.byPlayer[playerId].library.filter((id) => !ids.has(id))), hand: Object.freeze(registry.zones.byPlayer[playerId].hand.filter((id) => !ids.has(id))), graveyard: Object.freeze(registry.zones.byPlayer[playerId].graveyard.filter((id) => !ids.has(id))) });
  const shared = { battlefield: Object.freeze(registry.zones.shared.battlefield.filter((id) => !ids.has(id))), stack: Object.freeze(registry.zones.shared.stack.filter((id) => !ids.has(id))), exile: Object.freeze(registry.zones.shared.exile.filter((id) => !ids.has(id))), command: Object.freeze(registry.zones.shared.command.filter((id) => !ids.has(id))) };
  return Object.freeze({ byPlayer: Object.freeze(byPlayer), shared: Object.freeze(shared) }) as ModeNeutralCoreObjectRegistryStateV2['zones'];
}
function addToExile(ids: readonly CoreObjectId[], zones: ModeNeutralCoreObjectRegistryStateV2['zones']): ModeNeutralCoreObjectRegistryStateV2['zones'] {
  const exile = zones.shared.exile.slice(); for (const id of ids) if (!exile.includes(id)) exile.push(id);
  return Object.freeze({ byPlayer: zones.byPlayer, shared: Object.freeze({ ...zones.shared, exile: Object.freeze(exile) }) });
}
function updateRegistryInRoot(root: ModeNeutralCoreRootV1, nextRegistry: ModeNeutralCoreObjectRegistryStateV2, nextRuntime?: unknown, nextAnnouncements?: unknown, nextLifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle): ModeNeutralCoreRootV1 {
  const currentStack = stackBundle(root);
  const runtime = nextRuntime ?? currentStack.objectRuntime;
  const announcements = nextAnnouncements ?? currentStack.stackAnnouncements;
  const nextStack = { objectRegistry: nextRegistry, objectRuntime: runtime, stackAnnouncements: announcements } as CoreStackTransactionBundleV1;
  return replaceStackBundle(root, nextStack, nextLifecycle);
}
function eventRoot(root: ModeNeutralCoreRootV1, command: CoreCommandV1, payloads: readonly CoreDomainEventPayloadV1[], warnings: readonly CoreCommandWarningV1[], before: string): CoreCommandResultV1 {
  const events = Object.freeze(payloads.map((payload, index) => createCoreDomainEventV1(command, index, payload)));
  const emptyWarnings: readonly [] = Object.freeze([]);
  const after = coreCanonicalDigestFromValueV1(root);
  return Object.freeze(warnings.length > 0
    ? { status: 'accepted-with-warning' as const, root, events, warnings: Object.freeze(warnings.slice()), beforeStateDigest: before, afterStateDigest: after }
    : { status: 'accepted' as const, root, events, warnings: emptyWarnings, beforeStateDigest: before, afterStateDigest: after });
}

function handleTabletopTurnProgress(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  transition: Extract<CoreCommandPayloadV1, { readonly kind: 'table-turn-progress' }>,
): HandlerResult {
  const lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const registry = stackBundle(root).objectRegistry;
  if (registry.activePlayerId !== actorPlayerId) adapterFailure('INACTIVE_ACTOR', '/actorPlayerId', 'Only the active player may progress the turn');
  let workingRoot = root;
  const payloads: CoreDomainEventPayloadV1[] = [];
  if (transition.transition.kind === 'checkpoint') {
    if (lifecycle['window'].kind !== 'turn-based-action-required') adapterFailure('TURN_GATE', '/payload/transition', 'No turn-based checkpoint is currently required');
    if (lifecycle['window'].action === 'draw-step-draw') {
      const drawn = drawCoreTabletopCardsV1(workingRoot, actorPlayerId, 1);
      workingRoot = drawn.root;
      payloads.push(...drawn.payloads);
    }
    let runtime = stackBundle(workingRoot).objectRuntime;
    if (lifecycle['window'].action === 'untap-step-actions') runtime = untapCoreTabletopPermanentsV1(workingRoot, stackBundle(workingRoot).objectRegistry, runtime, actorPlayerId);
    const currentStack = stackBundle(workingRoot);
    const nextBundle = completeCoreTurnBasedActionCheckpointV1({
      stackBundle: { ...currentStack, objectRuntime: runtime },
      pendingTriggers: workingRoot.ruleAuthority.turnPriorityBundle.pendingTriggers,
      lifecycle: workingRoot.ruleAuthority.turnPriorityBundle.lifecycle,
    }, lifecycle['window'].action);
    workingRoot = updateRegistryInRoot(workingRoot, nextBundle.stackBundle.objectRegistry, nextBundle.stackBundle.objectRuntime, undefined, nextBundle.lifecycle);
  } else if (transition.transition.kind === 'position') {
    const turn = workingRoot.ruleAuthority.turnPriorityBundle;
    const nextBundle = advanceCoreTurnPositionV1({ stackBundle: turn.stackBundle, pendingTriggers: turn.pendingTriggers, lifecycle: turn.lifecycle }, { nextPosition: transition.transition.nextPosition });
    workingRoot = updateRegistryInRoot(workingRoot, nextBundle.stackBundle.objectRegistry, nextBundle.stackBundle.objectRuntime, undefined, nextBundle.lifecycle);
  } else if (transition.transition.kind === 'first-turn-draw-skip') {
    const turn = workingRoot.ruleAuthority.turnPriorityBundle;
    const nextBundle = skipCoreFirstTurnDrawV1({ stackBundle: turn.stackBundle, pendingTriggers: turn.pendingTriggers, lifecycle: turn.lifecycle });
    workingRoot = updateRegistryInRoot(workingRoot, nextBundle.stackBundle.objectRegistry, nextBundle.stackBundle.objectRuntime, undefined, nextBundle.lifecycle);
  } else {
    const turn = workingRoot.ruleAuthority.turnPriorityBundle;
    const nextBundle = advanceCoreToNextTurnV1({ stackBundle: turn.stackBundle, pendingTriggers: turn.pendingTriggers, lifecycle: turn.lifecycle });
    workingRoot = updateRegistryInRoot(workingRoot, nextBundle.stackBundle.objectRegistry, nextBundle.stackBundle.objectRuntime, undefined, nextBundle.lifecycle);
  }
  payloads.push({ kind: 'table-turn-progressed', transition: transition.transition.kind === 'position' ? Object.freeze({ kind: transition.transition.kind, nextPosition: transition.transition.nextPosition }) : Object.freeze({ kind: transition.transition.kind }) });
  return { root: workingRoot, payloads, warnings: [] };
}

function handlePlayerExit(root: ModeNeutralCoreRootV1, payload: Extract<CoreCommandPayloadV1, { readonly kind: 'player-exit' }>): HandlerResult {
  const registry = stackBundle(root).objectRegistry;
  if (registry.activePlayerId === payload.playerId) adapterFailure('ACTIVE_PLAYER_EXIT_REQUIRES_TURN_TRANSITION', '/payload/playerId', 'The current active player must exit through a turn transition');
  const currentPriorityHolder = root.ruleAuthority.turnPriorityBundle.lifecycle['window'].kind === 'priority' ? root.ruleAuthority.turnPriorityBundle.lifecycle['window'].holderPlayerId : null;
  if (currentPriorityHolder === payload.playerId) adapterFailure('PRIORITY_HOLDER_EXIT_REQUIRES_TURN_TRANSITION', '/payload/playerId', 'The current priority holder must exit through a turn transition');
  const activeIds = activePlayerIds(root).filter((id) => id !== payload.playerId);
  const owned = allObjectIds(registry).filter((id) => objectOwner(registry, id) === payload.playerId);
  const controlled = allObjectIds(registry).filter((id) => objectController(root, id) === payload.playerId && !owned.includes(id));
  const nonCardStack = registry.zones.shared.stack.filter((id) => { const object = registry.objects[id] as unknown as Raw | undefined; return object?.kind !== 'card' && controlled.includes(id); });
  const combatIds = root.combatContext ? [...root.combatContext.attacks.map((entry) => entry.attackerObjectId), ...root.combatContext.blocks.map((entry) => entry.blockerObjectId)].filter((id) => owned.includes(id) || controlled.includes(id)) : [];
  const controlIds = root.ruleAuthority.control.effectOrder.filter((key) => { const effect = root.ruleAuthority.control.byEffect[key]; return effect.gainingControllerPlayerId === payload.playerId || effect.sourceObjectId !== null && objectOwner(registry, effect.sourceObjectId) === payload.playerId; });
  const decisionIds = root.ruleAuthority.decisionAuthorities.authorityOrder.filter((key) => { const authority = root.ruleAuthority.decisionAuthorities.byAuthority[key]; return authority.controlledPlayerId === payload.playerId || authority.decisionMakerPlayerId === payload.playerId; });
  const searchIds = root.ruleAuthority.searchSessions.sessionOrder.filter((key) => { const session = root.ruleAuthority.searchSessions.bySession[key]; return session.rulesActorPlayerId === payload.playerId || session.selectorPlayerId === payload.playerId || session.zone.kind === 'player-zone' && session.zone.playerId === payload.playerId; });
  const references: CorePlayerExitReferenceBundleV1 = { turnOrder: registry.turnOrder, eligiblePlayerIds: activeIds, activePlayerId: registry.activePlayerId, priorityHolderPlayerId: root.ruleAuthority.turnPriorityBundle.lifecycle['window'].kind === 'priority' ? root.ruleAuthority.turnPriorityBundle.lifecycle['window'].holderPlayerId : null, ownedObjectIds: owned, controlledObjectIds: controlled, nonCardStackObjectIds: nonCardStack, combatParticipantObjectIds: combatIds, controlEffectIds: controlIds as never, decisionAuthorityIds: decisionIds as never, searchSessionIds: searchIds as never };
  const reconciliation = reconcileCorePlayerExitV1(root.playerLifecycle, references, { playerId: payload.playerId, cause: payload.cause });
  if (currentPriorityHolder !== null && reconciliation.priorityHandoffPlayerId !== currentPriorityHolder) adapterFailure('PRIORITY_HOLDER_EXIT_REQUIRES_TURN_TRANSITION', '/payload/playerId', 'The priority handoff cannot be rebuilt by this adapter');
  const removeIds = new Set(reconciliation.ownedObjectsToLeaveGame.concat(reconciliation.nonCardStackObjectsToCease));
  const exileIds = reconciliation.controlledObjectsToExile;
  const zoneRemovalIds = new Set([...removeIds, ...exileIds]);
  const removedZones = removeFromZones(registry, zoneRemovalIds); const nextZones = addToExile(exileIds, removedZones);
  const nextZonesForSurvivors = Object.freeze({ byPlayer: Object.freeze(Object.fromEntries(reconciliation.survivingTurnOrder.map((playerId) => [playerId, nextZones.byPlayer[playerId]]))), shared: nextZones.shared });
  const nextObjectsRecord = Object.fromEntries(Object.entries(registry.objects).filter(([id]) => !removeIds.has(id as CoreObjectId)));
  for (const objectId of exileIds) {
    const object = registry.objects[objectId];
    if (object?.kind === 'card') nextObjectsRecord[objectId] = createCoreCardObjectIdentityV2({ kind: 'card', physicalCardId: object.physicalCardId, incarnation: object.incarnation, baseControllerPlayerId: null });
  }
  const nextObjects = nextObjectsRecord as unknown as ModeNeutralCoreObjectRegistryStateV2['objects'];
  const physicalCardsToRemove = new Set([...removeIds].map((objectId) => {
    const object = registry.objects[objectId];
    return object?.kind === 'card' ? object.physicalCardId : null;
  }).filter((physicalCardId): physicalCardId is CorePhysicalCardId => physicalCardId !== null));
  const nextPhysicalCards = Object.fromEntries(Object.entries(registry.physicalCards).filter(([physicalCardId]) => !physicalCardsToRemove.has(physicalCardId as CorePhysicalCardId))) as unknown as ModeNeutralCoreObjectRegistryStateV2['physicalCards'];
  const survivingPlayers = new Set(reconciliation.survivingTurnOrder);
  const nextPlayers = Object.fromEntries(Object.entries(registry.players).filter(([playerId]) => survivingPlayers.has(playerId as CorePlayerId))) as unknown as ModeNeutralCoreObjectRegistryStateV2['players'];
  const nextRuntimeRecord = Object.fromEntries(Object.entries(stackBundle(root).objectRuntime.byObject).filter(([id]) => !removeIds.has(id as CoreObjectId))) as Raw;
  for (const objectId of exileIds) if (registry.objects[objectId]?.kind === 'card') nextRuntimeRecord[objectId] = createDefaultCoreCardRuntimeAfterZoneChangeV1();
  const nextRuntimeByObject = nextRuntimeRecord as unknown as ModeNeutralCoreObjectRuntimeStateV2['byObject'];
  // Controlled stack objects that are exiled on exit leave the stack but may
  // retain their card incarnation.  Drop announcements for both permanently
  // removed and exiled objects so the next stack slice remains ordered.
  const nextAnnouncementByObject: Raw = Object.create(null) as Raw; for (const [id, announcement] of Object.entries(stackBundle(root).stackAnnouncements.byObject)) if (!zoneRemovalIds.has(id as CoreObjectId)) nextAnnouncementByObject[id] = announcement;
  const nextRegistry = registryWith(registry, { players: nextPlayers, turnOrder: reconciliation.survivingTurnOrder, activePlayerId: reconciliation.activePlayerAfterExit as CorePlayerId, physicalCards: nextPhysicalCards, zones: nextZonesForSurvivors, objects: nextObjects });
  const nextRuntime = createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: nextRuntimeByObject });
  const nextAnnouncements = createModeNeutralCoreStackAnnouncementSliceV1(nextRegistry, { byObject: nextAnnouncementByObject });
  const endedControlIds = reconciliation.controlEffectIdsToEnd as readonly string[];
  const clearedDecisionIds = reconciliation.decisionAuthorityIdsToClear as readonly string[];
  const closedSearchIds = reconciliation.searchSessionIdsToClose as readonly string[];
  const nextControl = createModeNeutralCoreControlSliceV1({ effectOrder: root.ruleAuthority.control.effectOrder.filter((key) => !endedControlIds.includes(key)), byEffect: Object.fromEntries(root.ruleAuthority.control.effectOrder.filter((key) => !endedControlIds.includes(key)).map((key) => [key, root.ruleAuthority.control.byEffect[key]])), continuityByObject: Object.fromEntries(Object.entries(root.ruleAuthority.control.continuityByObject).filter(([id]) => !zoneRemovalIds.has(id as CoreObjectId))) });
  const nextDecision = createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: root.ruleAuthority.decisionAuthorities.authorityOrder.filter((key) => !clearedDecisionIds.includes(key)), byAuthority: Object.fromEntries(root.ruleAuthority.decisionAuthorities.authorityOrder.filter((key) => !clearedDecisionIds.includes(key)).map((key) => [key, root.ruleAuthority.decisionAuthorities.byAuthority[key]])) });
  const nextSearch = createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: root.ruleAuthority.searchSessions.sessionOrder.filter((key) => !closedSearchIds.includes(key)), bySession: Object.fromEntries(root.ruleAuthority.searchSessions.sessionOrder.filter((key) => !closedSearchIds.includes(key)).map((key) => [key, root.ruleAuthority.searchSessions.bySession[key]])) });
  const currentLifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const nextLifecycle = currentLifecycle['window'].kind === 'priority'
    ? createModeNeutralCoreTurnLifecycleSliceV1({ turnNumber: currentLifecycle.turnNumber, positionSequence: currentLifecycle.positionSequence, position: currentLifecycle.position, window: { kind: 'priority', cycleStartPlayerId: currentLifecycle['window'].cycleStartPlayerId, holderPlayerId: reconciliation.priorityHandoffPlayerId as CorePlayerId, passedPlayerIds: currentLifecycle['window'].passedPlayerIds.filter((playerId) => reconciliation.survivingTurnOrder.includes(playerId)) } })
    : currentLifecycle;
  const nextStack = { objectRegistry: nextRegistry, objectRuntime: nextRuntime, stackAnnouncements: nextAnnouncements } as CoreStackTransactionBundleV1;
  const nextTurn = createCoreTurnPriorityBundleV1({ stackBundle: nextStack, pendingTriggers: root.ruleAuthority.turnPriorityBundle.pendingTriggers, lifecycle: nextLifecycle });
  // Player exit changes the active audience, object registry, and search
  // session set together.  Reconcile visibility against those next values
  // before constructing the root, so audience/subject/source/choice grants
  // close atomically instead of leaving dangling references.
  const visibility = pruneCoreVisibilityGrantsV1(root.ruleAuthority.visibility, {
    registry: nextRegistry,
    currentSequence: root.acceptedCommandCount + 1,
    activePlayerIds: reconciliation.lifecycleState.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId),
    searchSessionIds: nextSearch.sessionOrder,
    currentTurnNumber: nextLifecycle.turnNumber,
  }).value;
  const nextAuthority = createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle: nextTurn, control: nextControl, decisionAuthorities: nextDecision, searchSessions: nextSearch, visibility });
  const lifecyclePlayerIds = root.playerLifecycle.players.map((entry) => entry.playerId);
  const nextCommanderDamage = createCoreCommanderDamageStateV1({ commanders: root.commanderDamage.commanders, defendingPlayerIds: lifecyclePlayerIds, entries: root.commanderDamage.entries });
  const nextProvenance = createCoreCommanderDamageProvenanceLedgerV1({ commanders: root.commanderDamageProvenance.commanders, defendingPlayerIds: lifecyclePlayerIds, records: root.commanderDamageProvenance.records });
  const nextCombatContext = root.combatContext === null
    ? null
    : reconcileCoreCombatContextForPlayerExitV1(root.combatContext, { exitingPlayerId: payload.playerId, participantObjectIdsToClear: reconciliation.combatParticipantObjectIdsToClear });
  const nextManualState = reconcileTabletopManualStateForPlayerExit(root.tabletopManual, payload.playerId, nextRegistry.zones.shared.stack);
  const nextRoot = createModeNeutralCoreRootV1({
    ...root,
    ruleAuthority: nextAuthority,
    playerLifecycle: reconciliation.lifecycleState,
    commanderDamage: nextCommanderDamage,
    commanderDamageProvenance: nextProvenance,
    combatContext: nextCombatContext,
    ...(nextManualState === undefined ? {} : { tabletopManual: nextManualState }),
  });
  return { root: nextRoot, payloads: [{ kind: 'player-exited', playerId: payload.playerId, cause: payload.cause }], warnings: [] };
}

/** Apply one server-bound combat damage fact atomically.  This deliberately
 * reuses the existing Commander damage ledger and player-exit reconciliation;
 * no client-supplied replacement life/physical identity is accepted here. */
function handleManualCombatDamage(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, payload: Extract<CoreCommandPayloadV1, { readonly kind: 'manual-combat-damage' }>): HandlerResult {
  if (payload.defendingPlayerId !== actorPlayerId) adapterFailure('ACTOR_PAYLOAD_MISMATCH', '/payload/defendingPlayerId', 'Damage actor must equal the defending player');
  const activeIds = activePlayerIds(root);
  if (!activeIds.includes(payload.defendingPlayerId)) adapterFailure('PLAYER_INACTIVE', '/payload/defendingPlayerId', 'Damage cannot target an inactive player');
  const registry = stackBundle(root).objectRegistry;
  const player = registry.players[payload.defendingPlayerId];
  if (player === undefined) adapterFailure('PLAYER_NOT_FOUND', '/payload/defendingPlayerId', 'Damage player is not registered');
  if (payload.commanderPhysicalCardId !== null || payload.combatObjectId !== null) {
    if (payload.commanderPhysicalCardId === null || payload.combatObjectId === null) adapterFailure('INVALID_PROVENANCE', '/payload', 'Commander provenance requires both object IDs');
    if (!root.commanders.some((commander) => commander.physicalCardId === payload.commanderPhysicalCardId)) adapterFailure('UNREGISTERED_COMMANDER', '/payload/commanderPhysicalCardId', 'Commander physical card is not registered');
    const combatObject = registry.objects[payload.combatObjectId];
    if (combatObject?.kind !== 'card' || combatObject.physicalCardId !== payload.commanderPhysicalCardId) adapterFailure('COMMANDER_PROVENANCE_MISMATCH', '/payload/combatObjectId', 'Combat object must match the Commander physical card');
  }
  const nextPlayers: ModeNeutralCoreObjectRegistryStateV2['players'] = {
    ...registry.players,
    [payload.defendingPlayerId]: { ...player, life: player.life - payload.damage },
  };
  let nextRoot = updateRegistryInRoot(root, registryWith(registry, { players: nextPlayers }));
  const payloads: CoreDomainEventPayloadV1[] = [{ kind: 'manual-combat-damaged', defendingPlayerId: payload.defendingPlayerId, damage: payload.damage, commanderPhysicalCardId: payload.commanderPhysicalCardId, combatObjectId: payload.combatObjectId }];
  if (payload.commanderPhysicalCardId !== null && payload.combatObjectId !== null) {
    const damage = recordCoreCommanderDamageV1(nextRoot.commanderDamage, { commanderPhysicalCardId: payload.commanderPhysicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage });
    const provenance = recordCoreCommanderDamageProvenanceV1(nextRoot.commanderDamageProvenance, { combatObjectId: payload.combatObjectId, commanderPhysicalCardId: payload.commanderPhysicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage });
    nextRoot = createModeNeutralCoreRootV1({ ...nextRoot, commanderDamage: damage, commanderDamageProvenance: provenance });
  }
  const commanderThreshold = payload.commanderPhysicalCardId === null
    ? false
    : coreCommanderDamageAgainstV1(nextRoot.commanderDamage, payload.commanderPhysicalCardId, payload.defendingPlayerId) >= 21;
  if (nextPlayers[payload.defendingPlayerId].life <= 0 || commanderThreshold) {
    const exited = handlePlayerExit(nextRoot, { kind: 'player-exit', playerId: payload.defendingPlayerId, cause: 'defeat' });
    nextRoot = exited.root;
    payloads.push(...exited.payloads);
  }
  return { root: nextRoot, payloads, warnings: [] };
}

export function applyCoreCommandV1(root: ModeNeutralCoreRootV1, command: CoreCommandV1): CoreCommandResultV1 {
  const rootValidation = validateModeNeutralCoreRootV1(root);
  if (!rootValidation.ok) return reject(root, rootValidation.issues.map((value) => Object.freeze({ ...value })));
  let current = rootValidation.value;
  const before = coreCanonicalDigestFromValueV1(current);
  const commandValidation = validateCoreCommandV1(command);
  if (!commandValidation.ok) return reject(root, commandValidation.issues, before);
  const checked = commandValidation.value;
  if (checked.sequence !== current.acceptedCommandCount + 1) return reject(root, [{ code: 'SEQUENCE_MISMATCH', path: '/sequence', message: 'Command sequence must immediately follow accepted command count' }], before);
  const activeIds = activePlayerIds(current);
  // Visibility expiry is an atomic part of the next accepted transition. A
  // rejected command must return the original root untouched.
  const prePruned = pruneCoreVisibilityGrantsV1(current.ruleAuthority.visibility, {
    registry: stackBundle(current).objectRegistry,
    // Observe the revision about to be accepted: a next-command grant opened
    // at sequence N survives N and closes before N+1.
    currentSequence: checked.sequence,
    activePlayerIds: activeIds,
    searchSessionIds: current.ruleAuthority.searchSessions.sessionOrder,
    currentTurnNumber: current.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber,
  });
  if (prePruned.closedGrantKeys && prePruned.closedGrantKeys.length > 0)
    current = replaceAuthority(current, { visibility: prePruned.value });
  if (!activeIds.includes(checked.actorPlayerId) || !activeIds.includes(checked.decisionMakerPlayerId)) return reject(root, [{ code: 'PLAYER_INACTIVE', path: '/actorPlayerId', message: 'Actor and decision maker must be active players' }], before);
  let expectedMaker: CorePlayerId;
  try { expectedMaker = coreDecisionMakerForV1(current.ruleAuthority.decisionAuthorities, checked.actorPlayerId, checked.decisionContext); } catch (error: unknown) { return reject(root, [safeIssue(error, '/decisionContext')], before); }
  if (expectedMaker !== checked.decisionMakerPlayerId) return reject(root, [{ code: 'DECISION_AUTHORITY_MISMATCH', path: '/decisionMakerPlayerId', message: 'Decision maker is not currently authorized' }], before);
  const payloadBinding = checked.payload;
  let preOpenedSearch: typeof current.ruleAuthority | null = null;
  if (payloadBinding.kind === 'priority-pass' && payloadBinding.playerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/playerId', message: 'Priority-pass player must equal the command actor' }], before);
  if (payloadBinding.kind === 'search-open' && payloadBinding.input.rulesActorPlayerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/input/rulesActorPlayerId', message: 'Search rules actor must equal the command actor' }], before);
  if (payloadBinding.kind === 'stack-commit-card-spell' && payloadBinding.input.controllerPlayerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/input/controllerPlayerId', message: 'Stack commit controller must equal the command actor' }], before);
  if (payloadBinding.kind === 'commander-cast-record') {
    const commander = current.commanders.find((entry) => entry.physicalCardId === payloadBinding.physicalCardId);
    if (commander && commander.ownerPlayerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/physicalCardId', message: 'Commander cast actor must equal the registered Commander owner' }], before);
  }
  if (payloadBinding.kind === 'commander-damage-record') {
    if (!activeIds.includes(payloadBinding.defendingPlayerId)) return reject(root, [{ code: 'PLAYER_INACTIVE', path: '/payload/defendingPlayerId', message: 'New Commander damage cannot target an inactive defender' }], before);
    const combatObject = stackBundle(current).objectRegistry.objects[payloadBinding.combatObjectId];
    if (combatObject?.kind !== 'card' || combatObject.physicalCardId !== payloadBinding.physicalCardId) return reject(root, [{ code: 'COMMANDER_PROVENANCE_MISMATCH', path: '/payload/combatObjectId', message: 'Combat object must be the recorded physical Commander' }], before);
  }
  if (payloadBinding.kind === 'combat-attack-add' && payloadBinding.attack.attackerControllerPlayerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/attack/attackerControllerPlayerId', message: 'Attack controller must equal the command actor' }], before);
  if (payloadBinding.kind === 'combat-block-add' && payloadBinding.block.blockerControllerPlayerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/block/blockerControllerPlayerId', message: 'Block controller must equal the command actor' }], before);
  if (payloadBinding.kind === 'random-zone-order' && payloadBinding.zone.kind === 'player-zone' && payloadBinding.zone.playerId !== checked.actorPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/zone/playerId', message: 'Player-zone random actor must equal the zone player' }], before);
  if (payloadBinding.kind === 'player-exit' && (payloadBinding.playerId !== checked.actorPlayerId || payloadBinding.playerId !== checked.decisionMakerPlayerId)) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/playerId', message: 'Exit actor and decision maker must equal the exiting player' }], before);
  if (payloadBinding.kind === 'correct-player-life' && (payloadBinding.playerId !== checked.actorPlayerId || payloadBinding.playerId !== checked.decisionMakerPlayerId)) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/playerId', message: 'Life correction actor and decision maker must equal the corrected player' }], before);
  if (payloadBinding.kind === 'correct-commander-damage' && (payloadBinding.defendingPlayerId !== checked.actorPlayerId || payloadBinding.defendingPlayerId !== checked.decisionMakerPlayerId)) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/defendingPlayerId', message: 'Commander-damage correction actor and decision maker must equal the defending player' }], before);
  if (isTabletopPayload(payloadBinding) && checked.actorPlayerId !== checked.decisionMakerPlayerId) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/decisionMakerId', message: 'This ordinary tabletop command requires actor and decision maker to match' }], before);
  if (payloadBinding.kind === 'table-zone-move' && payloadBinding.destination.kind === 'stack') return reject(root, [{ code: 'STACK_MOVE_REQUIRES_CAST', path: '/payload/destination', message: 'Cards enter the stack through the Core cast command' }], before);
  if (payloadBinding.kind === 'search-complete') {
    const session = current.ruleAuthority.searchSessions.bySession[payloadBinding.sessionKey];
    if (session && (session.rulesActorPlayerId !== checked.actorPlayerId || session.selectorPlayerId !== checked.decisionMakerPlayerId)) return reject(root, [{ code: 'ACTOR_PAYLOAD_MISMATCH', path: '/payload/sessionKey', message: 'Search completion authority does not match the session actors' }], before);
  }
  if (payloadBinding.kind === 'search-open') {
    try {
      const opened = openCoreSearchSessionV1(current.ruleAuthority, payloadBinding.sessionKey, payloadBinding.input);
      const openedAuthority = opened.value as typeof current.ruleAuthority;
      const session = openedAuthority.searchSessions.bySession[payloadBinding.sessionKey];
      if (session && session.selectorPlayerId !== checked.decisionMakerPlayerId) return reject(root, [{ code: 'DECISION_AUTHORITY_MISMATCH', path: '/decisionMakerPlayerId', message: 'Search selector is not the command decision maker' }], before);
      preOpenedSearch = openedAuthority;
    } catch {
      // The handler below owns operation failures and converts them atomically.
    }
  }
  let recentResolutionSummary: CoreTabletopRecentResolutionV1 | null = null;
  try {
    const payload = checked.payload; let handled: HandlerResult;
    if (payload.kind === 'stack-commit-card-spell') {
      const priorityWindow = current.ruleAuthority.turnPriorityBundle.lifecycle.window;
      if (priorityWindow.kind !== 'priority' || priorityWindow.holderPlayerId !== checked.actorPlayerId) {
        adapterFailure('PRIORITY_REQUIRED', '/actorPlayerId', 'The actor must hold priority to cast a spell');
      }
      const sourceLocation = objectLocation(stackBundle(current).objectRegistry, payload.input.sourceObjectId);
      if (sourceLocation?.kind !== 'player-zone' || sourceLocation.zone !== 'hand' || sourceLocation.playerId !== checked.actorPlayerId) {
        adapterFailure('CAST_SOURCE_REQUIRED', '/payload/input/sourceObjectId', 'Spells must be cast from the actor hand');
      }
      const sourceObject = stackBundle(current).objectRegistry.objects[payload.input.sourceObjectId];
      if (sourceObject?.kind === 'card') {
        const physical = stackBundle(current).objectRegistry.physicalCards[sourceObject.physicalCardId];
        const definition = physical === undefined ? undefined : stackBundle(current).objectRegistry.cardDefinitions[physical.definitionId];
        const typeLine = definition?.faces[0]?.typeLine ?? definition?.typeLine ?? '';
        if (/\bLand\b/u.test(typeLine)) adapterFailure('LAND_USES_PLAY_LAND', '/payload/input/sourceObjectId', 'Land cards use the dedicated land-play command');
        const isInstant = /\bInstant\b/u.test(typeLine);
        const hasFlash = (definition?.keywords ?? []).some((keyword) => keyword.toLowerCase() === 'flash');
        const turn = current.ruleAuthority.turnPriorityBundle;
        if (!isInstant && !hasFlash && (stackBundle(current).objectRegistry.activePlayerId !== checked.actorPlayerId
          || (turn.lifecycle.position.phase !== 'precombat-main' && turn.lifecycle.position.phase !== 'postcombat-main')
          || stackBundle(current).objectRegistry.zones.shared.stack.length !== 0)) {
          adapterFailure('CAST_TIMING', '/payload/input/sourceObjectId', 'Non-Flash spells require the active player during an empty main-phase stack');
        }
      }
      const result = commitCoreCardSpellToStackV1(stackBundle(current), payload.input);
      const committedRegistry = result.bundle.objectRegistry;
      const caster = committedRegistry.players[checked.actorPlayerId];
      const withSpellCount = caster === undefined
        ? committedRegistry
        : registryWith(committedRegistry, {
          players: {
            ...committedRegistry.players,
            [checked.actorPlayerId]: {
              ...caster,
              spellsCastThisTurn: caster.spellsCastThisTurn + 1,
            },
          },
        });
      const committedBundle = withSpellCount === committedRegistry
        ? result.bundle
        : { ...result.bundle, objectRegistry: withSpellCount };
      let nextRoot = replaceStackBundle(current, committedBundle);
      const turn = nextRoot.ruleAuthority.turnPriorityBundle;
      const started = startCorePriorityCycleV1({ stackBundle: turn.stackBundle, lifecycle: turn.lifecycle });
      const lifecycle = started.lifecycle.window.kind === 'priority'
        ? createModeNeutralCoreTurnLifecycleSliceV1({
          turnNumber: started.lifecycle.turnNumber,
          positionSequence: started.lifecycle.positionSequence,
          position: started.lifecycle.position,
          window: {
            ...started.lifecycle.window,
            cycleStartPlayerId: checked.actorPlayerId,
            holderPlayerId: checked.actorPlayerId,
            passedPlayerIds: [],
          },
        })
        : started.lifecycle;
      nextRoot = replaceStackBundle(nextRoot, started.stackBundle, lifecycle);
      handled = {
        root: nextRoot,
        payloads: [
          { kind: 'stack-changed', operation: 'commit', objectId: result.committedObjectId },
          { kind: 'priority-changed', holderPlayerId: lifecycle.window.kind === 'priority' ? lifecycle.window.holderPlayerId : null, windowKind: lifecycle.window.kind },
        ],
        warnings: [],
      };
    }
    else if (payload.kind === 'stack-remove-object') {
      if (current.ruleAuthority.turnPriorityBundle.lifecycle.window.kind === 'resolution-ready') requireSteward(current, checked.actorPlayerId, '/actorPlayerId');
      const result = removeCoreStackObjectV1(stackBundle(current), payload.input);
      let nextRoot = replaceStackBundle(current, result.bundle);
      const payloads: CoreDomainEventPayloadV1[] = [{ kind: 'stack-changed', operation: 'remove', objectId: result.removedObjectId }];
      if (current.ruleAuthority.turnPriorityBundle.lifecycle.window.kind === 'resolution-ready') {
        const completed = completeCoreResolutionAfterRemovalV1({
          stackBundle: stackBundle(current),
          lifecycle: current.ruleAuthority.turnPriorityBundle.lifecycle,
        }, result);
        nextRoot = replaceStackBundle(current, completed.stackBundle, completed.lifecycle);
        payloads.push({
          kind: 'priority-changed',
          holderPlayerId: null,
          windowKind: completed.lifecycle.window.kind,
        });
        const resolutionDestination: CoreTabletopRecentResolutionV1['destination'] = payload.input.kind === 'cease'
          ? 'cease'
          : payload.input.destination.kind === 'battlefield'
            ? 'battlefield'
            : payload.input.destination.kind === 'owner-graveyard'
              ? 'owner-graveyard'
              : 'manual';
        recentResolutionSummary = Object.freeze({
          objectId: result.removedObjectId,
          destination: resolutionDestination,
          acceptedRevision: checked.sequence,
        });
      }
      handled = { root: nextRoot, payloads, warnings: [] };
    }
    else if (payload.kind === 'priority-pass') { const result = passCorePriorityV1({ stackBundle: stackBundle(current), lifecycle: current.ruleAuthority.turnPriorityBundle.lifecycle }, payload.playerId); handled = { root: replaceStackBundle(current, result.stackBundle, result.lifecycle), payloads: [{ kind: 'priority-changed', holderPlayerId: result.lifecycle['window'].kind === 'priority' ? result.lifecycle['window'].holderPlayerId : null, windowKind: result.lifecycle['window'].kind }], warnings: [] }; }
    else if (payload.kind === 'search-open') { const result = preOpenedSearch === null ? openCoreSearchSessionV1(current.ruleAuthority, payload.sessionKey, payload.input) : { value: preOpenedSearch }; handled = { root: replaceAuthority(current, { searchSessions: (result.value as typeof current.ruleAuthority).searchSessions }), payloads: [{ kind: 'search-session-changed', sessionKey: payload.sessionKey, operation: 'open', selectedCount: 0 }], warnings: [] }; }
    else if (payload.kind === 'search-complete') {
      const result = completeCoreSearchSessionV1(current.ruleAuthority, payload.sessionKey, payload.selectedObjectIds);
      // Search-session decision authority is scoped to the lifetime of that
      // session.  Completing the session must retire its authority records in
      // the same immutable transition, otherwise the cross-slice validator
      // would retain a dangling scope and reject the otherwise valid result.
      let decisionAuthorities = current.ruleAuthority.decisionAuthorities;
      for (const authorityKey of decisionAuthorities.authorityOrder) {
        const authority = decisionAuthorities.byAuthority[authorityKey];
        if (authority.scope.kind === 'search-session' && authority.scope.searchSessionId === payload.sessionKey) {
          decisionAuthorities = removeCoreDecisionAuthorityV1(decisionAuthorities, authorityKey).value;
        }
      }
      const selectedObjectIds = Object.freeze(result.selectedObjectIds ?? []);
      const completionResult = Object.freeze({
        kind: 'core-search-completion-result-v1' as const,
        sessionKey: payload.sessionKey,
        selectedObjectIds,
        selectedCount: selectedObjectIds.length,
        revealFound: result.revealFound === true,
      });
      handled = {
        root: replaceAuthority(current, {
          searchSessions: (result.value as typeof current.ruleAuthority).searchSessions,
          decisionAuthorities,
        }),
        payloads: [{ kind: 'search-session-changed', sessionKey: payload.sessionKey, operation: 'complete', selectedCount: selectedObjectIds.length, selectedObjectIds, revealFound: completionResult.revealFound, completionResult }],
        warnings: [],
      };
    }
    else if (payload.kind === 'visibility-open') {
      const registry = stackBundle(current).objectRegistry;
      const grant = payload.grant;
      const subjectObject = grant.subject.kind === 'object' ? grant.subject.objectId : null;
      if (grant.subject.kind === 'top-of-library' && grant.subject.playerId !== checked.actorPlayerId) adapterFailure('ACTOR_PAYLOAD_MISMATCH', '/payload/grant/subject/playerId', 'Library subject must belong to actor');
      if (subjectObject !== null) {
        const location = objectLocation(registry, subjectObject);
        if (location === null) adapterFailure('OBJECT_NOT_FOUND', '/payload/grant/subject/objectId', 'Visibility subject object is not present');
        const own = objectOwner(registry, subjectObject) === checked.actorPlayerId;
        const controlled = objectController(current, subjectObject) === checked.actorPlayerId;
        const supportedZone = location.kind === 'player-zone' ? (location.zone === 'hand' || location.zone === 'graveyard') && location.playerId === checked.actorPlayerId : ['battlefield', 'stack', 'exile', 'command'].includes(location.zone);
        if (!supportedZone || (!own && !controlled)) adapterFailure('VISIBILITY_UNAUTHORIZED', '/payload/grant/subject', 'Visibility subject is not owned or controlled by actor');
      }
      if (grant.audience.kind === 'players' && grant.audience.playerIds.some((playerId) => !activeIds.includes(playerId))) adapterFailure('PLAYER_INACTIVE', '/payload/grant/audience/playerIds', 'Visibility audience must contain active players');
      if (grant.duration.kind === 'until-next-command' && grant.duration.openingSequence !== checked.sequence) adapterFailure('DURATION_AUTHORITY_MISMATCH', '/payload/grant/duration/openingSequence', 'Opening sequence is server-bound');
      if (grant.duration.kind === 'until-end-of-turn' && grant.duration.turnNumber !== current.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber) adapterFailure('DURATION_AUTHORITY_MISMATCH', '/payload/grant/duration/turnNumber', 'Turn number is server-bound');
      if (grant.duration.kind === 'until-search-completes' && !current.ruleAuthority.searchSessions.bySession[grant.duration.searchSessionId]) adapterFailure('DURATION_AUTHORITY_MISMATCH', '/payload/grant/duration/searchSessionId', 'Search session is not active');
      if (grant.subject.kind === 'top-of-library') {
        const ids = registry.zones.byPlayer[checked.actorPlayerId].library.slice(0, grant.subject.count);
        if (grant.topLibraryPrefixDigest !== undefined && coreCanonicalDigestFromValueV1({ kind: 'top-library-prefix-v1', objectIds: ids }) !== grant.topLibraryPrefixDigest) adapterFailure('TOP_LIBRARY_SNAPSHOT_STALE', '/payload/grant/topLibraryPrefixDigest', 'Top library snapshot is stale');
      }
      const result = openCoreVisibilityGrantV1(current.ruleAuthority.visibility, payload.grantKey, grant); handled = { root: replaceAuthority(current, { visibility: result.value }), payloads: [{ kind: 'visibility-opened', grantKey: payload.grantKey, mode: grant.mode, duration: grant.duration.kind }], warnings: [] };
    }
    else if (payload.kind === 'visibility-close') { const result = closeCoreVisibilityGrantV1(current.ruleAuthority.visibility, payload.grantKey); handled = { root: replaceAuthority(current, { visibility: result.value }), payloads: [{ kind: 'visibility-closed', grantKey: payload.grantKey, reason: 'explicit' }], warnings: [] }; }
    else if (payload.kind === 'control-effect-apply') { const result = applyCoreControlEffectV1(current.ruleAuthority.control, payload.effectKey, payload.effect); handled = { root: replaceAuthority(current, { control: result.value }), payloads: [{ kind: 'control-changed', effectKey: payload.effectKey, targetObjectId: payload.effect.targetObjectId }], warnings: [] }; }
    else if (payload.kind === 'commander-cast-record') { const index = current.commanders.findIndex((commander) => commander.physicalCardId === payload.physicalCardId); if (index < 0) throw new Error('Commander not found'); const ledgers = current.commanderCastLedgers.slice(); if (payload.accepted) ledgers[index] = recordCoreCommanderCastV1(ledgers[index], { origin: payload.origin }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderCastLedgers: ledgers }), payloads: [{ kind: 'commander-cast-recorded', physicalCardId: payload.physicalCardId, accepted: payload.accepted, castCount: ledgers[index].castCount }], warnings: [] }; }
    else if (payload.kind === 'commander-damage-record') { const damage = recordCoreCommanderDamageV1(current.commanderDamage, { commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage }); const provenance = recordCoreCommanderDamageProvenanceV1(current.commanderDamageProvenance, { combatObjectId: payload.combatObjectId, commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderDamage: damage, commanderDamageProvenance: provenance }), payloads: [{ kind: 'commander-damage-recorded', physicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage, combatObjectId: payload.combatObjectId }], warnings: [] }; }
    else if (payload.kind === 'manual-combat-damage') handled = handleManualCombatDamage(current, checked.actorPlayerId, payload);
    else if (payload.kind === 'combat-step-set') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: setCoreCombatContextStepV1(current.combatContext, payload.step) }), payloads: [{ kind: 'combat-changed', operation: 'step' }], warnings: [] }; }
    else if (payload.kind === 'combat-attack-add') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: addCoreCombatContextAttackV1(current.combatContext, payload.attack) }), payloads: [{ kind: 'combat-changed', operation: 'attack' }], warnings: [] }; }
    else if (payload.kind === 'combat-block-add') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: addCoreCombatContextBlockV1(current.combatContext, payload.block) }), payloads: [{ kind: 'combat-changed', operation: 'block' }], warnings: [] }; }
    else if (payload.kind === 'player-exit') handled = handlePlayerExit(current, payload);
    else if (payload.kind === 'random-zone-order') { const registry = stackBundle(current).objectRegistry; const order = zoneIds(registry, payload.zone); const issues = validateCoreRandomZoneOrderV1(payload, order); if (issues.length) adapterFailure(issues[0]?.code ?? 'INVALID_RANDOM_ORDER', issues[0]?.path ?? '/payload', issues[0]?.message ?? 'Invalid random zone order'); const nextOrder = applyCoreRecordedZoneOrderV1(order, payload); const nextRegistry = registryWith(registry, { zones: zonesWith(registry, payload.zone, nextOrder) }); const manualMode = payload.manualMode === 'structured' || payload.manualMode === 'freeform' ? payload.manualMode : undefined; handled = { root: updateRegistryInRoot(current, nextRegistry), payloads: [{ kind: 'zone-randomized', randomDecisionId: payload.randomDecisionId, zoneKind: payload.zone.zone, count: payload.afterOrder.length, ...(manualMode === undefined ? {} : { manualMode }) }], warnings: [] }; }
    else if (payload.kind === 'correct-player-life') { if (coreCanonicalDigestFromValueV1(current) !== payload.expectedBeforeStateDigest) throw new Error('Correction digest is stale'); const registry = stackBundle(current).objectRegistry; const player = registry.players[payload.playerId]; if (!player) throw new Error('Correction player is not registered'); const players = { ...registry.players, [payload.playerId]: { ...player, life: payload.replacementLifeTotal } }; handled = { root: updateRegistryInRoot(current, registryWith(registry, { players })), payloads: [{ kind: 'manual-correction-applied', correction: 'player-life' }], warnings: [createCoreCorrectionWarningV1(payload.reason)] }; }
    else if (payload.kind === 'table-turn-progress') { requireSteward(current, checked.actorPlayerId, '/actorPlayerId'); handled = handleTabletopTurnProgress(current, checked.actorPlayerId, payload); }
    else if (payload.kind === 'table-shuffle') adapterFailure('SHUFFLE_REQUIRES_SERVER_RANDOM', '/payload', 'Shuffle must be bound to a server-authoritative random order');
    else if (isTabletopPayload(payload)) {
      const result = applyCoreTabletopPayloadV1(current, checked.actorPlayerId, payload);
      let nextRoot = result.root;
      const payloads = result.payloads.slice();
      if (result.resolutionRemoval !== undefined) {
        const completed = completeCoreResolutionAfterRemovalV1({
          stackBundle: stackBundle(current),
          lifecycle: current.ruleAuthority.turnPriorityBundle.lifecycle,
        }, result.resolutionRemoval);
        nextRoot = replaceStackBundle(nextRoot, completed.stackBundle, completed.lifecycle);
        payloads.push({
          kind: 'priority-changed',
          holderPlayerId: null,
          windowKind: completed.lifecycle.window.kind,
        });
      }
      if (payload.kind === 'table-zone-move' && payload.destination.kind === 'stack') {
        const turn = nextRoot.ruleAuthority.turnPriorityBundle;
        const started = startCorePriorityCycleV1({ stackBundle: turn.stackBundle, lifecycle: turn.lifecycle });
        nextRoot = replaceStackBundle(nextRoot, started.stackBundle, started.lifecycle);
        payloads.push({
          kind: 'priority-changed',
          holderPlayerId: started.lifecycle.window.kind === 'priority' ? started.lifecycle.window.holderPlayerId : null,
          windowKind: started.lifecycle.window.kind,
        });
      }
      handled = { root: nextRoot, payloads, warnings: [] };
    }
    else { if (coreCanonicalDigestFromValueV1(current) !== payload.expectedBeforeStateDigest) throw new Error('Correction digest is stale'); if (validateCoreCorrectionReasonV1(payload.reason).length) throw new Error('Correction reason is invalid'); const state = current.commanderDamage; const entries = state.entries.filter((entry) => !(entry.commanderPhysicalCardId === payload.physicalCardId && entry.defendingPlayerId === payload.defendingPlayerId)); if (payload.replacementDamageTotal > 0) entries.push({ commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.replacementDamageTotal }); const damage = createCoreCommanderDamageStateV1({ commanders: state.commanders, defendingPlayerIds: state.defendingPlayerIds, entries }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderDamage: damage }), payloads: [{ kind: 'manual-correction-applied', correction: 'commander-damage' }], warnings: [createCoreCorrectionWarningV1(payload.reason)] }; }
    // Manual note/stack operations validate their intermediate root against
    // the command's eventual revision. Preserve that revision here while
    // retaining the ordinary +1 boundary for every other Core operation.
    const postPruned = pruneCoreVisibilityGrantsV1(handled.root.ruleAuthority.visibility, {
      registry: stackBundle(handled.root).objectRegistry,
      currentSequence: checked.sequence,
      activePlayerIds: activePlayerIds(handled.root),
      searchSessionIds: handled.root.ruleAuthority.searchSessions.sessionOrder,
      currentTurnNumber: handled.root.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber,
      // A recorded library order operation is itself a visibility boundary.
      // Do not rely only on the resulting prefix digest: a shuffle/reorder
      // that happens to preserve the same IDs still ends the prior grant.
      libraryOrderChangedPlayerIds: payload.kind === 'random-zone-order' && payload.zone.kind === 'player-zone' && payload.zone.zone === 'library'
        ? [payload.zone.playerId]
        : [],
    });
    // A handler may already have pruned grants while rebuilding an intermediate
    // next registry (for example, a zone move removes a source incarnation).
    // Track that delta separately so the command event contains one automatic
    // closure regardless of whether pruning happened before or after the
    // handler, and never duplicate an explicit visibility-close event.
    const handlerGrantKeys = new Set(current.ruleAuthority.visibility.grantOrder);
    const handledGrantKeys = new Set(handled.root.ruleAuthority.visibility.grantOrder);
    const handlerPrunedGrantKeys = [...handlerGrantKeys].filter((grantKey) => !handledGrantKeys.has(grantKey));
    const reconciledRoot = postPruned.closedGrantKeys && postPruned.closedGrantKeys.length > 0
      ? replaceAuthority(handled.root, { visibility: postPruned.value })
      : handled.root;
    const acceptedCommandCount = reconciledRoot.acceptedCommandCount === current.acceptedCommandCount
      ? current.acceptedCommandCount + 1
      : reconciledRoot.acceptedCommandCount;
    const explicitClosedGrantKeys = new Set(
      handled.payloads
        .filter((payload): payload is Extract<CoreDomainEventPayloadV1, { readonly kind: 'visibility-closed' }> => payload.kind === 'visibility-closed' && payload.reason !== 'automatic')
        .map((payload) => payload.grantKey),
    );
    const closureKeys: string[] = [];
    const seenClosureKeys = new Set<string>();
    for (const grantKey of [...(prePruned.closedGrantKeys ?? []), ...handlerPrunedGrantKeys, ...(postPruned.closedGrantKeys ?? [])]) {
      if (explicitClosedGrantKeys.has(grantKey) || seenClosureKeys.has(grantKey)) continue;
      seenClosureKeys.add(grantKey);
      closureKeys.push(grantKey);
    }
    const closurePayloads = closureKeys.map((grantKey) => ({ kind: 'visibility-closed' as const, grantKey, reason: 'automatic' as const }));
    let acceptedRoot = createModeNeutralCoreRootV1({ ...reconciledRoot, acceptedCommandCount });
    if (recentResolutionSummary !== null) {
      const previous = acceptedRoot.tabletopManual;
      acceptedRoot = createModeNeutralCoreRootV1({
        ...acceptedRoot,
        tabletopManual: createCoreTabletopManualStateV1({
          notes: previous?.notes,
          noteOrder: previous?.noteOrder,
          stackEntries: previous?.stackEntries,
          priorityHolds: previous?.priorityHolds,
          recentResolution: recentResolutionSummary,
        }),
      });
    }
    return eventRoot(acceptedRoot, checked, [...handled.payloads, ...closurePayloads], handled.warnings, before);
  } catch (error: unknown) { return reject(root, [safeIssue(error)], before); }
}
