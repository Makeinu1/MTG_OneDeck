#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const domains = new Map([
  ['docs', { paths: [], command: process.execPath, args: ['scripts/checks/check-docs.mjs'] }],
  ['solo-preservation', { paths: [], command: 'npm', args: ['run', 'verify:solo-preservation'] }],
  ['engine-state', { paths: ['src/engine/types.ts', 'src/engine/init.ts', 'src/engine/__tests__/init.test.ts'], project: 'core' }],
  ['engine-turn', { paths: ['src/engine/priority.ts', 'src/engine/__tests__/priority.test.ts'], project: 'core' }],
  ['engine-zones', { paths: ['src/engine/__tests__/cr400LinkedExileSubstrate.test.ts', 'src/engine/__tests__/cr400ReanimationGuided.test.ts'], project: 'core' }],
  ['engine-stack', { paths: ['src/engine/__tests__/m427.test.ts', 'src/engine/__tests__/m428.test.ts'], project: 'core' }],
  ['engine-mana', { paths: ['src/engine/__tests__/mana.test.ts', 'src/engine/__tests__/manaTransaction.test.ts'], project: 'core' }],
  ['engine-compiler', { paths: ['src/engine/__tests__/cr701DiscardCompiler.test.ts', 'src/engine/__tests__/cr701SearchShuffleCompiler.test.ts'], project: 'core' }],
  ['ui-interaction', { paths: ['src/components/game/HudInteractions.test.tsx', 'src/components/game/CardActionSheet.test.tsx'], project: 'dom' }],
  ['ui-responsive', { paths: ['src/components/game/adaptiveLaneLayout.test.ts', 'src/components/game/handFanLayout.test.ts'], project: 'dom' }],
  ['audio-visual', { paths: ['src/components/game/__tests__/review.av0-contract.test.ts', 'src/components/game/__tests__/review.av6-two-phase-beat.test.ts'], project: 'dom' }],
]);

function run() {
  const domain = process.argv[2];
  const definition = domains.get(domain);
  if (!definition) {
    console.error(`Unknown domain ${domain ?? '<missing>'}. Valid domains: ${[...domains.keys()].join(', ')}`);
    process.exitCode = 2;
    return;
  }
  for (const path of definition.paths ?? []) {
    try { execFileSync('test', ['-f', path], { cwd: root, stdio: 'ignore' }); }
    catch { console.error(`Missing domain evidence path: ${path}`); process.exitCode = 1; return; }
  }
  console.log(`\n=== check:domain: ${domain} ===`);
  if (definition.command) {
    process.exitCode = spawnSync(definition.command, definition.args, { cwd: root, stdio: 'inherit', shell: false }).status ?? 1;
    return;
  }
  process.exitCode = spawnSync('npx', ['vitest', 'run', '--project', definition.project, ...(definition.paths ?? [])], { cwd: root, stdio: 'inherit', shell: false }).status ?? 1;
}

run();
