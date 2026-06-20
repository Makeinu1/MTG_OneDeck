import { describe, expect, it } from 'vitest';
import { cyclingCost } from '../status';
import { makeDef } from './helpers';

describe('M4.12 cyclingCost', () => {
  it('detects English cycling costs', () => {
    const card = makeDef({
      scryfallId: 'cycler-en',
      faces: [
        {
          name: 'cycler-en',
          typeLine: 'Creature',
          oracleText: 'Cycling {1}{U}\nWhen you cycle this card, draw a card.',
        },
      ],
    });

    expect(cyclingCost(card)).toBe('{1}{U}');
  });

  it('detects colorless cycling costs from English oracle text', () => {
    const card = makeDef({
      scryfallId: 'cycler-colorless',
      faces: [
        {
          name: 'cycler-colorless',
          typeLine: 'Creature',
          oracleText: 'Cycling {2}\nWhen you cycle this card, scry 1.',
        },
      ],
    });

    expect(cyclingCost(card)).toBe('{2}');
  });

  it('returns null when cycling text is absent', () => {
    const card = makeDef({
      scryfallId: 'no-cycling',
      faces: [
        {
          name: 'no-cycling',
          typeLine: 'Creature',
          oracleText: 'When this enters, draw a card.',
        },
      ],
    });

    expect(cyclingCost(card)).toBeNull();
  });
});
