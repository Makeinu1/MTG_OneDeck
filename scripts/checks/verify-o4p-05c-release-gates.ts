#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = '7dc41384bf6763986a47151d69f78f31021976fe';
const closureSha = 'e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-05c-release-gates.contract.draft.md': '2d33c9eddd8eefe12d314ec2ca6ed9b6bef19a5df75147d94292d91bb356cba1',
  'research/cr-grounding/o4p-05c-acceptance-brief.draft.md': 'a94c287f949eac659337587c95fd5a96dc38432954f38b72c118843644e824fc',
  'research/cr-grounding/o4p-05c-implementation-brief.draft.md': 'e046e7c15ec636b47a12fa95541c4004d9ee5bdfeef023e8fcc3ebe550224c76',
  'research/cr-grounding/o4p-05c-judge-surgery-1.draft.md': '061c464c752b679913cee34150962be94c8c404fc8a558e1fe8854c7fe12f5ab',
  'research/cr-grounding/o4p-05c-cold-audit-brief.draft.md': '8d7d6d4d435d3f209d852b46227ee28f48efd9d4c74d2f4e59c2758d9606247c',
  'research/cr-grounding/o4p-05c-full-check-repair-1.draft.md': '5249800f33b34fc564762c6d6d07aab84e9dd085cfecaeb0689365e7f3768c0a',
  'research/cr-grounding/archive/o4p-05c-cold-audit-record-2026-08-15.md': '2b8ea47b14b08dfeb7fb3fc1ab5116f22519c4c8a9c7ad0162644f718ab783f5',
  'src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts': 'ffa54e7cbd66c6c07364ab752681a525cf2aceb930e72d15320830fe3729b655',
  'src/online/cloudflare/__tests__/releaseGateEvidenceV1.test.ts': '653e442ca434d2205bc51183f897aa343fc01293845cadab25d615c1f3af7b11',
  'src/online/cloudflare/__tests__/review.o4p-05c-release-gates.test.ts': 'c5ece001c839b33c795100dceb01190bfc1c9cfa43b08561c0eb9c7a44f645f8',
  'src/test/architecture/review.o4p-05c-release-gates.test.ts': '4c3035e29163c58a72260beb087b7705d4e93c22e74f99c7fdbed221492c86db',
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts': '52b1f7255734ef7d6ced86396a8f93e2ef9d3f3fc9d6cd9f67ca880059ea6e1e',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts': '77ab16c255b5eff0cc72e018bfb8b1a35b477e4a1a0c001801d4e1b145c0df5c',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts': 'c3fd6abf5cd2011552c1980ebb3a0e1e8db3ea220107ede01293ff575793069c',
  'research/cr-grounding/archive/o4p-03c-cold-audit-record-2026-08-14.md': 'dc09fbe3da2ae99ea748b10f276e1007626f935f613fd6a00d60f26160e947d6',
  'research/cr-grounding/archive/o4p-03d-cold-audit-record-2026-08-14.md': 'de93a0d37fab264fdb6b07c499dd365908fd229ee57fae971a08dc9cc57ca145',
  'scripts/checks/verify-online-cloudflare-runtime-persistence.ts': '14b9e9142cdeb286c34d7ef7cef97bc2e75dcb6d781ec1419754db14dfdf2bc7',
  'scripts/checks/verify-online-cloudflare-websocket-recovery.ts': 'cee8f721142a5eb217b5356d89d2cd0eb8a937892dd63dba448fd0c95c29e8d2',
  'scripts/checks/verify-online-cloudflare-capability-abuse-control.ts': '7b31bb7fff75d38cfd6d32ecddaeafbb6badce7158dcafd773b93b674fe6336a',
  'scripts/checks/verify-online-cloudflare-production-gate.ts': 'b53f1409579b5086f6f93d526d62ee4ce9912eea31ad971d1ca18a137dd47fff',
  'scripts/online/o4p-03d-evidence.ts': '68bdb2175690f1e3f77d71d377ced29386e3a40df08b121d38d1d054472d0041',
  'wrangler.jsonc': 'c5584e703673895c3f69fc5e7b4658ecbff80145f6f8a35ee795d81d2517f9c7',
  'src/online/cloudflare/codec.ts': 'cbe7b6656ffa9133e630837ff285222548ce460a71135b8048551115668b0cee',
  'src/online/cloudflare/facts.ts': 'f3cd284585f1029ccf60803284fc70cc84acb497fe7ead553ab7d32e30d6a108',
  'src/online/cloudflare/index.ts': '2670b1aa454a98905e567fee534c65ca99742cf614187f282a346c08f1caa96a',
  'src/online/cloudflare/outbox.ts': '606e0b1194e8a1c948bce7777fcd79f47fd23d598ff5aa57d191ec6d348e2c93',
  'src/online/cloudflare/persistence.ts': '62f194e00551ac16c591925bf971d830196e2205fe9620593a2b172d9442d609',
  'src/online/cloudflare/runtime.ts': '8bb52555cd281b5a6066378f3ad26a76659bd4520011d7bd00a7c82de344bc21',
  'src/online/cloudflare/scryfallResolver.ts': '8f63102bded5b9f1c667c8f04eaa7551b4130a930435d7276e625d1fb15f6ee4',
  'src/online/cloudflare/security.ts': '3e94348604cd4c0a1a09b5e0337caa35ffeecebe24e783fce9ac711154679d15',
  'src/online/cloudflare/support.ts': '71e761f69c78dfec522d25e01fee6e3a484f3ed982953864a86c654ff327b5c0',
  'src/online/cloudflare/types.ts': '3191ab1213a46e9a0e293015a607dcaeba920134d5a989350a7d2f9eb4a66171',
  'src/online/cloudflare/websocket.ts': 'e2d44763b929b8800b6e76e6c638a5d05c14cf0f9361968a416ae63b4b964fb1',
  'src/online/cloudflare/worker.ts': '49f453008fa19e0699d294323973ac3f84c781cef4623db933a10cf6fabf1877',
  'src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts': 'c0264db4e4f771c47401338905d6689838a0bbebc31c052c46d68a8eeca3a10d',
  'src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts': '4c8043575d9d2652d1bf46fd94df73b5a1d24c10c3afa285c204e79f01c01b62',
  'src/online/cloudflare/__tests__/evidenceHarnessV1.test.ts': 'd7204213cc4f39a2003ef1b9da510a918f3ceaa0be24b33a8c4b626e5109d078',
});

