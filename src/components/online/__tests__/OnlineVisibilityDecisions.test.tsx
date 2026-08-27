// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnlineParticipantProjectionV1 } from '../../../online/projection';
import { OnlineVisibilityDecisions } from '../OnlineVisibilityDecisions';

const visibleCard = (objectId: string, ownerPlayerId = 'P1', printedName?: string) => ({
  kind: 'visible-object', objectId, objectKind: 'card', ownerPlayerId,
  controllerPlayerId: ownerPlayerId, commander: false,
  definition: { name: objectId, ...(printedName === undefined ? {} : { printedName }) },
  runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } },
});

const projection = {
  kind: 'online-participant-projection-v1', schemaVersion: 1, protocolVersion: 1,
  roomId: 'visibility-room', participantId: 'visibility-player', role: 'player', corePlayerId: 'P1', revision: 7,
  room: { lifecycle: 'active', hostParticipantId: 'visibility-player', participants: [], seats: [
    { seatIndex: 0, corePlayerId: 'P1', participantId: null, ready: true, outcome: 'pending' },
    { seatIndex: 1, corePlayerId: 'P2', participantId: null, ready: true, outcome: 'pending' },
  ] },
  game: {
    turnOrder: ['P1', 'P2'],
    turn: { activePlayerId: 'P1', turnNumber: 1, positionSequence: 0, position: { phase: 'precombat-main', step: null } },
    players: [
      { playerId: 'P1', life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none', status: 'active', exitCause: null },
      { playerId: 'P2', life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none', status: 'active', exitCause: null },
    ],
    zones: {
      byPlayer: [
        { playerId: 'P1', zones: { library: { count: 3, entries: [{ kind: 'hidden-card' }, { kind: 'hidden-card' }, { kind: 'hidden-card' }] }, hand: { count: 1, entries: [visibleCard('PC1:0', 'P1', '自分のカード')] }, graveyard: { count: 0, entries: [] } } },
        { playerId: 'P2', zones: { library: { count: 3, entries: [{ kind: 'hidden-card' }, { kind: 'hidden-card' }, { kind: 'hidden-card' }] }, hand: { count: 0, entries: [] }, graveyard: { count: 0, entries: [] } } },
      ],
      battlefield: { count: 2, entries: [visibleCard('PC2:0', 'P2', '相手のカード'), visibleCard('PC3:0', 'P1')] }, stack: { count: 0, entries: [] }, exile: { count: 0, entries: [] }, command: { count: 0, entries: [] },
    },
    visibilityGrants: [], playPermissions: [], searchSessions: [],
  },
} as unknown as OnlineParticipantProjectionV1;

function withSearchSession(): OnlineParticipantProjectionV1 {
  return {
    ...projection,
    game: {
      ...projection.game,
      searchSessions: [{
        sessionId: 'search-1', rulesActorPlayerId: 'P2', selectorPlayerId: 'P1',
        zone: { kind: 'player-zone', playerId: 'P2', zone: 'library' }, portion: { kind: 'all' },
        criteria: { kind: 'quantity', minimum: 1, maximum: 1 }, revealFound: false, shuffleAfter: false,
        candidates: [visibleCard('PC2:0', 'P2', '相手のカード')],
      }],
    },
  } as unknown as OnlineParticipantProjectionV1;
}

function mount(props: Partial<React.ComponentProps<typeof OnlineVisibilityDecisions>> = {}): { root: Root; container: HTMLDivElement; onSubmit: ReturnType<typeof vi.fn> } {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn();
  act(() => root.render(<OnlineVisibilityDecisions projection={projection} interactionState="ready" onSubmit={onSubmit} {...props} />));
  return { root, container, onSubmit };
}

function change(container: HTMLElement, testId: string, value: string): void {
  const field = container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (field === null) throw new Error(`Missing ${testId}`);
  act(() => {
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

afterEach(() => document.body.replaceChildren());

describe('OnlineVisibilityDecisions', () => {
  it('offers an own top-library Look, confirms its audience/duration, and emits a versioned intent', () => {
    const mounted = mount();
    change(mounted.container, 'visibility-look-subject', 'top:1');
    const subjectOptions = [...mounted.container.querySelectorAll<HTMLOptionElement>('[data-testid="visibility-look-subject"] option')].map((option) => option.textContent);
    expect(subjectOptions).toContain('《自分のカード》');
    expect(subjectOptions).toContain('《PC3:0》');
    change(mounted.container, 'visibility-look-duration', 'source-bound');
    expect(mounted.container.querySelector('[data-testid="visibility-look-source"]')?.textContent).toContain('《PC3:0》');
    change(mounted.container, 'visibility-look-duration', 'next-command');
    const viewerOptions = [...mounted.container.querySelectorAll<HTMLOptionElement>('[data-testid="visibility-look-viewers"] option')].map((option) => option.textContent);
    expect(viewerOptions).toEqual(['自分', '席2']);
    const viewerSelect = mounted.container.querySelector<HTMLSelectElement>('[data-testid="visibility-look-viewers"]');
    if (viewerSelect === null) throw new Error('Missing viewer select');
    act(() => {
      viewerSelect.options[1].selected = true;
      viewerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    change(mounted.container, 'visibility-top-count', '2');
    const look = mounted.container.querySelector<HTMLButtonElement>('[data-testid="visibility-look"]');
    expect(look?.disabled).toBe(false);
    act(() => look?.click());
    expect(mounted.container.querySelector('[role="alertdialog"]')?.textContent).toContain('閲覧者: 自分、席2');
    expect(mounted.container.querySelector('[role="alertdialog"]')?.textContent).toContain('期間: 次の操作まで');
    act(() => mounted.container.querySelector<HTMLButtonElement>('[data-testid="visibility-confirm"]')?.click());
    const submitted = mounted.onSubmit.mock.calls[0]?.[0] as unknown;
    expect(mounted.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'online-visibility-intent-v1', schemaVersion: 1, baseRevision: 7,
      look: { subject: { kind: 'top-of-library', count: 2 }, viewerPlayerIds: ['P1', 'P2'], duration: { kind: 'next-command' } },
    }));
    if (submitted === null || typeof submitted !== 'object') throw new Error('Missing submitted visibility intent');
    expect((submitted as Record<string, unknown>).commandId).toEqual(expect.stringMatching(/^visibility-7-\d+$/u));
    act(() => mounted.root.unmount());
  });

  it('renders only projected search candidates and gates Choose while offline or busy', () => {
    const onSubmit = vi.fn();
    const mounted = mount({ projection: withSearchSession(), interactionState: 'offline', busy: true, onSubmit });
    expect(mounted.container.querySelector('[data-testid="visibility-choice-search-1"]')?.textContent).toContain('候補を選択');
    expect(mounted.container.querySelector('[data-testid="visibility-choice-search-1"]')?.textContent).toContain('《相手のカード》');
    const checkbox = mounted.container.querySelector<HTMLInputElement>('[data-testid="visibility-choice-search-1"] input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.disabled).toBe(true);
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="visibility-choose-search-1"]')?.disabled).toBe(true);
    act(() => mounted.root.unmount());
  });

  it('does not expose an executable Choose control to a delegated rules actor', () => {
    const delegated = { ...withSearchSession(), corePlayerId: 'P2' } as never;
    const mounted = mount({ projection: delegated });
    const session = mounted.container.querySelector('[data-testid="visibility-choice-search-1"]');
    expect(session?.textContent).toContain('指定されたプレイヤーのみ');
    expect(session?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(session?.querySelector('[data-testid="visibility-choose-search-1"]')).toBeNull();
    act(() => mounted.root.unmount());
  });

  it('keeps opaque qualified searches manual while allowing the server-owned empty completion', () => {
    const qualified = {
      ...withSearchSession(),
      game: {
        ...withSearchSession().game,
        searchSessions: [{
          ...withSearchSession().game.searchSessions[0],
          criteria: { kind: 'qualified', criteriaKey: 'opaque.criteria', minimum: 1, maximum: 1, mayFailToFind: true },
        }],
      },
    } as never;
    const mounted = mount({ projection: qualified });
    const session = mounted.container.querySelector('[data-testid="visibility-choice-search-1"]');
    expect(session?.textContent).toContain('Freeform Manual');
    expect(session?.querySelector('input[type="checkbox"]')).toBeNull();
    const choose = session?.querySelector<HTMLButtonElement>('[data-testid="visibility-choose-search-1"]');
    expect(choose?.disabled).toBe(false);
    act(() => choose?.click());
    expect(mounted.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ choose: { searchSessionId: 'search-1', candidateHandles: [] } }));
    act(() => mounted.root.unmount());
  });
});
