import { createOnlineVariableProtocolStateV2, validateOnlineVariableProtocolStateV2 } from '../protocol/index';
import { activateOnlineVariableRoomV2 } from '../room/variable';
import type { OnlineVariableProtocolStateV2 } from '../protocol/index';
import {
  applyCorePregameMulliganWaveV1,
  commitCorePregameBottomBatchV1,
  dealCorePregameOpeningHandsV1,
  rotateCorePregameTurnOrderV1,
} from '../../engine/core/index';
import { coreSha256HexV1 } from '../../engine/core/index';
import type { CoreObjectId, CorePlayerId } from '../../engine/core/index';
import {
  validateOnlinePregameCommandV1,
  validateOnlinePregameCommandEnvelopeV1,
  validateOnlinePregameRandomPlanV1,
  validateOnlinePregameStateV1,
} from './validation';
import type {
  OnlinePregameCommandAckV1,
  OnlinePregameCommandEnvelopeV1,
  OnlinePregameCommandRejectV1,
  OnlinePregameCommandV1,
  OnlinePregameJournalEntryV1,
  OnlinePregamePlayerV1,
  OnlinePregameStateV1,
  OnlinePregameTransitionV1,
  OnlinePregameValidationResultV1,
} from './types';

const JOURNAL_LIMIT = 256;
const TRUSTED_STATES = new WeakSet<object>();
function denseJournal(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.value > JOURNAL_LIMIT) return null;
    const length = lengthDescriptor.value as number;
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
function snapshotRecord(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) return null;
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      output[field] = descriptor.value as unknown;
    }
    return output;
  } catch { return null; }
}

function freezeState(value: Omit<OnlinePregameStateV1, 'kind' | 'schemaVersion'>): OnlinePregameStateV1 {
  const state = Object.freeze({
    kind: 'online-pregame-state-v1' as const,
    schemaVersion: 1 as const,
    protocolState: value.protocolState,
    randomPlan: value.randomPlan,
    phase: value.phase,
    currentPlayerId: value.currentPlayerId,
    mulliganRound: value.mulliganRound,
    players: Object.freeze(value.players.map((player) => Object.freeze({ ...player, pendingBottomObjectIds: Object.freeze([...player.pendingBottomObjectIds]) }))),
    revision: value.revision,
    journal: Object.freeze(value.journal.map((entry) => Object.freeze({ ...entry, command: Object.freeze({ ...entry.command, ...('objectIds' in entry.command ? { objectIds: Object.freeze([...entry.command.objectIds]) } : {}) }), response: Object.freeze({ ...entry.response }) }))),
  });
  TRUSTED_STATES.add(state);
  return state;
}

