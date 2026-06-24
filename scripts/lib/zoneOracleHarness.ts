import type { ZoneId } from '../../src/engine/types.ts';
import {
  PLAYER_SCOPES,
  ZONE_IDS,
  type OwnershipKind,
  type PlayerScope,
} from './zoneClassify.ts';

export interface ZoneFacts {
  zones: ZoneId[];
  crossPlayer: boolean;
  refersToOwner: boolean;
  refersToController: boolean;
  playerScopes: PlayerScope[];
  uncertain: string[];
  rationale?: string;
}

export interface ZoneCardDiff {
  oracleId: string;
  name: string;
  classifierZones: ZoneId[];
  oracleZones: ZoneId[];
  zoneClassifierOnly: ZoneId[];
  zoneOracleOnly: ZoneId[];
  classifierCrossPlayer: boolean;
  oracleCrossPlayer: boolean;
  classifierOwnership: OwnershipKind;
  oracleOwnership: OwnershipKind;
  classifierPlayerScopes: PlayerScope[];
  oraclePlayerScopes: PlayerScope[];
  playerScopeClassifierOnly: PlayerScope[];
  playerScopeOracleOnly: PlayerScope[];
  zoneAgree: boolean;
  crossPlayerAgree: boolean;
  ownershipAgree: boolean;
  playerScopeAgree: boolean;
  agree: boolean;
  hasUncertain: boolean;
  deltaSignature: string;
  attribution: null;
}

