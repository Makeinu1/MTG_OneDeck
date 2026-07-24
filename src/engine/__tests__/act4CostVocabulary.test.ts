import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { activationPlanForSource } from '../commands';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck, makeDef } from './helpers';
import { parseAbilityIR } from '../grammar/ir';
import { compileAbilityIR } from '../grammar/compile';

function activatedSource(id: string, typeLine: string, oracleText: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: id, typeLine, oracleText }],
  };
}

function creatureDef(id: string, typeLine = 'Legendary Creature — Human'): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 3,
    colorIdentity: ['W'],
    typeLine,
    faces: [{ name: id, typeLine }],
  };
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((c) => c.defId === defId)!.id;
}

function onBattlefield(state: GameState, cardId: string): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' })
    .state;
}

describe('ACT-4: tap-object cost (Relic of Legends pattern)', () => {
  it('produces guided cost-tap prompt for "Tap an untapped legendary creature you control"', () => {
    const source = activatedSource(
      'relic-of-legends',
      'Artifact',
      '{T}: Add {C}.\nTap an untapped legendary creature you control: Add one mana of any color.',
    );
    const legendary = creatureDef('legend-1');
    const entries = [
      { def: source, isCommander: false },
      { def: legendary, isCommander: false },
      ...makeDeck(12),
    ];
    let state = initGame(entries, 7);
    const sourceId = idOf(state, 'relic-of-legends');
    const legendId = idOf(state, 'legend-1');
    state = onBattlefield(state, sourceId);
    state = onBattlefield(state, legendId);

    const plan = activationPlanForSource(state, sourceId, 1);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    expect(plan!.costPrompts.length).toBeGreaterThanOrEqual(1);
    const tapPrompt = plan!.costPrompts.find((p) => p.kind === 'cost-tap');
    expect(tapPrompt).toBeDefined();
    expect(tapPrompt!.filter?.types).toContain('creature');
    expect(tapPrompt!.filter?.controller).toBe('you');
    expect(tapPrompt!.filter?.supertypes).toEqual(['legendary']);
    expect(tapPrompt!.filter?.zone).toBe('battlefield');
  });

  it('tap-object component is present with guided status', () => {
    const source = activatedSource(
      'relic-of-legends-2',
      'Artifact',
      'Tap an untapped legendary creature you control: Add one mana of any color.',
    );
    const legendary = creatureDef('legend-2');
    const entries = [
      { def: source, isCommander: false },
      { def: legendary, isCommander: false },
      ...makeDeck(12),
    ];
    let state = initGame(entries, 7);
    const sourceId = idOf(state, 'relic-of-legends-2');
    const legendId = idOf(state, 'legend-2');
    state = onBattlefield(state, sourceId);
    state = onBattlefield(state, legendId);

    const plan = activationPlanForSource(state, sourceId, 0);
    expect(plan).not.toBeNull();
    const tapComponent = plan!.costComponents.find((c) => c.kind === 'tap-object');
    expect(tapComponent).toBeDefined();
    expect(tapComponent!.status).toBe('guided');
    expect(tapComponent!.amount).toBe(1);
  });

  it('keeps the source eligible unless "other" or a separate self-tap reserves it', () => {
    const source = activatedSource(
      'source-eligible-tap-cost',
      'Artifact',
      'Tap an untapped artifact you control: Draw a card.',
    );
    let state = initGame([{ def: source, isCommander: false }, ...makeDeck(12)], 8);
    const sourceId = idOf(state, 'source-eligible-tap-cost');
    state = onBattlefield(state, sourceId);

    const prompt = activationPlanForSource(state, sourceId, 0)?.costPrompts[0];
    expect(prompt).toMatchObject({
      kind: 'cost-tap',
      count: 1,
      filter: { excludeSource: false, types: ['artifact'] },
    });
  });
});

describe('ACT-4: named counter removal', () => {
  it('prepares an exact self-removal command without clamping the requested amount', () => {
    const source = activatedSource(
      'counter-self-cost',
      'Artifact',
      'Remove four charge counters from this artifact: Draw a card.',
    );
    let state = initGame([{ def: source, isCommander: false }, ...makeDeck(12)], 9);
    const sourceId = idOf(state, 'counter-self-cost');
    state = onBattlefield(state, sourceId);

    const plan = activationPlanForSource(state, sourceId, 0);
    expect(plan?.commands).toContainEqual({
      type: 'addCounters',
      cardId: sourceId,
      counterType: 'charge',
      delta: -4,
    });
    expect(plan?.costComponents).toContainEqual(
      expect.objectContaining({
        kind: 'remove-counter',
        counterType: 'charge',
        amount: 4,
        status: 'auto',
      }),
    );
  });

  it('bounds one-or-more by the source current named-counter count', () => {
    const source = activatedSource(
      'counter-amount-cost',
      'Artifact Creature — Robot',
      'Remove one or more +1/+1 counters from this artifact: Draw a card.',
    );
    let state = initGame([{ def: source, isCommander: false }, ...makeDeck(12)], 10);
    const sourceId = idOf(state, 'counter-amount-cost');
    state = onBattlefield(state, sourceId);
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: sourceId,
      counterType: '+1/+1',
      delta: 3,
    }).state;

    expect(activationPlanForSource(state, sourceId, 0)?.costPrompts[0]).toMatchObject({
      kind: 'cost-remove-counter',
      counterCost: {
        interaction: 'amount',
        counterType: '+1/+1',
        amount: { kind: 'one-or-more', min: 1, max: 3 },
        sourceId,
      },
    });
  });
});

