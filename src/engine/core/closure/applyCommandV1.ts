import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import type { CorePlayerZonesV1 } from '../identityZoneState';
import { createCoreCommanderDamageProvenanceLedgerV1, recordCoreCommanderDamageProvenanceV1 } from '../commander/commanderDamageProvenanceV1';
import { createCoreCommanderDamageStateV1, recordCoreCommanderDamageV1 } from '../commander/commanderDamageV1';
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
import { createCoreTurnPriorityBundleV1 } from '../turn/turnPriorityBundleV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turn/turnLifecycleV1';
import { reconcileCorePlayerExitV1, type CorePlayerExitReferenceBundleV1 } from '../player-lifecycle/playerExitReconciliationV1';
import { applyCoreControlEffectV1, createModeNeutralCoreControlSliceV1 } from '../rules/controlEffectV1';
import { coreDecisionMakerForV1, createModeNeutralCoreDecisionAuthoritySliceV1 } from '../rules/decisionAuthorityV1';
import { completeCoreSearchSessionV1, openCoreSearchSessionV1 } from '../rules/searchSessionOperationsV1';
import { createModeNeutralCoreSearchSessionSliceV1 } from '../rules/searchSessionV1';
import { createCoreRuleAuthorityBundleV1 } from '../rules/ruleAuthorityBundleV1';
import { applyCoreRecordedZoneOrderV1, validateCoreRandomZoneOrderV1 } from './randomZoneOrderV1';
import { coreCanonicalDigestFromValueV1 } from './canonicalV1';
import { createCoreDomainEventV1, type CoreDomainEventPayloadV1 } from './domainEventV1';
import { validateCoreCommandV1, type CoreCommandPayloadV1, type CoreCommandV1 } from './commandV1';
import { createCoreCorrectionWarningV1, validateCoreCorrectionReasonV1 } from './correctionV1';
import { createModeNeutralCoreRootV1, validateModeNeutralCoreRootV1 } from './rootValidationV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';
import type { CoreCommandIssueV1, CoreCommandResultV1, CoreCommandWarningV1 } from './commandResultV1';

type Raw = Record<string, unknown>;
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
  const nextAuthority = createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle: nextTurn });
  return createModeNeutralCoreRootV1({ ...root, ruleAuthority: nextAuthority });
}
function replaceAuthority(root: ModeNeutralCoreRootV1, patch: Partial<ModeNeutralCoreRootV1['ruleAuthority']>): ModeNeutralCoreRootV1 {
  return createModeNeutralCoreRootV1({ ...root, ruleAuthority: createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, ...patch }) });
}
function activePlayerIds(root: ModeNeutralCoreRootV1): readonly CorePlayerId[] { return root.playerLifecycle.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId); }
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

