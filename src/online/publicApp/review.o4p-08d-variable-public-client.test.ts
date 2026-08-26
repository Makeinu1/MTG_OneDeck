import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicOnlineControllerV3,
  encodeOnlineSharedInviteCodeV3,
  validatePublicOnlineProjectionV3,
} from './index';

const ROOM_ID = 'room-o4p08d-public-review';
const HOST = 'participant-o4p08d-public-host';
const SEAT = `seat_${'s'.repeat(40)}`;
const TABLE = 'table-o4p08d-public-review';
const TABLE_CAPABILITY = `observer_${'t'.repeat(40)}`;
const ADMISSION = `admission_${'a'.repeat(40)}`;
const INVITE = encodeOnlineSharedInviteCodeV3(ROOM_ID, ADMISSION);

function projection(playerCount: 2 | 4, startingLife: 20 | 40) {
  return {
    kind: 'online-forming-lobby-projection-v4' as const,
    schemaVersion: 4 as const,
    lifecycle: 'forming' as const,
    roomId: ROOM_ID,
    serverBuildId: 'o4p-08d-public-review-build',
    hostParticipantId: HOST,
    configuration: { playerCount, startingLife },
    seats: Array.from({ length: playerCount }, (_, index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? HOST : null,
      acceptedDeck: false,
      ready: false,
    })),
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') throw new Error('Expected body');
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('O4P-08D Judge: public variable-room client', () => {
  it.each([[2, 20], [2, 40], [4, 40]] as const)(
    'creates exact %i-player/%i-life v5 and preserves authoritative configuration',
    async (playerCount, startingLife) => {
      vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        const sent = requestBody(init);
        expect(Object.keys(sent).sort()).toEqual([
          'kind', 'participantId', 'playerCount', 'schemaVersion', 'startingLife',
        ]);
        expect(sent).toMatchObject({
          kind: 'online-forming-lobby-create-v5',
          schemaVersion: 5,
          playerCount,
          startingLife,
        });
        const participantId = String(sent.participantId);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-created-v5',
          schemaVersion: 5,
          roomId: ROOM_ID,
          participantId,
          playerCount,
          startingLife,
          seatCapability: SEAT,
          inviteCode: INVITE,
          tableParticipantId: TABLE,
          tableCapability: TABLE_CAPABILITY,
          projection: { ...projection(playerCount, startingLife), hostParticipantId: participantId,
            seats: projection(playerCount, startingLife).seats.map((seat, index) =>
              index === 0 ? { ...seat, participantId } : seat),
          },
        }));
      }));
      const controller = createPublicOnlineControllerV3();
      await controller.createShared({ playerCount, startingLife });
      expect(controller.getSnapshot()).toMatchObject({
        mode: 'forming',
        configuration: { playerCount, startingLife },
        invites: [INVITE],
      });
      const stored = localStorage.getItem('mtg-onedeck:online-recovery-v2');
      expect(stored).not.toBeNull();
      expect(stored).not.toContain(ADMISSION.slice(-8));
      expect(stored).not.toContain(INVITE);
      expect(stored).toContain('variable-v5');
      controller.disconnect();
    },
  );

  it('validates exact dense configured seats and rejects phantom or surplus seats', () => {
    expect(validatePublicOnlineProjectionV3(projection(2, 20))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3(projection(4, 40))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3({
      ...projection(2, 20),
      seats: projection(4, 40).seats,
    })).toMatchObject({ ok: false });
    expect(validatePublicOnlineProjectionV3({
      ...projection(4, 40),
      configuration: { playerCount: 4, startingLife: 20 },
    })).toMatchObject({ ok: false });
    expect(validatePublicOnlineProjectionV3({ ...projection(2, 20), extra: true }))
      .toMatchObject({ ok: false });
    const sparse = projection(2, 20).seats.slice();
    expect(Reflect.deleteProperty(sparse, '1')).toBe(true);
    expect(validatePublicOnlineProjectionV3({ ...projection(2, 20), seats: sparse }))
      .toMatchObject({ ok: false });
    const nonEnumerable = { ...projection(2, 20) };
    Object.defineProperty(nonEnumerable, 'hidden', { enumerable: false, value: true });
    expect(validatePublicOnlineProjectionV3(nonEnumerable)).toMatchObject({ ok: false });
    const symbol = { ...projection(2, 20), [Symbol('hidden')]: true };
    expect(validatePublicOnlineProjectionV3(symbol)).toMatchObject({ ok: false });
  });

  it('reconstructs and freezes validated configuration instead of retaining server-owned objects', () => {
    const candidate = projection(2, 20);
    const checked = validatePublicOnlineProjectionV3(candidate);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error('Expected a valid projection');
    candidate.configuration.startingLife = 40;
    expect(checked.value.configuration).toEqual({ playerCount: 2, startingLife: 20 });
    expect(Object.isFrozen(checked.value.configuration)).toBe(true);
  });

  it('rejects create and join responses that assign the caller the wrong host authority', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = requestBody(init);
      const participantId = String(sent.participantId);
      if (sent.kind === 'online-forming-lobby-create-v5') {
        const lobby = projection(2, 40);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5,
          roomId: ROOM_ID, participantId, playerCount: 2, startingLife: 40,
          seatCapability: SEAT, inviteCode: INVITE,
          tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
          projection: {
            ...lobby,
            seats: [lobby.seats[0], { ...lobby.seats[1], participantId }],
          },
        }));
      }
      const lobby = projection(2, 40);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-shared-claimed-v4', schemaVersion: 4,
        roomId: ROOM_ID, participantId, seatCapability: SEAT,
        projection: {
          ...lobby,
          hostParticipantId: participantId,
          seats: [{ ...lobby.seats[0], participantId }, lobby.seats[1]],
        },
      }));
    }));

    const creator = createPublicOnlineControllerV3();
    await creator.createShared({ playerCount: 2, startingLife: 40 });
    expect(creator.getSnapshot()).toMatchObject({ mode: 'entry', roomId: null });
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v2')).toBeNull();
    creator.disconnect();

    const joiner = createPublicOnlineControllerV3();
    await joiner.joinShared(INVITE);
    expect(joiner.getSnapshot()).toMatchObject({ mode: 'entry', roomId: null });
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v2')).toBeNull();
    joiner.disconnect();
  });

  it('recovers a variable record through exact v5 without invitation disclosure', async () => {
    localStorage.setItem('mtg-onedeck:online-recovery-v2', JSON.stringify({
      kind: 'public-online-recovery-v2',
      schemaVersion: 2,
      wireGeneration: 'variable-v5',
      roomId: ROOM_ID,
      participantId: HOST,
      seatCapability: SEAT,
      isHost: true,
      tableParticipantId: TABLE,
      tableCapability: TABLE_CAPABILITY,
    }));
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      expect(requestBody(init)).toEqual({
        kind: 'online-forming-lobby-recover-v5',
        schemaVersion: 5,
        participantId: HOST,
        seatCapability: SEAT,
      });
      return Promise.resolve(response({
        kind: 'online-forming-lobby-recovered-v5',
        schemaVersion: 5,
        roomId: ROOM_ID,
        participantId: HOST,
        playerCount: 2,
        startingLife: 20,
        admissionOpen: true,
        inviteCode: INVITE,
        tableParticipantId: TABLE,
        tableCapability: TABLE_CAPABILITY,
        projection: projection(2, 20),
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      configuration: { playerCount: 2, startingLife: 20 },
      ownSeatIndex: 0,
    });
    expect(JSON.stringify(controller.getSnapshot().projection)).not.toMatch(
      /(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/,
    );
    controller.disconnect();
  });

  it('rejects a later recovery response that moves the same participant to another seat', async () => {
    const guest = 'participant-o4p08d-public-guest';
    localStorage.setItem('mtg-onedeck:online-recovery-v2', JSON.stringify({
      kind: 'public-online-recovery-v2', schemaVersion: 2, wireGeneration: 'variable-v5',
      roomId: ROOM_ID, participantId: guest, seatCapability: SEAT, isHost: false,
      tableParticipantId: null, tableCapability: null,
    }));
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      calls += 1;
      const lobby = projection(4, 40);
      const guestSeat = calls === 1 ? 1 : 2;
      return Promise.resolve(response({
        kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5,
        roomId: ROOM_ID, participantId: guest, playerCount: 4, startingLife: 40,
        projection: {
          ...lobby,
          seats: lobby.seats.map((seatValue, index) =>
            index === guestSeat ? { ...seatValue, participantId: guest } : seatValue),
        },
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({ ownSeatIndex: 1, error: null });
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({ ownSeatIndex: 1 });
    expect(controller.getSnapshot().error).not.toBeNull();
    controller.disconnect();
  });

  it('rejects a later recovery response that changes the established room configuration', async () => {
    const guest = 'participant-o4p08d-public-guest';
    localStorage.setItem('mtg-onedeck:online-recovery-v2', JSON.stringify({
      kind: 'public-online-recovery-v2', schemaVersion: 2, wireGeneration: 'variable-v5',
      roomId: ROOM_ID, participantId: guest, seatCapability: SEAT, isHost: false,
      tableParticipantId: null, tableCapability: null,
    }));
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      calls += 1;
      const lobby = projection(calls === 1 ? 2 : 4, 40);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5,
        roomId: ROOM_ID, participantId: guest,
        playerCount: lobby.configuration.playerCount, startingLife: 40,
        projection: {
          ...lobby,
          seats: lobby.seats.map((seatValue, index) =>
            index === 1 ? { ...seatValue, participantId: guest } : seatValue),
        },
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      ownSeatIndex: 1, configuration: { playerCount: 2, startingLife: 40 }, error: null,
    });
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      ownSeatIndex: 1, configuration: { playerCount: 2, startingLife: 40 },
    });
    expect(controller.getSnapshot().error).not.toBeNull();
    controller.disconnect();
  });

  it('preserves structured cause, retry, correlation, timeout, and response secrecy', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return Promise.resolve(response({
        kind: 'online-public-error-v3',
        schemaVersion: 3,
        code: 'SERVICE_UNAVAILABLE',
        retryable: true,
        correlationId: 'correlation-o4p08d-service',
      }, 503));
      const sent = requestBody(init);
      const participantId = String(sent.participantId);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-created-v5', schemaVersion: 5,
        roomId: ROOM_ID, participantId, playerCount: 2, startingLife: 40,
        seatCapability: SEAT, inviteCode: INVITE,
        tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
        projection: {
          ...projection(2, 40), hostParticipantId: participantId,
          seats: projection(2, 40).seats.map((seatValue, index) =>
            index === 0 ? { ...seatValue, participantId } : seatValue),
        },
      }));
    }));
    const retrying = createPublicOnlineControllerV3();
    await retrying.createShared({ playerCount: 2, startingLife: 40 });
    expect(retrying.getSnapshot().errorIssue).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
      message: 'サーバーに接続できません。しばらく待って再試行してください。',
      correlationId: 'correlation-o4p08d-service',
      action: 'もう一度部屋を作る',
    });
    await retrying.retry();
    expect(retrying.getSnapshot()).toMatchObject({ mode: 'forming', error: null });
    retrying.disconnect();

    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
    ));
    const timeout = createPublicOnlineControllerV3();
    const pending = timeout.createShared({ playerCount: 2, startingLife: 20 });
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    expect(timeout.getSnapshot().errorIssue).toMatchObject({
      code: 'CLIENT_TIMEOUT', retryable: true, action: 'もう一度部屋を作る',
    });
    timeout.disconnect();

    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(streamController) {
          init?.signal?.addEventListener('abort', () =>
            streamController.error(new DOMException('aborted', 'AbortError')),
          );
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })),
    ));
    const bodyTimeout = createPublicOnlineControllerV3();
    const bodyPending = bodyTimeout.createShared({ playerCount: 2, startingLife: 40 });
    await vi.advanceTimersByTimeAsync(15_000);
    await bodyPending;
    expect(bodyTimeout.getSnapshot().errorIssue).toMatchObject({ code: 'CLIENT_TIMEOUT' });
    bodyTimeout.disconnect();
  });

  it('fails a 40-life start closed when the required Pregame projection is absent', async () => {
    const guestId = 'participant-o4p08d-public-guest';
    let participantId = '';
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = requestBody(init);
      if (sent.kind === 'online-forming-lobby-create-v5') {
        participantId = String(sent.participantId);
        const lobby = projection(2, 40);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5,
          roomId: ROOM_ID, participantId, playerCount: 2, startingLife: 40,
          seatCapability: SEAT, inviteCode: INVITE,
          tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
          projection: {
            ...lobby, hostParticipantId: participantId,
            seats: [
              { ...lobby.seats[0], participantId, acceptedDeck: true, ready: false },
              { ...lobby.seats[1], participantId: guestId, acceptedDeck: true, ready: true },
            ],
          },
        }));
      }
      if (sent.kind === 'online-forming-lobby-ready-v4') {
        expect(sent).toMatchObject({ schemaVersion: 4, participantId, ready: true });
        const lobby = projection(2, 40);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-ready-v4', schemaVersion: 4, roomId: ROOM_ID,
          projection: {
            ...lobby, lifecycle: 'ready', hostParticipantId: participantId,
            seats: [
              { ...lobby.seats[0], participantId, acceptedDeck: true, ready: true },
              { ...lobby.seats[1], participantId: guestId, acceptedDeck: true, ready: true },
            ],
          },
        }));
      }
      expect(sent).toMatchObject({
        kind: 'online-forming-lobby-start-v4', schemaVersion: 4,
        hostParticipantId: participantId, seatCapability: SEAT,
      });
      return Promise.resolve(response({
        kind: 'online-cloudflare-room-status-v2', schemaVersion: 2,
        roomId: ROOM_ID, playerCount: 2, startingLife: 40,
        revision: 0, roomLifecycle: 'active',
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    await controller.toggleReady();
    expect(controller.getSnapshot().lifecycle).toBe('ready');
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'forming', lifecycle: 'ready', configuration: { playerCount: 2, startingLife: 40 },
      player: null,
    });
    expect(controller.getSnapshot().error).not.toBeNull();
    controller.disconnect();
  });

  it('keeps legacy v1 recovery readable through exact v4 as four-player 40', async () => {
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify({
      kind: 'public-online-recovery-v1', schemaVersion: 1,
      roomId: ROOM_ID, participantId: HOST, seatCapability: SEAT, isHost: true,
      tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
    }));
    const legacyProjection = {
      kind: 'online-forming-lobby-projection-v2', schemaVersion: 2,
      lifecycle: 'forming', roomId: ROOM_ID,
      serverBuildId: 'o4p-08d-public-review-build', hostParticipantId: HOST,
      seats: [0, 1, 2, 3].map((index) => ({
        seatIndex: index, corePlayerId: `P${index + 1}`,
        participantId: index === 0 ? HOST : null,
        deckState: 'none', ready: false,
      })),
    };
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      expect(requestBody(init)).toEqual({
        kind: 'online-forming-lobby-recover-v4', schemaVersion: 4,
        participantId: HOST, seatCapability: SEAT,
      });
      return Promise.resolve(response({
        kind: 'online-forming-lobby-recovered-v4', schemaVersion: 4,
        roomId: ROOM_ID, participantId: HOST, seatCapability: SEAT,
        admissionOpen: true, inviteCode: INVITE,
        tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
        projection: legacyProjection,
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    expect(controller.getSnapshot().recoveryAvailable).toBe(true);
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'forming', configuration: { playerCount: 4, startingLife: 40 }, ownSeatIndex: 0,
    });
    expect(controller.getSnapshot().projection?.seats).toHaveLength(4);
    controller.disconnect();
  });

  it('preserves legacy guest recovery with null table authority', async () => {
    const legacyHost = 'participant-o4p08d-legacy-host';
    const legacyGuest = 'participant-o4p08d-legacy-guest';
    const guestSeat = `seat_${'g'.repeat(40)}`;
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify({
      kind: 'public-online-recovery-v1', schemaVersion: 1,
      roomId: ROOM_ID, participantId: legacyGuest, seatCapability: guestSeat, isHost: false,
      tableParticipantId: null, tableCapability: null,
    }));
    const legacyProjection = {
      kind: 'online-forming-lobby-projection-v2', schemaVersion: 2,
      lifecycle: 'forming', roomId: ROOM_ID,
      serverBuildId: 'o4p-08d-public-review-build', hostParticipantId: legacyHost,
      seats: [0, 1, 2, 3].map((index) => ({
        seatIndex: index, corePlayerId: `P${index + 1}`,
        participantId: index === 0 ? legacyHost : index === 1 ? legacyGuest : null,
        deckState: 'none', ready: false,
      })),
    };
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      expect(requestBody(init)).toEqual({
        kind: 'online-forming-lobby-recover-v4', schemaVersion: 4,
        participantId: legacyGuest, seatCapability: guestSeat,
      });
      return Promise.resolve(response({
        kind: 'online-forming-lobby-recovered-v4', schemaVersion: 4,
        roomId: ROOM_ID, participantId: legacyGuest, seatCapability: guestSeat,
        projection: legacyProjection,
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.recover();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'forming', isHost: false, ownSeatIndex: 1,
      configuration: { playerCount: 4, startingLife: 40 },
    });
    controller.disconnect();
  });

  it('closes admission authoritatively and retains recovery after retryable leave failure', async () => {
    let participantId = '';
    let phase: 'create' | 'close' | 'leave-fail' | 'leave-pass' = 'create';
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = requestBody(init);
      if (phase === 'create') {
        participantId = String(sent.participantId);
        phase = 'close';
        const lobby = projection(2, 40);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5,
          roomId: ROOM_ID, participantId, playerCount: 2, startingLife: 40,
          seatCapability: SEAT, inviteCode: INVITE,
          tableParticipantId: TABLE, tableCapability: TABLE_CAPABILITY,
          projection: {
            ...lobby, hostParticipantId: participantId,
            seats: lobby.seats.map((seatValue, index) =>
              index === 0 ? { ...seatValue, participantId } : seatValue),
          },
        }));
      }
      if (phase === 'close') {
        expect(sent).toMatchObject({
          kind: 'online-forming-lobby-admission-close-v3', schemaVersion: 3,
          hostParticipantId: participantId,
        });
        phase = 'leave-fail';
        const lobby = projection(2, 40);
        return Promise.resolve(response({
          kind: 'online-forming-lobby-admission-closed-v3', schemaVersion: 3,
          roomId: ROOM_ID,
          projection: {
            ...lobby, hostParticipantId: participantId,
            seats: lobby.seats.map((seatValue, index) =>
              index === 0 ? { ...seatValue, participantId } : seatValue),
          },
        }));
      }
      if (phase === 'leave-fail') {
        expect(sent.kind).toBe('online-forming-lobby-leave-v3');
        phase = 'leave-pass';
        return Promise.resolve(response({
          kind: 'online-public-error-v3', schemaVersion: 3,
          code: 'SERVICE_UNAVAILABLE', retryable: true,
          correlationId: 'correlation-o4p08d-leave',
        }, 503));
      }
      expect(sent.kind).toBe('online-forming-lobby-leave-v3');
      return Promise.resolve(response({
        kind: 'online-forming-lobby-left-v3', schemaVersion: 3,
        roomId: ROOM_ID, closed: true,
      }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    await controller.closeAdmission();
    expect(controller.getSnapshot()).toMatchObject({ admissionOpen: false, invites: [] });
    await controller.leave();
    expect(controller.getSnapshot().errorIssue).toMatchObject({
      code: 'SERVICE_UNAVAILABLE', retryable: true, action: 'もう一度退出',
    });
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v2')).not.toBeNull();
    await controller.retry();
    expect(localStorage.getItem('mtg-onedeck:online-recovery-v2')).toBeNull();
    expect(controller.getSnapshot().mode).toBe('entry');
    controller.disconnect();
  });
});
