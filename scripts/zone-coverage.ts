import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import { splitAbilityLines } from '../src/engine/grammar/index.ts';
import type { ZoneId } from '../src/engine/types.ts';
import type { CardDef } from '../src/types/card';
import {
  classifyCardZones,
  classifyZonesForLine,
  OWNERSHIP_KINDS,
  PLAYER_SCOPES,
  ZONE_IDS,
  type CardZoneSummary,
  type OwnershipKind,
  type PlayerScope,
} from './lib/zoneClassify.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/zone-coverage/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/zone-coverage/report.json');
const EXAMPLE_LIMIT = 15;
const MARKDOWN_CASE_LIMIT = 50;

interface MappingFailure {
  index: number;
  cardName: string;
  reason: string;
}

interface ExampleItem {
  name: string;
  edhrecRank?: number;
  matchedText: string;
}

interface RankedExampleItem extends ExampleItem {
  sortRank: number;
}

interface CountBucket {
  cardKeys: Set<string>;
  examples: RankedExampleItem[];
}

interface CountReportItem {
  cardCount: number;
  cardRate: number;
  examples: ExampleItem[];
}

type PerZoneReport = Record<ZoneId, CountReportItem>;
type PerOwnershipReport = Record<OwnershipKind, CountReportItem>;
type PerPlayerScopeReport = Record<PlayerScope, CountReportItem>;
type ZoneDeltaReport = Record<ZoneId, number>;

interface CardZoneItem extends CardZoneSummary {
  oracleId: string;
  name: string;
}

interface ChurnReport {
  baselineCardCount: number;
  comparedCardCount: number;
  changedCount: number;
  rate: number;
  byZone: ZoneDeltaReport;
}

interface ReportJson {
  generatedAt: string;
  totalCards: number;
  mappedCards: number;
  cardsWithZonesCount: number;
  cardsWithZonesRate: number;
  perZone: PerZoneReport;
  crossPlayerCardCount: number;
  crossPlayerRate: number;
  crossPlayerExamples: ExampleItem[];
  perOwnership: PerOwnershipReport;
  perPlayerScope: PerPlayerScopeReport;
  multiZoneCount: number;
  multiZoneRate: number;
  multiZoneExamples: ExampleItem[];
  mappingFailures: MappingFailure[];
  cards: CardZoneItem[];
  churn: ChurnReport | null;
}

interface ClassifiedLine {
  text: string;
  summary: CardZoneSummary;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const baselineCards = await readBaselineCards(REPORT_JSON_PATH);
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const zoneBuckets = createBuckets(ZONE_IDS);
  const ownershipBuckets = createBuckets(OWNERSHIP_KINDS);
  const playerScopeBuckets = createBuckets(PLAYER_SCOPES);
  const crossPlayerBucket = emptyBucket();
  const multiZoneBucket = emptyBucket();
  const mappingFailures: MappingFailure[] = [];
  const cards: CardZoneItem[] = [];

  let mappedCards = 0;
  let cardsWithZonesCount = 0;

