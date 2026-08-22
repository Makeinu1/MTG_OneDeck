// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicOnlineApp } from '../PublicOnlineApp';

const ROOM_ID = 'room-o4p06e-review';
const HOST_ID = 'host-o4p06e-review';
const SEAT_CAPABILITY = `seat_${'S'.repeat(40)}`;
const TABLE_ID = 'table-o4p06e-review';
const TABLE_CAPABILITY = `table_${'T'.repeat(40)}`;
const INVITES = [
  `invite_${'A'.repeat(40)}`,
  `invite_${'B'.repeat(40)}`,
  `invite_${'C'.repeat(40)}`,
] as const;
const SCRYFALL_ID = '5da14d86-0780-4821-a799-96f64b377df4';
const ORACLE_ID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function projection(hostParticipantId = HOST_ID, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v1',
    schemaVersion: 1,
    lifecycle: 'forming',
    roomId: ROOM_ID,
    serverBuildId: 'o4p-06e-server',
    hostParticipantId,
    seats: [
      { seatIndex: 0, corePlayerId: 'P1', participantId: hostParticipantId, deckId: null, deckSubmitted: false, ready: false },
      { seatIndex: 1, corePlayerId: 'P2', participantId: null, deckId: null, deckSubmitted: false, ready: false },
      { seatIndex: 2, corePlayerId: 'P3', participantId: null, deckId: null, deckSubmitted: false, ready: false },
      { seatIndex: 3, corePlayerId: 'P4', participantId: null, deckId: null, deckSubmitted: false, ready: false },
    ],
    ...overrides,
  };
}

function created(hostParticipantId = HOST_ID, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-created-v1',
    schemaVersion: 1,
    roomId: ROOM_ID,
    seatCapability: SEAT_CAPABILITY,
    inviteCapabilities: [...INVITES],
    tableParticipantId: TABLE_ID,
    tableCapability: TABLE_CAPABILITY,
    projection: projection(hostParticipantId),
    ...extra,
  };
}

function projectionV2(
  hostParticipantId = HOST_ID,
  lifecycle: 'forming' | 'ready' | 'started' = 'forming',
): Record<string, unknown> {
  const complete = lifecycle !== 'forming';
  return {
    kind: 'online-forming-lobby-projection-v2',
    schemaVersion: 2,
    lifecycle,
    roomId: ROOM_ID,
    serverBuildId: 'o4p-07b-server',
    hostParticipantId,
    seats: [0, 1, 2, 3].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? hostParticipantId : complete ? `player-${index + 1}` : null,
      deckState: complete ? 'accepted' : 'none',
      ready: complete,
    })),
  };
}

function ok(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function requestUrl(value: string | URL | Request): string {
  if (typeof value === 'string') return value;
  return value instanceof URL ? value.href : value.url;
}

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  const raw = init?.body;
  if (typeof raw !== 'string') throw new Error('Expected a string request body');
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a record request body');
  }
  return parsed as Record<string, unknown>;
}