export interface ZoneConfusion {
  zone: ZoneId;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface ScopeConfusion {
  scope: PlayerScope;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface ZoneCalibration {
  zone: ZoneId;
  precision: number;
  recall: number;
  support: number;
}

export interface Cluster {
  signature: string;
  count: number;
  examples: string[];
}

export interface ZoneOracleReport {
  sampleSize: number;
  comparedCount: number;
  zoneDiscrepancyRate: number;
  crossPlayerDiscrepancyRate: number;
  ownershipDiscrepancyRate: number;
  playerScopeDiscrepancyRate: number;
  unverifiableRate: number;
  perZoneConfusion: ZoneConfusion[];
  perScopeConfusion: ScopeConfusion[];
  goldCalibration: ZoneCalibration[];
  clusters: Cluster[];
  discrepancies: ZoneCardDiff[];
}

interface ClassifierCard {
  oracleId: string;
  name: string;
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
}

interface ZonePrediction {
  oracleId: string;
  name: string;
  facts: ZoneFacts;
}

interface GoldCard {
  oracleId: string;
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
}

interface ComparedCard {
  diff: ZoneCardDiff;
  comparableClassifierZones: ZoneId[];
  comparableOracleZones: ZoneId[];
  comparableClassifierScopes: PlayerScope[];
  comparableOracleScopes: PlayerScope[];
  hasZoneUncertain: boolean;
  hasCrossPlayerUncertain: boolean;
  hasOwnershipUncertain: boolean;
  hasPlayerScopeUncertain: boolean;
}

export function computeZoneReport(
  classifier: ClassifierCard[],
  predictions: ZonePrediction[],
  gold: GoldCard[],
): ZoneOracleReport {
  const classifierByOracleId = new Map<string, ClassifierCard>();
  for (const card of classifier) {
    classifierByOracleId.set(card.oracleId, card);
  }

  const predictionByOracleId = new Map<string, ZonePrediction>();
  for (const prediction of predictions) {
    predictionByOracleId.set(prediction.oracleId, prediction);
  }

  const compared: ComparedCard[] = [];
  let uncertainCount = 0;

  for (const prediction of predictions) {
    const hasUncertain = prediction.facts.uncertain.length > 0;
    if (hasUncertain) {
      uncertainCount += 1;
    }

    const classifierCard = classifierByOracleId.get(prediction.oracleId);
    if (!classifierCard) {
      continue;
    }
    compared.push(compareCard(classifierCard, prediction, hasUncertain));
  }

  const discrepancies = compared
    .map((item) => item.diff)
    .filter((diff) => !diff.agree)
    .sort(compareCardDiff);

  const zoneDiscrepancyCount = compared.filter(
    (item) => !item.diff.zoneAgree && !item.hasZoneUncertain,
  ).length;
  const crossPlayerDiscrepancyCount = compared.filter(
    (item) => !item.diff.crossPlayerAgree && !item.hasCrossPlayerUncertain,
  ).length;
  const ownershipDiscrepancyCount = compared.filter(
    (item) => !item.diff.ownershipAgree && !item.hasOwnershipUncertain,
  ).length;
  const playerScopeDiscrepancyCount = compared.filter(
    (item) => !item.diff.playerScopeAgree && !item.hasPlayerScopeUncertain,
  ).length;

  return {
    sampleSize: predictions.length,
    comparedCount: compared.length,
    zoneDiscrepancyRate: rate(zoneDiscrepancyCount, compared.length),
    crossPlayerDiscrepancyRate: rate(crossPlayerDiscrepancyCount, compared.length),
    ownershipDiscrepancyRate: rate(ownershipDiscrepancyCount, compared.length),
    playerScopeDiscrepancyRate: rate(playerScopeDiscrepancyCount, compared.length),
    unverifiableRate: rate(uncertainCount, predictions.length),
    perZoneConfusion: buildZoneConfusion(compared),
    perScopeConfusion: buildScopeConfusion(compared),
    goldCalibration: buildGoldCalibration(gold, predictionByOracleId),
    clusters: buildClusters(discrepancies),
    discrepancies,
  };
}

function compareCard(
  classifierCard: ClassifierCard,
  prediction: ZonePrediction,
  hasUncertain: boolean,
): ComparedCard {
  const uncertainZones = new Set<ZoneId>(prediction.facts.uncertain.filter(isZoneId));
  const uncertainScopes = new Set<PlayerScope>(
    prediction.facts.uncertain.filter(isPlayerScope),
  );
  const hasCrossPlayerUncertain = prediction.facts.uncertain.includes('crossPlayer');
  const hasOwnershipUncertain = prediction.facts.uncertain.includes('ownership');

  const classifierZones = sortZones(classifierCard.zones);
  const oracleZones = sortZones(prediction.facts.zones);
  const classifierPlayerScopes = sortScopes(classifierCard.playerScopes);
  const oraclePlayerScopes = sortScopes(prediction.facts.playerScopes);
  const oracleOwnership = factsToOwnership(prediction.facts);

  const comparableClassifierZones = classifierZones.filter(
    (zone) => !uncertainZones.has(zone),
  );
  const comparableOracleZones = oracleZones.filter((zone) => !uncertainZones.has(zone));
  const comparableClassifierScopes = classifierPlayerScopes.filter(
    (scope) => !uncertainScopes.has(scope),
  );
  const comparableOracleScopes = oraclePlayerScopes.filter(
    (scope) => !uncertainScopes.has(scope),
  );

  const zoneClassifierOnly = setDifference(
    comparableClassifierZones,
    comparableOracleZones,
    sortZones,
  );
  const zoneOracleOnly = setDifference(
    comparableOracleZones,
    comparableClassifierZones,
    sortZones,
  );
  const playerScopeClassifierOnly = setDifference(
    comparableClassifierScopes,
    comparableOracleScopes,
    sortScopes,
  );
  const playerScopeOracleOnly = setDifference(
    comparableOracleScopes,
    comparableClassifierScopes,
    sortScopes,
  );

  const zoneAgree = zoneClassifierOnly.length === 0 && zoneOracleOnly.length === 0;
  const crossPlayerAgree =
    hasCrossPlayerUncertain ||
    classifierCard.crossPlayer === prediction.facts.crossPlayer;
  const ownershipAgree =
    hasOwnershipUncertain || classifierCard.ownership === oracleOwnership;
  const playerScopeAgree =
    playerScopeClassifierOnly.length === 0 && playerScopeOracleOnly.length === 0;
  const agree = zoneAgree && crossPlayerAgree && ownershipAgree && playerScopeAgree;

  const diff: ZoneCardDiff = {
    oracleId: prediction.oracleId,
    name: prediction.name || classifierCard.name,
    classifierZones,
    oracleZones,
    zoneClassifierOnly,
    zoneOracleOnly,
    classifierCrossPlayer: classifierCard.crossPlayer,
    oracleCrossPlayer: prediction.facts.crossPlayer,
    classifierOwnership: classifierCard.ownership,
    oracleOwnership,
    classifierPlayerScopes,
    oraclePlayerScopes,
    playerScopeClassifierOnly,
    playerScopeOracleOnly,
    zoneAgree,
    crossPlayerAgree,
    ownershipAgree,
    playerScopeAgree,
    agree,
    hasUncertain,
    deltaSignature: deltaSignature({
      zoneOracleOnly,
      zoneClassifierOnly,
      classifierCrossPlayer: classifierCard.crossPlayer,
      oracleCrossPlayer: prediction.facts.crossPlayer,
      hasCrossPlayerUncertain,
      classifierOwnership: classifierCard.ownership,
      oracleOwnership,
      hasOwnershipUncertain,
      playerScopeOracleOnly,
      playerScopeClassifierOnly,
    }),
    attribution: null,
  };

  return {
    diff,
    comparableClassifierZones,
    comparableOracleZones,
    comparableClassifierScopes,
    comparableOracleScopes,
    hasZoneUncertain: uncertainZones.size > 0,
    hasCrossPlayerUncertain,
    hasOwnershipUncertain,
    hasPlayerScopeUncertain: uncertainScopes.size > 0,
  };
}

function factsToOwnership(facts: ZoneFacts): OwnershipKind {
  if (facts.refersToOwner && facts.refersToController) {
    return 'both';
  }
  if (facts.refersToOwner) {
    return 'owner';
  }
  if (facts.refersToController) {
    return 'controller';
  }
  return 'none';
}

function buildZoneConfusion(compared: readonly ComparedCard[]): ZoneConfusion[] {
  return ZONE_IDS.map((zone) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;

    for (const item of compared) {
      const classifierHasZone = item.comparableClassifierZones.includes(zone);
      const oracleHasZone = item.comparableOracleZones.includes(zone);
      if (classifierHasZone && oracleHasZone) {
        agreeBoth += 1;
      } else if (classifierHasZone) {
        classifierOnly += 1;
      } else if (oracleHasZone) {
        oracleOnly += 1;
      }
    }

    return { zone, classifierOnly, oracleOnly, agreeBoth };
  });
}

function buildScopeConfusion(compared: readonly ComparedCard[]): ScopeConfusion[] {
  return PLAYER_SCOPES.map((scope) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;

    for (const item of compared) {
      const classifierHasScope = item.comparableClassifierScopes.includes(scope);
      const oracleHasScope = item.comparableOracleScopes.includes(scope);
      if (classifierHasScope && oracleHasScope) {
        agreeBoth += 1;
      } else if (classifierHasScope) {
        classifierOnly += 1;
      } else if (oracleHasScope) {
        oracleOnly += 1;
      }
    }

    return { scope, classifierOnly, oracleOnly, agreeBoth };
  });
}

