import { describe, expect, it } from 'vitest';
import { applyCommands } from '../batch';
import { applyCommand, EngineError } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { parseManaCost } from '../mana';
import { autoTapCommands, planAutoManaPayment, planAutoTap } from '../autotap';
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
  it('initializes planeswalker loyalty and saga lore, then advances lore at precombat main (CR 714.3c)', () => {
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

    // CR 714.3c: lore advances at precombat main phase, not untap.
    // nextTurn enters untap; advance through upkeep → draw → main1.
    let next = applyCommand(state, { type: 'nextTurn' }).state;
    expect(next.cards[sagaId].counters.lore).toBe(1); // still 1 at untap
    next = applyCommand(next, { type: 'nextPhase' }).state; // upkeep
    next = applyCommand(next, { type: 'nextPhase' }).state; // draw
    next = applyCommand(next, { type: 'nextPhase' }).state; // main1
    expect(next.cards[sagaId].counters.lore).toBe(2);
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

  it('keeps a rainbow land untapped when narrower lands can pay the colored cost', () => {
    const plains = makeDef({
      scryfallId: 'option-plains',
      typeLine: 'Basic Land — Plains',
      producedMana: ['W'],
      faces: [{ name: 'option-plains', typeLine: 'Basic Land — Plains' }],
    });
    const island = makeDef({
      scryfallId: 'option-island',
      typeLine: 'Basic Land — Island',
      producedMana: ['U'],
      faces: [{ name: 'option-island', typeLine: 'Basic Land — Island' }],
    });
    const rainbow = makeDef({
      scryfallId: 'option-rainbow',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [{ name: 'option-rainbow', typeLine: 'Land' }],
    });
    let state = setup([
      { def: rainbow, isCommander: false },
      { def: plains, isCommander: false },
      { def: island, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'option-rainbow');
    state = moveToBattlefield(state, 'option-plains');
    state = moveToBattlefield(state, 'option-island');

    const plan = planAutoTap(state, parseManaCost('{W}{U}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(state, 'option-plains'), color: 'W' },
      { cardId: cardIdByDef(state, 'option-island'), color: 'U' },
    ]);
    expect(plan.taps.some((tap) => tap.cardId === cardIdByDef(state, 'option-rainbow'))).toBe(false);
  });

  it('uses a rainbow land when it is the only source that can complete payment', () => {
    const plains = makeDef({
      scryfallId: 'required-plains',
      typeLine: 'Basic Land — Plains',
      producedMana: ['W'],
      faces: [{ name: 'required-plains', typeLine: 'Basic Land — Plains' }],
    });
    const rainbow = makeDef({
      scryfallId: 'required-rainbow',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [{ name: 'required-rainbow', typeLine: 'Land' }],
    });
    let state = setup([
      { def: plains, isCommander: false },
      { def: rainbow, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'required-plains');
    state = moveToBattlefield(state, 'required-rainbow');

    const plan = planAutoTap(state, parseManaCost('{W}{U}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(state, 'required-plains'), color: 'W' },
      { cardId: cardIdByDef(state, 'required-rainbow'), color: 'U' },
    ]);
  });

  it('preserves the only source of a color when redundant sources can pay generic mana', () => {
    const onlyWhite = makeDef({
      scryfallId: 'only-white',
      typeLine: 'Basic Land — Plains',
      producedMana: ['W'],
      faces: [{ name: 'only-white', typeLine: 'Basic Land — Plains' }],
    });
    const islandA = makeDef({
      scryfallId: 'island-a',
      typeLine: 'Basic Land — Island',
      producedMana: ['U'],
      faces: [{ name: 'island-a', typeLine: 'Basic Land — Island' }],
    });
    const islandB = makeDef({
      scryfallId: 'island-b',
      typeLine: 'Basic Land — Island',
      producedMana: ['U'],
      faces: [{ name: 'island-b', typeLine: 'Basic Land — Island' }],
    });
    let state = setup([
      { def: onlyWhite, isCommander: false },
      { def: islandA, isCommander: false },
      { def: islandB, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'only-white');
    state = moveToBattlefield(state, 'island-a');
    state = moveToBattlefield(state, 'island-b');

    const plan = planAutoTap(state, parseManaCost('{1}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([{ cardId: cardIdByDef(state, 'island-a'), color: 'U' }]);
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

  it('uses the exact multi-mana bundle produced by one activation', () => {
    const solRing = makeDef({
      scryfallId: 'exact-sol-ring',
      typeLine: 'Artifact',
      producedMana: ['C'],
      faces: [
        { name: 'exact-sol-ring', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.' },
      ],
    });
    let state = setup([{ def: solRing, isCommander: false }]);
    state = moveToBattlefield(state, 'exact-sol-ring');

    const plan = planAutoTap(state, parseManaCost('{2}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.activations).toEqual([
      { cardId: cardIdByDef(state, 'exact-sol-ring'), mana: pool({ C: 2 }) },
    ]);
    expect(plan.payment).toEqual(pool({ C: 2 }));
  });

  it('chains a normal source into a costed signet mana ability for casting', () => {
    const plains = makeDef({
      scryfallId: 'signet-plains',
      typeLine: 'Basic Land — Plains',
      producedMana: ['W'],
      faces: [{ name: 'signet-plains', typeLine: 'Basic Land — Plains' }],
    });
    const signet = makeDef({
      scryfallId: 'boros-signet',
      typeLine: 'Artifact',
      producedMana: ['R', 'W'],
      faces: [
        { name: 'boros-signet', typeLine: 'Artifact', oracleText: '{1}, {T}: Add {R}{W}.' },
      ],
    });
    let state = setup([
      { def: plains, isCommander: false },
      { def: signet, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'signet-plains');
    state = moveToBattlefield(state, 'boros-signet');

    const plan = planAutoManaPayment(state, parseManaCost('{R}{W}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.taps.map((tap) => tap.cardId)).toEqual([
      cardIdByDef(state, 'signet-plains'),
      cardIdByDef(state, 'boros-signet'),
    ]);
    expect(plan.activations[1]?.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'payMana', payment: pool({ W: 1 }) }),
      expect.objectContaining({ type: 'addMana', color: 'R', amount: 1 }),
      expect.objectContaining({ type: 'addMana', color: 'W', amount: 1 }),
    ]));
    expect(plan.payment).toEqual(pool({ R: 1, W: 1 }));
  });

  it('keeps a self-sacrificing mana source after a reusable source', () => {
    const forest = makeDef({
      scryfallId: 'reusable-forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'],
      faces: [{ name: 'reusable-forest', typeLine: 'Basic Land — Forest' }],
    });
    const petal = makeDef({
      scryfallId: 'last-resort-petal',
      typeLine: 'Artifact',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'last-resort-petal',
          typeLine: 'Artifact',
          oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
        },
      ],
    });
    let state = setup([
      { def: petal, isCommander: false },
      { def: forest, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'last-resort-petal');
    state = moveToBattlefield(state, 'reusable-forest');

    const plan = planAutoManaPayment(state, parseManaCost('{G}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(state, 'reusable-forest'), color: 'G' },
    ]);
  });

  it('pays a self-sacrifice cost atomically when it is the only legal source', () => {
    const petal = makeDef({
      scryfallId: 'required-petal',
      typeLine: 'Artifact',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'required-petal',
          typeLine: 'Artifact',
          oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
        },
      ],
    });
    let state = setup([{ def: petal, isCommander: false }]);
    state = moveToBattlefield(state, 'required-petal');
    const petalId = cardIdByDef(state, 'required-petal');

    const plan = planAutoManaPayment(state, parseManaCost('{U}'), 0);
    const resolved = applyCommands(state, autoTapCommands(plan)).state;

    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([{ cardId: petalId, color: 'U' }]);
    expect(resolved.cards[petalId].zone).toBe('graveyard');
    expect(resolved.manaPool.U).toBe(1);
  });

  it('uses a pain source only when needed and applies its damage rider', () => {
    const mountain = makeDef({
      scryfallId: 'pain-mountain',
      typeLine: 'Basic Land — Mountain',
      producedMana: ['R'],
      faces: [{ name: 'pain-mountain', typeLine: 'Basic Land — Mountain' }],
    });
    const talisman = makeDef({
      scryfallId: 'pain-talisman',
      typeLine: 'Artifact',
      producedMana: ['C', 'R', 'W'],
      faces: [
        {
          name: 'pain-talisman',
          typeLine: 'Artifact',
          oracleText:
            '{T}: Add {C}.\n{T}: Add {R} or {W}. This artifact deals 1 damage to you.',
        },
      ],
    });
    let state = setup([
      { def: talisman, isCommander: false },
      { def: mountain, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'pain-talisman');
    state = moveToBattlefield(state, 'pain-mountain');

    const redPlan = planAutoManaPayment(state, parseManaCost('{R}'), 0);
    expect(redPlan.taps).toEqual([
      { cardId: cardIdByDef(state, 'pain-mountain'), color: 'R' },
    ]);

    const whitePlan = planAutoManaPayment(state, parseManaCost('{W}'), 0);
    expect(whitePlan.taps).toEqual([
      { cardId: cardIdByDef(state, 'pain-talisman'), color: 'W' },
    ]);
    const resolved = applyCommands(state, autoTapCommands(whitePlan)).state;
    expect(resolved.manaPool.W).toBe(1);
    expect(resolved.life).toBe(state.life - 1);
  });

  it('reads charge counters for variable fixed-state mana output', () => {
    const chalice = makeDef({
      scryfallId: 'counter-chalice',
      typeLine: 'Artifact',
      producedMana: ['C'],
      faces: [
        {
          name: 'counter-chalice',
          typeLine: 'Artifact',
          oracleText: '{T}: Add {C} for each charge counter on this artifact.',
        },
      ],
    });
    let state = setup([{ def: chalice, isCommander: false }]);
    state = moveToBattlefield(state, 'counter-chalice');
    const chaliceId = cardIdByDef(state, 'counter-chalice');
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: chaliceId,
      counterType: 'charge',
      delta: 3,
    }).state;

    const plan = planAutoManaPayment(state, parseManaCost('{3}'), 0);

    expect(plan.ok).toBe(true);
    expect(plan.activations).toEqual([
      { cardId: chaliceId, abilityLineIndex: 0, mana: pool({ C: 3 }) },
    ]);
  });

  it('enables a Tainted land colored ability only while controlling a Swamp', () => {
    const swamp = makeDef({
      scryfallId: 'gate-swamp',
      typeLine: 'Basic Land — Swamp',
      producedMana: ['B'],
      faces: [{ name: 'gate-swamp', typeLine: 'Basic Land — Swamp' }],
    });
    const tainted = makeDef({
      scryfallId: 'gate-tainted-isle',
      typeLine: 'Land',
      producedMana: ['C', 'U', 'B'],
      faces: [
        {
          name: 'gate-tainted-isle',
          typeLine: 'Land',
          oracleText:
            '{T}: Add {C}.\n{T}: Add {U} or {B}. Activate only if you control a Swamp.',
        },
      ],
    });
    let withoutSwamp = setup([{ def: tainted, isCommander: false }]);
    withoutSwamp = moveToBattlefield(withoutSwamp, 'gate-tainted-isle');
    expect(planAutoManaPayment(withoutSwamp, parseManaCost('{U}'), 0).ok).toBe(false);

    let withSwamp = setup([
      { def: tainted, isCommander: false },
      { def: swamp, isCommander: false },
    ]);
    withSwamp = moveToBattlefield(withSwamp, 'gate-tainted-isle');
    withSwamp = moveToBattlefield(withSwamp, 'gate-swamp');
    const plan = planAutoManaPayment(withSwamp, parseManaCost('{U}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps).toEqual([
      { cardId: cardIdByDef(withSwamp, 'gate-tainted-isle'), color: 'U' },
    ]);
  });

  it('derives Mox Amber colors from legendary creatures and planeswalkers in play', () => {
    const mox = makeDef({
      scryfallId: 'state-mox-amber',
      typeLine: 'Legendary Artifact',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'state-mox-amber',
          typeLine: 'Legendary Artifact',
          oracleText:
            '{T}: Add one mana of any color among legendary creatures and planeswalkers you control.',
        },
      ],
    });
    const legend = makeDef({
      scryfallId: 'state-legend',
      typeLine: 'Legendary Creature — Wizard',
      faces: [
        {
          name: 'state-legend',
          typeLine: 'Legendary Creature — Wizard',
          manaCost: '{U}{R}',
        },
      ],
    });
    let withoutLegend = setup([{ def: mox, isCommander: false }]);
    withoutLegend = moveToBattlefield(withoutLegend, 'state-mox-amber');
    expect(planAutoManaPayment(withoutLegend, parseManaCost('{U}'), 0).ok).toBe(false);

    let withLegend = setup([
      { def: mox, isCommander: false },
      { def: legend, isCommander: false },
    ]);
    withLegend = moveToBattlefield(withLegend, 'state-mox-amber');
    withLegend = moveToBattlefield(withLegend, 'state-legend');

    const blue = planAutoManaPayment(withLegend, parseManaCost('{U}'), 0);
    const green = planAutoManaPayment(withLegend, parseManaCost('{G}'), 0);
    expect(blue.ok).toBe(true);
    expect(blue.taps).toEqual([
      { cardId: cardIdByDef(withLegend, 'state-mox-amber'), color: 'U' },
    ]);
    expect(green.ok).toBe(false);
  });

  it('uses a low-value noncommander creature for a required sacrifice mana cost', () => {
    const tower = makeDef({
      scryfallId: 'sacrifice-tower',
      typeLine: 'Land',
      producedMana: ['C', 'B'],
      faces: [
        {
          name: 'sacrifice-tower',
          typeLine: 'Land',
          oracleText: '{T}: Add {C}.\n{T}, Sacrifice a creature: Add {B}{B}.',
        },
      ],
    });
    const commander = makeDef({
      scryfallId: 'sacrifice-commander',
      typeLine: 'Legendary Creature — Wizard',
      cmc: 5,
      faces: [
        {
          name: 'sacrifice-commander',
          typeLine: 'Legendary Creature — Wizard',
          manaCost: '{3}{U}{B}',
        },
      ],
    });
    const fodder = makeDef({
      scryfallId: 'sacrifice-fodder',
      typeLine: 'Creature — Zombie',
      cmc: 1,
      faces: [
        {
          name: 'sacrifice-fodder',
          typeLine: 'Creature — Zombie',
          manaCost: '{B}',
        },
      ],
    });
    let state = setup([
      { def: commander, isCommander: true },
      { def: tower, isCommander: false },
      { def: fodder, isCommander: false },
    ]);
    state = moveToBattlefield(state, 'sacrifice-tower');
    state = moveToBattlefield(state, 'sacrifice-commander');
    state = moveToBattlefield(state, 'sacrifice-fodder');
    const towerId = cardIdByDef(state, 'sacrifice-tower');
    const commanderId = cardIdByDef(state, 'sacrifice-commander');
    const fodderId = cardIdByDef(state, 'sacrifice-fodder');

    const plan = planAutoManaPayment(state, parseManaCost('{B}{B}'), 0);
    const resolved = applyCommands(state, autoTapCommands(plan)).state;

    expect(plan.ok).toBe(true);
    expect(resolved.cards[towerId].tapped).toBe(true);
    expect(resolved.cards[fodderId].zone).toBe('graveyard');
    expect(resolved.cards[commanderId].zone).toBe('battlefield');
    expect(resolved.manaPool.B).toBe(2);
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
