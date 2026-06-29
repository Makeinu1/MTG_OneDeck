import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { isDeepStrictEqual } from 'node:util';

const sourceOverlayPath = 'research/cr-grounding/m0-freeze-overlay.json';
const scorecardJsonPath = 'research/m-contract-gate/scorecard.json';
const scorecardMarkdownPath = 'research/m-contract-gate/scorecard.md';
const executionQueuePath = 'research/cr-grounding/m0-freeze-execution-queue.md';

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function requireIncludes(label, source, needle, problems) {
  if (!source.includes(needle)) {
    problems.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function requireCommandPass(label, result, problems) {
  if (result.status !== 0) {
    problems.push(`${label}: failed\n${output(result) || '(no output)'}`);
  }
}

function comparableOverlay(overlay) {
  return {
    crVersion: overlay.crVersion,
    status: overlay.status,
    overlayConditions: overlay.overlayConditions?.map((condition) => ({
      id: condition.id,
      name: condition.name,
      status: condition.status,
      evidence: condition.evidence,
      freezeTreatment: condition.freezeTreatment,
      remainingBoundary: condition.remainingBoundary,
    })),
    rFreezeDesigns: overlay.rFreezeDesigns?.map((design) => ({
      id: design.id,
      artifact: design.artifact,
      status: design.status,
      decisionDirection: design.decisionDirection,
    })),
  };
}

const problems = [];
const sourceOverlay = readJson(sourceOverlayPath);
const scorecard = readJson(scorecardJsonPath);
const markdown = read(scorecardMarkdownPath);
const queue = read(executionQueuePath);

requireCommandPass(
  'Q1 docs contract verifier',
  run(process.execPath, ['research/cr-grounding/verify-q1-docs-contract.mjs']),
  problems,
);
requireCommandPass(
  'Q2 scorecard output verifier',
  run(process.execPath, ['research/cr-grounding/verify-q2-scorecard-output.mjs']),
  problems,
);

if (typeof scorecard.legacyFrozen !== 'boolean') {
  problems.push(`${scorecardJsonPath}: legacyFrozen must be boolean`);
}

if (typeof scorecard.crGroundingOverlayApproved !== 'boolean') {
  problems.push(`${scorecardJsonPath}: crGroundingOverlayApproved must be boolean`);
}

if (!Array.isArray(scorecard.crGroundingOverlayProblems)) {
  problems.push(`${scorecardJsonPath}: crGroundingOverlayProblems must be an array`);
}

if (
  typeof scorecard.legacyFrozen === 'boolean' &&
  typeof scorecard.crGroundingOverlayApproved === 'boolean' &&
  scorecard.frozen !== (scorecard.legacyFrozen && scorecard.crGroundingOverlayApproved)
) {
  problems.push(`${scorecardJsonPath}: frozen must equal legacyFrozen && crGroundingOverlayApproved`);
}

if (
  scorecard.crGroundingOverlay === undefined ||
  !isDeepStrictEqual(
    comparableOverlay(scorecard.crGroundingOverlay),
    comparableOverlay(sourceOverlay),
  )
) {
  problems.push(`${scorecardJsonPath}: embedded crGroundingOverlay must match ${sourceOverlayPath}`);
}

for (const condition of sourceOverlay.overlayConditions ?? []) {
  if (['PARTIAL', 'PASS(core)', 'PASS(boundary)'].includes(condition.status)) {
    if (
      typeof condition.remainingBoundary !== 'string' ||
      condition.remainingBoundary.trim().length === 0
    ) {
      problems.push(`${sourceOverlayPath}: ${condition.id} requires remainingBoundary`);
    }
  }
}

for (const needle of [
  '## CR-grounding Overlay',
  '## R-FREEZE Designs',
  'PARTIAL',
  'PASS(core)',
  'PASS(boundary)',
  'M-CR-RECONCILE overlay is included',
]) {
  requireIncludes(scorecardMarkdownPath, markdown, needle, problems);
}

if (markdown.includes('Superseded on 2026-06-26')) {
  problems.push(`${scorecardMarkdownPath}: old superseded note is still present`);
}

for (const needle of [
  'research/cr-grounding/m0-freeze-overlay.json',
  'legacyFrozen',
  'crGroundingOverlayApproved',
  'frozen = legacyFrozen && crGroundingOverlayApproved',
  'PARTIAL',
  'PASS(core)',
  'PASS(boundary)',
  'remainingBoundary',
]) {
  requireIncludes('docs/engine-spec.md', read('docs/engine-spec.md'), needle, problems);
}

for (const needle of [
  'PARTIAL',
  'PASS(core)',
  'PASS(boundary)',
  'Acceptance rule',
  'research/cr-grounding/m0-freeze-overlay.json',
]) {
  requireIncludes('docs/acceptance.md', read('docs/acceptance.md'), needle, problems);
}

const finalApprovalRecorded =
  !queue.includes('| M0-FREEZE final approval | Pending |') &&
  /M0-FREEZE final approval.*(Approved|approved|Done|done)/.test(queue);

if (problems.length > 0) {
  console.error('Q4 Codex audit verification failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Q4 Codex audit verification passed.');
console.log(`Fable final approval: ${finalApprovalRecorded ? 'recorded' : 'not recorded'}`);
if (!finalApprovalRecorded) {
  console.log('Next action: Fable must record M0-FREEZE final approval before Q5.');
}
