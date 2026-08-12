import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseMachineCheckArgs,
  runMachineChecks,
} from '../checks/machine-checks.mjs';

const fixtureSteps = [
  { name: 'first', cmd: 'first-command', args: [] },
  { name: 'second', cmd: 'second-command', args: ['--flag'] },
];

describe('review.check-gates machine-check execution', () => {
  it('fails fast by default and records skipped work plus monotonic durations', () => {
    const calls = [];
    const output = [];
    const ticks = [100, 125, 140];

    const report = runMachineChecks({
      steps: fixtureSteps,
      spawn: (cmd, args) => {
        calls.push([cmd, args]);
        return { status: 7 };
      },
      now: () => ticks.shift(),
      write: (line) => output.push(line),
    });

    expect(calls).toEqual([['first-command', []]]);
    expect(report.exitCode).toBe(7);
    expect(report.results).toEqual([
      expect.objectContaining({ name: 'first', code: 7, durationMs: 25, skipped: false }),
      expect.objectContaining({ name: 'second', code: null, durationMs: 0, skipped: true }),
    ]);
    expect(report.durationMs).toBe(40);
    expect(output.join('\n')).toContain('SKIP');
  });

  it('supports an explicit all-diagnostics mode while preserving first-failure exit', () => {
    const statuses = [3, 0];
    const ticks = [0, 5, 10, 18, 20];
    const calls = [];

    const report = runMachineChecks({
      steps: fixtureSteps,
      continueOnError: true,
      spawn: (cmd) => {
        calls.push(cmd);
        return { status: statuses.shift() };
      },
      now: () => ticks.shift(),
      write: () => {},
    });

    expect(calls).toEqual(['first-command', 'second-command']);
    expect(report.exitCode).toBe(3);
    expect(report.results.map(({ code, skipped, durationMs }) => ({ code, skipped, durationMs }))).toEqual([
      { code: 3, skipped: false, durationMs: 5 },
      { code: 0, skipped: false, durationMs: 8 },
    ]);
    expect(report.durationMs).toBe(20);
  });

  it('parses only the documented diagnostic flag', () => {
    expect(parseMachineCheckArgs([])).toEqual({ continueOnError: false });
    expect(parseMachineCheckArgs(['--continue-on-error'])).toEqual({ continueOnError: true });
    expect(() => parseMachineCheckArgs(['--unknown'])).toThrow(/unknown/i);
  });

  it('fails closed when a child process has no exit status', () => {
    const ticks = [0, 1, 2];
    const report = runMachineChecks({
      steps: fixtureSteps,
      spawn: () => ({ status: null, error: new Error('spawn failed') }),
      now: () => ticks.shift(),
      write: () => {},
    });

    expect(report.exitCode).not.toBe(0);
    expect(report.results[0]).toEqual(
      expect.objectContaining({ code: 1, skipped: false }),
    );
    expect(report.results[1]).toEqual(expect.objectContaining({ skipped: true }));
  });
});

describe('review.check-gates governance order', () => {
  it('places semantic cold audit before the single release full check', () => {
    const root = resolve(import.meta.dirname, '..', '..');
    const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
    const governance = readFileSync(
      resolve(
        root,
        '.agents/skills/mtg-onedeck-development/references/document-governance.md',
      ),
      'utf8',
    );
    const audit = readFileSync(resolve(root, '.claude/audit-standing.md'), 'utf8');
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    for (const text of [agents, governance]) {
      expect(text).toContain('AUDIT-OK-PENDING-FULL-CHECK');
      expect(text.indexOf('AUDIT-OK-PENDING-FULL-CHECK')).toBeLessThan(
        text.lastIndexOf('npm run check'),
      );
    }
    expect(audit).toContain('AUDIT-OK-PENDING-FULL-CHECK');
    expect(audit).toContain('同一fingerprint');
    expect(audit).toContain('対象domain');
    expect(packageJson.scripts.check).toBe('node scripts/checks/machine-checks.mjs');
    expect(packageJson.scripts.test).toBe('node scripts/checks/vitest-projects.mjs');
  });
});
