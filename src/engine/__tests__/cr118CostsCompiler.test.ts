import { describe, expect, it } from 'vitest';

import { compileAbilityCost } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { makeDef } from './helpers';

function compileCost(line: string, overrides: { name?: string; typeLine?: string } = {}) {
  const name = overrides.name ?? 'cost-source';
  const typeLine = overrides.typeLine ?? 'Artifact';
  const def = makeDef({
    scryfallId: name,
    name,
    typeLine,
    faces: [{ name, typeLine, oracleText: line }],
  });
  const ir = parseAbilityIR(line, typeLine);
  return compileAbilityCost(ir.cost, { sourceId: 'c1', def });
}

describe('CR 118 activated cost compiler catalog', () => {
  it('auto-compiles fixed pay-life costs with existing tap and self-sacrifice costs', () => {
    const result = compileCost('{T}, Pay 3 life, Sacrifice this creature: Draw a card.', {
      typeLine: 'Creature',
    });

    expect(result).toMatchObject({
      decision: 'auto',
      manaCost: null,
      reasons: [],
    });
    expect(result.commands).toEqual([
      { type: 'setTapped', cardId: 'c1', tapped: true },
      { type: 'adjustLife', delta: -3 },
      { type: 'moveCard', cardId: 'c1', to: 'graveyard', position: 'top' },
    ]);
  });

  it('auto-compiles strict self-exile costs and preserves the remaining mana cost', () => {
    const result = compileCost('{3}, {T}, Exile this land: Add {C}.', {
      name: 'Plaza of Heroes',
      typeLine: 'Land',
    });

    expect(result).toMatchObject({
      decision: 'auto',
      manaCost: '{3}',
      reasons: [],
    });
    expect(result.commands).toEqual([
      { type: 'setTapped', cardId: 'c1', tapped: true },
      { type: 'moveCard', cardId: 'c1', to: 'exile', position: 'top' },
    ]);
  });

  it('recognizes exact card-name self-exile before comma-splitting costs', () => {
    const result = compileCost('Exile Mairsil, the Pretender: Draw a card.', {
      name: 'Mairsil, the Pretender',
      typeLine: 'Legendary Creature',
    });

    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([
      { type: 'moveCard', cardId: 'c1', to: 'exile', position: 'top' },
    ]);
  });

  it('keeps variable pay-life and chosen exile costs manual', () => {
    const variableLife = compileCost('Pay X life: Draw a card.');
    expect(variableLife.decision).toBe('manual');
    expect(variableLife.reasons).toContain('variable-x');

    const chosenExile = compileCost('{T}, Exile seven cards from your graveyard: Add {U}.', {
      typeLine: 'Land',
    });
    expect(chosenExile.decision).toBe('manual');
    expect(chosenExile.reasons).toContain('unmodeled-cost');
  });

  it('keeps conflicting self-zone-move costs manual', () => {
    const result = compileCost('Sacrifice this creature, Exile it: Draw a card.', {
      typeLine: 'Creature',
    });

    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
    expect(result.reasons).toContain('unmodeled-cost');
  });
});
