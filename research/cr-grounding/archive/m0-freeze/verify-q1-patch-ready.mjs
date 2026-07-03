import { spawnSync } from 'node:child_process';
import process from 'node:process';

const docsVerifier = 'research/cr-grounding/verify-q1-docs-contract.mjs';
const patchPath = 'research/cr-grounding/q1-docs-contract.patch';

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

const docsResult = run(process.execPath, [docsVerifier]);

if (docsResult.status === 0) {
  console.log('Q1 docs contract is already applied. Do not apply q1-docs-contract.patch again.');
  console.log('Next: run review.m-contract-gate, then hand off Q2 scorecard overlay wiring.');
  process.exit(0);
}

const patchResult = run('git', ['apply', '--check', patchPath]);

if (patchResult.status === 0) {
  console.log('Q1 docs contract is not applied yet, and q1-docs-contract.patch is applicable.');
  console.log('Next for Fable: git apply research/cr-grounding/q1-docs-contract.patch');
  process.exit(0);
}

console.error('Q1 patch readiness failed.');
console.error('');
console.error('Docs verifier output:');
console.error(output(docsResult) || '(no output)');
console.error('');
console.error('Patch check output:');
console.error(output(patchResult) || '(no output)');
process.exit(1);
