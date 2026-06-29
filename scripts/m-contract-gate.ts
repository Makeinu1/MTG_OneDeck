import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';

import {
  classifyGoldenReplay,
  replayGoldenCase,
  type GoldenUnverifiable,
} from '../src/engine/goldenReplay.ts';
import { loadGoldenReplayCases } from './lib/goldenReplayLoader.ts';
import {
  HEAD_COVERAGE_THRESHOLD,
  UNVERIFIABLE_CEILING,
  aggregateHeadCoverage,
  aggregateUnverifiable,
  computeAxisCoverage,
  judgeCondition,
  judgeCrGroundingOverlay,
  judgeFrozen,
  judgeTotalFrozen,
  type AxisCoverage,
  type CrGroundingOverlay,
  type GateCondition,
  type GateScorecard,
} from './lib/mContractGate.ts';
import { CR_CONFORMANCE_THRESHOLD } from './lib/crConformance.ts';

const REPORT_DIRECTORY = resolve(process.cwd(), 'research/m-contract-gate');
const REPORT_JSON_PATH = resolve(REPORT_DIRECTORY, 'scorecard.json');
const REPORT_MD_PATH = resolve(REPORT_DIRECTORY, 'scorecard.md');
const GOLDEN_CASE_DIRECTORY = resolve(process.cwd(), 'research/golden-replay/cases');
const CR_GROUNDING_OVERLAY_PATH = resolve(
  process.cwd(),
  'research/cr-grounding/m0-freeze-overlay.json',
);

const REPORT_PATHS = {
  layerCoverage: 'research/layer-coverage/report.json',
  eventCoverage: 'research/event-coverage/report.json',
  zoneCoverage: 'research/zone-coverage/report.json',
  timingCoverage: 'research/timing-coverage/report.json',
  classifierParity: 'research/classifier-parity/report.json',
  crConformance: 'research/cr-conformance/report.json',
  layerOracle: 'research/llm-oracle/report.json',
  eventOracle: 'research/event-oracle/report.json',
  zoneOracle: 'research/zone-oracle/report.json',
  timingOracle: 'research/timing-oracle/report.json',
} as const;

interface LoadedReport {
  path: string;
  data: unknown;
  error: string | null;
}

interface GoldenReplaySummary {
  total: number;
  passed: number;
  verified: number;
  pureScopeBoundary: number;
  runtimeGap: number;
  perDeck: Record<string, GoldenReplayDeckSummary>;
  runtimeGapCases: {
    caseName: string;
    entries: GoldenUnverifiable[];
  }[];
  error: string | null;
}

interface GoldenReplayDeckSummary {
  total: number;
  verified: number;
  pureScopeBoundary: number;
  runtimeGap: number;
}

