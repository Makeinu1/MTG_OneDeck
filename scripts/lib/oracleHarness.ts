import type { LayerId } from './layerClassify.ts';

export const FACT_KEYS = [
  'changesController',
  'changesTypes',
  'changesColors',
  'grantsOrRemovesAbilities',
  'setsBasePT',
  'modifiesPTByAmount',
  'switchesPT',
  'definesCharacteristicByCount',
  'isCopyEffect',
  'noContinuousEffect',
] as const;

export type FactKey = (typeof FACT_KEYS)[number];

export interface OracleFacts extends Record<FactKey, boolean> {
  uncertain: FactKey[];
  rationale?: string;
}

export interface MappedLayers {
  layers: LayerId[];
  cda: boolean;
  uncertainLayers: LayerId[];
}

export interface CardDiff {
  oracleId: string;
  name: string;
  classifierLayers: LayerId[];
  oracleLayers: LayerId[];
  classifierOnly: LayerId[];
  oracleOnly: LayerId[];
  agree: boolean;
  hasUncertain: boolean;
  deltaSignature: string;
  attribution: null;
}

export interface LayerConfusion {
  layer: LayerId;
  classifierOnly: number;
  oracleOnly: number;
  agreeBoth: number;
}

export interface GoldCalibration {
  layer: LayerId;
  precision: number;
  recall: number;
  support: number;
}

export interface Cluster {
  signature: string;
  count: number;
  examples: string[];
}

export interface OracleReport {
  sampleSize: number;
  comparedCount: number;
  discrepancyRate: number;
  unverifiableRate: number;
  perLayerConfusion: LayerConfusion[];
  goldCalibration: GoldCalibration[];
  clusters: Cluster[];
  discrepancies: CardDiff[];
}

interface ClassifierCard {
  oracleId: string;
  name: string;
  layers: LayerId[];
  cda: boolean;
}

interface OraclePrediction {
  oracleId: string;
  name: string;
  facts: OracleFacts;
}

interface GoldCard {
  oracleId: string;
  layers: LayerId[];
}

interface ComparedCard {
  diff: CardDiff;
  comparableClassifierLayers: LayerId[];
  comparableOracleLayers: LayerId[];
}

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

export function factsToLayers(facts: OracleFacts): MappedLayers {
  const layers = new Set<LayerId>();
  const uncertainLayers = new Set<LayerId>();
  const uncertainFacts = new Set<FactKey>(facts.uncertain);

  for (const key of FACT_KEYS) {
    const layer = layerForFact(key);
    if (!layer) {
      continue;
    }
    if (uncertainFacts.has(key)) {
      uncertainLayers.add(layer);
      continue;
    }
    if (facts[key]) {
      layers.add(layer);
    }
  }

  return {
    layers: sortLayerIds([...layers]),
    cda:
      facts.definesCharacteristicByCount &&
      !uncertainFacts.has('definesCharacteristicByCount'),
    uncertainLayers: sortLayerIds([...uncertainLayers]),
  };
}

function layerForFact(fact: FactKey): LayerId | undefined {
  switch (fact) {
    case 'changesController':
      return 'L2';
    case 'changesTypes':
      return 'L4';
    case 'changesColors':
      return 'L5';
    case 'grantsOrRemovesAbilities':
      return 'L6';
    case 'setsBasePT':
      return 'L7b';
    case 'modifiesPTByAmount':
      return 'L7c';
    case 'switchesPT':
      return 'L7d';
    case 'definesCharacteristicByCount':
      return 'L7a';
    case 'isCopyEffect':
      return 'L1a';
    case 'noContinuousEffect':
      return undefined;
  }
}

