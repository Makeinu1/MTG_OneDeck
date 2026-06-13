import { describe, it, expect } from 'vitest';
import { applyCommand, EngineError } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';

function pool(p: Partial<ManaPool>): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...p };
}

function freshGame(main = 10, drawCount = 7): GameState {
  const base = initGame(makeDeck(main), 1);
  return applyCommand(base, { type: 'draw', count: drawCount }).state;
}

describe('applyCommand immutability (I4)', () => {
  it('does not mutate the input state', () => {
    const state = freshGame();
    const snapshot = JSON.stringify(state);
    applyCommand(state, { type: 'adjustLife', delta: -3 });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('moveCard', () => {
  it('draws to hand (top of library)', () => {
    const state = initGame(makeDeck(5), 1);
    const topId = state.zones.library[0];
    const res = applyCommand(state, { type: 'moveCard', cardId: topId, to: 'hand', position: 'top' });
    expect(res.state.zones.hand[0]).toBe(topId);
    expect(res.state.zones.library).not.toContain(topId);
    expect(res.state.cards[topId].zone).toBe('hand');
  });

  it('inserts at top and bottom of library', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    const top = applyCommand(state, { type: 'moveCard', cardId: id, to: 'library', position: 'top' });
    expect(top.state.zones.library[0]).toBe(id);

    const bottom = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'library',
      position: 'bottom',
    });
    expect(bottom.state.zones.library[bottom.state.zones.library.length - 1]).toBe(id);
  });

  it('resets card state on zone change', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    // tap & add counter while on battlefield first
    let s = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    s = applyCommand(s, { type: 'setTapped', cardId: id, tapped: true }).state;
    s = applyCommand(s, { type: 'addCounters', cardId: id, counterType: '+1/+1', delta: 2 }).state;
    expect(s.cards[id].tapped).toBe(true);
    expect(s.cards[id].counters['+1/+1']).toBe(2);

    // move to graveyard -> reset
    s = applyCommand(s, { type: 'moveCard', cardId: id, to: 'graveyard', position: 'top' }).state;
    expect(s.cards[id].tapped).toBe(false);
    expect(s.cards[id].counters).toEqual({});
    expect(s.cards[id].faceDown).toBe(false);
    expect(s.cards[id].faceIndex).toBe(0);
  });

  it('token vanishes when leaving battlefield (I2)', () => {
    const state = freshGame();
    let s = applyCommand(state, {
      type: 'createToken',
      name: 'Goblin',
      typeLine: 'Token Creature — Goblin',
      power: '1',
      toughness: '1',
      quantity: 1,
    }).state;
    const tokenId = s.zones.battlefield.find((id) => s.cards[id].isToken);
    expect(tokenId).toBeDefined();
    s = applyCommand(s, { type: 'moveCard', cardId: tokenId as string, to: 'graveyard', position: 'top' }).state;
    expect(s.cards[tokenId as string]).toBeUndefined();
    expect(s.zones.graveyard).not.toContain(tokenId);
    expect(s.zones.battlefield).not.toContain(tokenId);
  });

  it('throws on unknown cardId', () => {
    const state = freshGame();
    expect(() => applyCommand(state, { type: 'moveCard', cardId: 'nope', to: 'hand', position: 'top' })).toThrow(
      EngineError
    );
  });
});

describe('counters & player counters never go negative (I3)', () => {
  it('clamps card counters at 0', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    let s = applyCommand(state, { type: 'addCounters', cardId: id, counterType: 'charge', delta: 1 }).state;
    s = applyCommand(s, { type: 'addCounters', cardId: id, counterType: 'charge', delta: -5 }).state;
    expect(s.cards[id].counters.charge).toBeUndefined();
  });

  it('clamps poison at 0 but allows negative life', () => {
    const state = freshGame();
    let s = applyCommand(state, { type: 'adjustPlayerCounter', kind: 'poison', delta: -3 }).state;
    expect(s.poison).toBe(0);
    s = applyCommand(state, { type: 'adjustLife', delta: -50 }).state;
    expect(s.life).toBe(-10);
  });
});

