import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  EFFECT_ATOM_DEFINITIONS,
  splitAbilityLines,
  type AbilityLine,
  type AbilityShape,
} from '../src/engine/grammar/index.ts';
import {
  parseAbilityIR,
  type AbilityIR,
  type ParseStatus,
} from '../src/engine/grammar/ir.ts';
import { CR_KEYWORD_ACTIONS, isValidRuleRef } from '../src/engine/grammar/rule-refs.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/grammar-ir/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/grammar-ir/report.json');
const TOP_CASE_LIMIT = 20;

const NOTE = 'この数値は未調整(候補分布であり絶対正解でない)。IR は targetless 表現の候補分布。';
const G0_FRONTIER_NOTE = 'G0 自動化フロンティア sanity anchor: 上位20 atom 60.8% / 全34 atom 69.4%。';

const STATUS_ORDER: readonly ParseStatus[] = ['full', 'partial', 'none'];
const BLOCKER_ORDER = [
  'construct.target',
  'construct.choose-modal',
  'unknown-atom',
  'no-atom',
] as const;

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

interface StatusSummaryItem {
  status: ParseStatus;
  lineCount: number;
  lineRate: number;
}

interface FrontierSummaryItem {
  shape: AbilityShape | 'overall';
  label: string;
  lineCount: number;
  effectLineCount: number;
  fullCount: number;
  partialCount: number;
  noneCount: number;
  fullRate: number;
}

interface InvalidRuleRefItem {
  atom: string;
  label: string;
  ruleRef: string;
}

interface KeywordActionGap {
  id: string;
  name: string;
}

interface BlockerSummaryItem {
  blocker: string;
  lineCount: number;
  lineRate: number;
}

interface LineCase {
  cardName: string;
  oracleId: string;
  scryfallId: string;
  faceIndex: number;
  typeLine: string;
  shape: AbilityShape;
  status: ParseStatus;
  blockers: string[];
  text: string;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const statusCounts = new Map<ParseStatus, number>();
  const shapeLineCounts = new Map<AbilityShape, number>();
  const shapeStatusCounts = new Map<AbilityShape, Map<ParseStatus, number>>();
  const blockerCounts = new Map<string, number>();
  const mappingFailures: MappingFailure[] = [];
  const adjudicationCandidates: LineCase[] = [];

  let mappedCards = 0;
  let abilityLineCount = 0;
  let effectLineCount = 0;
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

    for (const line of splitAbilityLines(def)) {
      const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
      const ir = parseAbilityIR(line.text, typeLine);

      abilityLineCount += 1;
      increment(statusCounts, ir.status);
      increment(shapeLineCounts, ir.shape);
      incrementNested(shapeStatusCounts, ir.shape, ir.status);

      if (ir.effects.length > 0) {
        effectLineCount += 1;
        atomOccurrenceCount += ir.effects.length;
      }
      for (const blocker of ir.blockers) {
        increment(blockerCounts, blocker);
      }
      if (ir.status !== 'full') {
        adjudicationCandidates.push(
          lineCase(line, ir, typeLine, cardName, oracleId, scryfallId),
        );
      }
    }
  }

  const totals: Totals = {
    rawCards: rawCards.length,
    mappedCards,
    mappingFailures: mappingFailures.length,
    abilityLineCount,
    effectLineCount,
    atomOccurrenceCount,
  };
  const statusSummary = buildStatusSummary(statusCounts, totals);
  const frontierSummary = buildFrontierSummary(statusCounts, shapeLineCounts, shapeStatusCounts, totals);
  const invalidRuleRefs = invalidRuleRefItems();
  const keywordActionGaps = keywordActionGapItems();
  const blockerSummary = buildBlockerSummary(blockerCounts, totals);
  const rankedAdjudicationCandidates = rankLineCases(adjudicationCandidates);

  const reportJson = {
    note: NOTE,
    generatedAt,
    inputPath: relative(process.cwd(), INPUT_PATH),
    totals,
    statusSummary,
    frontierSummary,
    ruleRefValidation: {
      invalidRuleRefs,
      keywordActionGapsTop: keywordActionGaps.slice(0, TOP_CASE_LIMIT),
      keywordActionGapCount: keywordActionGaps.length,
    },
    blockerSummary,
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
      statusSummary,
      frontierSummary,
      invalidRuleRefs,
      keywordActionGaps,
      blockerSummary,
      adjudicationCandidates: rankedAdjudicationCandidates,
      mappingFailures,
    }),
    'utf8',
  );

  console.log(`Grammar IR report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${totals.rawCards} mapped=${totals.mappedCards} mappingFailures=${totals.mappingFailures} abilityLines=${totals.abilityLineCount} effectLines=${totals.effectLineCount}`,
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
  ir: AbilityIR,
  typeLine: string,
  cardName: string,
  oracleId: string,
  scryfallId: string,
): LineCase {
  return {
    cardName,
    oracleId,
    scryfallId,
    faceIndex: line.faceIndex,
    typeLine,
    shape: ir.shape,
    status: ir.status,
    blockers: ir.blockers,
    text: line.text,
  };
}

