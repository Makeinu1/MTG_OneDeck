import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  OnlineRoomCreationErrorV1,
  OnlineRoomOperationErrorV1,
  activateOnlineRoomV1,
  createOnlineRoomV1,
  joinOnlineRoomV1,
  setOnlineRoomPlayerReadyV1,
  startOnlineRoomV1,
  validateOnlineRoomV1,
} from '../index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  assertDeepFrozen,
  createRoom,
  joinAllPlayers,
  makeCoreRoot,
  readyAllPlayers,
} from './testHelpers';

function validationIssues(
  value: unknown,
): readonly { readonly code: string; readonly path: string; readonly message: string }[] {
  const result = validateOnlineRoomV1(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected invalid Room');
  return result.issues;
}

function operationError(operation: () => unknown): OnlineRoomOperationErrorV1 {
  try {
    operation();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OnlineRoomOperationErrorV1);
    return error as OnlineRoomOperationErrorV1;
  }
  throw new Error('Expected OnlineRoomOperationErrorV1');
}

function creationError(operation: () => unknown): OnlineRoomCreationErrorV1 {
  try {
    operation();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OnlineRoomCreationErrorV1);
    return error as OnlineRoomCreationErrorV1;
  }
  throw new Error('Expected OnlineRoomCreationErrorV1');
}

