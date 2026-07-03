import { describe, expect, it } from 'vitest';

import type { CardDef, ManaColor } from '../../types/card';
import {
  buildGuidedCommands,
  compileAbilityIR,
  type CompileContext,
} from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(overrides: Partial<CardDef> = {}): CardDef {
  return {
    scryfallId: 'mana-write-source',
    oracleId: 'mana-write-source',
    name: 'mana-write-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{ name: 'mana-write-source', typeLine: 'Artifact' }],
    ...overrides,
  };
}

function ctx(commanderColorIdentity: ManaColor[] = []): CompileContext {
  return {
    sourceId: 'c1',
    def: def(),
    commanderColorIdentity,
  };
}

function compile(line: string, context = ctx()) {
  return compileAbilityIR(parseAbilityIR(line, 'Artifact'), context);
}

describe('mana:write compiler catalog', () => {
  it('auto-compiles literal mixed mana symbol runs', () => {
    const result = compile('{T}: Add {W}{U}.');

    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([
      { type: 'addMana', color: 'W', amount: 1 },
      { type: 'addMana', color: 'U', amount: 1 },
    ]);
  });

  it('auto-compiles repeated literal mana symbols into one command per color', () => {
    const result = compile('{T}: Add {G}{G}.');

    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([{ type: 'addMana', color: 'G', amount: 2 }]);
  });

  it('guides one mana of any color and maps the answer to addMana', () => {
    const result = compile('{T}: Add one mana of any color.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 1,
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'mana', color: 'R' }, ctx()),
    ).toEqual([{ type: 'addMana', color: 'R', amount: 1 }]);
  });

  it('limits commander color identity prompts to the commander colors', () => {
    const result = compile(
      "{T}: Add two mana of any one color in your commander's color identity.",
      ctx(['U', 'B']),
    );

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 2,
      manaOptions: ['U', 'B'],
    });
    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'mana', color: 'B' }, ctx(['U', 'B'])),
    ).toEqual([{ type: 'addMana', color: 'B', amount: 2 }]);
  });

  it('keeps restricted mana manual instead of pretending auto or guided', () => {
    const result = compile(
      '{T}: Add one mana of any color. Spend this mana only to cast creature spells.',
    );

    expect(result.decision).toBe('manual');
    expect(result.reasons).toContain('needs-parse');
    expect(result.commands).toEqual([]);
    expect(result.prompts).toEqual([]);
  });
});
