import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import type { ZoneId } from '../src/engine/types.ts';
import {
  OWNERSHIP_KINDS,
  PLAYER_SCOPES,
  ZONE_IDS,
  type OwnershipKind,
  type PlayerScope,
} from './lib/zoneClassify.ts';
import {
  computeZoneReport,
  type ZoneCardDiff,
  type ZoneFacts,
  type ZoneOracleReport,
} from './lib/zoneOracleHarness.ts';

const SAMPLE_PATH = resolve(process.cwd(), 'research/zone-oracle/sample.json');
const PREDICTIONS_PATH = resolve(process.cwd(), 'research/zone-oracle/predictions.json');
const COVERAGE_REPORT_PATH = resolve(process.cwd(), 'research/zone-coverage/report.json');
const ADJUDICATION_PATH = resolve(process.cwd(), 'research/zone-oracle/adjudication.json');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/zone-oracle/report.json');
const REPORT_MD_PATH = resolve(process.cwd(), 'research/zone-oracle/report.md');

const GOLD_SPECS: readonly GoldSpec[] = [
  {
    name: 'Demonic Tutor',
    zones: ['hand', 'library'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Vampiric Tutor',
    zones: ['library'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Brainstorm',
    zones: ['hand', 'library'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Regrowth',
    zones: ['graveyard', 'hand'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Cultivate',
    zones: ['battlefield', 'hand', 'library'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Eternal Witness',
    zones: ['battlefield', 'graveyard', 'hand'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Bojuka Bog',
    zones: ['battlefield', 'exile', 'graveyard'],
    crossPlayer: true,
    ownership: 'none',
    playerScopes: ['target-player'],
  },
  {
    name: 'Agonizing Remorse',
    zones: ['exile', 'graveyard', 'hand'],
    crossPlayer: true,
    ownership: 'none',
    playerScopes: ['each-opponent', 'you'],
  },
  {
    name: 'Control Magic',
    zones: [],
    crossPlayer: false,
    ownership: 'controller',
    playerScopes: ['you'],
  },
  {
    name: 'Reanimate',
    zones: ['battlefield', 'graveyard'],
    crossPlayer: false,
    ownership: 'controller',
    playerScopes: ['you'],
  },
  {
    name: 'Boomerang',
    zones: ['hand'],
    crossPlayer: false,
    ownership: 'owner',
    playerScopes: ['owner'],
  },
  {
    name: "Gaea's Anthem",
    zones: [],
    crossPlayer: false,
    ownership: 'controller',
    playerScopes: ['you'],
  },
  {
    name: 'Grizzly Bears',
    zones: [],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: [],
  },
  {
    name: 'Syphon Mind',
    zones: [],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['each-player', 'you'],
  },
  {
    name: 'Entomb',
    zones: ['graveyard', 'library'],
    crossPlayer: false,
    ownership: 'none',
    playerScopes: ['you'],
  },
  {
    name: 'Thoughtseize',
    zones: ['hand'],
    crossPlayer: true,
    ownership: 'none',
    playerScopes: ['target-player', 'you'],
  },
];

const ATTRIBUTIONS: readonly Attribution[] = ['substrate', 'compiler', 'oracle', 'ambiguous'];

type Attribution = 'substrate' | 'compiler' | 'oracle' | 'ambiguous';
type AttributionKey = Attribution | 'null';
type AttributionDistribution = Record<AttributionKey, number>;

interface GoldSpec {
  name: string;
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
}

interface GoldCard {
  oracleId: string;
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
}

interface CoverageReport {
  cards: CoverageCard[];
}

interface CoverageCard {
  oracleId: string;
  name: string;
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
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
  predictions: ZonePrediction[];
}

interface ZonePrediction {
  oracleId: string;
  name: string;
  facts: ZoneFacts;
}

interface ZoneCardDiffWithAttribution extends Omit<ZoneCardDiff, 'attribution'> {
  attribution: Attribution | null;
}

interface ZoneOracleReportWithAttribution extends Omit<ZoneOracleReport, 'discrepancies'> {
  discrepancies: ZoneCardDiffWithAttribution[];
  attributionDistribution: AttributionDistribution;
}

async function main(): Promise<void> {
  const sample = coerceSample(await readJson(SAMPLE_PATH));
  const predictionsPayload = coercePredictions(await readJson(PREDICTIONS_PATH));
  const coverageReport = coerceCoverageReport(await readJson(COVERAGE_REPORT_PATH));
  const adjudications = await readAdjudicationAttributions(ADJUDICATION_PATH);
  const predictions = orderAndValidatePredictions(sample.cards, predictionsPayload.predictions);
  const { gold, unresolvedGold } = resolveGoldCards(
    GOLD_SPECS,
    coverageReport.cards,
    predictions,
  );
  const report = applyAttributions(
    computeZoneReport(coverageReport.cards, predictions, gold),
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

  console.log(`Zone oracle report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
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
  report: ZoneOracleReport,
  adjudications: ReadonlyMap<string, Attribution>,
): ZoneOracleReportWithAttribution {
  const discrepancies = report.discrepancies.map<ZoneCardDiffWithAttribution>((diff) => ({
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
  discrepancies: readonly ZoneCardDiffWithAttribution[],
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
  predictions: readonly ZonePrediction[],
): ZonePrediction[] {
  const predictionByOracleId = new Map<string, ZonePrediction>();
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
  predictions: readonly ZonePrediction[],
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
  const predictionsByName = new Map<string, ZonePrediction[]>();
  for (const prediction of predictions) {
    const group = predictionsByName.get(prediction.name) ?? [];
    group.push(prediction);
    predictionsByName.set(prediction.name, group);
  }
  for (const group of predictionsByName.values()) {
    group.sort((a, b) => a.oracleId.localeCompare(b.oracleId));
  }

  const gold: GoldCard[] = [];
  const unresolvedGold: string[] = [];
  for (const spec of goldSpecs) {
    const card = cardsByName.get(spec.name)?.[0];
    const oracleId = card?.oracleId ?? predictionsByName.get(spec.name)?.[0]?.oracleId;
    if (!oracleId) {
      unresolvedGold.push(spec.name);
      continue;
    }
    gold.push({
      oracleId,
      zones: sortZones(spec.zones),
      crossPlayer: spec.crossPlayer,
      ownership: spec.ownership,
      playerScopes: sortScopes(spec.playerScopes),
    });
  }
  return { gold, unresolvedGold };
}

function renderMarkdown(input: {
  report: ZoneOracleReportWithAttribution;
  predictionsPayload: PredictionsJson;
  unresolvedGold: readonly string[];
}): string {
  const { report } = input;
  const crossPlayerConfusion = summarizeCrossPlayer(report.discrepancies);
  const lines: string[] = [
    '# Zone Oracle Report',
    '',
    '## Summary',
    '',
    `- model: ${cell(input.predictionsPayload.model)}`,
    `- generatedAt: ${cell(input.predictionsPayload.generatedAt)}`,
    `- promptHash: ${cell(input.predictionsPayload.promptHash)}`,
    `- sampleSize: ${report.sampleSize}`,
    `- comparedCount: ${report.comparedCount}`,
    `- zoneDiscrepancyRate: ${percent(report.zoneDiscrepancyRate)}`,
    `- crossPlayerDiscrepancyRate: ${percent(report.crossPlayerDiscrepancyRate)}`,
    `- crossPlayerClassifierOnly: ${crossPlayerConfusion.classifierOnly}`,
    `- crossPlayerOracleOnly: ${crossPlayerConfusion.oracleOnly}`,
    `- ownershipDiscrepancyRate: ${percent(report.ownershipDiscrepancyRate)}`,
    `- playerScopeDiscrepancyRate: ${percent(report.playerScopeDiscrepancyRate)}`,
    `- unverifiableRate: ${percent(report.unverifiableRate)}`,
    `- discrepancies: ${report.discrepancies.length}`,
    `- attributionDistribution: ${attributionDistributionSummary(report.attributionDistribution)}`,
    `- unresolvedGold: ${
      input.unresolvedGold.length > 0 ? input.unresolvedGold.map(cell).join(', ') : 'none'
    }`,
    '',
    '## Per Zone Confusion',
    '',
    '| zone | classifierOnly | oracleOnly | agreeBoth |',
    '|---|---:|---:|---:|',
    ...report.perZoneConfusion.map(
      (item) => `| ${item.zone} | ${item.classifierOnly} | ${item.oracleOnly} | ${item.agreeBoth} |`,
    ),
    '',
    '## Per Player Scope Confusion',
    '',
    '| scope | classifierOnly | oracleOnly | agreeBoth |',
    '|---|---:|---:|---:|',
    ...report.perScopeConfusion.map(
      (item) => `| ${item.scope} | ${item.classifierOnly} | ${item.oracleOnly} | ${item.agreeBoth} |`,
    ),
    '',
    '## Gold Calibration',
    '',
    '| zone | precision | recall | support |',
    '|---|---:|---:|---:|',
    ...report.goldCalibration.map(
      (item) =>
        `| ${item.zone} | ${percent(item.precision)} | ${percent(item.recall)} | ${item.support} |`,
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

function summarizeCrossPlayer(
  discrepancies: readonly ZoneCardDiffWithAttribution[],
): { classifierOnly: number; oracleOnly: number } {
  let classifierOnly = 0;
  let oracleOnly = 0;
  for (const diff of discrepancies) {
    if (diff.crossPlayerAgree) {
      continue;
    }
    if (diff.classifierCrossPlayer) {
      classifierOnly += 1;
    } else {
      oracleOnly += 1;
    }
  }
  return { classifierOnly, oracleOnly };
}

function renderClusters(report: ZoneOracleReport): string[] {
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

function renderDiscrepancies(report: ZoneOracleReportWithAttribution): string[] {
  if (report.discrepancies.length === 0) {
    return ['- none'];
  }
  return [
    '| delta | oracleId | name | zoneClassifierOnly | zoneOracleOnly | crossPlayer | ownership | scopeClassifierOnly | scopeOracleOnly | uncertain | attribution |',
    '|---|---|---|---|---|---|---|---|---|---:|---|',
    ...report.discrepancies.map((diff) => {
      const crossPlayerSummary =
        diff.classifierCrossPlayer === diff.oracleCrossPlayer
          ? 'agree'
          : `classifier=${diff.classifierCrossPlayer}, oracle=${diff.oracleCrossPlayer}`;
      const ownershipSummary =
        diff.classifierOwnership === diff.oracleOwnership
          ? 'agree'
          : `classifier=${diff.classifierOwnership}, oracle=${diff.oracleOwnership}`;
      return `| ${cell(diff.deltaSignature)} | ${diff.oracleId} | ${cell(diff.name)} | ${zoneList(diff.zoneClassifierOnly)} | ${zoneList(diff.zoneOracleOnly)} | ${cell(crossPlayerSummary)} | ${cell(ownershipSummary)} | ${scopeList(diff.playerScopeClassifierOnly)} | ${scopeList(diff.playerScopeOracleOnly)} | ${diff.hasUncertain ? 'yes' : 'no'} | ${diff.attribution ?? 'null'} |`;
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
  if (!oracleId || !name || oracleText === undefined || !bucket) {
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
    predictions: value.predictions.map(coerceZonePrediction),
  };
}

function coerceZonePrediction(value: unknown): ZonePrediction {
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
    facts: coerceZoneFacts(value.facts),
  };
}

function coerceZoneFacts(value: Record<string, unknown>): ZoneFacts {
  const zones = value.zones;
  const crossPlayer = value.crossPlayer;
  const refersToOwner = value.refersToOwner;
  const refersToController = value.refersToController;
  const playerScopes = value.playerScopes;
  const uncertain = value.uncertain;
  if (!Array.isArray(zones) || !zones.every(isZoneId)) {
    throw new Error('Invalid zones list.');
  }
  if (typeof crossPlayer !== 'boolean') {
    throw new Error('Invalid crossPlayer value.');
  }
  if (typeof refersToOwner !== 'boolean') {
    throw new Error('Invalid refersToOwner value.');
  }
  if (typeof refersToController !== 'boolean') {
    throw new Error('Invalid refersToController value.');
  }
  if (!Array.isArray(playerScopes) || !playerScopes.every(isPlayerScope)) {
    throw new Error('Invalid playerScopes list.');
  }
  if (!Array.isArray(uncertain) || !uncertain.every(isUncertainToken)) {
    throw new Error('Invalid uncertain token list.');
  }
  const rationale = value.rationale;
  return {
    zones: sortZones(zones),
    crossPlayer,
    refersToOwner,
    refersToController,
    playerScopes: sortScopes(playerScopes),
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
  const zones = value.zones;
  const crossPlayer = value.crossPlayer;
  const ownership = value.ownership;
  const playerScopes = value.playerScopes;
  if (
    !oracleId ||
    !name ||
    !Array.isArray(zones) ||
    !zones.every(isZoneId) ||
    typeof crossPlayer !== 'boolean' ||
    !isOwnershipKind(ownership) ||
    !Array.isArray(playerScopes) ||
    !playerScopes.every(isPlayerScope)
  ) {
    throw new Error('Invalid coverage card item.');
  }
  return {
    oracleId,
    name,
    zones: sortZones(zones),
    crossPlayer,
    ownership,
    playerScopes: sortScopes(playerScopes),
  };
}

function sortZones(zones: readonly ZoneId[]): ZoneId[] {
  return [...new Set(zones)].sort((a, b) => ZONE_IDS.indexOf(a) - ZONE_IDS.indexOf(b));
}

function sortScopes(scopes: readonly PlayerScope[]): PlayerScope[] {
  return [...new Set(scopes)].sort(
    (a, b) => PLAYER_SCOPES.indexOf(a) - PLAYER_SCOPES.indexOf(b),
  );
}

function zoneList(zones: readonly ZoneId[]): string {
  return zones.length > 0 ? zones.join(', ') : '(none)';
}

function scopeList(scopes: readonly PlayerScope[]): string {
  return scopes.length > 0 ? scopes.join(', ') : '(none)';
}

function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && ZONE_IDS.includes(value as ZoneId);
}

function isPlayerScope(value: unknown): value is PlayerScope {
  return typeof value === 'string' && PLAYER_SCOPES.includes(value as PlayerScope);
}

function isOwnershipKind(value: unknown): value is OwnershipKind {
  return (
    typeof value === 'string' && OWNERSHIP_KINDS.includes(value as OwnershipKind)
  );
}

function isUncertainToken(value: unknown): value is string {
  return (
    isZoneId(value) ||
    isPlayerScope(value) ||
    value === 'crossPlayer' ||
    value === 'ownership'
  );
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