describe('O4P-02B Room validation and hostile inputs', () => {
  it('rejects exact-record, descriptor, prototype, symbol, and accessor defects without invoking getters', () => {
    const room = JSON.parse(JSON.stringify(createRoom())) as Record<string, unknown>;
    let getterCalled = false;
    Object.defineProperty(room, 'roomId', {
      enumerable: true,
      get(): string {
        getterCalled = true;
        return 'not-readable';
      },
    });
    Object.defineProperty(room, 'lifecycle', {
      enumerable: false,
      writable: true,
      value: 'forming',
    });
    room.extra = true;
    const marker = Symbol('room-marker');
    room[marker as unknown as string] = true;
    const first = validationIssues(room);
    const second = validationIssues(room);
    expect(getterCalled).toBe(false);
    expect(second).toEqual(first);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/<symbol>' }),
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/extra' }),
        expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/lifecycle' }),
        expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/roomId' }),
      ]),
    );
    assertDeepFrozen(first);

    const nonOrdinary = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createRoom(),
    );
    expect(validationIssues(nonOrdinary)).toEqual([
      expect.objectContaining({ code: 'INVALID_ROOT', path: '' }),
    ]);
  });

  it('rejects sparse arrays, extra array fields, trapped descriptors, and revoked proxies safely', () => {
    const sparse = JSON.parse(JSON.stringify(createRoom())) as { participants: unknown[] };
    const sparseParticipants = [sparse.participants[0]];
    sparseParticipants.length = 2;
    sparse.participants = sparseParticipants;
    expect(validationIssues(sparse)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NON_DENSE_ARRAY', path: '/participants/1' }),
      ]),
    );

    const extra = JSON.parse(JSON.stringify(createRoom())) as { seats: unknown[] };
    Object.defineProperty(extra.seats, 'metadata', { enumerable: true, value: 'forbidden' });
    expect(validationIssues(extra)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/seats/metadata' }),
      ]),
    );

    const trapped = JSON.parse(JSON.stringify(createRoom())) as { seats: unknown[] };
    trapped.seats = new Proxy(trapped.seats, {
      getOwnPropertyDescriptor(target, key): PropertyDescriptor | undefined {
        if (key === '2') throw new Error('descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(validationIssues(trapped)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/seats/2' }),
      ]),
    );

    const revoked = Proxy.revocable(createRoom(), {});
    revoked.revoke();
    expect(() => validateOnlineRoomV1(revoked.proxy)).not.toThrow();
    expect(validationIssues(revoked.proxy)).toEqual([
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '' }),
    ]);
  });

  it('keeps participant relations aligned to source seat indexes after an unreadable leading seat', () => {
    const malformed = JSON.parse(JSON.stringify(joinAllPlayers())) as { seats: unknown[] };
    malformed.seats = new Proxy(malformed.seats, {
      getOwnPropertyDescriptor(target, key): PropertyDescriptor | undefined {
        if (key === '0') throw new Error('leading seat descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    const issues = validationIssues(malformed);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/seats/0' }),
        expect.objectContaining({
          code: 'INVALID_RELATION',
          path: '/participants/0/seatIndex',
        }),
      ]),
    );
    expect(
      issues
        .filter(
          (issue) =>
            issue.code === 'INVALID_RELATION' &&
            /^\/participants\/\d+\/seatIndex$/.test(issue.path),
        )
        .map((issue) => issue.path),
    ).toEqual(['/participants/0/seatIndex']);
  });

  it('reports duplicate identities, capabilities, relations, and lifecycle defects completely in path order', () => {
    const invalid = JSON.parse(JSON.stringify(joinAllPlayers())) as {
      lifecycle: string;
      participants: Array<{
        participantId: string;
        role: string;
        presence: string;
        seatIndex: number | null;
      }>;
      seats: Array<{
        seatIndex: number;
        corePlayerId: string;
        seatCapability: string;
        participantId: string | null;
        ready: boolean;
        outcome: string;
      }>;
    };
    invalid.lifecycle = 'ready';
    invalid.participants[1].participantId = invalid.participants[0].participantId;
    invalid.participants.push({
      participantId: 'table-a',
      role: 'table',
      presence: 'connected',
      seatIndex: null,
    });
    invalid.participants.push({
      participantId: 'table-b',
      role: 'table',
      presence: 'connected',
      seatIndex: null,
    });
    invalid.seats[1].corePlayerId = invalid.seats[0].corePlayerId;
    invalid.seats[2].seatCapability = invalid.seats[0].seatCapability;
    invalid.seats[3].participantId = null;
    invalid.seats[3].ready = true;

    const first = validationIssues(invalid);
    const second = validationIssues(invalid);
    expect(second).toEqual(first);
    expect(first.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_PARTICIPANT',
        'TOO_MANY_TABLES',
        'DUPLICATE_CORE_PLAYER',
        'DUPLICATE_CAPABILITY',
        'INVALID_RELATION',
        'LIFECYCLE_MISMATCH',
      ]),
    );
    expect(first.map((issue) => `${issue.path}\u0000${issue.code}`)).toEqual(
      [...first].map((issue) => `${issue.path}\u0000${issue.code}`).sort(),
    );
    assertDeepFrozen(first);
  });

  it('never echoes capabilities in validation, creation, or operation errors', () => {
    const secret = 'SECRET_CAPABILITY_0123456789ABCDEF';
    const malformed = JSON.parse(JSON.stringify(createRoom())) as {
      seats: Array<{ seatCapability: string }>;
    };
    malformed.seats[0].seatCapability = secret;
    malformed.seats[1].seatCapability = secret;
    const validation = validationIssues(malformed);
    expect(JSON.stringify(validation)).not.toContain(secret);

    const creation = creationError(() =>
      createOnlineRoomV1({
        roomId: 'room-creation-error',
        seatAssignments: [
          { seatIndex: 0, corePlayerId: 'P1', seatCapability: secret },
          { seatIndex: 1, corePlayerId: 'P2', seatCapability: secret },
          { seatIndex: 2, corePlayerId: 'P3', seatCapability: CAPABILITIES[2] },
          { seatIndex: 3, corePlayerId: 'P4', seatCapability: CAPABILITIES[3] },
        ],
        host: { participantId: 'host', seatCapability: secret },
      }),
    );
    expect(JSON.stringify({ message: creation.message, issues: creation.issues })).not.toContain(
      secret,
    );
    assertDeepFrozen(creation.issues);

    const operation = operationError(() =>
      joinOnlineRoomV1(createRoom(), {
        participantId: 'secret-attempt',
        role: 'player',
        seatCapability: secret,
      }),
    );
    expect(JSON.stringify({ message: operation.message, issues: operation.issues })).not.toContain(
      secret,
    );
    assertDeepFrozen(operation.issues);
  });

  it('redacts configured capabilities from dynamic paths and forwarded Core diagnostics', () => {
    const secret = CAPABILITIES[0];

    const direct = JSON.parse(JSON.stringify(createRoom())) as Record<string, unknown> & {
      seats: unknown[];
    };
    Object.defineProperty(direct, secret, { enumerable: true, value: true });
    Object.defineProperty(direct.seats, secret, { enumerable: true, value: true });
    const directIssues = validationIssues(direct);
    expect(directIssues.filter((issue) => issue.code === 'UNKNOWN_FIELD')).toEqual([
      {
        code: 'UNKNOWN_FIELD',
        path: '/<redacted-capability>',
        message: 'Unknown field',
      },
      {
        code: 'UNKNOWN_FIELD',
        path: '/seats/<redacted-capability>',
        message: 'Unknown array property',
      },
    ]);
    expect(JSON.stringify(directIssues)).not.toContain(secret);

    const creationInput: Record<string, unknown> = {
      roomId: 'room-creation-redaction',
      seatAssignments: CAPABILITIES.map((seatCapability, seatIndex) => ({
        seatIndex,
        corePlayerId: `P${seatIndex + 1}`,
        seatCapability,
      })),
      host: { participantId: PARTICIPANTS[0], seatCapability: secret },
    };
    Object.defineProperty(creationInput, secret, { enumerable: true, value: true });
    const creation = creationError(() => createOnlineRoomV1(creationInput));
    expect(creation.issues).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/<redacted-capability>' }),
    ]);
    expect(JSON.stringify({ message: creation.message, issues: creation.issues })).not.toContain(
      secret,
    );

    const joinInput: Record<string, unknown> = {
      participantId: 'observer-redaction',
      role: 'spectator',
    };
    Object.defineProperty(joinInput, secret, { enumerable: true, value: true });
    const join = operationError(() => joinOnlineRoomV1(createRoom(), joinInput));
    expect(join.issues).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/<redacted-capability>' }),
    ]);
    expect(JSON.stringify({ message: join.message, issues: join.issues })).not.toContain(secret);

    const coreRoot = { ...makeCoreRoot() } as Record<string, unknown>;
    Object.defineProperty(coreRoot, secret, { enumerable: true, value: true });
    const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
    const activation = operationError(() =>
      activateOnlineRoomV1(started, {
        hostParticipantId: PARTICIPANTS[0],
        coreRoot,
      }),
    );
    expect(activation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_CORE_ROOT',
          path: '/coreRoot/<redacted-capability>',
        }),
      ]),
    );
    expect(
      JSON.stringify({ message: activation.message, issues: activation.issues }),
    ).not.toContain(secret);
  });

  it('does not mutate caller input on failed operations and returns fresh roots on success', () => {
    const room = joinAllPlayers();
    const before = JSON.stringify(room);
    const failure = operationError(() =>
      setOnlineRoomPlayerReadyV1(room, {
        participantId: PARTICIPANTS[1],
        seatCapability: CAPABILITIES[2],
        ready: true,
      }),
    );
    expect(failure.issues).toEqual([
      expect.objectContaining({ code: 'CAPABILITY_REJECTED', path: '/seatCapability' }),
    ]);
    expect(JSON.stringify(room)).toBe(before);

    const next = setOnlineRoomPlayerReadyV1(room, {
      participantId: PARTICIPANTS[1],
      seatCapability: CAPABILITIES[1],
      ready: true,
    });
    expect(next).not.toBe(room);
    expect(next.participants).not.toBe(room.participants);
    expect(next.seats).not.toBe(room.seats);
    expect(room.seats[1]?.ready).toBe(false);
    expect(next.seats[1]?.ready).toBe(true);
    assertDeepFrozen(next);
  });

  it('does not invoke operation-input getters and returns only the frozen typed error', () => {
    let getterCalled = false;
    const input = { participantId: 'new-player', role: 'player' } as Record<string, unknown>;
    Object.defineProperty(input, 'seatCapability', {
      enumerable: true,
      get(): string {
        getterCalled = true;
        return CAPABILITIES[1];
      },
    });
    const error = operationError(() => joinOnlineRoomV1(createRoom(), input));
    expect(getterCalled).toBe(false);
    expect(error.issues).toEqual([
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/seatCapability' }),
    ]);
    expect(Object.isFrozen(error)).toBe(true);
  });

  it('property-checks canonical round trips and rejects every duplicated seat capability', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc
            .stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,20}$/)
            .filter((value) => !['__proto__', 'prototype', 'constructor'].includes(value)),
          fc.integer({ min: 0, max: 3 }),
          fc.integer({ min: 0, max: 3 }),
        ),
        ([roomId, leftIndex, rightIndex]) => {
          const room = createOnlineRoomV1({
            roomId,
            seatAssignments: [
              { seatIndex: 0, corePlayerId: 'P1', seatCapability: CAPABILITIES[0] },
              { seatIndex: 1, corePlayerId: 'P2', seatCapability: CAPABILITIES[1] },
              { seatIndex: 2, corePlayerId: 'P3', seatCapability: CAPABILITIES[2] },
              { seatIndex: 3, corePlayerId: 'P4', seatCapability: CAPABILITIES[3] },
            ],
            host: { participantId: 'host', seatCapability: CAPABILITIES[0] },
          });
          const roundTrip = validateOnlineRoomV1(JSON.parse(JSON.stringify(room)) as unknown);
          expect(roundTrip).toMatchObject({ ok: true, value: room });

          const invalid = JSON.parse(JSON.stringify(room)) as {
            seats: Array<{ seatCapability: string }>;
          };
          if (leftIndex === rightIndex) {
            invalid.seats[rightIndex].seatCapability =
              invalid.seats[(rightIndex + 1) % 4].seatCapability;
          } else {
            invalid.seats[rightIndex].seatCapability = invalid.seats[leftIndex].seatCapability;
          }
          expect(
            validationIssues(invalid).some((issue) => issue.code === 'DUPLICATE_CAPABILITY'),
          ).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});
