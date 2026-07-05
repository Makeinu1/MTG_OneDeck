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

function moveToLibrary(cardId: string): void {
  store().moveCard(cardId, 'library', 'bottom');
}

describe('CR 701.23/701.24 guided single-card ramp search resolution', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves Nature's Lore by moving a Forest card to the battlefield and shuffling without it", () => {
    const spell = makeDef({
      scryfallId: 'cr701-natures-lore',
      name: "Nature's Lore",
      typeLine: 'Sorcery',
      faces: [
        {
          name: "Nature's Lore",
          typeLine: 'Sorcery',
          oracleText:
            "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
        },
      ],
    });
    const forestLand = makeDef({
      scryfallId: 'cr701-stomping-ground',
      name: 'Stomping Ground',
      typeLine: 'Land - Mountain Forest',
      faces: [{ name: 'Stomping Ground', typeLine: 'Land - Mountain Forest' }],
    });
    const island = makeDef({
      scryfallId: 'cr701-island',
      name: 'Island',
      typeLine: 'Basic Land - Island',
      faces: [{ name: 'Island', typeLine: 'Basic Land - Island' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: forestLand, isCommander: false },
        { def: island, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const sourceId = findInstanceId('cr701-natures-lore');
    const forestId = findInstanceId('cr701-stomping-ground');
    store().moveCard(sourceId, 'stack', 'bottom');
    moveToLibrary(forestId);
    const beforeLibrary = store().state!.zones.library.slice();

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.search',
      kind: 'library-search',
      librarySearch: {
        filter: { kind: 'land-subtype', subtype: 'Forest' },
        entersTapped: false,
      },
    });

    store().confirmGuidedLibrarySearch(forestId);

    const state = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(state.cards[forestId].zone).toBe('battlefield');
    expect(state.cards[forestId].tapped).toBe(false);
    expect(state.cards[sourceId].zone).toBe('graveyard');
    expect(state.zones.stack).not.toContain(sourceId);
    expect([...state.zones.library].sort()).toEqual(
      beforeLibrary.filter((cardId) => cardId !== forestId).sort(),
    );
    expect(state.log.map((entry) => entry.message)).toContain('ライブラリをシャッフルしました。');
  });

  it('resolves Rampant Growth tapped and rejects a nonbasic Forest for the basic-land filter', () => {
    const spell = makeDef({
      scryfallId: 'cr701-rampant-growth',
      name: 'Rampant Growth',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'Rampant Growth',
          typeLine: 'Sorcery',
          oracleText:
            'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
        },
      ],
    });
    const nonbasicForest = makeDef({
      scryfallId: 'cr701-nonbasic-forest',
      name: 'Nonbasic Forest',
      typeLine: 'Land - Forest',
      faces: [{ name: 'Nonbasic Forest', typeLine: 'Land - Forest' }],
    });
    const basicForest = makeDef({
      scryfallId: 'cr701-basic-forest',
      name: 'Forest',
      typeLine: 'Basic Land - Forest',
      faces: [{ name: 'Forest', typeLine: 'Basic Land - Forest' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: nonbasicForest, isCommander: false },
        { def: basicForest, isCommander: false },
        ...makeDeck(12),
      ],
      2,
    );
    const sourceId = findInstanceId('cr701-rampant-growth');
    const nonbasicId = findInstanceId('cr701-nonbasic-forest');
    const basicId = findInstanceId('cr701-basic-forest');
    store().moveCard(sourceId, 'stack', 'bottom');
    moveToLibrary(nonbasicId);
    moveToLibrary(basicId);

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.search',
      kind: 'library-search',
      librarySearch: {
        filter: { kind: 'basic-land' },
        entersTapped: true,
      },
    });

    store().confirmGuidedLibrarySearch(nonbasicId);
    expect(store().pendingGuided?.prompts[0].kind).toBe('library-search');
    expect(store().state!.cards[nonbasicId].zone).toBe('library');
    expect(store().state!.cards[sourceId].zone).toBe('stack');
    expect(store().warnings.at(-1)).toContain('サーチ条件に合いません');

    store().confirmGuidedLibrarySearch(basicId);

    const state = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(state.cards[basicId].zone).toBe('battlefield');
    expect(state.cards[basicId].tapped).toBe(true);
    expect(state.cards[sourceId].zone).toBe('graveyard');
    expect(state.zones.library).not.toContain(basicId);
    expect(state.log.map((entry) => entry.message)).toContain('ライブラリをシャッフルしました。');
  });
});
