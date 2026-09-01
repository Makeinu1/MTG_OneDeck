import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  EMPTY_TREE_SHA,
  resolveDiff,
  runReleaseCheck,
} from '../checks/release-check.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-release-check-'));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Test');
  writeFileSync(join(cwd, 'README.md'), 'first\n');
  git(cwd, 'add', 'README.md');
  git(cwd, 'commit', '-qm', 'first');
  const base = git(cwd, 'rev-parse', 'HEAD');
  writeFileSync(join(cwd, 'README.md'), 'second\n');
  git(cwd, 'add', 'README.md');
  git(cwd, 'commit', '-qm', 'second');
  const head = git(cwd, 'rev-parse', 'HEAD');
  return { cwd, base, head };
}

function quietOptions(overrides = {}) {
  return {
    spawn: () => ({ status: 0, signal: null, error: null }),
    write: () => {},
    error: () => {},
    ...overrides,
  };
}

describe('release-check', () => {
  test('accepts the canonical empty-tree first-push diff and passes it as an object', () => {
    const repo = repository();
    try {
      let received;
      const result = runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        base: EMPTY_TREE_SHA,
        head: repo.head,
        forbidden: ({ base, head, diff }) => {
          expect(base).toBe(EMPTY_TREE_SHA);
          expect(head).toBe(repo.head);
          received = diff;
          return 0;
        },
      }));
      expect(result.exitCode).toBe(0);
      expect(received).toEqual({ base: EMPTY_TREE_SHA, head: repo.head, baseType: 'tree' });
      expect(result.diff).toEqual(received);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('runs the real forbidden checker against a clean commit diff', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'README.md'), `TOKEN=${'a'.repeat(24)}\n`);
      git(repo.cwd, 'add', 'README.md');
      git(repo.cwd, 'commit', '-qm', 'secret');
      const head = git(repo.cwd, 'rev-parse', 'HEAD');
      const result = runReleaseCheck(quietOptions({ cwd: repo.cwd, base: repo.base, head }));
      expect(result.stage).toBe('forbidden');
      expect(result.exitCode).not.toBe(0);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('runs the real forbidden checker against an empty-tree first commit', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'onedeck-release-empty-tree-'));
    try {
      git(cwd, 'init', '-q');
      git(cwd, 'config', 'user.email', 'validation@example.test');
      git(cwd, 'config', 'user.name', 'Validation Test');
      writeFileSync(join(cwd, 'README.md'), `TOKEN=${'b'.repeat(24)}\n`);
      git(cwd, 'add', 'README.md');
      git(cwd, 'commit', '-qm', 'first-secret');
      const head = git(cwd, 'rev-parse', 'HEAD');
      const result = runReleaseCheck(quietOptions({ cwd, base: EMPTY_TREE_SHA, head }));
      expect(result.stage).toBe('forbidden');
      expect(result.exitCode).not.toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('resolves an ancestor commit base and rejects arbitrary object types', () => {
    const repo = repository();
    try {
      expect(resolveDiff(repo.cwd, repo.base, repo.head)).toEqual({
        base: repo.base,
        head: repo.head,
        baseType: 'commit',
      });
      const tree = git(repo.cwd, 'rev-parse', `${repo.base}^{tree}`);
      expect(() => resolveDiff(repo.cwd, tree, repo.head)).toThrow(/commit or the canonical empty tree/);
      expect(() => resolveDiff(repo.cwd, 'not-a-ref', repo.head)).toThrow(/invalid base/);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('rejects a dirty checkout before starting child checks', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'dirty.txt'), 'uncommitted\n');
      let spawned = false;
      expect(() => runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        base: repo.base,
        head: repo.head,
        spawn: () => {
          spawned = true;
          return { status: 0 };
        },
      }))).toThrow(/must be clean/);
      expect(spawned).toBe(false);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('rejects a requested head that differs from checkout HEAD', () => {
    const repo = repository();
    try {
      expect(() => runReleaseCheck(quietOptions({ cwd: repo.cwd, base: repo.base, head: repo.base })))
        .toThrow(/HEAD mismatch/);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('preserves numeric check exit codes after a green forbidden scan', () => {
    const repo = repository();
    try {
      let forbiddenCalled = false;
      const result = runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        base: repo.base,
        head: repo.head,
        spawn: () => ({ status: 17, signal: null, error: null }),
        forbidden: () => {
          forbiddenCalled = true;
          return 0;
        },
      }));
      expect(result).toMatchObject({ exitCode: 17, stage: 'check' });
      expect(forbiddenCalled).toBe(true);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('returns forbidden failure and keeps the resolved diff object', () => {
    const repo = repository();
    try {
      let received;
      let spawned = false;
      const result = runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        base: repo.base,
        head: repo.head,
        spawn: () => {
          spawned = true;
          return { status: 0 };
        },
        forbidden: ({ diff }) => {
          received = diff;
          return 23;
        },
      }));
      expect(result).toMatchObject({ exitCode: 23, stage: 'forbidden', diff: received });
      expect(spawned).toBe(false);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('reports signals and spawn errors with conventional exit codes', () => {
    const repo = repository();
    try {
      const diagnostics = [];
      const signal = runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        spawn: () => ({ status: null, signal: 'SIGTERM', error: null }),
        error: (line) => diagnostics.push(line),
      }));
      expect(signal.exitCode).toBe(143);
      expect(diagnostics.join('\n')).toMatch(/terminated by SIGTERM.*143/);
      const spawnError = runReleaseCheck(quietOptions({
        cwd: repo.cwd,
        spawn: () => ({ status: null, signal: null, error: Object.assign(new Error('missing npm'), { code: 'ENOENT' }) }),
        error: (line) => diagnostics.push(line),
      }));
      expect(spawnError.exitCode).toBe(127);
      expect(diagnostics.join('\n')).toMatch(/spawn error.*ENOENT.*127/);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('completes cleanly without mutating tracked files', () => {
    const repo = repository();
    try {
      const before = readFileSync(join(repo.cwd, 'README.md'), 'utf8');
      const statusBefore = git(repo.cwd, 'status', '--porcelain=v1');
      const result = runReleaseCheck(quietOptions({ cwd: repo.cwd, base: repo.base, head: repo.head }));
      expect(result).toMatchObject({ exitCode: 0, stage: 'complete' });
      expect(readFileSync(join(repo.cwd, 'README.md'), 'utf8')).toBe(before);
      expect(git(repo.cwd, 'status', '--porcelain=v1')).toBe(statusBefore);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });
});