function genericIssue(code: OnlinePregameCommandRejectV1['issues'][number]['code'], path = ''): OnlinePregameCommandRejectV1['issues'][number] {
  return Object.freeze({ code, path });
}
function reject(state: unknown, code: OnlinePregameCommandRejectV1['issues'][number]['code'], path = '', commandId: string | null = null, resyncRequired = false, currentRevision = 0): OnlinePregameTransitionV1 {
  const response: OnlinePregameCommandRejectV1 = Object.freeze({ kind: 'online-pregame-command-reject-v1', schemaVersion: 1, commandId, currentRevision, resyncRequired, issues: Object.freeze([genericIssue(code, path)]) });
  return Object.freeze({ state: state as OnlinePregameStateV1, response });
}
function extractCommandId(input: unknown): string | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, 'commandId');
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
    return typeof descriptor.value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(descriptor.value) ? descriptor.value : null;
  } catch { return null; }
}
function acceptedResponse(commandId: string, revision: number, currentRevision: number, duplicate: boolean): OnlinePregameCommandAckV1 {
  return Object.freeze({ kind: 'online-pregame-command-ack-v1', schemaVersion: 1, commandId, acceptedRevision: revision, currentRevision, duplicate });
}
function playerIndex(state: OnlinePregameStateV1, playerId: CorePlayerId): number { return state.players.findIndex((player) => player.playerId === playerId); }
function playerAt(state: OnlinePregameStateV1, playerId: CorePlayerId): OnlinePregamePlayerV1 {
  const player = state.players[playerIndex(state, playerId)];
  if (player === undefined) throw new Error('Player is not seated');
  return player;
}
function roomSeat(state: OnlinePregameStateV1, participantId: string) {
  return state.protocolState.room.seats.find((seat) => seat.participantId === participantId);
}
function coreRoot(state: OnlinePregameStateV1) { return state.protocolState.coreRoot; }
function turnOrder(state: OnlinePregameStateV1): readonly CorePlayerId[] { return state.randomPlan.turnOrder; }
function nextActor(state: OnlinePregameStateV1, predicate: (player: OnlinePregamePlayerV1) => boolean): CorePlayerId | null {
  for (const playerId of turnOrder(state)) { const player = playerAt(state, playerId); if (predicate(player)) return playerId; }
  return null;
}
function withPlayer(state: OnlinePregameStateV1, playerId: CorePlayerId, patch: Partial<OnlinePregamePlayerV1>): readonly OnlinePregamePlayerV1[] {
  return Object.freeze(state.players.map((player) => player.playerId === playerId ? Object.freeze({ ...player, ...patch, pendingBottomObjectIds: patch.pendingBottomObjectIds ?? player.pendingBottomObjectIds }) : player));
}
function withPlayers(state: OnlinePregameStateV1, players: readonly OnlinePregamePlayerV1[]): OnlinePregameStateV1 {
  return freezeState({ ...state, players });
}
function planEntry(state: OnlinePregameStateV1, playerId: CorePlayerId) {
  const entry = state.randomPlan.libraryPlans.find((plan) => plan.playerId === playerId);
  if (entry === undefined) throw new Error('Library plan is missing');
  return entry;
}
function currentHand(state: OnlinePregameStateV1, playerId: CorePlayerId): readonly CoreObjectId[] {
  return coreRoot(state).ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[playerId].hand;
}
function protocolWithRoom(state: OnlinePregameStateV1, room: OnlineVariableProtocolStateV2['room']): OnlineVariableProtocolStateV2 {
  return Object.freeze({ ...state.protocolState, room, configuration: room.configuration, revision: 0, receipts: Object.freeze([]) });
}
function stateWithCore(state: OnlinePregameStateV1, root: OnlinePregameStateV1['protocolState']['coreRoot']): OnlinePregameStateV1 {
  return freezeState({ ...state, protocolState: Object.freeze({ ...state.protocolState, coreRoot: root, configuration: state.protocolState.room.configuration, revision: 0, receipts: Object.freeze([]) }) });
}
function requestDigest(envelope: OnlinePregameCommandEnvelopeV1): string {
  return coreSha256HexV1(JSON.stringify({ participantId: envelope.participantId, baseRevision: envelope.baseRevision, command: envelope.command }));
}
function commandEqual(left: OnlinePregameJournalEntryV1, envelope: OnlinePregameCommandEnvelopeV1, digest: string): boolean {
  return left.participantId === envelope.participantId && left.baseRevision === envelope.baseRevision && left.requestDigest === digest && JSON.stringify(left.command) === JSON.stringify(envelope.command);
}
function makeJournal(envelope: OnlinePregameCommandEnvelopeV1, digest: string, revision: number): OnlinePregameJournalEntryV1 {
  return Object.freeze({ command: envelope.command, participantId: envelope.participantId, baseRevision: envelope.baseRevision, commandId: envelope.commandId, requestDigest: digest, response: Object.freeze({ accepted: true, revision, duplicate: false }) });
}
function appendAccepted(state: OnlinePregameStateV1, envelope: OnlinePregameCommandEnvelopeV1, next: OnlinePregameStateV1, digest: string): OnlinePregameTransitionV1 {
  const revision = state.revision + 1;
  const journal = [...state.journal, makeJournal(envelope, digest, revision)];
  const updated = freezeState({ ...next, revision, journal });
  return Object.freeze({ state: updated, response: acceptedResponse(envelope.commandId, revision, revision, false) });
}