  for (const [index, rawCard] of rawCards.entries()) {
    const fallbackName = readStringField(rawCard, 'name') ?? `(index ${index})`;
    const scryfallCard = coerceScryfallCard(rawCard);
    if (!scryfallCard) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: 'Invalid Scryfall card shape',
      });
      continue;
    }

    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(scryfallCard);
    } catch (error: unknown) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: errorMessage(error),
      });
      continue;
    }

    mappedCards += 1;
    const cardName = safeString(def.name, fallbackName);
    const cardKey = nonEmptyString(def.oracleId) ?? nonEmptyString(def.scryfallId) ?? cardName;
    const summary = classifyCardZones(def);
    const lines = classifyLines(def);
    const sortRank = rankValue(def.edhrecRank);
    cards.push({
      oracleId: cardKey,
      name: cardName,
      ...summary,
    });

    if (summary.zones.length > 0) {
      cardsWithZonesCount += 1;
    }

    addCardSummaryToBuckets(
      summary,
      lines,
      cardKey,
      cardName,
      def.edhrecRank,
      sortRank,
      zoneBuckets,
      ownershipBuckets,
      playerScopeBuckets,
      crossPlayerBucket,
      multiZoneBucket,
    );
  }

  const churn = buildChurnReport(baselineCards, cards);
  const reportJson: ReportJson = {
    generatedAt,
    totalCards: rawCards.length,
    mappedCards,
    cardsWithZonesCount,
    cardsWithZonesRate: rate(cardsWithZonesCount, mappedCards),
    perZone: buildCountReport(zoneBuckets, mappedCards),
    crossPlayerCardCount: crossPlayerBucket.cardKeys.size,
    crossPlayerRate: rate(crossPlayerBucket.cardKeys.size, mappedCards),
    crossPlayerExamples: rankedExamples(crossPlayerBucket.examples).slice(0, EXAMPLE_LIMIT),
    perOwnership: buildCountReport(ownershipBuckets, mappedCards),
    perPlayerScope: buildCountReport(playerScopeBuckets, mappedCards),
    multiZoneCount: multiZoneBucket.cardKeys.size,
    multiZoneRate: rate(multiZoneBucket.cardKeys.size, mappedCards),
    multiZoneExamples: rankedExamples(multiZoneBucket.examples).slice(0, EXAMPLE_LIMIT),
    mappingFailures,
    cards,
    churn,
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdownReport(reportJson), 'utf8');

  console.log(`Zone coverage report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `totalCards=${reportJson.totalCards} mappedCards=${reportJson.mappedCards} cardsWithZones=${reportJson.cardsWithZonesCount} crossPlayerCards=${reportJson.crossPlayerCardCount} multiZoneCards=${reportJson.multiZoneCount} mappingFailures=${reportJson.mappingFailures.length}`,
  );

  if (mappingFailures.length > 0) {
    throw new Error(`Zone coverage requires mappingFailures=0; found ${mappingFailures.length}.`);
  }
}

function classifyLines(def: CardDef): ClassifiedLine[] {
  return splitAbilityLines(def).map((line) => ({
    text: line.text,
    summary: classifyZonesForLine(line),
  }));
}

function addCardSummaryToBuckets(
  summary: CardZoneSummary,
  lines: readonly ClassifiedLine[],
  cardKey: string,
  cardName: string,
  edhrecRank: number | undefined,
  sortRank: number,
  zoneBuckets: Record<ZoneId, CountBucket>,
  ownershipBuckets: Record<OwnershipKind, CountBucket>,
  playerScopeBuckets: Record<PlayerScope, CountBucket>,
  crossPlayerBucket: CountBucket,
  multiZoneBucket: CountBucket,
): void {
  for (const zone of summary.zones) {
    addCardExample(
      zoneBuckets[zone],
      cardKey,
      cardName,
      edhrecRank,
      sortRank,
      findLine(lines, (line) => line.summary.zones.includes(zone)),
    );
  }

  addCardExample(
    ownershipBuckets[summary.ownership],
    cardKey,
    cardName,
    edhrecRank,
    sortRank,
    findOwnershipLine(lines, summary.ownership),
  );

  for (const scope of summary.playerScopes) {
    addCardExample(
      playerScopeBuckets[scope],
      cardKey,
      cardName,
      edhrecRank,
      sortRank,
      findLine(lines, (line) => line.summary.playerScopes.includes(scope)),
    );
  }

  if (summary.crossPlayer) {
    addCardExample(
      crossPlayerBucket,
      cardKey,
      cardName,
      edhrecRank,
      sortRank,
      findLine(lines, (line) => line.summary.crossPlayer),
    );
  }

  if (summary.zones.length >= 2) {
    addCardExample(
      multiZoneBucket,
      cardKey,
      cardName,
      edhrecRank,
      sortRank,
      findLine(lines, (line) => line.summary.zones.length >= 2),
    );
  }
}

function findOwnershipLine(
  lines: readonly ClassifiedLine[],
  ownership: OwnershipKind,
): ClassifiedLine | undefined {
  return (
    findLine(lines, (line) => line.summary.ownership === ownership) ??
    findLine(
      lines,
      (line) =>
        ownership === 'both' &&
        (line.summary.ownership === 'owner' || line.summary.ownership === 'controller'),
    ) ??
    lines[0]
  );
}

function findLine(
  lines: readonly ClassifiedLine[],
  predicate: (line: ClassifiedLine) => boolean,
): ClassifiedLine | undefined {
  return lines.find(predicate);
}

function addCardExample(
  bucket: CountBucket,
  cardKey: string,
  cardName: string,
  edhrecRank: number | undefined,
  sortRank: number,
  line: ClassifiedLine | undefined,
): void {
  bucket.cardKeys.add(cardKey);
  if (!line) {
    return;
  }
  bucket.examples.push({
    name: cardName,
    edhrecRank,
    matchedText: line.text,
    sortRank,
  });
}

async function readJson(path: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    throw new Error(`Input file not found or unreadable: ${path}\n${errorMessage(error)}`, {
      cause: error,
    });
  }
  return JSON.parse(source) as unknown;
}

async function readBaselineCards(path: string): Promise<CardZoneItem[] | null> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (hasErrorCode(error, 'ENOENT')) {
      return null;
    }
    throw new Error(`Baseline report not readable: ${path}\n${errorMessage(error)}`, {
      cause: error,
    });
  }

  const payload = JSON.parse(source) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.cards)) {
    return null;
  }

  const cards: CardZoneItem[] = [];
  for (const item of payload.cards) {
    const card = coerceCardZoneItem(item);
    if (!card) {
      return null;
    }
    cards.push(card);
  }
  return cards;
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

function coerceScryfallCard(value: unknown): ScryfallCard | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value as unknown as ScryfallCard;
}

function coerceCardZoneItem(value: unknown): CardZoneItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name') ?? oracleId;
  const zones = value.zones;
  const crossPlayer = value.crossPlayer;
  const ownership = value.ownership;
  const playerScopes = value.playerScopes;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(zones) ||
    typeof crossPlayer !== 'boolean' ||
    !isOwnershipKind(ownership) ||
    !Array.isArray(playerScopes) ||
    !zones.every(isZoneId) ||
    !playerScopes.every(isPlayerScope)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    zones: sortStrings(zones),
    crossPlayer,
    ownership,
    playerScopes: sortStrings(playerScopes),
  };
}

function emptyBucket(): CountBucket {
  return {
    cardKeys: new Set<string>(),
    examples: [],
  };
}

function createBuckets<Key extends string>(keys: readonly Key[]): Record<Key, CountBucket> {
  const buckets = {} as Record<Key, CountBucket>;
  for (const key of keys) {
    buckets[key] = emptyBucket();
  }
  return buckets;
}

function buildCountReport<Key extends string>(
  buckets: Record<Key, CountBucket>,
  mappedCards: number,
): Record<Key, CountReportItem> {
  const report = {} as Record<Key, CountReportItem>;
  for (const key of Object.keys(buckets) as Key[]) {
    const bucket = buckets[key];
    report[key] = {
      cardCount: bucket.cardKeys.size,
      cardRate: rate(bucket.cardKeys.size, mappedCards),
      examples: rankedExamples(bucket.examples).slice(0, EXAMPLE_LIMIT),
    };
  }
  return report;
}

function buildChurnReport(
  baselineCards: readonly CardZoneItem[] | null,
  currentCards: readonly CardZoneItem[],
): ChurnReport | null {
  if (!baselineCards) {
    return null;
  }

  const baselineByOracleId = new Map<string, CardZoneItem>();
  for (const card of baselineCards) {
    baselineByOracleId.set(card.oracleId, card);
  }

  const byZone = createZoneDeltaReport();
  let comparedCardCount = 0;
  let changedCount = 0;

  for (const current of currentCards) {
    const baseline = baselineByOracleId.get(current.oracleId);
    if (!baseline) {
      continue;
    }
    comparedCardCount += 1;
    if (cardZoneSignature(baseline) !== cardZoneSignature(current)) {
      changedCount += 1;
    }
    addZoneDelta(byZone, baseline.zones, current.zones);
  }

  return {
    baselineCardCount: baselineByOracleId.size,
    comparedCardCount,
    changedCount,
    rate: rate(changedCount, comparedCardCount),
    byZone,
  };
}

function createZoneDeltaReport(): ZoneDeltaReport {
  const byZone = {} as ZoneDeltaReport;
  for (const zone of ZONE_IDS) {
    byZone[zone] = 0;
  }
  return byZone;
}

function addZoneDelta(
  byZone: ZoneDeltaReport,
  baselineZones: readonly ZoneId[],
  currentZones: readonly ZoneId[],
): void {
  const baselineSet = new Set(baselineZones);
  const currentSet = new Set(currentZones);
  for (const zone of ZONE_IDS) {
    if (!baselineSet.has(zone) && currentSet.has(zone)) {
      byZone[zone] += 1;
    } else if (baselineSet.has(zone) && !currentSet.has(zone)) {
      byZone[zone] -= 1;
    }
  }
}

function cardZoneSignature(card: CardZoneItem): string {
  return [
    sortStrings(card.zones).join(','),
    String(card.crossPlayer),
    card.ownership,
    sortStrings(card.playerScopes).join(','),
  ].join('|');
}

function rankedExamples(examples: readonly RankedExampleItem[]): ExampleItem[] {
  const seen = new Set<string>();
  return [...examples]
    .sort(compareRankedExample)
    .filter((item) => {
      const key = `${item.name}\n${item.matchedText}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map(({ name, edhrecRank, matchedText }) => ({ name, edhrecRank, matchedText }));
}

