import {
  applyCoreCommandV1,
  coreCanonicalDigestFromValueV1,
  coreUndoAuthorizedPlayerV1,
  createModeNeutralCoreRootV1,
  type CoreDomainEventV1,
  type CoreCommandV1,
} from '../../engine/core/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { validateOnlineVariableRoomV2 } from '../room/variable';
import {
  inspectGraphForConfiguredCapability,
  protocolIssue,
} from './support';
import type {
  OnlineCommandAckV1,
  OnlineCommandEnvelopeV1,
  OnlineCommandRejectV1,
  OnlineProtocolIssueCodeV1,
} from './types';
import { validateOnlineCommandEnvelopeV1 } from './validation';
import {
  validateOnlineVariableProtocolStateV2,
  validateOnlineManualCombatDamageIntentV1,
  validateOnlineSharedUndoIntentV1,
  type OnlineVariableProtocolCompletionResultV2,
  type OnlineSharedCheckpointV1,
  type OnlineSharedUndoIntentV1,
  type OnlineManualCombatDamageIntentV1,
  type OnlineVariableProtocolStateV2,
} from './variable';

export type OnlineVariableCommandTransitionV2 = Readonly<{
  readonly state: OnlineVariableProtocolStateV2;
  readonly response: OnlineCommandAckV1 | OnlineCommandRejectV1;
}>;

function requestDigest(message: OnlineCommandEnvelopeV1): string {
  return coreCanonicalDigestFromValueV1({
    kind: message.kind,
    protocolVersion: message.protocolVersion,
    roomId: message.roomId,
    participantId: message.participantId,
    commandId: message.commandId,
    baseRevision: message.baseRevision,
    command: message.command,
  });
}

function requiresTrustedTabletopBinder(command: OnlineCommandEnvelopeV1['command']): boolean {
  const kind = command.payload.kind;
  return kind === 'stack-remove-object'
    || kind === 'table-turn-progress'
    || kind === 'table-manual-resolve'
    || kind === 'manual-combat-damage';
}

function reject(
  state: OnlineVariableProtocolStateV2,
  code: OnlineProtocolIssueCodeV1,
  message: string,
  envelope: OnlineCommandEnvelopeV1 | null = null,
  resyncRequired = false,
): OnlineVariableCommandTransitionV2 {
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: envelope?.roomId ?? null,
    participantId: envelope?.participantId ?? null,
    commandId: envelope?.commandId ?? null,
    baseRevision: envelope?.baseRevision ?? null,
    currentRevision: state.revision,
    duplicate: false,
    resyncRequired,
    issues: Object.freeze([protocolIssue(code, '', message)]),
  });
  return Object.freeze({ state, response });
}

function outcome(status: string, exitCause: string | null): 'pending' | 'conceded' | 'defeated' {
  if (status === 'active') return 'pending';
  return exitCause === 'concession' ? 'conceded' : 'defeated';
}

function sharedMutation(payload: OnlineCommandEnvelopeV1['command']['payload']): boolean {
  // Keep the checkpoint boundary at accepted game mutations.  Projection,
  // search, and visibility bookkeeping do not alter the shared tabletop fact
  // and therefore invalidate an earlier checkpoint rather than replacing it.
  return ![
    'search-open', 'search-complete', 'visibility-open', 'visibility-close',
    'table-note-set', 'table-note-clear', 'table-priority-hold',
  ].includes(payload.kind);
}

