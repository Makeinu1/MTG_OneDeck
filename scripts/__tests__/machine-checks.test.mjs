import { describe, expect, it } from 'vitest';

import { machineCheckStepsFor, parseMachineCheckArgs, runMachineChecks } from '../checks/machine-checks.mjs';

const steps = [
  { name: 'lint', cmd: 'lint-command', args: ['--strict'] },
  { name: 'test', cmd: 'test-command', args: [] },
  { name: 'build', cmd: 'build-command', args: [] },
];

describe('machine-check argument parsing', () => {
  it('accepts only the diagnostic continuation flag', () => {
    expect(parseMachineCheckArgs([])).toEqual({ continueOnError: false });
    expect(parseMachineCheckArgs(['--continue-on-error'])).toEqual({ continueOnError: true });
    expect(() => parseMachineCheckArgs(['--unknown'])).toThrow(/unknown argument/i);
    expect(() => parseMachineCheckArgs(['--continue-on-error', '--continue-on-error'])).toThrow();
  });

  it('passes the Pages base path to the single release build', () => {
    expect(parseMachineCheckArgs(['--build-base=/MTG_OneDeck/'])).toEqual({
      continueOnError: false,
      buildBase: '/MTG_OneDeck/',
    });
    expect(machineCheckStepsFor({ buildBase: '/MTG_OneDeck/' }).at(-1)).toEqual({
      name: 'build (型検査内蔵)',
      cmd: 'npm',
      args: ['run', 'build', '--', '--base=/MTG_OneDeck/'],
    });
  });
});

