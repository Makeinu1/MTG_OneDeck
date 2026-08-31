import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { candidateFingerprint } from '../checks/fingerprint.mjs';

const ISOLATED_GIT_ENV = Object.freeze({
  ...process.env,
  GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL ?? join(tmpdir(), 'onedeck-empty-gitconfig'),
  GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM ?? '1',
});

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: ISOLATED_GIT_ENV }).trim();
}

describe('candidate fingerprint', () => {
  test('binds base, HEAD, current bytes, and deletion deterministically', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'onedeck-fingerprint-'));
    try {
      git(cwd, 'init', '-q');
      git(cwd, 'config', 'user.email', 'validation@example.test');
      git(cwd, 'config', 'user.name', 'Validation Test');
      writeFileSync(join(cwd, 'journey.txt'), 'first\n');
      git(cwd, 'add', 'journey.txt');
      git(cwd, 'commit', '-qm', 'first');
      const base = git(cwd, 'rev-parse', 'HEAD');

      writeFileSync(join(cwd, 'journey.txt'), 'second\n');
      git(cwd, 'add', 'journey.txt');
      git(cwd, 'commit', '-qm', 'second');
      const head = git(cwd, 'rev-parse', 'HEAD');
      const baseAware = candidateFingerprint({ cwd, base, head });
      expect(candidateFingerprint({ cwd, base, head })).toBe(baseAware);
      expect(candidateFingerprint({ cwd, head })).not.toBe(baseAware);

      const atSecondHead = candidateFingerprint({ cwd });
      git(cwd, 'commit', '--allow-empty', '-qm', 'third');
      const nextHead = candidateFingerprint({ cwd });
      expect(nextHead).not.toBe(atSecondHead);
      expect(() => candidateFingerprint({ cwd, head })).toThrow(
        'fingerprint head must match checkout HEAD',
      );

      unlinkSync(join(cwd, 'journey.txt'));
      expect(candidateFingerprint({ cwd })).not.toBe(nextHead);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('binds index-only content and mode independently of worktree bytes', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'onedeck-fingerprint-index-'));
    try {
      git(cwd, 'init', '-q');
      git(cwd, 'config', 'user.email', 'validation@example.test');
      git(cwd, 'config', 'user.name', 'Validation Test');
      writeFileSync(join(cwd, 'candidate.txt'), 'base\n');
      git(cwd, 'add', 'candidate.txt');
      git(cwd, 'commit', '-qm', 'base');

      writeFileSync(join(cwd, 'candidate.txt'), 'staged-one\n');
      git(cwd, 'add', 'candidate.txt');
      writeFileSync(join(cwd, 'candidate.txt'), 'base\n');
      const stagedOne = candidateFingerprint({ cwd });

      writeFileSync(join(cwd, 'candidate.txt'), 'staged-two\n');
      git(cwd, 'add', 'candidate.txt');
      writeFileSync(join(cwd, 'candidate.txt'), 'base\n');
      const stagedTwo = candidateFingerprint({ cwd });
      expect(stagedTwo).not.toBe(stagedOne);

      git(cwd, 'update-index', '--chmod=+x', 'candidate.txt');
      expect(candidateFingerprint({ cwd })).not.toBe(stagedTwo);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
