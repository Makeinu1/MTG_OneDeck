// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeOnlineSharedInviteCodeV3 } from '../../../online/publicApp';
import { PublicOnlineApp } from '../PublicOnlineApp';

const ROOM_ID = 'room-o4p08b-ui-review';
const SEAT_CAPABILITY = `seat_${'s'.repeat(40)}`;
const TABLE_ID = 'table-o4p08b-ui-review';
const TABLE_CAPABILITY = `observer_${'t'.repeat(40)}`;
const ADMISSION = `admission_${'a'.repeat(40)}`;
const INVITE = encodeOnlineSharedInviteCodeV3(ROOM_ID, ADMISSION);
const SCRYFALL_ID = '5da14d86-0780-4821-a799-96f64b377df4';
const ORACLE_ID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function projection(hostId: string, guest = false, lifecycle: 'forming' | 'ready' = 'forming') {
  return {
    kind: 'online-forming-lobby-projection-v4' as const,
    schemaVersion: 4 as const,
    lifecycle,
    roomId: ROOM_ID,
    serverBuildId: 'build-o4p08b-ui-review',
    hostParticipantId: hostId,
    configuration: { playerCount: 2 as const, startingLife: 40 as const },
    seats: [0, 1].map((index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? hostId : index === 1 && guest ? 'guest-o4p08b-ui-review' : null,
      acceptedDeck: false,
      ready: false,
    })),
  };
}

