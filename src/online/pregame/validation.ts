import { coreSha256HexV1, isCoreBaseId, isCanonicalCoreObjectIdV2 } from '../../engine/core/index';
import type { CorePhysicalCardId, CorePlayerId } from '../../engine/core/index';
import { validateOnlineVariableProtocolStateV2 } from '../protocol/index';
import type { OnlineVariableProtocolStateV2 } from '../protocol/index';
import type {
  OnlinePregameCommandEnvelopeV1,
  OnlinePregameCommandV1,
  OnlinePregameJournalEntryV1,
  OnlinePregamePhaseV1,
  OnlinePregamePlayerV1,
  OnlinePregameRandomPlanV1,
  OnlinePregameStateV1,
  OnlinePregameValidationIssueV1,
  OnlinePregameValidationResultV1,
} from './types';

type Raw = Record<string, unknown>;
const PHASES: readonly OnlinePregamePhaseV1[] = ['commander-reveal', 'mulligan-declaration', 'mulligan-bottom', 'pregame-actions', 'ready', 'complete'];

function plain(value: unknown): value is Raw {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null); } catch { return false; }
}
function snapshot(value: unknown, fields: readonly string[]): Raw | null {
  if (!plain(value)) return null;
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) return null;
    const output: Raw = Object.create(null) as Raw;
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      output[field] = descriptor.value as unknown;
    }
    return output;
  } catch { return null; }
}
function dataField(value: unknown, field: string): unknown {
  if (!plain(value)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
    return descriptor.value as unknown;
  } catch { return null; }
}
function issue(code: string, path: string, message: string): OnlinePregameValidationIssueV1 { return Object.freeze({ code, path, message }); }
function fail<T>(message: string): OnlinePregameValidationResultV1<T> { return { ok: false, issues: [issue('INVALID_STATE', '', message)] }; }
function freezeCommand(command: OnlinePregameCommandV1): OnlinePregameCommandV1 { return Object.freeze({ ...command, ...('objectIds' in command ? { objectIds: Object.freeze([...command.objectIds]) } : {}) }); }

function validId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value); }
function validDecisionId(value: unknown): value is string { return typeof value === 'string' && isCoreBaseId(value) && value.length <= 128; }
function validObject(value: unknown): value is string { return typeof value === 'string' && isCanonicalCoreObjectIdV2(value); }
function denseSnapshot(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const lengthValue: unknown = lengthDescriptor.value as unknown;
    const length = lengthValue as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes('length')) return null;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      output.push(descriptor.value as unknown);
    }
    return Object.freeze(output);
  } catch { return null; }
}

function seatOrder(state: OnlineVariableProtocolStateV2): readonly string[] {
  return state.room.seats.map((seat) => seat.corePlayerId);
}
function physicalLibrary(state: OnlineVariableProtocolStateV2, playerId: string): readonly string[] {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const library = registry.zones.byPlayer[playerId as never]?.library.map((objectId) => {
    const object = registry.objects[objectId];
    return object?.kind === 'card' ? object.physicalCardId : '';
  }) ?? [];
  const hand = registry.zones.byPlayer[playerId as never]?.hand.map((objectId) => {
    const object = registry.objects[objectId];
    return object?.kind === 'card' ? object.physicalCardId : '';
  }) ?? [];
  return Object.freeze([...library, ...hand]);
}

