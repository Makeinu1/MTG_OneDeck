import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  formatGoldenReplayDiffs,
  replayGoldenCase,
  type GoldenReplayResult,
} from '../src/engine/goldenReplay.ts';
import { loadGoldenReplayCases } from './lib/goldenReplayLoader.ts';

const CASE_DIRECTORY = resolve(process.cwd(), 'research/golden-replay/cases');
const REPORT_PATH = resolve(process.cwd(), 'research/golden-replay/report.md');

async function main(): Promise<void> {
  const cases = await loadGoldenReplayCases(CASE_DIRECTORY);
  const results = cases.map(replayGoldenCase);
  const report = renderReport(results);

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report, 'utf8');

  const passed = results.filter((result) => result.pass).length;
  console.log(`Golden replay report written: ${relative(process.cwd(), REPORT_PATH)}`);
  console.log(`cases=${results.length} pass=${passed} fail=${results.length - passed}`);
}

function renderReport(results: readonly GoldenReplayResult[]): string {
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;
  const limited = results.filter((result) => result.limitations.length > 0).length;
  const limitationRate = results.length === 0 ? 0 : limited / results.length;
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
    `- Cases with unverifiable behavior: ${limited} (${percent(limitationRate)})`,
    '',
    '| Case | Source deck | Result | Events | Trigger candidates | Limitations |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...results.map(
      (result) =>
        `| ${cell(result.caseName)} | ${cell(result.sourceDeck)} | ${result.pass ? 'PASS' : 'FAIL'} | ${result.events.length} | ${result.triggerCandidates.length} | ${result.limitations.length} |`,
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
  const limitations = results.flatMap((result) =>
    result.limitations.map((limitation) => ({
      caseName: result.caseName,
      limitation,
    })),
  );
  if (limitations.length === 0) {
    lines.push('- none', '');
  } else {
    for (const item of limitations) {
      lines.push(`- ${cell(item.caseName)}: ${cell(item.limitation)}`);
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
