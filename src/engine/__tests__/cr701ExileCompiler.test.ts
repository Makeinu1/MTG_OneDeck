import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr701-exile-source',
    oracleId: 'cr701-exile-source',
    name: 'cr701-exile-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr701-exile-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
  });
}

describe('CR 701.13 exile compiler leaf', () => {
  it('guides a single battlefield object target to exile', () => {
    const result = compile('Exile target creature.');

    expect(result.decision).toBe('guided');
    expect(result.commands).toEqual([]);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
    });

    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'target', cardIds: ['c2'] }, {
        sourceId: 'source-1',
        def: def(),
      }),
    ).toEqual([{ type: 'moveCard', cardId: 'c2', to: 'exile', position: 'bottom' }]);
  });

  it('keeps multi-target and non-battlefield-card exile clauses manual', () => {
    expect(compile('Exile two target creatures.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-target'],
    });
    expect(compile('Exile target creature card from a graveyard.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-target'],
    });
  });
});
