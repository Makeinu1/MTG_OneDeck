import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(): CardDef {
  return {
    scryfallId: 'cr701-search-shuffle-source',
    oracleId: 'cr701-search-shuffle-source',
    name: 'cr701-search-shuffle-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Sorcery',
    faces: [{ name: 'cr701-search-shuffle-source', typeLine: 'Sorcery' }],
  };
}

function compile(line: string, libraryShuffleOrder?: readonly string[]) {
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: def(),
    ...(libraryShuffleOrder ? { libraryShuffleOrder } : {}),
  });
}

describe('CR 701.23/701.24 search and shuffle compiler leaf', () => {
  it('auto-compiles a pure self-library shuffle only when a deterministic order is supplied', () => {
    expect(compile('Shuffle your library.', ['c3', 'c1', 'c2'])).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'shuffle', order: ['c3', 'c1', 'c2'] }],
    });

    expect(compile('Shuffle your library.')).toMatchObject({
      decision: 'manual',
      reasons: ['no-command'],
    });
  });

  it('keeps search plus shuffle manual instead of half-executing the shuffle', () => {
    const result = compile(
      'Search your library for a basic land card, put it into your hand, then shuffle.',
      ['c3', 'c1', 'c2'],
    );

    expect(result.decision).toBe('manual');
    expect(result.reasons).toEqual(expect.arrayContaining(['needs-choice']));
  });

  it('keeps other-player shuffle instructions manual', () => {
    expect(compile('Target player shuffles their library.').decision).toBe('manual');
  });
});
