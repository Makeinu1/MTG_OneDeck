import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
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

describe('CR 701.24 shuffle auto resolution', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a pure shuffle spell using a precomputed deterministic library order', () => {
    const spell = makeDef({
      scryfallId: 'cr701-shuffle-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-shuffle-spell',
          typeLine: 'Sorcery',
          oracleText: 'Shuffle your library.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(20)], 1);
    const sourceId = findInstanceId('cr701-shuffle-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const beforeLibrary = store().state!.zones.library.slice();

    store().resolveTop();

    const state = store().state!;
    expect([...state.zones.library].sort()).toEqual([...beforeLibrary].sort());
    expect(state.zones.library).not.toEqual(beforeLibrary);
    expect(state.cards[sourceId].zone).toBe('graveyard');
    expect(state.zones.stack).not.toContain(sourceId);
    expect(state.log.map((entry) => entry.message)).toContain('ライブラリをシャッフルしました。');
  });

  it('does not shuffle a search instruction that still needs manual card choice', () => {
    const spell = makeDef({
      scryfallId: 'cr701-search-shuffle-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-search-shuffle-spell',
          typeLine: 'Sorcery',
          oracleText:
            'Search your library for a basic land card, put it into your hand, then shuffle.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(20)], 1);
    const sourceId = findInstanceId('cr701-search-shuffle-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const beforeLibrary = store().state!.zones.library.slice();

    store().resolveTop();

    const state = store().state!;
    expect(state.zones.library).toEqual(beforeLibrary);
    expect(state.cards[sourceId].zone).toBe('stack');
    expect(store().resolutionSession).toMatchObject({
      sourceId,
      stage: 'manual-required',
      reason: 'unsupported',
    });
    expect(state.log.map((entry) => entry.message)).not.toContain('ライブラリをシャッフルしました。');
  });
});
