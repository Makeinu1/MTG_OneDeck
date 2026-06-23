import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';

const COVERAGE_REPORT_PATH = resolve(process.cwd(), 'research/event-coverage/report.json');
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OUTPUT_PATH = resolve(process.cwd(), 'research/event-oracle/sample.json');
const GENERATED_AT = '2026-06-23T00:00:00.000Z';

const GOLD_NAMES = [
  'Solemn Simulacrum',
  'Grave Pact',
  'Smothering Tithe',
  'Guttersnipe',
  'Bitterblossom',
  'Necropotence',
  'Mentor of the Meek',
  'Court of Grace',
  'Felidar Guardian',
  'Acclaimed Contender',
  'Adrenaline Jockey',
  'Agent of Treachery',
  'Morbid Opportunist',
  'Evolution Witness',
  'Nalfeshnee',
  'Poison-Tip Archer',
  'Sram, Senior Edificer',
  "Gaea's Anthem",
] as const;

const HEAD_FAMILIES = ['enters', 'attacks', 'phase', 'cast', 'dies'] as const;
const TAIL_FAMILIES = [
  'other',
  'zone',
  'counter',
  'discard',
  'life',
  'sacrifice',
  'tap',
  'blocks',
  'leaves',
] as const;
const OBSERVER_BUCKET_SCOPES = ['opponent', 'any'] as const;

type SampleBucket = 'gold' | 'head' | 'multi-family' | 'observer' | 'tail';

