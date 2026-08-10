#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { collectChangedFiles } from './change-detector.mjs';
import { DEFAULT_ROOT, resolveDomainSelection } from './validation-domain-resolver.mjs';

function parseArgs(argv) {
  const options = { head: 'HEAD', base: undefined, dryRun: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base' || argument === '--head') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
    } else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (options.head !== 'HEAD' && options.base === undefined) throw new Error('--head requires --base');
  return options;
}

function reportFor(options) {
  const changes = collectChangedFiles({ cwd: DEFAULT_ROOT, base: options.base, head: options.head });
  const selection = resolveDomainSelection({ root: DEFAULT_ROOT, files: changes.files });
  return {
    mode: changes.mode,
    base: changes.base,
    head: changes.head,
    files: changes.files,
    selectedDomains: selection.selectedDomains,
    initialDomains: selection.initialDomains,
    expandedDomains: selection.expandedDomains,
    contractIds: selection.contractIds,
    escalation: selection.escalation,
    unknownFiles: selection.unknownFiles,
    matchedBy: selection.matchedBy,
    reasons: selection.reasons,
    testFiles: selection.testFiles,
    testFileCount: selection.testFiles.length,
    testFilesByProject: selection.testFilesByProject,
  };
}

function printReport(report) {
  console.log(`MODE: ${report.mode}`);
  if (report.base) console.log(`BASE: ${report.base}`);
  console.log(`HEAD: ${report.head}`);
  console.log(`CHANGED FILES: ${report.files.length}`);
  for (const file of report.files) console.log(`  ${file}`);
  console.log(`INITIAL DOMAINS: ${report.initialDomains.join(', ') || '<none>'}`);
  console.log(`EXPANDED DOMAINS: ${report.expandedDomains.join(', ') || '<none>'}`);
  console.log(`SELECTED DOMAINS: ${report.selectedDomains.join(', ') || '<none>'}`);
  console.log(`CONTRACT IDS: ${report.contractIds.join(', ') || '<none>'}`);
  console.log(`ESCALATION: ${report.escalation}`);
  console.log(`TEST FILES: ${report.testFileCount}`);
  for (const file of report.testFiles) console.log(`  ${file}`);
  for (const reason of report.reasons) console.log(`REASON: ${reason}`);
  for (const [file, domains] of Object.entries(report.matchedBy)) {
    console.log(`MATCH: ${file} -> ${domains.join(', ')}`);
  }
  if (report.unknownFiles.length > 0) {
    console.log(`UNKNOWN PATHS: ${report.unknownFiles.join(', ')}`);
  }
}

function runStep(label, command, args) {
  console.log(`\n=== check:fast: ${label} ===`);
  const result = spawnSync(command, args, { cwd: DEFAULT_ROOT, stdio: 'inherit', shell: false });
  return result.status ?? 1;
}

function runTargeted(report) {
  let exitCode = 0;
  const docsCode = runStep('docs', process.execPath, ['scripts/checks/check-docs.mjs']);
  if (docsCode !== 0) exitCode = docsCode;

  const lintFiles = report.files.filter((file) =>
    /\.(?:mjs|ts|tsx|js|jsx)$/.test(file) && existsSync(resolve(DEFAULT_ROOT, file)),
  );
  if (lintFiles.length > 0) {
    const lintCode = runStep('affected lint', 'npx', ['eslint', ...lintFiles]);
    if (lintCode !== 0 && exitCode === 0) exitCode = lintCode;
  } else {
    console.log('\n=== check:fast: affected lint ===\nSKIP: no changed lintable source');
  }

  const typecheckCode = runStep('incremental typecheck', 'npx', ['tsc', '-b', '--pretty', 'false']);
  if (typecheckCode !== 0 && exitCode === 0) exitCode = typecheckCode;

  for (const project of ['core', 'dom']) {
    const paths = report.testFilesByProject[project];
    if (paths.length === 0) continue;
    const testCode = runStep(`affected ${project} tests (${paths.length} files)`, 'npx', [
      'vitest', 'run', '--project', project, ...paths,
    ]);
    if (testCode !== 0 && exitCode === 0) exitCode = testCode;
  }
  if (report.testFileCount === 0 && report.files.length > 0 && report.escalation !== 'full') {
    console.error('No test files selected for a non-empty targeted change set');
    if (exitCode === 0) exitCode = 1;
  }
  return exitCode;
}

function run() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = reportFor(options);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else printReport(report);
    if (options.dryRun || options.json) return;
    if (report.escalation === 'full') {
      process.exitCode = runStep('full release check', 'npm', ['run', 'check']);
      return;
    }
    process.exitCode = runTargeted(report);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

run();