export function createOnlinePregameLifecycleV1(input: Readonly<{ readonly initialState: unknown; readonly randomPlan: unknown }>): OnlinePregameValidationResultV1<OnlinePregameStateV1> {
  let initialState: unknown;
  let randomPlan: unknown;
  try {
    const initialDescriptor = Object.getOwnPropertyDescriptor(input, 'initialState');
    const planDescriptor = Object.getOwnPropertyDescriptor(input, 'randomPlan');
    if (initialDescriptor === undefined || planDescriptor === undefined || !('value' in initialDescriptor) || !('value' in planDescriptor) || initialDescriptor.enumerable !== true || planDescriptor.enumerable !== true) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '', message: 'Pregame input descriptors are invalid' })] };
    initialState = initialDescriptor.value as unknown;
    randomPlan = planDescriptor.value as unknown;
  } catch { return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '', message: 'Pregame input descriptors are invalid' })] }; }
  const protocol = validateOnlineVariableProtocolStateV2(initialState);
  if (!protocol.ok || protocol.value.room.lifecycle !== 'active' || protocol.value.revision !== 0 || protocol.value.receipts.length !== 0 || protocol.value.configuration.startingLife !== 40) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '', message: 'Pregame requires a virgin active 40-life Protocol state' })] };
  const plan = validateOnlinePregameRandomPlanV1(randomPlan, protocol.value);
  if (!plan.ok) return plan;
  const root = protocol.value.coreRoot;
  const registry = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const turn = root.ruleAuthority.turnPriorityBundle;
  const stack = turn.stackBundle;
  const emptyRecord = (value: object): boolean => Object.keys(value).length === 0;
  const runtimeByObject = new Map(Object.entries(stack.objectRuntime.byObject));
  const virginRuntime = runtimeByObject.size === Object.keys(registry.objects).length && Object.entries(registry.objects).every(([objectId]) => {
    const runtimeState = runtimeByObject.get(objectId);
    return runtimeState !== undefined && runtimeState.orientation.faceIndex === 0 && runtimeState.orientation.faceDown === false && runtimeState.orientation.tapped === false && runtimeState.orientation.flipped === false && runtimeState.orientation.phasedOut === false && runtimeState.counterDamage.markedDamage === 0 && runtimeState.counterDamage.counters.length === 0 && runtimeState.attachment.attachedTo === null;
  });
  const virginAuthority = emptyRecord(root.ruleAuthority.control.byEffect) && root.ruleAuthority.control.effectOrder.length === 0 && emptyRecord(root.ruleAuthority.control.continuityByObject) && emptyRecord(root.ruleAuthority.visibility.byGrant) && root.ruleAuthority.visibility.grantOrder.length === 0 && emptyRecord(root.ruleAuthority.searchSessions.bySession) && root.ruleAuthority.searchSessions.sessionOrder.length === 0 && emptyRecord(root.ruleAuthority.playPermissions.byPermission) && root.ruleAuthority.playPermissions.permissionOrder.length === 0 && emptyRecord(root.ruleAuthority.decisionAuthorities.byAuthority) && root.ruleAuthority.decisionAuthorities.authorityOrder.length === 0;
  const virginStack = turn.pendingTriggers.pendingObjectIds.length === 0 && emptyRecord(turn.pendingTriggers.byObject) && emptyRecord(stack.stackAnnouncements.byObject);
  const virginCommanders = root.commanderCastLedgers.every((ledger) => ledger.castCount === 0) && root.commanderDamage.entries.length === 0 && root.commanderDamageProvenance.records.length === 0 && root.combatContext === null;
  const seatPlayers = protocol.value.room.seats.map((seat) => seat.corePlayerId);
  const expectedCommandObjects = root.commanders.map((commander) => `${commander.physicalCardId}:0` as CoreObjectId);
  const commandObjectsValid = registry.zones.shared.command.length === expectedCommandObjects.length
    && registry.zones.shared.command.every((objectId, index) => objectId === expectedCommandObjects[index] && registry.objects[objectId]?.kind === 'card' && registry.objects[objectId].physicalCardId === root.commanders[index]?.physicalCardId && registry.physicalCards[registry.objects[objectId].physicalCardId]?.isCommander === true);
  const playersVirgin = registry.turnOrder.length === seatPlayers.length
    && registry.turnOrder.every((playerId, index) => playerId === seatPlayers[index] && registry.players[playerId]?.life === 40 && registry.players[playerId]?.poison === 0 && registry.players[playerId]?.energy === 0 && registry.players[playerId]?.experience === 0 && registry.players[playerId]?.mulliganCount === 0 && registry.players[playerId]?.drawnThisTurn === 0 && registry.players[playerId]?.landsPlayedThisTurn === 0 && registry.players[playerId]?.spellsCastThisTurn === 0 && registry.players[playerId]?.maximumHandSizeOverride === 'none' && Object.values(registry.players[playerId]?.manaPool ?? {}).every((amount) => amount === 0) && registry.zones.byPlayer[playerId]?.library.length >= 7 && registry.zones.byPlayer[playerId]?.hand.length === 0 && registry.zones.byPlayer[playerId]?.graveyard.length === 0);
  const lifecycleVirgin = lifecycle.turnNumber === 1 && lifecycle.positionSequence === 0 && lifecycle.position.phase === 'beginning' && lifecycle.position.step === 'untap' && lifecycle.window.kind === 'turn-based-action-required' && lifecycle.window.action === 'untap-step-actions' && lifecycle.window.playerId === registry.activePlayerId;
  if (root.acceptedCommandCount !== 0 || registry.activePlayerId !== seatPlayers[0] || !lifecycleVirgin || !virginAuthority || !virginStack || !virginRuntime || !virginCommanders || root.playerLifecycle.players.some((player) => player.status !== 'active' || player.exitCause !== null) || registry.zones.shared.battlefield.length !== 0 || registry.zones.shared.stack.length !== 0 || registry.zones.shared.exile.length !== 0 || !commandObjectsValid || !playersVirgin) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '', message: 'Protocol state is not a virgin Pregame substrate' })] };
  try {
    const rotated = rotateCorePregameTurnOrderV1(root, plan.value.startingPlayerId);
    const startedRoom = Object.freeze({ ...protocol.value.room, lifecycle: 'started' as const });
    const startedProtocol = createOnlineVariableProtocolStateV2({ serverBuildId: protocol.value.serverBuildId, room: startedRoom, coreRoot: rotated, observerAuthorizations: protocol.value.observerAuthorizations });
    const players = registry.turnOrder.map((playerId) => Object.freeze({ playerId, commanderConfirmed: false, mulliganDecision: 'pending' as const, mulligansTaken: 0, bottomCountRequired: 0, pendingBottomObjectIds: Object.freeze([]), manualActionCount: 0, manualActionsComplete: false, ready: false }));
    return { ok: true, value: freezeState({ protocolState: startedProtocol, randomPlan: plan.value, phase: 'commander-reveal', currentPlayerId: plan.value.startingPlayerId, mulliganRound: 0, players: Object.freeze(players), revision: 0, journal: Object.freeze([]) }) };
  } catch { return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '', message: 'Unable to construct Pregame state' })] }; }
}

