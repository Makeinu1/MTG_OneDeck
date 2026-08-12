#!/usr/bin/env node
// 機械チェックの単一正本(旧「機械チェック4点」)。npm run check で起動する。
// 各ステップは個別実行する(&& 連結だと失敗ステップの帰属が曖昧になるため)。
// 素の `npx tsc --noEmit` は root tsconfig が files:[] のため no-op — 型検査の正は
// `npm run build`(tsc -b)に内蔵されている。CR・契約・docs・Core・lint・test・buildで完全。
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const machineCheckSteps = [
  { name: 'CR固定版検証', cmd: 'npm', args: ['run', 'verify:cr'] },
  { name: 'バージョン契約検証', cmd: 'npm', args: ['run', 'verify:versions'] },
  { name: 'docs契約検証', cmd: 'npm', args: ['run', 'check:docs'] },
  {
    name: 'Online状態アーキテクチャ検証',
    cmd: 'npm',
    args: ['run', 'verify:online-state-architecture'],
  },
  {
    name: 'Mode-Neutral Core Identity/Zone検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-identity-zone'],
  },
  {
    name: 'Mode-Neutral Core Card Runtime検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-card-runtime'],
  },
  {
    name: 'Mode-Neutral Core Card Zone Transition検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-zone-transition'],
  },
  {
    name: 'Mode-Neutral Core Object Registry V2検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-object-registry'],
  },
  {
    name: 'Mode-Neutral Core Stack Announcement検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-stack-announcement'],
  },
  {
    name: 'Mode-Neutral Core Stack Transaction検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-stack-transaction'],
  },
  {
    name: 'Mode-Neutral Core Turn/Priority検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-turn-priority'],
  },
  {
    name: 'Mode-Neutral Core Rule Authority検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-rule-authority'],
  },
  {
    name: 'Mode-Neutral Core Commander/Combat/Player Exit検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-commander-combat-player-exit'],
  },
  {
    name: 'Mode-Neutral Core Closure検証',
    cmd: 'npm',
    args: ['run', 'verify:mode-neutral-core-closure'],
  },
  {
    name: 'Solo/Core Compatibility検証',
    cmd: 'npm',
    args: ['run', 'verify:solo-core-compatibility'],
  },
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'test', cmd: 'npm', args: ['test'] },
  { name: 'build (型検査内蔵)', cmd: 'npm', args: ['run', 'build'] },
];

export function machineCheckStepsFor({ buildBase } = {}) {
  if (!buildBase) return machineCheckSteps;
  return machineCheckSteps.map((step) => step.name === 'build (型検査内蔵)'
    ? { ...step, args: ['run', 'build', '--', `--base=${buildBase}`] }
    : step);
}

const usage = 'Usage: npm run check -- [--continue-on-error] [--build-base=<path>]';

export function parseMachineCheckArgs(args) {
  const options = { continueOnError: false };
  for (const arg of args) {
    if (arg === '--continue-on-error') {
      if (options.continueOnError) throw new Error(`Unknown argument: ${args.join(' ')}`);
      options.continueOnError = true;
      continue;
    }
    if (arg.startsWith('--build-base=')) {
      if (options.buildBase !== undefined || arg.length === '--build-base='.length) throw new Error(`Unknown argument: ${args.join(' ')}`);
      options.buildBase = arg.slice('--build-base='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${args.join(' ')}`);
  }
  return options;
}

export function runMachineChecks({
  steps = machineCheckSteps,
  buildBase,
  continueOnError = false,
  spawn = spawnSync,
  now = () => performance.now(),
  write = (line) => console.log(line),
} = {}) {
  const effectiveSteps = steps === machineCheckSteps ? machineCheckStepsFor({ buildBase }) : steps;
  const results = [];
  const totalStartedAt = now();
  let nextStepStartedAt = totalStartedAt;
  let firstFailure = 0;

  for (const [index, step] of effectiveSteps.entries()) {
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
    const willRunAnotherStep = index < effectiveSteps.length - 1 && (firstFailure === 0 || continueOnError);
    if (willRunAnotherStep) nextStepStartedAt = now();
  }

  const durationMs = now() - totalStartedAt;
  write('\n=== machine-check summary ===');
  for (const result of results) {
    if (result.skipped) {
      write(`SKIP  ${result.name}`);
    } else {
      write(
        `${result.code === 0 ? 'PASS' : 'FAIL'}  ${result.name} (${result.durationMs.toFixed(0)} ms)`,
      );
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

  process.exitCode = runMachineChecks({ ...options, steps: machineCheckSteps }).exitCode;
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) runCli();