describe('mana pool', () => {
  it('adds and clears mana', () => {
    const state = freshGame();
    let s = applyCommand(state, { type: 'addMana', color: 'R', amount: 3 }).state;
    expect(s.manaPool.R).toBe(3);
    s = applyCommand(s, { type: 'clearManaPool' }).state;
    expect(s.manaPool).toEqual(pool({}));
  });

  it('payMana clamps at 0 and warns on shortfall', () => {
    const state = freshGame();
    const s = applyCommand(state, { type: 'addMana', color: 'U', amount: 1 }).state;
    const res = applyCommand(s, { type: 'payMana', payment: pool({ U: 3 }) });
    expect(res.state.manaPool.U).toBe(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('mill', () => {
  it('moves the top N cards to the graveyard in order', () => {
    const state = freshGame(10, 2);
    const topIds = state.zones.library.slice(0, 3);
    const res = applyCommand(state, { type: 'mill', count: 3 });

    expect(res.state.zones.graveyard.slice(-3)).toEqual(topIds);
    expect(res.state.zones.library).not.toEqual(state.zones.library);
    expect(topIds.every((id) => res.state.cards[id].zone === 'graveyard')).toBe(true);
  });

  it('clamps to the available library size and warns', () => {
    const state = initGame(makeDeck(3), 1);
    const res = applyCommand(state, { type: 'mill', count: 5 });

    expect(res.state.zones.library).toHaveLength(0);
    expect(res.state.zones.graveyard).toHaveLength(3);
    expect(res.warnings).toContain('ライブラリが5枚に満たないため3枚を切削した。');
    expect(res.state.log[res.state.log.length - 1].message).toBe(
      '切削: ライブラリの上から3枚を墓地に置いた。'
    );
  });
});

describe('untapAll', () => {
  it('untaps every battlefield permanent', () => {
    const state = freshGame();
    const firstId = state.zones.hand[0];
    const secondId = state.zones.hand[1];
    let s = applyCommand(state, {
      type: 'moveCard',
      cardId: firstId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    s = applyCommand(s, { type: 'moveCard', cardId: secondId, to: 'battlefield', position: 'bottom' }).state;
    s = applyCommand(s, { type: 'setTapped', cardId: firstId, tapped: true }).state;
    s = applyCommand(s, { type: 'setTapped', cardId: secondId, tapped: true }).state;

    const res = applyCommand(s, { type: 'untapAll' });
    expect(res.state.cards[firstId].tapped).toBe(false);
    expect(res.state.cards[secondId].tapped).toBe(false);
    expect(res.state.log[res.state.log.length - 1].message).toBe('すべてのパーマネントをアンタップした。');
  });

  it('is idempotent when everything is already untapped', () => {
    const state = freshGame();
    const first = applyCommand(state, { type: 'untapAll' });
    const second = applyCommand(first.state, { type: 'untapAll' });

    expect(second.state.zones.battlefield).toEqual(first.state.zones.battlefield);
    expect(second.state.log).toHaveLength(first.state.log.length);
  });
});

describe('discard', () => {
  it('moves multiple cards to the graveyard and ignores unknown ids', () => {
    const state = freshGame(10, 4);
    const [firstId, secondId] = state.zones.hand;
    const res = applyCommand(state, { type: 'discard', cardIds: [firstId, 'missing', secondId] });

    expect(res.state.cards[firstId].zone).toBe('graveyard');
    expect(res.state.cards[secondId].zone).toBe('graveyard');
    expect(res.state.zones.graveyard.slice(-2)).toEqual([firstId, secondId]);
    expect(res.state.log[res.state.log.length - 1].message).toBe('2枚を捨てた。');
  });
});

describe('castSpell', () => {
  it('moves instant/sorcery to graveyard, others to battlefield', () => {
    const sorceryDef = makeDef({ scryfallId: 'sorc', typeLine: 'Sorcery' });
    const creatureDef = makeDef({ scryfallId: 'crea', typeLine: 'Creature' });
    const deck = [
      { def: sorceryDef, isCommander: false },
      { def: creatureDef, isCommander: false },
    ];
    let s = initGame(deck, 1);
    s = applyCommand(s, { type: 'draw', count: 2 }).state;
    const sorcId = Object.values(s.cards).find((c) => c.defId === 'sorc')!.id;
    const creaId = Object.values(s.cards).find((c) => c.defId === 'crea')!.id;

    const r1 = applyCommand(s, { type: 'castSpell', cardId: sorcId, payment: pool({}), forced: true });
    expect(r1.state.cards[sorcId].zone).toBe('graveyard');

    const r2 = applyCommand(s, { type: 'castSpell', cardId: creaId, payment: pool({}), forced: true });
    expect(r2.state.cards[creaId].zone).toBe('battlefield');
  });

  it('subtracts payment from pool', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    let s = applyCommand(state, { type: 'addMana', color: 'C', amount: 5 }).state;
    s = applyCommand(s, { type: 'castSpell', cardId: id, payment: pool({ C: 2 }), forced: false }).state;
    expect(s.manaPool.C).toBe(3);
  });
});

describe('castCommander', () => {
  it('increments castCount on each cast', () => {
    const cmd = makeDef({ scryfallId: 'cmd-1', typeLine: 'Legendary Creature' });
    const deck = makeDeck(5, [cmd]);
    let s = initGame(deck, 1);
    const cmdId = s.commanders[0].cardId;

    s = applyCommand(s, { type: 'castCommander', cardId: cmdId, payment: pool({}), forced: true }).state;
    expect(s.commanders[0].castCount).toBe(1);
    expect(s.cards[cmdId].zone).toBe('battlefield');
  });

  it('keeps castCount independent for two commanders', () => {
    const c1 = makeDef({ scryfallId: 'cmd-1', typeLine: 'Legendary Creature' });
    const c2 = makeDef({ scryfallId: 'cmd-2', typeLine: 'Legendary Creature' });
    let s = initGame(makeDeck(5, [c1, c2]), 1);
    const id1 = s.commanders[0].cardId;
    const id2 = s.commanders[1].cardId;

    s = applyCommand(s, { type: 'castCommander', cardId: id1, payment: pool({}), forced: true }).state;
    // return id1 to command zone to allow a second cast
    s = applyCommand(s, { type: 'moveCard', cardId: id1, to: 'command', position: 'top' }).state;
    s = applyCommand(s, { type: 'castCommander', cardId: id1, payment: pool({}), forced: true }).state;
    expect(s.commanders[0].castCount).toBe(2);
    expect(s.commanders[1].castCount).toBe(0);

    s = applyCommand(s, { type: 'castCommander', cardId: id2, payment: pool({}), forced: true }).state;
    expect(s.commanders[1].castCount).toBe(1);
  });

  it('throws when casting commander not from command zone', () => {
    const cmd = makeDef({ scryfallId: 'cmd-1', typeLine: 'Legendary Creature' });
    let s = initGame(makeDeck(5, [cmd]), 1);
    const cmdId = s.commanders[0].cardId;
    s = applyCommand(s, { type: 'castCommander', cardId: cmdId, payment: pool({}), forced: true }).state;
    // now on battlefield
    expect(() =>
      applyCommand(s, { type: 'castCommander', cardId: cmdId, payment: pool({}), forced: true })
    ).toThrow(EngineError);
  });
});

describe('nextPhase / nextTurn', () => {
  it('untaps all battlefield cards on untap entry', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    let s = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    s = applyCommand(s, { type: 'setTapped', cardId: id, tapped: true }).state;
    // advance to next turn untap
    s = applyCommand(s, { type: 'nextTurn' }).state;
    expect(s.phase).toBe('untap');
    expect(s.cards[id].tapped).toBe(false);
  });

  it('draws on the draw step of turn 2', () => {
    const state = freshGame(20, 7);
    let s = applyCommand(state, { type: 'nextTurn' }).state; // turn 2 untap
    expect(s.turn).toBe(2);
    // walk to draw of turn 2: untap->upkeep->draw
    const handBefore = s.zones.hand.length;
    s = applyCommand(s, { type: 'nextPhase' }).state; // upkeep
    s = applyCommand(s, { type: 'nextPhase' }).state; // draw -> should draw 1
    expect(s.phase).toBe('draw');
    expect(s.zones.hand.length).toBe(handBefore + 1);
  });

  it('draws on turn 1', () => {
    const t1 = initGame(makeDeck(20), 1);
    // force phase to untap of turn 1, then walk untap -> upkeep -> draw
    const untapState = { ...t1, phase: 'untap' as const };
    let walk = applyCommand(untapState, { type: 'nextPhase' }).state; // upkeep
    const handBefore = walk.zones.hand.length;
    walk = applyCommand(walk, { type: 'nextPhase' }).state; // draw (turn 1)
    expect(walk.turn).toBe(1);
    expect(walk.phase).toBe('draw');
    expect(walk.zones.hand.length).toBe(handBefore + 1);
  });

  it('increments turn on end -> untap and clears pool (I5)', () => {
    const base = initGame(makeDeck(10), 1);
    let s: GameState = { ...base, phase: 'end' };
    s = applyCommand(s, { type: 'addMana', color: 'R', amount: 2 }).state;
    s = applyCommand(s, { type: 'nextPhase' }).state;
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('untap');
    expect(s.manaPool).toEqual(pool({}));
  });

  it('clears pool on any phase change', () => {
    const base = initGame(makeDeck(10), 1);
    let s = applyCommand(base, { type: 'addMana', color: 'G', amount: 3 }).state;
    s = applyCommand(s, { type: 'nextPhase' }).state;
    expect(s.manaPool).toEqual(pool({}));
  });
});

describe('mulligan / putOnBottom (London)', () => {
  it('mulligan -> draw 7 -> putOnBottom flow', () => {
    const base = initGame(makeDeck(30), 1);
    let s = applyCommand(base, { type: 'draw', count: 7 }).state;
    expect(s.zones.hand).toHaveLength(7);

    // mulligan: hand back to library, reorder
    const combined = [...s.zones.hand, ...s.zones.library];
    // simple reversed order as a valid permutation
    const order = combined.slice().reverse();
    s = applyCommand(s, { type: 'mulligan', order }).state;
    expect(s.zones.hand).toHaveLength(0);
    expect(s.zones.library).toHaveLength(30);
    expect(s.mulliganCount).toBe(1);

    // draw 7 again
    s = applyCommand(s, { type: 'draw', count: 7 }).state;
    expect(s.zones.hand).toHaveLength(7);

    // put 1 on bottom (mulliganCount = 1)
    const toBottom = [s.zones.hand[0]];
    s = applyCommand(s, { type: 'putOnBottom', cardIds: toBottom }).state;
    expect(s.zones.hand).toHaveLength(6);
    expect(s.zones.library[s.zones.library.length - 1]).toBe(toBottom[0]);
  });

  it('throws on invalid mulligan order', () => {
    const base = initGame(makeDeck(10), 1);
    const s = applyCommand(base, { type: 'draw', count: 7 }).state;
    expect(() => applyCommand(s, { type: 'mulligan', order: ['bogus'] })).toThrow(EngineError);
  });
});

describe('logging', () => {
  it('appends Japanese log entries with sequential seq', () => {
    const state = freshGame();
    const res = applyCommand(state, { type: 'adjustLife', delta: -3 });
    const last = res.state.log[res.state.log.length - 1];
    expect(last.message).toContain('ライフ');
    expect(last.seq).toBe(state.log[state.log.length - 1].seq + 1);
  });

  it('wraps card names in 《》', () => {
    const state = freshGame();
    const id = state.zones.hand[0];
    const res = applyCommand(state, { type: 'setTapped', cardId: id, tapped: true });
    const last = res.state.log[res.state.log.length - 1];
    expect(last.message).toContain('《');
    expect(last.message).toContain('》');
  });
});