function dealOpening(state: OnlinePregameStateV1): OnlinePregameStateV1 {
  const orders = state.randomPlan.libraryPlans.map((entry) => ({ playerId: entry.playerId, order: entry.orders[0] as readonly never[] }));
  const result = dealCorePregameOpeningHandsV1(state.protocolState.coreRoot, orders);
  if (!result.ok) throw new Error('Opening deal failed');
  return stateWithCore(state, result.value);
}

function beginMulliganWave(state: OnlinePregameStateV1, mulliganers: readonly CorePlayerId[], round: number): OnlinePregameStateV1 {
  const inputs = mulliganers.map((playerId) => ({ playerId, order: planEntry(state, playerId).orders[round] as readonly never[] }));
  if (inputs.some((input) => input.order === undefined)) throw new Error('Mulligan plan exhausted');
  const result = applyCorePregameMulliganWaveV1(state.protocolState.coreRoot, inputs);
  if (!result.ok) throw new Error('Mulligan wave failed');
  let next = stateWithCore(state, result.value);
  const players = next.players.map((player) => {
    if (!mulliganers.includes(player.playerId)) return player;
    const count = next.protocolState.configuration.playerCount === 2 ? player.mulligansTaken : Math.max(0, player.mulligansTaken - 1);
    return Object.freeze({ ...player, bottomCountRequired: count, pendingBottomObjectIds: Object.freeze([]), mulliganDecision: count === 0 ? 'pending' as const : 'mulligan' as const });
  });
  next = freezeState({ ...next, mulliganRound: round, players });
  if (mulliganers.some((playerId) => playerAt(next, playerId).bottomCountRequired > 0)) {
    const currentPlayerId = nextActor(next, (player) => mulliganers.includes(player.playerId) && player.bottomCountRequired > 0);
    return freezeState({ ...next, phase: 'mulligan-bottom', currentPlayerId });
  }
  const currentPlayerId = nextActor(next, (player) => mulliganers.includes(player.playerId));
  if (currentPlayerId !== null) return freezeState({ ...next, phase: 'mulligan-declaration', currentPlayerId });
  return freezeState({ ...next, phase: 'pregame-actions', currentPlayerId: next.randomPlan.startingPlayerId });
}

