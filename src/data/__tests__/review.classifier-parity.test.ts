import { describe, expect, it } from 'vitest';

import {
  buildClassifierParityReport,
  CLASSIFIER_PARITY_ALLOWANCES,
  CLASSIFIER_PARITY_MAPPINGS,
  compareCardClassifiers,
} from '../../../scripts/lib/classifierParity.ts';
import type { CardDef } from '../../types/card';

function card(id: string, oracleText: string): CardDef {
  return {
    scryfallId: id,
    oracleId: id,
    name: id,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Creature — Test',
    faces: [
      {
        name: id,
        typeLine: 'Creature — Test',
        oracleText,
      },
    ],
  };
}

const samples = [
  card('etb-self', 'When this creature enters, draw a card.'),
  card('death-watcher', 'Whenever a creature you control dies, draw a card.'),
  card('cast-watcher', 'Whenever a player casts a spell, draw a card.'),
  card('attack-self', 'Whenever this creature attacks, draw a card.'),
  card('draw-watcher', 'Whenever you draw a card, gain 1 life.'),
  card('sacrifice-watcher', 'Whenever you sacrifice a permanent, draw a card.'),
  card(
    'known-enter-inflection-gap',
    'Whenever one or more other creatures you control enter, draw a card.',
  ),
  card('allowed-phase-gap', 'At the beginning of combat on your turn, draw a card.'),
];

describe('research/runtime classifier parity', () => {
  it('keeps the explicit mapping and allowance tables stable', () => {
    expect(CLASSIFIER_PARITY_MAPPINGS.map((mapping) => mapping.eventFamily)).toEqual([
      'enters',
      'dies',
      'leaves',
      'cast',
      'attacks',
      'draw',
      'sacrifice',
    ]);
    expect(CLASSIFIER_PARITY_ALLOWANCES.map((allowance) => allowance.axis)).toContain(
      'observer',
    );
    expect(CLASSIFIER_PARITY_ALLOWANCES.map((allowance) => allowance.axis)).toContain(
      'phase',
    );
  });

  it('agrees on representative mapped trigger families', () => {
    for (const sample of samples.slice(0, 6)) {
      const parity = compareCardClassifiers(sample);
      expect(parity.comparable, sample.name).toBe(true);
      expect(parity.agree, sample.name).toBe(true);
    }
  });

  it('records the current sample divergence rate and excludes allowed axes', () => {
    const report = buildClassifierParityReport(samples);
    expect(report.summary.totalCards).toBe(8);
    expect(report.summary.comparableCards).toBe(7);
    expect(report.summary.divergentCards).toBe(1);
    expect(report.summary.cardDivergenceRate).toBeCloseTo(1 / 7, 10);
    expect(report.summary.comparisons).toBe(7);
    expect(report.summary.mismatchedComparisons).toBe(1);
    expect(report.mismatches.map((entry) => entry.name)).toEqual([
      'known-enter-inflection-gap',
    ]);
  });
});
