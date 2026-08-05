// REVIEWER-OWNED visible UI pin for engine-spec §34.55 / feel-2.
// The DecisionBar must surface an explicit "choose zero / stop discarding"
// confirm affordance whenever the current guided prompt makes a legal zero
// choice possible (CR 115.6 / CR 608.2h), while the existing cancel affordance
// stays present and the minimal display contract (review.s4-decision-bar) holds.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { useGameStore } from '../../../store/gameStore';
import { DecisionBar } from '../DecisionBar';
import { useGameController } from '../gameController';

const store = () => useGameStore.getState();

function Harness() {
  const controller = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  return <DecisionBar controller={controller} />;
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
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
  localStorage.clear();
}

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  resetStore();
  store().newGame(makeDeck(12), 17);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  resetStore();
});

describe('review.feel-2-zero-choice-ui: explicit legal-zero affordance', () => {
  it('shows the zero-target confirm for a minCount 0 target prompt and keeps cancel', () => {
    const state = store().state;
    if (!state) throw new Error('missing state');
    const sourceId = state.zonesByPlayer.P1.library[0];
    useGameStore.setState({
      pendingGuided: {
        mode: 'resolution',
        sourceId,
        commands: [],
        prompts: [{
          atom: 'effect.exile',
          kind: 'target',
          count: 1,
          minCount: 0,
          filter: { types: ['permanent'] },
          raw: 'Exile up to one target permanent.',
        }],
      },
    });

    act(() => root.render(<Harness />));
    const bar = container.querySelector<HTMLElement>('[data-testid="decision-bar"]');
    expect(bar).not.toBeNull();
    const zero = container.querySelector<HTMLElement>('[data-testid="guided-zero-confirm"]');
    expect(zero).not.toBeNull();
    expect(zero?.textContent).toContain('対象を選ばない');
    expect(container.querySelector('.decision-bar__cancel')).not.toBeNull();
  });

  it('shows the stop-discarding confirm for a variableLoot discard prompt', () => {
    const state = store().state;
    if (!state) throw new Error('missing state');
    const sourceId = state.zonesByPlayer.P1.library[0];
    useGameStore.setState({
      pendingGuided: {
        mode: 'resolution',
        sourceId,
        commands: [],
        prompts: [{
          atom: 'effect.discard',
          kind: 'discard',
          count: 1,
          variableLoot: { max: 2, drawDelta: 0, discarded: 0 },
          raw: 'Discard up to two cards, then draw that many cards.',
        }],
      },
    });

    act(() => root.render(<Harness />));
    const zero = container.querySelector<HTMLElement>('[data-testid="guided-zero-confirm"]');
    expect(zero).not.toBeNull();
    expect(zero?.textContent).toContain('捨てるのをやめる');
  });

  it('does NOT show a zero-choice affordance for a required (minCount >= 1) target prompt', () => {
    const state = store().state;
    if (!state) throw new Error('missing state');
    const sourceId = state.zonesByPlayer.P1.library[0];
    useGameStore.setState({
      pendingGuided: {
        mode: 'resolution',
        sourceId,
        commands: [],
        prompts: [{
          atom: 'effect.destroy',
          kind: 'target',
          count: 1,
          filter: { types: ['creature'] },
          raw: 'Destroy target creature.',
        }],
      },
    });

    act(() => root.render(<Harness />));
    expect(container.querySelector('[data-testid="guided-zero-confirm"]')).toBeNull();
    expect(container.querySelector('.decision-bar__cancel')).not.toBeNull();
  });

  it('clicking the zero-target confirm calls confirmGuidedZeroChoice (store integration)', async () => {
    const state = store().state;
    if (!state) throw new Error('missing state');
    const sourceId = state.zonesByPlayer.P1.library[0];
    useGameStore.setState({
      pendingGuided: {
        mode: 'resolution',
        sourceId,
        commands: [],
        prompts: [{
          atom: 'effect.exile',
          kind: 'target',
          count: 1,
          minCount: 0,
          filter: { types: ['permanent'] },
          raw: 'Exile up to one target permanent.',
        }],
      },
    });

    await act(async () => root.render(<Harness />));
    const zero = container.querySelector<HTMLElement>('[data-testid="guided-zero-confirm"]');
    expect(zero).not.toBeNull();
    await act(async () => zero?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(store().pendingGuided).toBeNull();
  });
});
