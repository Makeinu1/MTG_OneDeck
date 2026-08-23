/**
 * Regression-only adapter for the O4P-06 fixed four-deck start.
 *
 * This module is intentionally outside the lobby production barrel.  It is
 * imported directly by historical fixture tests so the deterministic bytes
 * remain available without making the fixed catalog reachable from a served
 * Worker or Pages entry graph.
 */
import { joinOnlineRoomV1 } from '../../room/index';
import { createOnlineProtocolStateV1, type OnlineProtocolObserverCapabilityV1 } from '../../protocol/index';
import { bootstrapFourDeckGenesisV1, type FourDeckBootstrapResultV1 } from '../../bootstrap/fourDeckBootstrapV1';
import { assertNoConfiguredCapabilityFragmentV1 } from '../../cloudflare/codec';
import {
  authorizeOnlineFormingLobbySeatV1,
  validateOnlineFormingLobbyV1,
  type OnlineFormingLobbyV1,
} from '../index';
import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../../room/validationSupport';

export type StartOnlineFormingLobbyV1Input = Readonly<{
  readonly hostParticipantId: string;
  readonly seatCapability: string;
}>;

export type StartOnlineFormingLobbyWithTableV1Input = Readonly<{
  readonly hostParticipantId: string;
  readonly seatCapability: string;
  readonly tableParticipantId: string;
  readonly tableCapability: string;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function exactRecord(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch {
    return false;
  }
}

function capability(value: unknown): value is string {
  return typeof value === 'string' && isOnlineRoomSeatCapabilityV1(value);
}

function appId(value: unknown): value is string {
  return typeof value === 'string' && isOnlineRoomApplicationIdV1(value);
}

function capabilitiesOf(lobby: OnlineFormingLobbyV1): readonly string[] {
  return Object.freeze(lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]));
}

function startInputSeats(lobby: OnlineFormingLobbyV1): readonly Readonly<{
  readonly seatIndex: number;
  readonly corePlayerId: string;
  readonly participantId: string;
  readonly seatCapability: string;
  readonly deckId: string;
  readonly deckText: string;
}>[] {
  return lobby.seats.map((seat) => ({
    seatIndex: seat.seatIndex,
    corePlayerId: seat.corePlayerId,
    participantId: seat.participantId ?? '',
    seatCapability: seat.seatCapability,
    deckId: seat.deckId ?? '',
    deckText: seat.deckText ?? '',
  }));
}

export function startOnlineFormingLobbyV1(
  lobbyInput: unknown,
  input: StartOnlineFormingLobbyV1Input,
): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly genesis: FourDeckBootstrapResultV1 }> {
  const checked = validateOnlineFormingLobbyV1(lobbyInput);
  if (!checked.ok) fail('Invalid lobby');
  const lobby = checked.value;
  if (!exactRecord(input, ['hostParticipantId', 'seatCapability']) || typeof input.hostParticipantId !== 'string' || typeof input.seatCapability !== 'string') fail('Host authorization rejected');
  const validation = authorizeOnlineFormingLobbySeatV1(lobby, input.hostParticipantId, input.seatCapability);
  if (lobby.lifecycle !== 'ready' || input.hostParticipantId !== lobby.hostParticipantId || validation !== 0) fail('Host authorization rejected');
  const genesis = bootstrapFourDeckGenesisV1({ roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, seats: startInputSeats(lobby) });
  if (!genesis.ok) return Object.freeze({ lobby, genesis });
  const startedLobby: OnlineFormingLobbyV1 = Object.freeze({
    ...lobby,
    lifecycle: 'started' as const,
    seats: Object.freeze([lobby.seats[0], lobby.seats[1], lobby.seats[2], lobby.seats[3]] as const),
  });
  return Object.freeze({ lobby: startedLobby, genesis });
}

/** Regression-only table observer variant of the fixed four-deck start. */
export function startOnlineFormingLobbyWithTableV1(
  lobbyInput: unknown,
  input: StartOnlineFormingLobbyWithTableV1Input,
): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly genesis: FourDeckBootstrapResultV1 }> {
  const checked = validateOnlineFormingLobbyV1(lobbyInput);
  if (!checked.ok) fail('Invalid lobby');
  const lobby = checked.value;
  if (
    lobby.lifecycle !== 'ready' ||
    !exactRecord(input, ['hostParticipantId', 'seatCapability', 'tableParticipantId', 'tableCapability']) ||
    !appId(input.hostParticipantId) ||
    !capability(input.seatCapability) ||
    !appId(input.tableParticipantId) ||
    typeof input.tableCapability !== 'string' ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(input.tableCapability)
  ) fail('Invalid table start input');
  if (input.hostParticipantId !== lobby.hostParticipantId || authorizeOnlineFormingLobbySeatV1(lobby, input.hostParticipantId, input.seatCapability) !== 0) fail('Host authorization rejected');
  if (input.tableParticipantId === input.hostParticipantId || lobby.seats.some((seat) => seat.participantId === input.tableParticipantId)) fail('Table participant collision');
  const configured = capabilitiesOf(lobby);
  if (configured.includes(input.tableCapability) || input.tableCapability === input.seatCapability) fail('Table capability collision');
  try {
    const allCapabilities = [...configured, input.tableCapability];
    for (let index = 0; index < allCapabilities.length; index += 1) {
      const current = allCapabilities[index];
      if (current === undefined) continue;
      assertNoConfiguredCapabilityFragmentV1(current, allCapabilities.filter((_, candidateIndex) => candidateIndex !== index));
    }
    assertNoConfiguredCapabilityFragmentV1(input.tableParticipantId, allCapabilities);
    for (const identifier of [lobby.roomId, lobby.serverBuildId, lobby.hostParticipantId, ...lobby.seats.flatMap((seat) => [seat.participantId, seat.deckId].filter((value): value is string => value !== null))]) {
      assertNoConfiguredCapabilityFragmentV1(identifier, [input.tableCapability]);
    }
  } catch {
    fail('Table capability fragment');
  }
  const started = startOnlineFormingLobbyV1(lobby, {
    hostParticipantId: input.hostParticipantId,
    seatCapability: input.seatCapability,
  });
  if (!started.genesis.ok) return started;
  try {
    const roomWithTable = joinOnlineRoomV1(started.genesis.room, {
      participantId: input.tableParticipantId,
      role: 'table',
    });
    const observerCapability = input.tableCapability as OnlineProtocolObserverCapabilityV1;
    const protocolState = createOnlineProtocolStateV1({
      serverBuildId: lobby.serverBuildId,
      room: roomWithTable,
      coreRoot: started.genesis.coreRoot,
      observerAuthorizations: [{ participantId: input.tableParticipantId, observerCapability }],
    });
    return Object.freeze({
      lobby: started.lobby,
      genesis: Object.freeze({ ...started.genesis, room: roomWithTable, protocolState }),
    });
  } catch {
    fail('Table start initialization failed');
  }
}
