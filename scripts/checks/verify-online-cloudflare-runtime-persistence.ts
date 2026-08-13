#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = '95b34868966de671c97f0aa824422ccb0c14e051';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-03a-cloudflare-runtime-persistence.contract.draft.md':
    '777b4ad439bf95e6eedebec20ac9afe1895d9a5933826c1757e197f3fee5d8d3',
  'research/cr-grounding/o4p-03a-acceptance-brief.draft.md':
    '13669554c78ecfb6fdfcb2cd3bf676e20fca5b2ed92f07a031bca3456ff38842',
  'research/cr-grounding/o4p-03a-implementation-brief.draft.md':
    '1bc86dd3213649821961fd42d42961b795314ebaba8134896d1bee37814b5dfe',
  'research/cr-grounding/o4p-03a-cold-audit-brief.draft.md':
    'd308ecb25249dffcb61e7aef16a725fa02174c6f12edc4982b72173148c1b954',
  'src/online/cloudflare/__tests__/review.o4p-03a-cloudflare-runtime-persistence.test.ts':
    'a1193c12fd97daeefed8034cc437de9a9144f0a927ee8658a800866eea8f2596',
  'src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts':
    '6bca65f845f083bc659b6ed0a48b39bc3272c76e0e3d0d7473d1ebbf1d7f1000',
  'src/online/cloudflare/index.ts':
    '81c59a0c3d7785771d0b3a6e29f0d1022bcfbf3d8a4b1145d7ccbae287981c1f',
  'wrangler.jsonc':
    '54ea73105a31940c6c3d90ac02ce04ce428a732613b04cec671d96be5ce4953e',
});

const requiredFiles = Object.freeze([
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
  'scripts/checks/verify-online-cloudflare-runtime-persistence.ts',
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
  main: 'src/online/cloudflare/worker.ts',
  compatibility_date: '2026-08-13',
  durable_objects: {
    bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }],
  },
  exports: {
    OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' },
  },
});

const packageBefore = JSON.parse(
  execFileSync('git', ['show', `${baseSha}:package.json`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }),
) as { dependencies?: unknown; devDependencies?: unknown };
const packageAfter = JSON.parse(readText('package.json')) as {
  dependencies?: unknown;
  devDependencies?: unknown;
  scripts?: Record<string, unknown>;
};
assert.deepEqual(packageAfter.dependencies, packageBefore.dependencies);
assert.deepEqual(packageAfter.devDependencies, packageBefore.devDependencies);
assert.equal(
  packageAfter.scripts?.['verify:online-cloudflare-runtime-persistence'],
  'tsx scripts/checks/verify-online-cloudflare-runtime-persistence.ts',
);

const machineChecks = readText('scripts/checks/machine-checks.mjs');
const localGate = "args: ['run', 'verify:online-local-room-gate']";
const cloudflareGate = "args: ['run', 'verify:online-cloudflare-runtime-persistence']";
const lintGate = "{ name: 'lint', cmd: 'npm', args: ['run', 'lint'] }";
assert.equal(machineChecks.split(cloudflareGate).length - 1, 1);
assert.equal(machineChecks.indexOf(localGate) < machineChecks.indexOf(cloudflareGate), true);
assert.equal(machineChecks.indexOf(cloudflareGate) < machineChecks.indexOf(lintGate), true);

const cloudflareRoot = resolve(repositoryRoot, 'src/online/cloudflare');
const production = sourceFiles(cloudflareRoot);
assert.deepEqual(
  production.map(normalized),
  [
    'src/online/cloudflare/codec.ts',
    'src/online/cloudflare/index.ts',
    'src/online/cloudflare/persistence.ts',
    'src/online/cloudflare/runtime.ts',
    'src/online/cloudflare/support.ts',
    'src/online/cloudflare/types.ts',
    'src/online/cloudflare/worker.ts',
  ],
);

const allowedImports = new Set([
  '../protocol/index',
  '../room/index',
  '../../engine/core/index',
]);
const forbiddenSource =
  /(?:react|react-dom|zustand|indexeddb|localstorage|console\.|node:|acceptWebSocket|webSocketMessage|serializeAttachment|deserializeAttachment|addEventListener\s*\(\s*['"]message)/i;
for (const path of production) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, forbiddenSource, normalized(path));
  for (const specifier of moduleSpecifiers(source)) {
    const local = specifier.startsWith('./') && !specifier.includes('..');
    assert.equal(local || allowedImports.has(specifier), true, `${normalized(path)} -> ${specifier}`);
  }
}

const persistence = readText('src/online/cloudflare/persistence.ts');
assert.match(persistence, /storage\.sql\.exec/);
assert.doesNotMatch(persistence, /storage\.exec\s*\(/);
assert.match(persistence, /transactionSync\s*\(/);
assert.match(persistence, /singleton INTEGER PRIMARY KEY CHECK \(singleton = 1\)/);
assert.match(
  persistence,
  /UPDATE online_room_state[\s\S]*WHERE singleton = 1 AND room_id = \? AND revision = \?/,
);
assert.doesNotMatch(
  persistence.match(/CREATE TABLE IF NOT EXISTS online_accepted_command[^`]+/)?.[0] ?? '',
  /capability|envelope|response|error|stack/i,
);

const worker = readText('src/online/cloudflare/worker.ts');
assert.match(worker, /ONLINE_ROOMS\.getByName\(route\.roomId\)\.fetch\(request\)/);
assert.match(worker, /new URL\(request\.url\)\.pathname/);

const barrel = readText('src/online/cloudflare/index.ts');
assert.doesNotMatch(barrel, /export\s+\*/);
assert.doesNotMatch(barrel, /StoredCommand|participantCapability|commandJson/);
for (const expected of [
  'ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1',
  'ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1',
  'OnlineCloudflareRepository',
  'OnlineRoomDurableObject',
  'onlineCloudflareWorker',
]) {
  assert.match(barrel, new RegExp(`\\b${expected}\\b`));
}

for (const root of [
  'src/engine',
  'src/online/room',
  'src/online/protocol',
  'src/online/projection',
  'src/online/headless',
  'src/store',
]) {
  for (const path of sourceFiles(resolve(repositoryRoot, root))) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /online\/cloudflare|online-cloudflare/);
  }
}

console.log(
  'milestone=O4P-03A schema=1 worker=getByName durable-object=sqlite ' +
    'persistence=singleton+journal+transaction+cas websocket=entry-only ' +
    'capability-journal=false dependencies=unchanged frozen=true',
);
