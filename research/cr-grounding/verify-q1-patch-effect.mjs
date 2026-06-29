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

import {
  printQ1DocsContractResult,
  verifyQ1DocsContract,
} from './verify-q1-docs-contract.mjs';

const patchPath = resolve('research/cr-grounding/q1-docs-contract.patch');

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

const workdir = mkdtempSync(join(tmpdir(), 'mtg-q1-patch-effect-'));

function main() {
  mkdirSync(join(workdir, 'docs'), { recursive: true });
  copyFileSync('docs/engine-spec.md', join(workdir, 'docs/engine-spec.md'));
  copyFileSync('docs/acceptance.md', join(workdir, 'docs/acceptance.md'));

  const patchResult = run('git', ['apply', patchPath], workdir);
  if (patchResult.status !== 0) {
    console.error('Q1 patch effect verification failed: patch did not apply to temp docs.');
    console.error(output(patchResult) || '(no output)');
    process.exitCode = 1;
    return;
  }

  const problems = verifyQ1DocsContract({
    engineSpec: readFileSync(join(workdir, 'docs/engine-spec.md'), 'utf8'),
    acceptance: readFileSync(join(workdir, 'docs/acceptance.md'), 'utf8'),
    engineSpecLabel: 'temp/docs/engine-spec.md',
    acceptanceLabel: 'temp/docs/acceptance.md',
  });

  if (!printQ1DocsContractResult(problems)) {
    process.exitCode = 1;
    return;
  }

  console.log('Q1 patch effect verification passed on temp docs.');
}

try {
  main();
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
