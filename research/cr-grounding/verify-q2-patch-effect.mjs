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

const patchPath = resolve('research/cr-grounding/q2-scorecard-overlay.patch');

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function requireIncludes(label, source, needle, problems) {
  if (!source.includes(needle)) {
    problems.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function read(path) {
  return readFileSync(path, 'utf8');
}

const workdir = mkdtempSync(join(tmpdir(), 'mtg-q2-patch-effect-'));

function main() {
  mkdirSync(join(workdir, 'scripts/lib'), { recursive: true });
  mkdirSync(join(workdir, 'src/engine/__tests__'), { recursive: true });
  copyFileSync('scripts/lib/mContractGate.ts', join(workdir, 'scripts/lib/mContractGate.ts'));
  copyFileSync('scripts/m-contract-gate.ts', join(workdir, 'scripts/m-contract-gate.ts'));

  const patchResult = run('git', ['apply', patchPath], workdir);
  if (patchResult.status !== 0) {
    console.error('Q2 patch effect verification failed: patch did not apply to temp files.');
    console.error(output(patchResult) || '(no output)');
    process.exitCode = 1;
    return;
  }

  const lib = read(join(workdir, 'scripts/lib/mContractGate.ts'));
  const cli = read(join(workdir, 'scripts/m-contract-gate.ts'));
  const test = read(join(workdir, 'src/engine/__tests__/m-contract-gate-overlay.test.ts'));
  const patch = read(patchPath);
  const problems = [];

  for (const needle of [
    'export type CrGroundingStatus',
    'export interface CrGroundingOverlay',
    'export interface CrGroundingOverlayVerdict',
    'legacyFrozen?: boolean',
    'crGroundingOverlay?: CrGroundingOverlay',
    'crGroundingOverlayApproved?: boolean',
    'crGroundingOverlayProblems?: string[]',
    'export function judgeCrGroundingOverlay',
    'CR-grounding overlay missing',
    'remainingBoundary required',
    'partial treatment must be PARTIAL',
    'export function judgeTotalFrozen',
  ]) {
    requireIncludes('temp/scripts/lib/mContractGate.ts', lib, needle, problems);
  }

  for (const needle of [
    'CR_GROUNDING_OVERLAY_PATH',
    'research/cr-grounding/m0-freeze-overlay.json',
    'const crGroundingOverlay = await loadCrGroundingOverlay();',
    'const legacyFrozen = judgeFrozen(conditions);',
    'crGroundingOverlayApproved',
    'crGroundingOverlayProblems',
    'judgeTotalFrozen({ legacyFrozen',
    'function renderCrGroundingOverlay',
    '## CR-grounding Overlay',
    '## R-FREEZE Designs',
    'M-CR-RECONCILE overlay is included',
  ]) {
    requireIncludes('temp/scripts/m-contract-gate.ts', cli, needle, problems);
  }

  for (const needle of [
    'judgeCrGroundingOverlay',
    'judgeTotalFrozen',
    'missing overlay is not approved',
    'current real overlay is approved by the Q2 rules',
    'it.each([',
    'crGroundingOverlayApproved: overlayApproved',
  ]) {
    requireIncludes('temp/src/engine/__tests__/m-contract-gate-overlay.test.ts', test, needle, problems);
  }

  if (patch.includes('review.m-contract-gate.test.ts')) {
    problems.push('q2-scorecard-overlay.patch must not modify reviewer-owned review.m-contract-gate.test.ts');
  }

  if (problems.length > 0) {
    console.error('Q2 patch effect verification failed:');
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Q2 patch effect verification passed on temp files.');
}

try {
  main();
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