function compareRankedExample(a: RankedExampleItem, b: RankedExampleItem): number {
  const rankDiff = a.sortRank - b.sortRank;
  if (rankDiff !== 0) {
    return rankDiff;
  }
  const nameDiff = compareStrings(a.name, b.name);
  if (nameDiff !== 0) {
    return nameDiff;
  }
  return compareStrings(a.matchedText, b.matchedText);
}

function renderMarkdownReport(report: ReportJson): string {
  const lines: string[] = [
    '# Zone Coverage Report',
    '',
    'Measurement-only extraction for zone access, cross-player zone access, ownership language, and player scopes.',
    '',
    '## Summary',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Input: ${relative(process.cwd(), INPUT_PATH)}`,
    `- totalCards: ${report.totalCards}`,
    `- mappedCards: ${report.mappedCards}`,
    `- cards with zones: ${report.cardsWithZonesCount} (${percent(report.cardsWithZonesRate)})`,
    `- cross-player cards: ${report.crossPlayerCardCount} (${percent(report.crossPlayerRate)})`,
    `- multi-zone cards: ${report.multiZoneCount} (${percent(report.multiZoneRate)})`,
    `- churn: ${churnSummary(report.churn)}`,
    `- mapping failures: ${report.mappingFailures.length}`,
    '',
    '## Zone Demand',
    '',
    '| zone | card count | card rate | examples |',
    '|---|---:|---:|---|',
    ...ZONE_IDS.map((zone) => {
      const item = report.perZone[zone];
      return `| ${zone} | ${item.cardCount} | ${percent(item.cardRate)} | ${cell(exampleSummary(item.examples))} |`;
    }),
    '',
    '## Cross-player Zone Access',
    '',
    `- ${report.crossPlayerCardCount} cards (${percent(report.crossPlayerRate)})`,
    '',
    ...renderExampleList(report.crossPlayerExamples),
    '',
    '## Ownership Distribution',
    '',
    '| ownership | card count | card rate | examples |',
    '|---|---:|---:|---|',
    ...OWNERSHIP_KINDS.map((ownership) => {
      const item = report.perOwnership[ownership];
      return `| ${ownership} | ${item.cardCount} | ${percent(item.cardRate)} | ${cell(exampleSummary(item.examples))} |`;
    }),
    '',
    '## Player Scope Distribution',
    '',
    '| player scope | card count | card rate | examples |',
    '|---|---:|---:|---|',
    ...PLAYER_SCOPES.map((scope) => {
      const item = report.perPlayerScope[scope];
      return `| ${scope} | ${item.cardCount} | ${percent(item.cardRate)} | ${cell(exampleSummary(item.examples))} |`;
    }),
    '',
    '## Zone Examples',
    '',
    ...renderBucketExamples(ZONE_IDS, report.perZone),
    '',
    '## Ownership Examples',
    '',
    ...renderBucketExamples(OWNERSHIP_KINDS, report.perOwnership),
    '',
    '## Player Scope Examples',
    '',
    ...renderBucketExamples(PLAYER_SCOPES, report.perPlayerScope),
    '',
    '## Multi-zone Examples',
    '',
    ...renderExampleList(report.multiZoneExamples),
    '',
    '## Mapping Failures',
    '',
    ...renderMappingFailures(report.mappingFailures),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderBucketExamples<Key extends string>(
  keys: readonly Key[],
  report: Record<Key, CountReportItem>,
): string[] {
  const lines: string[] = [];
  for (const key of keys) {
    lines.push(`### ${key}`, '', ...renderExampleList(report[key].examples), '');
  }
  return lines;
}

