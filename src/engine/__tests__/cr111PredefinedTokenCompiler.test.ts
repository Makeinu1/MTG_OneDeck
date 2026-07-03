import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr111-token-source',
    oracleId: 'cr111-token-source',
    name: 'cr111-token-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr111-token-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
  });
}

describe('CR 111.10 predefined token compiler leaf', () => {
  it.each([
    ['Create two Clue tokens.', 'clue', '手掛かり', 'Token Artifact — Clue', 2],
    ['Create a Food token.', 'food', '食物', 'Token Artifact — Food', 1],
    ['Create a Blood token.', 'blood', '血', 'Token Artifact — Blood', 1],
  ] as const)('auto-compiles %s', (line, tokenKind, name, typeLine, quantity) => {
    const result = compile(line);

    expect(result.decision).toBe('auto');
    expect(result.reasons).toEqual([]);
    expect(result.prompts).toEqual([]);
    expect(result.commands).toEqual([
      {
        type: 'createToken',
        name,
        typeLine,
        quantity,
        tokenKind,
      },
    ]);
  });

  it('keeps variable and mixed predefined token creation manual', () => {
    expect(compile('Create X Blood tokens.')).toMatchObject({
      decision: 'manual',
      reasons: ['variable-count'],
    });
    expect(compile('Create a Clue token and a Food token.')).toMatchObject({
      decision: 'manual',
      reasons: ['needs-parse'],
    });
  });
});
