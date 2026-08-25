import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  addedText,
  buildReleasePreflight,
  checkGeneratedApi,
  fixedNextGuardPaths,
  ownerViolation,
  workflowHasCorrectDiffBase,
} from '../checks/release-preflight.mjs';
import { verifyTerminalMetadata } from '../checks/terminal-metadata.mjs';

const write = (root, path, text) => {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, text);
};

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const ledger = (status = 'audited', extra = {}) => ({
  statusDefinitions: { pending: 'pending', audited: 'audited', shipped: 'shipped' },
  goalPolicy: { note: 'semantic policy note', evidence: ['semantic policy evidence'] },
  domains: [{ id: 'M1', status, evidence: [], ...extra }],
  plannedSequence: [{ domainId: 'M1', status, evidence: [], ...extra }],
});

function repoFixture(status = 'audited') {
  const root = mkdtempSync(join(tmpdir(), 'onedeck-terminal-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger(status), null, 2)}\n`);
  write(root, '.claude/loop-state.md', 'milestone: M1\nstep: implementation\n');
  write(root, 'src/app.ts', 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'base']);
  return { root, base: git(root, ['rev-parse', 'HEAD']) };
}

describe('terminal metadata classifier', () => {
  it('classifies synchronized terminal fields and keeps fingerprints reproducible', () => {
    const { root, base } = repoFixture();
    const usage = {
      modelCycles: 1,
      cachedInputTokens: 2,
      uncachedInputTokens: 3,
      compactions: 0,
      repairWaves: 0,
      fullChecks: 1,
      ciRuns: 1,
      elapsedMs: 10,
    };
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger('shipped', { usage }), null, 2)}\n`);
    write(root, '.claude/loop-state.md', 'milestone: complete\nstep: complete\n');

    const first = verifyTerminalMetadata({ root, base, requireTerminal: true });
    const second = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(first).toMatchObject({ ok: true, lane: 'terminal', errors: [] });
    expect(first.semanticFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.terminalFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(second.semanticFingerprint).toBe(first.semanticFingerprint);
    expect(second.terminalFingerprint).toBe(first.terminalFingerprint);
  });

  it('classifies product and unsynchronized ledger changes as semantic and only fails on request', () => {
    const { root, base } = repoFixture();
    write(root, 'src/app.ts', 'export const value = 2;\n');
    const classified = verifyTerminalMetadata({ root, base });
    const required = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(classified).toMatchObject({ ok: true, lane: 'semantic', errors: [] });
    expect(classified.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NON_TERMINAL_PATH', path: 'src/app.ts' }),
    ]));
    expect(required.ok).toBe(false);
    expect(required.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NON_TERMINAL_PATH' }),
    ]));
  });

  it.each([
    ['top-level note', (value) => { value.note = 'changed'; }],
    ['nested policy evidence', (value) => { value.goalPolicy.evidence.push('changed'); }],
  ])('keeps %s semantic even when the key name is terminal-like', (_, mutate) => {
    const { root, base } = repoFixture();
    const value = ledger();
    mutate(value);
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(value, null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report).toMatchObject({ ok: false, lane: 'semantic' });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SEMANTIC_LEDGER_CHANGE' }),
    ]));
  });

  it.each([
    ['pending', 'shipped', 'INVALID_TERMINAL_STATUS_TRANSITION'],
    ['shipped', 'audited', 'SHIPPED_STATUS_REGRESSION'],
    ['audited', 'unknown', 'INVALID_TERMINAL_STATUS'],
  ])('rejects terminal status transition %s -> %s', (before, after, code) => {
    const { root, base } = repoFixture(before);
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger(after), null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it('rejects a one-copy terminal promotion', () => {
    const { root, base } = repoFixture();
    const value = ledger();
    value.domains[0].status = 'shipped';
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(value, null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNSYNCHRONIZED_TERMINAL_METADATA' }),
    ]));
  });
});

describe('release preflight regression detectors', () => {
  it('detects fixed next-ID Judge guards, incorrect CI diff base, and stale generated API', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-preflight-'));
    write(root, 'scripts/__tests__/review.program.test.mjs', [
      "const program = 'O4P-09';",
      "expect(activeProgram).toEqual({ nextDomainId: 'O4P-09D' });",
    ].join('\n'));
    write(root, '.github/workflows/deploy-pages.yml', 'run: npm run check:forbidden -- --diff HEAD^\n');
    write(root, 'scripts/checks/generate-engine-api.mjs', 'process.exitCode = 1;\n');

    expect(fixedNextGuardPaths(root, 'O4P-09')).toEqual([
      'scripts/__tests__/review.program.test.mjs',
    ]);
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
    expect(checkGeneratedApi(root)).toBe(false);
  });

  it('detects common fixed-next assertion forms but ignores exact program arrays', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-guards-'));
    write(root, 'src/test/review.literal.test.ts', "const p='O4P-09'; expect(activeProgram.nextDomainId).toBe('O4P-09D');\n");
    write(root, 'src/test/review.array.test.ts', "const p='O4P-09'; expect(activeProgram.domainIds).toEqual(['O4P-09D']);\n");
    write(root, 'src/test/review.const.test.ts', "const p='O4P-09'; const expected = 'O4P-09D'; expect(activeProgram.nextDomainId).toEqual(expected);\n");
    write(root, 'src/test/review.helper.test.ts', "const p='O4P-09'; const expected = () => 'O4P-09D'; expect(activeProgram.nextDomainId).toBe(expected());\n");
    expect(fixedNextGuardPaths(root, 'O4P-09')).toEqual([
      'src/test/review.const.test.ts',
      'src/test/review.helper.test.ts',
      'src/test/review.literal.test.ts',
    ]);
  });

  it('reads secret-like text from an untracked candidate instead of an empty git diff', () => {
    const { root, base } = repoFixture();
    const secretFixture = ['authorization', ' = ', 'fixture-sensitive-value', '\n'].join('');
    write(root, 'untracked.txt', secretFixture);
    expect(addedText(root, base, 'untracked.txt', new Set(['untracked.txt']))).toBe(secretFixture);
    expect(buildReleasePreflight({ root, base, domain: 'M1', owner: 'judge' }).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SECRET_LIKE_CHANGED_TEXT', path: 'untracked.txt' }),
      ]),
    );
  });

  it('requires executable diff-base step order rather than matching comments', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-workflow-'));
    write(root, '.github/workflows/deploy-pages.yml', [
      'jobs:', '  build:', '    steps:',
      '      # - id: diff-base',
      '      #   run: node scripts/checks/resolve-diff-base.mjs --before fake --head fake',
      '      - uses: actions/checkout@v5', '        with:', '          fetch-depth: 0',
      '      - id: change-lane', '        run: npm run check:terminal-metadata -- --base "${{ steps.diff-base.outputs.base }}"',
      '      - run: npm run check:forbidden -- --diff "${{ steps.diff-base.outputs.base }}"',
    ].join('\n'));
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
    expect(workflowHasCorrectDiffBase(process.cwd())).toBe(true);
  });

  it('does not accept correct-looking diff-base steps from a dead non-build job', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-dead-job-'));
    const correctSteps = [
      '      - uses: actions/checkout@v5', '        with:', '          fetch-depth: 0',
      '      - id: diff-base', '        run: node scripts/checks/resolve-diff-base.mjs --before before --head head',
      '      - id: change-lane', '        run: npm run check:terminal-metadata -- --base "${{ steps.diff-base.outputs.base }}"',
      '      - run: npm run check:forbidden -- --diff "${{ steps.diff-base.outputs.base }}"',
    ];
    write(root, '.github/workflows/deploy-pages.yml', [
      'jobs:', '  dead:', '    steps:', ...correctSteps,
      '  build:', '    steps:', '      - uses: actions/checkout@v5',
    ].join('\n'));
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
  });

  it('keeps implementer ownership strict', () => {
    expect(ownerViolation('scripts/__tests__/review.guard.test.mjs', 'implementer')).toMatch(/Judge/);
    expect(ownerViolation('docs/contracts/example.md', 'implementer')).toMatch(/Judge/);
    expect(ownerViolation('scripts/checks/example.mjs', 'implementer')).toBeNull();
  });

  it('rejects unknown CLI arguments', () => {
    const script = join(process.cwd(), 'scripts/checks/terminal-metadata.mjs');
    const result = spawnSync(process.execPath, [script, '--base', 'HEAD', '--unknown'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage:');
  });
});
