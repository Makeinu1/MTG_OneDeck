/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../scryfall';
import {
  buildClassifierParityReport,
  CLASSIFIER_PARITY_ALLOWANCES,
  CLASSIFIER_PARITY_MAPPINGS,
  compareCardClassifiers,
  type ClassifierParityReport,
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

// The snapshot is ~30MB — too large for Vite's eager glob inline transform, so it is
// read from disk (vitest cwd = project root). This mirrors scripts/classifier-parity.ts.
const SNAPSHOT_PATH = resolve(
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);

interface SnapshotPayload {
  cards?: unknown[];
}

function rawSnapshotCards(): unknown[] {
  const payload: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as SnapshotPayload).cards)) {
    return (payload as SnapshotPayload).cards ?? [];
  }
  throw new Error('snapshot payload missing cards[]');
}

let corpusDefs: CardDef[] | undefined;
let corpusByOracleId: Map<string, CardDef> | undefined;
let corpusReport: ClassifierParityReport | undefined;

function loadCorpus(): { defs: CardDef[]; byOracleId: Map<string, CardDef> } {
  if (!corpusDefs || !corpusByOracleId) {
    const defs: CardDef[] = [];
    const byOracleId = new Map<string, CardDef>();
    for (const raw of rawSnapshotCards()) {
      if (typeof raw !== 'object' || raw === null) continue;
      const def = mapScryfallCardToCardDef(raw as unknown as ScryfallCard);
      defs.push(def);
      byOracleId.set(def.oracleId, def);
    }
    corpusDefs = defs;
    corpusByOracleId = byOracleId;
  }
  return { defs: corpusDefs, byOracleId: corpusByOracleId };
}

function corpusParityReport(): ClassifierParityReport {
  if (!corpusReport) {
    corpusReport = buildClassifierParityReport(loadCorpus().defs);
  }
  return corpusReport;
}

// One+ representative card per adjudicated cluster (docs/engine-spec.md §34.7.3.1).
// After the fixes each must produce ZERO mapped-family mismatches. Some (Buster Sword)
// become non-comparable by design: the spurious cast tag was a runtime-FP and the card
// has no other mapped family, so it leaves the parity denominator entirely.
const CLUSTER_PINS: ReadonlyArray<{ oracleId: string; name: string; cluster: string }> = [
  { oracleId: '5e060d58-4d6e-425c-b7d4-727669fcce5b', name: 'Buster Sword', cluster: 'cast runtime-FP (effect cast)' },
  { oracleId: '674e2683-31c0-4fee-95fb-98b1201e41e7', name: 'Mirrodin Besieged', cluster: 'cast research-FN (bullet)' },
  { oracleId: '93989dd7-2d3e-46e2-8e92-8d0479796087', name: 'Twinferno', cluster: 'cast research-FN (delayed)' },
  { oracleId: '605c1ee0-5e8a-4e0a-a99b-42a38873f822', name: 'Welcoming Vampire', cluster: 'enters runtime-FN (plural)' },
  { oracleId: '4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1', name: 'Frontier Siege', cluster: 'enters research-FN (bullet)' },
  { oracleId: '4469ff35-54ec-4ff5-bc19-3808ae0f711b', name: 'Wildgrowth Archaic', cluster: 'enters runtime-FP (enters with replacement)' },
  { oracleId: '322f44f0-e6da-4ee0-b474-e7d5e9a461c5', name: 'Morbid Opportunist', cluster: 'dies runtime-FN (plural)' },
  { oracleId: '36b19ec0-d581-4213-bfae-1d7808a2f60d', name: 'Together Forever', cluster: 'dies research-FN (delayed)' },
  { oracleId: '13d9822f-0398-4915-818b-b9fbaf63b93c', name: 'Demonic Tourist Laser', cluster: 'dies research-FN ({TK} prefix)' },
  { oracleId: '18bdc181-9592-4147-81fb-7f83ce137f70', name: 'Ugin, the Ineffable', cluster: 'leaves research-FN (delayed token)' },
  { oracleId: '2ffb38ec-5852-4e91-85a5-cfccd1f23556', name: "Tarrian's Soulcleaver", cluster: 'leaves research-FN (artifact or creature)' },
  { oracleId: '5958e9e3-9457-48e1-afc1-a5c89e3b0ed0', name: 'Struggle for Project Purity', cluster: 'attacks research-FN (bullet)' },
  { oracleId: '2274c7ae-5a40-4fd4-a4ac-6f56b23034e4', name: 'Jace, Architect of Thought', cluster: 'attacks research-FN (loyalty prefix)' },
  { oracleId: 'ba0d3df2-3acf-46d7-8d64-8d67d1579adc', name: 'Curse of Opulence', cluster: 'attacks runtime-FN (is attacked)' },
  { oracleId: 'c2008ba9-00df-4607-ba0c-189af52033eb', name: 'Mr. Foxglove', cluster: 'attacks runtime-FN (name period)' },
  { oracleId: 'f349f58b-8cc8-45e4-9565-2b46fdf976c9', name: 'Trouble in Pairs', cluster: 'draw runtime-FN (comma enumeration)' },
  { oracleId: '2ca969eb-3d79-4d1f-8d9d-7b8204ad166a', name: 'Starving Revenant', cluster: 'draw research-FN (Descend prefix)' },
  { oracleId: 'ddbacb74-1f98-4607-a92e-d14973b9d0ef', name: 'Groundswell', cluster: 'landfall runtime-FP (ability-word on spell)' },
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

  it(
    'reaches full corpus parity: divergentCards === 0',
    () => {
      const report = corpusParityReport();
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

  it(
    'agrees on every adjudicated cluster representative (§34.7.3.1)',
    () => {
      const { byOracleId } = loadCorpus();
      for (const pin of CLUSTER_PINS) {
        const def = byOracleId.get(pin.oracleId);
        expect(def, `missing ${pin.name} (${pin.oracleId})`).toBeDefined();
        if (!def) continue;
        const parity = compareCardClassifiers(def);
        // Each adjudicated card must carry ZERO mapped-family mismatches. A card may be
        // non-comparable (e.g. Buster Sword loses its only mapped family) — also clean.
        expect(
          parity.mismatches.map((m) => `${m.direction}:${m.eventFamily}`).join(','),
          `${pin.name} [${pin.cluster}]`,
        ).toBe('');
      }
    },
    60000,
  );
});
