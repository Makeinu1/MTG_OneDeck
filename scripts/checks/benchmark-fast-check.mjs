#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { collectChangedFiles } from './change-detector.mjs';
import { DEFAULT_ROOT, resolveDomainSelection } from './validation-domain-resolver.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function oldChangedFiles(cwd) {
  return execFileSync('git', ['status', '--short'], { cwd, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean);
}

function oldPlan(files) {
  const plans = [];
  if (files.some((file) => file.startsWith('src/engine/') || file.startsWith('src/store/'))) plans.push('core: src/engine + src/store');
  if (files.some((file) => file.startsWith('src/data/'))) plans.push('core: src/data');
  if (files.some((file) => file.startsWith('src/store/'))) plans.push('dom: src/store');
  if (files.some((file) => file.startsWith('src/components/') || file.startsWith('src/App'))) plans.push('dom: src/components + AppFanContentNotice');
  if (files.some((file) => file.startsWith('src/test/'))) plans.push('dom: src/test');
  if (files.some((file) => file.startsWith('scripts/'))) plans.push('dom: scripts/__tests__');
  return plans;
}

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-fast-benchmark-'));
  mkdirSync(join(cwd, 'src', 'engine'), { recursive: true });
  mkdirSync(join(cwd, 'src', 'components'), { recursive: true });
  mkdirSync(join(cwd, 'src', 'store'), { recursive: true });
  mkdirSync(join(cwd, 'docs'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Benchmark');
  writeFileSync(join(cwd, 'README.md'), 'benchmark\n');
  git(cwd, 'add', 'README.md');
  git(cwd, 'commit', '-m', 'benchmark base');
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') };
}

function runCase(name, mutate, mode = 'working-tree-only') {
  const repository = setup();
  try {
    mutate(repository);
    const beforeStart = performance.now();
    const beforeFiles = oldChangedFiles(repository.cwd);
    const beforeMs = performance.now() - beforeStart;
    const afterStart = performance.now();
    const after = collectChangedFiles({ cwd: repository.cwd, base: mode === 'base-aware' ? repository.base : undefined });
    const selection = resolveDomainSelection({ root: DEFAULT_ROOT, files: after.files });
    const afterMs = performance.now() - afterStart;
    return {
      name,
      mode: after.mode,
      beforeFiles,
      beforePlan: oldPlan(beforeFiles),
      beforeMs: beforeMs.toFixed(2),
      afterFiles: after.files,
      afterDomains: selection.selectedDomains,
      afterEscalation: selection.escalation,
      afterTestFiles: selection.testFiles.length,
      afterMs: afterMs.toFixed(2),
    };
  } finally {
    rmSync(repository.cwd, { recursive: true, force: true });
  }
}

const cases = [
  runCase('A docs-only', (repo) => writeFileSync(join(repo.cwd, 'docs', 'change.md'), 'docs\n')),
  runCase('B engine single file', (repo) => writeFileSync(join(repo.cwd, 'src', 'engine', 'changed.ts'), 'export const changed = true;\n')),
  runCase('C UI single file', (repo) => writeFileSync(join(repo.cwd, 'src', 'components', 'Changed.tsx'), 'export const Changed = null;\n')),
  runCase('D store/shared state', (repo) => writeFileSync(join(repo.cwd, 'src', 'store', 'changed.ts'), 'export const changed = true;\n')),
  runCase('E scripts/checks', (repo) => {
    mkdirSync(join(repo.cwd, 'scripts', 'checks'), { recursive: true });
    writeFileSync(join(repo.cwd, 'scripts', 'checks', 'changed.mjs'), 'export {};\n');
  }),
  runCase('F package/build config', (repo) => writeFileSync(join(repo.cwd, 'package.json'), '{}\n')),
  runCase('G committed clean worktree', (repo) => {
    writeFileSync(join(repo.cwd, 'src', 'engine', 'committed.ts'), 'export const committed = true;\n');
    git(repo.cwd, 'add', 'src/engine/committed.ts');
    git(repo.cwd, 'commit', '-m', 'committed benchmark change');
  }, 'base-aware'),
  runCase('H unknown path', (repo) => {
    mkdirSync(join(repo.cwd, 'vendor'), { recursive: true });
    writeFileSync(join(repo.cwd, 'vendor', 'unknown.mjs'), 'export {};\n');
  }),
];

const lines = [
  '# VALIDATION-HARDENING-2026-08 fast-check benchmark',
  '',
  '測定は同一マシンのtemporary git repositoryで、旧`git status --short`収集と新`collectChangedFiles`+domain resolverのdry-run選択を比較した。Vitest/buildの実行時間ではなく、変更検出・選択計算の時間であり、選択漏れがないことを主目的とする。',
  '',
  '| case | before files / plan | after files | after domains | escalation | test files | before ms | after ms |',
  '|---|---|---|---|---|---:|---:|---:|',
];
for (const item of cases) {
  lines.push(`| ${item.name} | ${item.beforeFiles.join('<br>') || 'none'} / ${item.beforePlan.join('<br>') || 'none'} | ${item.afterFiles.join('<br>') || 'none'} | ${item.afterDomains.join('<br>') || 'none'} | ${item.afterEscalation} | ${item.afterTestFiles} | ${item.beforeMs} | ${item.afterMs} |`);
}
lines.push('', '結論: 旧方式はGのcommit済みclean差分を0件、F/Hをtestなしとして扱う。新方式はGをbase-awareで検出し、Fをfullへ、Hをrelease/fullへ昇格する。A〜Dはdomain dependencyを展開し、同じtest fileはSetで一度だけ選択する。');
writeFileSync(join(DEFAULT_ROOT, 'research/archive/document-reset-2026-08/validation-hardening-benchmark.md'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
