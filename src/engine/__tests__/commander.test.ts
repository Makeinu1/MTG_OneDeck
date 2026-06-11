import { describe, it, expect } from 'vitest';
import { applyCommand } from '../commands';
import { commanderTax, isCommander } from '../commander';
import { initGame } from '../init';
import type { ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';

function pool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

describe('commander helpers', () => {
  it('isCommander identifies commanders', () => {
    const cmd = makeDef({ scryfallId: 'cmd-1' });
    const s = initGame(makeDeck(5, [cmd]), 1);
    const cmdId = s.commanders[0].cardId;
    expect(isCommander(s, cmdId)).toBe(true);
    expect(isCommander(s, s.zones.library[0])).toBe(false);
  });

  it('commanderTax accumulates 0 -> 2 -> 4', () => {
    const cmd = makeDef({ scryfallId: 'cmd-1', typeLine: 'Legendary Creature' });
    let s = initGame(makeDeck(5, [cmd]), 1);
    const cmdId = s.commanders[0].cardId;

    expect(commanderTax(s, cmdId)).toBe(0);

    s = applyCommand(s, { type: 'castCommander', cardId: cmdId, payment: pool(), forced: true }).state;
    expect(commanderTax(s, cmdId)).toBe(2);

    // move back to command to cast again
    s = applyCommand(s, { type: 'moveCard', cardId: cmdId, to: 'command', position: 'top' }).state;
    s = applyCommand(s, { type: 'castCommander', cardId: cmdId, payment: pool(), forced: true }).state;
    expect(commanderTax(s, cmdId)).toBe(4);
  });

  it('returns 0 tax for non-commanders', () => {
    const s = initGame(makeDeck(5), 1);
    expect(commanderTax(s, s.zones.library[0])).toBe(0);
  });
});
