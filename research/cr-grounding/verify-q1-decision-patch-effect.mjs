import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';

const patchPath = resolve('research/cr-grounding/q1-decision-record-approve.patch');

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function verifyDecisionRecord(source) {
  const problems = [];

  if (!source.includes('**Decision status: Approved to contract-update stage by Fable.**')) {
    problems.push('decision status is not approved to contract-update stage by Fable');
  }

  for (const decision of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
    const row = source.split('\n').find((line) => line.startsWith(`| ${decision}:`));
    if (row === undefined) {
      problems.push(`${decision}: decision row missing`);
      continue;
    }
    if (!row.includes('| Approve to contract-update stage |')) {
      problems.push(`${decision}: Fable decision is not Approve to contract-update stage`);
    }
  }

  if (source.includes('| Pending |')) {
    problems.push('decision table still contains Pending');
  }

  return problems;
}

const workdir = mkdtempSync(join(tmpdir(), 'mtg-q1-decision-effect-'));

function main() {
  mkdirSync(join(workdir, 'research/cr-grounding'), { recursive: true });
  copyFileSync(
    'research/cr-grounding/m0-freeze-decision-record.md',
    join(workdir, 'research/cr-grounding/m0-freeze-decision-record.md'),
  );

  const patchResult = run('git', ['apply', patchPath], workdir);
  if (patchResult.status !== 0) {
    console.error('Q1 decision patch effect verification failed: patch did not apply to temp file.');
    console.error(output(patchResult) || '(no output)');
    process.exitCode = 1;
    return;
  }

  const source = readFileSync(
    join(workdir, 'research/cr-grounding/m0-freeze-decision-record.md'),
    'utf8',
  );
  const problems = verifyDecisionRecord(source);

  if (problems.length > 0) {
    console.error('Q1 decision patch effect verification failed:');
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Q1 decision patch effect verification passed on temp file.');
}

try {
  main();
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
