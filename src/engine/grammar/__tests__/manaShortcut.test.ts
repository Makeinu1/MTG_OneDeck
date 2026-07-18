import { describe, expect, it } from 'vitest';

import {
  naiveTapManaColors,
  naiveTapManaOutputs,
  hasActivatedAddManaLine,
} from '../manaShortcut';
import { makeDef } from '../../__tests__/helpers';
import type { CardDef } from '../../../types/card';

describe('naiveTapManaColors', () => {
  it('falls back to producedMana when the card has no activated add-mana line', () => {
    const def = makeDef({
      scryfallId: 'unit-forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'],
      faces: [
        {
          name: 'unit-forest',
          typeLine: 'Basic Land — Forest',
          oracleText: '({T}: Add {G}.)',
        },
      ],
    });
    expect(hasActivatedAddManaLine(def)).toBe(false);
    expect(naiveTapManaColors(def)).toEqual(['G']);
  });

  it('is empty for a sacrifice-cost mana ability (Lotus Petal type)', () => {
    const def = makeDef({
      scryfallId: 'unit-lotus-petal',
      typeLine: 'Artifact',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'unit-lotus-petal',
          typeLine: 'Artifact',
          oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
        },
      ],
    });
    expect(hasActivatedAddManaLine(def)).toBe(true);
    expect(naiveTapManaColors(def)).toEqual([]);
  });

  it('is empty for an additional-mana-cost ability (filter land type)', () => {
    const def = makeDef({
      scryfallId: 'unit-filter-land',
      typeLine: 'Land',
      producedMana: ['W'],
      faces: [
        {
          name: 'unit-filter-land',
          typeLine: 'Land',
          oracleText: '{1}, {T}: Add {W}{W}.',
        },
      ],
    });
    expect(naiveTapManaColors(def)).toEqual([]);
  });

  it('collects literal symbols from a pure {T} line (Sol Ring type)', () => {
    const def = makeDef({
      scryfallId: 'unit-sol-ring',
      typeLine: 'Artifact',
      producedMana: ['C'],
      faces: [{ name: 'unit-sol-ring', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.' }],
    });
    expect(naiveTapManaColors(def)).toEqual(['C']);
    expect(naiveTapManaOutputs(def)).toEqual([{ C: 2 }]);
  });

  it('only credits the pure line for a mixed pure/costed card (Vivid land type)', () => {
    const def = makeDef({
      scryfallId: 'unit-vivid-land',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'unit-vivid-land',
          typeLine: 'Land',
          oracleText:
            '{T}: Add {U}.\n{T}, Remove a charge counter from unit-vivid-land: Add one mana of any color.',
        },
      ],
    });
    expect(naiveTapManaColors(def)).toEqual(['U']);
  });

  it('unions literal symbols across multiple pure lines (painland type)', () => {
    const def = makeDef({
      scryfallId: 'unit-painland',
      typeLine: 'Land',
      producedMana: ['C', 'R', 'W'],
      faces: [
        {
          name: 'unit-painland',
          typeLine: 'Land',
          oracleText: '{T}: Add {C}.\n{T}: Add {R} or {W}. unit-painland deals 1 damage to you.',
        },
      ],
    });
    expect(naiveTapManaColors(def).sort()).toEqual(['C', 'R', 'W'].sort());
    expect(naiveTapManaOutputs(def)).toEqual([{ C: 1 }, { R: 1 }, { W: 1 }]);
  });

  it('keeps a fixed multicolor output as one activation bundle', () => {
    const def = makeDef({
      scryfallId: 'unit-growth-chamber',
      typeLine: 'Land',
      producedMana: ['G', 'U'],
      faces: [
        {
          name: 'unit-growth-chamber',
          typeLine: 'Land',
          oracleText: '{T}: Add {G}{U}.',
        },
      ],
    });
    expect(naiveTapManaOutputs(def)).toEqual([{ G: 1, U: 1 }]);
  });

  it('preserves the amount for any-one-color output', () => {
    const def = makeDef({
      scryfallId: 'unit-gilded-lotus',
      typeLine: 'Artifact',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [
        {
          name: 'unit-gilded-lotus',
          typeLine: 'Artifact',
          oracleText: '{T}: Add three mana of any one color.',
        },
      ],
    });
    expect(naiveTapManaOutputs(def)).toEqual([
      { W: 3 },
      { U: 3 },
      { B: 3 },
      { R: 3 },
      { G: 3 },
    ]);
  });

  it('enumerates fixed any-combination output bundles', () => {
    const def = makeDef({
      scryfallId: 'unit-relic-of-sauron',
      typeLine: 'Artifact',
      producedMana: ['U', 'B', 'R'],
      faces: [
        {
          name: 'unit-relic-of-sauron',
          typeLine: 'Artifact',
          oracleText: '{T}: Add two mana in any combination of {U}, {B}, and/or {R}.',
        },
      ],
    });
    expect(naiveTapManaOutputs(def)).toEqual(expect.arrayContaining([
      { U: 2 },
      { U: 1, B: 1 },
      { U: 1, R: 1 },
      { B: 2 },
      { B: 1, R: 1 },
      { R: 2 },
    ]));
    expect(naiveTapManaOutputs(def)).toHaveLength(6);
  });

  it('returns [] for an undefined def', () => {
    expect(naiveTapManaColors(undefined)).toEqual([]);
    expect(hasActivatedAddManaLine(undefined)).toBe(false);
  });

  it('memoizes per CardDef identity (same array reference on repeat calls)', () => {
    const def: CardDef = makeDef({
      scryfallId: 'unit-memo',
      typeLine: 'Artifact',
      producedMana: ['C'],
      faces: [{ name: 'unit-memo', typeLine: 'Artifact', oracleText: '{T}: Add {C}.' }],
    });
    expect(naiveTapManaColors(def)).toBe(naiveTapManaColors(def));
  });
});
