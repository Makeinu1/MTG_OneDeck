import { readFileSync } from 'node:fs';
import process from 'node:process';

const path = 'research/cr-grounding/m0-freeze-decision-record.md';
const source = readFileSync(path, 'utf8');
const problems = [];

if (!source.includes('**Decision status: Approved to contract-update stage by Fable.**')) {
  problems.push('decision status is not approved to contract-update stage by Fable');
}

for (const decision of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
  const row = source
    .split('\n')
    .find((line) => line.startsWith(`| ${decision}:`));
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

if (problems.length > 0) {
  console.error('Q1 decision record verification failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Q1 decision record verification passed.');
