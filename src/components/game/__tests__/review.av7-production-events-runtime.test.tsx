/**
 * review.av7-production-events-runtime — controller success boundaries at runtime.
 * Judge-owned: UI-initiated forward actions emit once; no-op/history/internal work stays silent.
 */

import { act, createRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { makeDeck, makeDef } from '../../../engine/__tests__/helpers';
import { useGameStore } from '../../../store/gameStore';
import { useGameController, type GameController } from '../gameController';
import { presentationRuntime } from '../presentation/presentationRuntime';
import type { SequencedPresentationEvent } from '../presentation/presentationSequencer';

const store = () => useGameStore.getState();

const controllerRef = createRef<GameController>();
let root: Root;
let container: HTMLElement;

const Harness = forwardRef<GameController>(function Harness(_props, ref) {
  const game = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  useImperativeHandle(ref, () => game, [game]);
  return <>{game.overlays}</>;
});

function controller(): GameController {
  if (!controllerRef.current) throw new Error('controller unavailable');
  return controllerRef.current;
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    mulliganDecisionPending: false,
  });
}

function setupOrdinaryGame(): void {
  store().newGame(makeDeck(24), 7007);
  store().keepOpeningHand();
}

function mountController(): GameController {
  act(() => root.render(<Harness ref={controllerRef} />));
  return controller();
}

function captureEvents(): {
  events: SequencedPresentationEvent[];
  unsubscribe: () => void;
} {
  const events: SequencedPresentationEvent[] = [];
  return {
    events,
    unsubscribe: presentationRuntime.subscribe((event) => events.push(event)),
  };
}

beforeEach(() => {
  resetStore();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  resetStore();
});

describe('AV7 controller event boundaries', () => {
  it('aggregates a multi-card draw and keeps empty draws plus history silent', () => {
    setupOrdinaryGame();
    const game = mountController();
    const { events, unsubscribe } = captureEvents();

    act(() => game.requestDraw(3));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'draw-completed', count: 3 });

    act(() => game.requestDraw(100));
    expect(events.filter((event) => event.kind === 'draw-completed')).toHaveLength(2);
    events.length = 0;
    act(() => game.requestDraw(1));
    act(() => game.undo());
    act(() => game.redo());
    expect(events).toEqual([]);
    unsubscribe();
  });

  it('emits one tap event for actual single/bulk changes and none for a bulk no-op', () => {
    setupOrdinaryGame();
    const cardId = store().state?.zones.hand[0];
    if (!cardId) throw new Error('hand card unavailable');
    store().moveCard(cardId, 'battlefield');
    const game = mountController();
    const { events, unsubscribe } = captureEvents();

    act(() => game.requestToggleTap(cardId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'tap-changed', cardIds: [cardId], tapped: true });

    events.length = 0;
    act(() => game.requestSetAllTapped(true));
    expect(events).toEqual([]);
    act(() => game.requestSetAllTapped(false));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'tap-changed', cardIds: [cardId], tapped: false });
    unsubscribe();
  });

  it('emits for the controller shuffle only, not an internal store shuffle', () => {
    setupOrdinaryGame();
    const game = mountController();
    const { events, unsubscribe } = captureEvents();

    act(() => game.requestShuffleLibrary());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'shuffle-completed' });

    events.length = 0;
    act(() => store().shuffleLibrary());
    expect(events).toEqual([]);
    unsubscribe();
  });

  it('waits through manual resolution, stays silent on abort, then emits once on completion', () => {
    const manual = makeDef({
      scryfallId: 'av7-manual-resolution',
      typeLine: 'Instant',
      faces: [{
        name: 'AV7 Manual Resolution',
        typeLine: 'Instant',
        oracleText: 'Do an unsupported thing.',
      }],
    });
    store().newGame([{ def: manual, isCommander: false }, ...makeDeck(16)], 7008);
    store().keepOpeningHand();
    const cardId = Object.values(store().state?.cards ?? {}).find(
      (card) => card.defId === manual.scryfallId,
    )?.id;
    if (!cardId) throw new Error('manual card unavailable');
    store().moveCard(cardId, 'stack');
    const game = mountController();
    const { events, unsubscribe } = captureEvents();

    act(() => game.requestResolveTop());
    expect(store().resolutionSession).not.toBeNull();
    expect(events).toEqual([]);

    act(() => game.undo());
    expect(store().resolutionSession).toBeNull();
    expect(store().state?.cards[cardId]?.zone).toBe('stack');
    expect(events).toEqual([]);

    act(() => controller().requestResolveTop());
    expect(events).toEqual([]);
    act(() => controller().runPrimaryAction?.());
    expect(store().state?.cards[cardId]?.zone).toBe('graveyard');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'stack-resolved', count: 1 });

    act(() => controller().undo());
    act(() => controller().redo());
    expect(events).toHaveLength(1);
    unsubscribe();
  });

  it('keeps empty resolve attempts and automatic store draws silent', () => {
    setupOrdinaryGame();
    const game = mountController();
    const { events, unsubscribe } = captureEvents();

    act(() => game.requestResolveTop());
    act(() => game.requestResolveAll());
    act(() => store().draw(1));
    expect(events).toEqual([]);
    unsubscribe();
  });
});