function increment<Key extends string>(counts: Map<Key, number>, id: Key): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function incrementNested<Outer extends string, Inner extends string>(
  counts: Map<Outer, Map<Inner, number>>,
  outer: Outer,
  inner: Inner,
): void {
  let innerCounts = counts.get(outer);
  if (!innerCounts) {
    innerCounts = new Map<Inner, number>();
    counts.set(outer, innerCounts);
  }
  increment(innerCounts, inner);
}

function buildStatusSummary(
  statusCounts: Map<ParseStatus, number>,
  totals: Totals,
): StatusSummaryItem[] {
  return STATUS_ORDER.map((status) => ({
    status,
    lineCount: statusCounts.get(status) ?? 0,
    lineRate: rate(statusCounts.get(status) ?? 0, totals.abilityLineCount),
  }));
}

function buildFrontierSummary(
  statusCounts: Map<ParseStatus, number>,
  shapeLineCounts: Map<AbilityShape, number>,
  shapeStatusCounts: Map<AbilityShape, Map<ParseStatus, number>>,
  totals: Totals,
): FrontierSummaryItem[] {
  const overall = {
    shape: 'overall' as const,
    label: '全体',
    lineCount: totals.abilityLineCount,
    effectLineCount: totals.effectLineCount,
    fullCount: statusCounts.get('full') ?? 0,
    partialCount: statusCounts.get('partial') ?? 0,
    noneCount: statusCounts.get('none') ?? 0,
    fullRate: rate(statusCounts.get('full') ?? 0, totals.effectLineCount),
  };
  const byShape = SHAPE_ORDER.map((shape) => {
    const lineCount = shapeLineCounts.get(shape) ?? 0;
    const counts = shapeStatusCounts.get(shape);
    const fullCount = counts?.get('full') ?? 0;
    const partialCount = counts?.get('partial') ?? 0;
    const effectLineCount = fullCount + partialCount;
    return {
      shape,
      label: SHAPE_LABELS.get(shape) ?? shape,
      lineCount,
      effectLineCount,
      fullCount,
      partialCount,
      noneCount: counts?.get('none') ?? 0,
      fullRate: rate(fullCount, effectLineCount),
    };
  });
  return [overall, ...byShape];
}

function invalidRuleRefItems(): InvalidRuleRefItem[] {
  return EFFECT_ATOM_DEFINITIONS.filter((definition) => !isValidRuleRef(definition.ruleRef))
    .map((definition) => ({
      atom: definition.id,
      label: definition.label,
      ruleRef: definition.ruleRef,
    }))
    .sort((a, b) => a.atom.localeCompare(b.atom));
}

function keywordActionGapItems(): KeywordActionGap[] {
  const assignedRuleRefs = new Set(
    EFFECT_ATOM_DEFINITIONS.map((definition) => definition.ruleRef),
  );
  return CR_KEYWORD_ACTIONS.filter((action) => !assignedRuleRefs.has(action.id)).map(
    (action) => ({ id: action.id, name: action.name }),
  );
}

