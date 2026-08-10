import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { collectChangedFiles } from '../checks/change-detector.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-change-detector-'));
  mkdirSync(join(cwd, 'src', 'engine'), { recursive: true });
  mkdirSync(join(cwd, 'src', 'store'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Test');
  writeFileSync(join(cwd, 'src', 'engine', 'one.ts'), 'export const one = 1;\n');
  writeFileSync(join(cwd, 'src', 'store', 'two.ts'), 'export const two = 2;\n');
  git(cwd, 'add', 'src/engine/one.ts', 'src/store/two.ts');
  git(cwd, 'commit', '-m', 'base');
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') };
}

describe('change detector', () => {
  test('unions unstaged, staged, and untracked paths without duplicates', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'src', 'engine', 'one.ts'), 'export const one = 11;\n');
      writeFileSync(join(repo.cwd, 'src', 'store', 'two.ts'), 'export const two = 22;\n');
      git(repo.cwd, 'add', 'src/store/two.ts');
      writeFileSync(join(repo.cwd, 'src', 'new.ts'), 'export const newValue = true;\n');

      const result = collectChangedFiles({ cwd: repo.cwd });
      expect(result.mode).toBe('working-tree-only');
      expect(result.files).toEqual([
        'src/engine/one.ts',
        'src/new.ts',
        'src/store/two.ts',
      ]);
      expect(new Set(result.files).size).toBe(result.files.length);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('detects committed clean-worktree changes with base-aware mode', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'src', 'engine', 'one.ts'), 'export const one = 11;\n');
      git(repo.cwd, 'add', 'src/engine/one.ts');
      git(repo.cwd, 'commit', '-m', 'committed change');
      const head = git(repo.cwd, 'rev-parse', 'HEAD');
      const result = collectChangedFiles({ cwd: repo.cwd, base: repo.base, head });
      expect(result.mode).toBe('base-aware');
      expect(result.base).toBe(repo.base);
      expect(result.head).toBe(head);
      expect(result.files).toEqual(['src/engine/one.ts']);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('retains both sides of a rename and a deleted path', () => {
    const repo = repository();
    try {
      git(repo.cwd, 'mv', 'src/engine/one.ts', 'src/engine/renamed.ts');
      git(repo.cwd, 'rm', 'src/store/two.ts');
      const result = collectChangedFiles({ cwd: repo.cwd });
      expect(result.files).toEqual([
        'src/engine/one.ts',
        'src/engine/renamed.ts',
        'src/store/two.ts',
      ]);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('fails closed for an invalid base', () => {
    const repo = repository();
    try {
      expect(() => collectChangedFiles({ cwd: repo.cwd, base: 'missing-base' })).toThrow('invalid git ref');
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });
});