function checkpointFor(
  state: OnlineVariableProtocolStateV2,
  actorPlayerId: import('../../engine/core/index').CorePlayerId,
  payload: OnlineCommandEnvelopeV1['command']['payload'],
): OnlineSharedCheckpointV1 {
  const stewardPlayerId = coreUndoAuthorizedPlayerV1(state.coreRoot) ?? actorPlayerId;
  const payloadKind = payload.kind as string;
  // A rollback that crosses a hidden-zone or randomization boundary must be
  // surfaced as potentially exposing information. Search/visibility commands
  // intentionally clear the checkpoint altogether in sharedMutation().
  const hiddenBoundary = payloadKind === 'table-draw'
    || payloadKind === 'table-shuffle'
    || payloadKind === 'random-zone-order'
    || payloadKind === 'table-reorder'
    || payloadKind === 'table-zone-move';
  return Object.freeze({
    kind: 'online-shared-checkpoint-v1',
    revision: state.revision,
    coreRoot: state.coreRoot,
    seatOutcomes: Object.freeze(state.room.seats.map((seat) => seat.outcome)),
    stewardPlayerId,
    informationExposureWarning: hiddenBoundary || state.coreRoot.ruleAuthority.visibility.grantOrder.length > 0,
  });
}

function sharedUndoIntent(value: unknown): OnlineSharedUndoIntentV1 | null {
  const checked = validateOnlineSharedUndoIntentV1(value);
  return checked.ok ? checked.value : null;
}

function undoReject(
  state: OnlineVariableProtocolStateV2,
  intent: OnlineSharedUndoIntentV1 | null,
  code: OnlineProtocolIssueCodeV1,
  message: string,
  resyncRequired = false,
): OnlineVariableCommandTransitionV2 {
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: intent === null ? null : intent.roomId as OnlineCommandRejectV1['roomId'],
    participantId: intent === null ? null : intent.participantId as OnlineCommandRejectV1['participantId'],
    commandId: intent === null ? null : intent.commandId as OnlineCommandRejectV1['commandId'],
    baseRevision: intent?.baseRevision ?? null,
    currentRevision: state.revision,
    duplicate: false,
    resyncRequired,
    issues: Object.freeze([protocolIssue(code, '', message)]),
  });
  return Object.freeze({ state, response });
}

/** Apply the one server-owned shared rollback point without introducing an
 * undo-shaped Core command or accepting a client-provided snapshot. */