function created(hostId: string, guest = false) {
  return {
    kind: 'online-forming-lobby-created-v5' as const,
    schemaVersion: 5 as const,
    roomId: ROOM_ID,
    participantId: hostId,
    playerCount: 2 as const,
    startingLife: 40 as const,
    seatCapability: SEAT_CAPABILITY,
    inviteCode: INVITE,
    tableParticipantId: TABLE_ID,
    tableCapability: TABLE_CAPABILITY,
    projection: projection(hostId, guest),
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function body(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') throw new Error('Expected request body');
  return JSON.parse(init.body) as Record<string, unknown>;
}

function required<T extends Element = HTMLElement>(container: HTMLElement, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing Judge element: ${selector}`);
  return element;
}

function mount(deckName = '監査デッキ'): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(
    <PublicOnlineApp
      decks={[{
        id: 'deck-o4p08b-ui-review',
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
      initialDeckId="deck-o4p08b-ui-review"
      onBackToSolo={vi.fn()}
    />,
  ));
  return { container, root };
}

async function click(container: HTMLElement, selector: string): Promise<void> {
  await act(async () => {
    required<HTMLButtonElement>(container, selector).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function enter(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const setter: unknown = descriptor === undefined ? undefined : Reflect.get(descriptor, 'set');
  if (typeof setter === 'function') Reflect.apply(setter, input, [value]);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('O4P-08B deck-first public journey review (supersedes O4P-06E flat form)', () => {
  it('starts with create/join choices and asks for exactly one invite without Room ID', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount();
    expect(mounted.container.textContent).toContain('オンライン対戦');
    expect(mounted.container.textContent).not.toContain('4人オンライン');
    expect(mounted.container.textContent).not.toContain('Room ID');
    expect(mounted.container.querySelectorAll('input')).toHaveLength(0);

    await click(mounted.container, '[data-testid="online-open-join"]');
    expect(mounted.container.querySelectorAll('input')).toHaveLength(1);
    expect(required<HTMLInputElement>(mounted.container, '[data-testid="online-shared-invite"]')
      .getAttribute('autocomplete')).toBe('off');
    expect(mounted.container.textContent).not.toContain('Room ID');
    act(() => mounted.root.unmount());
  });

  it('scrubs a fragment before exposing the single join field', async () => {
    window.history.replaceState(null, '', `/#online-invite=${encodeURIComponent(INVITE)}`);
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(window.location.hash).toBe('');
    const input = required<HTMLInputElement>(mounted.container, '[data-testid="online-shared-invite"]');
    expect(input.value).toBe(INVITE);
    expect(mounted.container.querySelectorAll('input')).toHaveLength(1);
    expect(mounted.container.textContent).not.toContain('Room ID');
    act(() => mounted.root.unmount());
  });

  it('creates through variable shared admission and renders an exact two-seat privacy-safe host lobby', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = body(init);
      const hostId = String(sent.participantId);
      expect(sent).toMatchObject({
        kind: 'online-forming-lobby-create-v5', schemaVersion: 5,
        playerCount: 2, startingLife: 40,
      });
      return Promise.resolve(response(created(hostId, true)));
    }));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-create-shared"]');

    expect(required(mounted.container, '[aria-label="対戦ロビー"]')).toBeTruthy();
    expect(mounted.container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(required(mounted.container, '[aria-current="step"]').textContent).toContain('デッキ提出');
    const seatSummaries = mounted.container.querySelectorAll('[data-testid="online-seat-summary"]');
    expect(seatSummaries).toHaveLength(2);
    expect([...seatSummaries].every((seatSummary) => seatSummary.textContent?.includes('入室済み'))).toBe(true);
    expect(mounted.container.textContent).not.toContain('空席');
    expect(mounted.container.querySelectorAll('[data-testid="online-seat-summary"]')[1]?.textContent)
      .toContain('デッキ: 未提出');
    expect(mounted.container.textContent).not.toContain(ROOM_ID);
    expect(mounted.container.innerHTML).not.toMatch(
      new RegExp(`${SEAT_CAPABILITY}|${TABLE_CAPABILITY}|guest-o4p08b-ui-review`),
    );
    expect(required(mounted.container, '[data-testid="online-invite-rotate"]')).toBeInstanceOf(HTMLButtonElement);
    expect(required(mounted.container, '[data-testid="online-admission-close"]')).toBeInstanceOf(HTMLButtonElement);
    expect(required(mounted.container, '[data-testid="online-kick-1"]')).toBeInstanceOf(HTMLButtonElement);
    expect(mounted.container.textContent).not.toContain(INVITE);
    act(() => mounted.root.unmount());
  });

  it('announces copy success without echoing the invite and advances ready players to start', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText }, onLine: true });
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = body(init);
      const hostId = String(sent.participantId);
      const readyProjection = {
        ...projection(hostId, true, 'ready'),
        seats: [0, 1].map((index) => ({
          seatIndex: index,
          corePlayerId: `P${index + 1}`,
          participantId: index === 0 ? hostId : `ready-player-${index + 1}`,
          acceptedDeck: true,
          ready: true,
        })),
      };
      return Promise.resolve(response({ ...created(hostId), projection: readyProjection }));
    }));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-create-shared"]');
    expect(required(mounted.container, '[aria-current="step"]').textContent).toContain('対戦開始');
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="online-start-game"]').disabled)
      .toBe(false);
    const resubmit = required<HTMLButtonElement>(mounted.container, '[data-testid="online-submit-deck"]');
    expect(resubmit.disabled).toBe(false);
    expect(resubmit.textContent).toContain('デッキを再提出');
    await click(mounted.container, '[data-testid="online-invite-copy"]');
    const notice = required(mounted.container, '[data-testid="online-copy-notice"]');
    expect(notice.textContent).toBe('招待コードをコピーしました。');
    expect(notice.textContent).not.toContain(INVITE);
    expect(writeText).toHaveBeenCalledWith(INVITE);
    act(() => mounted.root.unmount());
  });

  it('places a deck validation cause beside the deck action', async () => {
    let hostId = '';
    let submittedKind = '';
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = body(init);
      if (sent.kind === 'online-forming-lobby-create-v5') {
        hostId = String(sent.participantId);
        return Promise.resolve(response(created(hostId)));
      }
      submittedKind = String(sent.kind);
      const failedProjection = {
        ...projection(hostId),
        seats: projection(hostId).seats.map((seat, index) =>
          index === 0 ? { ...seat, acceptedDeck: false } : seat,
        ),
      };
      return Promise.resolve(response({
        kind: 'online-forming-lobby-deck-result-v2',
        schemaVersion: 2,
        roomId: ROOM_ID,
        submissionId: sent.submissionId,
        state: 'needs-attention',
        issues: [{ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: false }],
        projection: failedProjection,
      }));
    }));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-create-shared"]');
    await click(mounted.container, '[data-testid="online-submit-deck"]');
    expect(submittedKind).toBe('online-forming-lobby-deck-submit-v2');
    const deckPanel = required(mounted.container, '.public-online-app__selected-deck');
    expect(deckPanel.textContent).toContain('確認できないカードがあります');
    expect(deckPanel.textContent).not.toContain('Review Card');
    expect(deckPanel.textContent).not.toContain(SEAT_CAPABILITY);
    act(() => mounted.root.unmount());
  });

  it('closes admission authoritatively and removes every copy/reveal path', async () => {
    let hostId = '';
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = body(init);
      if (sent.kind === 'online-forming-lobby-create-v5') {
        hostId = String(sent.participantId);
        return Promise.resolve(response(created(hostId)));
      }
      expect(sent).toMatchObject({
        kind: 'online-forming-lobby-admission-close-v3',
        schemaVersion: 3,
        hostParticipantId: hostId,
        seatCapability: SEAT_CAPABILITY,
      });
      return Promise.resolve(response({
        kind: 'online-forming-lobby-admission-closed-v3',
        schemaVersion: 3,
        roomId: ROOM_ID,
        projection: projection(hostId),
      }));
    }));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-create-shared"]');
    await click(mounted.container, '[data-testid="online-admission-close"]');
    expect(required(mounted.container, '[data-testid="online-admission-closed"]').textContent)
      .toContain('参加受付は終了しています');
    expect(mounted.container.querySelector('[data-testid="online-invite-link-copy"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="online-invite-copy"]')).toBeNull();
    expect(mounted.container.textContent).not.toContain(INVITE);
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="online-invite-rotate"]').disabled)
      .toBe(false);
    act(() => mounted.root.unmount());
  });

  it('shows cause, recovery guidance, retryability, and correlation for a nonretryable join rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response({
      kind: 'online-public-error-v3',
      schemaVersion: 3,
      code: 'ROOM_FULL',
      retryable: false,
      correlationId: 'correlation-o4p08b-full',
    }, 409))));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-open-join"]');
    const input = required<HTMLInputElement>(mounted.container, '[data-testid="online-shared-invite"]');
    act(() => enter(input, INVITE));
    await click(mounted.container, '[data-testid="online-join-shared"]');
    const alert = required(mounted.container, '[data-testid="online-error"]');
    expect(alert.textContent).toContain('部屋は満席です');
    expect(alert.textContent).toContain('次の対応: もう一度参加');
    expect(alert.textContent).toContain('同じ操作の再試行: 不可');
    expect(alert.textContent).toContain('correlation-o4p08b-full');
    expect(alert.querySelectorAll(':scope > p > small')).toHaveLength(2);
    expect(alert.querySelector('button')).toBeNull();
    expect(alert.innerHTML).not.toContain(ADMISSION);
    act(() => mounted.root.unmount());
  });

  it('shows explicit retryability and an action button for a retryable join failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response({
      kind: 'online-public-error-v3',
      schemaVersion: 3,
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
      correlationId: 'correlation-o4p08d-retry',
    }, 503))));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-open-join"]');
    const input = required<HTMLInputElement>(mounted.container, '[data-testid="online-shared-invite"]');
    act(() => enter(input, INVITE));
    await click(mounted.container, '[data-testid="online-join-shared"]');
    const alert = required(mounted.container, '[data-testid="online-error"]');
    expect(alert.textContent).toContain('サーバーに接続できません');
    expect(alert.textContent).toContain('次の対応: もう一度参加');
    expect(alert.textContent).toContain('同じ操作の再試行: 可能');
    expect(alert.textContent).toContain('correlation-o4p08d-retry');
    expect(alert.querySelectorAll(':scope > p > small')).toHaveLength(2);
    expect(alert.querySelector('button')?.textContent).toBe('もう一度参加');
    expect(alert.innerHTML).not.toContain(ADMISSION);
    act(() => mounted.root.unmount());
  });

  it('keeps host moderation absent from the guest lobby', async () => {
    const hostId = 'host-o4p08b-guest-view';
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const sent = body(init);
      const guestId = String(sent.participantId);
      const guestProjection = {
        ...projection(hostId, false),
        seats: projection(hostId, false).seats.map((seat, index) => ({
          ...seat,
          participantId: index === 0 ? hostId : index === 1 ? guestId : null,
        })),
      };
      return Promise.resolve(response({
        kind: 'online-forming-lobby-shared-claimed-v4',
        schemaVersion: 4,
        roomId: ROOM_ID,
        participantId: guestId,
        seatCapability: SEAT_CAPABILITY,
        projection: guestProjection,
      }));
    }));
    const mounted = mount();
    await click(mounted.container, '[data-testid="online-open-join"]');
    const input = required<HTMLInputElement>(mounted.container, '[data-testid="online-shared-invite"]');
    act(() => enter(input, INVITE));
    await click(mounted.container, '[data-testid="online-join-shared"]');
    expect(mounted.container.textContent).toContain('ホストの開始を待っています');
    expect(mounted.container.querySelector('[data-testid="online-invite-rotate"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="online-admission-close"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid^="online-kick-"]')).toBeNull();
    expect(mounted.container.innerHTML).not.toMatch(new RegExp(`${hostId}|${SEAT_CAPABILITY}`));
    act(() => mounted.root.unmount());
  });

  it('offers browser recovery without rendering stored authority', () => {
    localStorage.setItem('mtg-onedeck:online-recovery-v1', JSON.stringify({
      kind: 'public-online-recovery-v1',
      schemaVersion: 1,
      roomId: ROOM_ID,
      participantId: 'participant-o4p08b-recovery',
      seatCapability: SEAT_CAPABILITY,
      isHost: false,
      tableParticipantId: null,
      tableCapability: null,
    }));
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount();
    expect(required(mounted.container, '[data-testid="online-recover"]')).toBeInstanceOf(HTMLButtonElement);
    expect(mounted.container.innerHTML).not.toMatch(new RegExp(`${ROOM_ID}|${SEAT_CAPABILITY}`));
    act(() => mounted.root.unmount());
  });

  it('redacts bearer-like deck metadata while keeping native keyboard controls', () => {
    vi.stubGlobal('fetch', vi.fn());
    const mounted = mount(TABLE_CAPABILITY);
    expect(mounted.container.textContent).toContain('保存済みデッキ 1');
    expect(mounted.container.innerHTML).not.toContain(TABLE_CAPABILITY);
    for (const selector of [
      '[data-testid="online-create-shared"]',
      '[data-testid="online-open-join"]',
      '[data-testid="online-deck-select"]',
    ]) {
      expect(required(mounted.container, selector)).toBeInstanceOf(HTMLElement);
    }
    act(() => mounted.root.unmount());
  });
});
