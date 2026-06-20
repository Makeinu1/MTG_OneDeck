import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Playmat } from './Playmat';
import { useGameStore } from '../../store/gameStore';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';

const shortcutCapture = vi.hoisted(() => ({
  handlers: null as { onNextPhase: () => void } | null,
}));

vi.mock('../../hooks/useShortcuts', () => ({
  useShortcuts: (handlers: { onNextPhase: () => void }) => {
    shortcutCapture.handlers = handlers;
  },
}));

let activeRender: { container: HTMLDivElement; root: Root } | null = null;

function renderPlaymat() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Playmat keybindings={DEFAULT_KEYBINDINGS} />);
  });

  activeRender = { container, root };
  return activeRender;
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
  if (activeRender?.root === root) {
    activeRender = null;
  }
}

function dispatchDoubleClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
}

function dispatchClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function dispatchContextMenu(element: Element): void {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 24,
      }),
    );
  });
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const state = useGameStore.getState().state;
  if (!state) {
    throw new Error('game state is not available');
  }

  const card = Object.values(state.cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }

  return card.id;
}

function makeRuleActionDef(scryfallId: string, oracleText: string, typeLine = 'Sorcery') {
  return makeDef({
    scryfallId,
    typeLine,
    faces: [{ name: scryfallId, typeLine, oracleText }],
  });
}

function startGameWithDefs(defs: ReturnType<typeof makeDef>[]): void {
  act(() => {
    useGameStore
      .getState()
      .newGame([...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(12)], 1);
    useGameStore.getState().keepOpeningHand();
  });
}

function setupRuleActionGame({
  sourceDef,
  targetDef,
  sourceZone = 'hand',
}: {
  sourceDef: ReturnType<typeof makeDef>;
  targetDef: ReturnType<typeof makeDef>;
  sourceZone?: 'hand' | 'battlefield';
}): { sourceId: string; targetId: string } {
  startGameWithDefs([sourceDef, targetDef]);
  const sourceId = findInstanceId(sourceDef.scryfallId);
  const targetId = findInstanceId(targetDef.scryfallId);

  act(() => {
    useGameStore.getState().moveCard(sourceId, sourceZone);
    useGameStore.getState().moveCard(targetId, 'battlefield');
  });

  return { sourceId, targetId };
}

