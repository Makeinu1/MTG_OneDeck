import { describe, expect, it } from 'vitest';

import { runVitestProjects } from '../checks/vitest-projects.mjs';

describe('sequential Vitest projects', () => {
  it('is import-safe and exposes the runner without spawning projects', () => {
    expect(runVitestProjects).toBeTypeOf('function');
  });

  it('runs core to completion before starting dom', () => {
    const calls = [];

    const report = runVitestProjects({
      spawn: (cmd, args, options) => {
        calls.push([cmd, args, options]);
        return { status: 0 };
      },
      write: () => {},
    });

    expect(calls).toEqual([
      [
        'npx',
        ['vitest', 'run', '--project', 'core'],
        { stdio: 'inherit', shell: false },
      ],
      [
        'npx',
        ['vitest', 'run', '--project', 'dom'],
        { stdio: 'inherit', shell: false },
      ],
    ]);
    expect(report).toEqual({
      exitCode: 0,
      results: [
        { project: 'core', code: 0, skipped: false },
        { project: 'dom', code: 0, skipped: false },
      ],
    });
  });

  it('fails fast without spawning dom after a core failure', () => {
    const calls = [];

    const report = runVitestProjects({
      spawn: (_cmd, args) => {
        calls.push(args);
        return { status: 7 };
      },
      write: () => {},
    });

    expect(calls).toEqual([
      ['vitest', 'run', '--project', 'core'],
    ]);
    expect(report).toEqual({
      exitCode: 7,
      results: [
        { project: 'core', code: 7, skipped: false },
        { project: 'dom', code: null, skipped: true },
      ],
    });
  });

  it('treats a null spawn status as failure and does not start dom', () => {
    const calls = [];

    const report = runVitestProjects({
      spawn: (_cmd, args) => {
        calls.push(args);
        return { status: null };
      },
      write: () => {},
    });

    expect(calls).toEqual([
      ['vitest', 'run', '--project', 'core'],
    ]);
    expect(report.exitCode).toBe(1);
    expect(report.results).toEqual([
      { project: 'core', code: 1, skipped: false },
      { project: 'dom', code: null, skipped: true },
    ]);
  });

  it('preserves a dom failure after core succeeds', () => {
    const statuses = [0, 9];

    const report = runVitestProjects({
      spawn: () => ({ status: statuses.shift() }),
      write: () => {},
    });

    expect(report.exitCode).toBe(9);
    expect(report.results).toEqual([
      { project: 'core', code: 0, skipped: false },
      { project: 'dom', code: 9, skipped: false },
    ]);
  });
});
