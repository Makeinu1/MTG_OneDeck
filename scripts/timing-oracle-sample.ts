import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';
import type { ObserverScope } from './lib/eventClassify.ts';
import type { CastTiming, TimingStep } from './lib/timingClassify.ts';

const COVERAGE_REPORT_PATH = resolve(
  process.cwd(),
  'research/timing-coverage/report.json',
);
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OUTPUT_PATH = resolve(process.cwd(), 'research/timing-oracle/sample.json');
const GENERATED_AT = '2026-06-25T00:00:00.000Z';

const GOLD_NAMES = [
  'Phyrexian Arena',
  'Bitterblossom',
  'Court of Grace',
  'Sulfuric Vortex',
  'Goblin Rabblemaster',
  'Wilderness Reclamation',
  'Seedborn Muse',
  'Dictate of Kruphix',
  'Sword of Feast and Famine',
  'Aggravated Assault',
  'Seedtime',
  'Leyline of Anticipation',
  'Sol Ring',
  'Llanowar Elves',
  'Approach of the Second Sun',
  'Grizzly Bears',
] as const;

const RARE_STEPS: readonly TimingStep[] = [
  'draw',
  'untap',
  'begin-combat',
  'declare-attackers',
  'declare-blockers',
  'end-combat',
  'cleanup',
  'main-precombat',
  'main-postcombat',
  'turn',
  'other',
];

const GOLD_FALLBACKS: readonly SnapshotCard[] = [
  {
    oracleId: 'gold-fallback:grizzly-bears',
    name: 'Grizzly Bears',
    oracleText: '',
    sortRank: Number.POSITIVE_INFINITY,
  },
];

type SampleBucket = 'gold' | 'head' | 'cast' | 'scope' | 'tail';

interface CoverageReport {
  cards: CoverageCard[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface SnapshotCard {
  oracleId: string;
  name: string;
  oracleText: string;
  sortRank: number;
}

interface JoinedCard extends SnapshotCard, CoverageCard {}

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
  const coverage = coerceCoverageReport(await readJson(COVERAGE_REPORT_PATH));
  const snapshot = readSnapshotCards(await readJson(SNAPSHOT_PATH));
  const snapshotById = new Map(snapshot.map((card) => [card.oracleId, card] as const));
  const snapshotByName = groupByName(snapshot);
  const joined = coverage.cards
    .map((card) => {
      const source = snapshotById.get(card.oracleId);
      return source ? ({ ...source, ...card } satisfies JoinedCard) : undefined;
    })
    .filter((card): card is JoinedCard => Boolean(card))
    .sort(compareSnapshotCard);

  const selected = new Map<string, SampleCard>();
  const missingGold: string[] = [];
  for (const name of GOLD_NAMES) {
    const card = resolveName(name, snapshotByName);
    if (!card) {
      missingGold.push(name);
    } else {
      addSelected(selected, card, 'gold');
    }
  }
  if (missingGold.length > 0) {
    throw new Error(`Gold cards not found in snapshot: ${missingGold.join(', ')}`);
  }

  takeCandidates(
    joined.filter((card) => card.junctures.length > 0),
    selected,
    'head',
    90,
  );
  takeCandidates(
    joined.filter(
      (card) => card.castTiming.some((timing) => timing !== 'none'),
    ),
    selected,
    'cast',
    40,
  );
  takeCandidates(
    joined.filter(
      (card) =>
        card.junctureScope.includes('opponent') ||
        card.junctureScope.includes('any'),
    ),
    selected,
    'scope',
    30,
  );
  takeCandidates(
    joined.filter((card) =>
      card.junctures.some((step) => RARE_STEPS.includes(step)),
    ),
    selected,
    'tail',
    20,
  );

  const sample: SampleJson = {
    generatedAt: GENERATED_AT,
    seedRule: 'edhrec_rank asc, oracleId asc',
    buckets: {
      gold: GOLD_NAMES.length,
      head: 90,
      cast: 40,
      scope: 30,
      tail: 20,
    },
    cards: [...selected.values()],
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  console.log(`Timing oracle sample written: ${relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`cards=${sample.cards.length} gold=${GOLD_NAMES.length}`);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function coerceCoverageReport(value: unknown): CoverageReport {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Timing coverage report must contain cards[].');
  }
  const cards = value.cards.map(coerceCoverageCard);
  if (!cards.every((card): card is CoverageCard => Boolean(card))) {
    throw new Error('Timing coverage report contains an invalid card.');
  }
  return { cards };
}

function coerceCoverageCard(value: unknown): CoverageCard | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readString(value.oracleId);
  const name = readString(value.name);
  if (
    !oracleId ||
    !name ||
    !Array.isArray(value.junctures) ||
    !Array.isArray(value.junctureScope) ||
    !Array.isArray(value.castTiming)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    junctures: value.junctures as TimingStep[],
    junctureScope: value.junctureScope as ObserverScope[],
    castTiming: value.castTiming as CastTiming[],
  };
}

function readSnapshotCards(payload: unknown): SnapshotCard[] {
  const cards: SnapshotCard[] = [];
  for (const rawCard of extractRawCards(payload)) {
    if (!isRecord(rawCard)) {
      continue;
    }
    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(rawCard as unknown as ScryfallCard);
    } catch {
      continue;
    }
    const oracleId = readString(def.oracleId) ?? readString(def.scryfallId);
    const name = readString(def.name);
    if (!oracleId || !name) {
      continue;
    }
    cards.push({
      oracleId,
      name,
      oracleText: oracleTextForCard(def),
      sortRank:
        typeof def.edhrecRank === 'number'
          ? def.edhrecRank
          : Number.POSITIVE_INFINITY,
    });
  }
  const names = new Set(cards.map((card) => card.name));
  return [
    ...cards,
    ...GOLD_FALLBACKS.filter((fallback) => !names.has(fallback.name)),
  ].sort(compareSnapshotCard);
}

function extractRawCards(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (isRecord(payload) && Array.isArray(payload.cards)) {
    return payload.cards;
  }
  throw new Error('Snapshot must be an array or contain data[]/cards[].');
}

function oracleTextForCard(def: CardDef): string {
  return def.faces
    .map((face) => (typeof face.oracleText === 'string' ? face.oracleText : ''))
    .filter(Boolean)
    .join('\n//\n');
}

function groupByName(
  cards: readonly SnapshotCard[],
): ReadonlyMap<string, SnapshotCard[]> {
  const grouped = new Map<string, SnapshotCard[]>();
  for (const card of cards) {
    const items = grouped.get(card.name) ?? [];
    items.push(card);
    grouped.set(card.name, items);
  }
  return grouped;
}

function resolveName(
  name: string,
  grouped: ReadonlyMap<string, SnapshotCard[]>,
): SnapshotCard | undefined {
  return grouped.get(name)?.[0];
}

function takeCandidates(
  candidates: readonly SnapshotCard[],
  selected: Map<string, SampleCard>,
  bucket: SampleBucket,
  count: number,
): void {
  let added = 0;
  for (const card of candidates) {
    if (addSelected(selected, card, bucket)) {
      added += 1;
    }
    if (added === count) {
      return;
    }
  }
  throw new Error(`Insufficient ${bucket} candidates: ${added}/${count}`);
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

function compareSnapshotCard(a: SnapshotCard, b: SnapshotCard): number {
  return a.sortRank - b.sortRank || compareStrings(a.oracleId, b.oracleId);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
