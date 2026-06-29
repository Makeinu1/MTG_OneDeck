export const HEAD_COVERAGE_THRESHOLD = 0.9;
export const UNVERIFIABLE_CEILING = 0.1;

export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'UNMEASURED';

export type CrGroundingStatus =
  | 'PASS'
  | 'PASS(core)'
  | 'PASS(boundary)'
  | 'PARTIAL'
  | 'FAIL';

export interface CrGroundingOverlayCondition {
  id: string;
  name: string;
  status: CrGroundingStatus;
  evidence: string[];
  freezeTreatment: string;
  remainingBoundary?: string;
}

export interface RFreezeDesign {
  id: string;
  artifact: string;
  status: 'drafted' | 'approved' | 'rejected';
  decisionDirection: string;
}

export interface CrGroundingOverlay {
  object?: string;
  crVersion: string;
  status: string;
  overlayConditions: CrGroundingOverlayCondition[];
  rFreezeDesigns: RFreezeDesign[];
}

export interface CrGroundingOverlayVerdict {
  approved: boolean;
  problems: string[];
}

export interface AxisCoverage {
  axis: string;
  escapeBox: string | null;
  total: number;
  escapeFreq: number;
  coverage: number | null;
  oracleGated: boolean;
}

export interface HeadCoverageResult {
  axes: AxisCoverage[];
  aggregate: number;
  threshold: number;
}

export interface UnverifiableResult {
  perOracle: { name: string; rate: number; sampleSize: number }[];
  weightedMean: number;
  max: number;
  ceiling: number;
}

export interface GateCondition {
  id: number;
  name: string;
  status: GateStatus;
  value: number | null;
  threshold: number | null;
  unverifiable: number;
  source: string;
  note: string;
}

export interface GateScorecard {
  generatedAt: string;
  conditions: GateCondition[];
  frozen: boolean;
  legacyFrozen?: boolean;
  crGroundingOverlay?: CrGroundingOverlay;
  crGroundingOverlayApproved?: boolean;
  crGroundingOverlayProblems?: string[];
  headCoverage: HeadCoverageResult;
  unverifiable: UnverifiableResult;
}

export function computeAxisCoverage(input: {
  axis: string;
  escapeBox: string | null;
  total: number;
  escapeFreq: number;
  oracleGated: boolean;
}): AxisCoverage {
  return {
    ...input,
    coverage: input.oracleGated ? null : 1 - input.escapeFreq / input.total,
  };
}

export function aggregateHeadCoverage(axes: AxisCoverage[], threshold: number): HeadCoverageResult {
  const measuredCoverages = axes
    .filter((axis) => !axis.oracleGated)
    .map((axis) => axis.coverage)
    .filter((coverage): coverage is number => coverage !== null);

  return {
    axes,
    aggregate: measuredCoverages.length > 0 ? Math.min(...measuredCoverages) : 0,
    threshold,
  };
}

export function aggregateUnverifiable(
  oracles: { name: string; rate: number; sampleSize: number }[],
  ceiling: number,
): UnverifiableResult {
  const totalSamples = oracles.reduce((total, oracle) => total + oracle.sampleSize, 0);
  const weightedTotal = oracles.reduce(
    (total, oracle) => total + oracle.rate * oracle.sampleSize,
    0,
  );

  return {
    perOracle: oracles,
    weightedMean: totalSamples > 0 ? weightedTotal / totalSamples : 0,
    max: oracles.length > 0 ? Math.max(...oracles.map((oracle) => oracle.rate)) : 0,
    ceiling,
  };
}

export function judgeCondition(input: {
  id: number;
  name: string;
  value: number | null;
  threshold: number | null;
  higherIsBetter: boolean;
  unverifiable: number;
  unverifiableIsMetric?: boolean;
  unmeasured?: boolean;
  source: string;
  note: string;
}): GateCondition {
  let status: GateStatus;

  if (input.value === null) {
    status = input.unmeasured ? 'UNMEASURED' : 'BLOCKED';
  } else if (input.unverifiableIsMetric === true) {
    status = input.threshold !== null && input.value <= input.threshold ? 'PASS' : 'FAIL';
  } else if (input.unverifiable > 0) {
    status = 'FAIL';
  } else {
    const meets =
      input.threshold !== null &&
      (input.higherIsBetter ? input.value >= input.threshold : input.value <= input.threshold);
    status = meets ? 'PASS' : 'FAIL';
  }

  return {
    id: input.id,
    name: input.name,
    status,
    value: input.value,
    threshold: input.threshold,
    unverifiable: input.unverifiable,
    source: input.source,
    note: input.note,
  };
}

export function judgeFrozen(conditions: GateCondition[]): boolean {
  return conditions.every((condition) => condition.status === 'PASS');
}

export function judgeCrGroundingOverlay(
  overlay: CrGroundingOverlay | null,
): CrGroundingOverlayVerdict {
  if (overlay === null) {
    return { approved: false, problems: ['CR-grounding overlay missing'] };
  }

  const problems: string[] = [];

  for (const condition of overlay.overlayConditions) {
    const hasBoundary =
      typeof condition.remainingBoundary === 'string' &&
      condition.remainingBoundary.trim().length > 0;

    if (condition.status === 'FAIL') {
      problems.push(`${condition.id}: FAIL is not allowed`);
      continue;
    }

    if (condition.freezeTreatment === 'required-pass') {
      if (condition.status !== 'PASS') {
        problems.push(`${condition.id}: required-pass must be PASS`);
      }
      continue;
    }

    if (condition.freezeTreatment === 'core-pass-only') {
      if (condition.status !== 'PASS(core)') {
        problems.push(`${condition.id}: core-pass-only must be PASS(core)`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    if (condition.freezeTreatment === 'boundary-pass-only') {
      if (condition.status !== 'PASS(boundary)') {
        problems.push(`${condition.id}: boundary-pass-only must be PASS(boundary)`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    if (condition.freezeTreatment.startsWith('partial-allowed-')) {
      if (condition.status !== 'PARTIAL') {
        problems.push(`${condition.id}: partial treatment must be PARTIAL`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    problems.push(`${condition.id}: unknown freezeTreatment ${condition.freezeTreatment}`);
  }

  return { approved: problems.length === 0, problems };
}

export function judgeTotalFrozen(input: {
  legacyFrozen: boolean;
  crGroundingOverlayApproved: boolean;
}): boolean {
  return input.legacyFrozen && input.crGroundingOverlayApproved;
}
