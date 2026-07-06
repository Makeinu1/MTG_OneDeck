import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommands } from '../batch';
import { applyCommand, eligibleTargets, guidedPlanForStackTop } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState, ManaPool, ZoneId } from '../types';
import { makeDef } from './helpers';

function pool(partial: Partial<ManaPool>): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...partial };
}

function spellDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }],
  });
}

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

function compile(line: string) {
  const source = spellDef('compile-source', 'Instant', line);
  return compileAbilityIR(parseAbilityIR(line, 'Instant'), {
    sourceId: 'source-1',
    def: source,
  });
}

describe('CR 608/701.6 guided counter target spell Slice A', () => {
  it('compiles approved simple counter-spell clauses to stack target prompts', () => {
    expect(compile('Counter target spell.')).toMatchObject({
      decision: 'guided',
      prompts: [{ atom: 'effect.counter-spell', filter: { zone: 'stack' } }],
    });
    expect(compile('Counter target noncreature spell.')).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.counter-spell',
          filter: { zone: 'stack', excludedTypes: ['creature'] },
        },
      ],
    });
    expect(compile('Counter target creature spell.')).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.counter-spell',
          filter: { zone: 'stack', types: ['creature'] },
        },
      ],
    });
    expect(compile('Counter target instant or sorcery spell.')).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.counter-spell',
          filter: { zone: 'stack', types: ['instant', 'sorcery'] },
        },
      ],
    });
    expect(compile('Counter target enchantment, instant, or sorcery spell.')).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.counter-spell',
          filter: { zone: 'stack', types: ['enchantment', 'instant', 'sorcery'] },
        },
      ],
    });
  });

  it('keeps controller/LKI follow-up counter cards manual for this slice', () => {
    expect(
      compile('Counter target noncreature spell. Its controller creates two Treasure tokens.'),
    ).not.toMatchObject({ decision: 'guided' });
    expect(
      compile(
        'Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token.',
      ),
    ).not.toMatchObject({ decision: 'guided' });
  });

  it('Fierce Guardianship filters noncreature stack spells and counters the chosen spell without refund', () => {
    const fierce = spellDef('fierce-guardianship', 'Instant', 'Counter target noncreature spell.');
    const drawSpell = spellDef('draw-spell', 'Instant', 'Draw two cards.');
    const creature = spellDef('creature-spell', 'Creature — Bear');
    const abilitySource = spellDef('ability-source', 'Creature — Wizard');
    let state = initGame(
      [
        { def: fierce, isCommander: false },
        { def: drawSpell, isCommander: false },
        { def: creature, isCommander: false },
        { def: abilitySource, isCommander: false },
      ],
      1,
    );
    const fierceId = idOf(state, 'fierce-guardianship');
    const drawSpellId = idOf(state, 'draw-spell');
    const creatureId = idOf(state, 'creature-spell');
    const abilitySourceId = idOf(state, 'ability-source');

    state = move(state, abilitySourceId, 'battlefield');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: abilitySourceId,
      kind: 'triggered',
    }).state;
    const abilityId = state.zones.stack[0];
    state = applyCommand(state, { type: 'addMana', color: 'C', amount: 3 }).state;
    state = applyCommand(state, {
      type: 'castToStack',
      cardId: drawSpellId,
      payment: pool({ C: 2 }),
      forced: false,
    }).state;
    state = move(state, creatureId, 'stack');
    state = move(state, fierceId, 'stack');

    const plan = guidedPlanForStackTop(state);
    expect(plan?.prompts[0]).toMatchObject({
      atom: 'effect.counter-spell',
      filter: { zone: 'stack', excludedTypes: ['creature'] },
    });
    expect(eligibleTargets(state, plan!.prompts[0].filter ?? {}, { sourceId: fierceId })).toEqual([
      drawSpellId,
    ]);
    expect(eligibleTargets(state, { zone: 'stack' }, { sourceId: fierceId })).toEqual([
      drawSpellId,
      creatureId,
    ]);
    expect(state.zones.stack).toContain(abilityId);

    const beforeHandCount = state.zones.hand.length;
    const commands = buildGuidedCommands(
      plan!.prompts[0],
      { kind: 'target', cardIds: [drawSpellId] },
      { sourceId: fierceId, def: fierce },
    );
    expect(commands).toEqual([{ type: 'removeStackItem', id: drawSpellId }]);

    const resolved = applyCommands(state, [...commands, { type: 'resolveStackTop' }]).state;
    expect(resolved.cards[drawSpellId].zone).toBe('graveyard');
    expect(resolved.zones.stack).not.toContain(drawSpellId);
    expect(resolved.cards[creatureId].zone).toBe('stack');
    expect(resolved.zones.stack).toContain(creatureId);
    expect(resolved.zones.hand).toHaveLength(beforeHandCount);
    expect(resolved.manaPool.C).toBe(1);
  });

  it('Pact of Negation can target any non-ability stack spell but not itself', () => {
    const pact = spellDef('pact-of-negation', 'Instant', 'Counter target spell.');
    const instant = spellDef('target-instant', 'Instant');
    const creature = spellDef('target-creature', 'Creature — Drake');
    const abilitySource = spellDef('ability-source', 'Creature — Wizard');
    let state = initGame(
      [
        { def: pact, isCommander: false },
        { def: instant, isCommander: false },
        { def: creature, isCommander: false },
        { def: abilitySource, isCommander: false },
      ],
      1,
    );
    const pactId = idOf(state, 'pact-of-negation');
    const instantId = idOf(state, 'target-instant');
    const creatureId = idOf(state, 'target-creature');
    const abilitySourceId = idOf(state, 'ability-source');

    state = move(state, abilitySourceId, 'battlefield');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: abilitySourceId,
      kind: 'activated',
    }).state;
    const abilityId = state.zones.stack[0];
    state = move(state, instantId, 'stack');
    state = move(state, creatureId, 'stack');
    state = move(state, pactId, 'stack');

    const plan = guidedPlanForStackTop(state);
    expect(plan?.prompts[0]).toMatchObject({
      atom: 'effect.counter-spell',
      filter: { zone: 'stack' },
    });

    const candidates = eligibleTargets(state, plan!.prompts[0].filter ?? {}, { sourceId: pactId });
    expect(candidates).toEqual([instantId, creatureId]);
    expect(candidates).not.toContain(abilityId);
    expect(candidates).not.toContain(pactId);
  });
});
