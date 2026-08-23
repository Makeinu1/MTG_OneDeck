import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicOnlineControllerV2, encodeOnlineSharedInviteCodeV3 } from './index';

const ROOM_ID = 'room-o4p08b-controller-review';
const HOST_SEAT = `seat_${'h'.repeat(40)}`;
const TABLE_ID = 'table-o4p08b-controller-review';
const TABLE_CAPABILITY = `observer_${'t'.repeat(40)}`;
const ADMISSION_A = `admission_${'a'.repeat(40)}`;
const ADMISSION_B = `admission_${'b'.repeat(40)}`;
const INVITE_A = encodeOnlineSharedInviteCodeV3(ROOM_ID, ADMISSION_A);
const INVITE_B = encodeOnlineSharedInviteCodeV3(ROOM_ID, ADMISSION_B);

function projection(hostId: string, guest = true) {
  return {
    kind: 'online-forming-lobby-projection-v2' as const,
    schemaVersion: 2 as const,
    lifecycle: 'forming' as const,
    roomId: ROOM_ID,
    serverBuildId: 'build-o4p08b-controller-review',
    hostParticipantId: hostId,
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? hostId : index === 1 && guest ? 'guest-o4p08b-controller-review' : null,
      deckState: index === 1 && guest ? 'accepted' : 'none',
      ready: index === 1 && guest,
    })),
  };
}

function created(hostId: string) {
  return {
    kind: 'online-forming-lobby-created-v3' as const,
    schemaVersion: 3 as const,
    roomId: ROOM_ID,
    participantId: hostId,
    seatCapability: HOST_SEAT,
    inviteCode: INVITE_A,
    tableParticipantId: TABLE_ID,
    tableCapability: TABLE_CAPABILITY,
    projection: projection(hostId),
  };
}

function response(value: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), {
    status,
    headers: { 'content-type': contentType },
  });
}

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') throw new Error('Expected request body');
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('O4P-08B Judge: production controller journey', () => {
  it('rotates, kicks, and closes through exact authoritative v3 operations', async () => {
    let hostId = '';
    const kinds: string[] = [];
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = requestBody(init);
      kinds.push(String(sent.kind));
      if (sent.kind === 'online-forming-lobby-create-v3') {
        hostId = String(sent.participantId);
        return Promise.resolve(response(created(hostId)));
      }
      if (sent.kind === 'online-forming-lobby-admission-rotate-v3') {
        return Promise.resolve(response({
          kind: 'online-forming-lobby-admission-rotated-v3', schemaVersion: 3,
          roomId: ROOM_ID, inviteCode: INVITE_B, projection: projection(hostId),
        }));
      }
      if (sent.kind === 'online-forming-lobby-kick-v3') {
        expect(sent.targetParticipantId).toBe('guest-o4p08b-controller-review');
        return Promise.resolve(response({
          kind: 'online-forming-lobby-kicked-v3', schemaVersion: 3,
          roomId: ROOM_ID, projection: projection(hostId, false),
        }));
      }
      expect(sent.kind).toBe('online-forming-lobby-admission-close-v3');
      return Promise.resolve(response({
        kind: 'online-forming-lobby-admission-closed-v3', schemaVersion: 3,
        roomId: ROOM_ID, projection: projection(hostId, false),
      }));
    }));

    const controller = createPublicOnlineControllerV2();
    await controller.createShared();
    await controller.rotateInvite();
    expect(controller.getSnapshot()).toMatchObject({ invites: [INVITE_B], admissionOpen: true });
    await controller.kick('guest-o4p08b-controller-review');
    expect(controller.getSnapshot().projection?.seats[1]?.participantId).toBeNull();
    await controller.closeAdmission();
    expect(controller.getSnapshot()).toMatchObject({ invites: [], admissionOpen: false });
    expect(kinds).toEqual([
      'online-forming-lobby-create-v3',
      'online-forming-lobby-admission-rotate-v3',
      'online-forming-lobby-kick-v3',
      'online-forming-lobby-admission-close-v3',
    ]);
    controller.disconnect();
  });

  it('preserves server cause/retry/correlation and retries the responsible create action', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return Promise.resolve(response({
        kind: 'online-public-error-v3', schemaVersion: 3,
        code: 'SERVICE_UNAVAILABLE', retryable: true,
        correlationId: 'correlation-o4p08b-service',
      }, 503));
      const sent = requestBody(init);
      return Promise.resolve(response(created(String(sent.participantId))));
    }));
    const controller = createPublicOnlineControllerV2();
    await controller.createShared();
    expect(controller.getSnapshot().errorIssue).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
      message: 'サーバーに接続できません。しばらく待って再試行してください。',
      correlationId: 'correlation-o4p08b-service',
      action: 'もう一度部屋を作る',
    });
    await controller.retry();
    expect(controller.getSnapshot()).toMatchObject({ mode: 'forming', error: null, errorIssue: null });
    expect(calls).toBe(2);
    controller.disconnect();
  });

  it('distinguishes offline and invalid responses with privacy-safe local correlation IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    const offline = createPublicOnlineControllerV2();
    await offline.createShared();
    expect(offline.getSnapshot().errorIssue).toMatchObject({
      code: 'CLIENT_OFFLINE', retryable: true, action: 'もう一度部屋を作る',
    });
    expect(offline.getSnapshot().errorIssue?.correlationId).toMatch(/^local_[A-Za-z0-9_-]+$/);
    offline.disconnect();

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response('<html>bad</html>', 200, 'text/html'))));
    const invalid = createPublicOnlineControllerV2();
    await invalid.createShared();
    expect(invalid.getSnapshot().errorIssue).toMatchObject({
      code: 'CLIENT_INVALID_RESPONSE', retryable: false,
    });
    invalid.disconnect();
  });

  it('distinguishes a bounded timeout from offline failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    ));
    const controller = createPublicOnlineControllerV2();
    const pending = controller.createShared();
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    expect(controller.getSnapshot().errorIssue).toMatchObject({
      code: 'CLIENT_TIMEOUT', retryable: true, action: 'もう一度部屋を作る',
    });
    controller.disconnect();
  });
});
