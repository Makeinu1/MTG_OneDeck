import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const BASE_SHA = '77105055c8b6ee3859ee4ffec813da0d122c1728';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('O4P-08C variable roster and genesis architecture review', () => {
  it('keeps the public create boundary additive and immutable', () => {
    const worker = source('src/online/cloudflare/worker.ts');
    expect(worker).toContain("const FORMING_CREATE_V5_KIND = 'online-forming-lobby-create-v5'");
    expect(worker).toContain("kind: 'online-forming-lobby-created-v5'");
    expect(worker).toContain('body.playerCount !== 4 || body.startingLife === 40');
    expect(worker).toContain("body.kind !== FORMING_CREATE_KIND && body.kind !== FORMING_CREATE_V3_KIND");
  });

  it('exports one versioned variable boundary through every Online layer', () => {
    for (const path of [
      'src/online/room/index.ts',
      'src/online/lobby/index.ts',
      'src/online/protocol/index.ts',
      'src/online/projection/index.ts',
      'src/online/genesis/index.ts',
    ]) expect(source(path), path).toContain("from './variable'");
    const contract = source('research/cr-grounding/o4p-08c-variable-roster-genesis.contract.draft.md');
    for (const term of [
      'P3/P4 are absent', '40, 60, or 100 cards and zero',
      'Existing public create/recovery v1/v3/v4', 'O4P-08D UI',
    ]) expect(contract).toContain(term);
  });

  it('allows the O4P-08D successor to consume the frozen variable boundary without dependency drift', () => {
    const changed = execFileSync('git', ['diff', '--name-only', BASE_SHA], {
      encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const candidatePaths = [...new Set([...changed, ...untracked])];
    expect(candidatePaths.some((path) => path === 'src/App.tsx')).toBe(false);
    expect(candidatePaths).toContain('src/components/online/PublicOnlineApp.tsx');
    expect(candidatePaths).toContain('src/online/tableDisplay/model.ts');
    expect(candidatePaths).toContain('src/online/workbench/model.ts');
    expect(candidatePaths).toContain('package.json');
    expect(candidatePaths).not.toContain('package-lock.json');
    expect(candidatePaths).not.toContain('wrangler.jsonc');
    const packageBefore = JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:package.json`], {
      encoding: 'utf8',
    })) as { dependencies?: unknown; devDependencies?: unknown; scripts?: Record<string, unknown> };
    const packageAfter = JSON.parse(source('package.json')) as typeof packageBefore;
    expect(packageAfter.dependencies).toEqual(packageBefore.dependencies);
    expect(packageAfter.devDependencies).toEqual(packageBefore.devDependencies);
    expect(packageAfter.scripts?.['check:release']).toBe('node scripts/checks/release-check.mjs');
    expect(() => execFileSync('git', ['diff', '--check'])).not.toThrow();
  });
});
