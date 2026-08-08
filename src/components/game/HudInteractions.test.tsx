import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../store/gameStore';
import { applyCommand } from '../../engine/commands';
import { HandRibbon } from './HandRibbon';
import { StatusBand } from './StatusBand';
import { GameCard } from './GameCard';
import { LandRow } from './LandRow';
import { Board } from './Board';
import { SupportRow } from './SupportRow';
import { StackBand } from './StackBand';
import { RecentCue } from './RecentCue';
import { PresentationLayer } from './PresentationLayer';
import { CommanderCutIn } from './CommanderCutIn';
import { ThumbZone } from './ThumbZone';
import type { GameController } from './gameController';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';


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
    requestDraw: (count) => useGameStore.getState().draw(count),
    requestShuffleLibrary: () => useGameStore.getState().shuffleLibrary(),
    requestMulligan: vi.fn(),
    requestKeepHand: vi.fn(),
    requestToggleTap: (cardId) => useGameStore.getState().toggleTap(cardId),
    requestSetAllTapped: (tapped) => {
      if (tapped) useGameStore.getState().tapAllPermanents();
      else useGameStore.getState().untapAllPermanents();
    },
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
    opponentBoardOpen: false,
    openOpponentBoard: vi.fn(),
    closeOpponentBoard: vi.fn(),
    openTokenDialog: vi.fn(),
    openAttackDialog: vi.fn(),
    openArrangeTop: vi.fn(),
    openCountDialog: vi.fn(),
    requestConfirm: vi.fn(),
    triggerCandidateCount: 0,
    triggerSheetOpen: false,
    processTriggers: vi.fn(),
    closeTriggerSheet: vi.fn(),
    motionArmed: false,
    feedOpen: false,
    openFeed: vi.fn(),
    closeFeed: vi.fn(),
    overlays: null,
    shortcutsBlocked: false,
    transitionCue: null,
    dismissTransitionCue: vi.fn(),
    performDrop: vi.fn(),
    closeTransientUi: vi.fn(),
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

function dispatchTouchTap(element: Element, x = 20, y = 20): void {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    element.dispatchEvent(event);
  }
}

afterEach(() => {
  vi.useRealTimers();
  useGameStore.setState({ state: null });
  document.body.replaceChildren();
});