export function handleOnlineVariableSharedUndoIntentV2(
  stateInput: unknown,
  intentInput: unknown,
  trustedServerBinder = false,
): OnlineVariableCommandTransitionV2 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) throw new Error('Invalid variable protocol state');
  const state = checked.value;
  const intent = sharedUndoIntent(intentInput);
  if (intent === null) return undoReject(state, null, 'INVALID_PROTOCOL_STATE', 'Invalid shared undo intent');
  if (!trustedServerBinder) return undoReject(state, intent, 'AUTHORIZATION_REJECTED', 'Shared undo requires the server binder');
  if (intent.protocolVersion !== state.protocolVersion || intent.roomId !== state.room.roomId) return undoReject(state, intent, 'PROTOCOL_VERSION_MISMATCH', 'Shared undo protocol context mismatch');
  const configuredCapabilities = [
    ...state.room.seats.map((entry) => entry.seatCapability),
    ...state.observerAuthorizations.map((entry) => entry.observerCapability),
  ];
  for (const identity of [intent.roomId, intent.participantId, intent.commandId]) {
    if (inspectGraphForConfiguredCapability(identity, configuredCapabilities) !== 'clear') return undoReject(state, intent, 'INVALID_CAPABILITY', 'Shared undo identity contains configured capability data');
  }
  const participant = state.room.participants.find((entry) => entry.participantId === intent.participantId);
  const seat = participant === undefined || participant.role !== 'player' || participant.seatIndex === null ? undefined : state.room.seats[participant.seatIndex];
  if (seat === undefined || seat.seatCapability !== intent.participantCapability) return undoReject(state, intent, 'AUTHORIZATION_REJECTED', 'Shared undo participant authorization failed');
  const existing = state.receipts.find((receipt) => receipt.participantId === intent.participantId && receipt.commandId === intent.commandId);
  if (existing !== undefined) {
    if (existing.requestDigest !== coreCanonicalDigestFromValueV1(intent)) return undoReject(state, intent, 'COMMAND_ID_REUSE_MISMATCH', 'Command ID reuse mismatch');
    return Object.freeze({ state, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: intent.roomId as OnlineCommandAckV1['roomId'], participantId: intent.participantId as OnlineCommandAckV1['participantId'], commandId: intent.commandId as OnlineCommandAckV1['commandId'], baseRevision: existing.acceptedRevision - 1, acceptedRevision: existing.acceptedRevision, currentRevision: state.revision, status: existing.status, duplicate: true }) });
  }
  // A lethal player-exit can finish the room immediately after a shared
  // mutation. Permit one rollback from that terminal state only when the
  // checkpoint restores a genuinely active room and the requester is the
  // surviving/current steward; all other finished states remain closed.
  if ((state.room.lifecycle !== 'active' && state.room.lifecycle !== 'finished') || seat.outcome !== 'pending') return undoReject(state, intent, 'ROOM_NOT_ACTIVE', 'Shared undo requires an active player');
  if (intent.baseRevision !== state.revision) return undoReject(state, intent, 'STALE_REVISION', 'Shared undo revision is stale', true);
  const checkpoint = state.sharedCheckpoint;
  if (checkpoint === undefined || checkpoint === null || checkpoint.revision !== state.revision - 1) return undoReject(state, intent, 'AUTHORIZATION_REJECTED', 'No current shared checkpoint is available');
  if ((state.coreRoot.tabletopManual?.priorityHolds ?? []).length > 0) return undoReject(state, intent, 'AUTHORIZATION_REJECTED', 'Shared undo is blocked while a priority HOLD is active');
  if (checkpoint.stewardPlayerId !== seat.corePlayerId || coreUndoAuthorizedPlayerV1(state.coreRoot) !== seat.corePlayerId) return undoReject(state, intent, 'AUTHORIZATION_REJECTED', 'Only the current shared steward may undo');
  const nextRevision = state.revision + 1;
  const restoredCore = createModeNeutralCoreRootV1({ ...checkpoint.coreRoot, acceptedCommandCount: nextRevision });
  const restoredPlayers = restoredCore.playerLifecycle.players;
  const restoredSeats = state.room.seats.map((current, index) => Object.freeze({ ...current, outcome: checkpoint.seatOutcomes[index] ?? current.outcome }));
  const activeCount = restoredPlayers.filter((player) => player.status === 'active').length;
  if (state.room.lifecycle === 'finished' && activeCount <= 1) return undoReject(state, intent, 'ROOM_NOT_ACTIVE', 'Terminal shared undo did not restore an active room');
  const roomResult = validateOnlineVariableRoomV2({ ...state.room, seats: restoredSeats, lifecycle: activeCount <= 1 ? 'finished' : 'active' });
  if (!roomResult.ok) return undoReject(state, intent, 'CORE_RECONCILIATION_REJECTED', 'Shared undo room reconciliation failed');
  const requestDigest = coreCanonicalDigestFromValueV1(intent);
  const receipt = Object.freeze({ participantId: intent.participantId, commandId: intent.commandId, requestDigest, acceptedRevision: nextRevision, status: 'accepted' as const });
  const nextCandidate = { ...state, room: roomResult.value, coreRoot: restoredCore, revision: nextRevision, sharedCheckpoint: null, receipts: [...state.receipts, receipt] };
  const nextResult = validateOnlineVariableProtocolStateV2(nextCandidate);
  if (!nextResult.ok) return undoReject(state, intent, 'CORE_RECONCILIATION_REJECTED', 'Shared undo state validation failed');
  const nextState = nextResult.value;
  return Object.freeze({ state: nextState, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: intent.roomId as OnlineCommandAckV1['roomId'], participantId: intent.participantId as OnlineCommandAckV1['participantId'], commandId: intent.commandId as OnlineCommandAckV1['commandId'], baseRevision: intent.baseRevision, acceptedRevision: nextRevision, currentRevision: nextRevision, status: 'accepted' as const, duplicate: false }) });
}

function manualDamageIntent(value: unknown): OnlineManualCombatDamageIntentV1 | null {
  const checked = validateOnlineManualCombatDamageIntentV1(value);
  return checked.ok ? checked.value : null;
}

