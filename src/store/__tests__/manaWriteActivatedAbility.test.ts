import { beforeEach, describe, expect, it } from 'vitest';

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

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

describe('mana:write activated mana ability catalog', () => {
  beforeEach(() => {
    resetStore();
  });

  it('resolves literal multi-symbol mana abilities immediately without a stack object', () => {
    const source = makeDef({
      scryfallId: 'mana-write-literal',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-literal',
          typeLine: 'Artifact',
          oracleText: '{T}: Add {W}{U}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('mana-write-literal');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.W).toBe(1);
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('guides any-color mana choice, then resolves through the mana transaction with stack 0', () => {
    const source = makeDef({
      scryfallId: 'mana-write-any-color',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-any-color',
          typeLine: 'Artifact',
          oracleText: '{T}: Add one mana of any color.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 2);
    const sourceId = findInstanceId('mana-write-any-color');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('mana-ability');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'mana',
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);

    store().confirmGuidedMana('U');

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('uses commander color identity as the guided option set', () => {
    const source = makeDef({
      scryfallId: 'mana-write-arcane-signet',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-arcane-signet',
          typeLine: 'Artifact',
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
        },
      ],
    });
    const commander = makeDef({
      scryfallId: 'mana-write-commander',
      typeLine: 'Legendary Creature',
      colorIdentity: ['U', 'B'],
      faces: [{ name: 'mana-write-commander', typeLine: 'Legendary Creature' }],
    });

    store().newGame(
      [{ def: source, isCommander: false }, ...makeDeck(10, [commander])],
      3,
    );
    const sourceId = findInstanceId('mana-write-arcane-signet');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'mana',
      manaOptions: ['U', 'B'],
    });

    store().confirmGuidedMana('B');

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.manaPool.B).toBe(1);
  });

  it('keeps restricted mana manual and does not tap or add mana automatically', () => {
    const source = makeDef({
      scryfallId: 'mana-write-restricted',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-restricted',
          typeLine: 'Artifact',
          oracleText:
            '{T}: Add one mana of any color. Spend this mana only to cast creature spells.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 4);
    const sourceId = findInstanceId('mana-write-restricted');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().state!.manaPool.W).toBe(0);
    expect(store().warnings.some((warning) => warning.includes('手動'))).toBe(true);
  });

  it('keeps targeted add-mana abilities on the ordinary activation stack path', () => {
    const source = makeDef({
      scryfallId: 'mana-write-targeted',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-targeted',
          typeLine: 'Artifact',
          oracleText: '{T}: Target player adds {G}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 5);
    const sourceId = findInstanceId('mana-write-targeted');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]?.targetKind).toBe('player');
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.manaPool.G).toBe(0);

    store().confirmGuidedPlayerTarget('P1');

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.manaPool.G).toBe(0);
  });
});
