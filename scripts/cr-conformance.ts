import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall.ts';
import type { CardDef } from '../src/types/card.ts';
import {
  CR_CONFORMANCE_THRESHOLD,
  aggregateConformance,
  compareGoldEntry,
  type CrAxis,
  type CrConformanceResult,
  type CrGoldEntry,
} from './lib/crConformance.ts';
import { classifyCardEvents } from './lib/eventClassify.ts';
import { classifyCardLayers } from './lib/layerClassify.ts';
import { classifyCardTiming } from './lib/timingClassify.ts';
import { classifyCardZones } from './lib/zoneClassify.ts';

const execFileAsync = promisify(execFile);
const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const GOLD_PATH = resolve(process.cwd(), 'research/cr-conformance/gold.json');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/cr-conformance/report.json');
const REPORT_MD_PATH = resolve(process.cwd(), 'research/cr-conformance/report.md');

interface CrMismatch {
  oracleId: string;
  cardName: string;
  axis: CrAxis;
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  crRule: string;
}

interface CrReport {
  generatedAt: string;
  inputPath: string;
  goldPath: string;
  threshold: number;
  summary: {
    totalCards: number;
    inScope: number;
    scopeBoundary: number;
    conformant: number;
    divergent: number;
    conformanceRate: number;
    bounded: boolean;
    churnBaselineCommit: string;
  };
  perAxis: CrConformanceResult['perAxis'];
  mismatches: CrMismatch[];
}

async function main(): Promise<void> {
  const [snapshotPayload, goldPayload, churnBaselineCommit] = await Promise.all([
    readJson(INPUT_PATH),
    readJson(GOLD_PATH),
    readHeadCommit(),
  ]);
  const rawCards = extractRawCards(snapshotPayload);
  const gold = parseGoldEntries(goldPayload);
  const cardsByOracleId = buildCardIndex(rawCards);
  const evaluated = [];
  const mismatches: CrMismatch[] = [];

  for (const entry of gold) {
    const def = cardsByOracleId.get(entry.oracleId);
    if (!def) {
      throw new Error(
        `Gold entry ${entry.oracleId} (${entry.cardName}) was not found in the snapshot.`,
      );
    }

    const actual = classifyAxis(def, entry.axis);
    const comparison = compareGoldEntry(entry.expected, actual);
    evaluated.push({
      axis: entry.axis,
      conformant: comparison.conformant,
      scopeBoundary: entry.scopeBoundary === true,
      hasAllowance: entry.allowance !== undefined,
    });

    if (!comparison.conformant) {
      mismatches.push({
        oracleId: entry.oracleId,
        cardName: entry.cardName,
        axis: entry.axis,
        expected: entry.expected,
        actual,
        missing: comparison.missing,
        extra: comparison.extra,
        crRule: entry.crRule,
      });
    }
  }

  const result = aggregateConformance(evaluated, CR_CONFORMANCE_THRESHOLD);
  const report: CrReport = {
    generatedAt: new Date().toISOString(),
    inputPath: relative(process.cwd(), INPUT_PATH),
    goldPath: relative(process.cwd(), GOLD_PATH),
    threshold: CR_CONFORMANCE_THRESHOLD,
    summary: {
      totalCards: result.total,
      inScope: result.inScope,
      scopeBoundary: result.scopeBoundary,
      conformant: result.conformant,
      divergent: result.divergent,
      conformanceRate: result.conformanceRate,
      bounded: result.bounded,
      churnBaselineCommit,
    },
    perAxis: result.perAxis,
    mismatches,
  };

  await mkdir(dirname(REPORT_JSON_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdown(report), 'utf8');

  console.log(`CR conformance report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw report written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${result.total} inScope=${result.inScope} conformant=${result.conformant} divergent=${result.divergent} rate=${percent(result.conformanceRate)} bounded=${result.bounded}`,
  );
}

function classifyAxis(def: CardDef, axis: CrAxis): string[] {
  switch (axis) {
    case 'layer':
      return classifyCardLayers(def).layers;
    case 'event-family':
      return classifyCardEvents(def).families;
    case 'zone-transition':
      return classifyCardZones(def).zones;
    case 'timing':
      return classifyCardTiming(def).junctures;
  }
}

function buildCardIndex(rawCards: unknown[]): Map<string, CardDef> {
  const cards = new Map<string, CardDef>();
  for (const [index, rawCard] of rawCards.entries()) {
    if (!isRecord(rawCard)) {
      throw new Error(`Snapshot card at index ${index} is not an object.`);
    }
    const scryfallCard = rawCard as unknown as ScryfallCard;
    const def = mapScryfallCardToCardDef(scryfallCard);
    const oracleId = readString(rawCard, 'oracle_id') ?? readString(rawCard, 'id');
    if (!oracleId) {
      throw new Error(`Snapshot card at index ${index} has no oracle_id or id.`);
    }
    cards.set(oracleId, def);
  }
  return cards;
}

async function readHeadCommit(): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const commit = stdout.trim();
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error(`git rev-parse HEAD returned an invalid commit: ${commit}`);
  }
  return commit;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function extractRawCards(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.cards)) return payload.cards;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new Error('Snapshot JSON must be an array or contain a cards/data array.');
}