describe('machine-check execution', () => {
  it('fails fast, reports later steps as skipped, and uses monotonic durations', () => {
    const calls = [];
    const output = [];
    const ticks = [100, 125, 140];

    const report = runMachineChecks({
      steps,
      spawn: (cmd, args) => {
        calls.push([cmd, args]);
        return { status: 7 };
      },
      now: () => ticks.shift(),
      write: (line) => output.push(line),
    });

    expect(calls).toEqual([['lint-command', ['--strict']]]);
    expect(report).toEqual({
      exitCode: 7,
      results: [
        { name: 'lint', code: 7, durationMs: 25, skipped: false },
        { name: 'test', code: null, durationMs: 0, skipped: true },
        { name: 'build', code: null, durationMs: 0, skipped: true },
      ],
      durationMs: 40,
    });
    expect(output.join('\n')).toContain('SKIP  test');
    expect(output.join('\n')).toContain('TOTAL (40 ms)');
  });

  it('runs every step in diagnostic mode and preserves the first failure status', () => {
    const statuses = [3, 0, 9];
    const ticks = [0, 5, 10, 18, 20, 25, 30];
    const calls = [];

    const report = runMachineChecks({
      steps,
      continueOnError: true,
      spawn: (cmd) => {
        calls.push(cmd);
        return { status: statuses.shift() };
      },
      now: () => ticks.shift(),
      write: () => {},
    });

    expect(calls).toEqual(['lint-command', 'test-command', 'build-command']);
    expect(report.exitCode).toBe(3);
    expect(report.results.map(({ code, durationMs }) => ({ code, durationMs }))).toEqual([
      { code: 3, durationMs: 5 },
      { code: 0, durationMs: 8 },
      { code: 9, durationMs: 5 },
    ]);
    expect(report.durationMs).toBe(30);
  });

  it('returns success after running every green step exactly once', () => {
    const calls = [];
    let tick = 0;

    const report = runMachineChecks({
      steps,
      spawn: (cmd) => {
        calls.push(cmd);
        return { status: 0 };
      },
      now: () => tick++,
      write: () => {},
    });

    expect(calls).toEqual(['lint-command', 'test-command', 'build-command']);
    expect(report.exitCode).toBe(0);
    expect(report.results.every((result) => !result.skipped && result.durationMs === 1)).toBe(true);
  });

  it('uses the sequential npm entrypoints in the canonical ordered sequence', () => {
    const calls = [];
    let tick = 0;

    const report = runMachineChecks({
      spawn: (cmd, args) => {
        calls.push([cmd, args]);
        return { status: 0 };
      },
      now: () => tick++,
      write: () => {},
    });

    expect(calls).toEqual([
      ['npm', ['run', 'verify:cr']],
      ['npm', ['run', 'verify:versions']],
      ['npm', ['run', 'check:docs']],
      ['npm', ['run', 'verify:online-state-architecture']],
      ['npm', ['run', 'verify:mode-neutral-core-identity-zone']],
      ['npm', ['run', 'verify:mode-neutral-core-card-runtime']],
      ['npm', ['run', 'verify:mode-neutral-core-zone-transition']],
      ['npm', ['run', 'verify:mode-neutral-core-object-registry']],
      ['npm', ['run', 'verify:mode-neutral-core-stack-announcement']],
      ['npm', ['run', 'verify:mode-neutral-core-stack-transaction']],
      ['npm', ['run', 'verify:mode-neutral-core-turn-priority']],
      ['npm', ['run', 'verify:mode-neutral-core-rule-authority']],
      ['npm', ['run', 'verify:mode-neutral-core-commander-combat-player-exit']],
      ['npm', ['run', 'verify:mode-neutral-core-closure']],
      ['npm', ['run', 'verify:solo-core-compatibility']],
      ['npm', ['run', 'verify:online-four-seat-room']],
      ['npm', ['run', 'verify:online-in-memory-protocol']],
      ['npm', ['run', 'verify:online-audience-projection']],
      ['npm', ['run', 'verify:online-local-room-gate']],
      ['npm', ['run', 'verify:online-cloudflare-runtime-persistence']],
      ['npm', ['run', 'verify:online-cloudflare-websocket-recovery']],
      ['npm', ['run', 'verify:online-cloudflare-capability-abuse-control']],
      ['npm', ['run', 'lint']],
      ['npm', ['test']],
      ['npm', ['run', 'build']],
    ]);
    expect(report.exitCode).toBe(0);
  });

  it('attributes a Core verification failure while preserving later-step behavior', () => {
    const coreSteps = [
      { name: 'CR固定版検証', cmd: 'cr', args: [] },
      { name: 'バージョン契約検証', cmd: 'versions', args: [] },
      { name: 'docs契約検証', cmd: 'docs', args: [] },
      { name: 'Online状態アーキテクチャ検証', cmd: 'online', args: [] },
      { name: 'Mode-Neutral Core Identity/Zone検証', cmd: 'core', args: [] },
      { name: 'Mode-Neutral Core Card Runtime検証', cmd: 'runtime', args: [] },
      { name: 'Mode-Neutral Core Card Zone Transition検証', cmd: 'transition', args: [] },
      { name: 'Mode-Neutral Core Object Registry V2検証', cmd: 'object-registry', args: [] },
      { name: 'Mode-Neutral Core Stack Announcement検証', cmd: 'stack-announcement', args: [] },
      { name: 'Mode-Neutral Core Stack Transaction検証', cmd: 'stack-transaction', args: [] },
      { name: 'Mode-Neutral Core Turn/Priority検証', cmd: 'turn-priority', args: [] },
      { name: 'Mode-Neutral Core Rule Authority検証', cmd: 'rule-authority', args: [] },
      { name: 'Mode-Neutral Core Commander/Combat/Player Exit検証', cmd: 'commander-combat-player-exit', args: [] },
      { name: 'lint', cmd: 'lint', args: [] },
      { name: 'test', cmd: 'test', args: [] },
      { name: 'build (型検査内蔵)', cmd: 'build', args: [] },
    ];
    const statuses = [0, 0, 0, 0, 0, 0, 0, 17, 0, 0, 0, 0, 0, 0, 0, 0];
    const calls = [];
    const report = runMachineChecks({
      steps: coreSteps,
      continueOnError: true,
      spawn: (cmd) => {
        calls.push(cmd);
        return { status: statuses.shift() };
      },
      now: () => 0,
      write: () => {},
    });
    expect(report.exitCode).toBe(17);
    expect(report.results[7]).toMatchObject({
      name: 'Mode-Neutral Core Object Registry V2検証',
      code: 17,
      skipped: false,
    });
    expect(calls).toEqual([
      'cr',
      'versions',
      'docs',
      'online',
      'core',
      'runtime',
      'transition',
      'object-registry',
      'stack-announcement',
      'stack-transaction',
      'turn-priority',
      'rule-authority',
      'commander-combat-player-exit',
      'lint',
      'test',
      'build',
    ]);
  });
});