export function computeReport(
  classifier: ClassifierCard[],
  predictions: OraclePrediction[],
  gold: GoldCard[],
): OracleReport {
  const classifierByOracleId = new Map<string, ClassifierCard>();
  for (const card of classifier) {
    classifierByOracleId.set(card.oracleId, card);
  }

  const predictionByOracleId = new Map<string, OraclePrediction>();
  for (const prediction of predictions) {
    predictionByOracleId.set(prediction.oracleId, prediction);
  }

  const compared: ComparedCard[] = [];
  let uncertainCount = 0;

  for (const prediction of predictions) {
    const classifierCard = classifierByOracleId.get(prediction.oracleId);
    if (!classifierCard) {
      if (prediction.facts.uncertain.length > 0) {
        uncertainCount += 1;
      }
      continue;
    }

    const mapped = factsToLayers(prediction.facts);
    const hasUncertain = prediction.facts.uncertain.length > 0;
    if (hasUncertain) {
      uncertainCount += 1;
    }

    const uncertainLayerSet = new Set<LayerId>(mapped.uncertainLayers);
    const classifierLayers = sortLayerIds(classifierCard.layers);
    const oracleLayers = mapped.layers;
    const comparableClassifierLayers = classifierLayers.filter(
      (layer) => !uncertainLayerSet.has(layer),
    );
    const comparableOracleLayers = oracleLayers.filter((layer) => !uncertainLayerSet.has(layer));
    const classifierLayerSet = new Set<LayerId>(comparableClassifierLayers);
    const oracleLayerSet = new Set<LayerId>(comparableOracleLayers);
    const classifierOnly = comparableClassifierLayers.filter((layer) => !oracleLayerSet.has(layer));
    const oracleOnly = comparableOracleLayers.filter((layer) => !classifierLayerSet.has(layer));
    const agree = classifierOnly.length === 0 && oracleOnly.length === 0;

    compared.push({
      diff: {
        oracleId: prediction.oracleId,
        name: prediction.name || classifierCard.name,
        classifierLayers,
        oracleLayers,
        classifierOnly,
        oracleOnly,
        agree,
        hasUncertain,
        deltaSignature: deltaSignature(oracleOnly, classifierOnly),
        attribution: null,
      },
      comparableClassifierLayers,
      comparableOracleLayers,
    });
  }

  const discrepancies = compared
    .map((item) => item.diff)
    .filter((diff) => !diff.agree)
    .sort(compareCardDiff);

  const discrepancyCount = compared.filter(
    (item) => !item.diff.agree && !item.diff.hasUncertain,
  ).length;

  return {
    sampleSize: predictions.length,
    comparedCount: compared.length,
    discrepancyRate: rate(discrepancyCount, compared.length),
    unverifiableRate: rate(uncertainCount, predictions.length),
    perLayerConfusion: buildLayerConfusion(compared),
    goldCalibration: buildGoldCalibration(gold, predictionByOracleId),
    clusters: buildClusters(discrepancies),
    discrepancies,
  };
}

function buildLayerConfusion(compared: readonly ComparedCard[]): LayerConfusion[] {
  return LAYER_ORDER.map((layer) => {
    let classifierOnly = 0;
    let oracleOnly = 0;
    let agreeBoth = 0;

    for (const item of compared) {
      const classifierHasLayer = item.comparableClassifierLayers.includes(layer);
      const oracleHasLayer = item.comparableOracleLayers.includes(layer);
      if (classifierHasLayer && oracleHasLayer) {
        agreeBoth += 1;
      } else if (classifierHasLayer) {
        classifierOnly += 1;
      } else if (oracleHasLayer) {
        oracleOnly += 1;
      }
    }

    return { layer, classifierOnly, oracleOnly, agreeBoth };
  });
}

function buildGoldCalibration(
  gold: readonly GoldCard[],
  predictionByOracleId: ReadonlyMap<string, OraclePrediction>,
): GoldCalibration[] {
  return LAYER_ORDER.map((layer) => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let support = 0;

    for (const goldCard of gold) {
      const goldLayers = new Set<LayerId>(sortLayerIds(goldCard.layers));
      const prediction = predictionByOracleId.get(goldCard.oracleId);
      const oracleLayers = new Set<LayerId>(
        prediction ? factsToLayers(prediction.facts).layers : [],
      );
      const goldHasLayer = goldLayers.has(layer);
      const oracleHasLayer = oracleLayers.has(layer);

      if (goldHasLayer) {
        support += 1;
      }
      if (goldHasLayer && oracleHasLayer) {
        truePositive += 1;
      } else if (oracleHasLayer) {
        falsePositive += 1;
      } else if (goldHasLayer) {
        falseNegative += 1;
      }
    }

    return {
      layer,
      precision: rate(truePositive, truePositive + falsePositive),
      recall: rate(truePositive, truePositive + falseNegative),
      support,
    };
  });
}

function buildClusters(discrepancies: readonly CardDiff[]): Cluster[] {
  const bySignature = new Map<string, CardDiff[]>();
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

function deltaSignature(oracleOnly: readonly LayerId[], classifierOnly: readonly LayerId[]): string {
  const pieces = [
    ...sortLayerIds(oracleOnly).map((layer) => `+${layer}`),
    ...sortLayerIds(classifierOnly).map((layer) => `-${layer}`),
  ];
  return pieces.length > 0 ? pieces.join(',') : '=';
}

function compareCardDiff(a: CardDiff, b: CardDiff): number {
  const signatureDiff = a.deltaSignature.localeCompare(b.deltaSignature);
  if (signatureDiff !== 0) {
    return signatureDiff;
  }
  return a.oracleId.localeCompare(b.oracleId);
}

function sortLayerIds(layers: readonly LayerId[]): LayerId[] {
  return [...new Set(layers)].sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
