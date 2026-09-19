import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  detectWriteCapable,
  historicalAuthorizationNeedsMarker,
  validateRepositoryHygiene,
} from '../checks/check-repository-hygiene.mjs';

const roots = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function put(root, path, content) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'm5-hygiene-'));
  roots.push(root);
  put(root, '.github/workflows/a.yml', [
    'name: A',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  evidence:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: node scripts/online/sample-evidence.mjs',
    '      - run: echo artifact',
    '',
  ].join('\n'));
  put(root, 'scripts/online/sample-evidence.mjs', 'console.log("sample");\n');
  put(root, 'scripts/evidence/registry.json', JSON.stringify({
    contracts: [{
      id: 'E1',
      executor: { script: 'scripts/online/sample-evidence.mjs' },
      executionPath: { workflow: '.github/workflows/a.yml', job: 'evidence', artifact: 'artifact' },
    }],
  }));
  put(root, 'scripts/journeys/registry.json', JSON.stringify({ journeys: [] }));
  put(root, 'package.json', JSON.stringify({ scripts: {} }));
  put(root, 'docs/old.md', 'User authorization: historical only. NON-REPLAYABLE.\n');
  put(root, 'scripts/checks/repository-hygiene.json', JSON.stringify({
    schemaVersion: 1,
    status: 'CURRENT_REPOSITORY_HYGIENE',
    workflows: [{
      path: '.github/workflows/a.yml',
      lifecycle: 'ACTIVE',
      owner: 'verification',
      purpose: 'fixture',
      writeCapable: false,
    }],
    historicalAuthorization: {
      discoveryPhrases: ['User authorization:'],
      requiredMarker: 'NON-REPLAYABLE',
      paths: ['docs/old.md'],
    },
    evidenceAssets: [{
      path: 'scripts/online/sample-evidence.mjs',
      lifecycle: 'ACTIVE_CONTRACT',
      owner: 'E1',
      consumers: ['scripts/evidence/registry.json'],
      reason: 'fixture',
    }],
  }));
  return root;
}

describe('repository hygiene primitives', () => {
  it('detects repository and external write workflows', () => {
    expect(detectWriteCapable('permissions:\n  contents: write\n')).toBe(true);
    expect(detectWriteCapable('uses: cloudflare/wrangler-action@v4')).toBe(true);
    expect(detectWriteCapable('permissions:\n  contents: read\n')).toBe(false);
  });

  it('recognizes replayable-looking historical authorization text', () => {
    expect(historicalAuthorizationNeedsMarker('User authorization: old', ['User authorization:'])).toBe(true);
    expect(historicalAuthorizationNeedsMarker('ordinary prose', ['User authorization:'])).toBe(false);
  });
});

describe('repository hygiene fail-closed inventory', () => {
  it('accepts a fully owned workflow/evidence graph', () => {
    expect(validateRepositoryHygiene({ root: fixture() })).toMatchObject({
      ok: true,
      workflowCount: 1,
      evidenceCount: 1,
    });
  });

  it('rejects an unclassified workflow', () => {
    const root = fixture();
    put(root, '.github/workflows/unowned.yml', 'name: orphan\n');
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('workflow: unclassified .github/workflows/unowned.yml');
  });

  it('rejects missing workflow marker and patch bundle references', () => {
    const root = fixture();
    put(root, '.github/workflows/a.yml', [
      'name: A',
      'on:',
      '  push:',
      '    paths: [.github/missing.marker]',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  evidence:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: git apply .github/missing.patch',
      '      - run: node scripts/online/sample-evidence.mjs',
      '      - run: echo artifact',
      '',
    ].join('\n'));
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('dangling workflow reference .github/missing.marker');
    expect(report.errors.join('\n')).toContain('dangling workflow reference .github/missing.patch');
  });

  it('rejects replayable-looking historical authorization without the marker', () => {
    const root = fixture();
    put(root, 'research/old-plan.md', 'User authorization: publish this.\n');
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('discovered replayable-looking record research/old-plan.md');
  });

  it('rejects active evidence whose declared consumer stops referencing it', () => {
    const root = fixture();
    put(root, 'scripts/evidence/registry.json', JSON.stringify({ contracts: [] }));
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('consumer scripts/evidence/registry.json no longer references asset');
  });

  it('rejects a package execution entry whose local script disappeared', () => {
    const root = fixture();
    put(root, 'package.json', JSON.stringify({ scripts: { broken: 'node scripts/missing-task.mjs' } }));
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('execution-orphan package script broken');
  });

  it('rejects duplicate workflow owner/purpose claims instead of guessing which gate owns the role', () => {
    const root = fixture();
    put(root, '.github/workflows/b.yml', 'name: B\n');
    const path = join(root, 'scripts/checks/repository-hygiene.json');
    const registry = JSON.parse(readFileSync(path, 'utf8'));
    registry.workflows.push({
      path: '.github/workflows/b.yml',
      lifecycle: 'ACTIVE',
      owner: 'verification',
      purpose: 'fixture',
      writeCapable: false,
    });
    writeFileSync(path, JSON.stringify(registry));
    const report = validateRepositoryHygiene({ root });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('workflow duplicate-gate purpose');
  });
});
