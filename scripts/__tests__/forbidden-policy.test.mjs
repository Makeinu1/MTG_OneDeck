import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const FORBIDDEN_SCRIPT = join(process.cwd(), 'scripts/checks/forbidden-files.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-forbidden-policy-'));
  mkdirSync(join(cwd, 'src', 'engine'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Test');
  writeFileSync(join(cwd, 'src', 'engine', 'example.ts'), 'export const value = 1;\n');
  writeFileSync(join(cwd, 'AGENTS.md'), 'baseline\n');
  git(cwd, 'add', 'src/engine/example.ts', 'AGENTS.md');
  git(cwd, 'commit', '-m', 'base');
  const base = git(cwd, 'rev-parse', 'HEAD');
  return { cwd, base };
}

function run(repository, ...args) {
  return spawnSync(process.execPath, [FORBIDDEN_SCRIPT, ...args], {
    cwd: repository.cwd,
    encoding: 'utf8',
  });
}

describe('forbidden policy boundaries', () => {
  test('default policy allows ordinary source changes', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'src/engine/example.ts'), 'export const value = 2;\n');
      const result = run(repository, '--diff', repository.base);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEEDS-REAUTH');
      expect(result.stdout).not.toContain('FORBIDDEN(');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('default policy protects governance files', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'AGENTS.md'), 'changed\n');
      const result = run(repository, '--diff', repository.base);
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).toBe(1);
      expect(output).toContain('FORBIDDEN');
      expect(output).toContain('AGENTS.md');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('governance-reset is restrictive only when explicitly selected', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'src/engine/example.ts'), 'export const value = 2;\n');
      const result = run(repository, '--diff', repository.base, '--policy', 'governance-reset');
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).toBe(1);
      expect(output).toContain('DOC-GOV-RESET scope');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('invalid diff references never succeed', () => {
    const repository = createRepository();
    try {
      const result = run(repository, '--diff', 'missing-base');
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });
});