function handlePlayerExit(root: ModeNeutralCoreRootV1, payload: Extract<CoreCommandPayloadV1, { readonly kind: 'player-exit' }>): HandlerResult {
  const registry = stackBundle(root).objectRegistry;
  if (registry.activePlayerId === payload.playerId) adapterFailure('ACTIVE_PLAYER_EXIT_REQUIRES_TURN_TRANSITION', '/payload/playerId', 'The current active player must exit through a turn transition');
  const currentPriorityHolder = root.ruleAuthority.turnPriorityBundle.lifecycle.window.kind === 'priority' ? root.ruleAuthority.turnPriorityBundle.lifecycle.window.holderPlayerId : null;
  if (currentPriorityHolder === payload.playerId) adapterFailure('PRIORITY_HOLDER_EXIT_REQUIRES_TURN_TRANSITION', '/payload/playerId', 'The current priority holder must exit through a turn transition');
  const activeIds = activePlayerIds(root).filter((id) => id !== payload.playerId);
  const owned = allObjectIds(registry).filter((id) => objectOwner(registry, id) === payload.playerId);
  const controlled = allObjectIds(registry).filter((id) => objectController(root, id) === payload.playerId && !owned.includes(id));
  const nonCardStack = registry.zones.shared.stack.filter((id) => { const object = registry.objects[id] as unknown as Raw | undefined; return object?.kind !== 'card' && controlled.includes(id); });
  const combatIds = root.combatContext ? [...root.combatContext.attacks.map((entry) => entry.attackerObjectId), ...root.combatContext.blocks.map((entry) => entry.blockerObjectId)].filter((id) => owned.includes(id) || controlled.includes(id)) : [];
  const controlIds = root.ruleAuthority.control.effectOrder.filter((key) => { const effect = root.ruleAuthority.control.byEffect[key]; return effect.gainingControllerPlayerId === payload.playerId || effect.sourceObjectId !== null && objectOwner(registry, effect.sourceObjectId) === payload.playerId; });
  const decisionIds = root.ruleAuthority.decisionAuthorities.authorityOrder.filter((key) => { const authority = root.ruleAuthority.decisionAuthorities.byAuthority[key]; return authority.controlledPlayerId === payload.playerId || authority.decisionMakerPlayerId === payload.playerId; });
  const searchIds = root.ruleAuthority.searchSessions.sessionOrder.filter((key) => { const session = root.ruleAuthority.searchSessions.bySession[key]; return session.rulesActorPlayerId === payload.playerId || session.selectorPlayerId === payload.playerId || session.zone.kind === 'player-zone' && session.zone.playerId === payload.playerId; });
  const references: CorePlayerExitReferenceBundleV1 = { turnOrder: registry.turnOrder, eligiblePlayerIds: activeIds, activePlayerId: registry.activePlayerId, priorityHolderPlayerId: root.ruleAuthority.turnPriorityBundle.lifecycle.window.kind === 'priority' ? root.ruleAuthority.turnPriorityBundle.lifecycle.window.holderPlayerId : null, ownedObjectIds: owned, controlledObjectIds: controlled, nonCardStackObjectIds: nonCardStack, combatParticipantObjectIds: combatIds, controlEffectIds: controlIds as never, decisionAuthorityIds: decisionIds as never, searchSessionIds: searchIds as never };
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
  const nextAnnouncementByObject: Raw = Object.create(null) as Raw; for (const [id, announcement] of Object.entries(stackBundle(root).stackAnnouncements.byObject)) if (!removeIds.has(id as CoreObjectId)) nextAnnouncementByObject[id] = announcement;
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
  const nextLifecycle = currentLifecycle.window.kind === 'priority'
    ? createModeNeutralCoreTurnLifecycleSliceV1({ turnNumber: currentLifecycle.turnNumber, positionSequence: currentLifecycle.positionSequence, position: currentLifecycle.position, window: { kind: 'priority', cycleStartPlayerId: currentLifecycle.window.cycleStartPlayerId, holderPlayerId: reconciliation.priorityHandoffPlayerId as CorePlayerId, passedPlayerIds: currentLifecycle.window.passedPlayerIds.filter((playerId) => reconciliation.survivingTurnOrder.includes(playerId)) } })
    : currentLifecycle;
  const nextStack = { objectRegistry: nextRegistry, objectRuntime: nextRuntime, stackAnnouncements: nextAnnouncements } as CoreStackTransactionBundleV1;
  const nextTurn = createCoreTurnPriorityBundleV1({ stackBundle: nextStack, pendingTriggers: root.ruleAuthority.turnPriorityBundle.pendingTriggers, lifecycle: nextLifecycle });
  const nextAuthority = createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle: nextTurn, control: nextControl, decisionAuthorities: nextDecision, searchSessions: nextSearch });
  const lifecyclePlayerIds = root.playerLifecycle.players.map((entry) => entry.playerId);
  const nextCommanderDamage = createCoreCommanderDamageStateV1({ commanders: root.commanderDamage.commanders, defendingPlayerIds: lifecyclePlayerIds, entries: root.commanderDamage.entries });
  const nextProvenance = createCoreCommanderDamageProvenanceLedgerV1({ commanders: root.commanderDamageProvenance.commanders, defendingPlayerIds: lifecyclePlayerIds, records: root.commanderDamageProvenance.records });
  const nextCombatContext = root.combatContext === null
    ? null
    : reconcileCoreCombatContextForPlayerExitV1(root.combatContext, { exitingPlayerId: payload.playerId, participantObjectIdsToClear: reconciliation.combatParticipantObjectIdsToClear });
  const nextRoot = createModeNeutralCoreRootV1({ ...root, ruleAuthority: nextAuthority, playerLifecycle: reconciliation.lifecycleState, commanderDamage: nextCommanderDamage, commanderDamageProvenance: nextProvenance, combatContext: nextCombatContext });
  return { root: nextRoot, payloads: [{ kind: 'player-exited', playerId: payload.playerId, cause: payload.cause }], warnings: [] };
}