interface CoverageReport {
  cards: CoverageCard[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  families: string[];
  observers: string[];
  hasInterveningIf: boolean;
}

interface SnapshotCard {
  oracleId: string;
  name: string;
  oracleText: string;
  edhrecRank?: number;
  sortRank: number;
}

interface CoverageSnapshotCard extends SnapshotCard {
  families: string[];
  observers: string[];
  hasInterveningIf: boolean;
}

interface SampleCard {
  oracleId: string;
  name: string;
  oracleText: string;
  bucket: SampleBucket;
}

interface SampleJson {
  generatedAt: string;
  seedRule: string;
  buckets: Record<SampleBucket, number>;
  cards: SampleCard[];
}

async function main(): Promise<void> {
  const report = coerceCoverageReport(await readJson(COVERAGE_REPORT_PATH));
  const snapshotCards = readSnapshotCards(await readJson(SNAPSHOT_PATH));
  const snapshotByOracleId = mapByOracleId(snapshotCards);
  const snapshotByName = mapByName(snapshotCards);

  const selected = new Map<string, SampleCard>();

  takeCandidates(
    rankedCoverageCards(
      report.cards.filter((card) => hasAny(card.families, HEAD_FAMILIES)),
      snapshotByOracleId,
    ),
    selected,
    'head',
    100,
  );

  takeCandidates(
    rankedCoverageCards(
      report.cards.filter((card) => card.families.length >= 2),
      snapshotByOracleId,
    ),
    selected,
    'multi-family',
    40,
  );

  takeCandidates(
    rankedCoverageCards(
      report.cards.filter((card) => hasAny(card.observers, OBSERVER_BUCKET_SCOPES)),
      snapshotByOracleId,
    ),
    selected,
    'observer',
    30,
  );

  takeCandidates(
    rankedCoverageCards(
      report.cards.filter((card) => hasAny(card.families, TAIL_FAMILIES)),
      snapshotByOracleId,
    ),
    selected,
    'tail',
    22,
  );

  const missingGold: string[] = [];
  for (const name of GOLD_NAMES) {
    const card = resolveName(name, snapshotByName);
    if (card) {
      addSelected(selected, card, 'gold');
    } else {
      missingGold.push(name);
    }
  }
  if (missingGold.length > 0) {
    throw new Error(`Gold cards not found in snapshot: ${missingGold.join(', ')}`);
  }

  const sample: SampleJson = {
    generatedAt: GENERATED_AT,
    seedRule: 'edhrec_rank asc, oracleId asc',
    buckets: {
      gold: GOLD_NAMES.length,
      head: 100,
      'multi-family': 40,
      observer: 30,
      tail: 22,
    },
    cards: [...selected.values()],
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  console.log(`Event oracle sample written: ${relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`cards=${sample.cards.length} gold=${GOLD_NAMES.length}`);
}

async function readJson(path: string): Promise<unknown> {
  const source = await readFile(path, 'utf8');
  return JSON.parse(source) as unknown;
}

function readSnapshotCards(payload: unknown): SnapshotCard[] {
  const rawCards = extractRawCards(payload);
  const cards: SnapshotCard[] = [];

  for (const [index, rawCard] of rawCards.entries()) {
    if (!isRecord(rawCard)) {
      continue;
    }
    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(rawCard as unknown as ScryfallCard);
    } catch {
      continue;
    }

    const name = nonEmptyString(def.name) ?? readStringField(rawCard, 'name') ?? `(index ${index})`;
    const oracleId = nonEmptyString(def.oracleId) ?? nonEmptyString(def.scryfallId);
    const oracleText = oracleTextForCard(def);
    if (!oracleId || !oracleText) {
      continue;
    }
    cards.push({
      oracleId,
      name,
      oracleText,
      edhrecRank: def.edhrecRank,
      sortRank: rankValue(def.edhrecRank),
    });
  }

  return cards.sort(compareSnapshotCard);
}

function extractRawCards(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new Error('Input JSON must be an array or an object with data/cards array.');
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.cards)) {
    return payload.cards;
  }
  throw new Error('Input JSON object must contain data[] or cards[].');
}

function oracleTextForCard(def: CardDef): string | undefined {
  const parts = def.faces
    .map((face) => nonEmptyString(face.oracleText))
    .filter((text): text is string => Boolean(text));
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join('\n//\n');
}

function rankedCoverageCards(
  cards: readonly CoverageCard[],
  snapshotByOracleId: ReadonlyMap<string, SnapshotCard>,
): CoverageSnapshotCard[] {
  return cards
    .map((card) => {
      const snapshot = snapshotByOracleId.get(card.oracleId);
      if (!snapshot) {
        return undefined;
      }
      return {
        ...snapshot,
        families: card.families,
        observers: card.observers,
        hasInterveningIf: card.hasInterveningIf,
      };
    })
    .filter((card): card is CoverageSnapshotCard => Boolean(card))
    .sort(compareSnapshotCard);
}

function takeCandidates(
  candidates: readonly SnapshotCard[],
  selected: Map<string, SampleCard>,
  bucket: SampleBucket,
  targetCount: number,
): void {
  let added = 0;
  for (const card of candidates) {
    if (addSelected(selected, card, bucket)) {
      added += 1;
    }
    if (added >= targetCount) {
      break;
    }
  }
}

function addSelected(
  selected: Map<string, SampleCard>,
  card: SnapshotCard,
  bucket: SampleBucket,
): boolean {
  if (selected.has(card.oracleId)) {
    return false;
  }
  selected.set(card.oracleId, {
    oracleId: card.oracleId,
    name: card.name,
    oracleText: card.oracleText,
    bucket,
  });
  return true;
}

function resolveName(
  name: string,
  snapshotByName: ReadonlyMap<string, readonly SnapshotCard[]>,
): SnapshotCard | undefined {
  return snapshotByName.get(name)?.[0];
}

function mapByOracleId(cards: readonly SnapshotCard[]): Map<string, SnapshotCard> {
  const byOracleId = new Map<string, SnapshotCard>();
  for (const card of cards) {
    byOracleId.set(card.oracleId, card);
  }
  return byOracleId;
}

function mapByName(cards: readonly SnapshotCard[]): Map<string, SnapshotCard[]> {
  const byName = new Map<string, SnapshotCard[]>();
  for (const card of cards) {
    const group = byName.get(card.name) ?? [];
    group.push(card);
    byName.set(card.name, group);
  }
  for (const group of byName.values()) {
    group.sort((a, b) => a.oracleId.localeCompare(b.oracleId));
  }
  return byName;
}

function coerceCoverageReport(value: unknown): CoverageReport {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Coverage report must contain cards[].');
  }
  return {
    cards: value.cards.map(coerceCoverageCard),
  };
}

function coerceCoverageCard(value: unknown): CoverageCard {
  if (!isRecord(value)) {
    throw new Error('Invalid coverage card item.');
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name');
  const families = value.families;
  const observers = value.observers;
  const hasInterveningIf = value.hasInterveningIf;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(families) ||
    !families.every(isString) ||
    !Array.isArray(observers) ||
    !observers.every(isString) ||
    typeof hasInterveningIf !== 'boolean'
  ) {
    throw new Error('Invalid coverage card item.');
  }
  return {
    oracleId,
    name,
    families: uniqueSortedStrings(families),
    observers: uniqueSortedStrings(observers),
    hasInterveningIf,
  };
}

function hasAny(values: readonly string[], needles: readonly string[]): boolean {
  return needles.some((needle) => values.includes(needle));
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function compareSnapshotCard(a: SnapshotCard, b: SnapshotCard): number {
  const rankDiff = a.sortRank - b.sortRank;
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.oracleId.localeCompare(b.oracleId);
}

function rankValue(rank: number | undefined): number {
  return typeof rank === 'number' ? rank : Number.POSITIVE_INFINITY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
