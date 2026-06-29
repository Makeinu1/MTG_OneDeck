/**
 * Reviewer-owned adversarial tests for M-CR-RECONCILE: commander tax follows
 * CR 903.8 and increments when a commander is cast from the command zone, not
 * when it returns to the command zone (docs/engine-spec.md §15 / §34.0).
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

describe('commander tax follows casts from the command zone (M-CR-RECONCILE)', () => {
  it('starts at 0 and increments on cast from the command zone', () => {
    newGameWithCommander();
    const id = commanderId();
    expect(snap().cards[id].zone).toBe('command');
    expect(commanderTax(snap(), id)).toBe(0);

    store().castToStack(id); // command -> stack (a cast)
    expect(commanderTax(snap(), id)).toBe(2);

    store().moveCard(id, 'battlefield'); // leaving (well, from stack) -> battlefield
    expect(commanderTax(snap(), id)).toBe(2);
  });

  it('does not increment when the commander returns to the command zone', () => {
    newGameWithCommander();
    const id = commanderId();
    store().moveCard(id, 'battlefield'); // command -> battlefield (no increment)
    expect(commanderTax(snap(), id)).toBe(0);

    store().moveCard(id, 'command'); // battlefield -> command : no tax increment
    expect(commanderTax(snap(), id)).toBe(0);

    store().moveCard(id, 'graveyard'); // command -> graveyard (no increment)
    expect(commanderTax(snap(), id)).toBe(0);

    store().moveCard(id, 'command'); // graveyard -> command : no tax increment
    expect(commanderTax(snap(), id)).toBe(0);

    // single undo reverts the last move; tax remains unchanged.
    store().undo();
    expect(commanderTax(snap(), id)).toBe(0);
  });

  it('does not increment on a command -> command no-op move', () => {
    newGameWithCommander();
    const id = commanderId();
    store().moveCard(id, 'command'); // already in command
    expect(commanderTax(snap(), id)).toBe(0);
  });

  it('only the cast commander is taxed (independent castCount)', () => {
    const a = makeDef({ scryfallId: 'cmdA', typeLine: 'Legendary Creature — God' });
    const b = makeDef({ scryfallId: 'cmdB', typeLine: 'Legendary Creature — Bird' });
    store().newGame(makeDeck(12, [a, b]), 7);
    const idA = Object.values(snap().cards).find((c) => c.defId === 'cmdA')!.id;
    const idB = Object.values(snap().cards).find((c) => c.defId === 'cmdB')!.id;

    store().castToStack(idA); // A cast from command: A tax 2, B tax 0
    expect(commanderTax(snap(), idA)).toBe(2);
    expect(commanderTax(snap(), idB)).toBe(0);
  });
});
