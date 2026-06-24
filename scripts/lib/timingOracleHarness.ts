import type { ObserverScope } from './eventClassify.ts';
import {
  CAST_TIMINGS,
  TIMING_STEPS,
  type CastTiming,
  type TimingStep,
} from './timingClassify.ts';

export interface TimingFacts {
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
  uncertain: string[];
  rationale?: string;
}

export interface TimingCardDiff {
  oracleId: string;
  name: string;
  classifierJunctures: TimingStep[];
  oracleJunctures: TimingStep[];
  junctureClassifierOnly: TimingStep[];
  junctureOracleOnly: TimingStep[];
  classifierScope: ObserverScope[];
  oracleScope: ObserverScope[];
  scopeClassifierOnly: ObserverScope[];
  scopeOracleOnly: ObserverScope[];
  classifierCastTiming: CastTiming[];
  oracleCastTiming: CastTiming[];
  castTimingClassifierOnly: CastTiming[];
  castTimingOracleOnly: CastTiming[];
  junctureAgree: boolean;
  scopeAgree: boolean;
  castTimingAgree: boolean;
  agree: boolean;
  hasUncertain: boolean;
  deltaSignature: string;
  attribution: null;
}

export interface JunctureConfusion {
  step: TimingStep;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface ScopeConfusion {
  scope: ObserverScope;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface CastTimingConfusion {
  cast: CastTiming;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface JunctureCalibration {
  step: TimingStep;
  precision: number;
  recall: number;
  support: number;
}

export interface Cluster {
  signature: string;
  count: number;
  examples: string[];
}

export interface TimingOracleReport {
  sampleSize: number;
  comparedCount: number;
  junctureDiscrepancyRate: number;
  junctureScopeDiscrepancyRate: number;
  castTimingDiscrepancyRate: number;
  unverifiableRate: number;
  perJunctureConfusion: JunctureConfusion[];
  perScopeConfusion: ScopeConfusion[];
  perCastTimingConfusion: CastTimingConfusion[];
  goldCalibration: JunctureCalibration[];
  clusters: Cluster[];
  discrepancies: TimingCardDiff[];
}

interface ClassifierCard {
  oracleId: string;
  name: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface TimingPrediction {
  oracleId: string;
  name: string;
  facts: TimingFacts;
}

interface GoldCard {
  oracleId: string;
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

interface ComparedCard {
  diff: TimingCardDiff;
  comparableClassifierJunctures: TimingStep[];
  comparableOracleJunctures: TimingStep[];
  comparableClassifierScope: ObserverScope[];
  comparableOracleScope: ObserverScope[];
  comparableClassifierCastTiming: CastTiming[];
  comparableOracleCastTiming: CastTiming[];
  hasJunctureUncertain: boolean;
  hasScopeUncertain: boolean;
  hasCastTimingUncertain: boolean;
}

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'any',
  'controlled-set',
  'opponent',
  'self',
  'unknown',
];

export function computeTimingReport(
  classifier: ClassifierCard[],
  predictions: TimingPrediction[],
  gold: GoldCard[],
): TimingOracleReport {
  const classifierByOracleId = new Map(
    classifier.map((card) => [card.oracleId, card] as const),
  );
  const predictionByOracleId = new Map(
    predictions.map((prediction) => [prediction.oracleId, prediction] as const),
  );
  const compared: ComparedCard[] = [];

  for (const prediction of predictions) {
    const classifierCard = classifierByOracleId.get(prediction.oracleId);
    if (classifierCard) {
      compared.push(compareCard(classifierCard, prediction));
    }
  }

  const discrepancies = compared
    .map((item) => item.diff)
    .filter((diff) => !diff.agree)
    .sort(compareCardDiff);

  return {
    sampleSize: predictions.length,
    comparedCount: compared.length,
    junctureDiscrepancyRate: rate(
      compared.filter((item) => !item.diff.junctureAgree && !item.hasJunctureUncertain)
        .length,
      compared.length,
    ),
    junctureScopeDiscrepancyRate: rate(
      compared.filter((item) => !item.diff.scopeAgree && !item.hasScopeUncertain).length,
      compared.length,
    ),
    castTimingDiscrepancyRate: rate(
      compared.filter(
        (item) => !item.diff.castTimingAgree && !item.hasCastTimingUncertain,
      ).length,
      compared.length,
    ),
    unverifiableRate: rate(
      predictions.filter((prediction) => prediction.facts.uncertain.length > 0).length,
      predictions.length,
    ),
    perJunctureConfusion: buildConfusion(
      TIMING_STEPS,
      compared,
      (item) => item.comparableClassifierJunctures,
      (item) => item.comparableOracleJunctures,
      (step, classifierOnly, oracleOnly, agreeBoth) => ({
        step,
        classifierOnly,
        oracleOnly,
        agreeBoth,
      }),
    ),
    perScopeConfusion: buildConfusion(
      OBSERVER_SCOPES,
      compared,
      (item) => item.comparableClassifierScope,
      (item) => item.comparableOracleScope,
      (scope, classifierOnly, oracleOnly, agreeBoth) => ({
        scope,
        classifierOnly,
        oracleOnly,
        agreeBoth,
      }),
    ),
    perCastTimingConfusion: buildConfusion(
      CAST_TIMINGS,
      compared,
      (item) => item.comparableClassifierCastTiming,
      (item) => item.comparableOracleCastTiming,
      (cast, classifierOnly, oracleOnly, agreeBoth) => ({
        cast,
        classifierOnly,
        oracleOnly,
        agreeBoth,
      }),
    ),
    goldCalibration: buildGoldCalibration(gold, predictionByOracleId),
    clusters: buildClusters(discrepancies),
    discrepancies,
  };
}

function compareCard(
  classifierCard: ClassifierCard,
  prediction: TimingPrediction,
): ComparedCard {
  const uncertainJunctures = new Set(
    prediction.facts.uncertain.filter(isTimingStep),
  );
  const uncertainScopes = new Set(
    prediction.facts.uncertain.filter(isObserverScope),
  );
  const uncertainCastTiming = new Set(
    prediction.facts.uncertain.filter(isCastTiming),
  );

  const classifierJunctures = sortTimingSteps(classifierCard.junctures);
  const oracleJunctures = sortTimingSteps(prediction.facts.junctures);
  const classifierScope = sortObserverScopes(classifierCard.junctureScope);
  const oracleScope = sortObserverScopes(prediction.facts.junctureScope);
  const classifierCastTiming = sortCastTimings(classifierCard.castTiming);
  const oracleCastTiming = sortCastTimings(prediction.facts.castTiming);

  const comparableClassifierJunctures = classifierJunctures.filter(
    (value) => !uncertainJunctures.has(value),
  );
  const comparableOracleJunctures = oracleJunctures.filter(
    (value) => !uncertainJunctures.has(value),
  );
  const comparableClassifierScope = classifierScope.filter(
    (value) => !uncertainScopes.has(value),
  );
  const comparableOracleScope = oracleScope.filter(
    (value) => !uncertainScopes.has(value),
  );
  const comparableClassifierCastTiming = classifierCastTiming.filter(
    (value) => !uncertainCastTiming.has(value),
  );
  const comparableOracleCastTiming = oracleCastTiming.filter(
    (value) => !uncertainCastTiming.has(value),
  );

  const junctureClassifierOnly = difference(
    comparableClassifierJunctures,
    comparableOracleJunctures,
    sortTimingSteps,
  );
  const junctureOracleOnly = difference(
    comparableOracleJunctures,
    comparableClassifierJunctures,
    sortTimingSteps,
  );
  const scopeClassifierOnly = difference(
    comparableClassifierScope,
    comparableOracleScope,
    sortObserverScopes,
  );
  const scopeOracleOnly = difference(
    comparableOracleScope,
    comparableClassifierScope,
    sortObserverScopes,
  );
  const castTimingClassifierOnly = difference(
    comparableClassifierCastTiming,
    comparableOracleCastTiming,
    sortCastTimings,
  );
  const castTimingOracleOnly = difference(
    comparableOracleCastTiming,
    comparableClassifierCastTiming,
    sortCastTimings,
  );

  const junctureAgree =
    junctureClassifierOnly.length === 0 && junctureOracleOnly.length === 0;
  const scopeDependsOnComparableJunctures = junctureAgree;
  const scopeAgree =
    !scopeDependsOnComparableJunctures ||
    (scopeClassifierOnly.length === 0 && scopeOracleOnly.length === 0);
  const castTimingAgree =
    uncertainCastTiming.size > 0 ||
    (castTimingClassifierOnly.length === 0 && castTimingOracleOnly.length === 0);

  const diff: TimingCardDiff = {
    oracleId: prediction.oracleId,
    name: prediction.name || classifierCard.name,
    classifierJunctures,
    oracleJunctures,
    junctureClassifierOnly,
    junctureOracleOnly,
    classifierScope,
    oracleScope,
    scopeClassifierOnly: scopeDependsOnComparableJunctures ? scopeClassifierOnly : [],
    scopeOracleOnly: scopeDependsOnComparableJunctures ? scopeOracleOnly : [],
    classifierCastTiming,
    oracleCastTiming,
    castTimingClassifierOnly:
      uncertainCastTiming.size > 0 ? [] : castTimingClassifierOnly,
    castTimingOracleOnly: uncertainCastTiming.size > 0 ? [] : castTimingOracleOnly,
    junctureAgree,
    scopeAgree,
    castTimingAgree,
    agree: junctureAgree && scopeAgree && castTimingAgree,
    hasUncertain: prediction.facts.uncertain.length > 0,
    deltaSignature: deltaSignature({
      junctureOracleOnly,
      junctureClassifierOnly,
      scopeOracleOnly: scopeDependsOnComparableJunctures ? scopeOracleOnly : [],
      scopeClassifierOnly: scopeDependsOnComparableJunctures ? scopeClassifierOnly : [],
      castTimingOracleOnly:
        uncertainCastTiming.size > 0 ? [] : castTimingOracleOnly,
      castTimingClassifierOnly:
        uncertainCastTiming.size > 0 ? [] : castTimingClassifierOnly,
    }),
    attribution: null,
  };

  return {
    diff,
    comparableClassifierJunctures,
    comparableOracleJunctures,
    comparableClassifierScope: scopeDependsOnComparableJunctures
      ? comparableClassifierScope
      : [],
    comparableOracleScope: scopeDependsOnComparableJunctures
      ? comparableOracleScope
      : [],
    comparableClassifierCastTiming:
      uncertainCastTiming.size > 0 ? [] : comparableClassifierCastTiming,
    comparableOracleCastTiming:
      uncertainCastTiming.size > 0 ? [] : comparableOracleCastTiming,
    hasJunctureUncertain: uncertainJunctures.size > 0,
    hasScopeUncertain: uncertainScopes.size > 0,
    hasCastTimingUncertain: uncertainCastTiming.size > 0,
  };
}

function buildConfusion<Value, Result>(
  values: readonly Value[],
  compared: readonly ComparedCard[],
  classifierValues: (item: ComparedCard) => readonly Value[],
  oracleValues: (item: ComparedCard) => readonly Value[],
  create: (
    value: Value,
    classifierOnly: number,
    oracleOnly: number,
    agreeBoth: number,
  ) => Result,
): Result[] {
  return values.map((value) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;
    for (const item of compared) {
      const classifierHas = classifierValues(item).includes(value);
      const oracleHas = oracleValues(item).includes(value);
      if (classifierHas && oracleHas) {
        agreeBoth += 1;
      } else if (classifierHas) {
        classifierOnly += 1;
      } else if (oracleHas) {
        oracleOnly += 1;
      }
    }
    return create(value, classifierOnly, oracleOnly, agreeBoth);
  });
}

function buildGoldCalibration(
  gold: readonly GoldCard[],
  predictionByOracleId: ReadonlyMap<string, TimingPrediction>,
): JunctureCalibration[] {
  return TIMING_STEPS.map((step) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (const goldCard of gold) {
      const prediction = predictionByOracleId.get(goldCard.oracleId);
      const uncertain = new Set(
        prediction ? prediction.facts.uncertain.filter(isTimingStep) : [],
      );
      const goldHas = goldCard.junctures.includes(step);
      const oracleHas =
        !uncertain.has(step) && Boolean(prediction?.facts.junctures.includes(step));
      if (goldHas) {
        support += 1;
      }
      if (goldHas && oracleHas) {
        truePositive += 1;
      } else if (oracleHas) {
        falsePositive += 1;
      } else if (goldHas) {
        falseNegative += 1;
      }
    }

    return {
      step,
      precision: rate(truePositive, truePositive + falsePositive),
      recall: rate(truePositive, truePositive + falseNegative),
      support,
    };
  });
}

function buildClusters(discrepancies: readonly TimingCardDiff[]): Cluster[] {
  const grouped = new Map<string, TimingCardDiff[]>();
  for (const diff of discrepancies) {
    const items = grouped.get(diff.deltaSignature) ?? [];
    items.push(diff);
    grouped.set(diff.deltaSignature, items);
  }
  return [...grouped.entries()]
    .map(([signature, items]) => ({
      signature,
      count: items.length,
      examples: [...items]
        .sort((a, b) => compareStrings(a.oracleId, b.oracleId))
        .slice(0, 5)
        .map((item) => item.name),
    }))
    .sort(
      (a, b) => b.count - a.count || compareStrings(a.signature, b.signature),
    );
}

function deltaSignature(input: {
  junctureOracleOnly: readonly TimingStep[];
  junctureClassifierOnly: readonly TimingStep[];
  scopeOracleOnly: readonly ObserverScope[];
  scopeClassifierOnly: readonly ObserverScope[];
  castTimingOracleOnly: readonly CastTiming[];
  castTimingClassifierOnly: readonly CastTiming[];
}): string {
  const pieces = [
    ...sortTimingSteps(input.junctureOracleOnly).map((value) => `+${value}`),
    ...sortTimingSteps(input.junctureClassifierOnly).map((value) => `-${value}`),
    ...sortObserverScopes(input.scopeOracleOnly).map((value) => `+@${value}`),
    ...sortObserverScopes(input.scopeClassifierOnly).map((value) => `-@${value}`),
    ...sortCastTimings(input.castTimingOracleOnly).map((value) => `+${value}`),
    ...sortCastTimings(input.castTimingClassifierOnly).map((value) => `-${value}`),
  ];
  return pieces.length > 0 ? pieces.join(',') : '=';
}

function compareCardDiff(a: TimingCardDiff, b: TimingCardDiff): number {
  return (
    compareStrings(a.deltaSignature, b.deltaSignature) ||
    compareStrings(a.oracleId, b.oracleId)
  );
}

function difference<T>(
  left: readonly T[],
  right: readonly T[],
  sort: (values: readonly T[]) => T[],
): T[] {
  const rightSet = new Set(right);
  return sort(left.filter((value) => !rightSet.has(value)));
}

function sortTimingSteps(values: readonly TimingStep[]): TimingStep[] {
  return uniqueSorted(values, TIMING_STEPS);
}

function sortObserverScopes(values: readonly ObserverScope[]): ObserverScope[] {
  return uniqueSorted(values, OBSERVER_SCOPES);
}

function sortCastTimings(values: readonly CastTiming[]): CastTiming[] {
  return uniqueSorted(values, CAST_TIMINGS);
}

function uniqueSorted<T>(values: readonly T[], order: readonly T[]): T[] {
  return [...new Set(values)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function isTimingStep(value: string): value is TimingStep {
  return TIMING_STEPS.includes(value as TimingStep);
}

function isObserverScope(value: string): value is ObserverScope {
  return OBSERVER_SCOPES.includes(value as ObserverScope);
}

function isCastTiming(value: string): value is CastTiming {
  return CAST_TIMINGS.includes(value as CastTiming);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
