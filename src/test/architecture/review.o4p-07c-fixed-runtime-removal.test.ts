import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '6899fd4a9e1adba71651d883174647970f7a5d59';
const CONTRACT =
  'research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md';
const ACCEPTANCE = 'research/cr-grounding/o4p-07c-acceptance-brief.draft.md';
const IMPLEMENTATION = 'research/cr-grounding/o4p-07c-implementation-brief.draft.md';
const FIXTURES = [
  'src/online/bootstrap/catalog/catalogV1.ts',
  'src/online/bootstrap/fourDeckBootstrapV1.ts',
  'src/online/bootstrap/fixtures/o4p-06a-four-deck-card-catalog-v1.json',
] as const;

function source(path: string): string {
  const absolute = resolve(ROOT, path);
  expect(existsSync(absolute), `missing ${path}`).toBe(true);
  return readFileSync(absolute, 'utf8');
}

function sha256(path: string): string {
  return createHash('sha256').update(source(path)).digest('hex');
}

function git(...args: readonly string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

describe('O4P-07C fixed runtime removal and production release boundary', () => {
  it('freezes the exact Judge authority at the clean O4P-07B terminal base', () => {
    expect(git('rev-parse', `${BASE_SHA}^{commit}`)).toBe(BASE_SHA);
    expect(sha256(CONTRACT)).toBe(
      '793b2ce5534e70ed1989e7d8cc8c7826f0a4155b176deb3dcbedffe43ff878d2',
    );
    expect(sha256(ACCEPTANCE)).toBe(
      '56b124717bab3e6f961f2613c9874eef26f10c9f0a96f1f85e3d6bd29d5bb2ce',
    );
    expect(sha256(IMPLEMENTATION)).toBe(
      'bea8342232380418d7b7eccc8c6e797f0fa91a46deb20ad9dd7deaf21dbeb315',
    );
  });

  it('cuts legacy deck, ready, and start over to one secret-free 426 response', () => {
    const runtime = source('src/online/cloudflare/runtime.ts');
    for (const kind of [
      'online-forming-lobby-deck-submit-v1',
      'online-forming-lobby-ready-v1',
      'online-forming-lobby-start-v1',
      'online-forming-lobby-start-with-table-v1',
    ]) {
      expect(runtime).toContain(kind);
    }
    expect(runtime).toContain('online-forming-lobby-upgrade-required-v1');
    expect(runtime).toMatch(/requiredSchemaVersion:\s*2/);
    expect(runtime).toMatch(/status:\s*426/);
    expect(runtime).not.toMatch(
      /submitOnlineFormingLobbyDeckV1|setOnlineFormingLobbySeatReadyV1|startOnlineFormingLobbyV1|startOnlineFormingLobbyWithTableV1/,
    );
    expect(runtime).not.toContain('online-forming-lobby-deck-submitted-v1');
    expect(source('src/online/publicApp/index.ts')).not.toContain(
      'createPublicOnlineControllerV1',
    );
    expect(source('src/online/cloudflare/index.ts')).not.toMatch(
      /startOnlineFormingLobbyV1|startOnlineFormingLobbyWithTableV1/,
    );
  });

  it('keeps the fixed catalog byte-identical and unreachable from lobby production code', () => {
    expect(git('diff', '--name-only', BASE_SHA, '--', ...FIXTURES)).toBe('');
    const lobby = source('src/online/lobby/index.ts');
    expect(lobby).not.toMatch(/bootstrap\/index|catalogV1|fourDeckBootstrapV1/);

    const runtime = source('src/online/cloudflare/runtime.ts');
    const worker = source('src/online/cloudflare/worker.ts');
    const main = source('src/main.tsx');
    for (const production of [runtime, worker, main]) {
      expect(production).not.toMatch(
        /O4P06A_CARD_CATALOG_V1|bootstrapFourDeckGenesisV1|fourDeckBootstrapV1|catalog\/catalogV1/,
      );
    }
  });

  it('runs a fail-closed import and artifact verifier after the single release build', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:o4p-07c-production-runtime']).toBe(
      'tsx scripts/checks/verify-o4p-07c-production-runtime.ts',
    );

    const machineChecks = source('scripts/checks/machine-checks.mjs');
    const buildIndex = machineChecks.indexOf("name: 'build (型検査内蔵)'");
    const verifierIndex = machineChecks.indexOf(
      "name: 'O4P-07C Production Runtime検証'",
    );
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(verifierIndex).toBeGreaterThan(buildIndex);

    const verifier = source('scripts/checks/verify-o4p-07c-production-runtime.ts');
    for (const marker of [
      'src/main.tsx',
      'src/online/cloudflare/worker.ts',
      'src/online/bootstrap/catalog/catalogV1.ts',
      'src/online/bootstrap/fourDeckBootstrapV1.ts',
      'o4p-06a-four-deck-card-catalog-v1',
      'online-forming-lobby-deck-submit-v1',
      'dist/assets',
      '--worker-bundle=',
    ]) {
      expect(verifier).toContain(marker);
    }
    expect(verifier).toMatch(/unresolved|ambiguous/i);
  });
});