function manualDamageReject(
  state: OnlineVariableProtocolStateV2,
  intent: OnlineManualCombatDamageIntentV1 | null,
  code: OnlineProtocolIssueCodeV1,
  message: string,
  resyncRequired = false,
): OnlineVariableCommandTransitionV2 {
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: intent === null ? null : intent.roomId as OnlineCommandRejectV1['roomId'],
    participantId: intent === null ? null : intent.participantId as OnlineCommandRejectV1['participantId'],
    commandId: intent === null ? null : intent.commandId as OnlineCommandRejectV1['commandId'],
    baseRevision: intent?.baseRevision ?? null,
    currentRevision: state.revision,
    duplicate: false,
    resyncRequired,
    issues: Object.freeze([protocolIssue(code, '', message)]),
  });
  return Object.freeze({ state, response });
}

/** Bind and apply one server-owned damage fact.  The public intent contains
 * only a projected combat object; its physical card identity is looked up from
 * the authoritative Core registry before constructing the single Core command. */
export function handleOnlineVariableManualCombatDamageIntentV2(
  stateInput: unknown,
  intentInput: unknown,
  trustedServerBinder = false,
): OnlineVariableCommandTransitionV2 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) throw new Error('Invalid variable protocol state');
  const state = checked.value;
  const intent = manualDamageIntent(intentInput);
  if (intent === null) return manualDamageReject(state, null, 'INVALID_PROTOCOL_STATE', 'Invalid manual combat damage intent');
  if (!trustedServerBinder) return manualDamageReject(state, intent, 'AUTHORIZATION_REJECTED', 'Manual combat damage requires the server binder');
  if (intent.protocolVersion !== state.protocolVersion || intent.roomId !== state.room.roomId) return manualDamageReject(state, intent, 'PROTOCOL_VERSION_MISMATCH', 'Manual combat damage protocol context mismatch');
  const configuredCapabilities = [
    ...state.room.seats.map((entry) => entry.seatCapability),
    ...state.observerAuthorizations.map((entry) => entry.observerCapability),
  ];
  for (const identity of [intent.roomId, intent.participantId, intent.commandId]) {
    if (inspectGraphForConfiguredCapability(identity, configuredCapabilities) !== 'clear') return manualDamageReject(state, intent, 'INVALID_CAPABILITY', 'Manual combat damage identity contains configured capability data');
  }
  const participant = state.room.participants.find((entry) => entry.participantId === intent.participantId);
  const seat = participant === undefined || participant.role !== 'player' || participant.seatIndex === null ? undefined : state.room.seats[participant.seatIndex];
  if (seat === undefined || seat.seatCapability !== intent.participantCapability) return manualDamageReject(state, intent, 'AUTHORIZATION_REJECTED', 'Manual combat damage participant authorization failed');
  const existing = state.receipts.find((receipt) => receipt.participantId === intent.participantId && receipt.commandId === intent.commandId);
  const digest = coreCanonicalDigestFromValueV1(intent);
  if (existing !== undefined) {
    if (existing.requestDigest !== digest) return manualDamageReject(state, intent, 'COMMAND_ID_REUSE_MISMATCH', 'Command ID reuse mismatch');
    return Object.freeze({ state, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: intent.roomId as OnlineCommandAckV1['roomId'], participantId: intent.participantId as OnlineCommandAckV1['participantId'], commandId: intent.commandId as OnlineCommandAckV1['commandId'], baseRevision: existing.acceptedRevision - 1, acceptedRevision: existing.acceptedRevision, currentRevision: state.revision, status: existing.status, duplicate: true }) });
  }
  if (state.room.lifecycle !== 'active' || seat.outcome !== 'pending') return manualDamageReject(state, intent, 'ROOM_NOT_ACTIVE', 'Manual combat damage requires an active room/player');
  if (intent.baseRevision !== state.revision) return manualDamageReject(state, intent, 'STALE_REVISION', 'Manual combat damage revision is stale', true);
  if ((state.coreRoot.tabletopManual?.priorityHolds ?? []).length > 0) return manualDamageReject(state, intent, 'AUTHORIZATION_REJECTED', 'Manual combat damage is blocked while a priority HOLD is active');
  if (coreUndoAuthorizedPlayerV1(state.coreRoot) !== seat.corePlayerId) return manualDamageReject(state, intent, 'AUTHORIZATION_REJECTED', 'Only the current shared steward may record combat damage');
  const attacks = state.coreRoot.combatContext?.attacks ?? [];
  if (!attacks.some((attack) => attack.defendingPlayerId === intent.defendingPlayerId && (intent.commanderObjectId === null || attack.attackerObjectId === intent.commanderObjectId))) return manualDamageReject(state, intent, 'CORE_COMMAND_REJECTED', 'Damage must correspond to an active combat attack');
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  let commanderPhysicalCardId: import('../../engine/core/index').CorePhysicalCardId | null = null;
  if (intent.commanderObjectId !== null) {
    const publicZones = registry.zones.shared;
    if (!publicZones.battlefield.includes(intent.commanderObjectId) && !publicZones.stack.includes(intent.commanderObjectId) && !publicZones.command.includes(intent.commanderObjectId)) return manualDamageReject(state, intent, 'CORE_COMMAND_REJECTED', 'Commander combat object is not in a public zone');
    const object = registry.objects[intent.commanderObjectId];
    if (object?.kind !== 'card') return manualDamageReject(state, intent, 'CORE_COMMAND_REJECTED', 'Commander combat object is not a public card object');
    commanderPhysicalCardId = object.physicalCardId;
    if (!state.coreRoot.commanders.some((commander) => commander.physicalCardId === commanderPhysicalCardId)) return manualDamageReject(state, intent, 'CORE_COMMAND_REJECTED', 'Commander combat object is not a registered Commander');
  }
  const command = Object.freeze({
    kind: 'mode-neutral-core-command-v1' as const,
    schemaVersion: 1 as const,
    sequence: state.coreRoot.acceptedCommandCount + 1,
    actorPlayerId: intent.defendingPlayerId,
    decisionMakerPlayerId: intent.defendingPlayerId,
    decisionContext: Object.freeze({ kind: 'decision' as const, decisionKey: 'manual-damage' }),
    payload: Object.freeze({ kind: 'manual-combat-damage' as const, defendingPlayerId: intent.defendingPlayerId, damage: intent.damage, commanderPhysicalCardId, combatObjectId: intent.commanderObjectId }),
  }) as CoreCommandV1;
  const coreResult = applyCoreCommandV1(state.coreRoot, command);
  if (coreResult.status === 'rejected') return manualDamageReject(state, intent, 'CORE_COMMAND_REJECTED', 'Core rejected the manual combat damage fact');
  const lifecycle = coreResult.root.playerLifecycle.players;
  const seats = state.room.seats.map((entry) => {
    const player = lifecycle.find((candidate) => candidate.playerId === entry.corePlayerId);
    if (player === undefined) throw new Error('Variable Core roster mismatch');
    return Object.freeze({ ...entry, outcome: outcome(player.status, player.exitCause) });
  });
  const activeCount = lifecycle.filter((entry) => entry.status === 'active').length;
  const roomResult = validateOnlineVariableRoomV2({ ...state.room, seats, lifecycle: activeCount <= 1 ? 'finished' : 'active' });
  if (!roomResult.ok) return manualDamageReject(state, intent, 'CORE_RECONCILIATION_REJECTED', 'Manual combat damage room reconciliation failed');
  const checkpoint = checkpointFor(state, intent.defendingPlayerId, command.payload);
  const nextCandidate = { ...state, room: roomResult.value, coreRoot: coreResult.root, revision: coreResult.root.acceptedCommandCount, sharedCheckpoint: checkpoint, receipts: [...state.receipts, Object.freeze({ participantId: intent.participantId, commandId: intent.commandId, requestDigest: digest, acceptedRevision: coreResult.root.acceptedCommandCount, status: coreResult.status })] };
  const nextResult = validateOnlineVariableProtocolStateV2(nextCandidate);
  if (!nextResult.ok) return manualDamageReject(state, intent, 'CORE_RECONCILIATION_REJECTED', 'Manual combat damage protocol reconciliation failed');
  const nextState = nextResult.value;
  return Object.freeze({ state: nextState, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: intent.roomId as OnlineCommandAckV1['roomId'], participantId: intent.participantId as OnlineCommandAckV1['participantId'], commandId: intent.commandId as OnlineCommandAckV1['commandId'], baseRevision: intent.baseRevision, acceptedRevision: nextState.revision, currentRevision: nextState.revision, status: coreResult.status, duplicate: false }) });
}

