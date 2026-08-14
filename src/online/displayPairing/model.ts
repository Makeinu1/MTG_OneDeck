import {
  createCoreCommandV1,
  isCoreBaseId,
  type CoreCommandPayloadV1,
  type CorePlayerId,
} from '../../engine/core/index';
import {
  validateOnlineCommandEnvelopeV1,
  validateOnlineClientHelloV1,
  type OnlineClientHelloV1,
} from '../protocol/index';
import {
  validateOnlineParticipantProjectionV1,
  validateOnlineProjectionRequestV1,
  type OnlineParticipantProjectionV1,
} from '../projection/index';
import {
  buildPersonalWorkbenchViewV1,
  type PersonalWorkbenchViewV1,
} from '../workbench/index';
import {
  buildTableDisplayViewV1,
  type TableDisplayPlayerSummaryV1,
  type TableDisplayViewV1,
} from '../tableDisplay/index';
import {
  OnlineDisplayPairingErrorV1,
  PersonalWorkbenchActionBindingErrorV1,
} from './errors';
import {
  ONLINE_DISPLAY_PAIRING_SCHEMA_VERSION_V1,
  type OnlineDisplayPairingInputV1,
  type OnlineDisplayPairingOpponentV1,
  type OnlineDisplayPairingProtocolFrameV1,
  type OnlineDisplayPairingViewV1,
  type OnlineOpponentFocusActionV1,
} from './types';

type SafeRecord = Record<string, unknown>;

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function unavailable(): never {
  throw new OnlineDisplayPairingErrorV1();
}

function bindingUnavailable(): never {
  throw new PersonalWorkbenchActionBindingErrorV1();
}

function readExactRecord(
  input: unknown,
  fields: readonly string[],
): SafeRecord | null {
  if (input === null || typeof input !== 'object') return null;
  try {
    if (Array.isArray(input)) return null;
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    const allowed = new Set(fields);
    const record = Object.create(null) as SafeRecord;
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
        return null;
      }
      record[key] = descriptor.value;
    }
    if (keys.length !== fields.length || fields.some((field) => !Object.prototype.hasOwnProperty.call(record, field))) return null;
    return record;
  } catch {
    return null;
  }
}

function readField(input: unknown, field: string): Readonly<{ readonly found: boolean; readonly value: unknown }> | null {
  if (input === null || typeof input !== 'object') return null;
  try {
    if (Array.isArray(input)) return null;
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (!Object.prototype.hasOwnProperty.call(input, field)) return { found: false, value: undefined };
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
    return { found: true, value: descriptor.value };
  } catch {
    return null;
  }
}

