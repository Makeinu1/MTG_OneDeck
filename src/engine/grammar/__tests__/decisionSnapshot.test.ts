// Corpus decision snapshot — regression floor for the grammar compiler.
//
// This is machine infrastructure, not a hand-written adversarial suite (it is
// intentionally not named `review.*`): it fingerprints the compiler's decision
// (auto/guided/manual) + emitted commands for every effect line of the full
// 17,491-card corpus and diffs against a committed snapshot, so a future
// compiler change that silently alters existing behavior is caught
// mechanically instead of relying on a human/LLM re-reading the whole corpus.
//
// Two describe blocks:
//   1. "corpus regression gate" — runs against the REAL corpus extract
//      (research/grammar-compile/corpus-extract.json.gz). That file is
//      tracked in git but does not exist until an owner with the raw corpus
//      runs `npm run snapshot:extract` once and commits the result, so this
//      block SKIPS cleanly today (and in any environment without the extract)
//      rather than failing CI.
//   2. "detectability demo" — proves the diffing machinery itself works,
//      using a tiny inline fixture corpus (no real corpus needed). This is
//      the durable, always-running proof that the floor actually detects
//      transitions.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import {
  buildSnapshotFromFingerprints,
  computeCorpusHash,
  computeFingerprints,
  diffSnapshots,
  extractCardToScryfallCard,
  formatTransitionSummary,
  hasAnyTransition,
  parseSnapshot,
  EXTRACT_RELATIVE_PATH,
  SNAPSHOT_RELATIVE_PATH,
  type ExtractCard,
  type FingerprintEntry,
} from '../../../../scripts/lib/decisionFingerprint.ts';
import type { ScryfallCard } from '../../../data/scryfall';

vi.setConfig({ testTimeout: 120_000 });

const EXTRACT_PATH = resolve(process.cwd(), EXTRACT_RELATIVE_PATH);
const SNAPSHOT_PATH = resolve(process.cwd(), SNAPSHOT_RELATIVE_PATH);
const extractExists = existsSync(EXTRACT_PATH);

describe.skipIf(!extractExists)('corpus decision snapshot: regression gate', () => {
  it('every effect line of the corpus extract fingerprints identically to the committed decision-snapshot.json', async () => {
    const gzBuffer = await readFile(EXTRACT_PATH);
    const extractCards = JSON.parse(gunzipSync(gzBuffer).toString('utf8')) as unknown as ExtractCard[];
    const reconstructed = extractCards.map(extractCardToScryfallCard);
    const fingerprintResult = computeFingerprints(reconstructed);
    const corpusHash = computeCorpusHash(extractCards);
    const currentSnapshot = buildSnapshotFromFingerprints(fingerprintResult, corpusHash);

    const previousText = await readFile(SNAPSHOT_PATH, 'utf8');
    const previousSnapshot = parseSnapshot(previousText);

    const transitionSummary = diffSnapshots(previousSnapshot.entries, currentSnapshot.entries);

    if (hasAnyTransition(transitionSummary)) {
      throw new Error(
        `Grammar compiler decision snapshot regressed against ${SNAPSHOT_RELATIVE_PATH}.\n` +
          'If this change is intentional, review the transitions below, then run ' +
          '`npm run snapshot:update` and commit the refreshed snapshot.\n\n' +
          formatTransitionSummary(transitionSummary),
      );
    }
  });
});

if (!extractExists) {
  it.skip(
    'corpus extract 未生成 — npm run snapshot:extract をローカルで実行して commit すると回帰床が有効化される',
    () => {},
  );
}

