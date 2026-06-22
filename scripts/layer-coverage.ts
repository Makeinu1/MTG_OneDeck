import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { splitAbilityLines, type AbilityLine } from '../src/engine/grammar/index.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';
import {
  classifyCardLayers,
  classifyContinuousLayers,
  type LayerId,
  type LayerTag,
} from './lib/layerClassify.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/layer-coverage/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/layer-coverage/report.json');
const EXAMPLE_LIMIT = 15;
const MARKDOWN_CASE_LIMIT = 50;

const LAYER_IDS: readonly LayerId[] = [
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

interface LayerBucket {
  cardKeys: Set<string>;
  lineKeys: Set<string>;
  examples: RankedExampleItem[];
}

interface LayerReportItem {
  cardCount: number;
  lineCount: number;
  effectLineRate: number;
  examples: ExampleItem[];
}

type PerLayerReport = Record<LayerId, LayerReportItem>;

interface MultiLayerCandidate {
  name: string;
  layers: LayerId[];
  sortRank: number;
}

interface MultiLayerItem {
  name: string;
  layers: LayerId[];
}

interface CardLayerItem {
  oracleId: string;
  name: string;
  layers: LayerId[];
  cda: boolean;
}

type LayerDeltaReport = Record<LayerId, number>;

interface ChurnReport {
  baselineCardCount: number;
  comparedCardCount: number;
  changedCount: number;
  rate: number;
  byLayer: LayerDeltaReport;
}

interface AdjudicationCandidate {
  name: string;
  line: string;
  reason: string;
  sortRank: number;
}

interface AdjudicationItem {
  name: string;
  line: string;
  reason: string;
}

interface ReportJson {
  totalCards: number;
  mappedCards: number;
  perLayer: PerLayerReport;
  cdaCardCount: number;
  multiLayer: MultiLayerItem[];
  adjudication: AdjudicationItem[];
  cards: CardLayerItem[];
  churn: ChurnReport | null;
}

interface CoverageCurveItem {
  k: number | 'all';
  layerCount: number;
  coveredCardCount: number;
  coveredCardRate: number;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const baselineCards = await readBaselineCards(REPORT_JSON_PATH);
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const buckets = createLayerBuckets();
  const classifiedLineKeys = new Set<string>();
  const allLayerCardKeys = new Map<LayerId, Set<string>>();
  const mappingFailures: MappingFailure[] = [];
  const multiLayerCandidates: MultiLayerCandidate[] = [];
  const adjudicationCandidates: AdjudicationCandidate[] = [];
  const cards: CardLayerItem[] = [];

  let mappedCards = 0;
  let cdaCardCount = 0;

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
    const summary = classifyCardLayers(def);
    cards.push({
      oracleId: cardKey,
      name: cardName,
      layers: summary.layers,
      cda: summary.cda,
    });

    if (summary.cda) {
      cdaCardCount += 1;
    }
    if (summary.layers.length >= 2) {
      multiLayerCandidates.push({ name: cardName, layers: summary.layers, sortRank });
    }

    for (const layer of summary.layers) {
      const keys = allLayerCardKeys.get(layer) ?? new Set<string>();
      keys.add(cardKey);
      allLayerCardKeys.set(layer, keys);
    }

    for (const [lineIndex, line] of splitAbilityLines(def).entries()) {
      const lineKey = `${cardKey}:${line.faceIndex}:${lineIndex}`;
      const tags = classifyContinuousLayers(line, def);
      if (tags.length > 0) {
        classifiedLineKeys.add(lineKey);
        addLineToBuckets(buckets, tags, cardKey, lineKey, cardName, def.edhrecRank);
        continue;
      }

      const reason = adjudicationReason(line);
      if (reason) {
        adjudicationCandidates.push({
          name: cardName,
          line: line.text,
          reason,
          sortRank,
        });
      }
    }
  }

  const perLayer = buildPerLayerReport(buckets, classifiedLineKeys.size);
  const multiLayer = rankMultiLayer(multiLayerCandidates);
  const adjudication = rankAdjudication(adjudicationCandidates);
  const churn = buildChurnReport(baselineCards, cards);
  const reportJson: ReportJson = {
    totalCards: rawCards.length,
    mappedCards,
    perLayer,
    cdaCardCount,
    multiLayer,
    adjudication,
    cards,
    churn,
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdownReport({
      generatedAt,
      reportJson,
      classifiedLineCount: classifiedLineKeys.size,
      coverageCurve: buildCoverageCurve(allLayerCardKeys, rawCards.length),
      mappingFailures,
    }),
    'utf8',
  );

  console.log(`Layer coverage report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `totalCards=${reportJson.totalCards} mappedCards=${reportJson.mappedCards} classifiedLines=${classifiedLineKeys.size} cdaCards=${reportJson.cdaCardCount}`,
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

async function readBaselineCards(path: string): Promise<CardLayerItem[] | null> {
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

  const cards: CardLayerItem[] = [];
  for (const item of payload.cards) {
    const card = coerceCardLayerItem(item);
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

function coerceCardLayerItem(value: unknown): CardLayerItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name') ?? oracleId;
  const layerValues = value.layers;
  const cda = value.cda;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(layerValues) ||
    typeof cda !== 'boolean' ||
    !layerValues.every(isLayerId)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    layers: sortLayerIds(layerValues),
    cda,
  };
}

function createLayerBuckets(): Record<LayerId, LayerBucket> {
  const buckets = {} as Record<LayerId, LayerBucket>;
  for (const layer of LAYER_IDS) {
    buckets[layer] = {
      cardKeys: new Set<string>(),
      lineKeys: new Set<string>(),
      examples: [],
    };
  }
  return buckets;
}

function addLineToBuckets(
  buckets: Record<LayerId, LayerBucket>,
  tags: readonly LayerTag[],
  cardKey: string,
  lineKey: string,
  cardName: string,
  edhrecRank: number | undefined,
): void {
  for (const tag of tags) {
    const bucket = buckets[tag.layer];
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

function buildPerLayerReport(
  buckets: Record<LayerId, LayerBucket>,
  classifiedLineCount: number,
): PerLayerReport {
  const perLayer = {} as PerLayerReport;
  for (const layer of LAYER_IDS) {
    const bucket = buckets[layer];
    perLayer[layer] = {
      cardCount: bucket.cardKeys.size,
      lineCount: bucket.lineKeys.size,
      effectLineRate: rate(bucket.lineKeys.size, classifiedLineCount),
      examples: rankedExamples(bucket.examples).slice(0, EXAMPLE_LIMIT),
    };
  }
  return perLayer;
}

function buildChurnReport(
  baselineCards: readonly CardLayerItem[] | null,
  currentCards: readonly CardLayerItem[],
): ChurnReport | null {
  if (!baselineCards) {
    return null;
  }

  const baselineByOracleId = new Map<string, CardLayerItem>();
  for (const card of baselineCards) {
    baselineByOracleId.set(card.oracleId, card);
  }

  const byLayer = createLayerDeltaReport();
  let comparedCardCount = 0;
  let changedCount = 0;

  for (const current of currentCards) {
    const baseline = baselineByOracleId.get(current.oracleId);
    if (!baseline) {
      continue;
    }

    comparedCardCount += 1;
    if (cardLayerSignature(baseline) !== cardLayerSignature(current)) {
      changedCount += 1;
    }
    addLayerDelta(byLayer, baseline.layers, current.layers);
  }

  return {
    baselineCardCount: baselineByOracleId.size,
    comparedCardCount,
    changedCount,
    rate: rate(changedCount, comparedCardCount),
    byLayer,
  };
}

function createLayerDeltaReport(): LayerDeltaReport {
  const byLayer = {} as LayerDeltaReport;
  for (const layer of LAYER_IDS) {
    byLayer[layer] = 0;
  }
  return byLayer;
}

function addLayerDelta(
  byLayer: LayerDeltaReport,
  baselineLayers: readonly LayerId[],
  currentLayers: readonly LayerId[],
): void {
  const baselineSet = new Set(baselineLayers);
  const currentSet = new Set(currentLayers);
  for (const layer of LAYER_IDS) {
    if (!baselineSet.has(layer) && currentSet.has(layer)) {
      byLayer[layer] += 1;
    } else if (baselineSet.has(layer) && !currentSet.has(layer)) {
      byLayer[layer] -= 1;
    }
  }
}

function cardLayerSignature(card: CardLayerItem): string {
  return `${sortLayerIds(card.layers).join(',')}|cda=${card.cda ? '1' : '0'}`;
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

function rankMultiLayer(candidates: readonly MultiLayerCandidate[]): MultiLayerItem[] {
  return [...candidates]
    .sort((a, b) => {
      const rankDiff = a.sortRank - b.sortRank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.name.localeCompare(b.name);
    })
    .map(({ name, layers }) => ({ name, layers }));
}

function rankAdjudication(candidates: readonly AdjudicationCandidate[]): AdjudicationItem[] {
  return [...candidates]
    .sort((a, b) => {
      const rankDiff = a.sortRank - b.sortRank;
      if (rankDiff !== 0) {
        return rankDiff;
      }
      const nameDiff = a.name.localeCompare(b.name);
      if (nameDiff !== 0) {
        return nameDiff;
      }
      return a.line.localeCompare(b.line);
    })
    .map(({ name, line, reason }) => ({ name, line, reason }));
}

function buildCoverageCurve(
  allLayerCardKeys: ReadonlyMap<LayerId, ReadonlySet<string>>,
  totalCards: number,
): CoverageCurveItem[] {
  const sortedLayers = [...LAYER_IDS].sort((a, b) => {
    const countDiff = (allLayerCardKeys.get(b)?.size ?? 0) - (allLayerCardKeys.get(a)?.size ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return a.localeCompare(b);
  });
  const checkpoints: Array<number | 'all'> = [1, 3, 5, 7, 'all'];
  return checkpoints.map((k) => {
    const layers = k === 'all' ? sortedLayers : sortedLayers.slice(0, k);
    const covered = new Set<string>();
    for (const layer of layers) {
      for (const cardKey of allLayerCardKeys.get(layer) ?? []) {
        covered.add(cardKey);
      }
    }
    return {
      k,
      layerCount: layers.length,
      coveredCardCount: covered.size,
      coveredCardRate: rate(covered.size, totalCards),
    };
  });
}

function adjudicationReason(line: AbilityLine): string | undefined {
  if (line.shape === 'keyword') {
    return undefined;
  }

  const text = effectText(normalize(line.text));
  if (text === '') {
    return undefined;
  }
  if (ONE_SHOT_ACTIONS.test(text) && !DURATION_CUES.test(text)) {
    return undefined;
  }
  if (CONTINUOUS_CUES.test(text)) {
    return 'continuous-looking line without layer tag';
  }
  return undefined;
}

const ONE_SHOT_ACTIONS =
  /\b(?:add(?:s|ed)?\b[^.]*\bmana|counter target spell|create(?:s|d)?\b[^.]*\btokens?|deals?\b[^.]*\bdamage|destroy(?:s|ed|ing)?|discard(?:s|ed|ing)?|draw(?:s|n|ing)?|exile(?:s|d|ing)?|gain(?:s|ed|ing)?\b[^.]*\blife|lose(?:s|t|ing)?\b[^.]*\blife|mill(?:s|ed|ing)?|return(?:s|ed|ing)?|reveal(?:s|ed|ing)?|sacrifice(?:s|d|ing)?|scry(?:s|ed|ing)?|search(?:es|ed|ing)?|surveil(?:s|ed|ing)?|tap(?:s|ped|ping)?|untap(?:s|ped|ping)?)\b/i;

const DURATION_CUES = /\b(?:until end of turn|until your next turn|for as long as|as long as)\b/i;

const CONTINUOUS_CUES =
  /\b(?:until end of turn|until your next turn|for as long as|as long as|base power|power and toughness|power is equal to|toughness is equal to|gets?\s+[+-](?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)|[+-](?:\d+|X)\/[+-]?(?:\d+|X)\s+counters?|becomes?|become|is|are|have|has|gain|gains|lose|loses|can't have|cannot have|copy of|face down|control of|change the text|replace all instances)\b/i;

function effectText(line: string): string {
  const colonIndex = line.indexOf(':');
  if (colonIndex < 0) {
    return line;
  }

  const left = line.slice(0, colonIndex).trim();
  if (!isCostLikeActivatedPrefix(left)) {
    return line;
  }
  return line.slice(colonIndex + 1).trim();
}

function isCostLikeActivatedPrefix(left: string): boolean {
  if (left === '') {
    return false;
  }
  if (/\{T\}/i.test(left) || /\{[^}]+\}/.test(left)) {
    return true;
  }
  return /^(?:Sacrifice|Discard|Pay|Tap|Exile|Remove)\b\s+.+/i.test(left);
}

function renderMarkdownReport(input: {
  generatedAt: string;
  reportJson: ReportJson;
  classifiedLineCount: number;
  coverageCurve: CoverageCurveItem[];
  mappingFailures: readonly MappingFailure[];
}): string {
  const lines: string[] = [
    '# Layer Coverage Report',
    '',
    'Measurement-only extraction for CR613 continuous-effect layers and CR604.3 CDA.',
    '',
    '## Summary',
    '',
    `- Generated at: ${input.generatedAt}`,
    `- Input: ${relative(process.cwd(), INPUT_PATH)}`,
    `- totalCards: ${input.reportJson.totalCards}`,
    `- mappedCards: ${input.reportJson.mappedCards}`,
    `- classified continuous lines: ${input.classifiedLineCount}`,
    `- cdaCardCount: ${input.reportJson.cdaCardCount}`,
    `- multiLayer cards: ${input.reportJson.multiLayer.length}`,
    `- adjudication candidates: ${input.reportJson.adjudication.length}`,
    `- churn: ${churnSummary(input.reportJson.churn)}`,
    `- mapping failures: ${input.mappingFailures.length}`,
    '',
    '## Per Layer',
    '',
    '| layer | card count | line count | effect line rate | examples |',
    '|---|---:|---:|---:|---|',
    ...LAYER_IDS.map((layer) => {
      const item = input.reportJson.perLayer[layer];
      return `| ${layer} | ${item.cardCount} | ${item.lineCount} | ${percent(item.effectLineRate)} | ${cell(exampleSummary(item.examples))} |`;
    }),
    '',
    '## Coverage Curve',
    '',
    '| K | layer count | covered card count | covered card rate |',
    '|---:|---:|---:|---:|',
    ...input.coverageCurve.map(
      (item) =>
        `| ${item.k} | ${item.layerCount} | ${item.coveredCardCount} | ${percent(item.coveredCardRate)} |`,
    ),
    '',
    '## Examples',
    '',
    ...renderExamples(input.reportJson.perLayer),
    '',
    '## Multi Layer Cards',
    '',
    ...renderMultiLayer(input.reportJson.multiLayer),
    '',
    '## Adjudication Candidates',
    '',
    ...renderAdjudication(input.reportJson.adjudication),
    '',
    '## Mapping Failures',
    '',
    ...renderMappingFailures(input.mappingFailures),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderExamples(perLayer: PerLayerReport): string[] {
  const lines: string[] = [];
  for (const layer of LAYER_IDS) {
    lines.push(`### ${layer}`, '');
    const examples = perLayer[layer].examples;
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

function renderMultiLayer(items: readonly MultiLayerItem[]): string[] {
  if (items.length === 0) {
    return ['- none'];
  }
  return items
    .slice(0, MARKDOWN_CASE_LIMIT)
    .map((item) => `- 《${cell(item.name)}》: ${item.layers.join(', ')}`);
}

function renderAdjudication(items: readonly AdjudicationItem[]): string[] {
  if (items.length === 0) {
    return ['- none'];
  }
  return items
    .slice(0, MARKDOWN_CASE_LIMIT)
    .map(
      (item) =>
        `- 《${cell(item.name)}》: ${cell(snippet(item.line, 180))} (${cell(item.reason)})`,
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

function rankLabel(rank: number | undefined): string {
  return typeof rank === 'number' ? `rank ${rank}` : 'unranked';
}

function churnSummary(churn: ChurnReport | null): string {
  if (!churn) {
    return 'n/a (no prior cards baseline)';
  }
  return `${churn.changedCount}/${churn.comparedCardCount} changed (${percent(churn.rate)}), baselineCards=${churn.baselineCardCount}, byLayer=${layerDeltaSummary(churn.byLayer)}`;
}

function layerDeltaSummary(byLayer: LayerDeltaReport): string {
  const deltas = LAYER_IDS.filter((layer) => byLayer[layer] !== 0).map(
    (layer) => `${layer} ${signedCount(byLayer[layer])}`,
  );
  return deltas.length > 0 ? deltas.join(', ') : 'none';
}

function signedCount(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
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

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sortLayerIds(layers: readonly LayerId[]): LayerId[] {
  return [...layers].sort((a, b) => LAYER_IDS.indexOf(a) - LAYER_IDS.indexOf(b));
}

function isLayerId(value: unknown): value is LayerId {
  return typeof value === 'string' && LAYER_IDS.includes(value as LayerId);
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
