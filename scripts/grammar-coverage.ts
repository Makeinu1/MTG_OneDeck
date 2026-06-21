import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  CONSTRUCT_DEFINITIONS,
  EFFECT_ATOM_DEFINITIONS,
  detectConstructs,
  detectEffectAtoms,
  splitAbilityLines,
  type AbilityLine,
  type AbilityShape,
  type ConstructId,
  type EffectAtomId,
} from '../src/engine/grammar/index.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/grammar-coverage/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/grammar-coverage/report.json');
const TOP_CASE_LIMIT = 20;
const COVERAGE_KS = [5, 10, 15, 20] as const;

const NOTE = 'この数値は未調整(候補分布であり絶対正解でない)。probe は人間裁定用の広網候補。';

const SHAPE_ORDER: readonly AbilityShape[] = [
  'activated',
  'triggered',
  'delayed-triggered',
  'replacement',
  'static',
  'spell',
  'keyword',
];

const SHAPE_LABELS = new Map<AbilityShape, string>([
  ['activated', '起動型'],
  ['triggered', '誘発型'],
  ['delayed-triggered', '遅延誘発型'],
  ['replacement', '置換'],
  ['static', '常在型'],
  ['spell', '呪文本体'],
  ['keyword', '純キーワード'],
]);

interface MappingFailure {
  index: number;
  cardName: string;
  reason: string;
}

interface Totals {
  rawCards: number;
  mappedCards: number;
  mappingFailures: number;
  abilityLineCount: number;
  effectLineCount: number;
  atomOccurrenceCount: number;
}

interface ShapeSummaryItem {
  id: AbilityShape;
  label: string;
  cardCount: number;
  lineCount: number;
}

interface AtomSummaryItem {
  id: EffectAtomId;
  label: string;
  cardCount: number;
  lineCount: number;
}

interface CoverageCurveItem {
  k: number | 'all';
  atomCount: number;
  coveredLineCount: number;
  coveredLineRate: number;
  coveredAtomOccurrenceCount: number;
  atomOccurrenceCoverageRate: number;
  automationFrontierLineCount: number;
  automationFrontierRate: number;
}

interface ConstructSummaryItem {
  id: ConstructId;
  label: string;
  effectLineCount: number;
  effectLineRate: number;
}

interface LineCase {
  cardName: string;
  oracleId: string;
  scryfallId: string;
  faceIndex: number;
  shape: AbilityShape;
  text: string;
}

interface EffectLineRecord extends LineCase {
  atoms: EffectAtomId[];
  constructs: ConstructId[];
}

