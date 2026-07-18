import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function findInstance(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing ${defId}`);
  return card.id;
}

describe('gameplay interaction undo', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      pendingCommanderResolution: null,
      pendingForceActivation: null,
      canUndo: false,
      canRedo: false,
      canUndoInteraction: false,
      canRedoInteraction: false,
      mulliganDecisionPending: false,
    });
  });

  it('undoes a target choice before closing the pending flow or touching board history', () => {
    const source = makeDef({
      scryfallId: 'interaction-source',
      typeLine: 'Artifact',
      faces: [{
        name: 'interaction-source',
        typeLine: 'Artifact',
        oracleText: '{T}, Discard a card: Tap target creature.',
      }],
    });
    const target = makeDef({
      scryfallId: 'interaction-target',
      typeLine: 'Creature — Bear',
      faces: [{ name: 'interaction-target', typeLine: 'Creature — Bear' }],
    });
    store().newGame(
      [{ def: source, isCommander: false }, { def: target, isCommander: false }, ...makeDeck(12)],
      81,
    );
    const sourceId = findInstance('interaction-source');
    const targetId = findInstance('interaction-target');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');

    const boardBeforeChoice = store().state;
    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('target');
    expect(store().canUndoInteraction).toBe(true);

    store().confirmGuidedTarget(targetId);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-discard');
    expect(store().state).toBe(boardBeforeChoice);

    store().undo();
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('target');
    expect(store().state).toBe(boardBeforeChoice);
    expect(store().canRedoInteraction).toBe(true);

    store().redo();
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-discard');
    store().undo();
    store().undo();
    expect(store().pendingGuided).toBeNull();
    expect(store().state).toBe(boardBeforeChoice);
    expect(store().canRedoInteraction).toBe(true);
  });

  it('closes the first pending prompt without invoking its semantic cancel action', () => {
    const source = makeDef({
      scryfallId: 'interaction-scry',
      typeLine: 'Sorcery',
      faces: [{ name: 'interaction-scry', typeLine: 'Sorcery', oracleText: 'Scry 2.' }],
    });
    store().newGame([{ def: source, isCommander: false }, ...makeDeck(12)], 82);
    const sourceId = findInstance('interaction-scry');
    store().moveCard(sourceId, 'stack', 'bottom');
    const before = store().state;

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('scry-surveil');
    store().undo();

    expect(store().pendingGuided).toBeNull();
    expect(store().state).toBe(before);
    expect(store().state?.cards[sourceId].zone).toBe('stack');
  });
});
