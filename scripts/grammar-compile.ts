import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  splitAbilityLines,
  type AbilityLine,
  type AbilityShape,
} from '../src/engine/grammar/index.ts';
import { parseAbilityIR, type AbilityIR } from '../src/engine/grammar/ir.ts';
import {
  compileAbilityIR,
  type AutoDecision,
  type CompiledEffect,
} from '../src/engine/grammar/compile.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/grammar-compile/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/grammar-compile/report.json');
const TOP_CASE_LIMIT = 20;

const NOTE =
  'この数値は未調整(候補分布であり絶対正解でない)。G2 は G1 full 行のうち安全に自動実行できる候補分布。';
const G1_FRONTIER_NOTE = 'G1 IR 表現フロンティア sanity anchor: full/effect line rate 58.11%。';

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
  fullLineCount: number;
  autoFullLineCount: number;
  atomOccurrenceCount: number;
}

interface FrontierSummaryItem {
  shape: AbilityShape | 'overall';
  label: string;
  lineCount: number;
  fullLineCount: number;
  autoFullLineCount: number;
  manualFullLineCount: number;
  autoRate: number;
}

interface AtomSummaryItem {
  atom: string;
  occurrenceCount: number;
  autoLineCount: number;
  manualLineCount: number;
}

interface ReasonSummaryItem {
  reason: string;
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
  decision: AutoDecision;
  reasons: string[];
  commandsCount: number;
  text: string;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const shapeLineCounts = new Map<AbilityShape, number>();
  const shapeFullCounts = new Map<AbilityShape, number>();
  const shapeAutoCounts = new Map<AbilityShape, number>();
  const atomCounts = new Map<string, number>();
  const atomAutoLineCounts = new Map<string, number>();
  const atomManualLineCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  const autoCandidates: LineCase[] = [];
  const mappingFailures: MappingFailure[] = [];

  let mappedCards = 0;
  let abilityLineCount = 0;
  let effectLineCount = 0;
  let fullLineCount = 0;
  let autoFullLineCount = 0;
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
      const compiled = compileAbilityIR(ir, { sourceId: 'analysis-source', def });

      abilityLineCount += 1;
      increment(shapeLineCounts, ir.shape);
      if (ir.effects.length > 0) {
        effectLineCount += 1;
        atomOccurrenceCount += ir.effects.length;
      }
      for (const effect of ir.effects) {
        increment(atomCounts, effect.atom);
      }

      if (ir.status !== 'full') {
        continue;
      }

      fullLineCount += 1;
      increment(shapeFullCounts, ir.shape);
      for (const reason of compiled.reasons) {
        increment(reasonCounts, reason);
      }

      if (compiled.decision === 'auto') {
        autoFullLineCount += 1;
        increment(shapeAutoCounts, ir.shape);
        incrementAtoms(atomAutoLineCounts, ir);
        autoCandidates.push(lineCase(line, ir, compiled, typeLine, cardName, oracleId, scryfallId));
      } else {
        incrementAtoms(atomManualLineCounts, ir);
      }
    }
  }

  const totals: Totals = {
    rawCards: rawCards.length,
    mappedCards,
    mappingFailures: mappingFailures.length,
    abilityLineCount,
    effectLineCount,
    fullLineCount,
    autoFullLineCount,
    atomOccurrenceCount,
  };
  const frontierSummary = buildFrontierSummary(
    shapeLineCounts,
    shapeFullCounts,
    shapeAutoCounts,
    totals,
  );
  const atomSummary = buildAtomSummary(atomCounts, atomAutoLineCounts, atomManualLineCounts);
  const reasonSummary = buildReasonSummary(reasonCounts, totals);
  const rankedAutoCandidates = rankLineCases(autoCandidates);

  const reportJson = {
    note: NOTE,
    generatedAt,
    inputPath: relative(process.cwd(), INPUT_PATH),
    totals,
    frontierSummary,
    atomSummary,
    reasonSummary,
    autoCandidatesTop: rankedAutoCandidates.slice(0, TOP_CASE_LIMIT),
    mappingFailuresTop: mappingFailures.slice(0, TOP_CASE_LIMIT),
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdownReport({
      generatedAt,
      totals,
      frontierSummary,
      atomSummary,
      reasonSummary,
      autoCandidates: rankedAutoCandidates,
      mappingFailures,
    }),
    'utf8',
  );

  console.log(`Grammar compile report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw summary written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${totals.rawCards} mapped=${totals.mappedCards} mappingFailures=${totals.mappingFailures} abilityLines=${totals.abilityLineCount} effectLines=${totals.effectLineCount} full=${totals.fullLineCount} auto=${totals.autoFullLineCount}`,
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
  compiled: CompiledEffect,
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
    decision: compiled.decision,
    reasons: compiled.reasons,
    commandsCount: compiled.commands.length,
    text: line.text,
  };
}

function increment<Key extends string>(counts: Map<Key, number>, id: Key): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function incrementAtoms(counts: Map<string, number>, ir: AbilityIR): void {
  for (const atom of new Set(ir.effects.map((effect) => effect.atom))) {
    increment(counts, atom);
  }
}