function structuralEqual(left: unknown, right: unknown): boolean {
  const pairs = new WeakMap<object, object>();
  const equal = (leftValue: unknown, rightValue: unknown): boolean => {
    if (Object.is(leftValue, rightValue)) return true;
    if (
      leftValue === null ||
      rightValue === null ||
      typeof leftValue !== 'object' ||
      typeof rightValue !== 'object'
    ) return false;
    if (pairs.get(leftValue) === rightValue) return true;
    pairs.set(leftValue, rightValue);
    try {
      const leftArray = Array.isArray(leftValue);
      const rightArray = Array.isArray(rightValue);
      if (leftArray !== rightArray) return false;
      const leftKeys = Object.keys(leftValue).sort();
      const rightKeys = Object.keys(rightValue).sort();
      if (
        leftKeys.length !== rightKeys.length ||
        leftKeys.some((key, index) => key !== rightKeys[index])
      ) return false;
      if (leftArray && (leftValue as readonly unknown[]).length !== (rightValue as readonly unknown[]).length) return false;
      for (const key of leftKeys) {
        if (!equal((leftValue as SafeRecord)[key], (rightValue as SafeRecord)[key])) return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      pairs.delete(leftValue);
    }
  };
  return equal(left, right);
}

function equalPublicZones(left: OnlineParticipantProjectionV1, right: OnlineParticipantProjectionV1): boolean {
  const zones = ['battlefield', 'stack', 'exile', 'command'] as const;
  return zones.every((zone) => structuralEqual(left.game.zones[zone], right.game.zones[zone]));
}

function equalPrivateZoneCounts(
  left: OnlineParticipantProjectionV1,
  right: OnlineParticipantProjectionV1,
): boolean {
  if (left.game.zones.byPlayer.length !== right.game.zones.byPlayer.length) return false;
  return left.game.zones.byPlayer.every((leftGroup, index) => {
    const rightGroup = right.game.zones.byPlayer[index];
    if (rightGroup === undefined || leftGroup.playerId !== rightGroup.playerId) return false;
    const names = ['library', 'hand', 'graveyard'] as const;
    return names.every((zone) => leftGroup.zones[zone].count === rightGroup.zones[zone].count);
  });
}

function equalSharedPublicFacts(
  personal: OnlineParticipantProjectionV1,
  table: OnlineParticipantProjectionV1,
): boolean {
  return (
    personal.protocolVersion === table.protocolVersion &&
    personal.roomId === table.roomId &&
    personal.revision === table.revision &&
    structuralEqual(personal.room, table.room) &&
    structuralEqual(personal.game.turnOrder, table.game.turnOrder) &&
    structuralEqual(personal.game.turn, table.game.turn) &&
    structuralEqual(personal.game.players, table.game.players) &&
    equalPrivateZoneCounts(personal, table) &&
    equalPublicZones(personal, table)
  );
}

function ownParticipantIsConnectedPending(
  projection: OnlineParticipantProjectionV1,
  view: PersonalWorkbenchViewV1,
): boolean {
  if (projection.role !== 'player' || projection.corePlayerId === null) return false;
  const ownPlayer = projection.game.players.filter(
    (player) => player.playerId === projection.corePlayerId,
  );
  if (ownPlayer.length !== 1 || ownPlayer[0]?.status !== 'active') return false;
  const participants = projection.room.participants.filter(
    (participant) => participant.participantId === projection.participantId,
  );
  const seats = projection.room.seats.filter(
    (seat) =>
      seat.participantId === projection.participantId &&
      seat.corePlayerId === projection.corePlayerId,
  );
  return (
    participants.length === 1 &&
    participants[0]?.role === 'player' &&
    participants[0].presence === 'connected' &&
    participants[0].seatIndex === view.seatIndex &&
    seats.length === 1 &&
    seats[0]?.seatIndex === view.seatIndex &&
    seats[0].outcome === 'pending'
  );
}

function tableParticipantIsConnected(
  projection: OnlineParticipantProjectionV1,
  view: TableDisplayViewV1,
): boolean {
  if (projection.role !== 'table' || projection.corePlayerId !== null || view.tablePresence !== 'connected') return false;
  const participants = projection.room.participants.filter(
    (participant) => participant.participantId === projection.participantId,
  );
  return (
    participants.length === 1 &&
    participants[0]?.role === 'table' &&
    participants[0].presence === 'connected' &&
    participants[0].seatIndex === null
  );
}

function playerSummary(
  player: TableDisplayPlayerSummaryV1,
  focusedPlayerId: string | null,
): OnlineDisplayPairingOpponentV1 {
  return {
    playerId: player.playerId as CorePlayerId,
    seatIndex: player.seatIndex,
    isFocused: player.playerId === focusedPlayerId,
    isActive: player.isActive,
    presence: player.presence,
    outcome: player.outcome,
    status: player.status,
    life: player.life,
    poison: player.poison,
  };
}

function buildPairingView(
  input: OnlineDisplayPairingInputV1,
): OnlineDisplayPairingViewV1 {
  const root = readExactRecord(input, ['personalProjection', 'tableProjection', 'focusedPlayerId']);
  if (root === null) return unavailable();
  const rawFocusedPlayerId = root.focusedPlayerId;
  if (rawFocusedPlayerId !== null && !isCoreBaseId(rawFocusedPlayerId)) return unavailable();
  const focusedPlayerId = rawFocusedPlayerId === null ? null : rawFocusedPlayerId as CorePlayerId;

  const personalValidation = validateOnlineParticipantProjectionV1(root.personalProjection);
  const tableValidation = validateOnlineParticipantProjectionV1(root.tableProjection);
  if (!personalValidation.ok || !tableValidation.ok) return unavailable();
  const personal = personalValidation.value;
  const table = tableValidation.value;
  const personalView = buildPersonalWorkbenchViewV1(root.personalProjection);
  const tableView = buildTableDisplayViewV1(root.tableProjection);
  if (
    !equalSharedPublicFacts(personal, table) ||
    !ownParticipantIsConnectedPending(personal, personalView) ||
    !tableParticipantIsConnected(table, tableView)
  ) return unavailable();
  if (personalView.corePlayerId !== tableView.players[personalView.seatIndex]?.playerId) return unavailable();
  const ownPlayers = tableView.players.filter((player) => player.playerId === personalView.corePlayerId);
  if (ownPlayers.length !== 1) return unavailable();
  const ownPlayer = ownPlayers[0];
  if (ownPlayer === undefined) return unavailable();

  const opponents = tableView.players
    .filter((player) => player.playerId !== personalView.corePlayerId)
    .map((player) => playerSummary(player, focusedPlayerId));
  if (opponents.length !== 3) return unavailable();
  if (
    focusedPlayerId !== null &&
    !opponents.some(
      (opponent) =>
        opponent.playerId === focusedPlayerId &&
        opponent.status === 'active',
    )
  ) return unavailable();
  const focusedOpponent = opponents.find((opponent) => opponent.isFocused) ?? null;
  const result: OnlineDisplayPairingViewV1 = {
    kind: 'online-display-pairing-view-v1',
    schemaVersion: ONLINE_DISPLAY_PAIRING_SCHEMA_VERSION_V1,
    revision: personal.revision,
    ownPlayerId: personalView.corePlayerId as CorePlayerId,
    ownSeatIndex: ownPlayer.seatIndex,
    opponents,
    focusedOpponent,
  };
  return freezeDeep(result);
}

export function buildOnlineDisplayPairingViewV1(input: unknown): OnlineDisplayPairingViewV1 {
  try {
    return buildPairingView(input as OnlineDisplayPairingInputV1);
  } catch (error: unknown) {
    if (error instanceof OnlineDisplayPairingErrorV1) throw error;
    return unavailable();
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseBindingInput(input: unknown): Readonly<{
  readonly session: SafeRecord;
  readonly action: SafeRecord;
  readonly commandId: string | null;
}> | null {
  const root = readExactRecord(input, ['session', 'action', 'commandId']);
  if (root === null) return null;
  const session = readExactRecord(root.session, [
    'protocolVersion',
    'roomId',
    'participantId',
    'participantCapability',
    'clientBuildId',
    'corePlayerId',
    'personalProjection',
  ]);
  if (session === null) return null;
  if (root.commandId !== null && typeof root.commandId !== 'string') return null;
  const commandId = root.commandId;
  const kindField = readField(root.action, 'kind');
  const kind = kindField?.found === true ? kindField.value : undefined;
  if (kind === 'request-refresh') {
    const action = readExactRecord(root.action, ['kind', 'knownRevision']);
    if (action === null || !validRevision(action.knownRevision)) return null;
    return { session, action, commandId };
  }
  if (kind === 'priority-pass' || kind === 'concede') {
    const action = readExactRecord(root.action, ['kind', 'actorPlayerId', 'baseRevision']);
    if (
      action === null ||
      !isCoreBaseId(action.actorPlayerId) ||
      !validRevision(action.baseRevision)
    ) return null;
    return { session, action, commandId };
  }
  return null;
}

function validatedSession(session: SafeRecord): OnlineClientHelloV1 & Readonly<{
  readonly corePlayerId: CorePlayerId;
  readonly revision: number;
}> {
  if (!isCoreBaseId(session.corePlayerId)) return bindingUnavailable();
  const hello = {
    kind: 'online-client-hello-v1',
    protocolVersion: session.protocolVersion,
    roomId: session.roomId,
    participantId: session.participantId,
    participantCapability: session.participantCapability,
    clientBuildId: session.clientBuildId,
  };
  const validation = validateOnlineClientHelloV1(hello);
  if (!validation.ok) return bindingUnavailable();
  const projectionValidation = validateOnlineParticipantProjectionV1(session.personalProjection);
  if (!projectionValidation.ok) return bindingUnavailable();
  const projection = projectionValidation.value;
  const view = buildPersonalWorkbenchViewV1(session.personalProjection);
  if (
    projection.role !== 'player' ||
    projection.corePlayerId === null ||
    projection.protocolVersion !== validation.value.protocolVersion ||
    projection.roomId !== validation.value.roomId ||
    projection.participantId !== validation.value.participantId ||
    projection.corePlayerId !== session.corePlayerId ||
    view.corePlayerId !== session.corePlayerId ||
    view.revision !== projection.revision
  ) return bindingUnavailable();
  return Object.freeze({
    ...validation.value,
    corePlayerId: session.corePlayerId as CorePlayerId,
    revision: projection.revision,
  });
}

function containsCapabilityFragment(value: string, capability: string): boolean {
  for (let length = 8; length <= capability.length; length += 1) {
    for (let start = 0; start + length <= capability.length; start += 1) {
      if (value.includes(capability.slice(start, start + length))) return true;
    }
  }
  return false;
}

function bindWorkbenchAction(input: unknown): OnlineDisplayPairingProtocolFrameV1 {
  const parsed = parseBindingInput(input);
  if (parsed === null) return bindingUnavailable();
  const session = validatedSession(parsed.session);
  const { action, commandId } = parsed;
  if (action.kind === 'request-refresh') {
    if (commandId !== null || action.knownRevision !== session.revision) return bindingUnavailable();
    const request = {
      kind: 'online-projection-request-v1' as const,
      protocolVersion: session.protocolVersion,
      roomId: session.roomId,
      participantId: session.participantId,
      participantCapability: session.participantCapability,
      knownRevision: action.knownRevision,
      clientBuildId: session.clientBuildId,
      decisionContext: null,
    };
    const validation = validateOnlineProjectionRequestV1(request);
    if (!validation.ok) return bindingUnavailable();
    return freezeDeep(validation.value);
  }
  if (
    commandId === null ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(commandId) ||
    containsCapabilityFragment(commandId, session.participantCapability)
  ) return bindingUnavailable();
  if (!isCoreBaseId(action.actorPlayerId) || action.actorPlayerId !== session.corePlayerId) return bindingUnavailable();
  if (!validRevision(action.baseRevision) || action.baseRevision !== session.revision) return bindingUnavailable();
  const baseRevision = action.baseRevision;
  if (session.participantCapability.length < 1) return bindingUnavailable();
  const payload: CoreCommandPayloadV1 = action.kind === 'priority-pass'
    ? { kind: 'priority-pass', playerId: session.corePlayerId }
    : { kind: 'player-exit', playerId: session.corePlayerId, cause: 'concession' };
  const command = createCoreCommandV1({
    schemaVersion: 1,
    sequence: baseRevision + 1,
    actorPlayerId: session.corePlayerId,
    decisionMakerPlayerId: session.corePlayerId,
    decisionContext: { kind: 'decision', decisionKey: commandId },
    payload,
  });
  const envelope = {
    kind: 'online-command-envelope-v1' as const,
    protocolVersion: session.protocolVersion,
    roomId: session.roomId,
    participantId: session.participantId,
    participantCapability: session.participantCapability,
    commandId,
    baseRevision,
    command,
  };
  const validation = validateOnlineCommandEnvelopeV1(envelope);
  if (!validation.ok) return bindingUnavailable();
  return freezeDeep(validation.value);
}

export function bindPersonalWorkbenchActionV1(input: unknown): OnlineDisplayPairingProtocolFrameV1 {
  try {
    return bindWorkbenchAction(input);
  } catch (error: unknown) {
    if (error instanceof PersonalWorkbenchActionBindingErrorV1) throw error;
    return bindingUnavailable();
  }
}

export function createOnlineOpponentFocusActionV1(
  playerId: CorePlayerId,
  revision: number,
): OnlineOpponentFocusActionV1 {
  if (!isCoreBaseId(playerId) || !validRevision(revision)) return unavailable();
  return freezeDeep({ kind: 'focus-opponent' as const, playerId, revision });
}
