/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../scryfall';
import {
  buildClassifierParityReport,
  CLASSIFIER_PARITY_ALLOWANCES,
  CLASSIFIER_PARITY_MAPPINGS,
  compareCardClassifiers,
} from '../../../scripts/lib/classifierParity.ts';
import type { CardDef } from '../../types/card';
import { classifierParityPins } from './fixtures/classifier-parity-pins';

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

// Synthetic samples: post M-GATE-2, the plural-inflection enter case must AGREE
// (runtime now catches "one or more ... enter"), so the sample set is fully clean.
const samples = [
  card('etb-self', 'When this creature enters, draw a card.'),
  card('death-watcher', 'Whenever a creature you control dies, draw a card.'),
  card('cast-watcher', 'Whenever a player casts a spell, draw a card.'),
  card('attack-self', 'Whenever this creature attacks, draw a card.'),
  card('draw-watcher', 'Whenever you draw a card, gain 1 life.'),
  card('sacrifice-watcher', 'Whenever you sacrifice a permanent, draw a card.'),
  card(
    'enter-inflection-plural',
    'Whenever one or more other creatures you control enter, draw a card.',
  ),
  card('allowed-phase-gap', 'At the beginning of combat on your turn, draw a card.'),
];

// Full corpus is gitignored; the corpus-level gate runs locally (and via
// `npm run classifier-parity`), and is skipped in CI where the snapshot is absent.
const SNAPSHOT_PATH = resolve(
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const hasSnapshot = existsSync(SNAPSHOT_PATH);

interface SnapshotPayload {
  cards?: unknown[];
}

function loadCorpusDefs(): CardDef[] {
  const payload: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ((payload as SnapshotPayload).cards ?? [])
      : [];
  const defs: CardDef[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    defs.push(mapScryfallCardToCardDef(entry as ScryfallCard));
  }
  return defs;
}

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
    // M-GATE-2 adds NO new allowances: every cluster is a fixable bug (§34.7.3.1).
    expect(CLASSIFIER_PARITY_ALLOWANCES.map((allowance) => allowance.axis)).toEqual([
      'observer',
      'risk/layer/confidence',
      'unmapped event families',
      'phase',
      'damage',
    ]);
  });

  it('agrees on all representative synthetic samples (plural enter now resolved)', () => {
    for (const sample of samples) {
      const parity = compareCardClassifiers(sample);
      if (sample.name === 'allowed-phase-gap') {
        // phase has no mapped family — not comparable, excluded from parity.
        expect(parity.comparable, sample.name).toBe(false);
        continue;
      }
      expect(parity.comparable, sample.name).toBe(true);
      expect(parity.agree, sample.name).toBe(true);
    }
  });

  it('records the clean synthetic sample report', () => {
    const report = buildClassifierParityReport(samples);
    expect(report.summary.totalCards).toBe(8);
    expect(report.summary.comparableCards).toBe(7);
    expect(report.summary.divergentCards).toBe(0);
    expect(report.summary.mismatchedComparisons).toBe(0);
  });

  // CI-safe gate: committed real-card fixtures, one per adjudicated cluster
  // (docs/engine-spec.md §34.7.3.1). Each must carry ZERO mapped-family mismatches.
  // A card may become non-comparable (e.g. Buster Sword loses its only mapped family
  // when the spurious cast runtime-FP is removed) — that is also clean.
  it('agrees on every adjudicated cluster representative (§34.7.3.1)', () => {
    expect(classifierParityPins.length).toBe(18);
    for (const pin of classifierParityPins) {
      const parity = compareCardClassifiers(pin.def);
      expect(
        parity.mismatches.map((m) => `${m.direction}:${m.eventFamily}`).join(','),
        `${pin.def.name} [${pin.cluster}]`,
      ).toBe('');
    }
  });

  // Local-only strong gate: the entire snapshot must reach divergentCards === 0.
  // Skipped in CI (snapshot gitignored); enforced on the maintainer machine and by
  // `npm run classifier-parity`.
  it.skipIf(!hasSnapshot)(
    'reaches full corpus parity: divergentCards === 0 (local snapshot)',
    () => {
      const report = buildClassifierParityReport(loadCorpusDefs());
      const offenders = report.mismatches
        .slice(0, 25)
        .map(
          (entry) =>
            `《${entry.name}》 ${entry.mismatches.map((m) => `${m.direction}:${m.eventFamily}`).join(',')}`,
        );
      expect(report.summary.comparableCards).toBeGreaterThan(6000);
      expect(report.summary.divergentCards, offenders.join(' | ')).toBe(0);
    },
    60000,
  );
});