function allDeclared(state: OnlinePregameStateV1): boolean { return state.players.every((player) => player.mulliganDecision !== 'pending'); }
function finishBottom(state: OnlinePregameStateV1): OnlinePregameStateV1 {
  const entries = state.players.filter((player) => player.bottomCountRequired > 0 && player.mulliganDecision === 'mulligan').map((player) => ({ playerId: player.playerId, objectIds: player.pendingBottomObjectIds }));
  const result = commitCorePregameBottomBatchV1(state.protocolState.coreRoot, entries);
  if (!result.ok) throw new Error('Bottom batch failed');
  const next = stateWithCore(state, result.value);
  const maxMulligans = next.protocolState.configuration.playerCount === 2 ? 7 : 8;
  const players = next.players.map((player) => player.mulliganDecision === 'mulligan'
    ? Object.freeze({ ...player, pendingBottomObjectIds: Object.freeze([]), mulliganDecision: player.mulligansTaken >= maxMulligans ? 'keep' as const : 'pending' as const })
    : player);
  const nextState = freezeState({ ...next, players });
  const actor = nextActor(nextState, (player) => player.mulliganDecision === 'pending');
  return actor === null ? freezeState({ ...nextState, phase: 'pregame-actions', currentPlayerId: nextState.randomPlan.startingPlayerId }) : freezeState({ ...nextState, phase: 'mulligan-declaration', currentPlayerId: actor });
}

function applyCommand(state: OnlinePregameStateV1, actorPlayerId: CorePlayerId, command: OnlinePregameCommandV1): OnlinePregameStateV1 {
  const actor = playerAt(state, actorPlayerId);
  if (command.kind === 'confirm-commanders') {
    if (state.phase !== 'commander-reveal' || state.currentPlayerId !== actorPlayerId || actor.commanderConfirmed) throw new Error('INVALID_PHASE');
    const next = withPlayers(state, withPlayer(state, actorPlayerId, { commanderConfirmed: true }));
    if (!next.players.every((player) => player.commanderConfirmed)) return nextActor(next, (player) => !player.commanderConfirmed) === null ? next : freezeState({ ...next, currentPlayerId: nextActor(next, (player) => !player.commanderConfirmed) });
    const dealt = dealOpening(next);
    return freezeState({ ...dealt, phase: 'mulligan-declaration', currentPlayerId: dealt.randomPlan.startingPlayerId });
  }
  if (command.kind === 'declare-mulligan') {
    if (state.phase !== 'mulligan-declaration' || state.currentPlayerId !== actorPlayerId || actor.mulliganDecision !== 'pending') throw new Error('INVALID_PHASE');
    if (command.decision === 'mulligan' && actor.mulligansTaken >= (state.protocolState.configuration.playerCount === 2 ? 7 : 8)) throw new Error('PLAN_EXHAUSTED');
    const taken = command.decision === 'mulligan' ? actor.mulligansTaken + 1 : actor.mulligansTaken;
    const next = withPlayers(state, withPlayer(state, actorPlayerId, { mulliganDecision: command.decision, mulligansTaken: taken }));
    if (!allDeclared(next)) return freezeState({ ...next, currentPlayerId: nextActor(next, (player) => player.mulliganDecision === 'pending') });
    const mulliganers = next.players.filter((player) => player.mulliganDecision === 'mulligan').map((player) => player.playerId);
    if (mulliganers.length === 0) return freezeState({ ...next, phase: 'pregame-actions', currentPlayerId: next.randomPlan.startingPlayerId });
    const round = next.mulliganRound + 1;
    return beginMulliganWave(next, mulliganers, round);
  }
  if (command.kind === 'submit-mulligan-bottom') {
    if (state.phase !== 'mulligan-bottom' || state.currentPlayerId !== actorPlayerId || actor.bottomCountRequired <= 0) throw new Error('INVALID_PHASE');
    if (command.objectIds.length > 7 || command.objectIds.length !== actor.bottomCountRequired || new Set(command.objectIds).size !== command.objectIds.length || command.objectIds.some((objectId) => !currentHand(state, actorPlayerId).includes(objectId))) throw new Error('INVALID_BOTTOM');
    const next = withPlayers(state, withPlayer(state, actorPlayerId, { pendingBottomObjectIds: Object.freeze([...command.objectIds]) }));
    const waiting = next.players.some((player) => player.bottomCountRequired > 0 && player.mulliganDecision === 'mulligan' && player.pendingBottomObjectIds.length !== player.bottomCountRequired);
    if (waiting) return freezeState({ ...next, currentPlayerId: nextActor(next, (player) => player.bottomCountRequired > 0 && player.mulliganDecision === 'mulligan' && player.pendingBottomObjectIds.length !== player.bottomCountRequired) });
    return finishBottom(next);
  }
  if (command.kind === 'record-manual-pregame-action') {
    if (state.phase !== 'pregame-actions' || state.currentPlayerId !== actorPlayerId || actor.manualActionsComplete || actor.manualActionCount >= 16) throw new Error('INVALID_PHASE');
    return withPlayers(state, withPlayer(state, actorPlayerId, { manualActionCount: actor.manualActionCount + 1 }));
  }
  if (command.kind === 'complete-pregame-actions') {
    if (state.phase !== 'pregame-actions' || state.currentPlayerId !== actorPlayerId || actor.manualActionsComplete) throw new Error('INVALID_PHASE');
    const next = withPlayers(state, withPlayer(state, actorPlayerId, { manualActionsComplete: true }));
    const nextPlayer = nextActor(next, (player) => !player.manualActionsComplete);
    return nextPlayer === null ? freezeState({ ...next, phase: 'ready', currentPlayerId: null }) : freezeState({ ...next, currentPlayerId: nextPlayer });
  }
  if (command.kind === 'set-ready') {
    if (state.phase !== 'ready' || !state.players.some((player) => player.playerId === actorPlayerId) || actor.ready === command.ready) throw new Error('INVALID_CHOICE');
    const next = withPlayers(state, withPlayer(state, actorPlayerId, { ready: command.ready }));
    if (!next.players.every((player) => player.ready)) return next;
    const room = activateOnlineVariableRoomV2(next.protocolState.room, next.protocolState.coreRoot);
    return freezeState({ ...next, phase: 'complete', currentPlayerId: null, protocolState: protocolWithRoom(next, room) });
  }
  throw new Error('INVALID_COMMAND');
}