function readText(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function sha256(path: string): string {
  return createHash('sha256').update(readText(path)).digest('hex');
}

function normalized(path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'test') paths.push(...productionFiles(path));
    } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      paths.push(path);
    }
  }
  return paths;
}

for (const [path, expected] of Object.entries(frozenHashes)) {
  assert.equal(existsSync(resolve(repositoryRoot, path)), true, `missing frozen authority: ${path}`);
  assert.equal(sha256(path), expected, `frozen authority drift: ${path}`);
}

const packageBefore = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], { cwd: repositoryRoot, encoding: 'utf8' })) as {
  dependencies?: unknown;
  devDependencies?: unknown;
};
const packageAfter = JSON.parse(readText('package.json')) as {
  dependencies?: unknown;
  devDependencies?: unknown;
  scripts?: Record<string, unknown>;
};
assert.deepEqual(packageAfter.dependencies, packageBefore.dependencies);
assert.deepEqual(packageAfter.devDependencies, packageBefore.devDependencies);
assert.equal(packageAfter.scripts?.['verify:o4p-05c-release-gates'], 'tsx scripts/checks/verify-o4p-05c-release-gates.ts');

const machineChecks = readText('scripts/checks/machine-checks.mjs');
const predecessor = "args: ['run', 'verify:online-cloudflare-production-gate']";
const current = "args: ['run', 'verify:o4p-05c-release-gates']";
const lint = "{ name: 'lint', cmd: 'npm', args: ['run', 'lint'] }";
assert.equal(machineChecks.split(current).length - 1, 1);
assert.equal(machineChecks.indexOf(predecessor) < machineChecks.indexOf(current), true);
assert.equal(machineChecks.indexOf(current) < machineChecks.indexOf(lint), true);

const helper = readText('src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts');
for (const required of [
  'o4p-05c-release-gate-evidence-v1',
  'mtg-cr-2026-06-19',
  'privacy', 'recovery', 'load', 'security', 'observability', 'information-leakage', 'long-room',
  'Object.getOwnPropertyDescriptors', 'Reflect.ownKeys', 'SPARSE_ARRAY', 'ALIAS_OR_CYCLE', 'DUPLICATE_GATE',
  'Object.freeze',
]) assert.match(helper, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(helper, /fetch\s*\(|WebSocket|process\.env|Math\.random|Date\.|setTimeout|console\.|\.sort\s*\(|\.trim\s*\(/);

for (const path of productionFiles(resolve(repositoryRoot, 'src'))) {
  assert.doesNotMatch(readFileSync(path, 'utf8'), /releaseGateEvidenceV1/, normalized(path));
}
assert.doesNotMatch(readText('src/online/cloudflare/index.ts'), /releaseGate/i);

const protectedDrift = execFileSync('git', [
  'diff', '--name-only', baseSha, closureSha, '--', 'rule', 'wrangler.jsonc', 'src/engine', 'src/versioning',
  'src/online/architecture', 'src/online/room', 'src/online/protocol', 'src/online/projection', 'src/online/headless',
  'src/online/cloudflare/codec.ts', 'src/online/cloudflare/facts.ts', 'src/online/cloudflare/index.ts',
  'src/online/cloudflare/outbox.ts', 'src/online/cloudflare/persistence.ts', 'src/online/cloudflare/runtime.ts',
  'src/online/cloudflare/security.ts', 'src/online/cloudflare/support.ts', 'src/online/cloudflare/types.ts',
  'src/online/cloudflare/websocket.ts', 'src/online/cloudflare/worker.ts',
], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
assert.equal(protectedDrift, '');

const securityAudit = readText('research/cr-grounding/archive/o4p-03c-cold-audit-record-2026-08-14.md');
assert.match(securityAudit, /BLOCKER 0 \/ HIGH 0 \/ MEDIUM 0 \/ LOW 0/);
assert.match(securityAudit, /host\/seat\/table\/spectator/);
assert.match(securityAudit, /secret-free properties and values/);
const productionAudit = readText('research/cr-grounding/archive/o4p-03d-cold-audit-record-2026-08-14.md');
for (const evidence of [/revision 96/, /checkpoint revision 64/, /replay suffix 32/, /70-second idle/, /hibernation observed/, /HTTP 200/]) {
  assert.match(productionAudit, evidence);
}
assert.match(readText('research/cr-grounding/o4p-05c-release-gates.contract.draft.md'), /O4P-05D owns the final Cloudflare\/Pages production release closure/);

console.log(
  'milestone=O4P-05C gates=privacy+recovery+load+security+observability+information-leakage+long-room ' +
  'ruleset=mtg-cr-2026-06-19 predecessors=O4P-03C+O4P-03D production-drift=none test-only=true frozen=true',
);