export function validateOnlinePregameRandomPlanV1(input: unknown, initialInput: unknown): OnlinePregameValidationResultV1<OnlinePregameRandomPlanV1> {
  const initial = validateOnlineVariableProtocolStateV2(initialInput);
  if (!initial.ok) return fail('Initial Protocol state is invalid');
  const state = initial.value;
  const raw = snapshot(input, ['kind', 'schemaVersion', 'decisionId', 'startingPlayerId', 'turnOrder', 'libraryPlans']);
  if (raw === null) return fail('Random plan fields are invalid');
  if (raw.kind !== 'online-pregame-random-plan-v1' || raw.schemaVersion !== 1 || !validDecisionId(raw.decisionId) || !validId(raw.startingPlayerId)) return fail('Random plan descriptor is invalid');
  if ((state.room.lifecycle !== 'started' && state.room.lifecycle !== 'active') || state.configuration.startingLife !== 40) return fail('Pregame requires a virgin 40-life Room');
  const seats = seatOrder(state);
  const turnOrder = denseSnapshot(raw.turnOrder);
  if (turnOrder === null || turnOrder.length !== seats.length || !turnOrder.every(validId)) return fail('Random turn order is invalid');
  const startIndex = seats.indexOf(raw.startingPlayerId);
  if (startIndex < 0 || turnOrder.some((id, index) => id !== seats[(startIndex + index) % seats.length]) || new Set(turnOrder).size !== seats.length) return fail('Random turn order is not the seat rotation');
  const libraryPlans = denseSnapshot(raw.libraryPlans);
  if (libraryPlans === null || libraryPlans.length !== seats.length) return fail('Random library plans are invalid');
  const orderCount = seats.length === 2 ? 8 : 9;
  const seenPlayers = new Set<string>();
  const normalizedPlans: Array<Readonly<{ playerId: CorePlayerId; orders: readonly (readonly CorePhysicalCardId[])[] }>> = [];
  for (let index = 0; index < libraryPlans.length; index += 1) {
    const row = snapshot(libraryPlans[index], ['playerId', 'orders']);
    if (row === null || !validId(row.playerId) || row.playerId !== seats[index] || seenPlayers.has(row.playerId)) return fail('Random library plan player order is invalid');
    seenPlayers.add(row.playerId);
    const candidatePlans = denseSnapshot(row.orders);
    if (candidatePlans === null || candidatePlans.length !== orderCount) return fail('Random library plan count is invalid');
    const expected = physicalLibrary(state, row.playerId);
    const expectedSet = new Set(expected);
    const orders: Array<readonly string[]> = [];
    for (const candidateInput of candidatePlans) {
    const candidate = denseSnapshot(candidateInput);
    if (candidate === null || candidate.length !== expected.length || !candidate.every((id): id is string => typeof id === 'string' && isCoreBaseId(id))) return fail('Random permutation shape is invalid');
      const seen = new Set<string>();
      for (const id of candidate) if (!expectedSet.has(id) || seen.has(id)) return fail('Random permutation is not an exact physical-card permutation'); else seen.add(id);
      orders.push(Object.freeze([...candidate]));
    }
    normalizedPlans.push(Object.freeze({ playerId: row.playerId as CorePlayerId, orders: Object.freeze(orders.map((current) => current as readonly CorePhysicalCardId[])) }));
  }
  const value = Object.freeze({ kind: 'online-pregame-random-plan-v1' as const, schemaVersion: 1 as const, decisionId: raw.decisionId, startingPlayerId: raw.startingPlayerId as CorePlayerId, turnOrder: Object.freeze((turnOrder).map((id) => id as CorePlayerId)), libraryPlans: Object.freeze(normalizedPlans) });
  return { ok: true, value };
}

export function validateOnlinePregameCommandV1(input: unknown): OnlinePregameValidationResultV1<OnlinePregameCommandV1> {
  if (!plain(input)) return fail('Command must be a plain record');
  const kind = dataField(input, 'kind');
  if (kind === null) return fail('Command descriptor is invalid');
  if (kind === 'confirm-commanders' || kind === 'record-manual-pregame-action' || kind === 'complete-pregame-actions') {
    if (snapshot(input, ['kind']) === null) return fail('Command fields are invalid');
    return { ok: true, value: Object.freeze({ kind }) as OnlinePregameCommandV1 };
  }
  if (kind === 'declare-mulligan') {
    const row = snapshot(input, ['kind', 'decision']);
    if (row === null || (row.decision !== 'mulligan' && row.decision !== 'keep')) return fail('Mulligan decision is invalid');
    return { ok: true, value: Object.freeze({ kind, decision: row.decision }) as OnlinePregameCommandV1 };
  }
  if (kind === 'submit-mulligan-bottom') {
    const row = snapshot(input, ['kind', 'objectIds']);
    const ids = row === null ? null : denseSnapshot(row.objectIds);
    if (ids === null || ids.length > 7 || !ids.every(validObject) || new Set(ids).size !== ids.length) return fail('Bottom object IDs are invalid');
    return { ok: true, value: Object.freeze({ kind, objectIds: Object.freeze([...(ids)]) }) as OnlinePregameCommandV1 };
  }
  if (kind === 'set-ready') {
    const row = snapshot(input, ['kind', 'ready']);
    if (row === null || typeof row.ready !== 'boolean') return fail('Ready choice is invalid');
    return { ok: true, value: Object.freeze({ kind, ready: row.ready }) as OnlinePregameCommandV1 };
  }
  return fail('Unknown Pregame command');
}

