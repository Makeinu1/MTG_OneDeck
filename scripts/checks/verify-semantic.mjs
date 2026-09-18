#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildVerificationPlan } from './semantic-verification.mjs';
import { DEFAULT_ROOT } from './validation-domain-resolver.mjs';

function parseArgs(args) {
  const options = { base: null, head: 'HEAD', planOnly: false, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base' || arg === '--head') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg === '--plan-only') options.planOnly = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.base) throw new Error('--base is required');
  return options;
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

export function runSemanticVerification({
  cwd = DEFAULT_ROOT,
  base,
  head = 'HEAD',
  execute = true,
  writePlan = true,
} = {}) {
  const plan = buildVerificationPlan({ cwd, base, head });
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
  };
}

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Usage: node scripts/checks/verify-semantic.mjs --base <sha> [--head <sha>] [--plan-only] [--json]');
    process.exitCode = 2;
    return;
  }

  const result = runSemanticVerification({
    base: options.base,
    head: options.head,
    execute: !options.planOnly,
    writePlan: !options.json,
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