export function handleOnlinePregameCommandEnvelopeV1(stateInput: unknown, envelopeInput: unknown): OnlinePregameTransitionV1 {
  const checkedState = TRUSTED_STATES.has(stateInput as object)
    ? { ok: true as const, value: stateInput as OnlinePregameStateV1 }
    : validateOnlinePregameStateV1(stateInput);
  if (!checkedState.ok) return reject(stateInput, 'INVALID_STATE');
  const state = checkedState.value;
  const rejectValid = (code: OnlinePregameCommandRejectV1['issues'][number]['code'], path = '', commandId: string | null = null, resyncRequired = false): OnlinePregameTransitionV1 => reject(state, code, path, commandId, resyncRequired, state.revision);
  const checked = validateOnlinePregameCommandEnvelopeV1(envelopeInput);
  if (!checked.ok) return rejectValid('INVALID_COMMAND', '', extractCommandId(envelopeInput));
  const envelope = checked.value;
  if (envelope.roomId !== state.protocolState.room.roomId) return rejectValid('ROOM_MISMATCH', '/roomId', envelope.commandId);
  const seat = roomSeat(state, envelope.participantId);
  if (seat === undefined || seat.participantId === null || seat.seatCapability !== envelope.participantCapability) return rejectValid('AUTHORIZATION_REJECTED', '', envelope.commandId);
  const participant = state.protocolState.room.participants.find((entry) => entry.participantId === envelope.participantId);
  if (participant?.presence !== 'connected') return rejectValid('PARTICIPANT_NOT_CONNECTED', '/participantId', envelope.commandId);
  const digest = requestDigest(envelope);
  const existing = state.journal.find((entry) => entry.commandId === envelope.commandId);
  if (existing !== undefined) {
    if (!commandEqual(existing, envelope, digest)) return rejectValid('COMMAND_ID_REUSE_MISMATCH', '', envelope.commandId);
    const response = acceptedResponse(envelope.commandId, existing.response.revision, state.revision, true);
    return Object.freeze({ state, response });
  }
  if (envelope.baseRevision !== state.revision) return rejectValid('STALE_REVISION', '/baseRevision', envelope.commandId, true);
  if (state.journal.length >= JOURNAL_LIMIT) return rejectValid('CAPACITY_EXCEEDED', '', envelope.commandId);
  const playerId = seat.corePlayerId;
  if (state.phase !== 'ready' && state.currentPlayerId !== playerId) return rejectValid('ACTOR_MISMATCH', '', envelope.commandId);
  try {
    const next = applyCommand(state, playerId, envelope.command);
    return appendAccepted(state, envelope, next, digest);
  } catch (error: unknown) {
    const text = error instanceof Error ? error.message : 'INVALID_STATE';
    const code = (['INVALID_PHASE', 'ACTOR_MISMATCH', 'INVALID_CHOICE', 'PLAN_EXHAUSTED', 'INVALID_BOTTOM'].includes(text) ? text : 'INVALID_COMMAND') as OnlinePregameCommandRejectV1['issues'][number]['code'];
    return rejectValid(code, '', envelope.commandId);
  }
}