async function main(): Promise<void> {
  const reports = await Promise.all(Object.values(REPORT_PATHS).map((path) => loadReport(path)));
  const reportsByPath = new Map(reports.map((report) => [report.path, report]));

  const layerCoverage = requiredReport(reportsByPath, REPORT_PATHS.layerCoverage);
  const eventCoverage = requiredReport(reportsByPath, REPORT_PATHS.eventCoverage);
  const zoneCoverage = requiredReport(reportsByPath, REPORT_PATHS.zoneCoverage);
  const timingCoverage = requiredReport(reportsByPath, REPORT_PATHS.timingCoverage);
  const classifierParity = requiredReport(reportsByPath, REPORT_PATHS.classifierParity);
  const crConformance = requiredReport(reportsByPath, REPORT_PATHS.crConformance);
  const oracleReports = [
    { name: 'layer', report: requiredReport(reportsByPath, REPORT_PATHS.layerOracle) },
    { name: 'event', report: requiredReport(reportsByPath, REPORT_PATHS.eventOracle) },
    { name: 'zone', report: requiredReport(reportsByPath, REPORT_PATHS.zoneOracle) },
    { name: 'timing', report: requiredReport(reportsByPath, REPORT_PATHS.timingOracle) },
  ];
  const goldenReplay = await summarizeGoldenReplay();

  const headCoverage = buildHeadCoverage(
    layerCoverage,
    eventCoverage,
    zoneCoverage,
    timingCoverage,
  );
  const unverifiable = aggregateUnverifiable(
    oracleReports.flatMap(({ name, report }) => {
      const rate = readNumberPath(report.data, ['unverifiableRate']);
      const sampleSize = readNumberPath(report.data, ['sampleSize']);
      return rate === null || sampleSize === null ? [] : [{ name, rate, sampleSize }];
    }),
    UNVERIFIABLE_CEILING,
  );

  const coverageReports = [layerCoverage, eventCoverage, zoneCoverage, timingCoverage];
  const conditions = [
    buildConditionOne(),
    buildConditionTwo(headCoverage, coverageReports),
    buildConditionThree(coverageReports),
    buildConditionFour(crConformance),
    buildConditionFive(goldenReplay),
    buildConditionSix(classifierParity),
    buildConditionSeven(unverifiable, oracleReports),
  ].sort((left, right) => left.id - right.id);

  const crGroundingOverlay = await loadCrGroundingOverlay();
  const crGroundingOverlayVerdict = judgeCrGroundingOverlay(crGroundingOverlay);
  const legacyFrozen = judgeFrozen(conditions);

  const scorecard: GateScorecard = {
    generatedAt: new Date().toISOString(),
    conditions,
    legacyFrozen,
    crGroundingOverlay: crGroundingOverlay ?? undefined,
    crGroundingOverlayApproved: crGroundingOverlayVerdict.approved,
    crGroundingOverlayProblems: crGroundingOverlayVerdict.problems,
    frozen: judgeTotalFrozen({
      legacyFrozen,
      crGroundingOverlayApproved: crGroundingOverlayVerdict.approved,
    }),
    headCoverage,
    unverifiable,
  };

  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(scorecard, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD_PATH, renderMarkdown(scorecard), 'utf8');

  console.log(`M-CONTRACT scorecard written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw scorecard written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(`verdict=${scorecard.frozen ? 'FROZEN' : 'NOT FROZEN'}`);
}

function buildHeadCoverage(
  layer: LoadedReport,
  event: LoadedReport,
  zone: LoadedReport,
  timing: LoadedReport,
): GateScorecard['headCoverage'] {
  const eventTotal = readNumberPath(event.data, ['triggerLineCount']) ?? 0;
  const eventEscape = readNumberPath(event.data, ['perFamily', 'other', 'lineCount']) ?? 0;
  const timingTotal = sumRecordField(readRecordPath(timing.data, ['perStep']), 'cardCount');
  const timingEscape = readNumberPath(timing.data, ['perStep', 'other', 'cardCount']) ?? 0;
  const zoneTotal = sumRecordField(readRecordPath(zone.data, ['perPlayerScope']), 'cardCount');
  const zoneEscape = readNumberPath(zone.data, ['perPlayerScope', 'unknown', 'cardCount']) ?? 0;

  const axes: AxisCoverage[] = [
    computeMeasuredAxisCoverage({
      axis: 'event-family',
      escapeBox: 'other',
      total: eventTotal,
      escapeFreq: eventEscape,
    }),
    computeMeasuredAxisCoverage({
      axis: 'timing-juncture',
      escapeBox: 'other',
      total: timingTotal,
      escapeFreq: timingEscape,
    }),
    computeMeasuredAxisCoverage({
      axis: 'zone-scope',
      escapeBox: 'unknown',
      total: zoneTotal,
      escapeFreq: zoneEscape,
    }),
    computeAxisCoverage({
      axis: 'layer',
      escapeBox: null,
      total: readNumberPath(layer.data, ['mappedCards']) ?? 0,
      escapeFreq: 0,
      oracleGated: true,
    }),
    computeAxisCoverage({
      axis: 'zone-axis',
      escapeBox: null,
      total: sumRecordField(readRecordPath(zone.data, ['perZone']), 'cardCount'),
      escapeFreq: 0,
      oracleGated: true,
    }),
    computeAxisCoverage({
      axis: 'timing-castTiming',
      escapeBox: null,
      total: sumRecordField(readRecordPath(timing.data, ['perCastTiming']), 'cardCount'),
      escapeFreq: 0,
      oracleGated: true,
    }),
  ];

  return aggregateHeadCoverage(axes, HEAD_COVERAGE_THRESHOLD);
}

function computeMeasuredAxisCoverage(input: {
  axis: string;
  escapeBox: string;
  total: number;
  escapeFreq: number;
}): AxisCoverage {
  if (input.total === 0) {
    return { ...input, coverage: 0, oracleGated: false };
  }
  return computeAxisCoverage({ ...input, oracleGated: false });
}

function buildConditionOne(): GateCondition {
  return {
    id: 1,
    name: 'Slice1-4 complete',
    status: 'PASS',
    value: null,
    threshold: null,
    unverifiable: 0,
    source: 'docs/engine-state-ontology.md',
    note: 'Slice1-4 完了(commit 3e220e7)',
  };
}

function buildConditionTwo(
  headCoverage: GateScorecard['headCoverage'],
  reports: LoadedReport[],
): GateCondition {
  const problems = reportProblems(reports);
  return judgeCondition({
    id: 2,
    name: 'Head coverage',
    value: problems.length === 0 ? headCoverage.aggregate : null,
    threshold: HEAD_COVERAGE_THRESHOLD,
    higherIsBetter: true,
    unverifiable: 0,
    unmeasured: problems.length > 0,
    source: reports.map((report) => report.path).join(', '),
    note: appendProblems('escape-box-free: oracle-gated(真の被覆は条件3/7 へ委ねる)', problems),
  });
}

function buildConditionThree(reports: LoadedReport[]): GateCondition {
  const churnRates = reports.map((report) => readNumberPath(report.data, ['churn', 'rate']));
  const problems = [
    ...reportProblems(reports),
    ...reports.flatMap((report, index) =>
      report.data !== null && churnRates[index] === null
        ? [`${report.path}: churn.rate missing`]
        : [],
    ),
  ];
  const measuredRates = churnRates.filter((rate): rate is number => rate !== null);
  const value =
    problems.length === 0 && measuredRates.length === reports.length
      ? Math.max(...measuredRates)
      : null;

  const perSlice = reports
    .map((report, index) => {
      const slice = report.path.replace(/^research\/|-coverage\/report\.json$/g, '');
      const rate = churnRates[index];
      return `${slice}=${rate === null ? '?' : percent(rate)}`;
    })
    .join(', ');

  return judgeCondition({
    id: 3,
    name: 'Model churn',
    value,
    threshold: 0.05,
    higherIsBetter: false,
    unverifiable: 0,
    unmeasured: problems.length > 0,
    source: reports.map((report) => report.path).join(', '),
    note: appendProblems(
      `post-independent-yardstick(§34.7.5): CR-conformance 裁定後・baseline=churnBaselineCommit に対し4スライス同時測定。perSlice churn: ${perSlice}`,
      problems,
    ),
  });
}

function buildConditionFour(report: LoadedReport): GateCondition {
  const axes = ['event-family', 'layer', 'timing', 'zone-transition'] as const;
  const conformanceRate = readNumberPath(report.data, ['summary', 'conformanceRate']);
  const inScope = readNumberPath(report.data, ['summary', 'inScope']);
  const conformant = readNumberPath(report.data, ['summary', 'conformant']);
  const divergent = readNumberPath(report.data, ['summary', 'divergent']);
  const scopeBoundary = readNumberPath(report.data, ['summary', 'scopeBoundary']);
  const bounded = readBooleanPath(report.data, ['summary', 'bounded']);
  const fields = [
    ['summary.conformanceRate', conformanceRate],
    ['summary.inScope', inScope],
    ['summary.conformant', conformant],
    ['summary.divergent', divergent],
    ['summary.scopeBoundary', scopeBoundary],
    ['summary.bounded', bounded],
  ] as const;
  const problems = [
    ...reportProblems([report]),
    ...fields.flatMap(([name, value]) =>
      report.data !== null && value === null ? [`${report.path}: ${name} missing`] : [],
    ),
    ...axes.flatMap((axis) => {
      const axisInScope = readNumberPath(report.data, ['perAxis', axis, 'inScope']);
      const axisConformant = readNumberPath(report.data, ['perAxis', axis, 'conformant']);
      const axisDivergent = readNumberPath(report.data, ['perAxis', axis, 'divergent']);
      return report.data !== null &&
        (axisInScope === null || axisConformant === null || axisDivergent === null)
        ? [`${report.path}: perAxis.${axis} fields missing`]
        : [];
    }),
  ];
  const axisDetails = axes
    .map((axis) => {
      const axisInScope = readNumberPath(report.data, ['perAxis', axis, 'inScope']);
      const axisConformant = readNumberPath(report.data, ['perAxis', axis, 'conformant']);
      const axisDivergent = readNumberPath(report.data, ['perAxis', axis, 'divergent']);
      return `${axis}=${axisInScope ?? '?'}/${axisConformant ?? '?'}/${axisDivergent ?? '?'}`;
    })
    .join(', ');
  const detail =
    `inScope=${inScope ?? '?'}, conformant=${conformant ?? '?'}, ` +
    `divergent=${divergent ?? '?'}, scopeBoundary=${scopeBoundary ?? '?'}, ` +
    `perAxis(inScope/conformant/divergent): ${axisDetails}; bounded=${bounded ?? '?'}`;
  const condition = judgeCondition({
    id: 4,
    name: 'Non-LLM independent yardstick',
    value: problems.length === 0 ? conformanceRate : null,
    threshold: CR_CONFORMANCE_THRESHOLD,
    higherIsBetter: true,
    unverifiable: 0,
    unmeasured: problems.length > 0,
    source: report.path,
    note: appendProblems(detail, problems),
  });
  return problems.length === 0 && bounded === false
    ? { ...condition, status: 'FAIL' }
    : condition;
}

function buildConditionFive(summary: GoldenReplaySummary): GateCondition {
  const inScope = summary.total - summary.pureScopeBoundary;
  const verifiedInScopeRate = inScope === 0 ? 0 : summary.verified / inScope;
  const perDeck = Object.entries(summary.perDeck)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([deck, values]) =>
        `${deck}=${values.total}/${values.verified}/${values.pureScopeBoundary}/${values.runtimeGap}`,
    )
    .join(', ');
  const runtimeGaps =
    summary.runtimeGapCases.length === 0
      ? 'none'
      : summary.runtimeGapCases
          .map(
            (item) =>
              `${item.caseName}[${item.entries
                .map((entry) => `${entry.ref}: ${entry.reason}`)
                .join(' | ')}]`,
          )
          .join('; ');
  const details =
    `total=${summary.total}, pass=${summary.passed}, verified=${summary.verified}, ` +
    `pureScopeBoundary=${summary.pureScopeBoundary}, runtimeGap=${summary.runtimeGap}, ` +
    `inScope=${inScope}, verifiedInScopeRate=${percent(verifiedInScopeRate)}, ` +
    `perDeck(total/verified/pureScopeBoundary/runtimeGap): ${perDeck || 'none'}; ` +
    `remaining runtime-gap: ${runtimeGaps}`;
  return {
    id: 5,
    name: 'Golden replay (deck-weighted)',
    status:
      summary.error === null && inScope >= 24 && verifiedInScopeRate >= 0.7
        ? 'PASS'
        : 'FAIL',
    value: verifiedInScopeRate,
    threshold: 0.7,
    unverifiable: 0,
    source: 'research/golden-replay/cases',
    note: appendProblems(
      details,
      summary.error === null ? [] : [summary.error],
    ),
  };
}

function buildConditionSix(report: LoadedReport): GateCondition {
  const value = readNumberPath(report.data, ['summary', 'cardDivergenceRate']);
  const problems = [
    ...reportProblems([report]),
    ...(report.data !== null && value === null
      ? [`${report.path}: summary.cardDivergenceRate missing`]
      : []),
  ];
  return judgeCondition({
    id: 6,
    name: 'Classifier parity',
    value,
    threshold: 0,
    higherIsBetter: false,
    unverifiable: 0,
    unmeasured: problems.length > 0,
    source: report.path,
    note: appendProblems('研究分類器と runtime 分類器の乖離解消=M-GATE-2', problems),
  });
}

function buildConditionSeven(
  result: GateScorecard['unverifiable'],
  reports: { name: string; report: LoadedReport }[],
): GateCondition {
  const problems = reports.flatMap(({ report }) => {
    const fieldsMissing =
      report.data !== null &&
      (readNumberPath(report.data, ['unverifiableRate']) === null ||
        readNumberPath(report.data, ['sampleSize']) === null);
    return [
      ...reportProblems([report]),
      ...(fieldsMissing ? [`${report.path}: unverifiableRate/sampleSize missing`] : []),
    ];
  });
  const complete = problems.length === 0 && result.perOracle.length === reports.length;
  const detail = result.perOracle
    .map((oracle) => `${oracle.name}=${percent(oracle.rate)}(n=${oracle.sampleSize})`)
    .join(', ');

  return judgeCondition({
    id: 7,
    name: 'Unverifiable rate',
    value: complete ? result.weightedMean : null,
    threshold: UNVERIFIABLE_CEILING,
    higherIsBetter: false,
    unverifiable: complete ? result.weightedMean : 0,
    unverifiableIsMetric: true,
    unmeasured: !complete,
    source: reports.map(({ report }) => report.path).join(', '),
    note: appendProblems(
      `max=${percent(result.max)}; per-oracle: ${detail || 'unmeasured'}; golden-replay 検証不能は条件5へ分離`,
      problems,
    ),
  });
}

async function summarizeGoldenReplay(): Promise<GoldenReplaySummary> {
  try {
    const cases = await loadGoldenReplayCases(GOLDEN_CASE_DIRECTORY);
    const results = cases.map(replayGoldenCase);
    const perDeck: Record<string, GoldenReplayDeckSummary> = {};
    const runtimeGapCases: GoldenReplaySummary['runtimeGapCases'] = [];
    let verified = 0;
    let pureScopeBoundary = 0;
    let runtimeGap = 0;

    for (const [index, testCase] of cases.entries()) {
      const classification = classifyGoldenReplay(testCase.unverifiable);
      const deck = (perDeck[testCase.sourceDeck] ??= {
        total: 0,
        verified: 0,
        pureScopeBoundary: 0,
        runtimeGap: 0,
      });
      deck.total += 1;
      if (classification.verified) {
        verified += 1;
        deck.verified += 1;
      }
      if (classification.pureScopeBoundary) {
        pureScopeBoundary += 1;
        deck.pureScopeBoundary += 1;
      }
      if (classification.runtimeGap) {
        runtimeGap += 1;
        deck.runtimeGap += 1;
        runtimeGapCases.push({
          caseName: results[index]?.caseName ?? testCase.name,
          entries: testCase.unverifiable ?? [],
        });
      }
    }

    const passed = results.filter((result) => result.pass).length;
    return {
      total: results.length,
      passed,
      verified,
      pureScopeBoundary,
      runtimeGap,
      perDeck,
      runtimeGapCases,
      error: results.length === 0 ? 'golden replay cases missing' : null,
    };
  } catch (error: unknown) {
    return {
      total: 0,
      passed: 0,
      verified: 0,
      pureScopeBoundary: 0,
      runtimeGap: 0,
      perDeck: {},
      runtimeGapCases: [],
      error: `golden replay unavailable: ${errorMessage(error)}`,
    };
  }
}

async function loadReport(path: string): Promise<LoadedReport> {
  try {
    const source = await readFile(resolve(process.cwd(), path), 'utf8');
    return { path, data: JSON.parse(source) as unknown, error: null };
  } catch (error: unknown) {
    return { path, data: null, error: errorMessage(error) };
  }
}

async function loadCrGroundingOverlay(): Promise<CrGroundingOverlay | null> {
  try {
    const source = await readFile(CR_GROUNDING_OVERLAY_PATH, 'utf8');
    return JSON.parse(source) as CrGroundingOverlay;
  } catch {
    return null;
  }
}

function requiredReport(reports: Map<string, LoadedReport>, path: string): LoadedReport {
  return reports.get(path) ?? { path, data: null, error: 'report was not loaded' };
}

function readNumberPath(value: unknown, path: string[]): number | null {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

function readBooleanPath(value: unknown, path: string[]): boolean | null {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'boolean' ? current : null;
}

function readRecordPath(value: unknown, path: string[]): Record<string, unknown> | null {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function sumRecordField(record: Record<string, unknown> | null, field: string): number {
  if (record === null) return 0;
  let sum = 0;
  for (const item of Object.values(record)) {
    const value = isRecord(item) ? item[field] : null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value;
    }
  }
  return sum;
}

function reportProblems(reports: LoadedReport[]): string[] {
  return reports.flatMap((report) =>
    report.error === null ? [] : [`${report.path}: ${report.error}`],
  );
}

function appendProblems(note: string, problems: string[]): string {
  return problems.length === 0 ? note : `${note}; unavailable: ${problems.join(' | ')}`;
}

function renderMarkdown(scorecard: GateScorecard): string {
  const lines = [
    '# M-CONTRACT Gate Scorecard',
    '',
    `Generated: ${scorecard.generatedAt}`,
    '',
    '## Conditions',
    '',
    '| ID | Condition | Status | Value | Threshold | Unverifiable | Source | Note |',
    '| ---: | --- | --- | ---: | ---: | ---: | --- | --- |',
    ...scorecard.conditions.map(
      (condition) =>
        `| ${condition.id} | ${cell(condition.name)} | ${condition.status} | ${formatMetric(condition.value)} | ${formatMetric(condition.threshold)} | ${percent(condition.unverifiable)} | ${cell(condition.source)} | ${cell(condition.note)} |`,
    ),
    '',
    '## Head Coverage',
    '',
    `- Aggregate: ${percent(scorecard.headCoverage.aggregate)}`,
    `- Threshold: ${percent(scorecard.headCoverage.threshold)}`,
    '',
    '| Axis | Escape box | Total | Escape frequency | Coverage | Oracle-gated |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...scorecard.headCoverage.axes.map(
      (axis) =>
        `| ${cell(axis.axis)} | ${axis.escapeBox ?? '-'} | ${axis.total} | ${axis.escapeFreq} | ${axis.coverage === null ? 'oracle-gated' : percent(axis.coverage)} | ${axis.oracleGated ? 'yes' : 'no'} |`,
    ),
    '',
    '## Unverifiable Rate',
    '',
    `- Weighted mean: ${percent(scorecard.unverifiable.weightedMean)}`,
    `- Maximum: ${percent(scorecard.unverifiable.max)}`,
    `- Ceiling: ${percent(scorecard.unverifiable.ceiling)}`,
    '',
    '| Oracle | Sample size | Rate |',
    '| --- | ---: | ---: |',
    ...scorecard.unverifiable.perOracle.map(
      (oracle) => `| ${cell(oracle.name)} | ${oracle.sampleSize} | ${percent(oracle.rate)} |`,
    ),
    '',
    ...renderCrGroundingOverlay(scorecard),
    '',
    '## Verdict',
    '',
    `- Legacy seven-condition verdict: ${scorecard.legacyFrozen === true ? 'FROZEN' : 'NOT FROZEN'}`,
    `- CR-grounding overlay: ${scorecard.crGroundingOverlayApproved === true ? 'APPROVED' : 'NOT APPROVED'}`,
    ...(scorecard.crGroundingOverlayProblems !== undefined &&
    scorecard.crGroundingOverlayProblems.length > 0
      ? [
          '',
          '### CR-grounding Overlay Problems',
          '',
          ...scorecard.crGroundingOverlayProblems.map((problem) => `- ${problem}`),
          '',
        ]
      : []),
    `**${scorecard.frozen ? 'FROZEN' : 'NOT FROZEN'}**`,
    '',
    '> M-CR-RECONCILE overlay is included. `PARTIAL`, `PASS(core)`, and `PASS(boundary)` are not plain PASS; remaining boundaries are displayed below and must remain out of green coverage.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCrGroundingOverlay(scorecard: GateScorecard): string[] {
  if (scorecard.crGroundingOverlay === undefined) {
    return ['## CR-grounding Overlay', '', 'CR-grounding overlay missing.', ''];
  }

  const overlay = scorecard.crGroundingOverlay;
  return [
    '## CR-grounding Overlay',
    '',
    `- CR version: ${cell(overlay.crVersion)}`,
    `- Overlay status: ${cell(overlay.status)}`,
    '',
    '| ID | Name | Status | Freeze treatment | Evidence | Remaining boundary |',
    '| --- | --- | --- | --- | --- | --- |',
    ...overlay.overlayConditions.map(
      (condition) =>
        `| ${cell(condition.id)} | ${cell(condition.name)} | ${cell(condition.status)} | ${cell(condition.freezeTreatment)} | ${cell(condition.evidence.join(', '))} | ${cell(condition.remainingBoundary ?? '-')} |`,
    ),
    '',
    '## R-FREEZE Designs',
    '',
    '| ID | Status | Artifact | Decision direction |',
    '| --- | --- | --- | --- |',
    ...overlay.rFreezeDesigns.map(
      (design) =>
        `| ${cell(design.id)} | ${cell(design.status)} | ${cell(design.artifact)} | ${cell(design.decisionDirection)} |`,
    ),
    '',
  ];
}

function formatMetric(value: number | null): string {
  return value === null ? '-' : percent(value);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