describe('corpus decision snapshot: detectability demo (fixture corpus, no real corpus needed)', () => {
  it('diffSnapshots detects a decision transition, a command-hash change, an added line, and a removed line', () => {
    const before = computeFingerprints(FIXTURE_CARDS);
    expect(before.mappingFailures).toEqual([]);
    expect(before.entries.length).toBeGreaterThanOrEqual(3);

    const mutated: FingerprintEntry[] = before.entries.map((entry) => ({ ...entry }));
    const usedIndices = new Set<number>();
    const pickIndex = (predicate: (entry: FingerprintEntry) => boolean): number => {
      const index = mutated.findIndex((entry, i) => !usedIndices.has(i) && predicate(entry));
      if (index < 0) {
        throw new Error('fixture corpus too small/homogeneous for the detectability demo');
      }
      usedIndices.add(index);
      return index;
    };

    // 1) Simulate a compiler regression that starts asking for a prompt on a
    //    line it used to auto-resolve (auto -> guided).
    const autoIndex = pickIndex((entry) => entry.d === 'a');
    const flippedEntry = { ...mutated[autoIndex], d: 'g' as const };
    mutated[autoIndex] = flippedEntry;

    // 2) Simulate a compiler refactor that changes the emitted GameCommand
    //    payload without changing the decision (command-hash change).
    const commandChangeIndex = pickIndex(() => true);
    const originalCommandHash = mutated[commandChangeIndex].c;
    const commandChangedEntry = { ...mutated[commandChangeIndex], c: 'ffffffff' };
    mutated[commandChangeIndex] = commandChangedEntry;
    expect(commandChangedEntry.c).not.toBe(originalCommandHash);

    // 3) Simulate a line-splitter regression that drops a line entirely.
    const removalIndex = pickIndex(() => true);
    const [removedEntry] = mutated.splice(removalIndex, 1);

    // 4) Simulate a brand-new card/ability appearing in a later corpus pull.
    const addedEntry: FingerprintEntry = { k: 'Fixture Added Card#0#0', d: 'a', c: '00000000', r: '00000000' };
    mutated.push(addedEntry);

    const summary = diffSnapshots(before.entries, mutated);

    expect(summary.counts['a→g']).toBe(1);
    expect(summary.examples['a→g']).toHaveLength(1);
    expect(summary.examples['a→g'][0]?.key).toBe(flippedEntry.k);
    expect(summary.examples['a→g'][0]?.before?.d).toBe('a');
    expect(summary.examples['a→g'][0]?.after?.d).toBe('g');

    expect(summary.counts.commandHashChanged).toBe(1);
    expect(summary.examples.commandHashChanged[0]?.key).toBe(commandChangedEntry.k);

    expect(summary.counts.removed).toBe(1);
    expect(summary.examples.removed[0]?.key).toBe(removedEntry.k);

    expect(summary.counts.added).toBe(1);
    expect(summary.examples.added[0]?.key).toBe(addedEntry.k);

    expect(hasAnyTransition(summary)).toBe(true);

    // The printed report (what an owner/CI log would show) surfaces every
    // detected transition kind and its example lines.
    const printed = formatTransitionSummary(summary);
    expect(printed).toContain('a→g: 1');
    expect(printed).toContain('commandHashChanged: 1');
    expect(printed).toContain('removed: 1');
    expect(printed).toContain('added: 1');
    expect(printed).toContain(flippedEntry.k);
    expect(printed).toContain(removedEntry.k);
    expect(printed).toContain(addedEntry.k);
  });

  it('reports no transitions when the same corpus is fingerprinted twice', () => {
    const first = computeFingerprints(FIXTURE_CARDS);
    const second = computeFingerprints(FIXTURE_CARDS);
    const summary = diffSnapshots(first.entries, second.entries);
    expect(hasAnyTransition(summary)).toBe(false);
  });
});

// Hand-made fixture corpus (not the real 17,491-card dump — this test proves
// the diffing machinery, the corpus regression gate above proves coverage).
const FIXTURE_CARDS: ScryfallCard[] = [
  {
    id: 'fixture-draw-two',
    oracle_id: 'fixture-draw-two',
    name: 'Fixture Draw Two',
    lang: 'en',
    layout: 'normal',
    cmc: 2,
    type_line: 'Sorcery',
    oracle_text: 'Draw two cards.',
  },
  {
    id: 'fixture-gain-life',
    oracle_id: 'fixture-gain-life',
    name: 'Fixture Gain Life',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    type_line: 'Instant',
    oracle_text: 'You gain 3 life.',
  },
  {
    id: 'fixture-discard-draw',
    oracle_id: 'fixture-discard-draw',
    name: 'Fixture Discard Draw',
    lang: 'en',
    layout: 'normal',
    cmc: 3,
    type_line: 'Sorcery',
    oracle_text: 'Discard up to three cards, then draw that many cards.',
  },
  {
    id: 'fixture-manual-line',
    oracle_id: 'fixture-manual-line',
    name: 'Fixture Manual Line',
    lang: 'en',
    layout: 'normal',
    cmc: 4,
    type_line: 'Enchantment',
    oracle_text:
      'Whenever a creature you control deals combat damage to a player, that player exiles the top card of their library. Until end of turn, you may play cards exiled this way without paying their mana cost.',
  },
  {
    id: 'fixture-two-lines',
    oracle_id: 'fixture-two-lines',
    name: 'Fixture Two Lines',
    lang: 'en',
    layout: 'normal',
    cmc: 2,
    type_line: 'Creature — Fixture',
    oracle_text: 'Flying\nWhen this creature enters the battlefield, destroy target artifact.',
  },
];
