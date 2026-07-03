import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const jsonFiles = [
  'research/cr-grounding/m0-freeze-overlay.json',
  'research/cr-grounding/golden-cases.json',
  'research/m-contract-gate/scorecard.json',
];

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function parseJsonFiles(problems) {
  for (const path of jsonFiles) {
    try {
      JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push(`${path}: JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function fileIncludes(path, needle) {
  try {
    return readFileSync(path, 'utf8').includes(needle);
  } catch {
    return false;
  }
}

function summarizeCommand(label, result, problems, options = {}) {
  const expectFailure = options.expectFailure === true;
  const ok = expectFailure ? result.status !== 0 : result.status === 0;
  if (!ok) {
    problems.push(`${label}: unexpected ${expectFailure ? 'success' : 'failure'}\n${output(result)}`);
  }
  return ok;
}

const problems = [];
parseJsonFiles(problems);

const q1Docs = run(process.execPath, ['research/cr-grounding/verify-q1-docs-contract.mjs']);
const q1Applied = q1Docs.status === 0;
const q1Decision = run(process.execPath, ['research/cr-grounding/verify-q1-decision-record.mjs']);
const q1DecisionRecorded = q1Decision.status === 0;

const q2Applied =
  fileIncludes('scripts/lib/mContractGate.ts', 'export function judgeCrGroundingOverlay') &&
  fileIncludes('scripts/m-contract-gate.ts', 'CR_GROUNDING_OVERLAY_PATH');

let nextAction = '';

if (!q1Applied) {
  const q1DecisionPatchCheck = run('git', [
    'apply',
    '--check',
    'research/cr-grounding/q1-decision-record-approve.patch',
  ]);
  const q1DecisionEffect = run(process.execPath, [
    'research/cr-grounding/verify-q1-decision-patch-effect.mjs',
  ]);
  const q1Ready = run(process.execPath, ['research/cr-grounding/verify-q1-patch-ready.mjs']);
  const q1Effect = run(process.execPath, ['research/cr-grounding/verify-q1-patch-effect.mjs']);
  const q2PatchCheck = run('git', ['apply', '--check', 'research/cr-grounding/q2-scorecard-overlay.patch']);
  const q2Effect = run(process.execPath, ['research/cr-grounding/verify-q2-patch-effect.mjs']);
  const q2Ready = run(process.execPath, ['research/cr-grounding/verify-q2-patch-ready.mjs']);

  if (!q1DecisionRecorded) {
    summarizeCommand('Q1 decision record patch applies', q1DecisionPatchCheck, problems);
    summarizeCommand('Q1 decision record patch effect', q1DecisionEffect, problems);
  }
  summarizeCommand('Q1 patch readiness', q1Ready, problems);
  summarizeCommand('Q1 patch effect', q1Effect, problems);
  summarizeCommand('Q2 patch applies to codebase', q2PatchCheck, problems);
  summarizeCommand('Q2 patch effect', q2Effect, problems);
  summarizeCommand('Q2 readiness before Q1', q2Ready, problems, { expectFailure: true });

  nextAction =
    'Fable: record D1-D6 decision, apply Q1 docs contract patch, then run Q1 verifiers and review.m-contract-gate.';
} else if (!q1DecisionRecorded) {
  const q1DecisionPatchCheck = run('git', [
    'apply',
    '--check',
    'research/cr-grounding/q1-decision-record-approve.patch',
  ]);
  const q1DecisionEffect = run(process.execPath, [
    'research/cr-grounding/verify-q1-decision-patch-effect.mjs',
  ]);

  summarizeCommand('Q1 decision record patch applies', q1DecisionPatchCheck, problems);
  summarizeCommand('Q1 decision record patch effect', q1DecisionEffect, problems);

  nextAction =
    'Fable: record D1-D6 decision, then run Q1 decision verifier and review.m-contract-gate.';
} else if (!q2Applied) {
  const q2Ready = run(process.execPath, ['research/cr-grounding/verify-q2-patch-ready.mjs']);
  const q2Effect = run(process.execPath, ['research/cr-grounding/verify-q2-patch-effect.mjs']);

  summarizeCommand('Q2 patch readiness', q2Ready, problems);
  summarizeCommand('Q2 patch effect', q2Effect, problems);

  nextAction = 'Codex: apply Q2 scorecard overlay patch, then run overlay tests and regenerate scorecard.';
} else {
  nextAction = 'Codex/Fable: run scorecard regeneration and M0-FREEZE audit.';
}

if (problems.length > 0) {
  console.error('M0-FREEZE preflight failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('M0-FREEZE preflight passed.');
console.log(`Q1 docs contract: ${q1Applied ? 'applied' : 'not applied'}`);
console.log(`Q1 decision record: ${q1DecisionRecorded ? 'recorded' : 'not recorded'}`);
console.log(`Q2 scorecard overlay wiring: ${q2Applied ? 'applied' : 'not applied'}`);
console.log(`Next action: ${nextAction}`);
