// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanDiff } from '../checks/forbidden-files.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function text(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-release-topology-'));
  mkdirSync(join(cwd, 'src'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'release-topology@example.test');
  git(cwd, 'config', 'user.name', 'Release Topology Test');
  writeFileSync(join(cwd, 'src', 'value.ts'), 'export const value = 1;\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'last successful release');
  return { cwd, released: git(cwd, 'rev-parse', 'HEAD') };
}

describe('R1-C release/integration topology', () => {
  it('uses fail-closed candidate-relative verification for pull requests', () => {
    const workflow = text('.github/workflows/candidate-verification.yml');
    expect(workflow).toMatch(/^\s*pull_request:\s*$/m);
    expect(workflow).not.toMatch(/^\s*push:\s*$/m);
    expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha }}');
    expect(workflow).toContain(
      'npm run check:fast -- --base "${{ github.event.pull_request.base.sha }}" --head "${{ github.event.pull_request.head.sha }}" --build-base=/MTG_OneDeck/',
    );
    expect(workflow).not.toContain('Full release candidate verification');
  });

  it('keeps manual Pages dispatch non-deploying and revalidates push-main cumulatively', () => {
    const workflow = text('.github/workflows/deploy-pages.yml');
    expect(workflow).toMatch(/^\s*push:\s*$/m);
    expect(workflow).toMatch(/^\s*workflow_dispatch:\s*$/m);
    expect(workflow).toContain("      - 'src/**'");
    expect(workflow).toContain("      - 'package-lock.json'");
    expect(workflow).toContain("      - 'wrangler.jsonc'");
    expect(workflow).toContain("      - '.github/workflows/deploy-worker.yml'");
    expect(workflow).not.toContain("      - 'docs/**'");
    expect(workflow).not.toContain("      - 'scripts/checks/m6-*.mjs'");
    expect(workflow).toContain("build:\n    if: github.event_name == 'push'");
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('node scripts/checks/resolve-diff-base.mjs --before');
    expect(workflow).toContain('gh api');
    expect(workflow).toContain(
      'actions/workflows/deploy-pages.yml/runs?branch=main&status=success&per_page=20',
    );
    expect(workflow).toContain('select(.event == "push")');
    expect(workflow).toContain(EMPTY_TREE);
    expect(workflow).toContain(
      'npm run check:release -- --base "${{ steps.diff-base.outputs.base }}" --head "${{ github.sha }}" --build-base=/MTG_OneDeck/',
    );
    expect(workflow.indexOf('steps.diff-base.outputs.base')).toBeLessThan(
      workflow.indexOf('actions/configure-pages@'),
    );
  });

  it('deploys the Worker only from the exact successful Pages main-push SHA', () => {
    const workflow = text('.github/workflows/deploy-worker.yml');
    expect(workflow).toContain('workflow_run:');
    expect(workflow).not.toMatch(/^\s*workflow_dispatch:\s*$/m);
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
    expect(workflow).not.toContain('Checkout manual-dispatch SHA');
  });

  it('keeps a failed main commit inside the next cumulative release scan', () => {
    const repo = repository();
    try {
      writeFileSync(join(repo.cwd, '.env'), 'R1_C_TEST=1\n');
      git(repo.cwd, 'add', '.env');
      git(repo.cwd, 'commit', '-qm', 'bad main commit');
      const failedMain = git(repo.cwd, 'rev-parse', 'HEAD');

      writeFileSync(join(repo.cwd, 'src', 'value.ts'), 'export const value = 2;\n');
      git(repo.cwd, 'add', 'src/value.ts');
      git(repo.cwd, 'commit', '-qm', 'innocent follow-up');

      const immediateParentOnly = scanDiff({ cwd: repo.cwd, base: failedMain });
      expect(immediateParentOnly.ok).toBe(true);

      const cumulative = scanDiff({ cwd: repo.cwd, base: repo.released });
      expect(cumulative.ok).toBe(false);
      expect(cumulative.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'FORBIDDEN_PATH', path: '.env' }),
      ]));
    } finally {
      rmSync(repo.cwd, { recursive: true, force: true });
    }
  });
});