describe('high-frequency HUD interactions', () => {
  it('uses one touch tap for preview and a second tap for detailed operations', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const openCardMenu = vi.fn();
    const controller = controllerFor(state, { openCardMenu });
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;

    act(() => dispatchTouchTap(card));
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).not.toBeNull();
    expect(openCardMenu).not.toHaveBeenCalled();

    expect(document.querySelector('.game-card-preview__actions')).toBeNull();
    act(() => dispatchTouchTap(card));
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).toBeNull();
    expect(openCardMenu).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('does not treat distant taps as a double tap', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const openCardMenu = vi.fn();
    const controller = controllerFor(state, { openCardMenu });
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;

    act(() => dispatchTouchTap(card, 20, 20));
    act(() => dispatchTouchTap(card, 60, 20));
    expect(openCardMenu).not.toHaveBeenCalled();
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).not.toBeNull();
    act(() => root.unmount());
  });

  it('toggles a battlefield card on a single desktop click', () => {
    const state = buildVisualFixture('battlefield').snapshot.state;
    const cardId = state.zones.battlefield.find((id) => state.cards[id]?.controllerId === state.localPlayerId)!;
    const before = state.cards[cardId].tapped;
    const controller = controllerFor(state);
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} />);
    const card = container.querySelector<HTMLElement>(`[data-layout-card-id="${cardId}"]`)!;

    act(() => { card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); });
    expect(useGameStore.getState().state?.cards[cardId].tapped).toBe(!before);
    act(() => root.unmount());
  });

  it('activates one modeled tap ability from the normal battlefield click', () => {
    const fixtureState = buildVisualFixture('battlefield').snapshot.state;
    const cardId = fixtureState.zones.battlefield.find((id) =>
      fixtureState.defs[fixtureState.cards[id].defId]?.typeLine.includes('Creature'))!;
    const card = fixtureState.cards[cardId];
    const sourceDef = fixtureState.defs[card.defId];
    const state = {
      ...fixtureState,
      defs: {
        ...fixtureState.defs,
        [card.defId]: {
          ...sourceDef,
          faces: sourceDef.faces.map((face, index) =>
            index === card.faceIndex ? { ...face, oracleText: '{T}: Add {G}.' } : face),
        },
      },
    };
    const controller = controllerFor(state);
    const activateAbility = vi.spyOn(controller.store, 'activateAbility');
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} />);

    act(() => {
      container.querySelector<HTMLElement>(`[data-layout-card-id="${cardId}"]`)?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      );
    });
    expect(activateAbility).toHaveBeenCalledWith(cardId, 0, { assistRestrictedMana: true });
    const quickButton = container.querySelector<HTMLButtonElement>(`[data-testid="quick-ability-${cardId}"]`)!;
    expect(quickButton.title).toContain('即時');

    // モバイルでは通常タップがpreviewのままでも、カード上の常設ボタンから1タップで起動できる。
    act(() => quickButton.click());
    expect(activateAbility).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it('opens an inline picker for multiple tap abilities and preserves the selected flat index', () => {
    const fixtureState = buildVisualFixture('battlefield').snapshot.state;
    const cardId = fixtureState.zones.battlefield.find((id) =>
      fixtureState.defs[fixtureState.cards[id].defId]?.typeLine.includes('Creature'))!;
    const card = fixtureState.cards[cardId];
    const sourceDef = fixtureState.defs[card.defId];
    const state = {
      ...fixtureState,
      defs: {
        ...fixtureState.defs,
        [card.defId]: {
          ...sourceDef,
          faces: sourceDef.faces.map((face, index) => index === card.faceIndex
            ? { ...face, oracleText: 'Flying\n{T}: Add {G}.\n{T}: Draw a card.' }
            : face),
        },
      },
    };
    const controller = controllerFor(state);
    const activateAbility = vi.spyOn(controller.store, 'activateAbility');
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} />);
    const layoutCard = container.querySelector<HTMLElement>(`[data-layout-card-id="${cardId}"]`)!;

    act(() => {
      layoutCard.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
    expect(container.querySelector(`[data-testid="quick-ability-picker-${cardId}"]`)).not.toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="quick-ability-${cardId}-2"]`)?.click();
    });
    expect(activateAbility).toHaveBeenCalledWith(cardId, 2, { assistRestrictedMana: true });
    expect(container.querySelector(`[data-testid="quick-ability-picker-${cardId}"]`)).toBeNull();
    act(() => root.unmount());
  });

  it('selects a focused candidate directly without opening card operations', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = state.zones.hand[0];
    const chooseDecisionCard = vi.fn();
    const openCardMenu = vi.fn();
    const controller = controllerFor(state, {
      openCardMenu,
      chooseDecisionCard,
      decisionFocus: {
        kind: 'discard', title: '捨てる', instruction: '選択', candidateIds: [cardId], selectedIds: [],
      },
    });
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    act(() => {
      container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      );
    });
    expect(chooseDecisionCard).toHaveBeenCalledWith(cardId);
    expect(openCardMenu).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('selects a focused stack candidate with Enter or Space', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const cardId = state.zones.stack.find((id) => !state.cards[id].isAbility)!;
    const chooseDecisionCard = vi.fn();
    const controller = controllerFor(state, {
      chooseDecisionCard,
      decisionFocus: {
        kind: 'target', title: '対象を選択', instruction: '選択', candidateIds: [cardId], selectedIds: [],
      },
    });
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} />);
    const layoutCard = container.querySelector<HTMLElement>(`[data-layout-card-id="${cardId}"]`)!;

    act(() => { layoutCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    act(() => { layoutCard.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });

    expect(chooseDecisionCard).toHaveBeenCalledTimes(2);
    expect(chooseDecisionCard).toHaveBeenNthCalledWith(1, cardId);
    act(() => root.unmount());
  });

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

  it('keeps every card detail preview closed for the full drag gesture', () => {
    vi.useFakeTimers();
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;

    act(() => card.focus());
    act(() => { vi.advanceTimersByTime(150); });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).not.toBeNull();

    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
    });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).toBeNull();

    act(() => {
      card.blur();
      card.focus();
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).toBeNull();

    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
      vi.advanceTimersByTime(0);
      card.blur();
      card.focus();
      vi.advanceTimersByTime(150);
    });
    expect(document.querySelector(`[data-testid="card-preview-${cardId}"]`)).not.toBeNull();
    act(() => root.unmount());
  });

  it('dismisses a pinned card detail preview on an outside press or Escape', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;
    const preview = () => document.querySelector(`[data-testid="card-preview-${cardId}"]`);

    act(() => { card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(preview()).not.toBeNull();

    // 固定はフォーカスが外れても残る(これが pin の意味)。
    act(() => card.blur());
    expect(preview()).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(preview()).toBeNull();

    act(() => { card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(preview()).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(preview()).toBeNull();

    act(() => root.unmount());
  });

  it('keeps at most one pinned preview when a second card is clicked', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const [firstId, secondId] = state.zones.hand;
    const { container, root } = mount(
      <>
        <GameCard controller={controller} cardId={firstId} size="hand" />
        <GameCard controller={controller} cardId={secondId} size="hand" />
      </>,
    );
    const cardOf = (id: string) => container.querySelector<HTMLElement>(`[data-testid="card-${id}"]`)!;

    act(() => { cardOf(firstId).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(document.querySelector(`[data-testid="card-preview-${firstId}"]`)).not.toBeNull();

    // 2枚目を押す = 1枚目にとっては外側の pointerdown。積み上がってはならない。
    act(() => {
      cardOf(secondId).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      cardOf(secondId).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(document.querySelector(`[data-testid="card-preview-${firstId}"]`)).toBeNull();
    expect(document.querySelector(`[data-testid="card-preview-${secondId}"]`)).not.toBeNull();
    expect(document.querySelectorAll('.game-card-preview')).toHaveLength(1);

    act(() => root.unmount());
  });

  it('lets transient previews close again after a double click on a pinned card', () => {
    vi.useFakeTimers();
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const cardId = state.zones.hand[0];
    const { container, root } = mount(<GameCard controller={controller} cardId={cardId} size="hand" />);
    const card = container.querySelector<HTMLElement>(`[data-testid="card-${cardId}"]`)!;
    const preview = () => document.querySelector(`[data-testid="card-preview-${cardId}"]`);

    act(() => { card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    act(() => { card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(preview()).toBeNull();

    // pin が残っていると、この一時プレビューが二度と閉じなくなる。
    act(() => card.focus());
    act(() => { vi.advanceTimersByTime(150); });
    expect(preview()).not.toBeNull();
    act(() => card.blur());
    expect(preview()).toBeNull();

    act(() => root.unmount());
  });

  it('never registers a stack item as draggable', () => {
    // 汎用 D&D の move-zone は resolveTop/removeStackItem を迂回して解決時効果(CR608)を
    // 落とす。dragIntent 側のガードが意味論を守るが、誘い自体を出さない第一層もここで固定する。
    const state = buildVisualFixture('stack').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(
      <DndContext>
        <StackBand controller={controller} />
      </DndContext>,
    );
    const stackCards = container.querySelectorAll('.stack-pile__card .card-view');
    expect(stackCards.length).toBeGreaterThan(0);
    stackCards.forEach((card) => {
      expect(card.hasAttribute('aria-roledescription')).toBe(false);
    });
    act(() => root.unmount());
  });

  it('exposes direct stack actions and lets the rail select one target story at a time', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(
      <DndContext>
        <StackBand controller={controller} />
      </DndContext>,
    );

    // 旧来の直接解決ボタン・応答ボタンは廃止(⋯オーバーフローへ移行)。
    expect(container.querySelector('[data-testid="stack-band-resolve-top"]')).toBeNull();
    expect(container.querySelector('[data-testid="stack-band-resolve-all"]')).toBeNull();
    expect(container.querySelector('[data-testid="stack-band-respond"]')).toBeNull();
    expect(container.querySelector('[data-testid="stack-compact-trigger"]')).not.toBeNull();

    // パイルはデフォルト折り畳み。展開してからリストの選択挙動を検証する。
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="stack-compact-trigger"]')?.click();
    });
    const items = container.querySelectorAll<HTMLElement>('.stack-pile__list [data-testid^="stack-workspace-item-"]');
    expect(items.length).toBeGreaterThan(1);
    expect(items[0]?.classList.contains('is-selected')).toBe(true);
    act(() => {
      items[1]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(items[0]?.classList.contains('is-selected')).toBe(false);
    expect(items[1]?.classList.contains('is-selected')).toBe(true);
    act(() => root.unmount());
  });

  it('opens the compact stack workspace while a stack target decision is active', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const cardId = state.zones.stack.find((id) => !state.cards[id].isAbility)!;
    const controller = controllerFor(state, {
      decisionFocus: {
        kind: 'target', title: '対象を選択', instruction: '選択', candidateIds: [cardId], selectedIds: [],
      },
    });
    const { container, root } = mount(<StackBand controller={controller} />);

    expect(container.querySelector('[data-testid="stack-band"]')?.getAttribute('data-expanded')).toBe('true');
    act(() => root.unmount());
  });

  it('opens once per stack session and keeps a manual close until the stack becomes empty', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const controller = controllerFor(initial);
    const { container, root } = mount(<StackBand controller={controller} />);
    const band = () => container.querySelector('[data-testid="stack-band"]');

    // デフォルトは折り畳み。
    expect(band()?.getAttribute('data-expanded')).toBeNull();
    expect(container.querySelector('[data-testid="stack-compact-trigger"]')).not.toBeNull();

    // trigger クリックで展開。
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="stack-compact-trigger"]')?.click());
    expect(band()?.getAttribute('data-expanded')).toBe('true');

    // Escape で折り畳み。
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(band()?.getAttribute('data-expanded')).toBeNull();

    // 同一セッションにアイテムを追加しても折り畳み維持。
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const withAnotherItem = applyCommand(initial, { type: 'copyStackItem', cardId: sourceId }).state;
    act(() => root.render(<StackBand controller={controllerFor(withAnotherItem)} />));
    expect(band()?.getAttribute('data-expanded')).toBeNull();

    // スタックが空になり新セッションが始まってもデフォルト折り畳み。
    const empty = {
      ...withAnotherItem,
      zones: { ...withAnotherItem.zones, stack: [] },
    };
    const bottomStackId = initial.zones.stack[0];
    const newSession = {
      ...initial,
      cards: {
        ...initial.cards,
        [bottomStackId]: {
          ...initial.cards[bottomStackId],
          zoneChangeCounter: initial.cards[bottomStackId].zoneChangeCounter + 1,
        },
      },
    };
    act(() => root.render(<StackBand controller={controllerFor(empty)} />));
    act(() => root.render(<StackBand controller={controllerFor(newSession)} />));
    expect(band()?.getAttribute('data-expanded')).toBeNull();

    // 新セッションでも trigger で展開→Escape で折り畳みが機能する。
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="stack-compact-trigger"]')?.click());
    expect(band()?.getAttribute('data-expanded')).toBe('true');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(band()?.getAttribute('data-expanded')).toBeNull();
    act(() => root.unmount());
  });

  it('marks an undecided opening hand for the staggered deal ritual', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const openingController = {
      ...controller,
      store: { ...controller.store, mulliganDecisionPending: true },
    } as GameController;
    const { container, root } = mount(<HandRibbon controller={openingController} />);

    expect(container.querySelector('[data-testid="hand-ribbon"]')?.getAttribute('data-opening-hand')).toBe('true');
    expect(container.querySelector<HTMLElement>('.hand-ribbon__slot')?.style.getPropertyValue('--deal-index')).toBe('0');
    act(() => root.unmount());
  });

  it('shows a non-draw board change as a short cue and opens the full feed on request', () => {
    vi.useFakeTimers();
    const state = buildVisualFixture('hand7').snapshot.state;
    const openFeed = vi.fn();
    const controller = controllerFor(state, { motionArmed: true, openFeed });
    const { container, root } = mount(<RecentCue controller={controller} />);

    act(() => useGameStore.getState().dispatch({ type: 'adjustLife', delta: -1 }));
    const nextState = useGameStore.getState().state;
    act(() => root.render(<RecentCue controller={{ ...controller, state: nextState, store: useGameStore.getState() }} />));
    const cue = container.querySelector<HTMLButtonElement>('[data-testid="recent-cue"]');
    expect(cue?.textContent).toContain('ライフ');
    act(() => cue?.click());
    expect(openFeed).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('moves a manual draw into the central presentation lane instead of the top cue', () => {
    vi.useFakeTimers();
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state, { motionArmed: true });
    const { container, root } = mount(
      <>
        <PresentationLayer controller={controller} />
        <RecentCue controller={controller} />
      </>,
    );

    act(() => useGameStore.getState().draw(1));
    const nextState = useGameStore.getState().state;
    const nextController = { ...controller, state: nextState, store: useGameStore.getState() };
    act(() => root.render(
      <>
        <PresentationLayer controller={nextController} />
        <RecentCue controller={nextController} />
      </>,
    ));
    expect(container.querySelector('[data-testid="draw-presentation-cue"]')?.textContent).toContain('ドロー');
    expect(container.querySelector('[data-testid="recent-cue"]')).toBeNull();
    act(() => root.unmount());
  });

  it('renders the resolved commander face in the cinematic cut-in', () => {
    const { container, root } = mount(
      <CommanderCutIn cue={{
        cardId: 'commander-1',
        faceIndex: 1,
        name: '裏面の統率者',
        typeLine: '伝説のプレインズウォーカー',
        imageUrl: 'https://example.com/back.jpg',
      }} />,
    );
    const cutIn = container.querySelector('[data-testid="commander-cutin"]');
    expect(cutIn?.textContent).toContain('《裏面の統率者》');
    expect(cutIn?.querySelector('img')?.getAttribute('src')).toBe('https://example.com/back.jpg');
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

  it('shows a decorative heartbeat glyph inside the life value (§8a)', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const heart = container.querySelector('.status-band__life-heart');
    expect(heart).not.toBeNull();
    expect(heart?.getAttribute('aria-hidden')).toBe('true');
    expect(heart?.textContent).toBe('♥');
    // The glyph lives inside the life-value button so it pulses with the life readout.
    expect(container.querySelector('[data-testid="life-value"] .status-band__life-heart')).not.toBeNull();
    act(() => root.unmount());
  });

  it('exposes an undoable manual maximum-hand-size correction in the detail sheet', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="life-value"]')?.click());
    const mode = container.querySelector<HTMLSelectElement>('[data-testid="maximum-hand-size-mode"]');
    if (!mode) throw new Error('maximum hand size mode missing');

    act(() => {
      mode.value = 'none';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useGameStore.getState().state?.players.P1?.maximumHandSizeOverride).toBe('none');
    expect(useGameStore.getState().canUndo).toBe(true);
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().state?.players.P1?.maximumHandSizeOverride).toBeUndefined();
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

  it('toggles automatic turn-start progression directly from the current phase label', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const toggle = container.querySelector<HTMLButtonElement>('[data-testid="current-phase-label"]');

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle?.querySelector('.status-band__phase-mode')?.textContent).toContain('自');
    act(() => toggle?.click());
    expect(useGameStore.getState().autoAdvanceToMain).toBe(false);
    act(() => root.render(<StatusBand controller={{ ...controller, store: useGameStore.getState() }} />));
    expect(container.querySelector('[data-testid="current-phase-label"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.status-band__phase-mode')?.textContent).toContain('手');
    act(() => useGameStore.getState().setAutoAdvance(true));
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

  it('keeps an empty land lane exposed while a hand land is being dragged', () => {
    const state = buildVisualFixture('land-drop-empty').snapshot.state;
    const landId = state.zones.hand.find((cardId) => (
      state.defs[state.cards[cardId].defId]?.typeLine?.includes('Land')
    ));
    expect(landId).toBeDefined();
    const controller = controllerFor(state);
    const { container, root } = mount(
      <SupportRow controller={controller} activeDragId={landId} />,
    );

    expect(container.querySelector('[data-testid="support-row"]')?.getAttribute('data-has-lands')).toBeNull();
    expect(container.querySelector('[data-testid="support-row"]')?.getAttribute('data-land-drop-active')).toBe('true');
    expect(container.querySelector('.land-row-wrap')?.getAttribute('data-empty')).toBe('true');
    expect(container.querySelector('.land-row-wrap')?.getAttribute('data-drop-active')).toBe('true');
    expect(container.querySelector('[data-testid="drop-play-land"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it('keeps an overflowing desktop battlefield in the adaptive lane without scroll arrows', () => {
    const state = buildVisualFixture('board-overflow').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<Board controller={controller} />);
    const shelf = container.querySelector<HTMLElement>('[data-testid="board-creatures"]')!;
    expect(container.querySelector('[data-testid="board-creatures-scroll-right"]')).toBeNull();
    expect(shelf.firstElementChild?.classList.contains('board-shelf__lane')).toBe(true);
    expect(shelf.dataset.rows).toBeDefined();
    act(() => root.unmount());
  }, 10_000);

  it('wraps a sparse battlefield in the same centerable inner lane', () => {
    const state = buildVisualFixture('board-sparse').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<Board controller={controller} />);
    const shelves = container.querySelectorAll<HTMLElement>('.board-shelf');

    expect(shelves.length).toBe(1);
    for (const shelf of shelves) {
      expect(shelf.firstElementChild?.classList.contains('board-shelf__lane')).toBe(true);
    }
    act(() => root.unmount());
  });

  it('labels the turn-start mode by its actual behavior', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<ThumbZone controller={controller} />);

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="game-menu"]')?.click());
    expect(container.querySelector('[data-testid="menu-auto-advance"]')?.textContent)
      .toContain('ターン開始: 自動でメイン1まで');
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="menu-auto-advance"]')?.click());
    expect(useGameStore.getState().autoAdvanceToMain).toBe(false);
    act(() => useGameStore.getState().setAutoAdvance(true));
    act(() => root.unmount());
  });

  it('does not show the obsolete unselected-light-track hint', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    document.documentElement.dataset.theme = 'light';
    const { container, root } = mount(<ThumbZone controller={controller} />);

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="game-menu"]')?.click());

    expect(container.querySelector('[data-testid="menu-bgm"]')?.textContent)
      .not.toContain('ライト用BGMは未選択');
    expect(container.querySelector('[data-testid="menu-event-sounds"]')?.textContent)
      .not.toContain('ライトテーマでは音は流れません');
    expect(container.querySelector('[data-testid="menu-event-sounds"] .game-menu__hint'))
      .toBeNull();
    act(() => root.unmount());
    delete document.documentElement.dataset.theme;
  });

  it('routes the trigger PrimaryAction directly instead of opening Feed', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const processTriggers = vi.fn();
    const openFeed = vi.fn();
    const controller = controllerFor(state, {
      triggerCandidateCount: 1,
      processTriggers,
      openFeed,
    });
    const { container, root } = mount(<ThumbZone controller={controller} />);
    const primary = container.querySelector<HTMLButtonElement>('[data-testid="primary-action"]');

    expect(primary?.dataset.kind).toBe('triggers');
    expect(primary?.getAttribute('aria-label')).toBe('誘発を処理 (1)');
    expect(primary?.querySelector('.thumb-zone__primary-compact')?.textContent).toBe('誘発');
    act(() => primary?.click());
    expect(processTriggers).toHaveBeenCalledTimes(1);
    expect(openFeed).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

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

  it('uses natural short Japanese in the expanded hand workspace', () => {
    const state = buildVisualFixture('hand60').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(
      <HandRibbon controller={controller} workspaceOpen onCloseWorkspace={vi.fn()} />,
    );
    expect(container.querySelector('#hand-workspace-title')?.textContent).toBe('手札一覧');
    expect(container.querySelector('.hand-ribbon__workspace-heading span')?.textContent).toBe('全体表示 · 60枚');
    expect(container.querySelector('[data-testid="close-hand-workspace"]')?.textContent).toContain('盤面へ');
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

  it('exposes only the reachable hand-scroll directions', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<HandRibbon controller={controller} workspaceOpen={false} />);
    const cards = container.querySelector<HTMLElement>('[data-testid="hand-cards"]')!;
    Object.defineProperties(cards, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    act(() => {
      cards.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    expect(cards.dataset.scrollLeft).toBeUndefined();
    expect(cards.dataset.scrollRight).toBe('true');

    cards.scrollLeft = 120;
    act(() => {
      cards.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    expect(cards.dataset.scrollLeft).toBe('true');
    expect(cards.dataset.scrollRight).toBe('true');

    cards.scrollLeft = 300;
    act(() => {
      cards.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    expect(cards.dataset.scrollLeft).toBe('true');
    expect(cards.dataset.scrollRight).toBeUndefined();
    act(() => root.unmount());
  });

  it('removes the mana continuation cue at the scroll end', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const controller = controllerFor(state);
    const { container, root } = mount(<StatusBand controller={controller} />);
    const mana = container.querySelector<HTMLElement>('[data-testid="mana-readiness"]')!;
    Object.defineProperties(mana, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    act(() => {
      mana.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    expect(mana.dataset.scrollRight).toBe('true');
    mana.scrollLeft = 300;
    act(() => {
      mana.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    expect(mana.dataset.scrollRight).toBeUndefined();
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
      zonesByPlayer: {
        ...fixtureState.zonesByPlayer,
        P1: { ...fixtureState.zonesByPlayer.P1, library: [] },
      },
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
