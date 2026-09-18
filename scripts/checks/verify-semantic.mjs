#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildVerificationPlan } from './semantic-verification.mjs';
import { DEFAULT_ROOT } from './validation-domain-resolver.mjs';

function parseArgs(args) {
  const options = { base: null, head: 'HEAD', planOnly: false, json: false, manualEvidencePath: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base' || arg === '--head' || arg === '--manual-evidence') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--manual-evidence') options.manualEvidencePath = value;
      else options[arg.slice(2)] = value;
      index += 1;
    } else if (arg === '--plan-only') options.planOnly = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.base) throw new Error('--base is required');
  return options;
}

function validateManualEvidenceReceipt(receipt, plan) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('manual evidence receipt must be an object');
  }
  const receiptKeys = Object.keys(receipt).sort().join(',');
  if (receiptKeys !== 'base,head,results,schemaVersion') {
    throw new Error('manual evidence receipt allows only schemaVersion/base/head/results');
  }
  if (receipt.schemaVersion !== 1) throw new Error('manual evidence receipt schemaVersion must be 1');
  if (receipt.base !== plan.base) throw new Error(`manual evidence base mismatch: expected ${plan.base}`);
  if (receipt.head !== plan.head) throw new Error(`manual evidence head mismatch: expected ${plan.head}`);
  if (!Array.isArray(receipt.results)) throw new Error('manual evidence receipt results must be an array');

  const required = new Set(plan.blockers.manualRequired);
  const seen = new Set();
  const satisfied = [];
  const failed = [];

  for (const entry of receipt.results) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('manual evidence result must be an object');
    const keys = Object.keys(entry).sort().join(',');
    if (keys !== 'evidenceRef,result,scenarioId') throw new Error('manual evidence result allows only scenarioId/result/evidenceRef');
    if (typeof entry.scenarioId !== 'string' || !required.has(entry.scenarioId)) {
      throw new Error(`manual evidence scenario is not required for this candidate: ${entry.scenarioId}`);
    }
    if (seen.has(entry.scenarioId)) throw new Error(`duplicate manual evidence scenario: ${entry.scenarioId}`);
    seen.add(entry.scenarioId);
    if (!['PASS', 'FAIL'].includes(entry.result)) throw new Error(`invalid manual evidence result for ${entry.scenarioId}`);
    if (typeof entry.evidenceRef !== 'string' || entry.evidenceRef.trim() === '') {
      throw new Error(`manual evidence ${entry.scenarioId} requires evidenceRef`);
    }
    if (entry.result === 'PASS') satisfied.push(entry.scenarioId);
    else failed.push(entry.scenarioId);
  }

  return { satisfied: satisfied.sort(), failed: failed.sort() };
}

function applyManualEvidence(plan, receipt) {
  if (!receipt) return { plan, manualEvidence: { satisfied: [], failed: [] } };
  const manualEvidence = validateManualEvidenceReceipt(receipt, plan);
  const satisfied = new Set(manualEvidence.satisfied);
  return {
    plan: {
      ...plan,
      blockers: {
        ...plan.blockers,
        manualRequired: plan.blockers.manualRequired.filter((id) => !satisfied.has(id)),
        manualFailed: manualEvidence.failed,
      },
    },
    manualEvidence,
  };
}

function readManualEvidenceReceipt(path, cwd) {
  if (!path) return null;
  const parsed = JSON.parse(readFileSync(resolve(cwd, path), 'utf8'));
  return parsed;
}

function printPlan(plan) {
  console.log(`semantic verification base: ${plan.base}`);
  console.log(`semantic verification head: ${plan.head}`);
  console.log(`coverage: ${plan.coverage}`);
  console.log(`impacted semantics: ${Object.keys(plan.semanticImpact).length}`);
  for (const [id, reasons] of Object.entries(plan.semanticImpact)) {
    console.log(`  ${id}: ${reasons.join(', ')}`);
  }
  console.log(`impacted scenarios: ${Object.keys(plan.scenarioImpact).length}`);
  for (const [id, reasons] of Object.entries(plan.scenarioImpact)) {
    console.log(`  ${id}: ${reasons.join(', ')}`);
  }
  console.log(`required tests: ${plan.requiredTests.length}`);
  for (const path of plan.requiredTests) console.log(`  ${path}`);
  for (const [kind, items] of Object.entries(plan.blockers)) {
    if (items.length > 0) console.log(`${kind}: ${items.join(', ')}`);
  }
  if (plan.verificationSpecChanges.scenarios.length > 0) {
    console.log(`verification spec changed scenarios: ${plan.verificationSpecChanges.scenarios.join(', ')}`);
  }
  if (plan.verificationSpecChanges.directBindings.length > 0) {
    console.log(`verification binding changes: ${plan.verificationSpecChanges.directBindings.join(', ')}`);
  }
  console.log('semantic verdict: NOT_COMPUTED');
}

function runVitest(project, files) {
  if (files.length === 0) return 0;
  const result = spawnSync('npx', ['vitest', 'run', '--project', project, ...files], {
    cwd: DEFAULT_ROOT,
    stdio: 'inherit',
    shell: false,
  });
  return result.status ?? 1;
}

export { applyManualEvidence, validateManualEvidenceReceipt };

export function runSemanticVerification({
  cwd = DEFAULT_ROOT,
  base,
  head = 'HEAD',
  execute = true,
  writePlan = true,
  manualEvidenceReceipt = null,
} = {}) {
  const rawPlan = buildVerificationPlan({ cwd, base, head });
  const applied = applyManualEvidence(rawPlan, manualEvidenceReceipt);
  const plan = applied.plan;
  if (writePlan) printPlan(plan);

  let testExitCode = 0;
  if (execute) {
    for (const project of ['core', 'dom']) {
      const code = runVitest(project, plan.testsByProject[project]);
      if (code !== 0) {
        testExitCode = code;
        break;
      }
    }
  }

  const blockers = Object.values(plan.blockers).some((items) => items.length > 0);
  const exitCode = testExitCode !== 0 ? testExitCode : blockers ? 1 : 0;
  return {
    exitCode,
    testExitCode,
    plan,
    freshness: exitCode === 0 ? 'CURRENT_FOR_CANDIDATE' : 'NOT_ESTABLISHED',
    semanticVerdict: 'NOT_COMPUTED',
    manualEvidence: applied.manualEvidence,
  };
}

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/verify-semantic.mjs --base <sha> [--head <sha>] [--manual-evidence <path>] [--plan-only] [--json]');
    process.exitCode = 2;
    return;
  }

  let manualEvidenceReceipt = null;
  try {
    manualEvidenceReceipt = readManualEvidenceReceipt(options.manualEvidencePath, DEFAULT_ROOT);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  const result = runSemanticVerification({
    base: options.base,
    head: options.head,
    execute: !options.planOnly,
    writePlan: !options.json,
    manualEvidenceReceipt,
  });
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.exitCode === 0) {
    if (!options.json) console.log(`semantic verification: PASS (${result.plan.coverage}; semantic verdict NOT_COMPUTED)`);
  } else if (!options.json) {
    console.error(`semantic verification: FAIL (${result.plan.coverage}; freshness ${result.freshness}; semantic verdict NOT_COMPUTED)`);
  }
  process.exitCode = result.exitCode;
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
