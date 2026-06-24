import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import type { ObserverScope } from './lib/eventClassify.ts';
import {
  CAST_TIMINGS,
  TIMING_STEPS,
  type CastTiming,
  type TimingStep,
} from './lib/timingClassify.ts';
import {
  computeTimingReport,
  type TimingCardDiff,
  type TimingFacts,
  type TimingOracleReport,
} from './lib/timingOracleHarness.ts';

const SAMPLE_PATH = resolve(process.cwd(), 'research/timing-oracle/sample.json');
const PREDICTIONS_PATH = resolve(
  process.cwd(),
  'research/timing-oracle/predictions.json',
);
const COVERAGE_REPORT_PATH = resolve(
  process.cwd(),
  'research/timing-coverage/report.json',
);
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/timing-oracle/report.json');
const REPORT_MD_PATH = resolve(process.cwd(), 'research/timing-oracle/report.md');

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'any',
  'controlled-set',
  'opponent',
  'self',
  'unknown',
];

const GOLD_SPECS: readonly GoldSpec[] = [
  timingGold('Phyrexian Arena', ['upkeep'], ['self'], ['none']),
  timingGold('Bitterblossom', ['upkeep'], ['self'], ['none']),
  timingGold('Court of Grace', ['upkeep'], ['self'], ['none']),
  timingGold('Sulfuric Vortex', ['upkeep'], ['any'], ['none']),
  timingGold('Goblin Rabblemaster', ['begin-combat'], ['self'], ['none']),
  timingGold('Wilderness Reclamation', ['end-step'], ['self'], ['none']),
  timingGold('Seedborn Muse', ['untap'], ['opponent'], ['none']),
  timingGold('Dictate of Kruphix', ['draw'], ['any'], ['flash']),
  timingGold('Sword of Feast and Famine', [], [], ['none']),
  timingGold('Aggravated Assault', [], [], ['sorcery-speed']),
  timingGold('Seedtime', [], [], ['your-turn-only']),
  timingGold('Leyline of Anticipation', [], [], ['flash']),
  timingGold('Sol Ring', [], [], ['none']),
  timingGold('Llanowar Elves', [], [], ['none']),
  timingGold('Approach of the Second Sun', [], [], ['none']),
  timingGold('Grizzly Bears', [], [], ['none']),
];

