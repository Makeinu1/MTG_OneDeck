import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardDef } from '../../types/card';
import type { PublicOnlineDeckOptionV2 } from './types';
import { createPublicOnlineControllerV2 } from './v2';

const ROOM_ID = 'room-o4p07b-review';
const SEAT_CAPABILITY = `seat_${'S'.repeat(40)}`;
const TABLE_ID = 'table-o4p07b-review';
const TABLE_CAPABILITY = `table_${'T'.repeat(40)}`;
const INVITES = [
  `invite_${'A'.repeat(40)}`,
  `invite_${'B'.repeat(40)}`,
  `invite_${'C'.repeat(40)}`,
] as const;
const SCRYFALL_ID = '5da14d86-0780-4821-a799-96f64b377df4';
const ORACLE_ID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

type FetchCall = Readonly<{ readonly url: string; readonly init: RequestInit | undefined }>;

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function urlOf(value: string | URL | Request): string {
  return typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
  return JSON.parse(init.body) as Record<string, unknown>;
}

function projectionV1(hostParticipantId: string): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v1',
    schemaVersion: 1,
    lifecycle: 'forming',
    roomId: ROOM_ID,
    serverBuildId: 'o4p-07b-server',
    hostParticipantId,
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? hostParticipantId : null,
      deckId: null,
      deckSubmitted: false,
      ready: false,
    })),
  };
}

function created(hostParticipantId: string): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-created-v1',
    schemaVersion: 1,
    roomId: ROOM_ID,
    seatCapability: SEAT_CAPABILITY,
    inviteCapabilities: [...INVITES],
    tableParticipantId: TABLE_ID,
    tableCapability: TABLE_CAPABILITY,
    projection: projectionV1(hostParticipantId),
  };
}

function projectionV2(
  hostParticipantId: string,
  state: 'none' | 'accepted' | 'needs-attention' = 'none',
  allReady = false,
): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v2',
    schemaVersion: 2,
    lifecycle: allReady ? 'ready' : 'forming',
    roomId: ROOM_ID,
    serverBuildId: 'o4p-07b-server',
    hostParticipantId,
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? hostParticipantId : allReady ? `player-${index + 1}` : null,
      deckState: index === 0 ? state : allReady ? 'accepted' : 'none',
      ready: allReady,
    })),
  };
}

function card(): CardDef {
  return {
    scryfallId: SCRYFALL_ID,
    oracleId: ORACLE_ID,
    name: 'Wire Secret Name',
    printedName: '所有者表示名',
    lang: 'ja',
    layout: 'normal',
    cmc: 7,
    colorIdentity: ['U'],
    typeLine: 'Creature',
    faces: [{
      name: 'Wire Secret Name',
      printedName: '所有者表示名',
      typeLine: 'Creature',
      oracleText: 'Wire Secret Oracle text',
      imageUrl: 'https://image.invalid/secret.jpg',
    }],
  };
}

