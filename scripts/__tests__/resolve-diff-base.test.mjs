import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { resolveDiffBase } from '../checks/resolve-diff-base.mjs';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ALL_ZERO_SHA = '0'.repeat(40);

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-diff-base-'));
  mkdirSync(join(cwd, 'src'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Test');
  writeFileSync(join(cwd, 'src', 'example.ts'), 'export const value = 1;\n');
  git(cwd, 'add', 'src/example.ts');
  git(cwd, 'commit', '-m', 'base');
  const firstSha = git(cwd, 'rev-parse', 'HEAD');
  writeFileSync(join(cwd, 'src', 'example.ts'), 'export const value = 2;\n');
  git(cwd, 'add', 'src/example.ts');
  git(cwd, 'commit', '-m', 'head');
  const headSha = git(cwd, 'rev-parse', 'HEAD');
  return { cwd, firstSha, headSha };
}

describe('resolve-diff-base', () => {
  test('resolves an explicit before commit and head', () => {
    const repository = createRepository();
    try {
      expect(resolveDiffBase({ before: repository.firstSha, head: repository.headSha, cwd: repository.cwd })).toEqual({
        base: repository.firstSha,
        head: repository.headSha,
        reason: 'event.before',
      });
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('uses the head parent when workflow dispatch has no before SHA', () => {
    const repository = createRepository();
    try {
      expect(resolveDiffBase({ head: repository.headSha, cwd: repository.cwd })).toEqual({
        base: repository.firstSha,
        head: repository.headSha,
        reason: 'head-parent',
      });
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('uses the empty tree for an all-zero before SHA', () => {
    const repository = createRepository();
    try {
      expect(resolveDiffBase({ before: ALL_ZERO_SHA, head: repository.headSha, cwd: repository.cwd })).toEqual({
        base: EMPTY_TREE_SHA,
        head: repository.headSha,
        reason: 'all-zero-before',
      });
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('uses the empty tree for a repository without a parent', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'onedeck-initial-commit-'));
    try {
      git(cwd, 'init', '-q');
      git(cwd, 'config', 'user.email', 'validation@example.test');
      git(cwd, 'config', 'user.name', 'Validation Test');
      writeFileSync(join(cwd, 'README.md'), 'initial\n');
      git(cwd, 'add', 'README.md');
      git(cwd, 'commit', '-m', 'initial');
      const headSha = git(cwd, 'rev-parse', 'HEAD');
      expect(resolveDiffBase({ head: headSha, cwd })).toEqual({
        base: EMPTY_TREE_SHA,
        head: headSha,
        reason: 'empty-tree-fallback',
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('fails closed for invalid before and head values', () => {
    const repository = createRepository();
    try {
      expect(() => resolveDiffBase({ before: 'missing-before', head: repository.headSha, cwd: repository.cwd })).toThrow(
        'invalid before commit',
      );
      expect(() => resolveDiffBase({ before: repository.firstSha, head: 'missing-head', cwd: repository.cwd })).toThrow(
        'invalid head commit',
      );
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('prints a GITHUB_OUTPUT-compatible base value', () => {
    const repository = createRepository();
    try {
      const script = join(process.cwd(), 'scripts/checks/resolve-diff-base.mjs');
      const result = spawnSync(process.execPath, [script, '--before', repository.firstSha, '--head', repository.headSha], {
        cwd: repository.cwd,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`base=${repository.firstSha}\n`);
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });
});
