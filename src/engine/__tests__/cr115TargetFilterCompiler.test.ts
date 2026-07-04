import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr115-target-source',
    oracleId: 'cr115-target-source',
    name: 'cr115-target-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr115-target-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
  });
}

describe('CR 115 target filter compiler leaf', () => {
  it('preserves nonland and nontoken restrictions on single battlefield object targets', () => {
    const result = compile('Exile target nonland, nontoken permanent.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: {
        types: ['permanent'],
        excludedTypes: ['land'],
        excludeTokens: true,
      },
    });
  });

  it('preserves noncreature restrictions without adding creature to the positive type filter', () => {
    const result = compile('Exile target noncreature artifact.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: {
        types: ['artifact'],
        excludedTypes: ['creature'],
      },
    });
  });

  it('preserves another target as a source exclusion', () => {
    const result = compile('Untap another target permanent you control.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.untap',
      kind: 'target',
      filter: {
        types: ['permanent'],
        controller: 'you',
        excludeSource: true,
      },
    });
  });

  it('preserves opponent-controlled restrictions on battlefield object targets', () => {
    const notYours = compile("Destroy target artifact you don't control.");
    const opponentControls = compile('Destroy target creature or enchantment an opponent controls.');

    expect(notYours.decision).toBe('guided');
    expect(notYours.prompts[0]).toMatchObject({
      atom: 'effect.destroy',
      kind: 'target',
      filter: {
        types: ['artifact'],
        controller: 'opponent',
      },
    });

    expect(opponentControls.decision).toBe('guided');
    expect(opponentControls.prompts[0]).toMatchObject({
      atom: 'effect.destroy',
      kind: 'target',
      filter: {
        types: ['creature', 'enchantment'],
        controller: 'opponent',
      },
    });
  });
});