function buildGoldCalibration(
  gold: readonly GoldCard[],
  predictionByOracleId: ReadonlyMap<string, ZonePrediction>,
): ZoneCalibration[] {
  return ZONE_IDS.map((zone) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (const goldCard of gold) {
      const goldZones = new Set<ZoneId>(sortZones(goldCard.zones));
      const prediction = predictionByOracleId.get(goldCard.oracleId);
      const uncertainZones = new Set<ZoneId>(
        prediction ? prediction.facts.uncertain.filter(isZoneId) : [],
      );
      const oracleZones = new Set<ZoneId>(
        prediction
          ? sortZones(prediction.facts.zones).filter(
              (predictedZone) => !uncertainZones.has(predictedZone),
            )
          : [],
      );
      const goldHasZone = goldZones.has(zone);
      const oracleHasZone = oracleZones.has(zone);

      if (goldHasZone) {
        support += 1;
      }
      if (goldHasZone && oracleHasZone) {
        truePositive += 1;
      } else if (oracleHasZone) {
        falsePositive += 1;
      } else if (goldHasZone) {
        falseNegative += 1;
      }
    }

    return {
      zone,
      precision: rate(truePositive, truePositive + falsePositive),
      recall: rate(truePositive, truePositive + falseNegative),
      support,
    };
  });
}