export function replayOnlinePregameLifecycleV1(initialState: unknown, randomPlan: unknown, journal: readonly OnlinePregameJournalEntryV1[]): OnlinePregameValidationResultV1<OnlinePregameStateV1> {
  try {
    const rawJournal = denseJournal(journal);
    if (rawJournal === null) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '/journal', message: 'Journal must be a dense bounded array' })] };
    const normalizedJournal: OnlinePregameJournalEntryV1[] = [];
    const seenCommandIds = new Set<string>();
    for (let index = 0; index < rawJournal.length; index += 1) {
      const row = snapshotRecord(rawJournal[index], ['command', 'participantId', 'baseRevision', 'commandId', 'requestDigest', 'response']);
      const response = row === null ? null : snapshotRecord(row.response, ['accepted', 'revision', 'duplicate']);
      const command = row === null ? null : validateOnlinePregameCommandV1(row.command);
      if (row === null || response === null || command === null || !command.ok || typeof row.participantId !== 'string' || typeof row.commandId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(row.commandId) || seenCommandIds.has(row.commandId) || typeof row.baseRevision !== 'number' || !Number.isSafeInteger(row.baseRevision) || typeof row.requestDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(row.requestDigest) || response.accepted !== true || response.duplicate !== false || typeof response.revision !== 'number' || !Number.isSafeInteger(response.revision)) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: `/journal/${index}`, message: 'Journal entry descriptor or response is invalid' })] };
      seenCommandIds.add(row.commandId);
      normalizedJournal.push(Object.freeze({ command: command.value, participantId: row.participantId, baseRevision: row.baseRevision, commandId: row.commandId, requestDigest: row.requestDigest, response: Object.freeze({ accepted: true, revision: response.revision, duplicate: false }) }));
    }
    const created = createOnlinePregameLifecycleV1({ initialState, randomPlan });
    if (!created.ok) return created;
    let state = created.value;
    for (const entry of normalizedJournal) {
      const seat = state.protocolState.room.seats.find((candidate) => candidate.participantId === entry.participantId);
      if (seat === undefined || seat.participantId === null) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '/journal', message: 'Journal participant is not seated' })] };
      const transition = handleOnlinePregameCommandEnvelopeV1(state, { kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: state.protocolState.room.roomId, participantId: entry.participantId, participantCapability: seat.seatCapability, commandId: entry.commandId, baseRevision: entry.baseRevision, command: entry.command });
      const digest = requestDigest({ kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: state.protocolState.room.roomId, participantId: entry.participantId, participantCapability: seat.seatCapability, commandId: entry.commandId, baseRevision: entry.baseRevision, command: entry.command });
      if (entry.baseRevision !== state.revision || entry.requestDigest !== digest || entry.response.accepted !== true || entry.response.duplicate !== false || entry.response.revision !== state.revision + 1 || transition.response.kind !== 'online-pregame-command-ack-v1' || transition.response.acceptedRevision !== entry.response.revision) return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '/journal', message: 'Journal replay rejected an accepted entry' })] };
      state = transition.state;
    }
    return { ok: true, value: state };
  } catch { return { ok: false, issues: [Object.freeze({ code: 'INVALID_STATE', path: '/journal', message: 'Journal replay could not be inspected safely' })] }; }
}

export { validateOnlinePregameCommandEnvelopeV1, validateOnlinePregameCommandV1, validateOnlinePregameRandomPlanV1, validateOnlinePregameStateV1 } from './validation';