export function validateOnlinePregameCommandEnvelopeV1(input: unknown): OnlinePregameValidationResultV1<OnlinePregameCommandEnvelopeV1> {
  const raw = snapshot(input, ['kind', 'schemaVersion', 'roomId', 'participantId', 'participantCapability', 'commandId', 'baseRevision', 'command']);
  if (raw === null) return fail('Command envelope fields are invalid');
  if (raw.kind !== 'online-pregame-command-envelope-v1' || raw.schemaVersion !== 1 || !validId(raw.roomId) || !validId(raw.participantId) || typeof raw.participantCapability !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/u.test(raw.participantCapability) || !validId(raw.commandId) || typeof raw.baseRevision !== 'number' || !Number.isSafeInteger(raw.baseRevision) || raw.baseRevision < 0) return fail('Command envelope descriptor is invalid');
  const command = validateOnlinePregameCommandV1(raw.command);
  if (!command.ok) return command;
  return { ok: true, value: Object.freeze({ kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: raw.roomId, participantId: raw.participantId, participantCapability: raw.participantCapability, commandId: raw.commandId, baseRevision: raw.baseRevision, command: freezeCommand(command.value) }) };
}

function validatePlayer(value: unknown, playerId: string, state: OnlineVariableProtocolStateV2): OnlinePregamePlayerV1 | null {
  const row = snapshot(value, ['playerId', 'commanderConfirmed', 'mulliganDecision', 'mulligansTaken', 'bottomCountRequired', 'pendingBottomObjectIds', 'manualActionCount', 'manualActionsComplete', 'ready']);
  if (row === null) return null;
  const pendingBottomObjectIds = denseSnapshot(row.pendingBottomObjectIds);
  if (row.playerId !== playerId || typeof row.commanderConfirmed !== 'boolean' || !['pending', 'mulligan', 'keep'].includes(row.mulliganDecision as string) || typeof row.mulligansTaken !== 'number' || !Number.isSafeInteger(row.mulligansTaken) || row.mulligansTaken < 0 || typeof row.bottomCountRequired !== 'number' || !Number.isSafeInteger(row.bottomCountRequired) || row.bottomCountRequired < 0 || pendingBottomObjectIds === null || !pendingBottomObjectIds.every(validObject) || typeof row.manualActionCount !== 'number' || !Number.isSafeInteger(row.manualActionCount) || row.manualActionCount < 0 || row.manualActionCount > 16 || typeof row.manualActionsComplete !== 'boolean' || typeof row.ready !== 'boolean') return null;
  const maxMulligans = state.configuration.playerCount === 2 ? 7 : 8;
  if (row.mulligansTaken > maxMulligans) return null;
  if (state.configuration.playerCount === 2 && row.bottomCountRequired !== 0 && row.bottomCountRequired !== row.mulligansTaken) return null;
  if (state.configuration.playerCount === 4 && row.bottomCountRequired !== 0 && row.bottomCountRequired !== Math.max(0, row.mulligansTaken - 1)) return null;
  return Object.freeze({ playerId: row.playerId as never, commanderConfirmed: row.commanderConfirmed, mulliganDecision: row.mulliganDecision as never, mulligansTaken: row.mulligansTaken, bottomCountRequired: row.bottomCountRequired, pendingBottomObjectIds: Object.freeze([...(pendingBottomObjectIds)]) as never, manualActionCount: row.manualActionCount, manualActionsComplete: row.manualActionsComplete, ready: row.ready });
}

