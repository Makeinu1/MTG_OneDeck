import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import { splitAbilityLines } from '../src/engine/grammar/index.ts';
import type { CardDef } from '../src/types/card';
import type { ObserverScope } from './lib/eventClassify.ts';
import {
  CAST_TIMINGS,
  TIMING_STEPS,
  classifyCardTiming,
  classifyTimingForLine,
  type CardTimingSummary,
  type CastTiming,
  type TimingStep,
} from './lib/timingClassify.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/timing-coverage/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/timing-coverage/report.json');
const EXAMPLE_LIMIT = 15;

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'any',
  'controlled-set',
  'opponent',
  'self',
  'unknown',
];

const SBA_MODIFIERS = [
  'indestructible',
  'poison',
  'regenerate',
  'cantLose',
  'cantWin',
  'losesGame',
  'winsGame',
] as const;

type SbaModifier = (typeof SBA_MODIFIERS)[number];

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

interface RankedExample extends ExampleItem {
  sortRank: number;
}

interface Bucket {
  cardKeys: Set<string>;
  examples: RankedExample[];
}

interface CountWithExamples {
  cardCount: number;
  examples: ExampleItem[];
}

interface CountOnly {
  cardCount: number;
}

interface CardTimingItem extends CardTimingSummary {
  oracleId: string;
  name: string;
}

interface MultiJunctureItem {
  name: string;
  junctures: TimingStep[];
}

type PerStep = Record<TimingStep, CountWithExamples>;
type PerScope = Record<ObserverScope, CountOnly>;
type PerCastTiming = Record<CastTiming, CountOnly>;
type SbaModifiers = Record<SbaModifier, CountOnly>;
type StepDelta = Record<TimingStep, number>;

interface ChurnReport {
  baselineCardCount: number;
  comparedCardCount: number;
  changedCount: number;
  rate: number;
  byStep: StepDelta;
}

interface TimingCoverageReport {
  generatedAt: string;
  totalCards: number;
  mappedCards: number;
  perStep: PerStep;
  perScope: PerScope;
  perCastTiming: PerCastTiming;
  multiJuncture: MultiJunctureItem[];
  sbaModifiers: SbaModifiers;
  mappingFailures: MappingFailure[];
  churn: ChurnReport;
  cards: CardTimingItem[];
}

interface ClassifiedLine {
  text: string;
  summary: CardTimingSummary;
}