export function applyCoreCommandV1(root: ModeNeutralCoreRootV1, command: CoreCommandV1): CoreCommandResultV1 {
  const rootValidation = validateModeNeutralCoreRootV1(root);
  if (!rootValidation.ok) return reject(root, rootValidation.issues.map((value) => Object.freeze({ ...value })));
  const current = rootValidation.value;
  const before = coreCanonicalDigestFromValueV1(current);
  const commandValidation = validateCoreCommandV1(command);
  if (!commandValidation.ok) return reject(root, commandValidation.issues, before);
  const checked = commandValidation.value;
  if (checked.sequence !== current.acceptedCommandCount + 1) return reject(root, [{ code: 'SEQUENCE_MISMATCH', path: '/sequence', message: 'Command sequence must immediately follow accepted command count' }], before);
  const activeIds = activePlayerIds(current);
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
  try {
    const payload = checked.payload; let handled: HandlerResult;
    if (payload.kind === 'stack-commit-card-spell') { const result = commitCoreCardSpellToStackV1(stackBundle(current), payload.input); handled = { root: replaceStackBundle(current, result.bundle), payloads: [{ kind: 'stack-changed', operation: 'commit', objectId: result.committedObjectId }], warnings: [] }; }
    else if (payload.kind === 'stack-remove-object') { const result = removeCoreStackObjectV1(stackBundle(current), payload.input); handled = { root: replaceStackBundle(current, result.bundle), payloads: [{ kind: 'stack-changed', operation: 'remove', objectId: result.removedObjectId }], warnings: [] }; }
    else if (payload.kind === 'priority-pass') { const result = passCorePriorityV1({ stackBundle: stackBundle(current), lifecycle: current.ruleAuthority.turnPriorityBundle.lifecycle }, payload.playerId); handled = { root: replaceStackBundle(current, result.stackBundle, result.lifecycle), payloads: [{ kind: 'priority-changed', holderPlayerId: result.lifecycle.window.kind === 'priority' ? result.lifecycle.window.holderPlayerId : null, windowKind: result.lifecycle.window.kind }], warnings: [] }; }
    else if (payload.kind === 'search-open') { const result = preOpenedSearch === null ? openCoreSearchSessionV1(current.ruleAuthority, payload.sessionKey, payload.input) : { value: preOpenedSearch }; handled = { root: replaceAuthority(current, { searchSessions: (result.value as typeof current.ruleAuthority).searchSessions }), payloads: [{ kind: 'search-session-changed', sessionKey: payload.sessionKey, operation: 'open', selectedCount: 0 }], warnings: [] }; }
    else if (payload.kind === 'search-complete') { const result = completeCoreSearchSessionV1(current.ruleAuthority, payload.sessionKey, payload.selectedObjectIds); handled = { root: replaceAuthority(current, { searchSessions: (result.value as typeof current.ruleAuthority).searchSessions }), payloads: [{ kind: 'search-session-changed', sessionKey: payload.sessionKey, operation: 'complete', selectedCount: result.selectedObjectIds?.length ?? 0 }], warnings: [] }; }
    else if (payload.kind === 'control-effect-apply') { const result = applyCoreControlEffectV1(current.ruleAuthority.control, payload.effectKey, payload.effect); handled = { root: replaceAuthority(current, { control: result.value }), payloads: [{ kind: 'control-changed', effectKey: payload.effectKey, targetObjectId: payload.effect.targetObjectId }], warnings: [] }; }
    else if (payload.kind === 'commander-cast-record') { const index = current.commanders.findIndex((commander) => commander.physicalCardId === payload.physicalCardId); if (index < 0) throw new Error('Commander not found'); const ledgers = current.commanderCastLedgers.slice(); if (payload.accepted) ledgers[index] = recordCoreCommanderCastV1(ledgers[index], { origin: payload.origin }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderCastLedgers: ledgers }), payloads: [{ kind: 'commander-cast-recorded', physicalCardId: payload.physicalCardId, accepted: payload.accepted, castCount: ledgers[index].castCount }], warnings: [] }; }
    else if (payload.kind === 'commander-damage-record') { const damage = recordCoreCommanderDamageV1(current.commanderDamage, { commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage }); const provenance = recordCoreCommanderDamageProvenanceV1(current.commanderDamageProvenance, { combatObjectId: payload.combatObjectId, commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderDamage: damage, commanderDamageProvenance: provenance }), payloads: [{ kind: 'commander-damage-recorded', physicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.damage, combatObjectId: payload.combatObjectId }], warnings: [] }; }
    else if (payload.kind === 'combat-step-set') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: setCoreCombatContextStepV1(current.combatContext, payload.step) }), payloads: [{ kind: 'combat-changed', operation: 'step' }], warnings: [] }; }
    else if (payload.kind === 'combat-attack-add') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: addCoreCombatContextAttackV1(current.combatContext, payload.attack) }), payloads: [{ kind: 'combat-changed', operation: 'attack' }], warnings: [] }; }
    else if (payload.kind === 'combat-block-add') { if (!current.combatContext) throw new Error('Combat context is not active'); handled = { root: createModeNeutralCoreRootV1({ ...current, combatContext: addCoreCombatContextBlockV1(current.combatContext, payload.block) }), payloads: [{ kind: 'combat-changed', operation: 'block' }], warnings: [] }; }
    else if (payload.kind === 'player-exit') handled = handlePlayerExit(current, payload);
    else if (payload.kind === 'random-zone-order') { const registry = stackBundle(current).objectRegistry; const order = zoneIds(registry, payload.zone); const issues = validateCoreRandomZoneOrderV1(payload, order); if (issues.length) adapterFailure(issues[0]?.code ?? 'INVALID_RANDOM_ORDER', issues[0]?.path ?? '/payload', issues[0]?.message ?? 'Invalid random zone order'); const nextOrder = applyCoreRecordedZoneOrderV1(order, payload); const nextRegistry = registryWith(registry, { zones: zonesWith(registry, payload.zone, nextOrder) }); handled = { root: updateRegistryInRoot(current, nextRegistry), payloads: [{ kind: 'zone-randomized', randomDecisionId: payload.randomDecisionId, zoneKind: payload.zone.zone, count: payload.afterOrder.length }], warnings: [] }; }
    else if (payload.kind === 'correct-player-life') { if (coreCanonicalDigestFromValueV1(current) !== payload.expectedBeforeStateDigest) throw new Error('Correction digest is stale'); const registry = stackBundle(current).objectRegistry; const player = registry.players[payload.playerId]; if (!player) throw new Error('Correction player is not registered'); const players = { ...registry.players, [payload.playerId]: { ...player, life: payload.replacementLifeTotal } }; handled = { root: updateRegistryInRoot(current, registryWith(registry, { players })), payloads: [{ kind: 'manual-correction-applied', correction: 'player-life' }], warnings: [createCoreCorrectionWarningV1(payload.reason)] }; }
    else { if (coreCanonicalDigestFromValueV1(current) !== payload.expectedBeforeStateDigest) throw new Error('Correction digest is stale'); if (validateCoreCorrectionReasonV1(payload.reason).length) throw new Error('Correction reason is invalid'); const state = current.commanderDamage; const entries = state.entries.filter((entry) => !(entry.commanderPhysicalCardId === payload.physicalCardId && entry.defendingPlayerId === payload.defendingPlayerId)); if (payload.replacementDamageTotal > 0) entries.push({ commanderPhysicalCardId: payload.physicalCardId, defendingPlayerId: payload.defendingPlayerId, damage: payload.replacementDamageTotal }); const damage = createCoreCommanderDamageStateV1({ commanders: state.commanders, defendingPlayerIds: state.defendingPlayerIds, entries }); handled = { root: createModeNeutralCoreRootV1({ ...current, commanderDamage: damage }), payloads: [{ kind: 'manual-correction-applied', correction: 'commander-damage' }], warnings: [createCoreCorrectionWarningV1(payload.reason)] }; }
    const acceptedRoot = createModeNeutralCoreRootV1({ ...handled.root, acceptedCommandCount: current.acceptedCommandCount + 1 });
    return eventRoot(acceptedRoot, checked, handled.payloads, handled.warnings, before);
  } catch (error: unknown) { return reject(root, [safeIssue(error)], before); }
}
