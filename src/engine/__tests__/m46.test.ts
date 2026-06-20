import { describe, expect, it } from 'vitest';
import { applyCommand, EngineError } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { parseManaCost } from '../mana';
import { planAutoTap } from '../autotap';
import { isSummoningSick } from '../status';
import type { GameState, ManaPool } from '../types';
import { makeDef } from './helpers';

function pool(p: Partial<ManaPool> = {}): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...p };
}

function setup(deck: InitDeckCard[]): GameState {
  const nonCommanderCount = deck.filter((card) => !card.isCommander).length;
  const base = initGame(deck, 1);
  return applyCommand(base, { type: 'draw', count: nonCommanderCount }).state;
}

function cardIdByDef(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing card for ${defId}`);
  }
  return card.id;
}

function moveToBattlefield(state: GameState, defId: string): GameState {
  return applyCommand(state, {
    type: 'moveCard',
    cardId: cardIdByDef(state, defId),
    to: 'battlefield',
    position: 'bottom',
  }).state;
}

describe('M4.6 playLand', () => {
  it('plays the first land without warning and warns on the second', () => {
    const firstLand = makeDef({
      scryfallId: 'plains-1',
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'plains-1', typeLine: 'Basic Land — Plains' }],
    });
    const secondLand = makeDef({
      scryfallId: 'plains-2',
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'plains-2', typeLine: 'Basic Land — Plains' }],
    });
    const state = setup([
      { def: firstLand, isCommander: false },
      { def: secondLand, isCommander: false },
    ]);
    const firstId = cardIdByDef(state, 'plains-1');
    const secondId = cardIdByDef(state, 'plains-2');

    const first = applyCommand(state, { type: 'playLand', cardId: firstId, forced: false });
    expect(first.warnings).toEqual([]);
    expect(first.state.cards[firstId].zone).toBe('battlefield');
    expect(first.state.landsPlayedThisTurn).toBe(1);

    const second = applyCommand(first.state, { type: 'playLand', cardId: secondId, forced: false });
    expect(second.state.cards[secondId].zone).toBe('battlefield');
    expect(second.state.landsPlayedThisTurn).toBe(2);
    expect(second.warnings).toContain('このターン2枚目の土地です。');
  });

  it('resets the counter on the next turn', () => {
    const land = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      faces: [{ name: 'forest', typeLine: 'Basic Land — Forest' }],
    });
    const state = setup([{ def: land, isCommander: false }]);
    const played = applyCommand(state, {
      type: 'playLand',
      cardId: cardIdByDef(state, 'forest'),
      forced: false,
    }).state;

    const nextTurn = applyCommand(played, { type: 'nextTurn' }).state;
    expect(nextTurn.phase).toBe('untap');
    expect(nextTurn.turn).toBe(2);
    expect(nextTurn.landsPlayedThisTurn).toBe(0);
  });

  it('throws on non-land cards or cards outside the hand', () => {
    const land = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      faces: [{ name: 'forest', typeLine: 'Basic Land — Forest' }],
    });
    const spell = makeDef({
      scryfallId: 'spell',
      typeLine: 'Sorcery',
      faces: [{ name: 'spell', typeLine: 'Sorcery', manaCost: '{1}{G}' }],
    });
    const state = setup([
      { def: land, isCommander: false },
      { def: spell, isCommander: false },
    ]);
    const landId = cardIdByDef(state, 'forest');
    const spellId = cardIdByDef(state, 'spell');

    expect(() =>
      applyCommand(state, { type: 'playLand', cardId: spellId, forced: false })
    ).toThrow(EngineError);

    const played = applyCommand(state, { type: 'playLand', cardId: landId, forced: false }).state;
    expect(() =>
      applyCommand(played, { type: 'playLand', cardId: landId, forced: false })
    ).toThrow(EngineError);
  });
});

describe('M4.6 draw step', () => {
  it('draws on turn 1', () => {
    const untapState = { ...initGame([{ def: makeDef({ scryfallId: 'card-1' }), isCommander: false }], 1), phase: 'untap' as const };
    const upkeep = applyCommand(untapState, { type: 'nextPhase' }).state;
    const draw = applyCommand(upkeep, { type: 'nextPhase' }).state;
    expect(draw.turn).toBe(1);
    expect(draw.phase).toBe('draw');
    expect(draw.zones.hand).toHaveLength(1);
  });
});

describe('M4.6 ETB hooks', () => {
  it('initializes planeswalker loyalty and saga lore, then advances lore on untap', () => {
    const planeswalker = makeDef({
      scryfallId: 'walker',
      typeLine: 'Legendary Planeswalker — Test',
      faces: [{ name: 'walker', typeLine: 'Legendary Planeswalker — Test', loyalty: '4' }],
    });
    const saga = makeDef({
      scryfallId: 'saga',
      typeLine: 'Enchantment — Saga',
      faces: [{ name: 'saga', typeLine: 'Enchantment — Saga' }],
    });
    let state = setup([
      { def: planeswalker, isCommander: false },
      { def: saga, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'walker');
    state = moveToBattlefield(state, 'saga');

    const walkerId = cardIdByDef(state, 'walker');
    const sagaId = cardIdByDef(state, 'saga');

    expect(state.cards[walkerId].counters.loyalty).toBe(4);
    expect(state.cards[walkerId].enteredTurn).toBe(1);
    expect(state.cards[sagaId].counters.lore).toBe(1);

    const nextTurn = applyCommand(state, { type: 'nextTurn' }).state;
    expect(nextTurn.cards[sagaId].counters.lore).toBe(2);
  });

  it('clears enteredTurn when a battlefield card leaves the battlefield', () => {
    const creature = makeDef({ scryfallId: 'creature', typeLine: 'Creature — Elf' });
    let state = setup([{ def: creature, isCommander: false }]);
    state = moveToBattlefield(state, 'creature');
    const id = cardIdByDef(state, 'creature');

    const moved = applyCommand(state, { type: 'moveCard', cardId: id, to: 'graveyard', position: 'top' }).state;
    expect(moved.cards[id].enteredTurn).toBe(0);
  });
});

describe('M4.6 isSummoningSick', () => {
  it('detects sickness, haste, turn changes, and non-creatures', () => {
    const creature = makeDef({ scryfallId: 'elf', typeLine: 'Creature — Elf' });
    const hasteEn = makeDef({
      scryfallId: 'haste-en',
      typeLine: 'Creature — Goblin',
      faces: [{ name: 'haste-en', typeLine: 'Creature — Goblin', oracleText: 'Haste' }],
    });
    const hasteSecondary = makeDef({
      scryfallId: 'haste-secondary',
      typeLine: 'Creature — Samurai',
      faces: [{ name: 'haste-secondary', typeLine: 'Creature — Samurai', oracleText: 'Haste' }],
    });
    const nonCreature = makeDef({ scryfallId: 'artifact', typeLine: 'Artifact' });

    let state = setup([
      { def: creature, isCommander: false },
      { def: hasteEn, isCommander: false },
      { def: hasteSecondary, isCommander: false },
      { def: nonCreature, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'elf');
    state = moveToBattlefield(state, 'haste-en');
    state = moveToBattlefield(state, 'haste-secondary');
    state = moveToBattlefield(state, 'artifact');

    expect(isSummoningSick(state, cardIdByDef(state, 'elf'))).toBe(true);
    expect(isSummoningSick(state, cardIdByDef(state, 'haste-en'))).toBe(false);
    expect(isSummoningSick(state, cardIdByDef(state, 'haste-secondary'))).toBe(false);
    expect(isSummoningSick(state, cardIdByDef(state, 'artifact'))).toBe(false);

    const nextTurn = applyCommand(state, { type: 'nextTurn' }).state;
    expect(isSummoningSick(nextTurn, cardIdByDef(nextTurn, 'elf'))).toBe(false);
  });
});

describe('M4.6 planAutoTap', () => {
  it('handles simple cases and respects priority between single-color and multi-color lands', () => {
    const plains = makeDef({
      scryfallId: 'plains',
      typeLine: 'Basic Land — Plains',
      producedMana: ['W'],
      faces: [{ name: 'plains', typeLine: 'Basic Land — Plains' }],
    });
    const dual = makeDef({
      scryfallId: 'dual',
      typeLine: 'Land',
      producedMana: ['W', 'U'],
      faces: [{ name: 'dual', typeLine: 'Land' }],
    });
    let state = setup([
      { def: plains, isCommander: false },
      { def: dual, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'plains');
    state = moveToBattlefield(state, 'dual');

    const plan = planAutoTap(state, parseManaCost('{W}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.shortfall).toBe(0);
    expect(plan.taps).toEqual([{ cardId: cardIdByDef(state, 'plains'), color: 'W' }]);
    expect(plan.payment).toEqual(pool({ W: 1 }));
  });

  it('assigns scarce colors correctly for multi-color lands', () => {
    const island = makeDef({
      scryfallId: 'island',
      typeLine: 'Basic Land — Island',
      producedMana: ['U'],
      faces: [{ name: 'island', typeLine: 'Basic Land — Island' }],
    });
    const dual = makeDef({
      scryfallId: 'dual',
      typeLine: 'Land',
      producedMana: ['W', 'U'],
      faces: [{ name: 'dual', typeLine: 'Land' }],
    });
    let state = setup([
      { def: island, isCommander: false },
      { def: dual, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'island');
    state = moveToBattlefield(state, 'dual');

    const plan = planAutoTap(state, parseManaCost('{W}{U}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(state, 'island'), color: 'U' },
      { cardId: cardIdByDef(state, 'dual'), color: 'W' },
    ]);
    expect(plan.payment).toEqual(pool({ W: 1, U: 1 }));
  });

  it('excludes summoning-sick creatures and treasure tokens', () => {
    const forest = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'],
      faces: [{ name: 'forest', typeLine: 'Basic Land — Forest' }],
    });
    const dork = makeDef({
      scryfallId: 'dork',
      typeLine: 'Creature — Elf Druid',
      producedMana: ['G'],
      faces: [{ name: 'dork', typeLine: 'Creature — Elf Druid' }],
    });
    let state = setup([
      { def: forest, isCommander: false },
      { def: dork, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'forest');
    state = moveToBattlefield(state, 'dork');
    state = applyCommand(state, {
      type: 'createToken',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      quantity: 1,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    }).state;

    const plan = planAutoTap(state, parseManaCost('{G}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([{ cardId: cardIdByDef(state, 'forest'), color: 'G' }]);
    expect(plan.taps.some((tap) => tap.cardId === cardIdByDef(state, 'dork'))).toBe(false);
    const treasureId = state.zones.battlefield.find((id) => state.cards[id].isToken);
    expect(plan.taps.some((tap) => tap.cardId === treasureId)).toBe(false);
  });

  it('returns the best partial plan when full payment is impossible', () => {
    const mountain = makeDef({
      scryfallId: 'mountain',
      typeLine: 'Basic Land — Mountain',
      producedMana: ['R'],
      faces: [{ name: 'mountain', typeLine: 'Basic Land — Mountain' }],
    });
    const forest = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'],
      faces: [{ name: 'forest', typeLine: 'Basic Land — Forest' }],
    });
    let state = setup([
      { def: mountain, isCommander: false },
      { def: forest, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'mountain');
    state = moveToBattlefield(state, 'forest');

    const plan = planAutoTap(state, parseManaCost('{2}{R}'), 0);
    expect(plan.ok).toBe(false);
    expect(plan.shortfall).toBe(1);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(state, 'mountain'), color: 'R' },
      { cardId: cardIdByDef(state, 'forest'), color: 'G' },
    ]);
    expect(plan.payment).toEqual(pool({ R: 1, G: 1 }));
  });
});

describe('M4.6 crackTreasure', () => {
  it('adds the chosen mana and removes the treasure token', () => {
    let state = setup([{ def: makeDef({ scryfallId: 'filler' }), isCommander: false }]);
    state = applyCommand(state, {
      type: 'createToken',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      quantity: 1,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    }).state;
    const treasureId = state.zones.battlefield.find((id) => state.cards[id].isToken);
    expect(treasureId).toBeDefined();

    const cracked = applyCommand(state, {
      type: 'crackTreasure',
      cardId: treasureId as string,
      color: 'G',
    }).state;
    expect(cracked.manaPool.G).toBe(1);
    expect(cracked.cards[treasureId as string]).toBeUndefined();
    expect(cracked.zones.battlefield).not.toContain(treasureId);
  });

  it('throws on non-treasure cards', () => {
    let state = setup([{ def: makeDef({ scryfallId: 'filler' }), isCommander: false }]);
    state = applyCommand(state, {
      type: 'createToken',
      name: '手掛かり',
      typeLine: 'Token Artifact — Clue',
      quantity: 1,
      tokenKind: 'clue',
    }).state;
    const clueId = state.zones.battlefield.find((id) => state.cards[id].isToken);
    expect(() =>
      applyCommand(state, {
        type: 'crackTreasure',
        cardId: clueId as string,
        color: 'U',
      })
    ).toThrow(EngineError);
  });
});
