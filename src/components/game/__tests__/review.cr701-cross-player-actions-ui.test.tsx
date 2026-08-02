// REVIEWER-OWNED visible UI pin for engine-spec §34.53 / acceptance G9.
// Cross-player choices must expose the concrete affected player's label in rendered text.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { DEFAULT_OPPONENT_ID } from '../../../engine/types';
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
  store().newGame(makeDeck(12), 37);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  resetStore();
});

describe('review.cr701-cross-player-actions: visible affected-player label', () => {
  it.each([
    ['effect.discard', 'discard', '捨てる'],
    ['effect.sacrifice', 'sacrifice', '生け贄'],
  ] as const)('renders the opponent label for %s', (atom, kind, actionLabel) => {
    const state = store().state;
    if (!state) throw new Error('missing state');
    const sourceId = state.zonesByPlayer.P1.library[0];
    useGameStore.setState({
      pendingGuided: {
        mode: 'resolution',
        sourceId,
        commands: [],
        prompts: [{
          atom,
          kind,
          count: 1,
          playerId: DEFAULT_OPPONENT_ID,
          simultaneousGroupId: 'review-cr701-visible-label',
          raw: `Each opponent ${kind === 'discard' ? 'discards a card' : 'sacrifices a creature'}.`,
        }],
      },
    });

    act(() => root.render(<Harness />));
    const bar = container.querySelector<HTMLElement>('[data-testid="decision-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toContain('対戦相手A');
    expect(bar?.textContent).toContain(actionLabel);
  });
});