function buildBlockerSummary(
  blockerCounts: Map<string, number>,
  totals: Totals,
): BlockerSummaryItem[] {
  return BLOCKER_ORDER.map((blocker) => ({
    blocker,
    lineCount: blockerCounts.get(blocker) ?? 0,
    lineRate: rate(blockerCounts.get(blocker) ?? 0, totals.abilityLineCount),
  }));
}

function rankLineCases(cases: readonly LineCase[]): LineCase[] {
  return [...cases].sort((a, b) => {
    const statusDiff = compareStatus(a.status, b.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const blockerDiff = a.blockers.join(',').localeCompare(b.blockers.join(','));
    if (blockerDiff !== 0) {
      return blockerDiff;
    }
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

function compareStatus(a: ParseStatus, b: ParseStatus): number {
  const aIndex = STATUS_ORDER.indexOf(a);
  const bIndex = STATUS_ORDER.indexOf(b);
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
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
  statusSummary: StatusSummaryItem[];
  frontierSummary: FrontierSummaryItem[];
  invalidRuleRefs: InvalidRuleRefItem[];
  keywordActionGaps: KeywordActionGap[];
  blockerSummary: BlockerSummaryItem[];
  adjudicationCandidates: LineCase[];
  mappingFailures: MappingFailure[];
}): string {
  const lines: string[] = [
    '# 文法IR分析 Phase G1 レポート',
    '',
    `**${NOTE}**`,
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
    '### 写像失敗 top-N',
    '',
    ...renderMappingFailures(input.mappingFailures),
    '',
    '## 2. parse status 分布',
    '',
    '| status | line count | line rate |',
    '|---|---:|---:|',
    ...input.statusSummary.map(
      (item) => `| ${cell(item.status)} | ${item.lineCount} | ${percent(item.lineRate)} |`,
    ),
    '',
    '## 3. IR 表現フロンティア',
    '',
    G0_FRONTIER_NOTE,
    '',
    '| shape | label | line count | effect line count | full | partial | none | full/effect line rate |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...input.frontierSummary.map(
      (item) =>
        `| ${cell(item.shape)} | ${cell(item.label)} | ${item.lineCount} | ${item.effectLineCount} | ${item.fullCount} | ${item.partialCount} | ${item.noneCount} | ${percent(item.fullRate)} |`,
    ),
    '',
    '## 4. ruleRef 検証',
    '',
    '### 無効 ruleRef',
    '',
    ...renderInvalidRuleRefs(input.invalidRuleRefs),
    '',
    '### atom 未割当の CR §701 keyword-action top-N',
    '',
    `- 未割当総数: ${input.keywordActionGaps.length}`,
    '',
    '| ruleRef | keyword action |',
    '|---|---|',
    ...input.keywordActionGaps
      .slice(0, TOP_CASE_LIMIT)
      .map((item) => `| ${cell(item.id)} | ${cell(item.name)} |`),
    '',
    '## 5. blocker 分布',
    '',
    '| blocker | line count | line rate |',
    '|---|---:|---:|',
    ...input.blockerSummary.map(
      (item) => `| ${cell(item.blocker)} | ${item.lineCount} | ${percent(item.lineRate)} |`,
    ),
    '',
    '## 6. 裁定候補',
    '',
    'partial/none の代表行。targetless IR の次段階で語彙・構文を増やす候補。',
    '',
    ...renderLineCases(input.adjudicationCandidates),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderInvalidRuleRefs(items: readonly InvalidRuleRefItem[]): string[] {
  if (items.length === 0) {
    return ['- なし'];
  }
  return [
    '| atom | label | ruleRef |',
    '|---|---|---|',
    ...items.map((item) => `| ${cell(item.atom)} | ${cell(item.label)} | ${cell(item.ruleRef)} |`),
  ];
}

function renderLineCases(cases: readonly LineCase[]): string[] {
  if (cases.length === 0) {
    return ['- なし'];
  }
  return cases
    .slice(0, TOP_CASE_LIMIT)
    .map(
      (item) =>
        `- ${cell(item.status)} / ${cell(item.shape)} / face ${item.faceIndex} / ${cell(item.blockers.join(',') || '-')} / 《${cell(item.cardName)}》: ${cell(snippet(item.text, 180))}`,
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