const atomLabels = new Map(
  EFFECT_ATOM_DEFINITIONS.map((definition) => [definition.id, definition.label]),
);
const constructLabels = new Map(
  CONSTRUCT_DEFINITIONS.map((definition) => [definition.id, definition.label]),
);

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const shapeCardCounts = new Map<AbilityShape, number>();
  const shapeLineCounts = new Map<AbilityShape, number>();
  const atomCardCounts = new Map<EffectAtomId, number>();
  const atomLineCounts = new Map<EffectAtomId, number>();
  const constructEffectLineCounts = new Map<ConstructId, number>();
  const mappingFailures: MappingFailure[] = [];
  const effectLines: EffectLineRecord[] = [];
  const adjudicationCandidates: LineCase[] = [];

  let mappedCards = 0;
  let abilityLineCount = 0;
  let atomOccurrenceCount = 0;

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
    const oracleId = safeString(def.oracleId, safeString(scryfallCard.oracle_id, fallbackName));
    const scryfallId = safeString(def.scryfallId, safeString(scryfallCard.id, fallbackName));
    const cardShapes = new Set<AbilityShape>();
    const cardAtoms = new Set<EffectAtomId>();

    for (const line of splitAbilityLines(def)) {
      abilityLineCount += 1;
      cardShapes.add(line.shape);
      increment(shapeLineCounts, line.shape);

      const atoms = detectEffectAtoms(line.text);
      const constructs = detectConstructs(line.text);
      if (atoms.length > 0) {
        atomOccurrenceCount += atoms.length;
        for (const atomId of atoms) {
          cardAtoms.add(atomId);
          increment(atomLineCounts, atomId);
        }
        for (const constructId of constructs) {
          increment(constructEffectLineCounts, constructId);
        }
        effectLines.push({
          ...lineCase(line, cardName, oracleId, scryfallId),
          atoms,
          constructs,
        });
      } else if (line.shape !== 'keyword') {
        adjudicationCandidates.push(lineCase(line, cardName, oracleId, scryfallId));
      }
    }

    for (const shape of cardShapes) {
      increment(shapeCardCounts, shape);
    }
    for (const atomId of cardAtoms) {
      increment(atomCardCounts, atomId);
    }
  }

  const totals: Totals = {
    rawCards: rawCards.length,
    mappedCards,
    mappingFailures: mappingFailures.length,
    abilityLineCount,
    effectLineCount: effectLines.length,
    atomOccurrenceCount,
  };
  const shapeSummary = buildShapeSummary(shapeCardCounts, shapeLineCounts);
  const effectAtomSummary = buildEffectAtomSummary(atomCardCounts, atomLineCounts);
  const coverageCurve = buildCoverageCurve(effectAtomSummary, effectLines, totals);
  const constructSummary = buildConstructSummary(constructEffectLineCounts, totals);
  const rankedAdjudicationCandidates = rankLineCases(adjudicationCandidates);

  const reportJson = {
    note: NOTE,
    generatedAt,
    inputPath: relative(process.cwd(), INPUT_PATH),
    totals,
    shapeSummary,
    effectAtomSummary,
    coverageCurve,
    constructSummary,
    adjudicationCandidatesTop: rankedAdjudicationCandidates.slice(0, TOP_CASE_LIMIT),
    mappingFailuresTop: mappingFailures.slice(0, TOP_CASE_LIMIT),
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdownReport({
      generatedAt,
      totals,
      shapeSummary,
      effectAtomSummary,
      coverageCurve,
      constructSummary,
      adjudicationCandidates: rankedAdjudicationCandidates,
      mappingFailures,
    }),
    'utf8',
  );

  console.log(`Grammar coverage report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${totals.rawCards} mapped=${totals.mappedCards} mappingFailures=${totals.mappingFailures} effectLines=${totals.effectLineCount}`,
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

function lineCase(
  line: AbilityLine,
  cardName: string,
  oracleId: string,
  scryfallId: string,
): LineCase {
  return {
    cardName,
    oracleId,
    scryfallId,
    faceIndex: line.faceIndex,
    shape: line.shape,
    text: line.text,
  };
}

function increment<Key extends string>(counts: Map<Key, number>, id: Key): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function buildShapeSummary(
  cardCounts: Map<AbilityShape, number>,
  lineCounts: Map<AbilityShape, number>,
): ShapeSummaryItem[] {
  return SHAPE_ORDER.map((shape) => ({
    id: shape,
    label: SHAPE_LABELS.get(shape) ?? shape,
    cardCount: cardCounts.get(shape) ?? 0,
    lineCount: lineCounts.get(shape) ?? 0,
  }));
}

function buildEffectAtomSummary(
  cardCounts: Map<EffectAtomId, number>,
  lineCounts: Map<EffectAtomId, number>,
): AtomSummaryItem[] {
  return EFFECT_ATOM_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    cardCount: cardCounts.get(definition.id) ?? 0,
    lineCount: lineCounts.get(definition.id) ?? 0,
  })).sort(compareAtomSummaryItems);
}

function compareAtomSummaryItems(a: AtomSummaryItem, b: AtomSummaryItem): number {
  const cardDiff = b.cardCount - a.cardCount;
  if (cardDiff !== 0) {
    return cardDiff;
  }
  const lineDiff = b.lineCount - a.lineCount;
  if (lineDiff !== 0) {
    return lineDiff;
  }
  return a.id.localeCompare(b.id);
}

function buildCoverageCurve(
  atomSummary: readonly AtomSummaryItem[],
  effectLines: readonly EffectLineRecord[],
  totals: Totals,
): CoverageCurveItem[] {
  const atomOrder = atomSummary.filter((item) => item.lineCount > 0).map((item) => item.id);
  const kValues: Array<number | 'all'> = [...COVERAGE_KS, 'all'];
  return kValues.map((k) => {
    const topAtoms = k === 'all' ? atomOrder : atomOrder.slice(0, k);
    const topAtomSet = new Set(topAtoms);
    let coveredLineCount = 0;
    let coveredAtomOccurrenceCount = 0;
    let automationFrontierLineCount = 0;

    for (const line of effectLines) {
      const allAtomsCovered = line.atoms.every((atomId) => topAtomSet.has(atomId));
      for (const atomId of line.atoms) {
        if (topAtomSet.has(atomId)) {
          coveredAtomOccurrenceCount += 1;
        }
      }
      if (!allAtomsCovered) {
        continue;
      }
      coveredLineCount += 1;
      if (
        !line.constructs.includes('construct.target') &&
        !line.constructs.includes('construct.choose-modal')
      ) {
        automationFrontierLineCount += 1;
      }
    }

    return {
      k,
      atomCount: topAtoms.length,
      coveredLineCount,
      coveredLineRate: rate(coveredLineCount, totals.effectLineCount),
      coveredAtomOccurrenceCount,
      atomOccurrenceCoverageRate: rate(coveredAtomOccurrenceCount, totals.atomOccurrenceCount),
      automationFrontierLineCount,
      automationFrontierRate: rate(automationFrontierLineCount, totals.effectLineCount),
    };
  });
}