/** Extract the accepted Core completion from its typed event and the
 * authoritative pre-completion session.  The latter supplies revealFound
 * even for older event producers and ensures a forged client payload cannot
 * widen the private result. */
function completionForAcceptedSearch(
  state: OnlineVariableProtocolStateV2,
  command: OnlineCommandEnvelopeV1['command'],
  events: readonly CoreDomainEventV1[],
): OnlineVariableProtocolCompletionResultV2 | undefined {
  if (command.payload.kind !== 'search-complete') return undefined;
  const sessionKey = command.payload.sessionKey;
  const session = state.coreRoot.ruleAuthority.searchSessions.bySession[sessionKey];
  if (session === undefined) return undefined;
  const event = events.find((entry) => entry.payload.kind === 'search-session-changed' && entry.payload.operation === 'complete' && entry.payload.sessionKey === sessionKey);
  if (event === undefined || event.payload.kind !== 'search-session-changed' || event.payload.operation !== 'complete') return undefined;
  const selectedObjectIds = event.payload.completionResult?.selectedObjectIds ?? event.payload.selectedObjectIds ?? [];
  const selectedCount = selectedObjectIds.length;
  return Object.freeze({ kind: 'core-search-completion-result-v1', sessionKey, selectedObjectIds: Object.freeze(selectedObjectIds.slice()), selectedCount, revealFound: session.revealFound });
}

