import { describe, expect, it } from 'vitest';

import { makeDef } from '../../__tests__/helpers';
import { buildGuidedCommands, compileAbilityIR } from '../compile';
import { detectEffectAtoms } from '../index';
import { parseAbilityIR } from '../ir';

function compile(text: string, name = 'Heal Fixture', typeLine = 'Creature') {
  const def = makeDef({
    scryfallId: `cr701-heal-${name.length}-${text.length}`,
    name,
    typeLine,
    faces: [{ name, typeLine, oracleText: text }],
  });
  return compileAbilityIR(parseAbilityIR(text, typeLine), {
    sourceId: 'heal-source',
    controllerId: 'P1',
    def,
  });
}

describe('CR 701.69 Heal compiler leaf', () => {
  it('detects effect.heal atom in oracle text', () => {
    const atoms = detectEffectAtoms('Heal target creature.');
    expect(atoms).toContain('effect.heal');
  });

  it('parses IR with effect.heal atom and ruleRef 701.69', () => {
    const ir = parseAbilityIR('Heal target creature.', 'Creature');
    const healEffect = ir.effects.find((e) => e.atom === 'effect.heal');
    expect(healEffect).toBeDefined();
    expect(healEffect!.ruleRef).toBe('701.69');
  });

  it('produces a guided target prompt for single-target heal', () => {
    const result = compile('Heal target creature.');
    expect(result.decision).toBe('guided');
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.heal',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
    });
  });

  it('buildGuidedCommands emits clearMarkedDamage for heal prompt', () => {
    const result = compile('Heal target creature.');
    expect(result.prompts).toHaveLength(1);
    const prompt = result.prompts[0];
    const def = makeDef({
      scryfallId: 'heal-cmd-ctx',
      name: 'Heal Fixture',
      typeLine: 'Creature',
      faces: [{ name: 'Heal Fixture', typeLine: 'Creature', oracleText: 'Heal target creature.' }],
    });
    const commands = buildGuidedCommands(
      prompt,
      { kind: 'target', cardIds: ['damaged-creature-1'] },
      { sourceId: 'heal-source', controllerId: 'P1', def },
    );
    expect(commands).toEqual([{ type: 'clearMarkedDamage', cardId: 'damaged-creature-1' }]);
  });

  it('parses activated shape with tap cost + heal effect', () => {
    const ir = parseAbilityIR('{T}: Heal target creature.', 'Creature');
    expect(ir.shape).toBe('activated');
    expect(ir.cost).not.toBeNull();
    expect(ir.cost!.tap).toBe(true);
    const healEffect = ir.effects.find((e) => e.atom === 'effect.heal');
    expect(healEffect).toBeDefined();
    expect(healEffect!.ruleRef).toBe('701.69');
  });

  it('does not produce a guided prompt for mass heal phrasing', () => {
    const result = compile('Heal all damage dealt to target creature.');
    // "all" phrasing should prevent single-target guided recognition
    const healPrompt = result.prompts.find((p) => p.atom === 'effect.heal');
    expect(healPrompt).toBeUndefined();
  });
});
