import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicOnlineControllerV3, encodeOnlineSharedInviteCodeV3, validatePublicOnlineProjectionV3, type PublicOnlineDeckOptionV2 } from './index';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function projection(playerCount: 2 | 4, startingLife: 20 | 40): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v4',
    schemaVersion: 4,
    lifecycle: 'forming',
    roomId: 'room-v3-ordinary-test',
    serverBuildId: 'o4p-08d-test-build',
    hostParticipantId: 'participant-v3-host',
    configuration: { playerCount, startingLife },
    seats: Array.from({ length: playerCount }, (_, index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? 'participant-v3-host' : null,
      acceptedDeck: false,
      ready: false,
    })),
  };
}

describe('public variable-room client v3', () => {
  it('accepts exact 2/20, 2/40, and 4/40 configurations', () => {
    expect(validatePublicOnlineProjectionV3(projection(2, 20))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3(projection(2, 40))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3(projection(4, 40))).toMatchObject({ ok: true });
  });

  it('rejects a four-player 20-life or surplus-seat projection', () => {
    expect(validatePublicOnlineProjectionV3(projection(4, 20))).toMatchObject({ ok: false });
    expect(validatePublicOnlineProjectionV3({ ...projection(2, 20), seats: projection(4, 40).seats })).toMatchObject({ ok: false });
  });

  it('projects deck issues into ownerIssue and verifies the v2 result envelope', async () => {
    const roomId = 'room-v3-deck-test';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'a'.repeat(40)}`);
    let participantId = '';
    const lobby = projection(2, 40);
    const lobbySeats = lobby.seats as readonly Record<string, unknown>[];
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        participantId = String(body.participantId);
        return Promise.resolve(new Response(JSON.stringify({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId,
          playerCount: 2, startingLife: 40, seatCapability: `seat_${'s'.repeat(40)}`, inviteCode,
          tableParticipantId: 'table-v3-deck-test', tableCapability: `observer_${'t'.repeat(40)}`,
          projection: { ...lobby, roomId, hostParticipantId: participantId,
            seats: [{ ...lobbySeats[0], participantId }, lobbySeats[1]] },
        }), { status: 200 }));
      }
      const submissionId = String(body.submissionId);
      return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId,
        state: 'needs-attention', issues: [{ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: true }],
        projection: { ...lobby, roomId, hostParticipantId: participantId,
          seats: [{ ...lobbySeats[0], participantId }, lobbySeats[1]] },
      }), { status: 200 }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    const deck = {
      id: 'deck-v3-test', name: 'Test', entries: [{ section: 'main', quantity: 40,
        card: { scryfallId: 'sid-v3-test', oracleId: 'oid-v3-test' } }],
    } as unknown as PublicOnlineDeckOptionV2;
    await controller.submitDeck(deck);
    expect(controller.getSnapshot().ownerIssue).toMatchObject({ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: true });
    controller.disconnect();
  });
});
