import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { splitAbilityLines } from '../src/engine/grammar/index.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';
import {
  classifyCardEvents,
  classifyEventsForLine,
  EVENT_FAMILIES,
  type CardEventSummary,
  type EventFamily,
  type EventTag,
  type ObserverScope,
  type TriggerShape,
} from './lib/eventClassify.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/event-coverage/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/event-coverage/report.json');
const EXAMPLE_LIMIT = 15;
const MARKDOWN_CASE_LIMIT = 50;

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'any',
  'controlled-set',
  'opponent',
  'self',
  'unknown',
];

const TRIGGER_SHAPES: readonly TriggerShape[] = ['at', 'when', 'whenever'];

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
  lineKeys: Set<string>;
}

interface FamilyBucket extends CountBucket {
  examples: RankedExampleItem[];
}

interface FamilyReportItem {
  cardCount: number;
  lineCount: number;
  triggerLineRate: number;
  examples: ExampleItem[];
}

interface CountReportItem {
  cardCount: number;
  lineCount: number;
}

type PerFamilyReport = Record<EventFamily, FamilyReportItem>;
type PerObserverReport = Record<ObserverScope, CountReportItem>;
type PerTriggerShapeReport = Record<TriggerShape, CountReportItem>;
type FamilyDeltaReport = Record<EventFamily, number>;

interface MultiFamilyCandidate {
  name: string;
  families: EventFamily[];
  sortRank: number;
}

interface MultiFamilyItem {
  name: string;
  families: EventFamily[];
}

interface CardEventItem extends CardEventSummary {
  oracleId: string;
  name: string;
}

interface ChurnReport {
  baselineCardCount: number;
  comparedCardCount: number;
  changedCount: number;
  rate: number;
  byFamily: FamilyDeltaReport;
}

interface ReportJson {
  generatedAt: string;
  totalCards: number;
  mappedCards: number;
  triggerLineCount: number;
  perFamily: PerFamilyReport;
  perObserver: PerObserverReport;
  perTriggerShape: PerTriggerShapeReport;
  interveningIfCardCount: number;
  interveningIfCardRate: number;
  multiFamilyCount: number;
  multiFamily: MultiFamilyItem[];
  mappingFailures: MappingFailure[];
  cards: CardEventItem[];
  churn: ChurnReport | null;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const baselineCards = await readBaselineCards(REPORT_JSON_PATH);
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const familyBuckets = createFamilyBuckets();
  const observerBuckets = createObserverBuckets();
  const triggerShapeBuckets = createTriggerShapeBuckets();
  const triggerLineKeys = new Set<string>();
  const mappingFailures: MappingFailure[] = [];
  const multiFamilyCandidates: MultiFamilyCandidate[] = [];
  const cards: CardEventItem[] = [];

  let mappedCards = 0;
  let interveningIfCardCount = 0;

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
    const sortRank = rankValue(def.edhrecRank);
    const summary = classifyCardEvents(def);
    cards.push({
      oracleId: cardKey,
      name: cardName,
      ...summary,
    });

    if (summary.hasInterveningIf) {
      interveningIfCardCount += 1;
    }
    if (summary.families.length >= 2) {
      multiFamilyCandidates.push({ name: cardName, families: summary.families, sortRank });
    }