function buildFrontierSummary(
  shapeLineCounts: Map<AbilityShape, number>,
  shapeFullCounts: Map<AbilityShape, number>,
  shapeAutoCounts: Map<AbilityShape, number>,
  totals: Totals,
): FrontierSummaryItem[] {
  const overall = {
    shape: 'overall' as const,
    label: '全体',
    lineCount: totals.abilityLineCount,
    fullLineCount: totals.fullLineCount,
    autoFullLineCount: totals.autoFullLineCount,
    manualFullLineCount: totals.fullLineCount - totals.autoFullLineCount,
    autoRate: rate(totals.autoFullLineCount, totals.fullLineCount),
  };
  const byShape = SHAPE_ORDER.map((shape) => {
    const full = shapeFullCounts.get(shape) ?? 0;
    const auto = shapeAutoCounts.get(shape) ?? 0;
    return {
      shape,
      label: SHAPE_LABELS.get(shape) ?? shape,
      lineCount: shapeLineCounts.get(shape) ?? 0,
      fullLineCount: full,
      autoFullLineCount: auto,
      manualFullLineCount: full - auto,
      autoRate: rate(auto, full),
    };
  });
  return [overall, ...byShape];
}

function buildAtomSummary(
  atomCounts: Map<string, number>,
  atomAutoLineCounts: Map<string, number>,
  atomManualLineCounts: Map<string, number>,
): AtomSummaryItem[] {
  return [...atomCounts.entries()]
    .map(([atom, occurrenceCount]) => ({
      atom,
      occurrenceCount,
      autoLineCount: atomAutoLineCounts.get(atom) ?? 0,
      manualLineCount: atomManualLineCounts.get(atom) ?? 0,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.atom.localeCompare(b.atom));
}

function buildReasonSummary(
  reasonCounts: Map<string, number>,
  totals: Totals,
): ReasonSummaryItem[] {
  return [...reasonCounts.entries()]
    .map(([reason, lineCount]) => ({
      reason,
      lineCount,
      lineRate: rate(lineCount, totals.fullLineCount),
    }))
    .sort((a, b) => b.lineCount - a.lineCount || a.reason.localeCompare(b.reason));
}

function rankLineCases(cases: readonly LineCase[]): LineCase[] {
  return [...cases].sort((a, b) => {
    const shapeDiff = compareShape(a.shape, b.shape);
    if (shapeDiff !== 0) {
      return shapeDiff;
    }
    const commandDiff = b.commandsCount - a.commandsCount;
    if (commandDiff !== 0) {
      return commandDiff;
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
  frontierSummary: FrontierSummaryItem[];
  atomSummary: AtomSummaryItem[];
  reasonSummary: ReasonSummaryItem[];
  autoCandidates: LineCase[];
  mappingFailures: MappingFailure[];
}): string {
  const lines: string[] = [
    '# 文法コンパイル分析 Phase G2 レポート',
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
    `- G1 full 行数: ${input.totals.fullLineCount}`,
    `- G2 auto full 行数: ${input.totals.autoFullLineCount}`,
    `- アトム出現数: ${input.totals.atomOccurrenceCount}`,
    '',
    '### 写像失敗 top-N',
    '',
    ...renderMappingFailures(input.mappingFailures),
    '',
    '## 2. executable frontier',
    '',
    G1_FRONTIER_NOTE,
    '',
    '| shape | label | line count | G1 full | G2 auto | G2 manual | auto/full rate |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...input.frontierSummary.map(
      (item) =>
        `| ${cell(item.shape)} | ${cell(item.label)} | ${item.lineCount} | ${item.fullLineCount} | ${item.autoFullLineCount} | ${item.manualFullLineCount} | ${percent(item.autoRate)} |`,
    ),
    '',
    '## 3. atom 別内訳',
    '',
    '| atom | occurrence count | auto full lines | manual full lines |',
    '|---|---:|---:|---:|',
    ...input.atomSummary
      .slice(0, TOP_CASE_LIMIT)
      .map(
        (item) =>
          `| ${cell(item.atom)} | ${item.occurrenceCount} | ${item.autoLineCount} | ${item.manualLineCount} |`,
      ),
    '',
    '### reasons 分布',
    '',
    '| reason | full line count | full line rate |',
    '|---|---:|---:|',
    ...renderReasonSummary(input.reasonSummary),
    '',
    '## 4. 自動実行候補 top-N',
    '',
    ...renderLineCases(input.autoCandidates),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderReasonSummary(items: readonly ReasonSummaryItem[]): string[] {
  if (items.length === 0) {
    return ['| - | 0 | 0.00% |'];
  }
  return items
    .slice(0, TOP_CASE_LIMIT)
    .map((item) => `| ${cell(item.reason)} | ${item.lineCount} | ${percent(item.lineRate)} |`);
}

function renderLineCases(cases: readonly LineCase[]): string[] {
  if (cases.length === 0) {
    return ['- なし'];
  }
  return cases
    .slice(0, TOP_CASE_LIMIT)
    .map(
      (item) =>
        `- ${cell(item.shape)} / commands ${item.commandsCount} / face ${item.faceIndex} / 《${cell(item.cardName)}》: ${cell(snippet(item.text, 180))}`,
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
