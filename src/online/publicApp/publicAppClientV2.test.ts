import { describe, expect, it, vi } from 'vitest';
import type { PublicOnlineDeckOptionV2 } from './types';
import { createPublicOnlineControllerV2, validatePublicOnlineProjectionV2 } from './v2';

function projection(): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v2',
    schemaVersion: 2,
    lifecycle: 'forming',
    roomId: 'room-v2',
    serverBuildId: 'build-v2',
    hostParticipantId: 'player-1',
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? 'player-1' : null,
      deckState: 'none',
      ready: false,
    })),
  };
}

describe('public online v2 client boundary', () => {
  it('accepts the closed projection while allowing duplicate deck identities implicitly', () => {
    expect(validatePublicOnlineProjectionV2(projection()).ok).toBe(true);
  });

  it('rejects legacy deck fields, sparse seats, and ready before acceptance', () => {
    expect(
      validatePublicOnlineProjectionV2({
        ...projection(),
        seats: (projection().seats as unknown[]).map((seat, index) =>
          index === 0 ? { ...(seat as Record<string, unknown>), deckId: 'secret' } : seat,
        ),
      }).ok,
    ).toBe(false);
    const sparse = projection();
    const seats = new Array(4) as unknown[];
    seats.length = 4;
    sparse.seats = seats;
    expect(validatePublicOnlineProjectionV2(sparse).ok).toBe(false);
    expect(
      validatePublicOnlineProjectionV2({
        ...projection(),
        seats: (projection().seats as unknown[]).map((seat, index) =>
          index === 0
            ? { ...(seat as Record<string, unknown>), deckState: 'resolving', ready: true }
            : seat,
        ),
      }).ok,
    ).toBe(false);
  });

  it('sends a fresh submission after ready and adopts its cleared-ready projection', async () => {
    const roomId = 'room-v2';
    const serverBuildId = 'build-v2';
    const seatParticipants = ['host-v2', 'player-2', 'player-3', 'player-4'];
    let current = {
      kind: 'online-forming-lobby-projection-v2',
      schemaVersion: 2,
      lifecycle: 'forming',
      roomId,
      serverBuildId,
      hostParticipantId: seatParticipants[0],
      seats: seatParticipants.map((participantId, seatIndex) => ({
        seatIndex,
        corePlayerId: `P${seatIndex + 1}`,
        participantId,
        deckState: 'none',
        ready: false,
      })),
    } as Record<string, unknown>;
    const requests: Array<{ readonly kind: string; readonly submissionId?: string }> = [];
    const jsonResponse = (value: unknown): Response => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
    const projection = (deckState: 'none' | 'accepted', ready: boolean): Record<string, unknown> => ({
      ...current,
      lifecycle: deckState === 'accepted' && ready ? 'ready' : 'forming',
      seats: seatParticipants.map((participantId, seatIndex) => ({
        seatIndex,
        corePlayerId: `P${seatIndex + 1}`,
        participantId,
        deckState: seatIndex === 0 ? deckState : 'accepted',
        ready: seatIndex === 0 ? ready : true,
      })),
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Response => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
      if (url.endsWith('/api/online/rooms') && body?.kind === 'online-forming-lobby-create-v1') {
        const participantId = body.participantId;
        seatParticipants[0] = String(participantId);
        current = { ...current, hostParticipantId: participantId, seats: seatParticipants.map((nextParticipantId, seatIndex) => ({ seatIndex, corePlayerId: `P${seatIndex + 1}`, participantId: nextParticipantId, deckState: 'none', ready: false })) };
        return jsonResponse({
          kind: 'online-forming-lobby-created-v1',
          schemaVersion: 1,
          roomId,
          seatCapability: `seat_${'s'.repeat(32)}`,
          inviteCapabilities: [`invite_${'a'.repeat(32)}`, `invite_${'b'.repeat(32)}`, `invite_${'c'.repeat(32)}`],
          tableParticipantId: 'table-v2',
          tableCapability: `table_${'t'.repeat(32)}`,
          projection: {
            kind: 'online-forming-lobby-projection-v1',
            schemaVersion: 1,
            lifecycle: 'forming',
            roomId,
            serverBuildId,
            hostParticipantId: participantId,
            seats: [0, 1, 2, 3].map((seatIndex) => ({ seatIndex, corePlayerId: `P${seatIndex + 1}`, participantId: seatIndex === 0 ? participantId : null, deckId: null, deckSubmitted: false, ready: false })),
          },
        });
      }
      if (url.includes('/lobby?schemaVersion=2')) return jsonResponse(current);
      if (body?.kind === 'online-forming-lobby-deck-submit-v2') {
        requests.push({ kind: String(body.kind), submissionId: String(body.submissionId) });
        const submissionCount = requests.filter((request) => request.kind === 'online-forming-lobby-deck-submit-v2').length;
        if (submissionCount === 3) {
          current = projection('accepted', false);
          return jsonResponse({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId: body.submissionId, state: 'needs-attention', issues: [{ code: 'SUBMISSION_CONFLICT', entryIndex: null, retryable: false }], projection: current });
        }
        current = projection('accepted', false);
        return jsonResponse({ kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId: body.submissionId, state: 'accepted', issues: [], projection: current });
      }
      if (body?.kind === 'online-forming-lobby-ready-v2') {
        requests.push({ kind: String(body.kind) });
        current = projection('accepted', true);
        return jsonResponse({ kind: 'online-forming-lobby-ready-v2', schemaVersion: 2, roomId, projection: current });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = createPublicOnlineControllerV2();
    const deck = {
      id: 'deck-v2',
      name: 'Deck V2',
      entries: [{
        card: {
          scryfallId: '11111111-1111-4111-8111-111111111111',
          oracleId: '22222222-2222-4222-8222-222222222222',
          name: 'V2 Card',
          lang: 'en',
          layout: 'normal',
          cmc: 1,
          colorIdentity: [],
          typeLine: 'Creature',
          faces: [{ name: 'V2 Card', typeLine: 'Creature' }],
        },
        quantity: 1,
        section: 'main',
      }],
    } as PublicOnlineDeckOptionV2;
    try {
      await controller.create();
      await controller.submitDeck(deck);
      await controller.toggleReady();
      expect(controller.getSnapshot().projection?.lifecycle).toBe('ready');
      await controller.submitDeck(deck);
      expect(controller.getSnapshot().projection?.seats[0]?.ready).toBe(false);
      await controller.refresh();
      expect(controller.getSnapshot().projection?.seats[0]?.ready).toBe(false);
      const deckRequests = requests.filter((request) => request.kind === 'online-forming-lobby-deck-submit-v2');
      expect(deckRequests).toHaveLength(2);
      expect(deckRequests[0]?.submissionId).not.toBe(deckRequests[1]?.submissionId);
      await controller.submitDeck(deck);
      expect(controller.getSnapshot().projection?.seats[0]?.deckState).toBe('accepted');
      expect(controller.getSnapshot().ownerIssue?.code).toBe('SUBMISSION_CONFLICT');
      expect(controller.getSnapshot().error).toBeNull();
    } finally {
      controller.disconnect();
      vi.unstubAllGlobals();
    }
  });
});
