import { readFileSync } from 'node:fs';
import process from 'node:process';

const jsonPath = 'research/m-contract-gate/scorecard.json';
const markdownPath = 'research/m-contract-gate/scorecard.md';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function requireIncludes(label, source, needle, problems) {
  if (!source.includes(needle)) {
    problems.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const problems = [];
const scorecard = readJson(jsonPath);
const markdown = read(markdownPath);

for (const key of [
  'legacyFrozen',
  'crGroundingOverlay',
  'crGroundingOverlayApproved',
  'crGroundingOverlayProblems',
  'frozen',
]) {
  if (!(key in scorecard)) {
    problems.push(`${jsonPath}: missing ${key}`);
  }
}

if (typeof scorecard.legacyFrozen !== 'boolean') {
  problems.push(`${jsonPath}: legacyFrozen must be boolean`);
}

if (typeof scorecard.crGroundingOverlayApproved !== 'boolean') {
  problems.push(`${jsonPath}: crGroundingOverlayApproved must be boolean`);
}

if (
  typeof scorecard.legacyFrozen === 'boolean' &&
  typeof scorecard.crGroundingOverlayApproved === 'boolean' &&
  scorecard.frozen !== (scorecard.legacyFrozen && scorecard.crGroundingOverlayApproved)
) {
  problems.push(`${jsonPath}: frozen must equal legacyFrozen && crGroundingOverlayApproved`);
}

if (!Array.isArray(scorecard.crGroundingOverlayProblems)) {
  problems.push(`${jsonPath}: crGroundingOverlayProblems must be an array`);
} else if (scorecard.crGroundingOverlayProblems.length !== 0) {
  problems.push(
    `${jsonPath}: current overlay should have no approval problems, got ${scorecard.crGroundingOverlayProblems.join(' | ')}`,
  );
}

if (!isRecord(scorecard.crGroundingOverlay)) {
  problems.push(`${jsonPath}: crGroundingOverlay must be an object`);
} else {
  const overlay = scorecard.crGroundingOverlay;
  if (overlay.crVersion !== '2026-06-19') {
    problems.push(`${jsonPath}: crGroundingOverlay.crVersion must be 2026-06-19`);
  }
  if (!Array.isArray(overlay.overlayConditions)) {
    problems.push(`${jsonPath}: crGroundingOverlay.overlayConditions must be an array`);
  } else {
    const ids = new Set(overlay.overlayConditions.map((condition) => condition.id));
    for (const id of ['CRG-1', 'CRG-2', 'CRG-3', 'CRG-4', 'CRG-4.5', 'CRG-5', 'CRG-6', 'CRG-7', 'CRG-8']) {
      if (!ids.has(id)) {
        problems.push(`${jsonPath}: overlay condition ${id} missing`);
      }
    }

    const statuses = new Set(overlay.overlayConditions.map((condition) => condition.status));
    for (const status of ['PARTIAL', 'PASS(core)', 'PASS(boundary)']) {
      if (!statuses.has(status)) {
        problems.push(`${jsonPath}: overlay status ${status} missing`);
      }
    }

    for (const condition of overlay.overlayConditions) {
      if (['PARTIAL', 'PASS(core)', 'PASS(boundary)'].includes(condition.status)) {
        if (
          typeof condition.remainingBoundary !== 'string' ||
          condition.remainingBoundary.trim().length === 0
        ) {
          problems.push(`${jsonPath}: ${condition.id} requires remainingBoundary`);
        }
      }
    }
  }

  if (!Array.isArray(overlay.rFreezeDesigns) || overlay.rFreezeDesigns.length < 4) {
    problems.push(`${jsonPath}: crGroundingOverlay.rFreezeDesigns must contain R-FREEZE-1..4`);
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
  requireIncludes(markdownPath, markdown, needle, problems);
}

if (markdown.includes('Superseded on 2026-06-26')) {
  problems.push(`${markdownPath}: old superseded note is still present`);
}

if (problems.length > 0) {
  console.error('Q2 scorecard output verification failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Q2 scorecard output verification passed.');
