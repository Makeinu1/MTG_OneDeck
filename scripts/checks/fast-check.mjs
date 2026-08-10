#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

function changedFiles() {
  const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean);
}

function runStep(label, command, args) {
  console.log(`\n=== check:fast: ${label} ===`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if ((result.status ?? 1) !== 0) process.exitCode = result.status ?? 1;
  return result.status ?? 1;
}

function testPlans(files) {
  const plans = [];
  if (files.some((file) => file.startsWith('src/engine/') || file.startsWith('src/store/'))) plans.push({ project: 'core', paths: ['src/engine', 'src/store'] });
  if (files.some((file) => file.startsWith('src/data/'))) plans.push({ project: 'core', paths: ['src/data'] });
  const domPaths = [];
  if (files.some((file) => file.startsWith('src/store/'))) domPaths.push('src/store');
  if (files.some((file) => file.startsWith('src/components/') || file.startsWith('src/App'))) domPaths.push('src/components', 'src/AppFanContentNotice.test.tsx');
  const architectureTests = files.filter((file) => file.startsWith('src/test/') && /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs)$/.test(file));
  domPaths.push(...(architectureTests.length > 0 ? architectureTests : files.some((file) => file.startsWith('src/test/')) ? ['src/test'] : []));
  if (domPaths.length > 0) plans.push({ project: 'dom', paths: [...new Set(domPaths)] });
  if (files.some((file) => file.startsWith('scripts/'))) plans.push({ project: 'dom', paths: ['scripts/__tests__'] });
  if (files.some((file) => file.startsWith('src/store/') || file === 'src/test/architecture/soloOnlineBoundary.test.ts')) plans.push({ command: 'npm', args: ['run', 'verify:solo-preservation'] });
  return plans;
}

function runFast() {
  const files = changedFiles();
  runStep('docs', process.execPath, ['scripts/checks/check-docs.mjs']);
  const lintFiles = files.filter((file) => /\.(?:mjs|ts|tsx|js|jsx)$/.test(file) && existsSync(resolve(root, file)));
  if (lintFiles.length > 0) runStep('affected lint', 'npx', ['eslint', ...lintFiles]);
  else console.log('\n=== check:fast: affected lint ===\nSKIP: no changed lintable source');
  runStep('incremental typecheck', 'npx', ['tsc', '-b', '--pretty', 'false']);
  const plans = testPlans(files);
  if (plans.length > 0) for (const plan of plans) {
    if (plan.command) runStep('affected tests', plan.command, plan.args);
    else runStep('affected tests', 'npx', ['vitest', 'run', '--project', plan.project, ...plan.paths]);
  }
  else console.log('\n=== check:fast: affected tests ===\nSKIP: no source domain selected');
}

runFast();
