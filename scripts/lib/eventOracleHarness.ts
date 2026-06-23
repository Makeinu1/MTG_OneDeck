import { EVENT_FAMILIES, type EventFamily, type ObserverScope } from './eventClassify.ts';

export interface EventFacts {
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
  uncertain: string[];
  rationale?: string;
}

export interface EventCardDiff {
  oracleId: string;
  name: string;
  classifierFamilies: EventFamily[];
  oracleFamilies: EventFamily[];
  familyClassifierOnly: EventFamily[];
  familyOracleOnly: EventFamily[];
  classifierObservers: ObserverScope[];
  oracleObservers: ObserverScope[];
  observerClassifierOnly: ObserverScope[];
  observerOracleOnly: ObserverScope[];
  classifierInterveningIf: boolean;
  oracleInterveningIf: boolean;
  familyAgree: boolean;
  observerAgree: boolean;
  interveningIfAgree: boolean;
  agree: boolean;
  hasUncertain: boolean;
  deltaSignature: string;
  attribution: null;
}

export interface FamilyConfusion {
  family: EventFamily;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface ObserverConfusion {
  observer: ObserverScope;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface FamilyCalibration {
  family: EventFamily;
  precision: number;
  recall: number;
  support: number;
}

export interface Cluster {
  signature: string;
  count: number;
  examples: string[];
}

export interface EventOracleReport {
  sampleSize: number;
  comparedCount: number;
  familyDiscrepancyRate: number;
  observerDiscrepancyRate: number;
  interveningIfDiscrepancyRate: number;
  unverifiableRate: number;
  perFamilyConfusion: FamilyConfusion[];
  perObserverConfusion: ObserverConfusion[];
  goldCalibration: FamilyCalibration[];
  clusters: Cluster[];
  discrepancies: EventCardDiff[];
}

interface ClassifierCard {
  oracleId: string;
  name: string;
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
}

interface EventPrediction {
  oracleId: string;
  name: string;
  facts: EventFacts;
}

interface GoldCard {
  oracleId: string;
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
}

interface ComparedCard {
  diff: EventCardDiff;
  comparableClassifierFamilies: EventFamily[];
  comparableOracleFamilies: EventFamily[];
  comparableClassifierObservers: ObserverScope[];
  comparableOracleObservers: ObserverScope[];
  hasFamilyUncertain: boolean;
  hasObserverUncertain: boolean;
  hasInterveningIfUncertain: boolean;
}

const OBSERVER_SCOPES: readonly ObserverScope[] = [
  'self',
  'opponent',
  'any',
  'controlled-set',
  'unknown',
];

const OBSERVER_SIGNATURE_ORDER: readonly ObserverScope[] = [
  'any',
  'controlled-set',
  'opponent',
  'self',
  'unknown',
];

export function computeEventReport(
  classifier: ClassifierCard[],
  predictions: EventPrediction[],
  gold: GoldCard[],
): EventOracleReport {
  const classifierByOracleId = new Map<string, ClassifierCard>();
  for (const card of classifier) {
    classifierByOracleId.set(card.oracleId, card);
  }

  const predictionByOracleId = new Map<string, EventPrediction>();
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

  const familyDiscrepancyCount = compared.filter(
    (item) => !item.diff.familyAgree && !item.hasFamilyUncertain,
  ).length;
  const observerDiscrepancyCount = compared.filter(
    (item) => !item.diff.observerAgree && !item.hasObserverUncertain,
  ).length;
  const interveningIfDiscrepancyCount = compared.filter(
    (item) => !item.diff.interveningIfAgree && !item.hasInterveningIfUncertain,
  ).length;

  return {
    sampleSize: predictions.length,
    comparedCount: compared.length,
    familyDiscrepancyRate: rate(familyDiscrepancyCount, compared.length),
    observerDiscrepancyRate: rate(observerDiscrepancyCount, compared.length),
    interveningIfDiscrepancyRate: rate(interveningIfDiscrepancyCount, compared.length),
    unverifiableRate: rate(uncertainCount, predictions.length),
    perFamilyConfusion: buildFamilyConfusion(compared),
    perObserverConfusion: buildObserverConfusion(compared),
    goldCalibration: buildGoldCalibration(gold, predictionByOracleId),
    clusters: buildClusters(discrepancies),
    discrepancies,
  };
}

function compareCard(
  classifierCard: ClassifierCard,
  prediction: EventPrediction,
  hasUncertain: boolean,
): ComparedCard {
  const uncertainFamilies = new Set<EventFamily>(prediction.facts.uncertain.filter(isEventFamily));
  const uncertainObservers = new Set<ObserverScope>(
    prediction.facts.uncertain.filter(isObserverScope),
  );
  const hasInterveningIfUncertain = prediction.facts.uncertain.includes('hasInterveningIf');

  const classifierFamilies = sortFamilies(classifierCard.families);
  const oracleFamilies = sortFamilies(prediction.facts.families);
  const classifierObservers = sortObservers(classifierCard.observers);
  const oracleObservers = sortObservers(prediction.facts.observers);

  const comparableClassifierFamilies = classifierFamilies.filter(
    (family) => !uncertainFamilies.has(family),
  );
  const comparableOracleFamilies = oracleFamilies.filter((family) => !uncertainFamilies.has(family));
  const comparableClassifierObservers = classifierObservers.filter(
    (observer) => !uncertainObservers.has(observer),
  );
  const comparableOracleObservers = oracleObservers.filter(
    (observer) => !uncertainObservers.has(observer),
  );

  const familyClassifierOnly = setDifference(
    comparableClassifierFamilies,
    comparableOracleFamilies,
    sortFamilies,
  );
  const familyOracleOnly = setDifference(
    comparableOracleFamilies,
    comparableClassifierFamilies,
    sortFamilies,
  );
  const observerClassifierOnly = setDifference(
    comparableClassifierObservers,
    comparableOracleObservers,
    sortObservers,
  );
  const observerOracleOnly = setDifference(
    comparableOracleObservers,
    comparableClassifierObservers,
    sortObservers,
  );

  const familyAgree = familyClassifierOnly.length === 0 && familyOracleOnly.length === 0;
  const observerAgree = observerClassifierOnly.length === 0 && observerOracleOnly.length === 0;
  const interveningIfAgree =
    hasInterveningIfUncertain ||
    classifierCard.hasInterveningIf === prediction.facts.hasInterveningIf;
  const agree = familyAgree && observerAgree && interveningIfAgree;

  const diff: EventCardDiff = {
    oracleId: prediction.oracleId,
    name: prediction.name || classifierCard.name,
    classifierFamilies,
    oracleFamilies,
    familyClassifierOnly,
    familyOracleOnly,
    classifierObservers,
    oracleObservers,
    observerClassifierOnly,
    observerOracleOnly,
    classifierInterveningIf: classifierCard.hasInterveningIf,
    oracleInterveningIf: prediction.facts.hasInterveningIf,
    familyAgree,
    observerAgree,
    interveningIfAgree,
    agree,
    hasUncertain,
    deltaSignature: deltaSignature({
      familyOracleOnly,
      familyClassifierOnly,
      observerOracleOnly,
      observerClassifierOnly,
      classifierInterveningIf: classifierCard.hasInterveningIf,
      oracleInterveningIf: prediction.facts.hasInterveningIf,
      hasInterveningIfUncertain,
    }),
    attribution: null,
  };

  return {
    diff,
    comparableClassifierFamilies,
    comparableOracleFamilies,
    comparableClassifierObservers,
    comparableOracleObservers,
    hasFamilyUncertain: uncertainFamilies.size > 0,
    hasObserverUncertain: uncertainObservers.size > 0,
    hasInterveningIfUncertain,
  };
}

function buildFamilyConfusion(compared: readonly ComparedCard[]): FamilyConfusion[] {
  return EVENT_FAMILIES.map((family) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;

    for (const item of compared) {
      const classifierHasFamily = item.comparableClassifierFamilies.includes(family);
      const oracleHasFamily = item.comparableOracleFamilies.includes(family);
      if (classifierHasFamily && oracleHasFamily) {
        agreeBoth += 1;
      } else if (classifierHasFamily) {
        classifierOnly += 1;
      } else if (oracleHasFamily) {
        oracleOnly += 1;
      }
    }

    return { family, classifierOnly, oracleOnly, agreeBoth };
  });
}

function buildObserverConfusion(compared: readonly ComparedCard[]): ObserverConfusion[] {
  return OBSERVER_SCOPES.map((observer) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;

    for (const item of compared) {
      const classifierHasObserver = item.comparableClassifierObservers.includes(observer);
      const oracleHasObserver = item.comparableOracleObservers.includes(observer);
      if (classifierHasObserver && oracleHasObserver) {
        agreeBoth += 1;
      } else if (classifierHasObserver) {
        classifierOnly += 1;
      } else if (oracleHasObserver) {
        oracleOnly += 1;
      }
    }

    return { observer, classifierOnly, oracleOnly, agreeBoth };
  });
}

