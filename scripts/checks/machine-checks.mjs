#!/usr/bin/env node
// 機械チェックの単一正本(旧「機械チェック4点」)。npm run check で起動する。
// 各ステップは個別実行する(&& 連結だと失敗ステップの帰属が曖昧になるため)。
// 素の `npx tsc --noEmit` は root tsconfig が files:[] のため no-op — 型検査の正は
// `npm run build`(tsc -b)に内蔵されている。よってステップは3つで完全。
import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'test', cmd: 'npx', args: ['vitest', 'run'] },
  { name: 'build (型検査内蔵)', cmd: 'npm', args: ['run', 'build'] },
];

const results = [];
for (const step of steps) {
  console.log(`\n=== machine-check: ${step.name} ===`);
  const r = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: false });
  results.push({ name: step.name, code: r.status ?? 1 });
}

console.log('\n=== machine-check summary ===');
let firstFailure = 0;
for (const r of results) {
  const ok = r.code === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!ok && firstFailure === 0) firstFailure = r.code;
}
process.exit(firstFailure);