export function handleOnlineVariableCommandEnvelopeV2(
  stateInput: unknown,
  messageInput: unknown,
  trustedTabletopBinder = false,
): OnlineVariableCommandTransitionV2 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) throw new Error('Invalid variable protocol state');
  const state = checked.value;
  const messageResult = validateOnlineCommandEnvelopeV1(messageInput);
  if (!messageResult.ok) return reject(state, 'INVALID_PROTOCOL_STATE', 'Invalid command envelope');
  const message = messageResult.value;
  if (message.roomId !== state.room.roomId) return reject(state, 'ROOM_MISMATCH', 'Room mismatch', message);
  const participant = state.room.participants.find((entry) => entry.participantId === message.participantId);
  const seat = participant === undefined || participant.role !== 'player' || participant.seatIndex === null
    ? undefined
    : state.room.seats[participant.seatIndex];
  if (seat === undefined || seat.seatCapability !== message.participantCapability) return reject(state, 'AUTHORIZATION_REJECTED', 'Authorization rejected', message);
  const capabilities = [...state.room.seats.map((entry) => entry.seatCapability), ...state.observerAuthorizations.map((entry) => entry.observerCapability)];
  const inspection = inspectGraphForConfiguredCapability(message.command, capabilities);
  if (inspection !== 'clear') return reject(state, inspection === 'contains-configured-capability' ? 'INVALID_CAPABILITY' : 'INVALID_DESCRIPTOR', 'Command contains invalid protocol data', message);
  const digest = requestDigest(message);
  const existing = state.receipts.find((entry) => entry.participantId === message.participantId && entry.commandId === message.commandId);
  if (existing !== undefined) {
    if (existing.requestDigest !== digest) return reject(state, 'COMMAND_ID_REUSE_MISMATCH', 'Command ID reuse mismatch', message);
    return Object.freeze({ state, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: message.roomId, participantId: message.participantId, commandId: message.commandId, baseRevision: existing.acceptedRevision - 1, acceptedRevision: existing.acceptedRevision, currentRevision: state.revision, status: existing.status, duplicate: true }) });
  }
  if (state.room.lifecycle !== 'active') return reject(state, 'ROOM_NOT_ACTIVE', 'Room is not active', message);
  if (seat.outcome !== 'pending') return reject(state, 'PLAYER_NOT_PENDING', 'Player is not pending', message);
  const delegatedSearch = message.command.payload.kind === 'search-complete'
    ? state.coreRoot.ruleAuthority.searchSessions.bySession[message.command.payload.sessionKey]
    : undefined;
  if (delegatedSearch === undefined && message.command.actorPlayerId !== seat.corePlayerId) return reject(state, 'ACTOR_MISMATCH', 'Actor does not match seat', message);
  if (delegatedSearch !== undefined && (delegatedSearch.selectorPlayerId !== seat.corePlayerId || delegatedSearch.rulesActorPlayerId !== message.command.actorPlayerId || message.command.decisionMakerPlayerId !== seat.corePlayerId)) return reject(state, 'ACTOR_MISMATCH', 'Delegated search authority does not match seat', message);
  if (message.command.sequence !== message.baseRevision + 1) return reject(state, 'COMMAND_SEQUENCE_MISMATCH', 'Command sequence mismatch', message);
  if (message.baseRevision !== state.revision) return reject(state, 'STALE_REVISION', 'Stale revision', message, true);
  if (!trustedTabletopBinder && requiresTrustedTabletopBinder(message.command)) return reject(state, 'AUTHORIZATION_REJECTED', 'Steward-owned tabletop commands require the server tabletop binder', message);
  const coreResult = applyCoreCommandV1(state.coreRoot, message.command);
  if (coreResult.status === 'rejected') return reject(state, 'CORE_COMMAND_REJECTED', 'Core command rejected', message);
  const lifecycle = coreResult.root.playerLifecycle.players;
  const seats = state.room.seats.map((entry) => {
    const player = lifecycle.find((candidate) => candidate.playerId === entry.corePlayerId);
    if (player === undefined) throw new Error('Variable Core roster mismatch');
    return Object.freeze({ ...entry, outcome: outcome(player.status, player.exitCause) });
  });
  const activeCount = lifecycle.filter((entry) => entry.status === 'active').length;
  const roomResult = validateOnlineVariableRoomV2({ ...state.room, seats, lifecycle: activeCount <= 1 ? 'finished' : 'active' });
  if (!roomResult.ok) return reject(state, 'CORE_RECONCILIATION_REJECTED', 'Core reconciliation rejected', message);
  const completion = completionForAcceptedSearch(state, message.command, coreResult.events);
  const checkpoint = sharedMutation(message.command.payload)
    ? checkpointFor(state, message.command.actorPlayerId, message.command.payload)
    : null;
  const nextCandidate = {
    ...state,
    room: roomResult.value,
    coreRoot: coreResult.root,
    revision: coreResult.root.acceptedCommandCount,
    sharedCheckpoint: checkpoint,
    receipts: [...state.receipts, Object.freeze({
      participantId: message.participantId,
      commandId: message.commandId,
      requestDigest: digest,
      acceptedRevision: coreResult.root.acceptedCommandCount,
      status: coreResult.status,
      ...(completion === undefined ? {} : { completion }),
    })],
  };
  const nextResult = validateOnlineVariableProtocolStateV2(nextCandidate);
  if (!nextResult.ok) return reject(state, 'CORE_RECONCILIATION_REJECTED', 'Protocol reconciliation rejected', message);
  const nextState = nextResult.value;
  return Object.freeze({ state: nextState, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: message.roomId, participantId: message.participantId, commandId: message.commandId, baseRevision: message.baseRevision, acceptedRevision: nextState.revision, currentRevision: nextState.revision, status: coreResult.status, duplicate: false }) });
}
