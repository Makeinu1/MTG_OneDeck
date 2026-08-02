import { describe, expect, it } from 'vitest';

import { makeDef } from '../../__tests__/helpers';
import { compileAbilityIR } from '../compile';
import { parseAbilityIR } from '../ir';

function compile(text: string, name = 'CR701 Fixture', typeLine = 'Sorcery') {
  const def = makeDef({
    scryfallId: `cr701-ordinary-${name.length}-${text.length}`,
    name,
    typeLine,
    faces: [{ name, typeLine, oracleText: text }],
  });
  return compileAbilityIR(parseAbilityIR(text, typeLine), {
    sourceId: 'cr701-source',
    controllerId: 'P1',
    def,
  });
}

describe('CR701 cross-player compiler leaves', () => {
  it('emits roster-independent fixed discard and sacrifice prompts', () => {
    expect(compile('Each opponent discards two cards.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{ kind: 'discard', count: 2, recipients: 'eachOpponent' }],
    });
    expect(compile('Each player sacrifices two artifact or creatures of their choice.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        kind: 'sacrifice',
        count: 2,
        recipients: 'eachPlayer',
        filter: { types: ['artifact', 'creature'], controller: 'you' },
      }],
    });
  });

  it('accepts an ability-word trigger mill while rejecting unsupported whole effects', () => {
    expect(compile(
      'Landfall — Whenever a land you control enters, each opponent mills three cards.',
      'Ruin Crab',
      'Creature — Crab',
    )).toMatchObject({
      decision: 'auto',
      prompts: [],
      commands: [{ effect: 'mill', amount: 3, recipients: 'eachOpponent' }],
    });
    for (const text of [
      'Each player discards a card at random.',
      'Each opponent sacrifices X creatures.',
      'Each opponent sacrifices a creature, discards a card, and loses 2 life.',
      'Each player mills four cards. Then you may exile a creature or planeswalker card from each graveyard.',
      'Target player mills two cards. Draw a card.',
      'That player discards a card. Draw a card.',
      'Defending player sacrifices a creature of their choice. Draw a card.',
    ]) {
      expect(compile(text)).toMatchObject({ decision: 'manual', commands: [], prompts: [] });
    }
  });

  it('preserves existing self discard and sacrifice leaves', () => {
    expect(compile('Discard a card.')).toMatchObject({
      decision: 'guided',
      prompts: [{ kind: 'discard', count: 1 }],
    });
    expect(compile('Sacrifice a creature.')).toMatchObject({
      decision: 'guided',
      prompts: [{ kind: 'sacrifice', count: 1 }],
    });
  });
});
