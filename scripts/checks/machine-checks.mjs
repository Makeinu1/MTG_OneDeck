#!/usr/bin/env node
// 機械チェックの単一正本(旧「機械チェック4点」)。npm run check で起動する。
// 各ステップは個別実行する(&& 連結だと失敗ステップの帰属が曖昧になるため)。
// 素の `npx tsc --noEmit` は root tsconfig が files:[] のため no-op — 型検査の正は
// `npm run build`(tsc -b)に内蔵されている。CR・契約・lint・test・buildの5ステップで完全。
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const machineCheckSteps = [
  { name: 'CR固定版検証', cmd: 'npm', args: ['run', 'verify:cr'] },
  { name: 'バージョン契約検証', cmd: 'npm', args: ['run', 'verify:versions'] },
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'test', cmd: 'npm', args: ['test'] },
  { name: 'build (型検査内蔵)', cmd: 'npm', args: ['run', 'build'] },
];

const usage = 'Usage: npm run check -- [--continue-on-error]';

export function parseMachineCheckArgs(args) {
  if (args.length === 0) return { continueOnError: false };
  if (args.length === 1 && args[0] === '--continue-on-error') {
    return { continueOnError: true };
  }

  throw new Error(`Unknown argument: ${args.join(' ')}`);
}

export function runMachineChecks({
  steps = machineCheckSteps,
  continueOnError = false,
  spawn = spawnSync,
  now = () => performance.now(),
  write = (line) => console.log(line),
} = {}) {
  const results = [];
  const totalStartedAt = now();
  let nextStepStartedAt = totalStartedAt;
  let firstFailure = 0;

  for (const [index, step] of steps.entries()) {
    if (firstFailure !== 0 && !continueOnError) {
      results.push({ name: step.name, code: null, durationMs: 0, skipped: true });
      continue;
    }

    write(`\n=== machine-check: ${step.name} ===`);
    const startedAt = nextStepStartedAt;
    const result = spawn(step.cmd, step.args, { stdio: 'inherit', shell: false });
    const finishedAt = now();
    const code = result.status ?? 1;
    const durationMs = finishedAt - startedAt;
    results.push({ name: step.name, code, durationMs, skipped: false });

    if (code !== 0 && firstFailure === 0) firstFailure = code;
    const willRunAnotherStep = index < steps.length - 1
      && (firstFailure === 0 || continueOnError);
    if (willRunAnotherStep) nextStepStartedAt = now();
  }

  const durationMs = now() - totalStartedAt;
  write('\n=== machine-check summary ===');
  for (const result of results) {
    if (result.skipped) {
      write(`SKIP  ${result.name}`);
    } else {
      write(`${result.code === 0 ? 'PASS' : 'FAIL'}  ${result.name} (${result.durationMs.toFixed(0)} ms)`);
    }
  }
  write(`TOTAL (${durationMs.toFixed(0)} ms)`);

  return { exitCode: firstFailure, results, durationMs };
}

function runCli() {
  let options;
  try {
    options = parseMachineCheckArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    process.exitCode = 2;
    return;
  }

  process.exitCode = runMachineChecks(options).exitCode;
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) runCli();
