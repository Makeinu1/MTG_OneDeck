#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = '9ab8449aa7b7a4ab729f5d9acb752417c686e07b';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-03d-cloudflare-headless-production-gate.contract.draft.md':
    '8e725d537b3d9dfde2ffb76d94bed4386bb5b098d8efb179655b04d5bf4e940a',
  'research/cr-grounding/o4p-03d-acceptance-brief.draft.md':
    'eef955f66c0d38a17bbd77ba2f5cbea3ecef110893381d9ffc6670b95f81eb59',
  'research/cr-grounding/o4p-03d-implementation-brief.draft.md':
    '62bee91afbbf9dc860234b93d6d58732e41838ce0de59845307abafec416f759',
  'research/cr-grounding/o4p-03d-cold-audit-brief.draft.md':
    '0584abc06005fe877350c7a0d3b25a908bcf71ca48b88934174fb974a0ae9b94',
  'research/cr-grounding/o4p-03d-correction-1-judge-surgery.draft.md':
    '073960e898ca3478e18eecbb8bd56da00441a1eba27e015e1b795765bd7578f0',
  'research/cr-grounding/o4p-03d-production-evidence-repair-1.draft.md':
    '3ace5dbd1089412ef61a5009da51a96eded5a99501bef0fb02f83e93f212b13b',
  'src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts':
    '3771acdf221e50f3609cbacec70b52993bdadfa9f961c017fa53f7ea7f8ef0a1',
  'src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts':
    'f6cff119febd28eee2ea7a742eae4f22fd5731f2dec4f9d25be071223a0c7804',
  'wrangler.jsonc':
    'c5584e703673895c3f69fc5e7b4658ecbff80145f6f8a35ee795d81d2517f9c7',
});

const requiredFiles = Object.freeze([
  ...Object.keys(frozenHashes),
  'scripts/checks/verify-online-cloudflare-production-gate.ts',
  'scripts/online/o4p-03d-evidence.ts',
  'scripts/online/tsconfig.json',
  'src/online/cloudflare/facts.ts',
  'src/online/cloudflare/__tests__/evidenceHarnessV1.test.ts',
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

assert.deepEqual(JSON.parse(readText('wrangler.jsonc')), {
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
  packageAfter.scripts?.['verify:online-cloudflare-production-gate'],
  'tsx scripts/checks/verify-online-cloudflare-production-gate.ts',
);

const checks = readText('scripts/checks/machine-checks.mjs');
const prior = "args: ['run', 'verify:online-cloudflare-capability-abuse-control']";
const current = "args: ['run', 'verify:online-cloudflare-production-gate']";
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
  '../lobby/index',
  '../../engine/core/index',
]);
for (const path of production) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /react|react-dom|zustand|indexeddb|localstorage|node:|setTimeout|setInterval|setAlarm|addEventListener\s*\(|\.accept\s*\(/i, normalized(path));
  if (normalized(path) === 'src/online/cloudflare/facts.ts') {
    assert.match(source, /console\.log\(JSON\.stringify\(fact\)\)/);
  } else {
    assert.doesNotMatch(source, /console\./, normalized(path));
  }
  for (const specifier of moduleSpecifiers(source)) {
    const local = specifier.startsWith('./') && !specifier.includes('..');
    assert.equal(local || allowedImports.has(specifier), true, `${normalized(path)} -> ${specifier}`);
  }
}

const persistence = readText('src/online/cloudflare/persistence.ts');
assert.match(persistence, /ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1\s*=|ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V1/);
assert.match(persistence, /online_application_migration/);
assert.match(persistence, /online_recovery_checkpoint/);
assert.match(persistence, /transactionSync\s*\(/);
assert.match(persistence, /replayCount > 63/);
assert.match(persistence, /state\.revision % 64 === 0/);
assert.match(persistence, /UPDATE online_recovery_checkpoint[\s\S]*RETURNING singleton/);
assert.match(persistence, /const replayReady = validateOnlineProtocolStateV1/);
assert.match(persistence, /candidate\.participantId === entry\.participant_id[\s\S]*presence: 'connected' as const/);
assert.match(persistence, /handleOnlineCommandEnvelopeV1\(replayReady\.value/);
assert.match(persistence, /isCanonicalVersionIdentifier/);
assert.match(persistence, /migrationSchemaPresence\(\)/);
assert.match(persistence, /securityTables\.length !== 0 && securityTables\.length !== 4/);
assert.match(persistence, /else this\.validateCheckpoint\(state\)/);

const facts = readText('src/online/cloudflare/facts.ts');
for (const value of [
  'worker-request',
  'durable-object-runtime-start',
  'recovery-verification',
  'websocket-lifecycle',
  'migration-failure',
  'request-failure',
  'recovery-failure',
]) assert.match(facts, new RegExp(`['"]${value}['"]`));
assert.match(facts, /isCanonicalVersionIdentifier/);
assert.doesNotMatch(facts, /request\.url|headers|participantCapability|currentToken|exception|stack/);

const runtime = readText('src/online/cloudflare/runtime.ts');
for (const event of ['accepted', 'authenticated', 'hibernation-message', 'close', 'error', 'reconnect']) {
  assert.match(runtime, new RegExp(`emitWebSocketFactV1\\('${event}'`));
}
const errorHandler = runtime.match(/webSocketError\(socket: OnlineCloudflareWebSocket\): void \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
assert.doesNotMatch(errorHandler, /handleDisconnect|persistSameRevision|repository\.|security\.|socket\.close/);

const harness = readText('scripts/online/o4p-03d-evidence.ts');
assert.match(harness, /randomBytes/);
assert.match(harness, /online-cloudflare-room-initialize-v1/);
assert.match(harness, /online-client-hello-v1/);
assert.match(harness, /online-projection-request-v1/);
assert.match(harness, /online-command-envelope-v1/);
assert.match(harness, /commandIndex < 96/);
assert.match(harness, /70_000/);
assert.match(harness, /ready-for-deploy/);
assert.match(harness, /validatePlatformEvidence/);
assert.match(harness, /candidate\.checkpointRevision !== 64/);
assert.match(harness, /candidate\.replaySuffixLength !== 32/);
assert.match(harness, /preDeployRuntimeStartCount/);
assert.match(harness, /projection\.participantId !== PARTICIPANTS\[index\]/);
assert.match(harness, /audience\.corePlayerId !== CORE_PLAYERS\[index\]/);
assert.match(harness, /assertSafe\(JSON\.stringify\(message\)/);
assert.match(harness, /let fatal: Error \| null = null/);
assert.match(harness, /function capabilityFragments/);
assert.match(harness, /capability\.slice\(start, start \+ 8\)/);
assert.match(harness, /for \(const inbox of allInboxes\) inbox\.assertHealthy\(\)/);
assert.match(harness, /withTimeout\(deps\.fetch/);
assert.match(harness, /wrangler-tail-recovery-fact/);
assert.doesNotMatch(harness, /wrangler\s+(?:deploy|rollback)|git\s|gh\s|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);

for (const root of [
  'src/engine',
  'src/online/room',
  'src/online/protocol',
  'src/online/projection',
  'src/online/headless',
  'src/store',
]) {
  for (const path of sourceFiles(resolve(repositoryRoot, root))) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /online\/cloudflare|\.\.\/cloudflare/);
  }
}

console.log(
  'milestone=O4P-03D worker=workers.dev durable-object=sqlite migration=application-v1 ' +
    'checkpoint=64 replay-max=63 facts=allowlisted evidence=four-seat+96+idle+deploy-barrier ' +
    'dependencies=unchanged frozen=true',
);
