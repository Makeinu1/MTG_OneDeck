import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import {
  ONLINE_ROOM_SCHEMA_VERSION_V1,
  OnlineRoomOperationErrorV1,
  activateOnlineRoomV1,
  disconnectOnlineRoomParticipantV1,
  joinOnlineRoomV1,
  reconcileOnlineRoomCoreLifecycleV1,
  rejoinOnlineRoomPlayerV1,
  setOnlineRoomPlayerReadyV1,
  startOnlineRoomV1,
  validateOnlineRoomV1,
} from '../index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  assertDeepFrozen,
  coreCommand,
  createRoom,
  joinAllPlayers,
  makeCoreRoot,
  readyAllPlayers,
} from './testHelpers';

function operationIssues(
  operation: () => unknown,
): readonly { readonly code: string; readonly path: string }[] {
  try {
    operation();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OnlineRoomOperationErrorV1);
    return (error as OnlineRoomOperationErrorV1).issues;
  }
  throw new Error('Expected OnlineRoomOperationErrorV1');
}

describe('O4P-02B four-seat Room lifecycle', () => {
  it('creates the exact canonical root and survives a JSON round trip', () => {
    const room = createRoom();
    expect(ONLINE_ROOM_SCHEMA_VERSION_V1).toBe(1);
    expect(Object.keys(room)).toEqual([
      'kind',
      'schemaVersion',
      'roomId',
      'lifecycle',
      'hostParticipantId',
      'participants',
      'seats',
    ]);
    expect(Object.keys(room.participants[0] ?? {})).toEqual([
      'participantId',
      'role',
      'presence',
      'seatIndex',
    ]);
    expect(Object.keys(room.seats[0] ?? {})).toEqual([
      'seatIndex',
      'corePlayerId',
      'seatCapability',
      'participantId',
      'ready',
      'outcome',
    ]);
    expect(room).toMatchObject({
      kind: 'online-room-v1',
      schemaVersion: 1,
      roomId: 'room-02b',
      lifecycle: 'forming',
      hostParticipantId: 'host',
      participants: [
        { participantId: 'host', role: 'player', presence: 'connected', seatIndex: 0 },
      ],
    });
    expect(room.seats.map((seat) => seat.seatIndex)).toEqual([0, 1, 2, 3]);
    expect(room.seats.map((seat) => seat.corePlayerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(room.seats[0]?.ready).toBe(false);
    assertDeepFrozen(room);

    const roundTrip = validateOnlineRoomV1(JSON.parse(JSON.stringify(room)) as unknown);
    expect(roundTrip).toMatchObject({ ok: true, value: room });
    if (roundTrip.ok) {
      expect(roundTrip.value).not.toBe(room);
      expect(roundTrip.value.participants[0]).not.toBe(room.participants[0]);
      expect(roundTrip.value.seats[0]).not.toBe(room.seats[0]);
      assertDeepFrozen(roundTrip);
    }
  });

  it('preserves join order for all roles and permits only one table', () => {
    let room = createRoom();
    room = joinOnlineRoomV1(room, { participantId: 'table-display', role: 'table' });
    room = joinOnlineRoomV1(room, { participantId: 'spectator-a', role: 'spectator' });
    room = joinOnlineRoomV1(room, {
      participantId: PARTICIPANTS[1],
      role: 'player',
      seatCapability: CAPABILITIES[1],
    });
    room = joinOnlineRoomV1(room, { participantId: 'spectator-b', role: 'spectator' });
    expect(room.participants.map((participant) => participant.participantId)).toEqual([
      'host',
      'table-display',
      'spectator-a',
      'player-2',
      'spectator-b',
    ]);
    expect(room.participants.map((participant) => participant.role)).toEqual([
      'player',
      'table',
      'spectator',
      'player',
      'spectator',
    ]);
    expect(
      operationIssues(() =>
        joinOnlineRoomV1(room, {
          participantId: 'table-display-2',
          role: 'table',
        }),
      ),
    ).toEqual([expect.objectContaining({ code: 'TABLE_ALREADY_PRESENT', path: '/role' })]);
    expect(
      operationIssues(() =>
        joinOnlineRoomV1(room, {
          participantId: 'wrong-seat',
          role: 'player',
          seatCapability: CAPABILITIES[0],
        }),
      ),
    ).toEqual([expect.objectContaining({ code: 'CAPABILITY_REJECTED', path: '/seatCapability' })]);
  });

  it('derives readiness, clears it before start, and preserves the started roster', () => {
    let room = readyAllPlayers();
    expect(room.lifecycle).toBe('ready');

    const disconnected = disconnectOnlineRoomParticipantV1(room, PARTICIPANTS[1]);
    expect(disconnected.lifecycle).toBe('forming');
    expect(disconnected.seats[1]?.ready).toBe(false);
    expect(room.lifecycle).toBe('ready');
    expect(room.seats[1]?.ready).toBe(true);

    const crossSeatSecret = CAPABILITIES[2];
    const crossSeatIssues = operationIssues(() =>
      rejoinOnlineRoomPlayerV1(disconnected, {
        participantId: PARTICIPANTS[1],
        seatCapability: crossSeatSecret,
      }),
    );
    expect(crossSeatIssues).toEqual([
      expect.objectContaining({ code: 'CAPABILITY_REJECTED', path: '/seatCapability' }),
    ]);
    expect(JSON.stringify(crossSeatIssues)).not.toContain(crossSeatSecret);

    room = rejoinOnlineRoomPlayerV1(disconnected, {
      participantId: PARTICIPANTS[1],
      seatCapability: CAPABILITIES[1],
    });
    expect(room.lifecycle).toBe('forming');
    room = setOnlineRoomPlayerReadyV1(room, {
      participantId: PARTICIPANTS[1],
      seatCapability: CAPABILITIES[1],
      ready: true,
    });
    expect(room.lifecycle).toBe('ready');
    expect(operationIssues(() => startOnlineRoomV1(room, PARTICIPANTS[1]))).toEqual([
      expect.objectContaining({ code: 'HOST_AUTHORITY_REQUIRED', path: '/hostParticipantId' }),
    ]);

    const started = startOnlineRoomV1(room, PARTICIPANTS[0]);
    expect(started.lifecycle).toBe('started');
    const laterDisconnect = disconnectOnlineRoomParticipantV1(started, PARTICIPANTS[2]);
    expect(laterDisconnect.lifecycle).toBe('started');
    expect(laterDisconnect.seats.every((seat) => seat.ready)).toBe(true);
    const rejoined = rejoinOnlineRoomPlayerV1(laterDisconnect, {
      participantId: PARTICIPANTS[2],
      seatCapability: CAPABILITIES[2],
    });
    expect(rejoined.lifecycle).toBe('started');
  });

  it('activates only against the exact valid full Core roster without storing Core state', () => {
    const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
    const coreRoot = makeCoreRoot();
    const activated = activateOnlineRoomV1(started, {
      hostParticipantId: PARTICIPANTS[0],
      coreRoot,
    });
    expect(activated.lifecycle).toBe('active');
    expect(Object.keys(activated)).not.toContain('coreRoot');
    expect(JSON.stringify(activated)).not.toContain('acceptedCommandCount');

    const reversed = {
      ...coreRoot,
      playerLifecycle: {
        players: [...coreRoot.playerLifecycle.players].reverse(),
      },
    };
    expect(
      operationIssues(() =>
        activateOnlineRoomV1(started, {
          hostParticipantId: PARTICIPANTS[0],
          coreRoot: reversed,
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_CORE_ROOT' })]));
  });

  it('reflects only accepted Core concession/defeat outcomes and finishes at one survivor', () => {
    const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
    let coreRoot = makeCoreRoot();
    let room = activateOnlineRoomV1(started, {
      hostParticipantId: PARTICIPANTS[0],
      coreRoot,
    });
    room = disconnectOnlineRoomParticipantV1(room, PARTICIPANTS[3]);

    const p4Exit = Core.applyCoreCommandV1(
      coreRoot,
      coreCommand(coreRoot, 'P4', {
        kind: 'player-exit',
        playerId: 'P4' as never,
        cause: 'concession',
      }),
    );
    expect(p4Exit.status, JSON.stringify(p4Exit)).toBe('accepted');
    coreRoot = p4Exit.root;
    room = reconcileOnlineRoomCoreLifecycleV1(room, coreRoot);
    expect(room.lifecycle).toBe('active');
    expect(room.seats.map((seat) => seat.outcome)).toEqual([
      'pending',
      'pending',
      'pending',
      'conceded',
    ]);
    expect(
      room.participants.find((participant) => participant.participantId === 'player-4')?.presence,
    ).toBe('disconnected');

    expect(operationIssues(() => reconcileOnlineRoomCoreLifecycleV1(room, makeCoreRoot()))).toEqual(
      [expect.objectContaining({ code: 'OUTCOME_REGRESSION', path: '/seats/3/outcome' })],
    );

    const p3Exit = Core.applyCoreCommandV1(
      coreRoot,
      coreCommand(coreRoot, 'P3', {
        kind: 'player-exit',
        playerId: 'P3' as never,
        cause: 'defeat',
      }),
    );
    expect(p3Exit.status, JSON.stringify(p3Exit)).toBe('accepted');
    coreRoot = p3Exit.root;
    room = reconcileOnlineRoomCoreLifecycleV1(room, coreRoot);
    expect(room.seats[2]?.outcome).toBe('defeated');
    expect(room.lifecycle).toBe('active');

    const p1Exit = Core.applyCoreCommandV1(
      coreRoot,
      coreCommand(coreRoot, 'P1', {
        kind: 'player-exit',
        playerId: 'P1' as never,
        cause: 'defeat',
      }),
    );
    expect(p1Exit.status, JSON.stringify(p1Exit)).toBe('accepted');
    coreRoot = p1Exit.root;
    room = reconcileOnlineRoomCoreLifecycleV1(room, coreRoot);
    expect(room.lifecycle).toBe('finished');
    expect(room.seats.map((seat) => seat.outcome)).toEqual([
      'defeated',
      'pending',
      'defeated',
      'conceded',
    ]);
    assertDeepFrozen(room);

    expect(
      operationIssues(() =>
        rejoinOnlineRoomPlayerV1(room, {
          participantId: PARTICIPANTS[3],
          seatCapability: CAPABILITIES[3],
        }),
      ),
    ).toEqual([expect.objectContaining({ code: 'PLAYER_NOT_PENDING' })]);
  });

  it('keeps observer reconnect authorization and post-start roster mutation deferred', () => {
    let room = joinOnlineRoomV1(joinAllPlayers(), { participantId: 'observer', role: 'spectator' });
    room = disconnectOnlineRoomParticipantV1(room, 'observer');
    expect(
      operationIssues(() =>
        rejoinOnlineRoomPlayerV1(room, {
          participantId: 'observer',
          seatCapability: CAPABILITIES[0],
        }),
      ),
    ).toEqual([expect.objectContaining({ code: 'INVALID_RELATION' })]);

    const started = startOnlineRoomV1(readyAllPlayers(room), PARTICIPANTS[0]);
    expect(
      operationIssues(() =>
        joinOnlineRoomV1(started, {
          participantId: 'late-player',
          role: 'player',
          seatCapability: CAPABILITIES[1],
        }),
      ),
    ).toEqual([expect.objectContaining({ code: 'INVALID_LIFECYCLE' })]);
  });
});
