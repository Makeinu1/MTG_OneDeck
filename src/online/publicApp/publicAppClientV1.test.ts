import { describe, expect, it, vi } from 'vitest';
import {
  createPublicOnlineControllerV1,
  validatePublicOnlineProjectionV1,
} from './index';

const ROOM_ID = 'room-public-client';
const BUILD_ID = 'build-public-client';
const SEAT_CAPABILITY = 'seat_' + 'A'.repeat(40);
const INVITES = ['invite_' + 'B'.repeat(40), 'invite_' + 'C'.repeat(40), 'invite_' + 'D'.repeat(40)] as const;
const TABLE_CAPABILITY = 'observer_' + 'E'.repeat(40);

function seatsOf(value: Record<string, unknown>): unknown[] {
  return value.seats as unknown[];
}

function projection(hostParticipantId: string, deckId: string | null = null, lifecycle: 'forming' | 'ready' | 'started' = 'forming'): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v1',
    schemaVersion: 1,
    lifecycle,
    roomId: ROOM_ID,
    serverBuildId: BUILD_ID,
    hostParticipantId,
    seats: [0, 1, 2, 3].map((seatIndex) => ({
      seatIndex,
      corePlayerId: `P${seatIndex + 1}`,
      participantId: seatIndex === 0 ? hostParticipantId : null,
      deckId: seatIndex === 0 ? deckId : null,
      deckSubmitted: seatIndex === 0 && deckId !== null,
      ready: false,
    })),
  };
}

function createdBody(hostParticipantId: string, deckId: string | null = null): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-created-v1',
    schemaVersion: 1,
    roomId: ROOM_ID,
    seatCapability: SEAT_CAPABILITY,
    inviteCapabilities: [...INVITES],
    tableParticipantId: 'table-public-client',
    tableCapability: TABLE_CAPABILITY,
    projection: projection(hostParticipantId, deckId),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

describe('public online client boundary', () => {
  it('copies dense response arrays and rejects hostile own keys, accessors, symbols, and proxies', () => {
    const baseline = projection('host-public-client');
    expect(validatePublicOnlineProjectionV1(baseline).ok).toBe(true);

    const extraKey = projection('host-public-client');
    Object.defineProperty(seatsOf(extraKey), '01', { value: seatsOf(extraKey)[0], enumerable: true });
    expect(validatePublicOnlineProjectionV1(extraKey).ok).toBe(false);

    const sparse = projection('host-public-client');
    Reflect.deleteProperty(seatsOf(sparse), '2');
    expect(validatePublicOnlineProjectionV1(sparse).ok).toBe(false);

    const accessor = projection('host-public-client');
    Object.defineProperty(seatsOf(accessor), '1', { enumerable: true, get: () => { throw new Error('indexed getter must not run'); } });
    expect(validatePublicOnlineProjectionV1(accessor).ok).toBe(false);

    const symbolKey = projection('host-public-client');
    Object.defineProperty(seatsOf(symbolKey), Symbol('extra'), { value: 'unexpected', enumerable: true });
    expect(validatePublicOnlineProjectionV1(symbolKey).ok).toBe(false);

    const oversized = projection('host-public-client');
    Object.defineProperty(seatsOf(oversized), 'length', { value: 5 });
    expect(validatePublicOnlineProjectionV1(oversized).ok).toBe(false);

    let indexedGet = false;
    const proxiedSeats = new Proxy(baseline.seats as unknown[], {
      get(target, key, receiver) {
        if (key === '0' || key === '1' || key === '2' || key === '3') indexedGet = true;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const proxied = { ...baseline, seats: proxiedSeats };
    expect(validatePublicOnlineProjectionV1(proxied).ok).toBe(true);
    expect(indexedGet).toBe(false);
  });

  it('does not publish a room after disconnect races deferred response parsing', async () => {
    let releaseText: ((text: string) => void) | undefined;
    const body = createdBody('host-public-client');
    const response = jsonResponse(body);
    const deferredText = new Promise<string>((resolve) => { releaseText = resolve; });
    Object.defineProperty(response, 'text', { value: () => deferredText });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const controller = createPublicOnlineControllerV1();
    const creating = controller.create();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.disconnect();
    releaseText?.(JSON.stringify(body));
    await creating;
    expect(controller.getSnapshot().mode).toBe('entry');
    expect(controller.getSnapshot().roomId).toBeNull();
    expect(controller.getSnapshot().projection).toBeNull();
    vi.unstubAllGlobals();
  });

  it('guards duplicate create synchronously and rejects configured secret fragments', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) as { participantId: string } : { participantId: 'host-public-client' };
      return Promise.resolve(jsonResponse(createdBody(requestBody.participantId)));
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = createPublicOnlineControllerV1();
    const first = controller.create();
    const second = controller.create();
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().mode).toBe('forming');
    expect(controller.getSnapshot().busy).toBeNull();

    controller.disconnect();
    const leakingFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) as { participantId: string } : { participantId: 'host-public-client' };
      return Promise.resolve(jsonResponse(createdBody(requestBody.participantId, `deck-${SEAT_CAPABILITY.slice(0, 8)}`)));
    });
    vi.stubGlobal('fetch', leakingFetch);
    await controller.create();
    expect(leakingFetch).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().mode).toBe('failed');
    expect(controller.getSnapshot().roomId).toBeNull();
    expect(controller.getSnapshot().projection).toBeNull();
    vi.unstubAllGlobals();
  });
});