function buildGoldCalibration(
  gold: readonly GoldCard[],
  predictionByOracleId: ReadonlyMap<string, EventPrediction>,
): FamilyCalibration[] {
  return EVENT_FAMILIES.map((family) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (const goldCard of gold) {
      const goldFamilies = new Set<EventFamily>(sortFamilies(goldCard.families));
      const prediction = predictionByOracleId.get(goldCard.oracleId);
      const uncertainFamilies = new Set<EventFamily>(
        prediction ? prediction.facts.uncertain.filter(isEventFamily) : [],
      );
      const oracleFamilies = new Set<EventFamily>(
        prediction
          ? sortFamilies(prediction.facts.families).filter(
              (predictedFamily) => !uncertainFamilies.has(predictedFamily),
            )
          : [],
      );
      const goldHasFamily = goldFamilies.has(family);
      const oracleHasFamily = oracleFamilies.has(family);

      if (goldHasFamily) {
        support += 1;
      }
      if (goldHasFamily && oracleHasFamily) {
        truePositive += 1;
      } else if (oracleHasFamily) {
        falsePositive += 1;
      } else if (goldHasFamily) {
        falseNegative += 1;
      }
    }

    return {
      family,
      precision: rate(truePositive, truePositive + falsePositive),
      recall: rate(truePositive, truePositive + falseNegative),
      support,
    };
  });
}

