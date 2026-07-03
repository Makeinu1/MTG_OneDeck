import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr701-discard-source',
    oracleId: 'cr701-discard-source',
    name: 'cr701-discard-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr701-discard-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
  });
}

describe('CR 701.9 discard compiler leaf', () => {
  it('guides a self discard of one card instead of pretending auto', () => {
    const result = compile('Discard a card.');

    expect(result.decision).toBe('guided');
    expect(result.commands).toEqual([]);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.discard',
      kind: 'discard',
      count: 1,
    });

    expect(
      buildGuidedCommands(result.prompts[0], { kind: 'discard', cardIds: ['c2'] }, {
        sourceId: 'source-1',
        def: def(),
      }),
    ).toEqual([{ type: 'discard', cardIds: ['c2'] }]);
  });

  it('keeps multi-card and other-player discard manual', () => {
    expect(compile('Discard two cards.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-choice'],
    });
    expect(compile('Target player discards a card.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-choice'],
    });
  });
});