function deck(): PublicOnlineDeckOptionV2 {
  return Object.freeze({
    id: 'catalog-external-deck',
    name: '任意デッキ',
    entries: Object.freeze([
      Object.freeze({ section: 'main' as const, quantity: 2, card: card() }),
    ]),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('O4P-07B public v2 Judge boundary', () => {
  it('loads v2 immediately after create and submits only ordered IDs with double activation suppressed', async () => {
    const calls: FetchCall[] = [];
    let hostParticipantId = '';
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const call = Object.freeze({ url: urlOf(input), init });
      calls.push(call);
      if (call.url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') return Promise.resolve(response(projectionV2(hostParticipantId)));
      const body = bodyOf(init);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-deck-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        submissionId: body.submissionId,
        state: 'accepted',
        issues: [],
        projection: projectionV2(hostParticipantId, 'accepted'),
      }));
    }));
    const controller = createPublicOnlineControllerV2();

    await controller.create();
    expect(controller.getSnapshot()).toMatchObject({
      roomId: ROOM_ID,
      ownSeatIndex: 0,
      connection: 'lobby',
      error: null,
    });
    await Promise.all([controller.submitDeck(deck()), controller.submitDeck(deck())]);

    const submits = calls.filter((call) => {
      if (call.init?.method !== 'POST' || typeof call.init.body !== 'string') return false;
      return bodyOf(call.init).kind === 'online-forming-lobby-deck-submit-v2';
    });
    expect(submits).toHaveLength(1);
    const wire = bodyOf(submits[0]?.init);
    expect(Object.keys(wire).sort()).toEqual([
      'deckId',
      'entries',
      'kind',
      'participantId',
      'schemaVersion',
      'seatCapability',
      'submissionId',
    ]);
    expect(wire.entries).toEqual([{
      section: 'main',
      quantity: 2,
      scryfallId: SCRYFALL_ID,
      oracleId: ORACLE_ID,
    }]);
    expect(JSON.stringify(wire)).not.toMatch(/Wire Secret|image\.invalid|oracleText|deckText/);
    expect(controller.getSnapshot()).toMatchObject({ ownerIssue: null, error: null });
    controller.disconnect();
  });

  it('keeps a known issue owner-local and retries with a fresh submission ID', async () => {
    let hostParticipantId = '';
    const submissionIds: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') return Promise.resolve(response(projectionV2(hostParticipantId)));
      const body = bodyOf(init);
      submissionIds.push(String(body.submissionId));
      const retry = submissionIds.length > 1;
      return Promise.resolve(response({
        kind: 'online-forming-lobby-deck-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        submissionId: body.submissionId,
        state: retry ? 'accepted' : 'needs-attention',
        issues: retry ? [] : [{ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: true }],
        projection: projectionV2(hostParticipantId, retry ? 'accepted' : 'needs-attention'),
      }));
    }));
    const controller = createPublicOnlineControllerV2();
    await controller.create();
    await controller.submitDeck(deck());
    const ownerIssue = controller.getSnapshot().ownerIssue;
    expect(ownerIssue).toMatchObject({
      code: 'CARD_NOT_FOUND',
      entryIndex: 0,
      retryable: true,
    });
    expect(ownerIssue?.message).toContain('確認できないカードがあります');
    expect(ownerIssue?.message).not.toContain('所有者表示名');
    expect(JSON.stringify(controller.getSnapshot().projection)).not.toMatch(
      /所有者表示名|CARD_NOT_FOUND|5da14d86/,
    );
    await controller.retry();
    expect(submissionIds).toHaveLength(2);
    expect(submissionIds[1]).not.toBe(submissionIds[0]);
    expect(controller.getSnapshot()).toMatchObject({ ownerIssue: null, error: null });
    controller.disconnect();
  });

  it('does not evaluate hostile deck accessors and makes stale create completion inert', async () => {
    let pendingParticipantId = '';
    let resolveCreate: (value: Response) => void = () => {
      throw new Error('Create request did not start');
    };
    const pendingCreate = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetcher = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      pendingParticipantId = String(bodyOf(init).participantId);
      return pendingCreate;
    });
    vi.stubGlobal('fetch', fetcher);
    const controller = createPublicOnlineControllerV2();
    const creating = controller.create();
    controller.disconnect();
    resolveCreate(response(created(pendingParticipantId)));
    await creating;
    expect(fetcher).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ mode: 'entry', roomId: null, error: null });

    let getterReads = 0;
    const hostileEntry = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostileEntry, {
      card: { enumerable: true, get: () => { getterReads += 1; return card(); } },
      quantity: { enumerable: true, value: 1 },
      section: { enumerable: true, value: 'main' },
    });
    await controller.submitDeck({ id: 'hostile-deck', name: 'hostile', entries: [hostileEntry] } as never);
    expect(getterReads).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects cross-field start drift without opening a WebSocket', async () => {
    let hostParticipantId = '';
    const socket = vi.fn();
    vi.stubGlobal('WebSocket', socket);
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') {
        return Promise.resolve(response(projectionV2(hostParticipantId, 'accepted', true)));
      }
      return Promise.resolve(response({
        kind: 'online-forming-lobby-start-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        outcome: 'started',
        issue: 'ROOM_GENESIS_TOO_LARGE',
        status: null,
      }));
    }));
    const controller = createPublicOnlineControllerV2();
    await controller.create();
    await controller.start();
    expect(controller.getSnapshot().error).toBe('サーバーから予期しない応答が返りました。ページを更新して再試行してください。');
    expect(socket).not.toHaveBeenCalled();
    controller.disconnect();
  });

  it('rejects wrong-Room nested submit and ready projections without changing Room identity', async () => {
    let hostParticipantId = '';
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') return Promise.resolve(response(projectionV2(hostParticipantId)));
      const body = bodyOf(init);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-deck-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        submissionId: body.submissionId,
        state: 'accepted',
        issues: [],
        projection: { ...projectionV2(hostParticipantId, 'accepted'), roomId: 'other-room' },
      }));
    }));
    const submitController = createPublicOnlineControllerV2();
    await submitController.create();
    await submitController.submitDeck(deck());
    expect(submitController.getSnapshot()).toMatchObject({
      roomId: ROOM_ID,
      error: 'サーバーから予期しない応答が返りました。ページを更新して再試行してください。',
    });
    submitController.disconnect();

    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') {
        return Promise.resolve(response(projectionV2(hostParticipantId, 'accepted')));
      }
      return Promise.resolve(response({
        kind: 'online-forming-lobby-ready-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        projection: { ...projectionV2(hostParticipantId, 'accepted'), roomId: 'other-room' },
      }));
    }));
    const readyController = createPublicOnlineControllerV2();
    await readyController.create();
    await readyController.toggleReady();
    expect(readyController.getSnapshot()).toMatchObject({
      roomId: ROOM_ID,
      error: 'サーバーから予期しない応答が返りました。ページを更新して再試行してください。',
    });
    readyController.disconnect();
  });

  it('rejects bearer-like and oversized saved deck data before any submission request', async () => {
    let hostParticipantId = '';
    const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      return Promise.resolve(response(projectionV2(hostParticipantId)));
    });
    vi.stubGlobal('fetch', fetcher);
    const controller = createPublicOnlineControllerV2();
    await controller.create();
    expect(fetcher).toHaveBeenCalledTimes(2);

    await controller.submitDeck({ ...deck(), id: SEAT_CAPABILITY });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().error).toBe('オンライン操作を完了できませんでした。');

    await controller.submitDeck({
      ...deck(),
      id: 'secret-display-deck',
      entries: [{
        ...deck().entries[0],
        card: { ...card(), printedName: SEAT_CAPABILITY },
      }],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await controller.submitDeck({
      ...deck(),
      id: 'oversized-deck',
      entries: Array.from({ length: 4_097 }, () => deck().entries[0]),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    controller.disconnect();
  });

  it('binds submit state and requested readiness to the local seat in the nested projection', async () => {
    let hostParticipantId = '';
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') return Promise.resolve(response(projectionV2(hostParticipantId)));
      const body = bodyOf(init);
      return Promise.resolve(response({
        kind: 'online-forming-lobby-deck-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        submissionId: body.submissionId,
        state: 'accepted',
        issues: [],
        projection: projectionV2(hostParticipantId, 'needs-attention'),
      }));
    }));
    const submitController = createPublicOnlineControllerV2();
    await submitController.create();
    await submitController.submitDeck(deck());
    expect(submitController.getSnapshot().error).toBe(
      'サーバーから予期しない応答が返りました。ページを更新して再試行してください。',
    );
    submitController.disconnect();

    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith('/api/online/rooms')) {
        hostParticipantId = String(bodyOf(init).participantId);
        return Promise.resolve(response(created(hostParticipantId)));
      }
      if (init?.method === 'GET') {
        return Promise.resolve(response(projectionV2(hostParticipantId, 'accepted')));
      }
      return Promise.resolve(response({
        kind: 'online-forming-lobby-ready-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        projection: projectionV2(hostParticipantId, 'accepted'),
      }));
    }));
    const readyController = createPublicOnlineControllerV2();
    await readyController.create();
    await readyController.toggleReady();
    expect(readyController.getSnapshot().error).toBe(
      'サーバーから予期しない応答が返りました。ページを更新して再試行してください。',
    );
    readyController.disconnect();
  });
});