function buildClusters(discrepancies: readonly EventCardDiff[]): Cluster[] {
  const bySignature = new Map<string, EventCardDiff[]>();
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
  familyOracleOnly: readonly EventFamily[];
  familyClassifierOnly: readonly EventFamily[];
  observerOracleOnly: readonly ObserverScope[];
  observerClassifierOnly: readonly ObserverScope[];
  classifierInterveningIf: boolean;
  oracleInterveningIf: boolean;
  hasInterveningIfUncertain: boolean;
}): string {
  const pieces = [
    ...sortFamilies(input.familyOracleOnly).map((family) => `+${family}`),
    ...sortFamilies(input.familyClassifierOnly).map((family) => `-${family}`),
    ...sortObserversForSignature(input.observerOracleOnly).map((observer) => `+@${observer}`),
    ...sortObserversForSignature(input.observerClassifierOnly).map((observer) => `-@${observer}`),
  ];

  if (!input.hasInterveningIfUncertain && input.oracleInterveningIf !== input.classifierInterveningIf) {
    pieces.push(input.oracleInterveningIf ? '+if' : '-if');
  }

  return pieces.length > 0 ? pieces.join(',') : '=';
}

function compareCardDiff(a: EventCardDiff, b: EventCardDiff): number {
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

function sortObserversForSignature(observers: readonly ObserverScope[]): ObserverScope[] {
  return [...new Set(observers)].sort(
    (a, b) => OBSERVER_SIGNATURE_ORDER.indexOf(a) - OBSERVER_SIGNATURE_ORDER.indexOf(b),
  );
}

function isEventFamily(value: string): value is EventFamily {
  return EVENT_FAMILIES.includes(value as EventFamily);
}

function isObserverScope(value: string): value is ObserverScope {
  return OBSERVER_SCOPES.includes(value as ObserverScope);
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
