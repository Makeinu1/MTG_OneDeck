#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = 'c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-03b-websocket-recovery.contract.draft.md':
    'c2647339d79305eaeb0d05a5873596eb856e144777275cd65df43e10eeb79175',
  'research/cr-grounding/o4p-03b-acceptance-brief.draft.md':
    'd01b096c36310213d16bb9e4ceffd7bab39c71ca3e3b6f647b31dd3478bc32fc',
  'research/cr-grounding/o4p-03b-implementation-brief.draft.md':
    'a4212bcf32cf8b7a46cdad12444259a6fd1c4fc0a177687348377f7c5c6daad5',
  'research/cr-grounding/o4p-03b-cold-audit-brief.draft.md':
    '26a221b3e4cde53f5ba4e1dc598f759573eca8fb4b19e00ae5da41a100baa48d',
  'src/online/cloudflare/__tests__/review.o4p-03b-websocket-recovery.test.ts':
    '9a04564197dca5abeb710a815708465ea4095abe603a156c867cc6bac4c8a7d2',
  'src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts':
    '50aa37814a2e8d16a19a044b8c51558f086209a08b6cf5b8d596328baf96bc74',
  'src/online/cloudflare/index.ts':
    '987ee9cd6c0cf1e4473bdbae929f83b2c6ea47fea0647d580901dfaf3e1b25ba',
  'wrangler.jsonc':
    'c5584e703673895c3f69fc5e7b4658ecbff80145f6f8a35ee795d81d2517f9c7',
});

const requiredFiles = Object.freeze([
  'wrangler.jsonc',
  'src/online/cloudflare/index.ts',
  'src/online/cloudflare/types.ts',
  'src/online/cloudflare/codec.ts',
  'src/online/cloudflare/support.ts',
  'src/online/cloudflare/persistence.ts',
  'src/online/cloudflare/runtime.ts',
  'src/online/cloudflare/websocket.ts',
  'src/online/cloudflare/outbox.ts',
  'src/online/cloudflare/worker.ts',
  'src/online/cloudflare/__tests__/hibernationV1.test.ts',
  'src/online/cloudflare/__tests__/outboxV1.test.ts',
  'src/online/cloudflare/__tests__/review.o4p-03b-websocket-recovery.test.ts',
  'src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts',
  'scripts/checks/verify-online-cloudflare-websocket-recovery.ts',
]);

function readText(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function sha256(path: string): string {
  return createHash('sha256').update(readText(path)).digest('hex');
}

function normalized(path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function sourceFiles(root: string): readonly string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') paths.push(...sourceFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      paths.push(path);
    }
  }
  return paths.sort();
}

function moduleSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map(
    (match) => match[2] ?? '',
  );
}

for (const path of requiredFiles) {
  assert.equal(existsSync(resolve(repositoryRoot, path)), true, `missing required file: ${path}`);
}
for (const [path, expected] of Object.entries(frozenHashes)) {
  assert.equal(sha256(path), expected, `frozen authority drift: ${path}`);
}

const config = JSON.parse(readText('wrangler.jsonc')) as unknown;
assert.deepEqual(config, {
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

const packageBefore = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})) as { dependencies?: unknown; devDependencies?: unknown };
const packageAfter = JSON.parse(readText('package.json')) as {
  dependencies?: unknown;
  devDependencies?: unknown;
  scripts?: Record<string, unknown>;
};
assert.deepEqual(packageAfter.dependencies, packageBefore.dependencies);
assert.deepEqual(packageAfter.devDependencies, packageBefore.devDependencies);
assert.equal(
  packageAfter.scripts?.['verify:online-cloudflare-websocket-recovery'],
  'tsx scripts/checks/verify-online-cloudflare-websocket-recovery.ts',
);

const checks = readText('scripts/checks/machine-checks.mjs');
const prior = "args: ['run', 'verify:online-cloudflare-runtime-persistence']";
const current = "args: ['run', 'verify:online-cloudflare-websocket-recovery']";
const lint = "{ name: 'lint', cmd: 'npm', args: ['run', 'lint'] }";
assert.equal(checks.split(current).length - 1, 1);
assert.equal(checks.indexOf(prior) < checks.indexOf(current), true);
assert.equal(checks.indexOf(current) < checks.indexOf(lint), true);

const production = sourceFiles(resolve(repositoryRoot, 'src/online/cloudflare'));
assert.deepEqual(production.map(normalized), [
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
]);

