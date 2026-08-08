/**
 * Judge-owned acceptance pin for feel-5 land bundle bulk tap.
 * Implementers must not edit this file; fix source when it fails.
 */

import { act, createRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { useGameStore } from '../../../store/gameStore';
import { LandRow } from '../LandRow';
import { useGameController, type GameController } from '../gameController';
import { presentationRuntime } from '../presentation/presentationRuntime';
import type { SequencedPresentationEvent } from '../presentation/presentationSequencer';

const controllerRef = createRef<GameController>();
let root: Root;
let container: HTMLElement;

const Harness = forwardRef<GameController>(function Harness(_props, ref) {
  const game = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  useImperativeHandle(ref, () => game, [game]);
  return <LandRow controller={game} />;
});

function store() {
  return useGameStore.getState();
}

function captureEvents(): { events: SequencedPresentationEvent[]; unsubscribe: () => void } {
  const events: SequencedPresentationEvent[] = [];
  return { events, unsubscribe: presentationRuntime.subscribe((event) => events.push(event)) };
}

function mount(): void {
  act(() => root.render(<Harness ref={controllerRef} />));
}

function setup(): void {
  const state = buildVisualFixture('lands').snapshot.state;
  useGameStore.setState({
    state,
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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mount();
}

function bundleCards(): string[] {
  const bundle = container.querySelector<HTMLElement>('.land-bundle[data-testid^="land-bundle-basic:"]');
  if (!bundle) throw new Error('basic land bundle unavailable');
  return Array.from(bundle.querySelectorAll<HTMLElement>('[data-layout-card-id]'))
    .map((card) => card.dataset.layoutCardId)
    .filter((id): id is string => Boolean(id));
}

describe('feel-5 land bundle bulk tap', () => {
  beforeEach(setup);

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    useGameStore.setState({ state: null });
  });

  it('toggles the collapsed bundle atomically, emits one event, preserves mana, and undoes as one step', () => {
    const ids = bundleCards();
    expect(ids.length).toBeGreaterThan(1);
    const before = store().state;
    if (!before) throw new Error('state unavailable');
    const manaBefore = before.manaPool;
    const { events, unsubscribe } = captureEvents();
    const card = container.querySelector<HTMLElement>(`[data-layout-card-id="${ids[0]}"]`);
    void act(() => { card?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); });

    const afterTap = store().state;
    expect(afterTap).not.toBeNull();
    expect(ids.every((id) => afterTap?.cards[id]?.tapped)).toBe(true);
    expect(afterTap?.manaPool).toEqual(manaBefore);
    expect(events.filter((event) => event.kind === 'tap-changed')).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'tap-changed', cardIds: ids, tapped: true });

    void act(() => { controllerRef.current?.undo(); });
    const afterUndo = store().state;
    expect(ids.some((id) => afterUndo?.cards[id]?.tapped)).toBe(true);
    expect(afterUndo?.cards[ids[0]]?.tapped).toBe(before.cards[ids[0]]?.tapped);
    unsubscribe();
  });

  it('untaps an all-tapped bundle and leaves expanded cards on the individual route', () => {
    const ids = bundleCards();
    const bundle = container.querySelector<HTMLElement>('.land-bundle[data-testid^="land-bundle-basic:"]');
    const count = bundle?.querySelector<HTMLButtonElement>('[data-testid^="land-bundle-count-"]');
    expect(count).not.toBeNull();
    void act(() => { count?.click(); });
    expect(bundle?.dataset.expanded).toBe('true');

    const individual = container.querySelector<HTMLElement>(`[data-layout-card-id="${ids[0]}"]`);
    const { events: expandedEvents, unsubscribe: unsubscribeExpanded } = captureEvents();
    void act(() => { individual?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); });
    const afterIndividual = store().state;
    expect(afterIndividual?.cards[ids[0]]?.tapped).toBe(true);
    expect(expandedEvents).toHaveLength(1);
    expect(expandedEvents[0]).toMatchObject({ kind: 'tap-changed', cardIds: [ids[0]], tapped: true });
    unsubscribeExpanded();

    for (const id of ids) {
      if (!store().state?.cards[id]?.tapped) store().dispatch({ type: 'setTapped', cardId: id, tapped: true });
    }
    void act(() => { count?.click(); });
    expect(bundle?.dataset.expanded).toBe('false');
    const { events, unsubscribe } = captureEvents();
    void act(() => {
      bundle?.querySelector<HTMLElement>('[data-layout-card-id]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      );
    });
    expect(store().state?.cards[ids[0]]?.tapped).toBe(false);
    expect(store().state?.cards[ids[1]]?.tapped).toBe(false);
    expect(events.find((event) => event.kind === 'tap-changed')).toMatchObject({ tapped: false, cardIds: ids });
    unsubscribe();
  });
});
