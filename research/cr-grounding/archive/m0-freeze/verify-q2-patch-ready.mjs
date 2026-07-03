import { spawnSync } from 'node:child_process';
import process from 'node:process';

const q1Verifier = 'research/cr-grounding/verify-q1-docs-contract.mjs';
const q2Patch = 'research/cr-grounding/q2-scorecard-overlay.patch';

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

const q1Result = run(process.execPath, [q1Verifier]);
const q2PatchResult = run('git', ['apply', '--check', q2Patch]);

if (q1Result.status !== 0) {
  console.error('Q2 patch is not ready to apply: Q1 docs contract is not applied yet.');
  console.error('');
  console.error(
    q2PatchResult.status === 0
      ? 'Q2 patch currently applies to the codebase, but must wait for Q1.'
      : 'Q2 patch does not currently apply cleanly.',
  );
  if (q2PatchResult.status !== 0) {
    console.error(output(q2PatchResult) || '(no q2 patch output)');
  }
  process.exit(1);
}

if (q2PatchResult.status !== 0) {
  console.error('Q2 patch is authorized by Q1 state, but does not apply cleanly.');
  console.error(output(q2PatchResult) || '(no q2 patch output)');
  process.exit(1);
}

console.log('Q2 patch is ready to apply.');
console.log('Next: git apply research/cr-grounding/q2-scorecard-overlay.patch');
