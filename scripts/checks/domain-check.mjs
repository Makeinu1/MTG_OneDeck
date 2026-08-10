#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { DEFAULT_ROOT, resolveNamedDomain } from './validation-domain-resolver.mjs';

function parseArgs(argv) {
  let domainId;
  let list = false;
  let dryRun = false;
  for (const argument of argv) {
    if (argument === '--list') list = true;
    else if (argument === '--dry-run') dryRun = true;
    else if (argument.startsWith('--')) throw new Error(`unknown argument: ${argument}`);
    else if (domainId === undefined) domainId = argument;
    else throw new Error(`unexpected argument: ${argument}`);
  }
  if (!domainId) throw new Error('usage: check:domain <domain> [--list|--dry-run]');
  return { domainId, list, dryRun };
}

function printSelection(selection) {
  console.log(`SELECTED DOMAIN: ${selection.domain.id}`);
  console.log(`DEPENDENCY EXPANSION: ${selection.expandedDomains.join(', ')}`);
  console.log(`CONTRACT IDS: ${selection.contractIds.join(', ') || '<none>'}`);
  console.log(`ESCALATION: ${selection.expandedDomains.some((id) => id === selection.domain.id && selection.domain.escalationLevel === 'full') ? 'full' : selection.domain.escalationLevel}`);
  console.log(`TEST FILE COUNT: ${selection.testFiles.length}`);
  for (const file of selection.testFiles) console.log(`  ${file}`);
  for (const reason of selection.reasons) console.log(`REASON: ${reason}`);
}

function runProject(project, paths) {
  if (paths.length === 0) return 0;
  return spawnSync('npx', ['vitest', 'run', '--project', project, ...paths], {
    cwd: DEFAULT_ROOT,
    stdio: 'inherit',
    shell: false,
  }).status ?? 1;
}

function run() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const selection = resolveNamedDomain({ root: DEFAULT_ROOT, domainId: options.domainId });
    printSelection(selection);
    if (options.list || options.dryRun) return;

    if (selection.domain.escalationLevel === 'full') {
      process.exitCode = spawnSync('npm', ['run', 'check'], { cwd: DEFAULT_ROOT, stdio: 'inherit', shell: false }).status ?? 1;
      return;
    }

    if (options.domainId === 'docs') {
      const docsCode = spawnSync(process.execPath, ['scripts/checks/check-docs.mjs'], {
        cwd: DEFAULT_ROOT,
        stdio: 'inherit',
        shell: false,
      }).status ?? 1;
      if (docsCode !== 0) {
        process.exitCode = docsCode;
        return;
      }
    }

    let exitCode = runProject('core', selection.testFilesByProject.core);
    if (exitCode === 0) exitCode = runProject('dom', selection.testFilesByProject.dom);
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

run();
