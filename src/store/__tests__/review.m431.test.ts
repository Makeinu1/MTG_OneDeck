/**
 * Reviewer-owned adversarial tests for M4.31: commander tax now increments when
 * the commander RETURNS to the command zone (docs/engine-spec.md §15), not on
 * cast. Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { commanderTax } from '../../engine/commander';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function commanderId(): string {
  return Object.values(snap().cards).find((c) => c.isCommander)!.id;
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function newGameWithCommander() {
  const cmd = makeDef({ scryfallId: 'cmdr', typeLine: 'Legendary Creature — God' });
  store().newGame(makeDeck(12, [cmd]), 7);
}

describe('commander tax increments on return to the command zone (M4.31)', () => {
  it('starts at 0 and does not increment on cast or on leaving the command zone', () => {
    newGameWithCommander();
    const id = commanderId();
    expect(snap().cards[id].zone).toBe('command');
    expect(commanderTax(snap(), id)).toBe(0);

    store().castToStack(id); // command -> stack (a cast)
    expect(commanderTax(snap(), id)).toBe(0); // cast does NOT increment

    store().moveCard(id, 'battlefield'); // leaving (well, from stack) -> battlefield
    expect(commanderTax(snap(), id)).toBe(0);
  });

  it('increments by 2 each time the commander returns to the command zone', () => {
    newGameWithCommander();
    const id = commanderId();
    store().moveCard(id, 'battlefield'); // command -> battlefield (no increment)
    expect(commanderTax(snap(), id)).toBe(0);

    store().moveCard(id, 'command'); // battlefield -> command : +1 (tax 2)
    expect(commanderTax(snap(), id)).toBe(2);

    store().moveCard(id, 'graveyard'); // command -> graveyard (no increment)
    expect(commanderTax(snap(), id)).toBe(2);

    store().moveCard(id, 'command'); // graveyard -> command : +1 (tax 4)
    expect(commanderTax(snap(), id)).toBe(4);

    // single undo reverts the last return
    store().undo();
    expect(commanderTax(snap(), id)).toBe(2);
  });

  it('does not increment on a command -> command no-op move', () => {
    newGameWithCommander();
    const id = commanderId();
    store().moveCard(id, 'command'); // already in command
    expect(commanderTax(snap(), id)).toBe(0);
  });

  it('only the returning commander is taxed (independent castCount)', () => {
    const a = makeDef({ scryfallId: 'cmdA', typeLine: 'Legendary Creature — God' });
    const b = makeDef({ scryfallId: 'cmdB', typeLine: 'Legendary Creature — Bird' });
    store().newGame(makeDeck(12, [a, b]), 7);
    const idA = Object.values(snap().cards).find((c) => c.defId === 'cmdA')!.id;
    const idB = Object.values(snap().cards).find((c) => c.defId === 'cmdB')!.id;

    store().moveCard(idA, 'battlefield');
    store().moveCard(idA, 'command'); // A returns: A tax 2, B tax 0
    expect(commanderTax(snap(), idA)).toBe(2);
    expect(commanderTax(snap(), idB)).toBe(0);
  });
});
