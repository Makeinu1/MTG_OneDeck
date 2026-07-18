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

describe('commander resolution presentation gate', () => {
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

  it('holds the commander on the stack until the matching presentation token commits', () => {
    useGameStore.getState().newGame(makeDeck(4, [commander('Gate Commander')]), 1);
    const id = state().commanders[0].cardId;
    useGameStore.getState().castToStack(id, { force: true });

    useGameStore.getState().resolveTop();
    const pending = useGameStore.getState().pendingCommanderResolution;
    expect(pending).toMatchObject({ cardId: id, faceIndex: 0, name: 'Gate Commander' });
    expect(state().cards[id].zone).toBe('stack');

    useGameStore.getState().commitCommanderResolution(pending!.token + 1);
    expect(state().cards[id].zone).toBe('stack');
    expect(useGameStore.getState().pendingCommanderResolution?.token).toBe(pending!.token);

    useGameStore.getState().commitCommanderResolution(pending!.token);
    expect(state().cards[id]).toMatchObject({ zone: 'battlefield', faceIndex: 0 });
  });

  it('cuts in for each commander during resolve-all and preserves one-step undo', () => {
    useGameStore.getState().newGame(
      makeDeck(4, [commander('Alpha Commander'), commander('Beta Commander')]),
      2,
    );
    const [alpha, beta] = state().commanders.map(({ cardId }) => cardId);
    useGameStore.getState().castToStack(alpha, { force: true });
    useGameStore.getState().castToStack(beta, { force: true });
    const beforeResolve = state().zones.stack.slice();

    useGameStore.getState().resolveAll();
    const first = useGameStore.getState().pendingCommanderResolution;
    expect(first?.cardId).toBe(beta);
    useGameStore.getState().commitCommanderResolution(first!.token);

    const second = useGameStore.getState().pendingCommanderResolution;
    expect(second?.cardId).toBe(alpha);
    useGameStore.getState().commitCommanderResolution(second!.token);
    expect(state().zones.stack).toEqual([]);
    expect(state().zones.battlefield).toEqual(expect.arrayContaining([alpha, beta]));

    useGameStore.getState().undo();
    expect(state().zones.stack).toEqual(beforeResolve);
  });
});