export function validateOnlinePregameStateV1(input: unknown): OnlinePregameValidationResultV1<OnlinePregameStateV1> {
  const raw = snapshot(input, ['kind', 'schemaVersion', 'protocolState', 'randomPlan', 'phase', 'currentPlayerId', 'mulliganRound', 'players', 'revision', 'journal']);
  if (raw === null) return fail('Pregame state fields are invalid');
  const protocol = validateOnlineVariableProtocolStateV2(raw.protocolState);
  if (!protocol.ok) return fail('Pregame Protocol state is invalid');
  const plan = validateOnlinePregameRandomPlanV1(raw.randomPlan, protocol.value);
  if (!plan.ok) return fail('Pregame random plan is invalid');
  const rawPlayers = denseSnapshot(raw.players);
  const rawJournal = denseSnapshot(raw.journal);
  if (raw.kind !== 'online-pregame-state-v1' || raw.schemaVersion !== 1 || !PHASES.includes(raw.phase as OnlinePregamePhaseV1) || (raw.currentPlayerId !== null && !validId(raw.currentPlayerId)) || typeof raw.mulliganRound !== 'number' || !Number.isSafeInteger(raw.mulliganRound) || raw.mulliganRound < 0 || typeof raw.revision !== 'number' || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || rawPlayers === null || rawJournal === null) return fail('Pregame state scalar fields are invalid');
  const seats = seatOrder(protocol.value);
  const phase = raw.phase as OnlinePregamePhaseV1;
  const currentPlayerId = raw.currentPlayerId as CorePlayerId | null;
  if (rawPlayers.length !== seats.length) return fail('Pregame player roster is invalid');
  const players: OnlinePregamePlayerV1[] = [];
  for (let index = 0; index < seats.length; index += 1) { const player = validatePlayer(rawPlayers[index], seats[index], protocol.value); if (player === null) return fail('Pregame player record is invalid'); players.push(player); }
  if (rawJournal.length > 256) return fail('Pregame journal exceeds capacity');
  const registry = protocol.value.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const coreOrder = registry.turnOrder;
  const planOrder = plan.value.turnOrder;
  if (coreOrder.length !== seats.length || coreOrder.length !== planOrder.length || new Set(coreOrder).size !== coreOrder.length || new Set(planOrder).size !== planOrder.length || coreOrder.some((playerId, index) => playerId !== planOrder[index])) return fail('Pregame turn-order relation is invalid');
  const corePlayers = registry.players;
  const root = protocol.value.coreRoot;
  const turn = root.ruleAuthority.turnPriorityBundle;
  const stack = turn.stackBundle;
  const isEmptyRecord = (value: object): boolean => Object.keys(value).length === 0;
  const baselineLifecycle = turn.lifecycle.turnNumber === 1 && turn.lifecycle.positionSequence === 0 && turn.lifecycle.position.phase === 'beginning' && turn.lifecycle.position.step === 'untap' && turn.lifecycle.window.kind === 'turn-based-action-required' && turn.lifecycle.window.action === 'untap-step-actions' && turn.lifecycle.window.playerId === registry.activePlayerId;
  const baselineAuthorities = isEmptyRecord(root.ruleAuthority.control.byEffect) && root.ruleAuthority.control.effectOrder.length === 0 && isEmptyRecord(root.ruleAuthority.control.continuityByObject) && isEmptyRecord(root.ruleAuthority.visibility.byGrant) && root.ruleAuthority.visibility.grantOrder.length === 0 && isEmptyRecord(root.ruleAuthority.searchSessions.bySession) && root.ruleAuthority.searchSessions.sessionOrder.length === 0 && isEmptyRecord(root.ruleAuthority.playPermissions.byPermission) && root.ruleAuthority.playPermissions.permissionOrder.length === 0 && isEmptyRecord(root.ruleAuthority.decisionAuthorities.byAuthority) && root.ruleAuthority.decisionAuthorities.authorityOrder.length === 0;
  const baselineStack = turn.pendingTriggers.pendingObjectIds.length === 0 && isEmptyRecord(turn.pendingTriggers.byObject) && isEmptyRecord(stack.stackAnnouncements.byObject);
  const runtimeByObject = new Map(Object.entries(stack.objectRuntime.byObject));
  const baselineRuntime = runtimeByObject.size === Object.keys(registry.objects).length && Object.entries(registry.objects).every(([objectId]) => {
    const runtimeState = runtimeByObject.get(objectId);
    return runtimeState !== undefined && runtimeState.orientation.faceIndex === 0 && runtimeState.orientation.faceDown === false && runtimeState.orientation.tapped === false && runtimeState.orientation.flipped === false && runtimeState.orientation.phasedOut === false && runtimeState.counterDamage.markedDamage === 0 && runtimeState.counterDamage.counters.length === 0 && runtimeState.attachment.attachedTo === null;
  });
  const baselineCommanders = root.commanderCastLedgers.every((ledger) => ledger.castCount === 0) && root.commanderDamage.entries.length === 0 && root.commanderDamageProvenance.records.length === 0 && root.combatContext === null;
  if (root.acceptedCommandCount !== 0 || registry.activePlayerId !== plan.value.startingPlayerId || !baselineLifecycle || !baselineAuthorities || !baselineStack || !baselineRuntime || !baselineCommanders || root.playerLifecycle.players.some((player) => player.status !== 'active' || player.exitCause !== null) || registry.zones.shared.battlefield.length !== 0 || registry.zones.shared.stack.length !== 0 || registry.zones.shared.exile.length !== 0) return fail('Pregame Core virgin baseline relation is invalid');
  for (const player of players) {
    const corePlayer = corePlayers[player.playerId];
    const zones = registry.zones.byPlayer[player.playerId];
    if (corePlayer === undefined || zones === undefined || corePlayer.life !== 40 || corePlayer.poison !== 0 || corePlayer.energy !== 0 || corePlayer.experience !== 0 || Object.values(corePlayer.manaPool).some((amount) => amount !== 0) || corePlayer.landsPlayedThisTurn !== 0 || corePlayer.spellsCastThisTurn !== 0 || corePlayer.drawnThisTurn !== 0 || corePlayer.maximumHandSizeOverride !== 'none' || corePlayer.mulliganCount !== player.mulligansTaken || zones.hand.length > 7 || new Set(player.pendingBottomObjectIds).size !== player.pendingBottomObjectIds.length || player.pendingBottomObjectIds.some((objectId) => !zones.hand.includes(objectId))) return fail('Pregame Core hand relation is invalid');
    const expectedHand = phase === 'commander-reveal' ? 0 : phase === 'mulligan-bottom' && player.mulliganDecision === 'mulligan' ? 7 : Math.max(0, 7 - (player.pendingBottomObjectIds.length === 0 ? player.bottomCountRequired : 0));
    if (zones.hand.length !== expectedHand) return fail('Pregame Core hand-size relation is invalid');
    if (phase === 'mulligan-bottom' && player.bottomCountRequired > 0 && player.pendingBottomObjectIds.length > player.bottomCountRequired) return fail('Pregame bottom relation is invalid');
    if (phase !== 'mulligan-bottom' && player.pendingBottomObjectIds.length !== 0) return fail('Pregame pending bottom relation is invalid');
  }
  const journal: OnlinePregameJournalEntryV1[] = [];
  const journalIds = new Set<string>();
  const seatedParticipants = new Set(protocol.value.room.seats.map((seat) => seat.participantId).filter((participantId): participantId is string => participantId !== null));
  for (const entry of rawJournal) {
    const row = snapshot(entry, ['command', 'participantId', 'baseRevision', 'commandId', 'requestDigest', 'response']);
    if (row === null) return fail('Pregame journal entry is invalid');
    const command = validateOnlinePregameCommandV1(row.command);
    const response = snapshot(row.response, ['accepted', 'revision', 'duplicate']);
    if (!command.ok || !validId(row.participantId) || !validId(row.commandId) || typeof row.baseRevision !== 'number' || !Number.isSafeInteger(row.baseRevision) || typeof row.requestDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(row.requestDigest) || response === null) return fail('Pregame journal entry is invalid');
    if (typeof response.accepted !== 'boolean' || typeof response.revision !== 'number' || !Number.isSafeInteger(response.revision) || typeof response.duplicate !== 'boolean') return fail('Pregame journal response is invalid');
    if (journal.length >= 256 || !seatedParticipants.has(row.participantId) || journalIds.has(row.commandId) || row.baseRevision !== journal.length || !response.accepted || response.duplicate || response.revision !== journal.length + 1) return fail('Pregame journal relation is invalid');
    const expectedDigest = coreSha256HexV1(JSON.stringify({ participantId: row.participantId, baseRevision: row.baseRevision, command: command.value }));
    if (row.requestDigest !== expectedDigest) return fail('Pregame journal digest is invalid');
    journalIds.add(row.commandId);
    journal.push(Object.freeze({ command: command.value, participantId: row.participantId, baseRevision: row.baseRevision, commandId: row.commandId, requestDigest: row.requestDigest, response: Object.freeze({ accepted: response.accepted, revision: response.revision, duplicate: response.duplicate }) }));
  }
  type SimPlayer = { playerId: CorePlayerId; commanderConfirmed: boolean; mulliganDecision: 'pending' | 'mulligan' | 'keep'; mulligansTaken: number; bottomCountRequired: number; pendingBottomCount: number; manualActionCount: number; manualActionsComplete: boolean; ready: boolean };
  const simPlayers: SimPlayer[] = seats.map((playerId) => ({ playerId: playerId as CorePlayerId, commanderConfirmed: false, mulliganDecision: 'pending', mulligansTaken: 0, bottomCountRequired: 0, pendingBottomCount: 0, manualActionCount: 0, manualActionsComplete: false, ready: false }));
  const simById = (playerId: CorePlayerId): SimPlayer | undefined => simPlayers.find((player) => player.playerId === playerId);
  const simNext = (predicate: (player: SimPlayer) => boolean): CorePlayerId | null => { for (const playerId of plan.value.turnOrder) { const player = simById(playerId); if (player !== undefined && predicate(player)) return playerId; } return null; };
  type SimCards = { library: string[]; hand: string[] };
  const simCards = new Map<CorePlayerId, SimCards>();
  const activeBottom = new Set<CorePlayerId>();
  const pendingBottom = new Map<CorePlayerId, readonly string[]>();
  const physical = (objectId: string): string => { const separator = objectId.lastIndexOf(':'); return separator < 0 ? objectId : objectId.slice(0, separator); };
  const incarnation = (objectId: string): number => { const separator = objectId.lastIndexOf(':'); const value = Number(separator < 0 ? '' : objectId.slice(separator + 1)); return Number.isSafeInteger(value) && value >= 0 ? value : -1; };
  const reincarnate = (objectId: string): string => `${physical(objectId)}:${String(incarnation(objectId) + 1)}`;
  for (const playerId of seats as CorePlayerId[]) {
    const firstOrder = plan.value.libraryPlans.find((entry) => entry.playerId === playerId)?.orders[0];
    if (firstOrder === undefined) return fail('Pregame random plan card relation is invalid');
    simCards.set(playerId, { library: firstOrder.map((physicalId) => `${physicalId}:0`), hand: [] });
  }
  const openingDeal = (playerId: CorePlayerId): boolean => {
    const cards = simCards.get(playerId); const firstOrder = plan.value.libraryPlans.find((entry) => entry.playerId === playerId)?.orders[0];
    if (cards === undefined || firstOrder === undefined || firstOrder.length !== cards.library.length) return false;
    const byPhysical = new Map(cards.library.map((objectId) => [physical(objectId), objectId]));
    const ordered = firstOrder.map((physicalId) => byPhysical.get(physicalId));
    if (ordered.some((objectId): objectId is undefined => objectId === undefined)) return false;
    cards.library = ordered as string[]; cards.hand = [];
    for (let index = 0; index < 7; index += 1) { const objectId = cards.library.shift(); if (objectId === undefined) return false; cards.hand.push(reincarnate(objectId)); }
    return true;
  };
  const mulliganDeal = (playerId: CorePlayerId, round: number): boolean => {
    const cards = simCards.get(playerId); const order = plan.value.libraryPlans.find((entry) => entry.playerId === playerId)?.orders[round];
    if (cards === undefined || order === undefined || order.length !== cards.library.length + cards.hand.length) return false;
    const byPhysical = new Map<string, string>();
    for (const objectId of cards.library) byPhysical.set(physical(objectId), objectId);
    for (const objectId of cards.hand) byPhysical.set(physical(objectId), reincarnate(objectId));
    const ordered = order.map((physicalId) => byPhysical.get(physicalId));
    if (ordered.some((objectId): objectId is undefined => objectId === undefined)) return false;
    cards.library = ordered as string[]; cards.hand = [];
    for (let index = 0; index < 7; index += 1) { const objectId = cards.library.shift(); if (objectId === undefined) return false; cards.hand.push(reincarnate(objectId)); }
    return true;
  };
  const commitBottoms = (): boolean => {
    for (const playerId of seats as CorePlayerId[]) {
      if (!activeBottom.has(playerId)) continue;
      const cards = simCards.get(playerId); const objectIds = pendingBottom.get(playerId);
      if (cards === undefined || objectIds === undefined || objectIds.length === 0) return false;
      const hand = [...cards.hand];
      for (const objectId of objectIds) { const index = hand.indexOf(objectId); if (index < 0) return false; hand.splice(index, 1); cards.library.push(reincarnate(objectId)); }
      cards.hand = hand;
    }
    activeBottom.clear(); pendingBottom.clear();
    return true;
  };
  let simPhase: OnlinePregamePhaseV1 = 'commander-reveal';
  let simCurrent: CorePlayerId | null = plan.value.startingPlayerId;
  let simRound = 0;
  let cardsApplied = false;
  for (const entry of journal) {
    const seat = protocol.value.room.seats.find((candidate) => candidate.participantId === entry.participantId);
    const actor = seat?.corePlayerId;
    const player = actor === undefined ? undefined : simById(actor);
    if (player === undefined || (simPhase !== 'ready' && simCurrent !== actor)) return fail('Pregame journal actor relation is invalid');
    const command = entry.command;
    if (command.kind === 'confirm-commanders') {
      if (simPhase !== 'commander-reveal' || player.commanderConfirmed) return fail('Pregame journal phase relation is invalid');
      player.commanderConfirmed = true;
      const next = simNext((candidate) => !candidate.commanderConfirmed);
      if (next === null) { if (!seats.every((playerId) => openingDeal(playerId as CorePlayerId))) return fail('Pregame opening card relation is invalid'); cardsApplied = true; simPhase = 'mulligan-declaration'; simCurrent = plan.value.startingPlayerId; } else simCurrent = next;
    } else if (command.kind === 'declare-mulligan') {
      if (simPhase !== 'mulligan-declaration' || player.mulliganDecision !== 'pending') return fail('Pregame journal phase relation is invalid');
      const maxMulligans = protocol.value.configuration.playerCount === 2 ? 7 : 8;
      if (command.decision === 'mulligan') { if (player.mulligansTaken >= maxMulligans) return fail('Pregame journal mulligan plan is exhausted'); player.mulligansTaken += 1; }
      player.mulliganDecision = command.decision;
      const pending = simNext((candidate) => candidate.mulliganDecision === 'pending');
      if (pending !== null) { simCurrent = pending; continue; }
      const mulliganers = simPlayers.filter((candidate) => candidate.mulliganDecision === 'mulligan');
      if (mulliganers.length === 0) { simPhase = 'pregame-actions'; simCurrent = plan.value.startingPlayerId; continue; }
      simRound += 1;
      for (const candidate of mulliganers) { candidate.bottomCountRequired = protocol.value.configuration.playerCount === 2 ? candidate.mulligansTaken : Math.max(0, candidate.mulligansTaken - 1); candidate.pendingBottomCount = 0; if (candidate.bottomCountRequired === 0) candidate.mulliganDecision = 'pending'; }
      for (const candidate of mulliganers) if (!mulliganDeal(candidate.playerId, simRound)) return fail('Pregame mulligan card relation is invalid');
      activeBottom.clear(); pendingBottom.clear();
      for (const candidate of mulliganers) if (candidate.bottomCountRequired > 0) activeBottom.add(candidate.playerId);
      const bottomActor = simNext((candidate) => candidate.mulliganDecision === 'mulligan' && candidate.bottomCountRequired > 0);
      if (bottomActor !== null) { simPhase = 'mulligan-bottom'; simCurrent = bottomActor; } else { simPhase = 'mulligan-declaration'; simCurrent = simNext((candidate) => candidate.mulliganDecision === 'pending'); }
    } else if (command.kind === 'submit-mulligan-bottom') {
      if (simPhase !== 'mulligan-bottom' || player.bottomCountRequired <= 0 || command.objectIds.length !== player.bottomCountRequired) return fail('Pregame journal bottom relation is invalid');
      player.pendingBottomCount = command.objectIds.length;
      pendingBottom.set(player.playerId, command.objectIds);
      const waiting = simNext((candidate) => candidate.bottomCountRequired > 0 && candidate.mulliganDecision === 'mulligan' && candidate.pendingBottomCount !== candidate.bottomCountRequired);
      if (waiting !== null) { simCurrent = waiting; continue; }
      const maxMulligans = protocol.value.configuration.playerCount === 2 ? 7 : 8;
      if (!commitBottoms()) return fail('Pregame bottom card relation is invalid');
      for (const candidate of simPlayers) if (candidate.bottomCountRequired > 0 && candidate.mulliganDecision === 'mulligan') { candidate.pendingBottomCount = 0; if (candidate.mulligansTaken >= maxMulligans) candidate.mulliganDecision = 'keep'; else candidate.mulliganDecision = 'pending'; }
      const next = simNext((candidate) => candidate.mulliganDecision === 'pending');
      if (next === null) { simPhase = 'pregame-actions'; simCurrent = plan.value.startingPlayerId; } else { simPhase = 'mulligan-declaration'; simCurrent = next; }
    } else if (command.kind === 'record-manual-pregame-action') {
      if (simPhase !== 'pregame-actions' || player.manualActionsComplete || player.manualActionCount >= 16) return fail('Pregame journal phase relation is invalid');
      player.manualActionCount += 1;
    } else if (command.kind === 'complete-pregame-actions') {
      if (simPhase !== 'pregame-actions' || player.manualActionsComplete) return fail('Pregame journal phase relation is invalid');
      player.manualActionsComplete = true;
      const next = simNext((candidate) => !candidate.manualActionsComplete);
      if (next === null) { simPhase = 'ready'; simCurrent = null; } else simCurrent = next;
    } else if (command.kind === 'set-ready') {
      if (simPhase !== 'ready' || player.ready === command.ready) return fail('Pregame journal phase relation is invalid');
      player.ready = command.ready;
      if (simPlayers.every((candidate) => candidate.ready)) { simPhase = 'complete'; simCurrent = null; }
    }
  }
  const turnOrder = plan.value.turnOrder;
  if (journal.length !== raw.revision || protocol.value.revision !== 0 || !turnOrder.includes(plan.value.startingPlayerId) || (currentPlayerId !== null && !turnOrder.includes(currentPlayerId)) || ((phase === 'ready' || phase === 'complete') !== (currentPlayerId === null)) || simPhase !== phase || simCurrent !== currentPlayerId || simRound !== raw.mulliganRound) return fail('Pregame phase relation is invalid');
  if ((phase === 'commander-reveal' && raw.mulliganRound !== 0) || (phase !== 'commander-reveal' && players.some((player) => !player.commanderConfirmed)) || (phase === 'complete' && players.some((player) => !player.ready)) || ((phase === 'complete') !== (protocol.value.room.lifecycle === 'active'))) return fail('Pregame lifecycle relation is invalid');
  for (const player of players) {
    const simulated = simById(player.playerId);
    const simulatedPending = pendingBottom.get(player.playerId) ?? [];
    if (simulated === undefined || simulated.commanderConfirmed !== player.commanderConfirmed || simulated.mulliganDecision !== player.mulliganDecision || simulated.mulligansTaken !== player.mulligansTaken || simulated.bottomCountRequired !== player.bottomCountRequired || simulated.pendingBottomCount !== player.pendingBottomObjectIds.length || simulatedPending.length !== player.pendingBottomObjectIds.length || simulatedPending.some((objectId, index) => objectId !== player.pendingBottomObjectIds[index]) || simulated.manualActionCount !== player.manualActionCount || simulated.manualActionsComplete !== player.manualActionsComplete || simulated.ready !== player.ready) return fail('Pregame journal semantic relation is invalid');
  }
  if (phase !== 'commander-reveal') {
    if (!cardsApplied) return fail('Pregame card lifecycle relation is invalid');
    for (const playerId of seats as CorePlayerId[]) {
      const simulated = simCards.get(playerId);
      const actual = registry.zones.byPlayer[playerId];
      if (simulated === undefined || actual === undefined || simulated.library.length !== actual.library.length || simulated.hand.length !== actual.hand.length || simulated.library.some((objectId, index) => objectId !== actual.library[index]) || simulated.hand.some((objectId, index) => objectId !== actual.hand[index])) return fail('Pregame Core card-zone relation is invalid');
    }
  }
  return { ok: true, value: Object.freeze({ kind: 'online-pregame-state-v1', schemaVersion: 1, protocolState: protocol.value, randomPlan: plan.value, phase: raw.phase as OnlinePregamePhaseV1, currentPlayerId: raw.currentPlayerId as never, mulliganRound: raw.mulliganRound, players: Object.freeze(players), revision: raw.revision, journal: Object.freeze(journal) }) };
}
