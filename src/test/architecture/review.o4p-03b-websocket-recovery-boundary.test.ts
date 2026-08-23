import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cloudflareRoot = resolve(repositoryRoot, 'src/online/cloudflare');
const baseSha = 'c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9';

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function normalized(path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') paths.push(...productionFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      paths.push(path);
    }
  }
  return paths.sort();
}

function moduleSpecifiers(text: string): readonly string[] {
  return [...text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map(
    (match) => match[2] ?? '',
  );
}

describe('O4P-03B architecture boundary', () => {
  it('adds only the closed dependency-free Cloudflare transport surface', () => {
    const expected = [
      'src/online/cloudflare/codec.ts',
      'src/online/cloudflare/facts.ts',
      'src/online/cloudflare/index.ts',
      'src/online/cloudflare/outbox.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/scryfallResolver.ts',
      'src/online/cloudflare/security.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/types.ts',
      'src/online/cloudflare/websocket.ts',
      'src/online/cloudflare/worker.ts',
    ];
    expect(productionFiles(cloudflareRoot).map(normalized)).toEqual(expected);
    for (const path of [
      'research/cr-grounding/o4p-03b-websocket-recovery.contract.draft.md',
      'research/cr-grounding/o4p-03b-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-03b-implementation-brief.draft.md',
      'research/cr-grounding/o4p-03b-cold-audit-brief.draft.md',
      'src/online/cloudflare/__tests__/review.o4p-03b-websocket-recovery.test.ts',
      'src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts',
      'scripts/checks/verify-online-cloudflare-websocket-recovery.ts',
    ]) expect(existsSync(resolve(repositoryRoot, path)), path).toBe(true);

    const before = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })) as Record<string, unknown>;
    const after = JSON.parse(source('package.json')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(source('package-lock.json')).not.toMatch(/@cloudflare|wrangler|miniflare|workerd/i);
  });

  it('permits only shipped public lower barrels and preserves every reverse boundary', () => {
    const allowed = new Set([
      '../protocol/index',
      '../projection/index',
      '../room/index',
      '../room/validationSupport',
      '../lobby/index',
      '../deckSubmission/index',
      '../genesis/index',
      '../../engine/core/index',
    ]);
    for (const file of productionFiles(cloudflareRoot)) {
      const text = readFileSync(file, 'utf8');
      if (normalized(file) === 'src/online/cloudflare/facts.ts') {
        expect(text).toMatch(/console\.log\(JSON\.stringify\(fact\)\)/);
      } else {
        expect(text, normalized(file)).not.toMatch(/react|react-dom|zustand|indexeddb|localstorage|console\.|node:/i);
      }
      for (const specifier of moduleSpecifiers(text)) {
        const local = specifier.startsWith('./') && !specifier.includes('..');
        expect(local || allowed.has(specifier), `${normalized(file)} -> ${specifier}`).toBe(true);
      }
    }
    for (const root of [
      'src/engine',
      'src/online/room',
      'src/online/protocol',
      'src/online/projection',
      'src/online/deckSubmission',
      'src/online/genesis',
      'src/online/headless',
      'src/store',
    ]) {
      for (const file of productionFiles(resolve(repositoryRoot, root))) {
        expect(readFileSync(file, 'utf8'), normalized(file)).not.toMatch(/online\/cloudflare|\.\.\/cloudflare/);
      }
    }
  });

  it('uses only the Hibernation API and keeps attachments closed, secret-free, and bounded', () => {
    const runtime = source('src/online/cloudflare/runtime.ts');
    const websocket = source('src/online/cloudflare/websocket.ts');
    const types = source('src/online/cloudflare/types.ts');
    expect(runtime).toMatch(/this\.state\.acceptWebSocket\(pair\.server\)/);
    expect(runtime).toMatch(/webSocketMessage\s*\(/);
    expect(runtime).toMatch(/webSocketClose\s*\(/);
    expect(runtime).toMatch(/webSocketError\s*\(/);
    const errorHandler = runtime.match(/webSocketError\(socket: OnlineCloudflareWebSocket\): void \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    expect(errorHandler).toContain("emitWebSocketFactV1('error'");
    expect(errorHandler).not.toMatch(/handleDisconnect|persistSameRevision|repository\.|security\.|socket\.close/);
    expect(runtime).not.toMatch(/\.accept\s*\(|addEventListener\s*\(|onmessage|onclose|onerror/);
    expect(`${runtime}\n${websocket}`).not.toMatch(/setTimeout|setInterval|alarm\s*\(/);
    expect(types).toMatch(/ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1\s*=\s*16_384/);
    expect(types).toMatch(/readonly acceptWebSocket:/);
    expect(types).toMatch(/readonly getWebSockets:/);
    expect(types).not.toMatch(/acceptWebSocket\?:|getWebSockets\?:/);
    expect(websocket).toMatch(/Object\.getOwnPropertyNames/);
    expect(websocket).toMatch(/Object\.getOwnPropertySymbols/);
    expect(websocket).toMatch(/Object\.getOwnPropertyDescriptor/);
    expect(websocket).not.toMatch(/participantCapability|observerCapability|seatCapability|receiptDigest|coreRoot/);
  });

  it('keeps same-revision presence persistence exact and accepted-command authority unchanged', () => {
    const persistence = source('src/online/cloudflare/persistence.ts');
    const sameRevisionPersistence = persistence.match(
      /persistSameRevision\s*\([\s\S]*?\n {2}\}\n\n\}/,
    )?.[0] ?? '';
    expect(persistence).toMatch(/persistSameRevision\s*\(/);
    expect(sameRevisionPersistence).not.toBe('');
    expect(persistence).not.toMatch(/commitPresence\s*\(|persistPresence\s*\(|commitPresenceSameRevision\s*\(/);
    expect(persistence).toMatch(
      /UPDATE online_room_state SET room_lifecycle = \?, state_json = \? WHERE singleton = 1 AND room_id = \? AND revision = \? AND state_json = \? RETURNING singleton/,
    );
    expect(sameRevisionPersistence).toMatch(/comparablePresenceState\(previousJson\) !== comparablePresenceState\(nextJson\)/);
    expect(sameRevisionPersistence).toMatch(/transactionSync\s*\(/);
    expect(sameRevisionPersistence).not.toMatch(/ALTER TABLE|DROP TABLE|PRAGMA|retry|setTimeout|setInterval/i);
    expect(source('src/online/cloudflare/types.ts')).toMatch(/ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1\s*=\s*1/);
  });

  it('exports only closed public helpers and exactly four immutable outbox operations', () => {
    const barrel = source('src/online/cloudflare/index.ts');
    const outbox = source('src/online/cloudflare/outbox.ts');
    expect(barrel).not.toMatch(/export\s+\*/);
    for (const name of [
      'createOnlineCloudflareOutboxV1',
      'enqueueOnlineCloudflareOutboxV1',
      'replayOnlineCloudflareOutboxV1',
      'settleOnlineCloudflareOutboxV1',
    ]) expect(barrel).toMatch(new RegExp(`\\b${name}\\b`));
    expect(barrel).not.toMatch(/appendOnline|acknowledgeOnline|frameKind|frameStringField|parseOnlineCloudflareWebSocketFrame|serializeOnlineCloudflareWebSocketValue/);
    expect(outbox).toMatch(/response:\s*unknown/);
    expect(outbox).toMatch(/Object\.getOwnPropertyNames|Object\.getOwnPropertySymbols|Object\.getOwnPropertyDescriptor/);
    expect(outbox).not.toMatch(/localStorage|indexedDB|fetch\s*\(|setTimeout|setInterval/);
  });

  it('accepts the exact O4P-03D successor config without secret or custom-route authority', () => {
    const config = JSON.parse(source('wrangler.jsonc')) as Record<string, unknown>;
    expect(config).toEqual({
      name: 'mtg-onedeck-online',
      main: 'src/online/cloudflare/worker.ts',
      compatibility_date: '2026-08-13',
      workers_dev: true,
      observability: { enabled: true, head_sampling_rate: 1 },
      version_metadata: { binding: 'CF_VERSION_METADATA' },
      durable_objects: {
        bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }],
      },
      exports: {
        OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' },
      },
    });
    const production = productionFiles(cloudflareRoot).map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(production).not.toMatch(/accountId|apiToken|customDomain|migrationTag|point.?in.?time|banParticipant|kickParticipant/i);
  });
});
