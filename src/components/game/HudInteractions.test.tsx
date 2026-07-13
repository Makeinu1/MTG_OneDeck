import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../store/gameStore';
import { HandRibbon } from './HandRibbon';
import { StatusBand } from './StatusBand';
import { GameCard } from './GameCard';
import { LandRow } from './LandRow';
import { Board } from './Board';
import type { GameController } from './gameController';

vi.mock('./sound', () => ({ celebrate: vi.fn() }));

function controllerFor(
  state: ReturnType<typeof buildVisualFixture>['snapshot']['state'],
  overrides: Partial<GameController> = {},
): GameController {
  useGameStore.setState({
    state,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    mulliganDecisionPending: false,
  });
  const store = useGameStore.getState();
  return {
    state,
    store,
    openCardMenu: vi.fn(),
    handleCardDoubleClick: vi.fn(),
    requestResolveTop: vi.fn(),
    requestResolveAll: vi.fn(),
    advancePhase: vi.fn(),
    advanceTurn: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    setManualTargets: vi.fn(),
    openLibraryActions: vi.fn(),
    libraryActionsOpen: false,
    openZoneViewer: vi.fn(),
    openTokenDialog: vi.fn(),
    openAttackDialog: vi.fn(),
    openArrangeTop: vi.fn(),
    openCountDialog: vi.fn(),
    requestConfirm: vi.fn(),
    triggerCandidateCount: 0,
    motionArmed: false,
    feedOpen: false,
    openFeed: vi.fn(),
    closeFeed: vi.fn(),
    overlays: null,
    shortcutsBlocked: false,
    transitionCue: null,
    dismissTransitionCue: vi.fn(),
    ...overrides,
  };
}

function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, root };
}

afterEach(() => {
  vi.useRealTimers();
  useGameStore.setState({ state: null });
  document.body.replaceChildren();
});

