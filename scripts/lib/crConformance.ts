export type CrAxis = 'layer' | 'event-family' | 'zone-transition' | 'timing';

export const CR_CONFORMANCE_THRESHOLD = 0.95;

export interface CrGoldEntry {
  oracleId: string;
  cardName: string;
  oracleText: string;
  axis: CrAxis;
  expected: string[];
  crRule: string;
  rationale: string;
  scopeBoundary?: boolean;
  allowance?: {
    crRule: string;
    rationale: string;
  };
}

export interface CrEvaluatedEntry {
  axis: CrAxis;
  conformant: boolean;
  scopeBoundary: boolean;
  hasAllowance: boolean;
}

export interface CrAxisConformance {
  inScope: number;
  conformant: number;
  divergent: number;
}

export interface CrConformanceResult {
  total: number;
  inScope: number;
  scopeBoundary: number;
  conformant: number;
  divergent: number;
  conformanceRate: number;
  bounded: boolean;
  perAxis: Record<CrAxis, CrAxisConformance>;
}

const CR_AXES: readonly CrAxis[] = [
  'layer',
  'event-family',
  'zone-transition',
  'timing',
];

export function compareGoldEntry(
  expected: string[],
  actual: string[],
): { conformant: boolean; missing: string[]; extra: string[] } {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((value) => !actualSet.has(value));
  const extra = [...actualSet].filter((value) => !expectedSet.has(value));

  return {
    conformant: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

export function aggregateConformance(
  entries: CrEvaluatedEntry[],
  threshold: number,
): CrConformanceResult {
  if (!Number.isFinite(threshold)) {
    throw new Error('CR conformance threshold must be finite.');
  }

  const perAxis = Object.fromEntries(
    CR_AXES.map((axis) => [
      axis,
      { inScope: 0, conformant: 0, divergent: 0 } satisfies CrAxisConformance,
    ]),
  ) as Record<CrAxis, CrAxisConformance>;

  let scopeBoundary = 0;
  let conformant = 0;
  let divergent = 0;

  for (const entry of entries) {
    if (entry.scopeBoundary) {
      scopeBoundary += 1;
      continue;
    }

    const axis = perAxis[entry.axis];
    axis.inScope += 1;

    if (entry.conformant) {
      conformant += 1;
      axis.conformant += 1;
    } else if (!entry.hasAllowance) {
      divergent += 1;
      axis.divergent += 1;
    }
  }

  const inScope = entries.length - scopeBoundary;
  return {
    total: entries.length,
    inScope,
    scopeBoundary,
    conformant,
    divergent,
    conformanceRate: inScope === 0 ? 0 : conformant / inScope,
    bounded: divergent === 0,
    perAxis,
  };
}

export function conformancePass(
  result: CrConformanceResult,
  threshold: number,
): boolean;
export function conformancePass(
  result: {
    conformanceRate: number;
    bounded: boolean;
    [key: string]: unknown;
  },
  threshold: number,
): boolean;
export function conformancePass(
  result: Pick<CrConformanceResult, 'conformanceRate' | 'bounded'>,
  threshold: number,
): boolean {
  return result.conformanceRate >= threshold && result.bounded;
}
