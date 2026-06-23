import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { EVENT_FAMILIES, type EventFamily, type ObserverScope } from './lib/eventClassify.ts';
import {
  computeEventReport,
  type EventCardDiff,
  type EventFacts,
  type EventOracleReport,
} from './lib/eventOracleHarness.ts';

const SAMPLE_PATH = resolve(process.cwd(), 'research/event-oracle/sample.json');
const PREDICTIONS_PATH = resolve(process.cwd(), 'research/event-oracle/predictions.json');
const COVERAGE_REPORT_PATH = resolve(process.cwd(), 'research/event-coverage/report.json');
const ADJUDICATION_PATH = resolve(process.cwd(), 'research/event-oracle/adjudication.json');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/event-oracle/report.json');
const REPORT_MD_PATH = resolve(process.cwd(), 'research/event-oracle/report.md');

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'self',
  'opponent',
  'any',
  'controlled-set',
  'unknown',
];

const GOLD_SPECS: readonly GoldSpec[] = [
  {
    name: 'Solemn Simulacrum',
    families: ['dies', 'enters'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Grave Pact',
    families: ['dies'],
    observers: ['controlled-set'],
    hasInterveningIf: false,
  },
  {
    name: 'Smothering Tithe',
    families: ['draw'],
    observers: ['opponent'],
    hasInterveningIf: false,
  },
  {
    name: 'Guttersnipe',
    families: ['cast'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Bitterblossom',
    families: ['phase'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Necropotence',
    families: ['discard'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Mentor of the Meek',
    families: ['enters'],
    observers: ['controlled-set'],
    hasInterveningIf: false,
  },
  {
    name: 'Court of Grace',
    families: ['enters', 'phase'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Felidar Guardian',
    families: ['enters'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Acclaimed Contender',
    families: ['enters'],
    observers: ['self'],
    hasInterveningIf: true,
  },
  {
    name: 'Adrenaline Jockey',
    families: ['cast', 'other'],
    observers: ['any', 'self'],
    hasInterveningIf: true,
  },
  {
    name: 'Agent of Treachery',
    families: ['enters', 'phase'],
    observers: ['self'],
    hasInterveningIf: true,
  },
  {
    name: 'Morbid Opportunist',
    families: ['dies'],
    observers: ['any'],
    hasInterveningIf: false,
  },
  {
    name: 'Evolution Witness',
    families: ['counter'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Nalfeshnee',
    families: ['cast'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: 'Poison-Tip Archer',
    families: ['dies'],
    observers: ['any'],
    hasInterveningIf: false,
  },
  {
    name: 'Sram, Senior Edificer',
    families: ['cast'],
    observers: ['self'],
    hasInterveningIf: false,
  },
  {
    name: "Gaea's Anthem",
    families: [],
    observers: [],
    hasInterveningIf: false,
  },
];

const ATTRIBUTIONS: readonly Attribution[] = ['substrate', 'compiler', 'oracle', 'ambiguous'];

type Attribution = 'substrate' | 'compiler' | 'oracle' | 'ambiguous';
type AttributionKey = Attribution | 'null';
type AttributionDistribution = Record<AttributionKey, number>;

interface GoldSpec {
  name: string;
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
}

interface GoldCard {
  oracleId: string;
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
}

interface CoverageReport {
  cards: CoverageCard[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
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
  predictions: EventPrediction[];
}

interface EventPrediction {
  oracleId: string;
  name: string;
  facts: EventFacts;
}

interface EventCardDiffWithAttribution extends Omit<EventCardDiff, 'attribution'> {
  attribution: Attribution | null;
}

interface EventOracleReportWithAttribution extends Omit<EventOracleReport, 'discrepancies'> {
  discrepancies: EventCardDiffWithAttribution[];
  attributionDistribution: AttributionDistribution;
}

async function main(): Promise<void> {
  const sample = coerceSample(await readJson(SAMPLE_PATH));
  const predictionsPayload = coercePredictions(await readJson(PREDICTIONS_PATH));
  const coverageReport = coerceCoverageReport(await readJson(COVERAGE_REPORT_PATH));
  const adjudications = await readAdjudicationAttributions(ADJUDICATION_PATH);
  const predictions = orderAndValidatePredictions(sample.cards, predictionsPayload.predictions);
  const { gold, unresolvedGold } = resolveGoldCards(GOLD_SPECS, coverageReport.cards);
  const report = applyAttributions(
    computeEventReport(coverageReport.cards, predictions, gold),
    adjudications,
  );

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

  console.log(`Event oracle report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
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
  report: EventOracleReport,
  adjudications: ReadonlyMap<string, Attribution>,
): EventOracleReportWithAttribution {
  const discrepancies = report.discrepancies.map<EventCardDiffWithAttribution>((diff) => ({
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
  discrepancies: readonly EventCardDiffWithAttribution[],
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
  predictions: readonly EventPrediction[],
): EventPrediction[] {
  const predictionByOracleId = new Map<string, EventPrediction>();
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
      families: sortFamilies(spec.families),
      observers: sortObservers(spec.observers),
      hasInterveningIf: spec.hasInterveningIf,
    });
  }
  return { gold, unresolvedGold };
}

function renderMarkdown(input: {
  report: EventOracleReportWithAttribution;
  predictionsPayload: PredictionsJson;
  unresolvedGold: readonly string[];
}): string {
  const { report } = input;
  const lines: string[] = [
    '# Event Oracle Report',
    '',
    '## Summary',
    '',
    `- model: ${cell(input.predictionsPayload.model)}`,
    `- generatedAt: ${cell(input.predictionsPayload.generatedAt)}`,
    `- promptHash: ${cell(input.predictionsPayload.promptHash)}`,
    `- sampleSize: ${report.sampleSize}`,
    `- comparedCount: ${report.comparedCount}`,
    `- familyDiscrepancyRate: ${percent(report.familyDiscrepancyRate)}`,
    `- observerDiscrepancyRate: ${percent(report.observerDiscrepancyRate)}`,
    `- interveningIfDiscrepancyRate: ${percent(report.interveningIfDiscrepancyRate)}`,
    `- unverifiableRate: ${percent(report.unverifiableRate)}`,
    `- discrepancies: ${report.discrepancies.length}`,
    `- attributionDistribution: ${attributionDistributionSummary(report.attributionDistribution)}`,
    `- unresolvedGold: ${
      input.unresolvedGold.length > 0 ? input.unresolvedGold.map(cell).join(', ') : 'none'
    }`,
    '',
    '## Per Family Confusion',
    '',
    '| family | classifierOnly | oracleOnly | agreeBoth |',
    '|---|---:|---:|---:|',
    ...report.perFamilyConfusion.map(
      (item) => `| ${item.family} | ${item.classifierOnly} | ${item.oracleOnly} | ${item.agreeBoth} |`,
    ),
    '',
    '## Per Observer Confusion',
    '',
    '| observer | classifierOnly | oracleOnly | agreeBoth |',
    '|---|---:|---:|---:|',
    ...report.perObserverConfusion.map(
      (item) => `| ${item.observer} | ${item.classifierOnly} | ${item.oracleOnly} | ${item.agreeBoth} |`,
    ),
    '',
    '## Gold Calibration',
    '',
    '| family | precision | recall | support |',
    '|---|---:|---:|---:|',
    ...report.goldCalibration.map(
      (item) =>
        `| ${item.family} | ${percent(item.precision)} | ${percent(item.recall)} | ${item.support} |`,
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

function renderClusters(report: EventOracleReport): string[] {
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

function renderDiscrepancies(report: EventOracleReportWithAttribution): string[] {
  if (report.discrepancies.length === 0) {
    return ['- none'];
  }
  return [
    '| delta | oracleId | name | familyClassifierOnly | familyOracleOnly | observerClassifierOnly | observerOracleOnly | if | uncertain | attribution |',
    '|---|---|---|---|---|---|---|---|---:|---|',
    ...report.discrepancies.map((diff) => {
      const ifSummary = diff.classifierInterveningIf === diff.oracleInterveningIf
        ? 'agree'
        : `classifier=${diff.classifierInterveningIf}, oracle=${diff.oracleInterveningIf}`;
      return `| ${cell(diff.deltaSignature)} | ${diff.oracleId} | ${cell(diff.name)} | ${familyList(diff.familyClassifierOnly)} | ${familyList(diff.familyOracleOnly)} | ${observerList(diff.observerClassifierOnly)} | ${observerList(diff.observerOracleOnly)} | ${cell(ifSummary)} | ${diff.hasUncertain ? 'yes' : 'no'} | ${diff.attribution ?? 'null'} |`;
    }),
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
    predictions: value.predictions.map(coerceEventPrediction),
  };
}

function coerceEventPrediction(value: unknown): EventPrediction {
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
    facts: coerceEventFacts(value.facts),
  };
}

function coerceEventFacts(value: Record<string, unknown>): EventFacts {
  const families = value.families;
  const observers = value.observers;
  const hasInterveningIf = value.hasInterveningIf;
  const uncertain = value.uncertain;
  if (!Array.isArray(families) || !families.every(isEventFamily)) {
    throw new Error('Invalid families list.');
  }
  if (!Array.isArray(observers) || !observers.every(isObserverScope)) {
    throw new Error('Invalid observers list.');
  }
  if (typeof hasInterveningIf !== 'boolean') {
    throw new Error('Invalid hasInterveningIf value.');
  }
  if (!Array.isArray(uncertain) || !uncertain.every(isUncertainToken)) {
    throw new Error('Invalid uncertain token list.');
  }
  const rationale = value.rationale;
  return {
    families: sortFamilies(families),
    observers: sortObservers(observers),
    hasInterveningIf,
    uncertain: [...new Set(uncertain)].sort((a, b) => a.localeCompare(b)),
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
  const families = value.families;
  const observers = value.observers;
  const hasInterveningIf = value.hasInterveningIf;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(families) ||
    !families.every(isEventFamily) ||
    !Array.isArray(observers) ||
    !observers.every(isObserverScope) ||
    typeof hasInterveningIf !== 'boolean'
  ) {
    throw new Error('Invalid coverage card item.');
  }
  return {
    oracleId,
    name,
    families: sortFamilies(families),
    observers: sortObservers(observers),
    hasInterveningIf,
  };
}

function sortFamilies(families: readonly EventFamily[]): EventFamily[] {
  return [...new Set(families)].sort(
    (a, b) => EVENT_FAMILIES.indexOf(a) - EVENT_FAMILIES.indexOf(b),
  );
}

function sortObservers(observers: readonly ObserverScope[]): ObserverScope[] {
  return [...new Set(observers)].sort(
    (a, b) => OBSERVER_SCOPES.indexOf(a) - OBSERVER_SCOPES.indexOf(b),
  );
}

function familyList(families: readonly EventFamily[]): string {
  return families.length > 0 ? families.join(', ') : '(none)';
}

function observerList(observers: readonly ObserverScope[]): string {
  return observers.length > 0 ? observers.join(', ') : '(none)';
}

function isEventFamily(value: unknown): value is EventFamily {
  return typeof value === 'string' && EVENT_FAMILIES.includes(value as EventFamily);
}

function isObserverScope(value: unknown): value is ObserverScope {
  return typeof value === 'string' && OBSERVER_SCOPES.includes(value as ObserverScope);
}

function isUncertainToken(value: unknown): value is string {
  return isEventFamily(value) || isObserverScope(value) || value === 'hasInterveningIf';
}

function isAttribution(value: unknown): value is Attribution {
  return typeof value === 'string' && ATTRIBUTIONS.includes(value as Attribution);
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
