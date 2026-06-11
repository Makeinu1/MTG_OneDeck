import { describe, it, expect } from 'vitest';
import { initGame } from '../init';
import { makeDef, makeDeck } from './helpers';

describe('initGame', () => {
  it('puts commanders in command zone and rest in library', () => {
    const cmd = makeDef({ scryfallId: 'cmd-1', typeLine: 'Legendary Creature' });
    const deck = makeDeck(10, [cmd]);
    const state = initGame(deck, 1);

    expect(state.zones.command).toHaveLength(1);
    expect(state.zones.library).toHaveLength(10);
    expect(state.zones.hand).toHaveLength(0);
    expect(state.commanders).toHaveLength(1);
    expect(state.commanders[0].castCount).toBe(0);
  });

  it('initializes player state', () => {
    const state = initGame(makeDeck(5), 1);
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('main1');
    expect(state.life).toBe(40);
    expect(state.poison).toBe(0);
    expect(state.energy).toBe(0);
    expect(state.experience).toBe(0);
    expect(state.mulliganCount).toBe(0);
    expect(state.manaPool).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  it('shuffles deterministically with seed', () => {
    const a = initGame(makeDeck(20), 12345);
    const b = initGame(makeDeck(20), 12345);
    expect(a.zones.library).toEqual(b.zones.library);

    const c = initGame(makeDeck(20), 999);
    expect(a.zones.library).not.toEqual(c.zones.library);
  });

  it('supports two commanders (partner)', () => {
    const c1 = makeDef({ scryfallId: 'cmd-1' });
    const c2 = makeDef({ scryfallId: 'cmd-2' });
    const state = initGame(makeDeck(8, [c1, c2]), 1);
    expect(state.commanders).toHaveLength(2);
    expect(state.zones.command).toHaveLength(2);
  });
});
