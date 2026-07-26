import { beforeEach, describe, expect, it } from 'vitest';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

function state(): GameState {
  const value = useGameStore.getState().state;
  if (!value) throw new Error('missing game state');
  return value;
}

function commander(name: string) {
  return makeDef({
    scryfallId: name,
    typeLine: 'Legendary Creature',
    faces: [{ name, typeLine: 'Legendary Creature', manaCost: '{1}' }],
  });
}

describe('commander resolution (AV4 immediate, no presentation gate)', () => {
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
    });
  });

  it('resolves a commander to the battlefield immediately in one store call', () => {
    useGameStore.getState().newGame(makeDeck(4, [commander('Gate Commander')]), 1);
    const id = state().commanders[0].cardId;
    useGameStore.getState().castToStack(id, { force: true });
    expect(state().cards[id].zone).toBe('stack');

    useGameStore.getState().resolveTop();
    expect(state().cards[id]).toMatchObject({ zone: 'battlefield', faceIndex: 0 });
    expect(useGameStore.getState().pendingCommanderResolution).toBeNull();
  });

  it('resolves all commanders immediately and preserves one-step undo', () => {
    useGameStore.getState().newGame(
      makeDeck(4, [commander('Alpha Commander'), commander('Beta Commander')]),
      2,
    );
    const [alpha, beta] = state().commanders.map(({ cardId }) => cardId);
    useGameStore.getState().castToStack(alpha, { force: true });
    useGameStore.getState().castToStack(beta, { force: true });
    const beforeResolve = state().zones.stack.slice();

    useGameStore.getState().resolveAll();
    expect(useGameStore.getState().pendingCommanderResolution).toBeNull();
    expect(state().zones.stack).toEqual([]);
    expect(state().zones.battlefield).toEqual(expect.arrayContaining([alpha, beta]));

    useGameStore.getState().undo();
    expect(state().zones.stack).toEqual(beforeResolve);
  });
});
