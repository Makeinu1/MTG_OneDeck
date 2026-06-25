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
  judgeFrozen,
  type AxisCoverage,
  type GateCondition,
  type GateScorecard,
} from './lib/mContractGate.ts';

const REPORT_DIRECTORY = resolve(process.cwd(), 'research/m-contract-gate');
const REPORT_JSON_PATH = resolve(REPORT_DIRECTORY, 'scorecard.json');
const REPORT_MD_PATH = resolve(REPORT_DIRECTORY, 'scorecard.md');
const GOLDEN_CASE_DIRECTORY = resolve(process.cwd(), 'research/golden-replay/cases');

const REPORT_PATHS = {
  layerCoverage: 'research/layer-coverage/report.json',
  eventCoverage: 'research/event-coverage/report.json',
  zoneCoverage: 'research/zone-coverage/report.json',
  timingCoverage: 'research/timing-coverage/report.json',
  classifierParity: 'research/classifier-parity/report.json',
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
    buildConditionFour(),
    buildConditionFive(goldenReplay),
    buildConditionSix(classifierParity),
    buildConditionSeven(unverifiable, oracleReports),
  ].sort((left, right) => left.id - right.id);

  const scorecard: GateScorecard = {
    generatedAt: new Date().toISOString(),
    conditions,
    frozen: judgeFrozen(conditions),
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
      '下面抽出単独 churn=§4 では弱い陽性のみ。post-independent-yardstick churn は per-slice oracle log 参照',
      problems,
    ),
  });
}

function buildConditionFour(): GateCondition {
  return judgeCondition({
    id: 4,
    name: 'Non-LLM independent yardstick',
    value: null,
    threshold: null,
    higherIsBetter: true,
    unverifiable: 0,
    source: 'research/cr-conformance-audit.md',
    note: 'CR真理テーブル/cr-conformance-audit.md を代表カード集合へ体系化=M-GATE-2',
  });
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
    '## Verdict',
    '',
    `**${scorecard.frozen ? 'FROZEN' : 'NOT FROZEN'}**`,
    '',
  ];
  return `${lines.join('\n')}\n`;
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
