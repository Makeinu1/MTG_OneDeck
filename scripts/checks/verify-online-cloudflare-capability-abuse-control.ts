#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = 'a6f4c539a977e38a6891c31fb99acf4fddfee428';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md':
    'aa336af38875a572b33b1376a8d00134463dcf061c003e64b625afc8ff9e7654',
  'research/cr-grounding/o4p-03c-acceptance-brief.draft.md':
    'd09d442e136fe0bb68d67e47a8a8810db001c9eb0dc76cc25c086da9a6a4b556',
  'research/cr-grounding/o4p-03c-implementation-brief.draft.md':
    '72d5181bf01afdfea156ace0dda573cdca0c22a720db65528f1248d6a17f876c',
  'research/cr-grounding/o4p-03c-correction-1.draft.md':
    'ff8fcd94072ab019acbb79480813f1b6bdee9bb443a7deb52e0871e5ac843a4a',
  'research/cr-grounding/o4p-03c-cold-audit-brief.draft.md':
    '04863d58c413b925cb7c6341e125d99d7bfb07ae578949dcaaa2b1f3583249cf',
  'research/cr-grounding/o4p-03c-correction-2.draft.md':
    '1f6c25c462f4ba0fbd52f5668d835b40c402c1348956ac4901c8814da0564925',
  'research/cr-grounding/o4p-03c-correction-3-judge-surgery.draft.md':
    '6c03276eaffb9ddc2dda1988a83596a37021cd2e68517f5698b0337e7230d594',
  'src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts':
    'c0264db4e4f771c47401338905d6689838a0bbebc31c052c46d68a8eeca3a10d',
  'src/online/cloudflare/__tests__/reviewSqliteStorage.ts':
    '40a8a37f7348ed8bc553df3db9823b8b31ef190a36beb90604d3766b7c466d16',
  'src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts':
    'ff8761e7eb46a81cb855b87891f9b48219aef425e1c3eafe1d51ce1e14698f94',
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
  'src/online/cloudflare/scryfallResolver.ts',
  'src/online/cloudflare/security.ts',
  'src/online/cloudflare/websocket.ts',
  'src/online/cloudflare/outbox.ts',
  'src/online/cloudflare/worker.ts',
  'src/online/cloudflare/__tests__/securityV1.test.ts',
  'src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts',
  'src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts',
  'scripts/checks/verify-online-cloudflare-capability-abuse-control.ts',
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
  packageAfter.scripts?.['verify:online-cloudflare-capability-abuse-control'],
  'tsx scripts/checks/verify-online-cloudflare-capability-abuse-control.ts',
);

const checks = readText('scripts/checks/machine-checks.mjs');
const prior = "args: ['run', 'verify:online-cloudflare-websocket-recovery']";
const current = "args: ['run', 'verify:online-cloudflare-capability-abuse-control']";
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
const security = readText('src/online/cloudflare/security.ts');
const support = readText('src/online/cloudflare/support.ts');
const websocket = readText('src/online/cloudflare/websocket.ts');
const barrel = readText('src/online/cloudflare/index.ts');

assert.match(types, /readonly now\?: \(\) => number/);
assert.match(support, /pieces\[1\] === 'capabilities'/);
assert.match(runtime, /route\.action === 'capabilities'/);
assert.match(runtime, /consumeHttpAction/);
assert.match(runtime, /authorizeSocket/);
assert.match(runtime, /acquireControllerLease/);
assert.match(runtime, /releaseControllerLease/);
const errorHandler = runtime.match(/webSocketError\(socket: OnlineCloudflareWebSocket\): void \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
assert.match(errorHandler, /emitWebSocketFactV1\('error'/);
assert.doesNotMatch(errorHandler, /handleDisconnect|persistSameRevision|repository\.|security\.|socket\.close/);
assert.doesNotMatch(runtime, /setTimeout|setInterval|alarm\s*\(|addEventListener\s*\(|onmessage|onclose|onerror/);

for (const [name, value] of [
  ['ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1', '1'],
  ['ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1', '43_200_000'],
  ['ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1', '30_000'],
  ['ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1', '16'],
  ['ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1', '10_000'],
  ['ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1', '32'],
  ['ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1', '60_000'],
  ['ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1', '8'],
  ['ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1', '10_000'],
  ['ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1', '32'],
  ['ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1', '60_000'],
  ['ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1', '4'],
  ['ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1', '65_536'],
  ['ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1', '256'],
  ['ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1', '256'],
] as const) assert.match(security, new RegExp(`${name}\\s*=\\s*${value}`));
assert.match(websocket, /ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1/);
assert.match(security, /CREATE TABLE(?: IF NOT EXISTS)? online_security_state/);
assert.match(security, /CREATE TABLE(?: IF NOT EXISTS)? online_capability_grant/);
assert.match(security, /CREATE TABLE(?: IF NOT EXISTS)? online_controller_lease/);
assert.match(security, /CREATE TABLE(?: IF NOT EXISTS)? online_security_audit/);
assert.match(security, /DELETE FROM online_controller_lease[\s\S]*RETURNING/);
assert.match(security, /grant_count INTEGER NOT NULL/);
assert.match(security, /retired_tokens_json TEXT NOT NULL/);
assert.match(security, /transactionSync\s*\(/);
assert.doesNotMatch(`${security}\n${runtime}\n${websocket}`, /console\.|setTimeout|setInterval|ALTER TABLE|DROP TABLE|PRAGMA/i);

assert.doesNotMatch(barrel, /export\s+\*/);
for (const forbidden of [
  'OnlineCloudflareCapabilityGrantRow',
  'resolveProtocolCapability',
  'appendAudit',
  'parseOnlineCloudflareWebSocketFrameV1',
]) assert.doesNotMatch(barrel, new RegExp(`\\b${forbidden}\\b`));

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
  'milestone=O4P-03C security-schema=1 classified=true expiry=exclusive rotation=closed ' +
  'lease=single-controller abuse=bounded audit=append-only-secret-free sql=atomic ' +
  'dependencies=unchanged config=successor-reowned frozen=true',
);