describe('ACT-4: mill cost (The Warring Triad pattern)', () => {
  it('auto-compiles "Mill a card" cost into a mill command', () => {
    const source = activatedSource(
      'warring-triad',
      'Artifact',
      '{T}, Mill a card: Target player adds one mana of any color.',
    );
    const entries = [{ def: source, isCommander: false }, ...makeDeck(12)];
    let state = initGame(entries, 7);
    const sourceId = idOf(state, 'warring-triad');
    state = onBattlefield(state, sourceId);

    const plan = activationPlanForSource(state, sourceId);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    const millCmd = plan!.commands.find((c) => c.type === 'mill');
    expect(millCmd).toBeDefined();
    expect(millCmd).toMatchObject({ type: 'mill', count: 1 });
    const millComponent = plan!.costComponents.find((c) => c.kind === 'mill');
    expect(millComponent).toBeDefined();
    expect(millComponent!.status).toBe('auto');
  });
});

describe('ACT-4: {X} guided unblock (Gogo / Pernicious Deed pattern)', () => {
  it('accepts xValue and produces auto plan for "{X}{X}, {T}" cost', () => {
    const source = activatedSource(
      'gogo',
      'Legendary Creature — Mimic',
      "{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may choose new targets for the copies. X can't be 0.",
    );
    const entries = [{ def: source, isCommander: false }, ...makeDeck(12)];
    let state = initGame(entries, 7);
    const sourceId = idOf(state, 'gogo');
    state = onBattlefield(state, sourceId);

    const plan = activationPlanForSource(state, sourceId, 0, 2);
    expect(plan).not.toBeNull();
    expect(plan!.decision).not.toBe('manual');
    const tapCmd = plan!.commands.find(
      (c) => c.type === 'setTapped' && c.cardId === sourceId && c.tapped === true,
    );
    expect(tapCmd).toBeDefined();
  });

  it('accepts xValue for "{X}, Sacrifice this enchantment" (Pernicious Deed)', () => {
    const source = activatedSource(
      'pernicious-deed',
      'Enchantment',
      '{X}, Sacrifice this enchantment: Destroy each artifact, creature, and enchantment with mana value X or less.',
    );
    const entries = [{ def: source, isCommander: false }, ...makeDeck(12)];
    let state = initGame(entries, 7);
    const sourceId = idOf(state, 'pernicious-deed');
    state = onBattlefield(state, sourceId);

    const plan = activationPlanForSource(state, sourceId, 0, 3);
    expect(plan).not.toBeNull();
    expect(plan!.decision).not.toBe('manual');
    const sacCmd = plan!.commands.find(
      (c) => c.type === 'moveCard' && c.cardId === sourceId && c.to === 'graveyard',
    );
    expect(sacCmd).toBeDefined();
  });

  it('distinguishes unbound X from an explicitly announced zero', () => {
    const source = activatedSource(
      'zero-x-deed',
      'Enchantment',
      '{X}, Sacrifice this enchantment: Draw a card.',
    );
    let state = initGame([{ def: source, isCommander: false }, ...makeDeck(12)], 11);
    const sourceId = idOf(state, 'zero-x-deed');
    state = onBattlefield(state, sourceId);

    expect(activationPlanForSource(state, sourceId, 0)?.decision).toBe('manual');
    const zeroPlan = activationPlanForSource(state, sourceId, 0, 0);
    expect(zeroPlan?.decision).toBe('auto');
    expect(zeroPlan?.costComponents).toContainEqual(
      expect.objectContaining({ kind: 'mana', amount: 0 }),
    );
  });
});

describe('Cast-watcher guided: Vivi Ornitier pattern', () => {
  it('auto-compiles "put a +1/+1 counter on Vivi Ornitier and it deals 1 damage to each opponent"', () => {
    const viviText = 'Whenever you cast a noncreature spell, put a +1/+1 counter on Vivi Ornitier and it deals 1 damage to each opponent.';
    const def = makeDef({
      scryfallId: 'Vivi Ornitier',
      name: 'Vivi Ornitier',
      typeLine: 'Legendary Creature — Bird Wizard',
      faces: [{ name: 'Vivi Ornitier', typeLine: 'Legendary Creature — Bird Wizard', oracleText: viviText }],
    });
    const ir = parseAbilityIR(viviText, 'Legendary Creature — Bird Wizard');
    const compiled = compileAbilityIR(ir, { sourceId: 'c1', def, controllerId: 'P1' });
    expect(compiled.decision).toBe('auto');
    expect(compiled.reasons).toEqual([]);
    const counterCmd = compiled.commands.find((c) => c.type === 'addCounters');
    expect(counterCmd).toMatchObject({ type: 'addCounters', cardId: 'c1', counterType: '+1/+1', delta: 1 });
    const damageCmd = compiled.commands.find((c) => c.type === 'applyPlayerEffect');
    expect(damageCmd).toMatchObject({ type: 'applyPlayerEffect', recipients: 'eachOpponent', effect: 'damage', amount: 1 });
  });

  it('auto-compiles Niv-Mizzet "you draw a card" (already working)', () => {
    const nivText = 'Whenever a player casts an instant or sorcery spell, you draw a card.';
    const def = makeDef({
      scryfallId: 'Niv-Mizzet, Parun',
      name: 'Niv-Mizzet, Parun',
      typeLine: 'Legendary Creature — Dragon Wizard',
      faces: [{ name: 'Niv-Mizzet, Parun', typeLine: 'Legendary Creature — Dragon Wizard', oracleText: nivText }],
    });
    const ir = parseAbilityIR(nivText, 'Legendary Creature — Dragon Wizard');
    const compiled = compileAbilityIR(ir, { sourceId: 'c1', def, controllerId: 'P1' });
    expect(compiled.decision).toBe('auto');
    expect(compiled.commands).toContainEqual({ type: 'draw', count: 1 });
  });
});
