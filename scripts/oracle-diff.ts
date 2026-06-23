import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  FACT_KEYS,
  computeReport,
  type Attribution,
  type CardDiff,
  type FactKey,
  type OracleFacts,
  type OracleReport,
} from './lib/oracleHarness.ts';
import type { LayerId } from './lib/layerClassify.ts';

const SAMPLE_PATH = resolve(process.cwd(), 'research/llm-oracle/sample.json');
const PREDICTIONS_PATH = resolve(process.cwd(), 'research/llm-oracle/predictions.json');
const COVERAGE_REPORT_PATH = resolve(process.cwd(), 'research/layer-coverage/report.json');
const ADJUDICATION_PATH = resolve(process.cwd(), 'research/llm-oracle/adjudication.json');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/llm-oracle/report.json');
const REPORT_MD_PATH = resolve(process.cwd(), 'research/llm-oracle/report.md');

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

const GOLD_SPECS: readonly GoldSpec[] = [
  { name: "Gaea's Anthem", layers: ['L7c'], cda: false },
  { name: 'Control Magic', layers: ['L2'], cda: false },
  { name: 'Blood Moon', layers: ['L4'], cda: false },
  { name: 'Archetype of Imagination', layers: ['L6'], cda: false },
  { name: 'Giant Growth', layers: ['L7c'], cda: false },
  { name: 'Tarmogoyf', layers: ['L7a'], cda: true },
  { name: 'Darksteel Mutation', layers: ['L4', 'L6', 'L7b'], cda: false },
  { name: 'Lignify', layers: ['L4', 'L6', 'L7b'], cda: false },
  { name: 'Song of the Dryads', layers: ['L4', 'L5'], cda: false },
  { name: 'Lightning Bolt', layers: [], cda: false },
  { name: 'Llanowar Elves', layers: [], cda: false },
  { name: 'Chromatic Lantern', layers: ['L6'], cda: false },
  { name: 'Cryptolith Rite', layers: ['L6'], cda: false },
  { name: 'Purphoros, God of the Forge', layers: ['L4', 'L7c'], cda: false },
  { name: 'Heliod, Sun-Crowned', layers: ['L4', 'L6', 'L7c'], cda: false },
  { name: 'Unnatural Growth', layers: ['L7c'], cda: false },
  { name: 'Alloy Animist', layers: ['L4', 'L7b'], cda: false },
  { name: 'Cyberdrive Awakener', layers: ['L4', 'L6', 'L7b'], cda: false },
];

const ATTRIBUTIONS: readonly Attribution[] = ['substrate', 'compiler', 'oracle', 'ambiguous'];

interface GoldSpec {
  name: string;
  layers: LayerId[];
  cda: boolean;
}

type AttributionKey = Attribution | 'null';

type AttributionDistribution = Record<AttributionKey, number>;

interface OracleReportWithAttribution extends OracleReport {
  attributionDistribution: AttributionDistribution;
}

interface GoldCard {
  oracleId: string;
  layers: LayerId[];
}