    for (const [lineIndex, line] of splitAbilityLines(def).entries()) {
      const tags = classifyEventsForLine(line, def);
      if (tags.length === 0) {
        continue;
      }

      const lineKey = `${cardKey}:${line.faceIndex}:${lineIndex}`;
      triggerLineKeys.add(lineKey);
      addLineToFamilyBuckets(familyBuckets, tags, cardKey, lineKey, cardName, def.edhrecRank);
      addLineToObserverBuckets(observerBuckets, tags, cardKey, lineKey);
      addLineToTriggerShapeBuckets(triggerShapeBuckets, tags, cardKey, lineKey);
    }
  }

  const churn = buildChurnReport(baselineCards, cards);
  const reportJson: ReportJson = {
    generatedAt,
    totalCards: rawCards.length,
    mappedCards,
    triggerLineCount: triggerLineKeys.size,
    perFamily: buildPerFamilyReport(familyBuckets, triggerLineKeys.size),
    perObserver: buildPerObserverReport(observerBuckets),
    perTriggerShape: buildPerTriggerShapeReport(triggerShapeBuckets),
    interveningIfCardCount,
    interveningIfCardRate: rate(interveningIfCardCount, mappedCards),
    multiFamilyCount: multiFamilyCandidates.length,
    multiFamily: rankMultiFamily(multiFamilyCandidates),
    mappingFailures,
    cards,
    churn,
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdownReport(reportJson), 'utf8');

  console.log(`Event coverage report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `totalCards=${reportJson.totalCards} mappedCards=${reportJson.mappedCards} triggerLines=${reportJson.triggerLineCount} interveningIfCards=${reportJson.interveningIfCardCount} mappingFailures=${reportJson.mappingFailures.length}`,
  );
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

async function readBaselineCards(path: string): Promise<CardEventItem[] | null> {
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

  const cards: CardEventItem[] = [];
  for (const item of payload.cards) {
    const card = coerceCardEventItem(item);
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

function coerceCardEventItem(value: unknown): CardEventItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name') ?? oracleId;
  const families = value.families;
  const observers = value.observers;
  const triggerShapes = value.triggerShapes;
  const hasInterveningIf = value.hasInterveningIf;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(families) ||
    !Array.isArray(observers) ||
    !Array.isArray(triggerShapes) ||
    typeof hasInterveningIf !== 'boolean' ||
    !families.every(isEventFamily) ||
    !observers.every(isObserverScope) ||
    !triggerShapes.every(isTriggerShape)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    families: sortStrings(families),
    observers: sortStrings(observers),
    triggerShapes: sortStrings(triggerShapes),
    hasInterveningIf,
  };
}

function createFamilyBuckets(): Record<EventFamily, FamilyBucket> {
  const buckets = {} as Record<EventFamily, FamilyBucket>;
  for (const family of EVENT_FAMILIES) {
    buckets[family] = {
      cardKeys: new Set<string>(),
      lineKeys: new Set<string>(),
      examples: [],
    };
  }
  return buckets;
}

function createObserverBuckets(): Record<ObserverScope, CountBucket> {
  const buckets = {} as Record<ObserverScope, CountBucket>;
  for (const observer of OBSERVER_SCOPES) {
    buckets[observer] = {
      cardKeys: new Set<string>(),
      lineKeys: new Set<string>(),
    };
  }
  return buckets;
}

function createTriggerShapeBuckets(): Record<TriggerShape, CountBucket> {
  const buckets = {} as Record<TriggerShape, CountBucket>;
  for (const shape of TRIGGER_SHAPES) {
    buckets[shape] = {
      cardKeys: new Set<string>(),
      lineKeys: new Set<string>(),
    };
  }
  return buckets;
}

function addLineToFamilyBuckets(
  buckets: Record<EventFamily, FamilyBucket>,
  tags: readonly EventTag[],
  cardKey: string,
  lineKey: string,
  cardName: string,
  edhrecRank: number | undefined,
): void {
  for (const tag of tags) {
    const bucket = buckets[tag.family];
    bucket.cardKeys.add(cardKey);
    bucket.lineKeys.add(lineKey);
    bucket.examples.push({
      name: cardName,
      edhrecRank,
      matchedText: tag.matchedText,
      sortRank: rankValue(edhrecRank),
    });
  }
}

function addLineToObserverBuckets(
  buckets: Record<ObserverScope, CountBucket>,
  tags: readonly EventTag[],
  cardKey: string,
  lineKey: string,
): void {
  const observers = new Set(tags.map((tag) => tag.observer));
  for (const observer of observers) {
    const bucket = buckets[observer];
    bucket.cardKeys.add(cardKey);
    bucket.lineKeys.add(lineKey);
  }
}

function addLineToTriggerShapeBuckets(
  buckets: Record<TriggerShape, CountBucket>,
  tags: readonly EventTag[],
  cardKey: string,
  lineKey: string,
): void {
  const shapes = new Set(tags.map((tag) => tag.shape));
  for (const shape of shapes) {
    const bucket = buckets[shape];
    bucket.cardKeys.add(cardKey);
    bucket.lineKeys.add(lineKey);
  }
}

function buildPerFamilyReport(
  buckets: Record<EventFamily, FamilyBucket>,
  triggerLineCount: number,
): PerFamilyReport {
  const perFamily = {} as PerFamilyReport;
  for (const family of EVENT_FAMILIES) {
    const bucket = buckets[family];
    perFamily[family] = {
      cardCount: bucket.cardKeys.size,
      lineCount: bucket.lineKeys.size,
      triggerLineRate: rate(bucket.lineKeys.size, triggerLineCount),
      examples: rankedExamples(bucket.examples).slice(0, EXAMPLE_LIMIT),
    };
  }
  return perFamily;
}

function buildPerObserverReport(
  buckets: Record<ObserverScope, CountBucket>,
): PerObserverReport {
  const perObserver = {} as PerObserverReport;
  for (const observer of OBSERVER_SCOPES) {
    const bucket = buckets[observer];
    perObserver[observer] = {
      cardCount: bucket.cardKeys.size,
      lineCount: bucket.lineKeys.size,
    };
  }
  return perObserver;
}

function buildPerTriggerShapeReport(
  buckets: Record<TriggerShape, CountBucket>,
): PerTriggerShapeReport {
  const perTriggerShape = {} as PerTriggerShapeReport;
  for (const shape of TRIGGER_SHAPES) {
    const bucket = buckets[shape];
    perTriggerShape[shape] = {
      cardCount: bucket.cardKeys.size,
      lineCount: bucket.lineKeys.size,
    };
  }
  return perTriggerShape;
}

function buildChurnReport(
  baselineCards: readonly CardEventItem[] | null,
  currentCards: readonly CardEventItem[],
): ChurnReport | null {
  if (!baselineCards) {
    return null;
  }

  const baselineByOracleId = new Map<string, CardEventItem>();
  for (const card of baselineCards) {
    baselineByOracleId.set(card.oracleId, card);
  }

  const byFamily = createFamilyDeltaReport();
  let comparedCardCount = 0;
  let changedCount = 0;

  for (const current of currentCards) {
    const baseline = baselineByOracleId.get(current.oracleId);
    if (!baseline) {
      continue;
    }

    comparedCardCount += 1;
    if (cardEventSignature(baseline) !== cardEventSignature(current)) {
      changedCount += 1;
    }
    addFamilyDelta(byFamily, baseline.families, current.families);
  }

  return {
    baselineCardCount: baselineByOracleId.size,
    comparedCardCount,
    changedCount,
    rate: rate(changedCount, comparedCardCount),
    byFamily,
  };
}

function createFamilyDeltaReport(): FamilyDeltaReport {
  const byFamily = {} as FamilyDeltaReport;
  for (const family of EVENT_FAMILIES) {
    byFamily[family] = 0;
  }
  return byFamily;
}

function addFamilyDelta(
  byFamily: FamilyDeltaReport,
  baselineFamilies: readonly EventFamily[],
  currentFamilies: readonly EventFamily[],
): void {
  const baselineSet = new Set(baselineFamilies);
  const currentSet = new Set(currentFamilies);
  for (const family of EVENT_FAMILIES) {
    if (!baselineSet.has(family) && currentSet.has(family)) {
      byFamily[family] += 1;
    } else if (baselineSet.has(family) && !currentSet.has(family)) {
      byFamily[family] -= 1;
    }
  }
}

function cardEventSignature(card: CardEventItem): string {
  return [
    `families=${sortStrings(card.families).join(',')}`,
    `observers=${sortStrings(card.observers).join(',')}`,
    `shapes=${sortStrings(card.triggerShapes).join(',')}`,
    `iif=${card.hasInterveningIf ? '1' : '0'}`,
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
  const nameDiff = a.name.localeCompare(b.name);
  if (nameDiff !== 0) {
    return nameDiff;
  }
  return a.matchedText.localeCompare(b.matchedText);
}

function rankMultiFamily(candidates: readonly MultiFamilyCandidate[]): MultiFamilyItem[] {
  return [...candidates]
    .sort((a, b) => {
      const rankDiff = a.sortRank - b.sortRank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.name.localeCompare(b.name);
    })
    .map(({ name, families }) => ({ name, families }));
}

function renderMarkdownReport(report: ReportJson): string {
  const lines: string[] = [
    '# Event Coverage Report',
    '',
    'Measurement-only extraction for trigger event families, observer scopes, and intervening-if conditions.',
    '',
    '## Summary',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Input: ${relative(process.cwd(), INPUT_PATH)}`,
    `- totalCards: ${report.totalCards}`,
    `- mappedCards: ${report.mappedCards}`,
    `- trigger lines: ${report.triggerLineCount}`,
    `- interveningIfCardCount: ${report.interveningIfCardCount} (${percent(report.interveningIfCardRate)})`,
    `- multiFamily cards: ${report.multiFamilyCount}`,
    `- churn: ${churnSummary(report.churn)}`,
    `- mapping failures: ${report.mappingFailures.length}`,
    '',
    '## Per Family',
    '',
    '| family | card count | line count | trigger line rate | examples |',
    '|---|---:|---:|---:|---|',
    ...EVENT_FAMILIES.map((family) => {
      const item = report.perFamily[family];
      return `| ${family} | ${item.cardCount} | ${item.lineCount} | ${percent(item.triggerLineRate)} | ${cell(exampleSummary(item.examples))} |`;
    }),
    '',
    '## Observer Distribution',
    '',
    '| observer | card count | line count |',
    '|---|---:|---:|',
    ...OBSERVER_SCOPES.map((observer) => {
      const item = report.perObserver[observer];
      return `| ${observer} | ${item.cardCount} | ${item.lineCount} |`;
    }),
    '',
    '## Trigger Shape Distribution',
    '',
    '| shape | card count | line count |',
    '|---|---:|---:|',
    ...TRIGGER_SHAPES.map((shape) => {
      const item = report.perTriggerShape[shape];
      return `| ${shape} | ${item.cardCount} | ${item.lineCount} |`;
    }),
    '',
    '## Examples',
    '',
    ...renderExamples(report.perFamily),
    '',
    '## Multi Family Cards',
    '',
    ...renderMultiFamily(report.multiFamily),
    '',
    '## Mapping Failures',
    '',
    ...renderMappingFailures(report.mappingFailures),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderExamples(perFamily: PerFamilyReport): string[] {
  const lines: string[] = [];
  for (const family of EVENT_FAMILIES) {
    lines.push(`### ${family}`, '');
    const examples = perFamily[family].examples;
    if (examples.length === 0) {
      lines.push('- none', '');
      continue;
    }
    for (const example of examples) {
      lines.push(
        `- ${cell(rankLabel(example.edhrecRank))} 《${cell(example.name)}》: ${cell(snippet(example.matchedText, 160))}`,
      );
    }
    lines.push('');
  }
  return lines;
}

function renderMultiFamily(items: readonly MultiFamilyItem[]): string[] {
  if (items.length === 0) {
    return ['- none'];
  }
  return items
    .slice(0, MARKDOWN_CASE_LIMIT)
    .map((item) => `- 《${cell(item.name)}》: ${item.families.join(', ')}`);
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
  return `${churn.changedCount}/${churn.comparedCardCount} changed (${percent(churn.rate)}), baselineCards=${churn.baselineCardCount}, byFamily=${familyDeltaSummary(churn.byFamily)}`;
}

function familyDeltaSummary(byFamily: FamilyDeltaReport): string {
  const deltas = EVENT_FAMILIES.filter((family) => byFamily[family] !== 0).map(
    (family) => `${family} ${signedCount(byFamily[family])}`,
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
  return [...values].sort((a, b) => a.localeCompare(b));
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

function isEventFamily(value: unknown): value is EventFamily {
  return typeof value === 'string' && EVENT_FAMILIES.includes(value as EventFamily);
}

function isObserverScope(value: unknown): value is ObserverScope {
  return typeof value === 'string' && OBSERVER_SCOPES.includes(value as ObserverScope);
}

function isTriggerShape(value: unknown): value is TriggerShape {
  return typeof value === 'string' && TRIGGER_SHAPES.includes(value as TriggerShape);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code === code
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
