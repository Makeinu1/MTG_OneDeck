import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  classifyGoldenReplay,
  formatGoldenReplayDiffs,
  replayGoldenCase,
  type GoldenReplayCase,
  type GoldenReplayResult,
} from '../src/engine/goldenReplay.ts';
import { loadGoldenReplayCases } from './lib/goldenReplayLoader.ts';

const CASE_DIRECTORY = resolve(process.cwd(), 'research/golden-replay/cases');
const REPORT_PATH = resolve(process.cwd(), 'research/golden-replay/report.md');

async function main(): Promise<void> {
  const cases = await loadGoldenReplayCases(CASE_DIRECTORY);
  const results = cases.map(replayGoldenCase);
  const report = renderReport(cases, results);

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report, 'utf8');

  const passed = results.filter((result) => result.pass).length;
  console.log(`Golden replay report written: ${relative(process.cwd(), REPORT_PATH)}`);
  console.log(`cases=${results.length} pass=${passed} fail=${results.length - passed}`);
}

function renderReport(
  cases: readonly GoldenReplayCase[],
  results: readonly GoldenReplayResult[],
): string {
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;
  const entries = cases.map((testCase, index) => ({
    testCase,
    result: results[index],
    classification: classifyGoldenReplay(testCase.unverifiable),
  }));
  const verified = entries.filter((entry) => entry.classification.verified).length;
  const pureScopeBoundary = entries.filter(
    (entry) => entry.classification.pureScopeBoundary,
  ).length;
  const runtimeGap = entries.filter((entry) => entry.classification.runtimeGap).length;
  const inScope = entries.length - pureScopeBoundary;
  const verifiedInScopeRate = inScope === 0 ? 0 : verified / inScope;
  const perDeck = new Map<
    string,
    { total: number; verified: number; pureScopeBoundary: number; runtimeGap: number }
  >();
  for (const entry of entries) {
    const summary = perDeck.get(entry.testCase.sourceDeck) ?? {
      total: 0,
      verified: 0,
      pureScopeBoundary: 0,
      runtimeGap: 0,
    };
    summary.total += 1;
    if (entry.classification.verified) summary.verified += 1;
    if (entry.classification.pureScopeBoundary) summary.pureScopeBoundary += 1;
    if (entry.classification.runtimeGap) summary.runtimeGap += 1;
    perDeck.set(entry.testCase.sourceDeck, summary);
  }
  const lines = [
    '# Golden Replay Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Cases: ${results.length}`,
    `- PASS: ${passed}`,
    `- FAIL: ${failed}`,
    `- Verified: ${verified}`,
    `- Pure scope-boundary: ${pureScopeBoundary}`,
    `- Runtime-gap: ${runtimeGap}`,
    `- In-scope: ${inScope}`,
    `- Verified in-scope rate: ${percent(verifiedInScopeRate)}`,
    '',
    '## Per Deck',
    '',
    '| Source deck | Total | Verified | Pure scope-boundary | Runtime-gap |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...[...perDeck.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([deck, summary]) =>
          `| ${cell(deck)} | ${summary.total} | ${summary.verified} | ${summary.pureScopeBoundary} | ${summary.runtimeGap} |`,
      ),
    '',
    '## Cases',
    '',
    '| Case | Source deck | Result | Classification | Events | Trigger candidates | Unverifiable |',
    '| --- | --- | --- | --- | ---: | ---: | ---: |',
    ...entries.map(
      ({ testCase, result, classification }) =>
        `| ${cell(testCase.name)} | ${cell(testCase.sourceDeck)} | ${result?.pass ? 'PASS' : 'FAIL'} | ${classificationLabel(classification)} | ${result?.events.length ?? 0} | ${result?.triggerCandidates.length ?? 0} | ${testCase.unverifiable?.length ?? 0} |`,
    ),
    '',
    '## Differences',
    '',
  ];

  const failures = results.filter((result) => !result.pass);
  if (failures.length === 0) {
    lines.push('- none', '');
  } else {
    for (const result of failures) {
      lines.push(
        `### ${result.caseName}`,
        '',
        '```text',
        formatGoldenReplayDiffs(result.diffs),
        '```',
        '',
      );
    }
  }

  lines.push('## Unverifiable Behavior', '');
  const unverifiable = cases.flatMap((testCase) =>
    (testCase.unverifiable ?? []).map((entry) => ({
      caseName: testCase.name,
      entry,
    })),
  );
  if (unverifiable.length === 0) {
    lines.push('- none', '');
  } else {
    for (const item of unverifiable) {
      lines.push(
        `- ${cell(item.caseName)} [${item.entry.kind}] (${cell(item.entry.ref)}): ${cell(item.entry.reason)}`,
      );
    }
    lines.push('');
  }

  lines.push('## Notes', '');
  const notes = cases.flatMap((testCase) =>
    (testCase.notes ?? []).map((note) => ({ caseName: testCase.name, note })),
  );
  if (notes.length === 0) {
    lines.push('- none', '');
  } else {
    for (const item of notes) {
      lines.push(`- ${cell(item.caseName)}: ${cell(item.note)}`);
    }
    lines.push('');
  }

  lines.push(
    '## Measurement Notes',
    '',
    '- Execution events are deterministic state-transition records derived before and after each `applyCommand` call.',
    '- Trigger candidates use the same pure detector as the runtime store.',
    '- Remaining stack items are resolved after the listed command sequence unless `autoResolveStack` is false.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function classificationLabel(
  classification: ReturnType<typeof classifyGoldenReplay>,
): string {
  if (classification.verified) return 'verified';
  if (classification.pureScopeBoundary) return 'pureScopeBoundary';
  return 'runtimeGap';
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
