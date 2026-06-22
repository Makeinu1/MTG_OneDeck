import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';
import type { LayerId } from './lib/layerClassify.ts';

const COVERAGE_REPORT_PATH = resolve(process.cwd(), 'research/layer-coverage/report.json');
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OUTPUT_PATH = resolve(process.cwd(), 'research/llm-oracle/sample.json');
const GENERATED_AT = '2026-06-19T00:00:00.000Z';

const LAYER_ORDER: readonly LayerId[] = [
  'L1a',
  'L1b',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7a',
  'L7b',
  'L7c',
  'L7d',
];

const GOLD_NAMES = [
  "Gaea's Anthem",
  'Control Magic',
  'Blood Moon',
  'Archetype of Imagination',
  'Giant Growth',
  'Tarmogoyf',
  'Darksteel Mutation',
  'Lignify',
  'Song of the Dryads',
  'Lightning Bolt',
  'Llanowar Elves',
  'Chromatic Lantern',
  'Cryptolith Rite',
  'Purphoros, God of the Forge',
  'Heliod, Sun-Crowned',
  'Unnatural Growth',
  'Alloy Animist',
  'Cyberdrive Awakener',
] as const;

type SampleBucket = 'head' | 'multi' | 'adjudication' | 'gold';

interface CoverageReport {
  cards: CoverageCard[];
  adjudication: AdjudicationItem[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  layers: LayerId[];
  cda: boolean;
}

interface AdjudicationItem {
  name: string;
  line: string;
  reason: string;
}

interface SnapshotCard {
  oracleId: string;
  name: string;
  oracleText: string;
  edhrecRank?: number;
  sortRank: number;
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
      report.cards.filter((card) => card.layers.length > 0),
      snapshotByOracleId,
    ),
    selected,
    'head',
    100,
  );

  takeCandidates(
    rankedCoverageCards(
      report.cards.filter((card) => card.layers.length >= 2),
      snapshotByOracleId,
    ),
    selected,
    'multi',
    50,
  );

  takeCandidates(resolveAdjudicationCards(report.adjudication, snapshotByName), selected, 'adjudication', 30);

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
      head: 100,
      multi: 50,
      adjudication: 30,
      gold: GOLD_NAMES.length,
    },
    cards: [...selected.values()],
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  console.log(`Oracle sample written: ${relative(process.cwd(), OUTPUT_PATH)}`);
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
): SnapshotCard[] {
  return cards
    .map((card) => snapshotByOracleId.get(card.oracleId))
    .filter((card): card is SnapshotCard => Boolean(card))
    .sort(compareSnapshotCard);
}

function resolveAdjudicationCards(
  adjudication: readonly AdjudicationItem[],
  snapshotByName: ReadonlyMap<string, readonly SnapshotCard[]>,
): SnapshotCard[] {
  const seen = new Set<string>();
  const cards: SnapshotCard[] = [];
  for (const item of adjudication) {
    const card = resolveName(item.name, snapshotByName);
    if (!card || seen.has(card.oracleId)) {
      continue;
    }
    seen.add(card.oracleId);
    cards.push(card);
  }
  return cards;
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
  if (!isRecord(value) || !Array.isArray(value.cards) || !Array.isArray(value.adjudication)) {
    throw new Error('Coverage report must contain cards[] and adjudication[].');
  }
  return {
    cards: value.cards.map(coerceCoverageCard),
    adjudication: value.adjudication.map(coerceAdjudicationItem),
  };
}

function coerceCoverageCard(value: unknown): CoverageCard {
  if (!isRecord(value)) {
    throw new Error('Invalid coverage card item.');
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name');
  const layers = value.layers;
  const cda = value.cda;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(layers) ||
    !layers.every(isLayerId) ||
    typeof cda !== 'boolean'
  ) {
    throw new Error('Invalid coverage card item.');
  }
  return { oracleId, name, layers: sortLayerIds(layers), cda };
}

function coerceAdjudicationItem(value: unknown): AdjudicationItem {
  if (!isRecord(value)) {
    throw new Error('Invalid adjudication item.');
  }
  const name = readStringField(value, 'name');
  const line = readStringField(value, 'line');
  const reason = readStringField(value, 'reason');
  if (!name || !line || !reason) {
    throw new Error('Invalid adjudication item.');
  }
  return { name, line, reason };
}

function compareSnapshotCard(a: SnapshotCard, b: SnapshotCard): number {
  const rankDiff = a.sortRank - b.sortRank;
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.oracleId.localeCompare(b.oracleId);
}

function sortLayerIds(layers: readonly LayerId[]): LayerId[] {
  return [...new Set(layers)].sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
}

function isLayerId(value: unknown): value is LayerId {
  return typeof value === 'string' && LAYER_ORDER.includes(value as LayerId);
}

function rankValue(rank: number | undefined): number {
  return typeof rank === 'number' ? rank : Number.POSITIVE_INFINITY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
