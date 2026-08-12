import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import {
  OnlineRoomCreationErrorV1,
  OnlineRoomOperationErrorV1,
  activateOnlineRoomV1,
  createOnlineRoomV1,
  disconnectOnlineRoomParticipantV1,
  joinOnlineRoomV1,
  reconcileOnlineRoomCoreLifecycleV1,
  rejoinOnlineRoomPlayerV1,
  setOnlineRoomPlayerReadyV1,
  startOnlineRoomV1,
  validateOnlineRoomV1,
  type OnlineRoomV1,
} from '../index';
import {
  CAPABILITIES,
  CORE_PLAYERS,
  PARTICIPANTS,
  coreCommand,
  createRoom,
  joinAllPlayers,
  makeCoreRoot,
  readyAllPlayers,
} from './testHelpers';

function issues(value: unknown) {
  const result = validateOnlineRoomV1(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected invalid Room');
  return result.issues;
}

function operationIssues(run: () => unknown) {
  try {
    run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OnlineRoomOperationErrorV1);
    return (error as OnlineRoomOperationErrorV1).issues;
  }
  throw new Error('Expected OnlineRoomOperationErrorV1');
}

function creationEvidence(run: () => unknown): OnlineRoomCreationErrorV1 {
  try {
    run();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OnlineRoomCreationErrorV1);
    return error as OnlineRoomCreationErrorV1;
  }
  throw new Error('Expected OnlineRoomCreationErrorV1');
}

function readyRoomWithRoster(corePlayers: readonly string[]): OnlineRoomV1 {
  let room = createOnlineRoomV1({
    roomId: 'review-roster-room',
    seatAssignments: corePlayers.map((corePlayerId, seatIndex) => ({
      seatIndex,
      corePlayerId,
      seatCapability: CAPABILITIES[seatIndex],
    })),
    host: { participantId: PARTICIPANTS[0], seatCapability: CAPABILITIES[0] },
  });
  for (let index = 1; index < 4; index += 1) {
    room = joinOnlineRoomV1(room, {
      participantId: PARTICIPANTS[index],
      role: 'player',
      seatCapability: CAPABILITIES[index],
    });
  }
  for (let index = 0; index < 4; index += 1) {
    room = setOnlineRoomPlayerReadyV1(room, {
      participantId: PARTICIPANTS[index],
      seatCapability: CAPABILITIES[index],
      ready: true,
    });
  }
  return room;
}

