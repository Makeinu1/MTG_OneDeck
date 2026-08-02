import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

function def(overrides: Partial<CardDef> = {}): CardDef {
  const name = overrides.name ?? 'cr701-sacrifice-source';
  const typeLine = overrides.typeLine ?? 'Creature';
  return {
    scryfallId: 'cr701-sacrifice-source',
    oracleId: 'cr701-sacrifice-source',
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name, typeLine }],
    ...overrides,
  };
}

function compile(line: string, sourceDef = def()) {
  return compileAbilityIR(parseAbilityIR(line, sourceDef.typeLine), {
    sourceId: 'source-1',
    def: sourceDef,
  });
}

describe('CR 701.21 sacrifice compiler leaf', () => {
  it('guides a single self-player sacrifice choice', () => {
    const result = compile('Sacrifice a creature.');

    expect(result.decision).toBe('guided');
    expect(result.commands).toEqual([]);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.sacrifice',
      kind: 'sacrifice',
      count: 1,
      filter: { types: ['creature'], controller: 'you' },
    });

    expect(
      buildGuidedCommands(
        result.prompts[0],
        { kind: 'sacrifice', cardIds: ['c2'] },
        { sourceId: 'source-1', def: def() },
      ),
    ).toEqual([{ type: 'moveCard', cardId: 'c2', to: 'graveyard', position: 'bottom' }]);
  });

  it('guides an explicit you-subject artifact sacrifice', () => {
    const result = compile('You sacrifice an artifact.');

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.sacrifice',
      kind: 'sacrifice',
      filter: { types: ['artifact'], controller: 'you' },
    });
  });

  it('auto-compiles deterministic self sacrifice', () => {
    expect(compile('Sacrifice this creature.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'moveCard', cardId: 'source-1', to: 'graveyard', position: 'bottom' }],
    });

    expect(compile('Sacrifice Plague Myr.', def({ name: 'Plague Myr' }))).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'moveCard', cardId: 'source-1', to: 'graveyard', position: 'bottom' }],
    });
  });

  it('guides exact each-player sacrifice while keeping unsupported clauses manual', () => {
    expect(compile('Each player sacrifices a creature.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.sacrifice',
        kind: 'sacrifice',
        count: 1,
        recipients: 'eachPlayer',
        filter: { types: ['creature'], controller: 'you' },
      }],
    });
    expect(compile('Sacrifice two creatures.').decision).toBe('manual');
    expect(compile('Target player sacrifices a creature.').decision).toBe('manual');
    expect(compile('Sacrifice a creature unless you pay {1}.').decision).toBe('manual');
  });
});