function buildConstructSummary(
  constructCounts: Map<ConstructId, number>,
  totals: Totals,
): ConstructSummaryItem[] {
  return CONSTRUCT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    effectLineCount: constructCounts.get(definition.id) ?? 0,
    effectLineRate: rate(constructCounts.get(definition.id) ?? 0, totals.effectLineCount),
  })).sort((a, b) => {
    const lineDiff = b.effectLineCount - a.effectLineCount;
    if (lineDiff !== 0) {
      return lineDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

function rankLineCases(cases: readonly LineCase[]): LineCase[] {
  return [...cases].sort((a, b) => {
    const shapeDiff = compareShape(a.shape, b.shape);
    if (shapeDiff !== 0) {
      return shapeDiff;
    }
    const cardDiff = a.cardName.localeCompare(b.cardName);
    if (cardDiff !== 0) {
      return cardDiff;
    }
    return a.text.localeCompare(b.text);
  });
}

function compareShape(a: AbilityShape, b: AbilityShape): number {
  const aIndex = SHAPE_ORDER.indexOf(a);
  const bIndex = SHAPE_ORDER.indexOf(b);
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
}

function renderMarkdownReport(input: {
  generatedAt: string;
  totals: Totals;
  shapeSummary: ShapeSummaryItem[];
  effectAtomSummary: AtomSummaryItem[];
  coverageCurve: CoverageCurveItem[];
  constructSummary: ConstructSummaryItem[];
  adjudicationCandidates: LineCase[];
  mappingFailures: MappingFailure[];
}): string {
  const lines: string[] = [
    '# 文法カバレッジ分析 Phase G0 レポート',
    '',
    `**${NOTE}**`,
    '',
    'Baleful Strix などの draw は誘発タグの draw 除外規則とは別に、効果アトムとして数える。',
    '',
    '## 1. 総数',
    '',
    `- 生成日時: ${input.generatedAt}`,
    `- 入力: ${relative(process.cwd(), INPUT_PATH)}`,
    `- raw: ${input.totals.rawCards}`,
    `- 写像成功: ${input.totals.mappedCards}`,
    `- 写像失敗: ${input.totals.mappingFailures}`,
    `- 能力行数: ${input.totals.abilityLineCount}`,
    `- 効果保有行数: ${input.totals.effectLineCount}`,
    `- アトム出現数: ${input.totals.atomOccurrenceCount}`,
    '',
    '## 2. 能力タイプ分布',
    '',
    '| shape | label | card count | line count |',
    '|---|---:|---:|---:|',
    ...input.shapeSummary.map(
      (item) =>
        `| ${cell(item.id)} | ${cell(item.label)} | ${item.cardCount} | ${item.lineCount} |`,
    ),
    '',
    '## 3. 効果アトム頻度ランキング',
    '',
    '| atom | label | card count | line count |',
    '|---|---:|---:|---:|',
    ...input.effectAtomSummary.map(
      (item) =>
        `| ${cell(item.id)} | ${cell(atomLabels.get(item.id) ?? item.label)} | ${item.cardCount} | ${item.lineCount} |`,
    ),
    '',
    '## 4. 累積カバレッジ曲線',
    '',
    '効果保有行を母数に、アトムをカード数降順で並べた上位 K による未調整カバレッジ。',
    '',
    '| K | atom count | カバー行数 | カバー行率 | アトム出現カバー数 | アトム出現カバー率 | 自動化可能フロンティア行数 | 自動化可能フロンティア |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...input.coverageCurve.map(
      (item) =>
        `| ${item.k} | ${item.atomCount} | ${item.coveredLineCount} | ${percent(item.coveredLineRate)} | ${item.coveredAtomOccurrenceCount} | ${percent(item.atomOccurrenceCoverageRate)} | ${item.automationFrontierLineCount} | ${percent(item.automationFrontierRate)} |`,
    ),
    '',
    '## 5. 構文分布',
    '',
    '| construct | label | effect line count | effect line rate |',
    '|---|---:|---:|---:|',
    ...input.constructSummary.map(
      (item) =>
        `| ${cell(item.id)} | ${cell(constructLabels.get(item.id) ?? item.label)} | ${item.effectLineCount} | ${percent(item.effectLineRate)} |`,
    ),
    '',
    '## 6. 裁定候補',
    '',
    '効果候補行だが既知アトムを1つも検出できなかった行。語彙の取りこぼし発見用。',
    '',
    ...renderLineCases(input.adjudicationCandidates),
    '',
    '## 7. 写像失敗 top-N',
    '',
    ...renderMappingFailures(input.mappingFailures),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderLineCases(cases: readonly LineCase[]): string[] {
  if (cases.length === 0) {
    return ['- なし'];
  }
  return cases
    .slice(0, TOP_CASE_LIMIT)
    .map(
      (item) =>
        `- ${cell(item.shape)} / face ${item.faceIndex} / 《${cell(item.cardName)}》: ${cell(snippet(item.text, 180))}`,
    );
}

function renderMappingFailures(failures: readonly MappingFailure[]): string[] {
  if (failures.length === 0) {
    return ['- なし'];
  }
  return failures
    .slice(0, TOP_CASE_LIMIT)
    .map((item) => `- #${item.index} 《${cell(item.cardName)}》: ${cell(item.reason)}`);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