describe('O4P-02B judge-owned Room evidence', () => {
  it('keeps source indexes stable when one seat is unreadable', () => {
    const malformed = JSON.parse(JSON.stringify(joinAllPlayers())) as {
      seats: unknown[];
    };
    malformed.seats[0] = null;
    const found = issues(malformed);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_TYPE', path: '/seats/0' }),
        expect.objectContaining({ code: 'INVALID_RELATION', path: '/participants/0/seatIndex' }),
      ]),
    );
    expect(
      found
        .filter((issue) => issue.code === 'INVALID_RELATION' && issue.path.startsWith('/participants/'))
        .map((issue) => issue.path),
    ).toEqual(['/participants/0/seatIndex']);
  });

  it('detects an ownKeys-hidden array index and preserves independent input issues', () => {
    const hidden = JSON.parse(JSON.stringify(createRoom())) as { seats: unknown[] };
    hidden.seats = new Proxy(hidden.seats, {
      ownKeys(target): ArrayLike<string | symbol> {
        return Reflect.ownKeys(target).filter((key) => key !== '1');
      },
    });
    expect(issues(hidden)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NON_DENSE_ARRAY', path: '/seats/1' }),
      ]),
    );

    let getterCalled = false;
    const input = { participantId: '@invalid', role: 'player' } as Record<string, unknown>;
    Object.defineProperty(input, 'seatCapability', {
      enumerable: true,
      get(): string {
        getterCalled = true;
        return CAPABILITIES[1];
      },
    });
    const found = operationIssues(() => joinOnlineRoomV1(createRoom(), input));
    expect(getterCalled).toBe(false);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_ID', path: '/participantId' }),
        expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/seatCapability' }),
      ]),
    );
  });

  it('redacts capability runs in aliases when extraction is unavailable or cross-Room', () => {
    const configuredSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const malformed = JSON.parse(JSON.stringify(createRoom())) as Record<string, unknown> & {
      seats: Array<Record<string, unknown>>;
    };
    malformed.seats[0].seatCapability = configuredSecret;
    Object.defineProperty(malformed.seats[0], 'seatCapability', {
      enumerable: true,
      get(): string {
        throw new Error('must not read capability getter');
      },
    });
    Object.defineProperty(malformed, `alias.${configuredSecret}`, {
      enumerable: true,
      value: true,
    });
    Object.defineProperty(malformed, `pointer/${configuredSecret}~suffix`, {
      enumerable: true,
      value: true,
    });
    const malformedIssues = issues(malformed);
    expect(JSON.stringify(malformedIssues)).not.toContain(configuredSecret);
    expect(malformedIssues.filter((issue) => issue.code === 'UNKNOWN_FIELD')).toHaveLength(2);

    const creationInput = {
      roomId: 'review-redaction-room',
      seatAssignments: CORE_PLAYERS.map((corePlayerId, seatIndex) => ({
        seatIndex,
        corePlayerId,
        seatCapability: seatIndex === 0 ? configuredSecret : CAPABILITIES[seatIndex],
      })),
      host: { participantId: PARTICIPANTS[0], seatCapability: CAPABILITIES[0] },
    } as Record<string, unknown> & { seatAssignments: Array<Record<string, unknown>> };
    Object.defineProperty(creationInput.seatAssignments[0], 'seatCapability', {
      enumerable: true,
      get(): string {
        throw new Error('must not read capability getter');
      },
    });
    Object.defineProperty(creationInput, `alias.${configuredSecret}`, {
      enumerable: true,
      value: true,
    });
    const creation = creationEvidence(() => createOnlineRoomV1(creationInput));
    expect(JSON.stringify({ message: creation.message, issues: creation.issues }))
      .not.toContain(configuredSecret);

    const foreignSecret = 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW';
    const target = createRoom();
    const operationInputs: Array<() => unknown> = [
      () => {
        const input = {
          participantId: 'foreign-player',
          role: 'player',
          seatCapability: foreignSecret,
        } as Record<string, unknown>;
        Object.defineProperty(input, `alias.${foreignSecret}`, { enumerable: true, value: true });
        return joinOnlineRoomV1(target, input);
      },
      () => {
        const input = {
          participantId: PARTICIPANTS[0],
          seatCapability: foreignSecret,
        } as Record<string, unknown>;
        Object.defineProperty(input, `alias-${foreignSecret}`, { enumerable: true, value: true });
        return rejoinOnlineRoomPlayerV1(target, input);
      },
      () => {
        const input = {
          participantId: PARTICIPANTS[0],
          seatCapability: foreignSecret,
          ready: true,
        } as Record<string, unknown>;
        Object.defineProperty(input, `alias_${foreignSecret}`, { enumerable: true, value: true });
        return setOnlineRoomPlayerReadyV1(target, input);
      },
    ];
    for (const run of operationInputs) {
      const found = operationIssues(run);
      expect(JSON.stringify(found)).not.toContain(foreignSecret);
      expect(found).toEqual([
        expect.objectContaining({ code: 'UNKNOWN_FIELD' }),
      ]);
    }
  });

  it('rejects valid-but-different Core roster order without rewriting identities', () => {
    const room = startOnlineRoomV1(
      readyRoomWithRoster(['P2', 'P1', 'P3', 'P4']),
      PARTICIPANTS[0],
    );
    const coreRoot = makeCoreRoot();
    const found = operationIssues(() =>
      activateOnlineRoomV1(room, {
        hostParticipantId: PARTICIPANTS[0],
        coreRoot,
      }),
    );
    expect(found).toEqual([
      expect.objectContaining({
        code: 'CORE_ROSTER_MISMATCH',
        path: '/coreRoot/playerLifecycle/players',
      }),
    ]);
    expect(room.seats.map((seat) => seat.corePlayerId)).toEqual(['P2', 'P1', 'P3', 'P4']);
    expect(coreRoot.playerLifecycle.players.map((entry) => entry.playerId)).toEqual(CORE_PLAYERS);
  });

  it('keeps disconnect application-only and reflects only accepted Core exits', () => {
    const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
    let root = makeCoreRoot();
    let room = activateOnlineRoomV1(started, {
      hostParticipantId: PARTICIPANTS[0],
      coreRoot: root,
    });
    const beforeDigest = Core.coreCanonicalDigestFromValueV1(root);
    room = disconnectOnlineRoomParticipantV1(room, PARTICIPANTS[3]);
    expect(Core.coreCanonicalDigestFromValueV1(root)).toBe(beforeDigest);
    expect(room.seats[3]?.outcome).toBe('pending');

    const wrongSecret = CAPABILITIES[2];
    const rejected = operationIssues(() =>
      rejoinOnlineRoomPlayerV1(room, {
        participantId: PARTICIPANTS[3],
        seatCapability: wrongSecret,
      }),
    );
    expect(JSON.stringify(rejected)).not.toContain(wrongSecret);

    const exit = Core.applyCoreCommandV1(
      root,
      coreCommand(root, 'P4', {
        kind: 'player-exit',
        playerId: 'P4' as never,
        cause: 'concession',
      }),
    );
    expect(exit.status).toBe('accepted');
    root = exit.root;
    room = reconcileOnlineRoomCoreLifecycleV1(room, root);
    expect(room.seats[3]?.outcome).toBe('conceded');
  });
});