interface CoverageReport {
  cards: CoverageCard[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  layers: LayerId[];
  cda: boolean;
}

interface SampleJson {
  cards: SampleCard[];
}

interface SampleCard {
  oracleId: string;
  name: string;
  oracleText: string;
  bucket: string;
}

interface PredictionsJson {
  model: string;
  generatedAt: string;
  promptHash: string;
  predictions: OraclePrediction[];
}

interface OraclePrediction {
  oracleId: string;
  name: string;
  facts: OracleFacts;
}

async function main(): Promise<void> {
  const sample = coerceSample(await readJson(SAMPLE_PATH));
  const predictionsPayload = coercePredictions(await readJson(PREDICTIONS_PATH));
  const coverageReport = coerceCoverageReport(await readJson(COVERAGE_REPORT_PATH));
  const adjudications = await readAdjudicationAttributions(ADJUDICATION_PATH);
  const predictions = orderAndValidatePredictions(sample.cards, predictionsPayload.predictions);
  const { gold, unresolvedGold } = resolveGoldCards(GOLD_SPECS, coverageReport.cards);
  const report = applyAttributions(computeReport(coverageReport.cards, predictions, gold), adjudications);

  await mkdir(dirname(REPORT_JSON_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdown({
      report,
      predictionsPayload,
      unresolvedGold,
    }),
    'utf8',
  );

  console.log(`Oracle report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw report written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `sampleSize=${report.sampleSize} comparedCount=${report.comparedCount} discrepancies=${report.discrepancies.length}`,
  );
}

async function readJson(path: string): Promise<unknown> {
  const source = await readFile(path, 'utf8');
  return JSON.parse(source) as unknown;
}

async function readAdjudicationAttributions(path: string): Promise<ReadonlyMap<string, Attribution>> {
  try {
    const source = await readFile(path, 'utf8');
    return coerceAdjudicationAttributions(JSON.parse(source) as unknown);
  } catch {
    return new Map<string, Attribution>();
  }
}

function coerceAdjudicationAttributions(value: unknown): ReadonlyMap<string, Attribution> {
  if (!isRecord(value) || !isRecord(value.cards)) {
    return new Map<string, Attribution>();
  }

  const attributions = new Map<string, Attribution>();
  for (const [oracleId, rawCard] of Object.entries(value.cards)) {
    if (!isRecord(rawCard) || !isAttribution(rawCard.attribution)) {
      continue;
    }
    attributions.set(oracleId, rawCard.attribution);
  }
  return attributions;
}

function applyAttributions(
  report: OracleReport,
  adjudications: ReadonlyMap<string, Attribution>,
): OracleReportWithAttribution {
  const discrepancies = report.discrepancies.map<CardDiff>((diff) => ({
    ...diff,
    attribution: adjudications.get(diff.oracleId) ?? null,
  }));

  return {
    ...report,
    discrepancies,
    attributionDistribution: buildAttributionDistribution(discrepancies),
  };
}

function buildAttributionDistribution(
  discrepancies: readonly CardDiff[],
): AttributionDistribution {
  const distribution = createAttributionDistribution();
  for (const diff of discrepancies) {
    distribution[diff.attribution ?? 'null'] += 1;
  }
  return distribution;
}

function createAttributionDistribution(): AttributionDistribution {
  return {
    substrate: 0,
    compiler: 0,
    oracle: 0,
    ambiguous: 0,
    null: 0,
  };
}

function orderAndValidatePredictions(
  sampleCards: readonly SampleCard[],
  predictions: readonly OraclePrediction[],
): OraclePrediction[] {
  const predictionByOracleId = new Map<string, OraclePrediction>();
  const duplicates: string[] = [];
  for (const prediction of predictions) {
    if (predictionByOracleId.has(prediction.oracleId)) {
      duplicates.push(prediction.oracleId);
    }
    predictionByOracleId.set(prediction.oracleId, prediction);
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate predictions: ${duplicates.join(', ')}`);
  }

  const sampleIds = new Set(sampleCards.map((card) => card.oracleId));
  const missing = sampleCards
    .filter((card) => !predictionByOracleId.has(card.oracleId))
    .map((card) => `${card.name} (${card.oracleId})`);
  const extra = predictions
    .filter((prediction) => !sampleIds.has(prediction.oracleId))
    .map((prediction) => `${prediction.name} (${prediction.oracleId})`);
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      [
        missing.length > 0 ? `Missing predictions: ${missing.join(', ')}` : '',
        extra.length > 0 ? `Extra predictions: ${extra.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return sampleCards.map((card) => {
    const prediction = predictionByOracleId.get(card.oracleId);
    if (!prediction) {
      throw new Error(`Missing prediction after validation: ${card.oracleId}`);
    }
    return prediction;
  });
}

function resolveGoldCards(
  goldSpecs: readonly GoldSpec[],
  coverageCards: readonly CoverageCard[],
): { gold: GoldCard[]; unresolvedGold: string[] } {
  const cardsByName = new Map<string, CoverageCard[]>();
  for (const card of coverageCards) {
    const group = cardsByName.get(card.name) ?? [];
    group.push(card);
    cardsByName.set(card.name, group);
  }
  for (const group of cardsByName.values()) {
    group.sort((a, b) => a.oracleId.localeCompare(b.oracleId));
  }

  const gold: GoldCard[] = [];
  const unresolvedGold: string[] = [];
  for (const spec of goldSpecs) {
    const card = cardsByName.get(spec.name)?.[0];
    if (!card) {
      unresolvedGold.push(spec.name);
      continue;
    }
    gold.push({
      oracleId: card.oracleId,
      layers: sortLayerIds(spec.layers),
    });
  }
  return { gold, unresolvedGold };
}

function renderMarkdown(input: {
  report: OracleReportWithAttribution;
  predictionsPayload: PredictionsJson;
  unresolvedGold: readonly string[];
}): string {
  const { report } = input;
  const lines: string[] = [
    '# LLM Oracle Report',
    '',
    '## Summary',
    '',
    `- model: ${cell(input.predictionsPayload.model)}`,
    `- generatedAt: ${cell(input.predictionsPayload.generatedAt)}`,
    `- promptHash: ${cell(input.predictionsPayload.promptHash)}`,
    `- sampleSize: ${report.sampleSize}`,
    `- comparedCount: ${report.comparedCount}`,
    `- discrepancyRate: ${percent(report.discrepancyRate)}`,
    `- unverifiableRate: ${percent(report.unverifiableRate)}`,
    `- discrepancies: ${report.discrepancies.length}`,
    `- attributionDistribution: ${attributionDistributionSummary(report.attributionDistribution)}`,
    `- unresolvedGold: ${input.unresolvedGold.length > 0 ? input.unresolvedGold.map(cell).join(', ') : 'none'}`,
    '',
    '## Per Layer Confusion',
    '',
    '| layer | classifierOnly | oracleOnly | agreeBoth |',
    '|---|---:|---:|---:|',
    ...report.perLayerConfusion.map(
      (item) => `| ${item.layer} | ${item.classifierOnly} | ${item.oracleOnly} | ${item.agreeBoth} |`,
    ),
    '',
    '## Gold Calibration',
    '',
    '| layer | precision | recall | support |',
    '|---|---:|---:|---:|',
    ...report.goldCalibration.map(
      (item) =>
        `| ${item.layer} | ${percent(item.precision)} | ${percent(item.recall)} | ${item.support} |`,
    ),
    '',
    '## Clusters',
    '',
    ...renderClusters(report),
    '',
    '## Attribution Distribution',
    '',
    ...renderAttributionDistribution(report.attributionDistribution),
    '',
    '## Discrepancies',
    '',
    ...renderDiscrepancies(report),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderClusters(report: OracleReport): string[] {
  if (report.clusters.length === 0) {
    return ['- none'];
  }
  return [
    '| signature | count | examples |',
    '|---|---:|---|',
    ...report.clusters
      .slice(0, 25)
      .map(
        (cluster) =>
          `| ${cell(cluster.signature)} | ${cluster.count} | ${cell(cluster.examples.join('; '))} |`,
      ),
  ];
}

function renderDiscrepancies(report: OracleReport): string[] {
  if (report.discrepancies.length === 0) {
    return ['- none'];
  }
  return [
    '| delta | oracleId | name | classifierOnly | oracleOnly | uncertain | attribution |',
    '|---|---|---|---|---|---:|---|',
    ...report.discrepancies.map(
      (diff) =>
        `| ${cell(diff.deltaSignature)} | ${diff.oracleId} | ${cell(diff.name)} | ${layerList(diff.classifierOnly)} | ${layerList(diff.oracleOnly)} | ${diff.hasUncertain ? 'yes' : 'no'} | ${diff.attribution ?? 'null'} |`,
    ),
  ];
}

function renderAttributionDistribution(distribution: AttributionDistribution): string[] {
  return [
    '| attribution | count |',
    '|---|---:|',
    ...attributionKeys().map((key) => `| ${key} | ${distribution[key]} |`),
  ];
}

function coerceSample(value: unknown): SampleJson {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Sample JSON must contain cards[].');
  }
  return {
    cards: value.cards.map(coerceSampleCard),
  };
}

function coerceSampleCard(value: unknown): SampleCard {
  if (!isRecord(value)) {
    throw new Error('Invalid sample card.');
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name');
  const oracleText = readStringField(value, 'oracleText');
  const bucket = readStringField(value, 'bucket');
  if (!oracleId || !name || !oracleText || !bucket) {
    throw new Error('Invalid sample card.');
  }
  return { oracleId, name, oracleText, bucket };
}

function coercePredictions(value: unknown): PredictionsJson {
  if (!isRecord(value) || !Array.isArray(value.predictions)) {
    throw new Error('Predictions JSON must contain predictions[].');
  }
  const model = readStringField(value, 'model');
  const generatedAt = readStringField(value, 'generatedAt');
  const promptHash = readStringField(value, 'promptHash');
  if (!model || !generatedAt || !promptHash) {
    throw new Error('Predictions JSON must contain model/generatedAt/promptHash.');
  }
  return {
    model,
    generatedAt,
    promptHash,
    predictions: value.predictions.map(coerceOraclePrediction),
  };
}

function coerceOraclePrediction(value: unknown): OraclePrediction {
  if (!isRecord(value)) {
    throw new Error('Invalid prediction item.');
  }
  const oracleId = readStringField(value, 'oracleId');
  const name = readStringField(value, 'name');
  if (!oracleId || !name || !isRecord(value.facts)) {
    throw new Error('Invalid prediction item.');
  }
  return {
    oracleId,
    name,
    facts: coerceOracleFacts(value.facts),
  };
}

function coerceOracleFacts(value: Record<string, unknown>): OracleFacts {
  const facts = {} as Record<FactKey, boolean>;
  for (const key of FACT_KEYS) {
    const field = value[key];
    if (typeof field !== 'boolean') {
      throw new Error(`Invalid fact value for ${key}.`);
    }
    facts[key] = field;
  }
  if (!Array.isArray(value.uncertain) || !value.uncertain.every(isFactKey)) {
    throw new Error('Invalid uncertain fact list.');
  }
  const rationale = value.rationale;
  return {
    ...facts,
    uncertain: [...new Set(value.uncertain)],
    ...(typeof rationale === 'string' ? { rationale } : {}),
  };
}

function coerceCoverageReport(value: unknown): CoverageReport {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Coverage report must contain cards[].');
  }
  return {
    cards: value.cards.map(coerceCoverageCard),
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

function layerList(layers: readonly LayerId[]): string {
  return layers.length > 0 ? layers.join(', ') : '(none)';
}

function sortLayerIds(layers: readonly LayerId[]): LayerId[] {
  return [...new Set(layers)].sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
}

function isLayerId(value: unknown): value is LayerId {
  return typeof value === 'string' && LAYER_ORDER.includes(value as LayerId);
}

function isAttribution(value: unknown): value is Attribution {
  return typeof value === 'string' && ATTRIBUTIONS.includes(value as Attribution);
}

function isFactKey(value: unknown): value is FactKey {
  return typeof value === 'string' && FACT_KEYS.includes(value as FactKey);
}

function attributionKeys(): AttributionKey[] {
  return [...ATTRIBUTIONS, 'null'];
}

function attributionDistributionSummary(distribution: AttributionDistribution): string {
  return attributionKeys()
    .map((key) => `${key}=${distribution[key]}`)
    .join(', ');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