describe('high-frequency HUD interactions', () => {
  it('cancels the focus preview when a double click starts a quick action', () => {
    vi.useFakeTimers();
    const state = buildVisualFixture('hand7').snapshot.state;
    const handleCardDoubleClick = vi.fn();
    const controller = controllerFor(state, { handleCardDoubleClick });
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;

    act(() => card.focus());
    act(() => { vi.advanceTimersByTime(150); });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).not.toBeNull();
    act(() => { card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });
    expect(handleCardDoubleClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).toBeNull();
    act(() => root.unmount());
  });

  it('adjusts life inline while the value still opens details', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const minus = container.querySelector<HTMLButtonElement>('[data-testid="life-minus"]');
    const plus = container.querySelector<HTMLButtonElement>('[data-testid="life-plus"]');
    const value = container.querySelector<HTMLButtonElement>('[data-testid="life-value"]');

    act(() => minus?.click());
    expect(useGameStore.getState().state?.life).toBe(state.life - 1);
    act(() => plus?.click());
    expect(useGameStore.getState().state?.life).toBe(state.life);
    act(() => value?.click());
    expect(container.querySelector('[data-testid="life-sheet"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it('keeps the log button immediately after life and removes the duplicate hand entry', () => {
    const state = buildVisualFixture('hand100').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const rightActions = container.querySelector<HTMLElement>('.status-band__right-actions');

    expect(container.querySelector('[data-testid="status-zone-hand"]')).toBeNull();
    expect(Array.from(rightActions?.children ?? []).map((element) => (
      element.getAttribute('data-testid') ?? element.className
    ))).toEqual(['status-band__life-cluster', 'feed-bell']);
    expect(container.querySelectorAll('.status-band__mana-stepper')).toHaveLength(6);
    act(() => root.unmount());
  });

  it.each(['W', 'U', 'B', 'R', 'G', 'C'] as const)('adjusts %s mana directly in the status band', (color) => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const before = useGameStore.getState().state?.manaPool[color] ?? 0;
    const plus = container.querySelector<HTMLButtonElement>(`[data-testid="mana-plus-${color}"]`);
    const minus = container.querySelector<HTMLButtonElement>(`[data-testid="mana-minus-${color}"]`);

    act(() => plus?.click());
    expect(useGameStore.getState().state?.manaPool[color]).toBe(before + 1);
    act(() => minus?.click());
    expect(useGameStore.getState().state?.manaPool[color]).toBe(before);
    act(() => root.unmount());
  });

  it('lets a basic-land bundle stay expanded for repeated individual taps', () => {
    const state = buildVisualFixture('lands').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<LandRow controller={controller} />);
    const row = container.querySelector<HTMLElement>('[data-testid="land-row"]');
    const bundleButton = container.querySelector<HTMLButtonElement>('[data-testid^="land-bundle-count-"]');
    const bundle = bundleButton?.closest<HTMLElement>('.land-bundle');

    expect(row?.dataset.density).toBe('spacious');
    expect(bundleButton?.getAttribute('aria-expanded')).toBe('false');
    act(() => bundleButton?.click());
    expect(bundleButton?.getAttribute('aria-expanded')).toBe('true');
    expect(bundle?.dataset.expanded).toBe('true');
    act(() => root.unmount());
  });

  it('provides explicit recovery controls for an overflowing battlefield shelf', () => {
    const state = buildVisualFixture('board-overflow').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<Board controller={controller} />);
    const shelf = container.querySelector<HTMLElement>('[data-testid="board-creatures"]')!;
    const scrollBy = vi.fn();
    shelf.scrollBy = scrollBy;
    const right = container.querySelector<HTMLButtonElement>('[data-testid="board-creatures-scroll-right"]');

    expect(right).not.toBeNull();
    act(() => right?.click());
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect((scrollBy.mock.calls[0]?.[0] as ScrollToOptions).left).toBeGreaterThan(0);
    act(() => root.unmount());
  }, 10_000);

  it('does not draw from the library tile and provides a separate explicit draw button', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const openLibraryActions = vi.fn();
    const controller = controllerFor(state, { openLibraryActions });
    const before = state.zones.library.length;
    const { container, root } = mount(
      <HandRibbon controller={controller} workspaceOpen={false} />,
    );
    const tile = container.querySelector<HTMLButtonElement>('[data-testid="library-tile"]');
    const draw = container.querySelector<HTMLButtonElement>('[data-testid="library-draw-one"]');

    expect(tile?.getAttribute('aria-haspopup')).toBe('menu');
    expect(tile?.getAttribute('aria-expanded')).toBe('false');
    act(() => tile?.click());
    expect(openLibraryActions).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().state?.zones.library).toHaveLength(before);
    act(() => draw?.click());
    expect(useGameStore.getState().state?.zones.library).toHaveLength(before - 1);
    act(() => root.unmount());
  });

  it('collapses hands above fifteen cards behind a dedicated workspace action', () => {
    const state = buildVisualFixture('hand60').snapshot.state;
    const controller = controllerFor(state);
    const onOpenWorkspace = vi.fn();
    const { container, root } = mount(
      <HandRibbon controller={controller} workspaceOpen={false} onOpenWorkspace={onOpenWorkspace} />,
    );
    const ribbon = container.querySelector<HTMLElement>('[data-testid="hand-ribbon"]');
    const open = container.querySelector<HTMLButtonElement>('[data-testid="large-hand-open"]');

    expect(ribbon?.dataset.layout).toBe('large');
    expect(container.querySelector('[data-testid="hand-cards"]')).toBeNull();
    expect(container.querySelector('[data-testid="library-tile"]')).not.toBeNull();
    expect(open?.textContent).toContain('60枚');
    act(() => open?.click());
    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('keeps fifteen cards in the directly touchable fan', () => {
    const state = buildVisualFixture('hand15').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<HandRibbon controller={controller} workspaceOpen={false} />);
    expect(container.querySelector('[data-testid="hand-ribbon"]')?.getAttribute('data-layout')).toBe('fan');
    expect(container.querySelectorAll('.hand-ribbon__slot')).toHaveLength(15);
    act(() => root.unmount());
  });

  it('announces when the library action menu is open', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state, { libraryActionsOpen: true });
    const { container, root } = mount(<HandRibbon controller={controller} />);
    expect(container.querySelector('[data-testid="library-tile"]')?.getAttribute('aria-expanded')).toBe('true');
    act(() => root.unmount());
  });

  it('keeps an empty-library draw available so the defeat attempt is recorded', () => {
    const fixtureState = buildVisualFixture('hand7').snapshot.state;
    const state = {
      ...fixtureState,
      zones: { ...fixtureState.zones, library: [] },
    };
    const controller = controllerFor(state);
    const { container, root } = mount(
      <HandRibbon controller={controller} workspaceOpen={false} />,
    );
    const draw = container.querySelector<HTMLButtonElement>('[data-testid="library-draw-one"]');

    expect(draw?.disabled).toBe(false);
    expect(draw?.dataset.empty).toBe('true');
    act(() => draw?.click());
    expect(useGameStore.getState().state?.defeat.P1?.reasons).toContain('emptyLibraryDraw');
    act(() => root.unmount());
  });
});
