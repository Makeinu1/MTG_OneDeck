import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cloudflareRoot = resolve(repositoryRoot, 'src/online/cloudflare');
const baseSha = '95b34868966de671c97f0aa824422ccb0c14e051';

function normalized(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') files.push(...productionFiles(filePath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(filePath);
    }
  }
  return files.sort();
}

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function moduleSpecifiers(sourceText: string): readonly string[] {
  return [...sourceText.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map(
    (match) => match[2] ?? '',
  );
}

describe('O4P-03A architecture boundary', () => {
  it('contains exactly the required runtime/config surface without dependency drift', () => {
    const required = [
      'wrangler.jsonc',
      'src/online/cloudflare/index.ts',
      'src/online/cloudflare/types.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/codec.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/worker.ts',
      'src/online/cloudflare/__tests__/codecV1.test.ts',
      'src/online/cloudflare/__tests__/persistenceV1.test.ts',
      'src/online/cloudflare/__tests__/runtimeV1.test.ts',
      'src/online/cloudflare/__tests__/configurationV1.test.ts',
      'src/online/cloudflare/__tests__/review.o4p-03a-cloudflare-runtime-persistence.test.ts',
      'src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts',
    ];
    for (const path of required) expect(existsSync(resolve(repositoryRoot, path)), path).toBe(true);

    const before = JSON.parse(
      execFileSync('git', ['show', `${baseSha}:package.json`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }),
    ) as Record<string, unknown>;
    const after = JSON.parse(source('package.json')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(source('package-lock.json')).not.toMatch(/@cloudflare|wrangler|miniflare|workerd/i);
  });

  it('uses only local modules and shipped public lower barrels with no reverse dependency', () => {
    const allowed = new Set([
      '../protocol/index',
      '../projection/index',
      '../room/index',
      '../room/validationSupport',
      '../lobby/index',
      '../deckSubmission/index',
      '../genesis/index',
      '../pregame/index',
      '../tabletopManual/index',
      '../../engine/core/index',
    ]);
    const forbiddenSource = /(?:react|react-dom|zustand|indexeddb|localstorage|console\.|node:|addEventListener\s*\(\s*['"]message|setTimeout|setInterval)/i;
    for (const filePath of productionFiles(cloudflareRoot)) {
      const sourceText = readFileSync(filePath, 'utf8');
      if (normalized(filePath) === 'src/online/cloudflare/facts.ts') {
        expect(sourceText).toMatch(/console\.log\(JSON\.stringify\(fact\)\)/);
      } else {
        expect(sourceText, normalized(filePath)).not.toMatch(forbiddenSource);
      }
      for (const specifier of moduleSpecifiers(sourceText)) {
        const local = specifier.startsWith('./') && !specifier.includes('..');
        expect(local || allowed.has(specifier), `${normalized(filePath)} -> ${specifier}`).toBe(true);
      }
    }

    const lowerRoots = [
      'src/engine',
      'src/online/room',
      'src/online/protocol',
      'src/online/projection',
      'src/online/deckSubmission',
      'src/online/genesis',
      'src/online/headless',
      'src/store',
    ];
    for (const lowerRoot of lowerRoots) {
      for (const filePath of productionFiles(resolve(repositoryRoot, lowerRoot))) {
        expect(readFileSync(filePath, 'utf8'), normalized(filePath)).not.toMatch(
          /online\/cloudflare|\.\.\/cloudflare/,
        );
      }
    }
  });

  it('models the actual Durable Object SQLite API and enforces singleton CAS atomicity', () => {
    const types = source('src/online/cloudflare/types.ts');
    const persistence = source('src/online/cloudflare/persistence.ts');
    expect(types).toMatch(/readonly sql\s*:/);
    expect(persistence).toMatch(/storage\.sql\.exec/);
    expect(persistence).not.toMatch(/storage\.exec/);
    expect(persistence).toMatch(/singleton\s+INTEGER\s+PRIMARY\s+KEY/i);
    expect(persistence).toMatch(/CHECK\s*\(\s*singleton\s*=\s*1\s*\)/i);
    expect(persistence).toMatch(/transactionSync/);
    expect(persistence).toMatch(
      /UPDATE online_room_state[\s\S]*WHERE[\s\S]*singleton[\s\S]*room_id[\s\S]*revision/i,
    );
    expect(persistence).toMatch(/INSERT INTO online_accepted_command/);
    const sqlLiterals = Array.from(
      persistence.matchAll(/const\s+[A-Z][A-Z0-9_]*\s*=\s*(`[^`]*`|'[^']*');/gu),
      (match) => match[1] ?? '',
    ).join('\n');
    expect(sqlLiterals).toMatch(/CREATE TABLE/u);
    expect(sqlLiterals).not.toMatch(/\$\{/u);
    expect(persistence).not.toMatch(/eval\s*\(|deleteAll|ALTER TABLE|DROP TABLE|PRAGMA/i);
  });

  it('keeps the public surface closed and stores no capability-bearing envelope type', () => {
    const barrel = source('src/online/cloudflare/index.ts');
    const types = source('src/online/cloudflare/types.ts');
    expect(barrel).not.toMatch(/export\s+\*/);
    expect(types).not.toContain('OnlineCloudflareStoredCommandV1');
    expect(types).not.toMatch(/readonly envelope\s*:\s*OnlineCommandEnvelopeV1/);
    expect(barrel).toContain('ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1');
    expect(barrel).toContain('ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1');
    expect(barrel).toContain('OnlineCloudflareRepository');
    expect(barrel).toContain('OnlineRoomDurableObject');
    expect(barrel).toContain('serializeOnlineCloudflareProtocolStateV1');
    expect(barrel).toContain('deserializeOnlineCloudflareProtocolStateV1');
  });

  it('preserves the dependency-free SQLite Durable Object under the O4P-03D successor config', () => {
    const config = JSON.parse(source('wrangler.jsonc')) as Record<string, unknown>;
    expect(config.main).toBe('src/online/cloudflare/worker.ts');
    expect(config.compatibility_date).toBe('2026-08-13');
    expect(config.name).toBe('mtg-onedeck-online');
    expect(config.workers_dev).toBe(true);
    expect(config.observability).toEqual({ enabled: true, head_sampling_rate: 1 });
    expect(config.version_metadata).toEqual({ binding: 'CF_VERSION_METADATA' });
    expect(config.durable_objects).toEqual({
      bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }],
    });
    expect(config.exports).toEqual({
      OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' },
    });
    expect(config).not.toHaveProperty('migrations');
    const text = JSON.stringify(config);
    expect(text).not.toMatch(/account|route|secret|token|hostname|custom_domain|remote/i);
    expect(source('src/online/cloudflare/runtime.ts')).not.toMatch(/\.accept\s*\(/);
  });
});
