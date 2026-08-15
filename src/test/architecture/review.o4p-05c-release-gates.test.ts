import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '7dc41384bf6763986a47151d69f78f31021976fe';

function sourceFiles(root: string): readonly string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'test') result.push(...sourceFiles(path));
    } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) result.push(path);
  }
  return result;
}

describe('O4P-05C release-gate architecture boundary', () => {
  it('keeps the evidence aggregator test-only with no production import or barrel export', () => {
    const production = sourceFiles(resolve(ROOT, 'src'));
    for (const path of production) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/releaseGateEvidenceV1/);
    }
    expect(readFileSync(resolve(ROOT, 'src/online/cloudflare/index.ts'), 'utf8')).not.toMatch(/releaseGate/i);
  });

  it('keeps production, configuration, versions, dependencies, and the local CR pin unchanged', () => {
    const protectedRoots = [
      'rule',
      'wrangler.jsonc',
      'src/engine',
      'src/online/architecture',
      'src/online/room',
      'src/online/protocol',
      'src/online/projection',
      'src/online/headless',
      'src/online/cloudflare/codec.ts',
      'src/online/cloudflare/facts.ts',
      'src/online/cloudflare/index.ts',
      'src/online/cloudflare/outbox.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/security.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/types.ts',
      'src/online/cloudflare/websocket.ts',
      'src/online/cloudflare/worker.ts',
      'src/versioning',
    ];
    const drift = execFileSync('git', ['diff', '--name-only', BASE_SHA, '--', ...protectedRoots], { cwd: ROOT, encoding: 'utf8' }).trim();
    expect(drift).toBe('');

    const before = JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:package.json`], { cwd: ROOT, encoding: 'utf8' })) as Record<string, unknown>;
    const after = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(readFileSync(resolve(ROOT, 'research/cr-grounding/o4p-05c-release-gates.contract.draft.md'), 'utf8')).toContain('mtg-cr-2026-06-19');
  });

  it('keeps external production mutation and unbounded launch claims deferred to O4P-05D', () => {
    const implementation = readFileSync(resolve(ROOT, 'src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts'), 'utf8');
    expect(implementation).not.toMatch(/fetch\s*\(|WebSocket|process\.env|random|Date\.|setTimeout|wrangler|cloudflare/i);
    expect(implementation).not.toMatch(/react|zustand|document\.|window\./i);
    const contract = readFileSync(resolve(ROOT, 'research/cr-grounding/o4p-05c-release-gates.contract.draft.md'), 'utf8');
    expect(contract).toMatch(/O4P-05D owns the final Cloudflare\/Pages production release closure/);
    expect(contract).toMatch(/24-hour wall-clock soak remain outside/);
  });
});