interface GoldSpec {
  name: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface GoldCard {
  oracleId: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface SampleCard {
  oracleId: string;
  name: string;
  oracleText: string;
  bucket: string;
}

interface TimingPrediction {
  oracleId: string;
  name: string;
  facts: TimingFacts;
}

interface PredictionsJson {
  model: string;
  generatedAt: string;
  promptHash: string;
  predictions: TimingPrediction[];
}

async function main(): Promise<void> {
  const sample = coerceSample(await readJson(SAMPLE_PATH));
  const coverage = coerceCoverage(await readJson(COVERAGE_REPORT_PATH));
  const predictionsPayload = coercePredictions(await readJson(PREDICTIONS_PATH));
  const predictions = orderAndValidatePredictions(
    sample,
    predictionsPayload.predictions,
  );
  const { gold, unresolvedGold } = resolveGold(
    GOLD_SPECS,
    coverage,
    predictions,
  );
  const report = computeTimingReport(coverage, predictions, gold);

  await mkdir(dirname(REPORT_JSON_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdown(report, predictionsPayload, unresolvedGold),
    'utf8',
  );
  console.log(`Timing oracle report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw report written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `sampleSize=${report.sampleSize} comparedCount=${report.comparedCount} discrepancies=${report.discrepancies.length}`,
  );
}

function timingGold(
  name: string,
  junctures: TimingStep[],
  junctureScope: ObserverScope[],
  castTiming: CastTiming[],
): GoldSpec {
  return { name, junctures, junctureScope, castTiming };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function coerceSample(value: unknown): SampleCard[] {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Timing oracle sample must contain cards[].');
  }
  const cards = value.cards.map((card) => {
    if (!isRecord(card)) {
      return undefined;
    }
    const oracleId = readString(card.oracleId);
    const name = readString(card.name);
    const oracleText = typeof card.oracleText === 'string' ? card.oracleText : undefined;
    const bucket = readString(card.bucket);
    return oracleId && name && oracleText !== undefined && bucket
      ? { oracleId, name, oracleText, bucket }
      : undefined;
  });
  if (!cards.every((card): card is SampleCard => Boolean(card))) {
    throw new Error('Timing oracle sample contains an invalid card.');
  }
  return cards;
}

function coerceCoverage(value: unknown): CoverageCard[] {
  if (!isRecord(value) || !Array.isArray(value.cards)) {
    throw new Error('Timing coverage report must contain cards[].');
  }
  const cards = value.cards.map(coerceCoverageCard);
  if (!cards.every((card): card is CoverageCard => Boolean(card))) {
    throw new Error('Timing coverage report contains an invalid card.');
  }
  return cards;
}

function coerceCoverageCard(value: unknown): CoverageCard | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const oracleId = readString(value.oracleId);
  const name = readString(value.name);
  if (
    !oracleId ||
    !name ||
    !isTimingStepArray(value.junctures) ||
    !isObserverScopeArray(value.junctureScope) ||
    !isCastTimingArray(value.castTiming)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    junctures: value.junctures,
    junctureScope: value.junctureScope,
    castTiming: value.castTiming,
  };
}

function coercePredictions(value: unknown): PredictionsJson {
  if (
    !isRecord(value) ||
    !readString(value.model) ||
    !readString(value.generatedAt) ||
    !readString(value.promptHash) ||
    !Array.isArray(value.predictions)
  ) {
    throw new Error('Invalid timing predictions envelope.');
  }
  const predictions = value.predictions.map(coercePrediction);
  if (!predictions.every((item): item is TimingPrediction => Boolean(item))) {
    throw new Error('Timing predictions contain an invalid entry.');
  }
  return {
    model: value.model as string,
    generatedAt: value.generatedAt as string,
    promptHash: value.promptHash as string,
    predictions,
  };
}

function coercePrediction(value: unknown): TimingPrediction | undefined {
  if (!isRecord(value) || !isRecord(value.facts)) {
    return undefined;
  }
  const oracleId = readString(value.oracleId);
  const name = readString(value.name);
  const facts = value.facts;
  if (
    !oracleId ||
    !name ||
    !isTimingStepArray(facts.junctures) ||
    !isObserverScopeArray(facts.junctureScope) ||
    !isCastTimingArray(facts.castTiming) ||
    !isStringArray(facts.uncertain)
  ) {
    return undefined;
  }
  return {
    oracleId,
    name,
    facts: {
      junctures: facts.junctures,
      junctureScope: facts.junctureScope,
      castTiming: facts.castTiming,
      uncertain: facts.uncertain,
      ...(typeof facts.rationale === 'string' ? { rationale: facts.rationale } : {}),
    },
  };
}

function orderAndValidatePredictions(
  sample: readonly SampleCard[],
  predictions: readonly TimingPrediction[],
): TimingPrediction[] {
  const byId = new Map<string, TimingPrediction>();
  const duplicates: string[] = [];
  for (const prediction of predictions) {
    if (byId.has(prediction.oracleId)) {
      duplicates.push(prediction.oracleId);
    }
    byId.set(prediction.oracleId, prediction);
  }
  const sampleIds = new Set(sample.map((card) => card.oracleId));
  const missing = sample.filter((card) => !byId.has(card.oracleId));
  const extra = predictions.filter((prediction) => !sampleIds.has(prediction.oracleId));
  if (duplicates.length > 0 || missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Prediction/sample mismatch: duplicates=${duplicates.length} missing=${missing.length} extra=${extra.length}`,
    );
  }
  return sample.map((card) => {
    const prediction = byId.get(card.oracleId);
    if (!prediction) {
      throw new Error(`Missing prediction: ${card.oracleId}`);
    }
    return prediction;
  });
}

function resolveGold(
  specs: readonly GoldSpec[],
  coverage: readonly CoverageCard[],
  predictions: readonly TimingPrediction[],
): { gold: GoldCard[]; unresolvedGold: string[] } {
  const idsByName = new Map<string, string>();
  for (const card of coverage) {
    if (!idsByName.has(card.name)) {
      idsByName.set(card.name, card.oracleId);
    }
  }
  for (const prediction of predictions) {
    if (!idsByName.has(prediction.name)) {
      idsByName.set(prediction.name, prediction.oracleId);
    }
  }

  const gold: GoldCard[] = [];
  const unresolvedGold: string[] = [];
  for (const spec of specs) {
    const oracleId = idsByName.get(spec.name);
    if (!oracleId) {
      unresolvedGold.push(spec.name);
    } else {
      gold.push({
        oracleId,
        junctures: spec.junctures,
        junctureScope: spec.junctureScope,
        castTiming: spec.castTiming,
      });
    }
  }
  return { gold, unresolvedGold };
}

function renderMarkdown(
  report: TimingOracleReport,
  predictions: PredictionsJson,
  unresolvedGold: readonly string[],
): string {
  return `${[
    '# Timing Oracle Report',
    '',
    `- Model: ${predictions.model}`,
    `- Generated at: ${predictions.generatedAt}`,
    `- Prompt hash: \`${predictions.promptHash}\``,
    `- Sample size: ${report.sampleSize}`,
    `- Compared count: ${report.comparedCount}`,
    `- Juncture discrepancy rate: ${percent(report.junctureDiscrepancyRate)}`,
    `- Juncture-scope discrepancy rate: ${percent(report.junctureScopeDiscrepancyRate)}`,
    `- Cast-timing discrepancy rate: ${percent(report.castTimingDiscrepancyRate)}`,
    `- Unverifiable rate: ${percent(report.unverifiableRate)}`,
    '',
    '## Gold calibration',
    '',
    `- Unresolved gold: ${unresolvedGold.length > 0 ? unresolvedGold.join(', ') : 'none'}`,
    '',
    '| step | precision | recall | support |',
    '|---|---:|---:|---:|',
    ...report.goldCalibration.map(
      (item) =>
        `| ${item.step} | ${percent(item.precision)} | ${percent(item.recall)} | ${item.support} |`,
    ),
    '',
    '## Discrepancy clusters',
    '',
    ...(report.clusters.length > 0
      ? report.clusters.map(
          (cluster) =>
            `- \`${cluster.signature}\`: ${cluster.count} (${cluster.examples.join(', ')})`,
        )
      : ['- none']),
    '',
    '## Discrepancies',
    '',
    ...(report.discrepancies.length > 0
      ? report.discrepancies.map(renderDiff)
      : ['- none']),
    '',
  ].join('\n')}\n`;
}

function renderDiff(diff: TimingCardDiff): string {
  return `- 《${escapeMarkdown(diff.name)}》 \`${diff.deltaSignature}\` (juncture=${diff.junctureAgree ? 'agree' : 'diff'}, scope=${diff.scopeAgree ? 'agree' : 'diff'}, cast=${diff.castTimingAgree ? 'agree' : 'diff'}, uncertain=${diff.hasUncertain})`;
}

function isTimingStepArray(value: unknown): value is TimingStep[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'string' && TIMING_STEPS.includes(item as TimingStep),
    )
  );
}

function isObserverScopeArray(value: unknown): value is ObserverScope[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        OBSERVER_SCOPES.includes(item as ObserverScope),
    )
  );
}

function isCastTimingArray(value: unknown): value is CastTiming[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'string' && CAST_TIMINGS.includes(item as CastTiming),
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
