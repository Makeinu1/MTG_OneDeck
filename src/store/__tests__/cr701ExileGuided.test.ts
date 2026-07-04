import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

describe('CR 701.13 guided exile resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('exiles the selected legal target and rejects a target outside the filter', () => {
    const spell = makeDef({
      scryfallId: 'cr701-exile-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-exile-spell',
          typeLine: 'Sorcery',
          oracleText: 'Exile target creature.',
        },
      ],
    });
    const creature = makeDef({
      scryfallId: 'cr701-exile-creature',
      typeLine: 'Creature',
      faces: [{ name: 'cr701-exile-creature', typeLine: 'Creature' }],
    });
    const artifact = makeDef({
      scryfallId: 'cr701-exile-artifact',
      typeLine: 'Artifact',
      faces: [{ name: 'cr701-exile-artifact', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: creature, isCommander: false },
        { def: artifact, isCommander: false },
      ],
      1,
    );
    const sourceId = findInstanceId('cr701-exile-spell');
    const creatureId = findInstanceId('cr701-exile-creature');
    const artifactId = findInstanceId('cr701-exile-artifact');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().moveCard(creatureId, 'battlefield', 'bottom');
    store().moveCard(artifactId, 'battlefield', 'bottom');

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: { types: ['creature'] },
    });

    store().confirmGuidedTarget(artifactId);
    expect(store().state!.cards[artifactId].zone).toBe('battlefield');
    expect(store().pendingGuided?.prompts[0].kind).toBe('target');
    expect(store().warnings.at(-1)).toContain('対象候補にありません');

    store().confirmGuidedTarget(creatureId);

    const state = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(state.cards[creatureId].zone).toBe('exile');
    expect(state.cards[sourceId].zone).toBe('graveyard');
    expect(state.zones.stack).not.toContain(sourceId);
  });
});
