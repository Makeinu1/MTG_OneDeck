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
});
