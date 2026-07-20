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

  it('guides "add N mana in any combination of colors" as a mana prompt', () => {
    const result = compile('{5}, {T}: Add five mana in any combination of colors.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 5,
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'mana', color: 'G' }, ctx()),
    ).toEqual([{ type: 'addMana', color: 'G', amount: 5 }]);
  });

  it('guides "add one mana of the chosen color" (CR 607.2 linked ability)', () => {
    const result = compile('{T}: Add one mana of the chosen color.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 1,
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'mana', color: 'W' }, ctx()),
    ).toEqual([{ type: 'addMana', color: 'W', amount: 1 }]);
  });

  it('guides "choose a color, add one mana of that color"', () => {
    const result = compile('{T}: Choose a color. Add one mana of that color.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 1,
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
  });

  it('keeps "add X mana in any combination" as manual (variable count)', () => {
    const result = compile(
      '{T}: Add X mana in any combination of colors, where X is the number of creatures you control with defender.',
    );

    expect(result.decision).toBe('manual');
    expect(result.prompts).toEqual([]);
  });


  it('auto-compiles "{3}: Untap [self name]" as self-referential (CR 201.3)', () => {
    const monolithDef = def({
      scryfallId: 'basalt-monolith',
      oracleId: 'basalt-monolith',
      name: 'Basalt Monolith',
      faces: [{ name: 'Basalt Monolith', typeLine: 'Artifact' }],
    });
    const result = compileAbilityIR(
      parseAbilityIR('{3}: Untap Basalt Monolith.', 'Artifact'),
      { sourceId: 'c1', def: monolithDef },
    );

    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([{ type: 'setTapped', cardId: 'c1', tapped: false }]);
  });

});
