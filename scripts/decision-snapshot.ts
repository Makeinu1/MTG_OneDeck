/**
 * Corpus decision snapshot — regression floor for the grammar compiler.
 *
 * Two modes:
 *   npm run snapshot:extract  — reads the raw 17,491-card Scryfall corpus
 *     (research/scryfall-rules/2026-06-19/raw/*.cards.json, gitignored,
 *     present only on the machine that downloaded it) and writes a compact,
 *     tracked projection (research/grammar-compile/corpus-extract.json.gz)
 *     containing exactly the fields the grammar compiler's enumeration path
 *     reads. It self-validates by recomputing fingerprints from raw and from
 *     the extract and aborting on any mismatch, then runs the update step.
 *
 *   npm run snapshot:update   — reads the tracked extract and (re)writes
 *     research/grammar-compile/decision-snapshot.json (tracked, NOT
 *     compressed, one JSON object per line for git-diffability), printing a
 *     transition summary against the previous snapshot if one exists.
 *
 * See scripts/lib/decisionFingerprint.ts for the shared, pure fingerprinting
 * logic (also used by src/engine/grammar/__tests__/decisionSnapshot.test.ts).
 */
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  buildSnapshotFromFingerprints,
  compareFingerprintResults,
  computeCorpusHash,
  computeFingerprints,
  diffSnapshots,
  errorMessage,
  extractCardToScryfallCard,
  extractRawCardsArray,
  formatTransitionSummary,
  parseSnapshot,
  scryfallCardToExtractCard,
  serializeSnapshot,
  EXTRACT_RELATIVE_PATH,
  RAW_CORPUS_RELATIVE_PATH,
  SNAPSHOT_RELATIVE_PATH,
  type ExtractCard,
  type FingerprintResult,
  type Snapshot,
} from './lib/decisionFingerprint.ts';
import type { ScryfallCard } from '../src/data/scryfall';

const RAW_PATH = resolve(process.cwd(), RAW_CORPUS_RELATIVE_PATH);
const EXTRACT_PATH = resolve(process.cwd(), EXTRACT_RELATIVE_PATH);
const SNAPSHOT_PATH = resolve(process.cwd(), SNAPSHOT_RELATIVE_PATH);

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'extract') {
    await runExtract();
  } else if (mode === 'update') {
    await runUpdate();
  } else {
    console.error('Usage: tsx scripts/decision-snapshot.ts <extract|update>');
    process.exitCode = 1;
  }
}

async function runExtract(): Promise<void> {
  console.log(`Reading raw corpus: ${relative(process.cwd(), RAW_PATH)}`);
  const payload = await readJson(RAW_PATH);
  const rawCards = extractRawCardsArray(payload);
  console.log(`raw cards: ${rawCards.length}`);

  const extractCards: ExtractCard[] = [];
  for (const raw of rawCards) {
    if (raw !== null && typeof raw === 'object') {
      extractCards.push(scryfallCardToExtractCard(raw as unknown as ScryfallCard));
    }
  }

  console.log('Self-validating: fingerprinting raw vs. reconstructed extract...');
  const rawFingerprint = computeFingerprints(rawCards);
  const reconstructed = extractCards.map(extractCardToScryfallCard);
  const extractFingerprint = computeFingerprints(reconstructed);
  const comparison = compareFingerprintResults(rawFingerprint, extractFingerprint);

  if (!comparison.ok) {
    console.error(
      `Self-validation FAILED: extract projection is lossy for fingerprinting purposes (${comparison.mismatches.length} mismatch(es) shown, extract NOT written):`,
    );
    for (const mismatch of comparison.mismatches) {
      console.error(`  ${mismatch}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `Self-validation OK: ${rawFingerprint.entries.length} fingerprints identical between raw and extract.`,
  );

  await mkdir(dirname(EXTRACT_PATH), { recursive: true });
  const json = JSON.stringify(extractCards);
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  const tmpPath = `${EXTRACT_PATH}.tmp-${process.pid}`;
  await writeFile(tmpPath, gz);
  await rename(tmpPath, EXTRACT_PATH);
  console.log(
    `Extract written: ${relative(process.cwd(), EXTRACT_PATH)} (${extractCards.length} cards, ${gz.length} bytes gzipped)`,
  );

  await runUpdateWithCards(extractCards, extractFingerprint);
}

async function runUpdate(): Promise<void> {
  let gzBuffer: Buffer;
  try {
    gzBuffer = await readFile(EXTRACT_PATH);
  } catch (error: unknown) {
    console.error(
      `Corpus extract not found: ${relative(process.cwd(), EXTRACT_PATH)}\n` +
        'Run `npm run snapshot:extract` on a machine that has the raw corpus, then commit the extract.\n' +
        errorMessage(error),
    );
    process.exitCode = 1;
    return;
  }
  const json = gunzipSync(gzBuffer).toString('utf8');
  const parsed = JSON.parse(json) as unknown as ExtractCard[];
  await runUpdateWithCards(parsed);
}

async function runUpdateWithCards(
  extractCards: ExtractCard[],
  precomputed?: FingerprintResult,
): Promise<void> {
  const fingerprintResult =
    precomputed ?? computeFingerprints(extractCards.map(extractCardToScryfallCard));
  const corpusHash = computeCorpusHash(extractCards);
  const snapshot = buildSnapshotFromFingerprints(fingerprintResult, corpusHash);

  let previous: Snapshot | undefined;
  try {
    const previousText = await readFile(SNAPSHOT_PATH, 'utf8');
    previous = parseSnapshot(previousText);
  } catch {
    previous = undefined;
  }

  const transitionSummary = diffSnapshots(previous?.entries, snapshot.entries);
  console.log(formatTransitionSummary(transitionSummary));

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, serializeSnapshot(snapshot), 'utf8');
  console.log(
    `Snapshot written: ${relative(process.cwd(), SNAPSHOT_PATH)} totals=${JSON.stringify(snapshot.header.totals)} mappingFailures=${fingerprintResult.mappingFailures.length}`,
  );
}

async function readJson(path: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    throw new Error(
      `Raw corpus not found or unreadable: ${path}\n` +
        'This file is gitignored and only present on the machine that downloaded it. ' +
        '`npm run snapshot:extract` must be run there.\n' +
        errorMessage(error),
      { cause: error },
    );
  }
  return JSON.parse(source) as unknown;
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
