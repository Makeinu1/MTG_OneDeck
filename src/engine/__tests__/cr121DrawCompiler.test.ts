import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr121-draw-source',
    oracleId: 'cr121-draw-source',
    name: 'cr121-draw-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr121-draw-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
  });
}

describe('CR 121 draw compiler leaf', () => {
  it('auto-compiles self draw effects into one draw command', () => {
    expect(compile('Draw a card.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 1 }],
    });

    expect(compile('Draw two cards.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 2 }],
    });
  });

  it('keeps non-self and variable draw clauses manual', () => {
    expect(compile('Target player draws a card.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-parse'],
    });
    expect(compile('Each player draws a card.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-parse'],
    });
    expect(compile('Draw X cards.')).toMatchObject({
      decision: 'manual',
      reasons: ['variable-count'],
    });
  });
});