function required<T extends Element = HTMLElement>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing Judge element: ${selector}`);
  return found;
}

function mount(
  onBackToSolo = vi.fn(),
  deckName = '《監査デッキ》',
  deckId = 'deck-o4p06e-review',
): { container: HTMLDivElement; root: Root; onBackToSolo: ReturnType<typeof vi.fn> } {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(
    <PublicOnlineApp
      decks={[{
        id: deckId,
        name: deckName,
        entries: [{
          section: 'main',
          quantity: 1,
          card: {
            scryfallId: SCRYFALL_ID,
            oracleId: ORACLE_ID,
            name: 'Review Card',
            lang: 'en',
            layout: 'normal',
            cmc: 1,
            colorIdentity: [],
            typeLine: 'Creature',
            faces: [{ name: 'Review Card', typeLine: 'Creature' }],
          },
        }],
      }]}
      initialDeckId={deckId}
      onBackToSolo={onBackToSolo}
    />,
  ));
  return { container, root, onBackToSolo };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('O4P-06E public Online App review', () => {
  it('is inert until an explicit action and returns through a native Solo control', () => {
    const fetcher = vi.fn();
    const socket = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('WebSocket', socket);
    const mounted = mount();

    expect(required(mounted.container, '[data-testid="public-online-app"]')).toBeInstanceOf(HTMLElement);
    expect(fetcher).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    const back = required<HTMLButtonElement>(mounted.container, '[data-testid="online-back-to-solo"]');
    expect(back.tagName).toBe('BUTTON');
    act(() => back.click());
    expect(mounted.onBackToSolo).toHaveBeenCalledOnce();
    act(() => mounted.root.unmount());
  });

  it('creates through the fixed endpoint and exposes only the Room plus three intentional invites', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    let createdParticipantId = '';
    vi.stubGlobal('fetch', vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: requestUrl(url), init });
      if (init?.method === 'GET') return Promise.resolve(ok(projectionV2(createdParticipantId)));
      const participantId = requestBody(init).participantId;
      if (typeof participantId !== 'string') throw new Error('Expected participantId');
      createdParticipantId = participantId;
      return Promise.resolve(ok(created(participantId)));
    }));
    const mounted = mount();

    await act(async () => {
      required<HTMLButtonElement>(mounted.container, '[data-testid="online-create-room"]').click();
      await Promise.resolve();
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://mtg-onedeck-online.makeinu1.workers.dev/api/online/rooms');
    expect(calls[0]?.init?.method).toBe('POST');
    const sent = requestBody(calls[0]?.init);
    expect(sent.kind).toBe('online-forming-lobby-create-v1');
    expect(sent.schemaVersion).toBe(1);
    expect(typeof sent.participantId).toBe('string');
    expect(Object.keys(sent).sort()).toEqual(['kind', 'participantId', 'schemaVersion']);
    expect(calls[1]?.url).toBe(
      `https://mtg-onedeck-online.makeinu1.workers.dev/api/online/rooms/${ROOM_ID}/lobby?schemaVersion=2`,
    );
    expect(calls[1]?.init?.method).toBe('GET');

    expect(required(mounted.container, '[data-testid="online-room-summary"]').textContent).toContain(ROOM_ID);
    const inviteControls = mounted.container.querySelectorAll('[data-testid="online-invite-copy"]');
    expect(inviteControls).toHaveLength(3);
    for (const invite of INVITES) expect(mounted.container.textContent).toContain(invite);
    expect(mounted.container.innerHTML).not.toContain(SEAT_CAPABILITY);
    expect(mounted.container.innerHTML).not.toContain(TABLE_CAPABILITY);
    expect(mounted.container.innerHTML).not.toContain(TABLE_ID);
    expect(document.location.href).not.toMatch(/seat_|table_|invite_/);
    act(() => mounted.root.unmount());
  });

  it('fails generically on hostile response drift without reflecting credentials or caller data', async () => {
    const leak = `LEAK_${'Z'.repeat(40)}`;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(created(HOST_ID, { unexpected: leak })))));
    const mounted = mount();
    await act(async () => {
      required<HTMLButtonElement>(mounted.container, '[data-testid="online-create-room"]').click();
      await Promise.resolve();
    });
    const error = required(mounted.container, '[data-testid="online-error"]');
    expect(error.textContent).toBe('オンライン操作を完了できませんでした。');
    expect(mounted.container.innerHTML).not.toMatch(new RegExp(`${leak}|${SEAT_CAPABILITY}|${TABLE_CAPABILITY}|${INVITES[0]}`));
    expect(mounted.container.querySelector('[data-testid="online-room-summary"]')).toBeNull();
    act(() => mounted.root.unmount());
  });

  it('rejects an exact create response bound to a different host identity', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(created('different-host')))));
    const mounted = mount();
    await act(async () => {
      required<HTMLButtonElement>(mounted.container, '[data-testid="online-create-room"]').click();
      await Promise.resolve();
    });
    expect(required(mounted.container, '[data-testid="online-error"]').textContent)
      .toBe('オンライン操作を完了できませんでした。');
    expect(mounted.container.querySelector('[data-testid="online-room-summary"]')).toBeNull();
    act(() => mounted.root.unmount());
  });

  it('enables host start from the canonical ready seat relation after refresh', async () => {
    let hostParticipantId = '';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      call += 1;
      if (call === 1) {
        const participantId = requestBody(init).participantId;
        if (typeof participantId !== 'string') throw new Error('Expected participantId');
        hostParticipantId = participantId;
        return Promise.resolve(ok(created(hostParticipantId)));
      }
      return Promise.resolve(
        ok(projectionV2(hostParticipantId, call === 2 ? 'forming' : 'ready')),
      );
    }));
    const mounted = mount();
    await act(async () => { required<HTMLButtonElement>(mounted.container, '[data-testid="online-create-room"]').click(); await Promise.resolve(); });
    await act(async () => { required<HTMLButtonElement>(mounted.container, '[data-testid="online-refresh-lobby"]').click(); await Promise.resolve(); });
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="online-start-game"]').disabled).toBe(false);
    expect(mounted.container.querySelectorAll('[data-testid="online-seat-summary"]')[0]?.textContent).toContain('参加済み');
    act(() => mounted.root.unmount());
  });

  it('keeps every primary lobby operation keyboard-native and preserves the explicit join fields', () => {
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount();
    for (const testId of [
      'online-create-room', 'online-join-room', 'online-refresh-lobby',
      'online-submit-deck', 'online-ready-toggle', 'online-start-game',
    ]) {
      expect(required(mounted.container, `[data-testid="${testId}"]`).tagName).toBe('BUTTON');
    }
    const room = required<HTMLInputElement>(mounted.container, '[data-testid="online-room-id"]');
    const invite = required<HTMLInputElement>(mounted.container, '[data-testid="online-invite-code"]');
    const deck = required<HTMLSelectElement>(mounted.container, '[data-testid="online-deck-select"]');
    expect(room.tagName).toBe('INPUT');
    expect(invite.tagName).toBe('INPUT');
    expect(deck.tagName).toBe('SELECT');
    expect(room.getAttribute('autocomplete')).toBe('off');
    expect(invite.getAttribute('autocomplete')).toBe('off');
    act(() => mounted.root.unmount());
  });

  it('keeps bearer-like saved metadata out of deck option DOM', () => {
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount(vi.fn(), TABLE_CAPABILITY, SEAT_CAPABILITY);
    const select = required<HTMLSelectElement>(
      mounted.container,
      '[data-testid="online-deck-select"]',
    );
    expect(select.textContent).toContain('保存済みデッキ 1');
    expect(select.innerHTML).not.toMatch(new RegExp(`${TABLE_CAPABILITY}|${SEAT_CAPABILITY}`));
    act(() => mounted.root.unmount());
  });

  it('keeps an exact eight-character capability fragment out of deck option DOM after create', async () => {
    let participantId = '';
    vi.stubGlobal('fetch', vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') return Promise.resolve(ok(projectionV2(participantId)));
      participantId = String(requestBody(init).participantId);
      return Promise.resolve(ok(created(participantId)));
    }));
    const fragment = SEAT_CAPABILITY.slice(10, 18);
    const mounted = mount(vi.fn(), `任意デッキ-${fragment}`, 'safe-deck-id');
    await act(async () => {
      required<HTMLButtonElement>(mounted.container, '[data-testid="online-create-room"]').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const select = required<HTMLSelectElement>(
      mounted.container,
      '[data-testid="online-deck-select"]',
    );
    expect(select.textContent).toContain('保存済みデッキ 1');
    expect(select.innerHTML).not.toContain(fragment);
    act(() => mounted.root.unmount());
  });
});
