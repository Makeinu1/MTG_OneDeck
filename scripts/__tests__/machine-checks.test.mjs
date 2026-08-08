import { describe, expect, it } from 'vitest';

import {
  parseMachineCheckArgs,
  runMachineChecks,
} from '../checks/machine-checks.mjs';

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

  it('uses the sequential npm test entrypoint in the canonical step order', () => {
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
      ['npm', ['run', 'lint']],
      ['npm', ['test']],
      ['npm', ['run', 'build']],
    ]);
    expect(report.exitCode).toBe(0);
  });
});
