import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '8810ed2e6db69fdc93c131f6abc195af6a763066';
const CONTRACT = 'research/cr-grounding/o4p-06f-four-browser-production-release.contract.draft.md';
const ACCEPTANCE = 'research/cr-grounding/o4p-06f-acceptance-brief.draft.md';
const IMPLEMENTATION = 'research/cr-grounding/o4p-06f-implementation-brief.draft.md';
const HARNESS = 'scripts/online/o4p-06f-four-browser-evidence.ts';
const ORDINARY_TEST = 'src/online/browser/__tests__/fourBrowserProductionEvidenceV1.test.ts';
const THIS_REVIEW = 'src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts';
const FULL_CHECK_REPAIR_REVIEWS = [
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
] as const;
const PRODUCTION_CORRECTION_PATHS = [
  'src/online/cloudflare/__tests__/persistenceV1.test.ts',
  'src/online/cloudflare/__tests__/securitySqlFixture.ts',
  'src/online/cloudflare/persistence.ts',
  'src/test/architecture/modeNeutralCoreBoundary.test.ts',
] as const;

function text(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function git(...args: readonly string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

describe('review O4P-06F four-browser production release', () => {
  it('freezes the exact acceptance-only authority and unchanged product boundary', () => {
    for (const path of [CONTRACT, ACCEPTANCE, IMPLEMENTATION, HARNESS, ORDINARY_TEST, THIS_REVIEW]) {
      expect(existsSync(resolve(ROOT, path)), path).toBe(true);
    }
    expect(git('rev-parse', `${BASE_SHA}^{commit}`)).toBe(BASE_SHA);

    const changedSrc = git('diff', '--name-only', BASE_SHA, '--', 'src')
      .split('\n')
      .filter(Boolean);
    expect(changedSrc).toEqual([ORDINARY_TEST, THIS_REVIEW, ...FULL_CHECK_REPAIR_REVIEWS, ...PRODUCTION_CORRECTION_PATHS].sort());
    expect(git('diff', '--name-only', BASE_SHA, '--', 'package-lock.json', 'wrangler.jsonc', '.github')).toBe('');

    const before = JSON.parse(git('show', `${BASE_SHA}:package.json`)) as {
      dependencies?: unknown;
      devDependencies?: unknown;
    };
    const after = JSON.parse(text('package.json')) as {
      dependencies?: unknown;
      devDependencies?: unknown;
      scripts?: Record<string, unknown>;
    };
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(after.scripts?.['evidence:o4p-06f']).toBe('tsx scripts/online/o4p-06f-four-browser-evidence.ts');

    const onlineTsconfig = JSON.parse(text('scripts/online/tsconfig.json')) as { include?: unknown };
    expect(onlineTsconfig.include).toEqual(['./o4p-03d-evidence.ts', './o4p-06f-four-browser-evidence.ts']);
  });

  it('requires four isolated Chrome contexts and browser-owned production traffic', () => {
    const source = text(HARNESS);
    expect(source).toContain("const CONTEXT_COUNT = 4");
    expect(source).toContain('Target.createBrowserContext');
    expect(source).toContain('Target.disposeBrowserContext');
    expect(source).toContain('https://makeinu1.github.io/MTG_OneDeck/');
    expect(source).toContain('https://mtg-onedeck-online.makeinu1.workers.dev');
    expect(source).toContain('Runtime.evaluate');
    expect(source).toContain('browserContextId');
    expect(source).toContain('new WebSocket');
    expect(source).toContain('fetch(');
    expect(source).not.toMatch(/from ['"](?:playwright|@playwright\/test|puppeteer|ws)['"]/);
    expect(source).not.toMatch(/npm\s+(?:install|add)|npx\s+playwright/);
  });

  it('pins the four real decks, command/recovery matrix, replay comparison, and secret-free summary', () => {
    const source = text(HARNESS);
    for (const deck of ['Celes', 'Gogo', 'Kefka', 'Muldrotha']) {
      expect(source).toContain(`Mydeck/${deck}.txt`);
    }
    for (const literal of [
      'online-forming-lobby-create-v1',
      'online-forming-lobby-seat-claim-v1',
      'online-forming-lobby-deck-submit-v1',
      'online-forming-lobby-ready-v1',
      'online-forming-lobby-start-with-table-v1',
      'online-client-hello-v1',
      'online-projection-request-v1',
      'online-command-envelope-v1',
      "kind: 'table-draw'",
      "kind: 'player-exit'",
      'checkpointRevision',
      'replayCount',
      'preDeploymentProjectionHashes',
      'postDeploymentProjectionHashes',
    ]) expect(source).toContain(literal);
    expect(source).toMatch(/revision\s*!==\s*5|revision\s*===\s*5/);
    expect(source).toMatch(/acceptedCommandCount\s*!==\s*5|acceptedCommandCount\s*===\s*5/);
    expect(source).toContain('capabilityFragments');
    expect(source).toContain('assertSecretFree');
    expect(source).toContain('finally');
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:Capability|inviteCapability|seatCapability|tableCapability)/);
    expect(source).not.toMatch(/writeFile|appendFile|HAR|trace\.start|screenshot/);
  });

  it('keeps production execution injectable and ordinarily hostile-tested', () => {
    const source = text(HARNESS);
    const test = text(ORDINARY_TEST);
    expect(source).toContain('export type O4p06fEvidenceDepsV1');
    expect(source).toContain('export async function runO4p06fFourBrowserEvidenceV1');
    expect(source).toContain('export function validateO4p06fEvidenceSummaryV1');
    for (const term of [
      'four distinct', 'secret', 'fragment', 'timeout', 'cleanup', 'reconnect',
      'projection hash', 'wrong revision', 'console warning',
    ]) expect(test.toLowerCase()).toContain(term);
  });
});