function renderExampleList(examples: readonly ExampleItem[]): string[] {
  if (examples.length === 0) {
    return ['- none'];
  }
  return examples.map(
    (example) =>
      `- ${cell(rankLabel(example.edhrecRank))} 《${cell(example.name)}》: ${cell(snippet(example.matchedText, 180))}`,
  );
}

function renderMappingFailures(failures: readonly MappingFailure[]): string[] {
  if (failures.length === 0) {
    return ['- none'];
  }
  return failures
    .slice(0, MARKDOWN_CASE_LIMIT)
    .map((item) => `- #${item.index} 《${cell(item.cardName)}》: ${cell(item.reason)}`);
}

function exampleSummary(examples: readonly ExampleItem[]): string {
  if (examples.length === 0) {
    return '-';
  }
  return examples
    .slice(0, 5)
    .map((example) => `${example.name} (${rankLabel(example.edhrecRank)})`)
    .join('; ');
}

function churnSummary(churn: ChurnReport | null): string {
  if (!churn) {
    return 'n/a (no prior cards baseline)';
  }
  return `${churn.changedCount}/${churn.comparedCardCount} changed (${percent(churn.rate)}), baselineCards=${churn.baselineCardCount}, byZone=${zoneDeltaSummary(churn.byZone)}`;
}

function zoneDeltaSummary(byZone: ZoneDeltaReport): string {
  const deltas = ZONE_IDS.filter((zone) => byZone[zone] !== 0).map(
    (zone) => `${zone} ${signedCount(byZone[zone])}`,
  );
  return deltas.length > 0 ? deltas.join(', ') : 'none';
}

function signedCount(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function rankLabel(rank: number | undefined): string {
  return typeof rank === 'number' ? `rank ${rank}` : 'unranked';
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function snippet(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function rankValue(rank: number | undefined): number {
  return typeof rank === 'number' ? rank : Number.POSITIVE_INFINITY;
}

function sortStrings<T extends string>(values: readonly T[]): T[] {
  return [...values].sort(compareStrings);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && ZONE_IDS.includes(value as ZoneId);
}

function isOwnershipKind(value: unknown): value is OwnershipKind {
  return typeof value === 'string' && OWNERSHIP_KINDS.includes(value as OwnershipKind);
}

function isPlayerScope(value: unknown): value is PlayerScope {
  return typeof value === 'string' && PLAYER_SCOPES.includes(value as PlayerScope);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
