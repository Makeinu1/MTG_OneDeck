import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as Browser from '../../online/browser/index';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const browserRoot = resolve(repositoryRoot, 'src/online/browser');
const baseSha = 'f050bd5b0db21b70a4fd6edbd89719b57bbf9e56';

function normalized(path: string): string { return relative(repositoryRoot, path).split(sep).join('/'); }
function productionFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__') files.push(...productionFiles(path));
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}
function specifiers(text: string): readonly string[] {
  return [...text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2] ?? '');
}

describe('O4P-06D browser WebSocket architecture boundary', () => {
  it('exports only the versioned browser client surface without dependency drift', () => {
    for (const name of [
      'ONLINE_BROWSER_CLIENT_SCHEMA_VERSION_V1',
      'ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1',
      'ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1',
      'createOnlineBrowserWebSocketClientV1',
    ]) expect(Object.prototype.hasOwnProperty.call(Browser, name), name).toBe(true);
    expect(Browser.ONLINE_BROWSER_CLIENT_SCHEMA_VERSION_V1).toBe(1);
    expect(Browser.ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1).toBe(64);
    expect(Browser.ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1).toEqual([250, 500, 1000, 2000, 4000, 8000]);

    const before = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], { cwd: repositoryRoot, encoding: 'utf8' })) as Record<string, unknown>;
    const after = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
  });

  it('uses only public lower barrels and has no reverse or ambient authority', () => {
    const allowed = new Set([
      '../../engine/core/index',
      '../../versioning/index',
      '../projection/index',
      '../protocol/index',
      '../room/index',
    ]);
    for (const file of productionFiles(browserRoot)) {
      const text = readFileSync(file, 'utf8');
      for (const specifier of specifiers(text)) {
        const local = specifier.startsWith('./') && !specifier.includes('..');
        expect(local || allowed.has(specifier), `${normalized(file)} -> ${specifier}`).toBe(true);
      }
      expect(text, normalized(file)).not.toMatch(/react|react-dom|zustand|localStorage|sessionStorage|indexedDB|caches\.|document\.|console\.|Math\.random|Date\.now|online\/cloudflare|\.\.\/cloudflare/i);
    }
    for (const root of ['src/engine', 'src/online/room', 'src/online/protocol', 'src/online/projection', 'src/online/cloudflare']) {
      for (const file of productionFiles(resolve(repositoryRoot, root))) {
        expect(readFileSync(file, 'utf8'), normalized(file)).not.toMatch(/online\/browser|\.\.\/browser/);
      }
    }
  });

  it('pins closed validation, projection-only authority, bounded recovery, and no ambient persistence', () => {
    const source = productionFiles(browserRoot).map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).toContain('validateOnlineParticipantProjectionAny');
    expect(source).toContain('validateOnlineCommandEnvelopeV1');
    expect(source).toContain('Object.getOwnPropertyDescriptors');
    expect(source).toContain('ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1');
    expect(source).toContain('ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1');
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|CacheStorage|cookie|navigator\.sendBeacon/);
  });
});
