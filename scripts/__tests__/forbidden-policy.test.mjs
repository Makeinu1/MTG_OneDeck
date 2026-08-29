import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { parseArgs, scanDiff } from '../checks/forbidden-files.mjs';

const SCRIPT = join(process.cwd(), 'scripts/checks/forbidden-files.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-forbidden-'));
  mkdirSync(join(cwd, 'src'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'test@example.test');
  git(cwd, 'config', 'user.name', 'Test');
  writeFileSync(join(cwd, 'src', 'value.ts'), 'export const value = 1;\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'base');
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') };
}

describe('forbidden-files safety scan', () => {
  test('keeps ordinary changed text green and reports protected paths', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'src', 'value.ts'), 'export const value = 2;\n');
      const report = scanDiff({ cwd: repo.cwd, base: repo.base });
      expect(report.ok).toBe(true);
      expect(report.paths).toEqual(['src/value.ts']);
      expect(report.findings).toEqual([]);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('rejects secret-like additions and destructive paths', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, '.env'), `TOKEN=${'a'.repeat(24)}\n`);
      mkdirSync(join(repo.cwd, 'delete-data'), { recursive: true });
      writeFileSync(join(repo.cwd, 'delete-data', 'record.txt'), 'x\n');
      const report = scanDiff({ cwd: repo.cwd, base: repo.base });
      expect(report.ok).toBe(false);
      expect(report.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'FORBIDDEN_PATH', path: '.env' }),
        expect.objectContaining({ code: 'SECRET_LIKE_ADDED_TEXT' }),
        expect.objectContaining({ code: 'FORBIDDEN_PATH', path: 'delete-data/record.txt' }),
      ]));
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('scans secret-like content that begins with diff-looking plus signs', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, 'src', 'prefix.ts'), `+++ token=${'a'.repeat(24)}\n`);
      const report = scanDiff({ cwd: repo.cwd, base: repo.base });
      expect(report.ok).toBe(false);
      expect(report.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'SECRET_LIKE_ADDED_TEXT' }),
      ]));
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });

  test('CLI exits nonzero for malformed arguments and preserves read-only behavior', () => {
    expect(() => parseArgs(['--policy', 'governance-reset'])).toThrow(/Usage/);
    const repo = repository();
    try {
      const before = readFileSync(join(repo.cwd, 'src', 'value.ts'), 'utf8');
      const result = spawnSync(process.execPath, [SCRIPT, '--diff', repo.base], { cwd: repo.cwd, encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(readFileSync(join(repo.cwd, 'src', 'value.ts'), 'utf8')).toBe(before);
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });
});