describe('Playmat', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    vi.restoreAllMocks();
    shortcutCapture.handlers = null;
  });

  afterEach(() => {
    if (activeRender) {
      cleanupRender(activeRender.root, activeRender.container);
    }
    document.body.innerHTML = '';
  });

  it('renders the mulligan decision as a panel without a blocking modal backdrop', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
    });

    const handCardId = useGameStore.getState().state?.zones.hand[0];
    if (!handCardId) {
      throw new Error('opening hand card was not created');
    }

    const { container, root } = renderPlaymat();

    expect(container.querySelector('[data-testid="mulligan-decision-dialog"]')).not.toBeNull();
    expect(container.querySelector('.modal-backdrop')).toBeNull();
    expect(container.querySelector(`[data-testid="card-${handCardId}"]`)).not.toBeNull();

    cleanupRender(root, container);
  });

  it('double-clicking a hand spell routes through castToStack', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
    });
    const store = useGameStore.getState();
    const handCardId = store.state?.zones.hand[0];
    if (!handCardId) {
      throw new Error('hand card was not created');
    }

    const castToStack = vi.spyOn(store, 'castToStack').mockReturnValue('ok');
    const castFromHand = vi.spyOn(store, 'castFromHand').mockReturnValue('ok');
    const { container, root } = renderPlaymat();

    const card = container.querySelector(`[data-testid="card-${handCardId}"]`);
    if (!card) {
      throw new Error('hand card element was not rendered');
    }

    dispatchDoubleClick(card);

    expect(castToStack).toHaveBeenCalledWith(handCardId, { xValue: 0 });
    expect(castFromHand).not.toHaveBeenCalled();

    cleanupRender(root, container);
  });

  it('double-clicking the commander routes through castToStack', () => {
    const commander = makeDef({
      scryfallId: 'playmat-commander',
      typeLine: 'Legendary Creature',
    });
    act(() => {
      useGameStore.getState().newGame(makeDeck(12, [commander]), 1);
    });
    const store = useGameStore.getState();
    const commanderId = store.state?.zones.command[0];
    if (!commanderId) {
      throw new Error('commander card was not created');
    }

    const castToStack = vi.spyOn(store, 'castToStack').mockReturnValue('ok');
    const castCommander = vi.spyOn(store, 'castCommander').mockReturnValue('ok');
    const { container, root } = renderPlaymat();

    const card = container.querySelector(`[data-testid="card-${commanderId}"]`);
    if (!card) {
      throw new Error('commander card element was not rendered');
    }

    dispatchDoubleClick(card);

    expect(castToStack).toHaveBeenCalledWith(commanderId, { xValue: 0 });
    expect(castCommander).not.toHaveBeenCalled();

    cleanupRender(root, container);
  });

  it('uses ArrowUp to resolve the top of the stack before advancing the phase', () => {
    const stackCreature = makeDef({
      scryfallId: 'playmat-stack-creature',
      typeLine: 'Creature — Bear',
    });

    act(() => {
      useGameStore
        .getState()
        .newGame([{ def: stackCreature, isCommander: false }, ...makeDeck(12)], 1);
      useGameStore.getState().keepOpeningHand();
      useGameStore.getState().beginFirstTurn();
    });

    const handCardId = findInstanceId('playmat-stack-creature');

    act(() => {
      useGameStore.getState().moveCard(handCardId, 'hand');
      useGameStore.getState().moveCard(handCardId, 'stack');
    });
    const { container, root } = renderPlaymat();
    const before = useGameStore.getState().state;
    if (!before) {
      throw new Error('game state was not available before resolving the stack');
    }
    expect(before.phase).toBe('main1');
    expect(before.zones.stack).toEqual([handCardId]);

    if (!shortcutCapture.handlers) {
      throw new Error('shortcut handlers were not registered');
    }

    act(() => {
      shortcutCapture.handlers?.onNextPhase();
    });

    const after = useGameStore.getState().state;
    if (!after) {
      throw new Error('game state was not available after resolving the stack');
    }

    expect(after.phase).toBe('main1');
    expect(after.zones.stack).toHaveLength(0);
    expect(after.zones.battlefield).toContain(handCardId);

    cleanupRender(root, container);
  });

  it('uses ArrowUp to advance the phase when the stack is empty', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
      useGameStore.getState().keepOpeningHand();
      useGameStore.getState().beginFirstTurn();
    });

    const { container, root } = renderPlaymat();
    const before = useGameStore.getState().state;
    if (!before) {
      throw new Error('game state was not available before advancing the phase');
    }
    expect(before.phase).toBe('main1');
    expect(before.zones.stack).toHaveLength(0);

    if (!shortcutCapture.handlers) {
      throw new Error('shortcut handlers were not registered');
    }

    act(() => {
      shortcutCapture.handlers?.onNextPhase();
    });

    const after = useGameStore.getState().state;
    if (!after) {
      throw new Error('game state was not available after advancing the phase');
    }

    expect(after.phase).toBe('combat');
    expect(after.zones.stack).toHaveLength(0);

    cleanupRender(root, container);
  });

  it('disables phase and turn buttons while the stack is non-empty', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
      useGameStore.getState().keepOpeningHand();
      useGameStore.getState().beginFirstTurn();
    });
    const stackCardId = useGameStore.getState().state?.zones.hand[0];
    if (!stackCardId) {
      throw new Error('stack card was not available');
    }

    act(() => {
      useGameStore.getState().moveCard(stackCardId, 'stack');
    });

    const { container, root } = renderPlaymat();
    const nextPhase = container.querySelector<HTMLButtonElement>('[data-testid="next-phase"]');
    const nextTurn = container.querySelector<HTMLButtonElement>('[data-testid="next-turn"]');

    expect(nextPhase?.disabled).toBe(true);
    expect(nextPhase?.title).toBe('スタックを解決してください');
    expect(nextTurn?.disabled).toBe(true);
    expect(nextTurn?.title).toBe('スタックを解決してください');

    cleanupRender(root, container);
  });

  it('opens the info panel from other actions', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
      useGameStore.getState().keepOpeningHand();
    });

    const { container, root } = renderPlaymat();
    const otherActions = container.querySelector('[data-testid="other-actions"]');
    if (!otherActions) {
      throw new Error('other actions button was not rendered');
    }

    dispatchClick(otherActions);

    const infoButton = container.querySelector('[data-testid="game-info-open"]');
    if (!infoButton) {
      throw new Error('game info button was not rendered');
    }

    dispatchClick(infoButton);

    expect(container.querySelector('[data-testid="game-info"]')).not.toBeNull();

    cleanupRender(root, container);
  });

  it('renders safe rule action candidates from the card context menu without changing game state', () => {
    const candidateCard = makeDef({
      scryfallId: 'playmat-candidate-actions',
      typeLine: 'Creature',
      faces: [
        {
          name: 'playmat-candidate-actions',
          typeLine: 'Creature',
          oracleText:
            'When this creature enters, draw a card. Create a Treasure token. Proliferate.',
        },
      ],
    });

    act(() => {
      useGameStore
        .getState()
        .newGame([{ def: candidateCard, isCommander: false }, ...makeDeck(12)], 1);
      useGameStore.getState().keepOpeningHand();
    });
    const candidateCardId = findInstanceId('playmat-candidate-actions');
    act(() => {
      useGameStore.getState().moveCard(candidateCardId, 'hand');
    });
    const beforeMenu = useGameStore.getState().state;
    if (!beforeMenu) {
      throw new Error('game state was not available before opening the candidate menu');
    }

    const { container, root } = renderPlaymat();
    const card = container.querySelector(`[data-testid="card-${candidateCardId}"]`);
    if (!card) {
      throw new Error('candidate card element was not rendered');
    }

    dispatchContextMenu(card);

    expect(useGameStore.getState().state).toBe(beforeMenu);
    expect(container.querySelector('[data-testid="candidate-draw"]')?.textContent).toBe('ドロー');
    expect(container.querySelector('[data-testid="candidate-token"]')?.textContent).toBe(
      'トークン生成',
    );
    expect(container.querySelector('[data-testid="candidate-proliferate"]')?.textContent).toBe(
      '増殖',
    );

    const drawCandidate = container.querySelector('[data-testid="candidate-draw"]');
    if (!drawCandidate) {
      throw new Error('draw candidate was not rendered');
    }

    dispatchClick(drawCandidate);

    expect(useGameStore.getState().state).toBe(beforeMenu);
    expect(container.querySelector('[data-testid="draw-n-confirm-dialog"]')).not.toBeNull();

    cleanupRender(root, container);
  });

  it.each([
    {
      name: 'sacrifice',
      oracleText: 'As an additional cost, sacrifice a creature.',
      candidateTestId: 'candidate-sacrifice-target',
      expectedZone: 'graveyard' as const,
    },
    {
      name: 'destroy',
      oracleText: 'Destroy target creature.',
      candidateTestId: 'candidate-destroy-target',
      expectedZone: 'graveyard' as const,
    },
    {
      name: 'exile',
      oracleText: 'Exile target permanent.',
      candidateTestId: 'candidate-exile-target',
      expectedZone: 'exile' as const,
    },
  ])(
    'runs $name target candidate through moveCard after target selection',
    ({ name, oracleText, candidateTestId, expectedZone }) => {
      const sourceDef = makeRuleActionDef(`playmat-${name}-source`, oracleText, 'Instant');
      const targetDef = makeDef({
        scryfallId: `playmat-${name}-target`,
        typeLine: 'Creature',
      });
      const { sourceId, targetId } = setupRuleActionGame({ sourceDef, targetDef });
      const store = useGameStore.getState();
      const moveCard = vi.spyOn(store, 'moveCard');
      const beforeMenu = store.state;
      if (!beforeMenu) {
        throw new Error('game state was not available before opening the target action menu');
      }

      const { container, root } = renderPlaymat();
      const source = container.querySelector(`[data-testid="card-${sourceId}"]`);
      if (!source) {
        throw new Error('source card element was not rendered');
      }

      dispatchContextMenu(source);
      expect(useGameStore.getState().state).toBe(beforeMenu);

      const candidate = container.querySelector(`[data-testid="${candidateTestId}"]`);
      if (!candidate) {
        throw new Error(`${candidateTestId} was not rendered`);
      }

      dispatchClick(candidate);
      expect(useGameStore.getState().state).toBe(beforeMenu);
      expect(container.querySelector('[data-testid="target-picker"]')).not.toBeNull();

      const selectTarget = container.querySelector(`[data-testid="select-target-${targetId}"]`);
      if (!selectTarget) {
        throw new Error('target select button was not rendered');
      }

      dispatchClick(selectTarget);

      expect(moveCard).toHaveBeenCalledWith(targetId, expectedZone);
      expect(useGameStore.getState().state?.cards[targetId]?.zone).toBe(expectedZone);

      act(() => {
        useGameStore.getState().undo();
      });

      expect(useGameStore.getState().state?.cards[targetId]?.zone).toBe('battlefield');

      cleanupRender(root, container);
    },
  );

  it('keeps game state unchanged when target picker is opened and canceled', () => {
    const sourceDef = makeRuleActionDef(
      'playmat-cancel-source',
      'Destroy target creature.',
      'Instant',
    );
    const targetDef = makeDef({
      scryfallId: 'playmat-cancel-target',
      typeLine: 'Creature',
    });
    const { sourceId } = setupRuleActionGame({ sourceDef, targetDef });
    const beforeMenu = useGameStore.getState().state;
    if (!beforeMenu) {
      throw new Error('game state was not available before opening the target picker');
    }

    const { container, root } = renderPlaymat();
    const source = container.querySelector(`[data-testid="card-${sourceId}"]`);
    if (!source) {
      throw new Error('source card element was not rendered');
    }

    dispatchContextMenu(source);
    const candidate = container.querySelector('[data-testid="candidate-destroy-target"]');
    if (!candidate) {
      throw new Error('destroy target candidate was not rendered');
    }

    dispatchClick(candidate);
    expect(container.querySelector('[data-testid="target-picker"]')).not.toBeNull();
    expect(useGameStore.getState().state).toBe(beforeMenu);

    const cancel = container.querySelector('[data-testid="target-picker-cancel"]');
    if (!cancel) {
      throw new Error('target picker cancel button was not rendered');
    }

    dispatchClick(cancel);

    expect(container.querySelector('[data-testid="target-picker"]')).toBeNull();
    expect(useGameStore.getState().state).toBe(beforeMenu);

    cleanupRender(root, container);
  });

  it('runs counters target candidate through addCounters dispatch', () => {
    const sourceDef = makeRuleActionDef(
      'playmat-counters-source',
      'Put a +1/+1 counter on target creature.',
      'Instant',
    );
    const targetDef = makeDef({
      scryfallId: 'playmat-counters-target',
      typeLine: 'Creature',
    });
    const { sourceId, targetId } = setupRuleActionGame({ sourceDef, targetDef });
    const store = useGameStore.getState();
    const dispatch = vi.spyOn(store, 'dispatch');

    const { container, root } = renderPlaymat();
    const source = container.querySelector(`[data-testid="card-${sourceId}"]`);
    if (!source) {
      throw new Error('source card element was not rendered');
    }

    dispatchContextMenu(source);
    const candidate = container.querySelector('[data-testid="candidate-counters-target"]');
    if (!candidate) {
      throw new Error('counters target candidate was not rendered');
    }

    dispatchClick(candidate);
    const selectTarget = container.querySelector(`[data-testid="select-target-${targetId}"]`);
    if (!selectTarget) {
      throw new Error('target select button was not rendered');
    }

    dispatchClick(selectTarget);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'addCounters',
      cardId: targetId,
      counterType: '+1/+1',
      delta: 1,
    });
    expect(useGameStore.getState().state?.cards[targetId]?.counters['+1/+1']).toBe(1);

    cleanupRender(root, container);
  });

  it('runs attach target candidate through attach dispatch and sets attachedTo', () => {
    const sourceDef = makeRuleActionDef(
      'playmat-attach-source',
      'Equip {2}',
      'Artifact — Equipment',
    );
    const creatureDef = makeDef({
      scryfallId: 'playmat-attach-creature',
      typeLine: 'Creature',
    });
    const artifactDef = makeDef({
      scryfallId: 'playmat-attach-artifact',
      typeLine: 'Artifact',
    });
    startGameWithDefs([sourceDef, creatureDef, artifactDef]);
    const sourceId = findInstanceId('playmat-attach-source');
    const creatureId = findInstanceId('playmat-attach-creature');
    const artifactId = findInstanceId('playmat-attach-artifact');

    act(() => {
      useGameStore.getState().moveCard(sourceId, 'battlefield');
      useGameStore.getState().moveCard(creatureId, 'battlefield');
      useGameStore.getState().moveCard(artifactId, 'battlefield');
    });

    const store = useGameStore.getState();
    const dispatch = vi.spyOn(store, 'dispatch');
    const { container, root } = renderPlaymat();
    const source = container.querySelector(`[data-testid="card-${sourceId}"]`);
    if (!source) {
      throw new Error('equipment source element was not rendered');
    }

    dispatchContextMenu(source);
    const candidate = container.querySelector('[data-testid="candidate-attach-target"]');
    if (!candidate) {
      throw new Error('attach target candidate was not rendered');
    }

    dispatchClick(candidate);

    expect(container.querySelector(`[data-testid="select-target-${creatureId}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-testid="select-target-${artifactId}"]`)).toBeNull();

    const selectCreature = container.querySelector(`[data-testid="select-target-${creatureId}"]`);
    if (!selectCreature) {
      throw new Error('creature target select button was not rendered');
    }

    dispatchClick(selectCreature);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'attach',
      cardId: sourceId,
      to: creatureId,
    });
    expect(useGameStore.getState().state?.cards[sourceId]?.attachedTo).toBe(creatureId);

    cleanupRender(root, container);
  });
});