function parseGoldEntries(payload: unknown): CrGoldEntry[] {
  if (!Array.isArray(payload)) {
    throw new Error('CR conformance gold must be a JSON array.');
  }
  return payload.map((value, index) => parseGoldEntry(value, index));
}

function parseGoldEntry(value: unknown, index: number): CrGoldEntry {
  if (!isRecord(value)) {
    throw new Error(`Gold entry ${index} must be an object.`);
  }
  const axis = value.axis;
  if (!isCrAxis(axis)) {
    throw new Error(`Gold entry ${index} has an invalid axis.`);
  }
  const expected = readStringArray(value.expected);
  if (!expected) {
    throw new Error(`Gold entry ${index} has an invalid expected array.`);
  }
  const allowance = value.allowance;
  if (allowance !== undefined && !isAllowance(allowance)) {
    throw new Error(`Gold entry ${index} has an invalid allowance.`);
  }

  return {
    oracleId: requireString(value, 'oracleId', index),
    cardName: requireString(value, 'cardName', index),
    oracleText: requireString(value, 'oracleText', index),
    axis,
    expected,
    crRule: requireString(value, 'crRule', index),
    rationale: requireString(value, 'rationale', index),
    ...(value.scopeBoundary === true ? { scopeBoundary: true } : {}),
    ...(allowance === undefined ? {} : { allowance }),
  };
}

function renderMarkdown(report: CrReport): string {
  const summary = report.summary;
  const lines = [
    '# CR Conformance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Gold cards: ${summary.totalCards}`,
    `- In scope: ${summary.inScope}`,
    `- Scope boundary: ${summary.scopeBoundary}`,
    `- Conformant: ${summary.conformant}`,
    `- Divergent: ${summary.divergent}`,
    `- Conformance rate: ${percent(summary.conformanceRate)}`,
    `- Bounded: ${summary.bounded ? 'yes' : 'no'}`,
    `- Threshold: ${percent(report.threshold)}`,
    `- Churn baseline commit: \`${summary.churnBaselineCommit}\``,
    '',
    '## Per-axis',
    '',
    '| Axis | In scope | Conformant | Divergent | Rate |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.perAxis).map(([axis, item]) => {
      const rate = item.inScope === 0 ? 0 : item.conformant / item.inScope;
      return `| ${axis} | ${item.inScope} | ${item.conformant} | ${item.divergent} | ${percent(rate)} |`;
    }),
    '',
    '## Mismatches',
    '',
    '| Card | Axis | Expected | Actual | Missing | Extra | CR |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.mismatches.map(
      (item) =>
        `| 《${cell(item.cardName)}》 | ${item.axis} | ${cell(item.expected.join(', '))} | ${cell(item.actual.join(', '))} | ${cell(item.missing.join(', '))} | ${cell(item.extra.join(', '))} | ${cell(item.crRule)} |`,
    ),
    '',
  ];

  if (report.mismatches.length === 0) {
    lines.splice(lines.length - 1, 0, '| none | - | - | - | - | - | - |');
  }
  return `${lines.join('\n')}\n`;
}

function isCrAxis(value: unknown): value is CrAxis {
  return (
    value === 'layer' ||
    value === 'event-family' ||
    value === 'zone-transition' ||
    value === 'timing'
  );
}

function isAllowance(value: unknown): value is { crRule: string; rationale: string } {
  return (
    isRecord(value) &&
    typeof value.crRule === 'string' &&
    value.crRule.trim() !== '' &&
    typeof value.rationale === 'string' &&
    value.rationale.trim() !== ''
  );
}

function requireString(value: Record<string, unknown>, key: string, index: number): string {
  const field = readString(value, key);
  if (!field) {
    throw new Error(`Gold entry ${index} requires non-empty ${key}.`);
  }
  return field;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === 'string' && field.trim() !== '' ? field : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
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