const allowedImports = new Set([
  '../protocol/index',
  '../projection/index',
  '../room/index',
  '../room/validationSupport',
  '../lobby/index',
  '../deckSubmission/index',
  '../genesis/index',
  '../../engine/core/index',
]);
for (const path of production) {
  const source = readFileSync(path, 'utf8');
  if (normalized(path) === 'src/online/cloudflare/facts.ts') {
    assert.match(source, /console\.log\(JSON\.stringify\(fact\)\)/);
  } else {
    assert.doesNotMatch(source, /react|react-dom|zustand|indexeddb|localstorage|console\.|node:/i, normalized(path));
  }
  for (const specifier of moduleSpecifiers(source)) {
    const local = specifier.startsWith('./') && !specifier.includes('..');
    assert.equal(local || allowedImports.has(specifier), true, `${normalized(path)} -> ${specifier}`);
  }
}

const types = readText('src/online/cloudflare/types.ts');
const runtime = readText('src/online/cloudflare/runtime.ts');
const websocket = readText('src/online/cloudflare/websocket.ts');
const persistence = readText('src/online/cloudflare/persistence.ts');
const outbox = readText('src/online/cloudflare/outbox.ts');
const barrel = readText('src/online/cloudflare/index.ts');

assert.match(types, /ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1\s*=\s*1/);
assert.match(types, /ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1\s*=\s*16_384/);
assert.match(types, /readonly acceptWebSocket:/);
assert.match(types, /readonly getWebSockets:/);
assert.doesNotMatch(types, /acceptWebSocket\?:|getWebSockets\?:/);

assert.match(runtime, /this\.state\.acceptWebSocket\(pair\.server\)/);
assert.match(runtime, /webSocketMessage\s*\(/);
assert.match(runtime, /webSocketClose\s*\(/);
assert.match(runtime, /webSocketError\s*\(/);
const errorHandler = runtime.match(/webSocketError\(socket: OnlineCloudflareWebSocket\): void \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
assert.match(errorHandler, /emitWebSocketFactV1\('error'/);
assert.doesNotMatch(errorHandler, /handleDisconnect|persistSameRevision|repository\.|security\.|socket\.close/);
assert.doesNotMatch(runtime, /\.accept\s*\(|addEventListener\s*\(|onmessage|onclose|onerror/);
assert.doesNotMatch(`${runtime}\n${websocket}`, /setTimeout|setInterval|alarm\s*\(/);
assert.match(websocket, /Object\.getOwnPropertyNames/);
assert.match(websocket, /Object\.getOwnPropertySymbols/);
assert.match(websocket, /Object\.getOwnPropertyDescriptor/);
assert.doesNotMatch(websocket, /participantCapability|observerCapability|seatCapability|receiptDigest|coreRoot/);

assert.match(persistence, /persistSameRevision\s*\(/);
assert.match(
  persistence,
  /UPDATE online_room_state SET room_lifecycle = \?, state_json = \? WHERE singleton = 1 AND room_id = \? AND revision = \? AND state_json = \? RETURNING singleton/,
);
assert.match(persistence, /comparablePresenceState\(previousJson\) !== comparablePresenceState\(nextJson\)/);
assert.doesNotMatch(persistence, /commitPresence\s*\(|persistPresence\s*\(|commitPresenceSameRevision\s*\(/);
assert.doesNotMatch(persistence, /ALTER TABLE|DROP TABLE|PRAGMA|setTimeout|setInterval/i);

assert.doesNotMatch(barrel, /export\s+\*/);
for (const name of [
  'createOnlineCloudflareOutboxV1',
  'enqueueOnlineCloudflareOutboxV1',
  'replayOnlineCloudflareOutboxV1',
  'settleOnlineCloudflareOutboxV1',
]) assert.match(barrel, new RegExp(`\\b${name}\\b`));
assert.doesNotMatch(barrel, /appendOnline|acknowledgeOnline|frameKind|frameStringField|parseOnlineCloudflareWebSocketFrame|serializeOnlineCloudflareWebSocketValue/);
assert.match(outbox, /response:\s*unknown/);
assert.match(outbox, /Object\.getOwnPropertyNames/);
assert.match(outbox, /Object\.getOwnPropertySymbols/);
assert.match(outbox, /Object\.getOwnPropertyDescriptor/);
assert.doesNotMatch(outbox, /localStorage|indexedDB|fetch\s*\(|setTimeout|setInterval/);

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
  for (const path of sourceFiles(resolve(repositoryRoot, root))) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /online\/cloudflare|\.\.\/cloudflare/);
  }
}

console.log(
  'milestone=O4P-03B schema=1 transport=hibernation attachment=closed-16384 ' +
  'reauth=true snapshot=projected outbox=immutable persistence=same-revision-cas ' +
  'recreation=intact-storage dependencies=unchanged frozen=true',
);