async function main(): Promise<void> {
  const baseline = await readBaselineCards(REPORT_JSON_PATH);
  const rawCards = extractRawCards(await readJson(INPUT_PATH));
  const stepBuckets = createBuckets(TIMING_STEPS);
  const scopeBuckets = createBuckets(OBSERVER_SCOPES);
  const castBuckets = createBuckets(CAST_TIMINGS);
  const sbaBuckets = createBuckets(SBA_MODIFIERS);
  const mappingFailures: MappingFailure[] = [];
  const cards: CardTimingItem[] = [];
  const multiJuncture: MultiJunctureItem[] = [];

  for (const [index, rawCard] of rawCards.entries()) {
    const fallbackName = readStringField(rawCard, 'name') ?? `(index ${index})`;
    if (!isRecord(rawCard)) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: 'Invalid Scryfall card shape',
      });
      continue;
    }

    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(rawCard as unknown as ScryfallCard);
    } catch (error: unknown) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: errorMessage(error),
      });
      continue;
    }

    const name = nonEmptyString(def.name) ?? fallbackName;
    const oracleId =
      nonEmptyString(def.oracleId) ?? nonEmptyString(def.scryfallId) ?? name;
    const summary = classifyCardTiming(def);
    const lines = classifyLines(def);
    const rank = rankValue(def.edhrecRank);
    const card: CardTimingItem = { oracleId, name, ...summary };
    cards.push(card);

    for (const step of summary.junctures) {
      addExample(
        stepBuckets[step],
        oracleId,
        name,
        def.edhrecRank,
        rank,
        lines.find((line) => line.summary.junctures.includes(step))?.text,
      );
    }
    for (const scope of summary.junctureScope) {
      addExample(
        scopeBuckets[scope],
        oracleId,
        name,
        def.edhrecRank,
        rank,
        lines.find((line) => line.summary.junctureScope.includes(scope))?.text,
      );
    }
    for (const cast of summary.castTiming) {
      addExample(
        castBuckets[cast],
        oracleId,
        name,
        def.edhrecRank,
        rank,
        lines.find((line) => line.summary.castTiming.includes(cast))?.text,
      );
    }

    if (summary.junctures.length > 1) {
      multiJuncture.push({ name, junctures: summary.junctures });
    }

    const oracleText = oracleTextForCard(def);
    for (const modifier of detectSbaModifiers(oracleText)) {
      addExample(
        sbaBuckets[modifier],
        oracleId,
        name,
        def.edhrecRank,
        rank,
        oracleText,
      );
    }
  }

  const report: TimingCoverageReport = {
    generatedAt: new Date().toISOString(),
    totalCards: rawCards.length,
    mappedCards: cards.length,
    perStep: buildCountWithExamples(stepBuckets),
    perScope: buildCountOnly(scopeBuckets),
    perCastTiming: buildCountOnly(castBuckets),
    multiJuncture: multiJuncture.sort(compareMultiJuncture),
    sbaModifiers: buildCountOnly(sbaBuckets),
    mappingFailures,
    churn: buildChurn(baseline, cards),
    cards,
  };

  await mkdir(dirname(REPORT_JSON_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdown(report), 'utf8');

  console.log(`Timing coverage report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `totalCards=${report.totalCards} mappedCards=${report.mappedCards} mappingFailures=${report.mappingFailures.length}`,
  );

  if (mappingFailures.length > 0) {
    throw new Error(
      `Timing coverage requires mappingFailures=0; found ${mappingFailures.length}.`,
    );
  }
}

function classifyLines(def: CardDef): ClassifiedLine[] {
  return splitAbilityLines(def).map((line) => ({
    text: line.text,
    summary: classifyTimingForLine(line),
  }));
}

function oracleTextForCard(def: CardDef): string {
  return def.faces
    .map((face) => (typeof face.oracleText === 'string' ? face.oracleText : ''))
    .filter(Boolean)
    .join('\n');
}

function detectSbaModifiers(text: string): SbaModifier[] {
  const modifiers: SbaModifier[] = [];
  if (/\bindestructible\b/i.test(text)) {
    modifiers.push('indestructible');
  }
  if (/\bpoison\b|\binfect\b|\btoxic\b/i.test(text)) {
    modifiers.push('poison');
  }
  if (/\bregenerate\b/i.test(text)) {
    modifiers.push('regenerate');
  }
  if (/\bcan['’]t lose the game\b/i.test(text)) {
    modifiers.push('cantLose');
  }
  if (/\bcan['’]t win the game\b/i.test(text)) {
    modifiers.push('cantWin');
  }
  if (/\bloses the game\b/i.test(text)) {
    modifiers.push('losesGame');
  }
  if (/\bwins the game\b/i.test(text)) {
    modifiers.push('winsGame');
  }
  return modifiers;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function readBaselineCards(path: string): Promise<CardTimingItem[] | null> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (hasErrorCode(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
  const payload = JSON.parse(source) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.cards)) {
    return null;
  }
  const cards = payload.cards.map(coerceCardTimingItem);
  return cards.every((card): card is CardTimingItem => Boolean(card)) ? cards : null;
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
  throw new Error('Input JSON must be an array or contain data[]/cards[].');
}

function coerceCardTimingItem(value: unknown): CardTimingItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name');
  if (
    !oracleId ||
    !name ||
    !Array.isArray(value.junctures) ||
    !value.junctures.every(isTimingStep) ||
    !Array.isArray(value.junctureScope) ||
    !value.junctureScope.every(isObserverScope) ||
    !Array.isArray(value.castTiming) ||
    !value.castTiming.every(isCastTiming)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    junctures: sortByOrder(value.junctures, TIMING_STEPS),
    junctureScope: sortByOrder(value.junctureScope, OBSERVER_SCOPES),
    castTiming: sortByOrder(value.castTiming, CAST_TIMINGS),
  };
}

function buildChurn(
  baseline: readonly CardTimingItem[] | null,
  current: readonly CardTimingItem[],
): ChurnReport {
  if (!baseline) {
    return {
      baselineCardCount: current.length,
      comparedCardCount: current.length,
      changedCount: 0,
      rate: 0,
      byStep: createStepDelta(),
    };
  }

  const baselineById = new Map(baseline.map((card) => [card.oracleId, card] as const));
  const byStep = createStepDelta();
  let comparedCardCount = 0;
  let changedCount = 0;
  for (const card of current) {
    const previous = baselineById.get(card.oracleId);
    if (!previous) {
      continue;
    }
    comparedCardCount += 1;
    if (signature(previous) !== signature(card)) {
      changedCount += 1;
    }
    const previousSteps = new Set(previous.junctures);
    const currentSteps = new Set(card.junctures);
    for (const step of TIMING_STEPS) {
      if (!previousSteps.has(step) && currentSteps.has(step)) {
        byStep[step] += 1;
      } else if (previousSteps.has(step) && !currentSteps.has(step)) {
        byStep[step] -= 1;
      }
    }
  }
  return {
    baselineCardCount: baseline.length,
    comparedCardCount,
    changedCount,
    rate: rate(changedCount, comparedCardCount),
    byStep,
  };
}

function signature(card: CardTimingItem): string {
  return [
    card.junctures.join(','),
    card.junctureScope.join(','),
    card.castTiming.join(','),
  ].join('|');
}

function createStepDelta(): StepDelta {
  return Object.fromEntries(TIMING_STEPS.map((step) => [step, 0])) as StepDelta;
}

function createBuckets<Key extends string>(keys: readonly Key[]): Record<Key, Bucket> {
  return Object.fromEntries(
    keys.map((key) => [key, { cardKeys: new Set<string>(), examples: [] }]),
  ) as Record<Key, Bucket>;
}

function addExample(
  bucket: Bucket,
  cardKey: string,
  name: string,
  edhrecRank: number | undefined,
  sortRank: number,
  matchedText: string | undefined,
): void {
  bucket.cardKeys.add(cardKey);
  if (matchedText !== undefined) {
    bucket.examples.push({ name, edhrecRank, sortRank, matchedText });
  }
}

function buildCountWithExamples<Key extends string>(
  buckets: Record<Key, Bucket>,
): Record<Key, CountWithExamples> {
  return Object.fromEntries(
    Object.entries<Bucket>(buckets).map(([key, bucket]) => [
      key,
      {
        cardCount: bucket.cardKeys.size,
        examples: rankedExamples(bucket.examples).slice(0, EXAMPLE_LIMIT),
      },
    ]),
  ) as Record<Key, CountWithExamples>;
}

function buildCountOnly<Key extends string>(
  buckets: Record<Key, Bucket>,
): Record<Key, CountOnly> {
  return Object.fromEntries(
    Object.entries<Bucket>(buckets).map(([key, bucket]) => [
      key,
      { cardCount: bucket.cardKeys.size },
    ]),
  ) as Record<Key, CountOnly>;
}

function rankedExamples(examples: readonly RankedExample[]): ExampleItem[] {
  const seen = new Set<string>();
  return [...examples]
    .sort(
      (a, b) =>
        a.sortRank - b.sortRank ||
        compareStrings(a.name, b.name) ||
        compareStrings(a.matchedText, b.matchedText),
    )
    .filter((example) => {
      const key = `${example.name}\n${example.matchedText}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map(({ name, edhrecRank, matchedText }) => ({ name, edhrecRank, matchedText }));
}

function renderMarkdown(report: TimingCoverageReport): string {
  return `${[
    '# Timing Coverage Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Input: ${relative(process.cwd(), INPUT_PATH)}`,
    `- totalCards: ${report.totalCards}`,
    `- mappedCards: ${report.mappedCards}`,
    `- mappingFailures: ${report.mappingFailures.length}`,
    `- churn: ${report.churn.changedCount}/${report.churn.comparedCardCount} (${percent(report.churn.rate)})`,
    '',
    '## Timing-step demand',
    '',
    '| step | cards | examples |',
    '|---|---:|---|',
    ...TIMING_STEPS.map((step) => {
      const item = report.perStep[step];
      return `| ${step} | ${item.cardCount} | ${cell(item.examples.slice(0, 5).map((example) => example.name).join('; ') || '-')} |`;
    }),
    '',
    '## Cast-timing distribution',
    '',
    '| cast timing | cards |',
    '|---|---:|',
    ...CAST_TIMINGS.map(
      (cast) => `| ${cast} | ${report.perCastTiming[cast].cardCount} |`,
    ),
    '',
    '## Juncture-scope distribution',
    '',
    '| scope | cards |',
    '|---|---:|',
    ...OBSERVER_SCOPES.map(
      (scope) => `| ${scope} | ${report.perScope[scope].cardCount} |`,
    ),
    '',
    '## SBA-modifier demand',
    '',
    '| modifier | cards |',
    '|---|---:|',
    ...SBA_MODIFIERS.map(
      (modifier) => `| ${modifier} | ${report.sbaModifiers[modifier].cardCount} |`,
    ),
    '',
    '## Representative timing lines',
    '',
    ...TIMING_STEPS.flatMap((step) => [
      `### ${step}`,
      '',
      ...(report.perStep[step].examples.length > 0
        ? report.perStep[step].examples.map(
            (example) =>
              `- 《${cell(example.name)}》: ${cell(snippet(example.matchedText, 180))}`,
          )
        : ['- none']),
      '',
    ]),
  ].join('\n')}\n`;
}

function compareMultiJuncture(a: MultiJunctureItem, b: MultiJunctureItem): number {
  return compareStrings(a.name, b.name) || compareStrings(a.junctures.join(','), b.junctures.join(','));
}

function sortByOrder<T>(values: readonly T[], order: readonly T[]): T[] {
  return [...new Set(values)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function isTimingStep(value: unknown): value is TimingStep {
  return typeof value === 'string' && TIMING_STEPS.includes(value as TimingStep);
}

function isObserverScope(value: unknown): value is ObserverScope {
  return (
    typeof value === 'string' && OBSERVER_SCOPES.includes(value as ObserverScope)
  );
}

function isCastTiming(value: unknown): value is CastTiming {
  return typeof value === 'string' && CAST_TIMINGS.includes(value as CastTiming);
}

function rankValue(value: number | undefined): number {
  return typeof value === 'number' ? value : Number.POSITIVE_INFINITY;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function snippet(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringField(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === 'string' ? value[key] : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