function buildClusters(discrepancies: readonly ZoneCardDiff[]): Cluster[] {
  const bySignature = new Map<string, ZoneCardDiff[]>();
  for (const diff of discrepancies) {
    const group = bySignature.get(diff.deltaSignature) ?? [];
    group.push(diff);
    bySignature.set(diff.deltaSignature, group);
  }

  return [...bySignature.entries()]
    .map(([signature, items]) => ({
      signature,
      count: items.length,
      examples: [...items]
        .sort((a, b) => a.oracleId.localeCompare(b.oracleId))
        .slice(0, 5)
        .map((item) => item.name),
    }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) {
        return countDiff;
      }
      return a.signature.localeCompare(b.signature);
    });
}

function deltaSignature(input: {
  zoneOracleOnly: readonly ZoneId[];
  zoneClassifierOnly: readonly ZoneId[];
  classifierCrossPlayer: boolean;
  oracleCrossPlayer: boolean;
  hasCrossPlayerUncertain: boolean;
  classifierOwnership: OwnershipKind;
  oracleOwnership: OwnershipKind;
  hasOwnershipUncertain: boolean;
  playerScopeOracleOnly: readonly PlayerScope[];
  playerScopeClassifierOnly: readonly PlayerScope[];
}): string {
  const pieces = [
    ...sortZones(input.zoneOracleOnly).map((zone) => `+${zone}`),
    ...sortZones(input.zoneClassifierOnly).map((zone) => `-${zone}`),
  ];

  if (
    !input.hasCrossPlayerUncertain &&
    input.oracleCrossPlayer !== input.classifierCrossPlayer
  ) {
    pieces.push(input.oracleCrossPlayer ? '+x' : '-x');
  }
  if (
    !input.hasOwnershipUncertain &&
    input.oracleOwnership !== input.classifierOwnership
  ) {
    pieces.push(`@${input.oracleOwnership}`);
  }

  pieces.push(
    ...sortScopes(input.playerScopeOracleOnly).map((scope) => `+@${scope}`),
    ...sortScopes(input.playerScopeClassifierOnly).map((scope) => `-@${scope}`),
  );

  return pieces.length > 0 ? pieces.join(',') : '=';
}

function compareCardDiff(a: ZoneCardDiff, b: ZoneCardDiff): number {
  const signatureDiff = a.deltaSignature.localeCompare(b.deltaSignature);
  if (signatureDiff !== 0) {
    return signatureDiff;
  }
  return a.oracleId.localeCompare(b.oracleId);
}

function setDifference<T>(
  left: readonly T[],
  right: readonly T[],
  sort: (values: readonly T[]) => T[],
): T[] {
  const rightSet = new Set<T>(right);
  return sort(left.filter((value) => !rightSet.has(value)));
}

function sortZones(zones: readonly ZoneId[]): ZoneId[] {
  return [...new Set(zones)].sort((a, b) => ZONE_IDS.indexOf(a) - ZONE_IDS.indexOf(b));
}

function sortScopes(scopes: readonly PlayerScope[]): PlayerScope[] {
  return [...new Set(scopes)].sort(
    (a, b) => PLAYER_SCOPES.indexOf(a) - PLAYER_SCOPES.indexOf(b),
  );
}

function isZoneId(value: string): value is ZoneId {
  return ZONE_IDS.includes(value as ZoneId);
}

function isPlayerScope(value: string): value is PlayerScope {
  return PLAYER_SCOPES.includes(value as PlayerScope);
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
