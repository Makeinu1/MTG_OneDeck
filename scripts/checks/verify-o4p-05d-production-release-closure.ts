#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = 'e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c';
const closureSha = '69559e13716e9d0767d8189714d8c14fb630db46';
const reviewPath = 'src/test/architecture/review.o4p-05d-production-release-closure.test.ts';
const predecessorReviewPaths = [
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
] as const;
const productionRecordPath = 'research/cr-grounding/archive/o4p-05d-cold-audit-record-2026-08-15.md';
const secretMaterial = /\b[0-9a-f]{32}\b|gh[opsu]_[A-Za-z0-9]{20,}|Bearer[ \t]+[A-Za-z0-9._~-]{8,}|(?:capability|token|secret|authorization|account(?:Id|_id| identifier))[ \t]*[:=][ \t]*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const rawJsonLine = /^\s*\{.*\}\s*$/m;

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md': 'ab947a0d768428340aea706ea7f161c721b8cea25a22bde94142402eb20c8075',
  'research/cr-grounding/o4p-05d-acceptance-brief.draft.md': '6e814dabcb4916b3436e86764692297c17d16d56351515d196351e686df7fbe6',
  'research/cr-grounding/o4p-05d-implementation-brief.draft.md': '3863314d13e5cd7f0107ae6c663879cb295983d5baedf79928831476eca4e021',
  'research/cr-grounding/o4p-05d-cold-audit-brief.draft.md': 'db17316e7539727ed36f8e4e9a8f675754dfdfec81175603f9f4effe797a468a',
  'research/cr-grounding/o4p-05d-judge-surgery-1.draft.md': '788d4e100dd96086fc00bde4d4a7bb3788cf8cb4a743e8fb724c0b7ea251bb2b',
  'research/cr-grounding/o4p-05d-judge-surgery-2.draft.md': 'a8c1880d5d7c1fb639a8d78462c907990ef3c0ae85dcc54561a889b71ffca3fd',
  'research/cr-grounding/o4p-05d-full-check-repair-1.draft.md': 'b29cf3736be0a7c6259ec58883183be5687e3ad2aa1a64f83fca2d1fa01f9029',
  [reviewPath]: '315a828e12a7c8dd0c1da4e702142bbd8681c1cef3be7bb6b979f8f5c9fdfc6d',
  'package-lock.json': '37506c0d414b82b91fb9f95662d7aeb9f390138e0a6905a813f401bea0b54832',
  'wrangler.jsonc': 'c5584e703673895c3f69fc5e7b4658ecbff80145f6f8a35ee795d81d2517f9c7',
  '.github/workflows/deploy-pages.yml': '415fe28517b11b869a44b4f770051532b9e1b051aca6a310d27fd6716d8aff84',
  'scripts/checks/verify-o4p-05c-release-gates.ts': '18d36b04988503163b5b3dfaccb9ee92adfc63949ca2ce29fe05638aa21305bf',
});

function readText(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function sha256(path: string): string {
  return createHash('sha256').update(readText(path)).digest('hex');
}

for (const [path, expected] of Object.entries(frozenHashes)) {
  assert.equal(existsSync(resolve(repositoryRoot, path)), true, `missing frozen authority: ${path}`);
  assert.equal(sha256(path), expected, `frozen authority drift: ${path}`);
}

const packageBefore = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})) as Record<string, unknown>;
const packageAfter = JSON.parse(readText('package.json')) as {
  dependencies?: unknown;
  devDependencies?: unknown;
  version?: unknown;
  scripts?: Record<string, unknown>;
};
assert.deepEqual(packageAfter.dependencies, packageBefore.dependencies);
assert.deepEqual(packageAfter.devDependencies, packageBefore.devDependencies);
assert.equal(packageAfter.version, packageBefore.version);
assert.equal(
  packageAfter.scripts?.['verify:o4p-05d-production-release-closure'],
  'tsx scripts/checks/verify-o4p-05d-production-release-closure.ts',
);

const trackedProtectedDrift = execFileSync('git', ['diff', '--name-only', baseSha, closureSha, '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean);
const untrackedProtectedDrift = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(trackedProtectedDrift.sort(), [...predecessorReviewPaths, reviewPath].sort());
assert.deepEqual(untrackedProtectedDrift, []);

const machineChecks = readText('scripts/checks/machine-checks.mjs');
const predecessor = "args: ['run', 'verify:o4p-05c-release-gates']";
const current = "args: ['run', 'verify:o4p-05d-production-release-closure']";
const lint = "{ name: 'lint', cmd: 'npm', args: ['run', 'lint'] }";
assert.equal(machineChecks.split(current).length - 1, 1);
assert.equal(machineChecks.indexOf(predecessor) < machineChecks.indexOf(current), true);
assert.equal(machineChecks.indexOf(current) < machineChecks.indexOf(lint), true);

const ledger = JSON.parse(readText('research/cr-grounding/cr-backbone-ledger.json')) as {
  domains: Array<{ id: string; status: string; dependsOn?: string[] }>;
  plannedSequence: Array<{ domainId: string; status: string; dependsOn?: string[] }>;
  goalPolicy?: { activeProgram?: { id?: string; domainIds?: string[] } };
};
const ids = ['O4P-05A', 'O4P-05B', 'O4P-05C', 'O4P-05D'];
const activeProgram = ledger.goalPolicy?.activeProgram;
if (activeProgram?.id === 'O4P-05') {
  assert.deepEqual(activeProgram, { id: 'O4P-05', domainIds: ids });
} else {
  assert.deepEqual(activeProgram, {
    id: 'O4P-06',
    domainIds: ['O4P-06A', 'O4P-06B', 'O4P-06C', 'O4P-06D', 'O4P-06E', 'O4P-06F'],
  });
}
for (const [index, id] of ids.entries()) {
  const domains = ledger.domains.filter((entry) => entry.id === id);
  const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
  assert.equal(domains.length, 1, `${id} domain count`);
  assert.equal(planned.length, 1, `${id} planned count`);
  assert.equal(domains[0]?.status, planned[0]?.status, `${id} status mismatch`);
  if (index < 3) assert.equal(domains[0]?.status, 'shipped', `${id} predecessor status`);
  else {
    assert.equal(['pending', 'shipped'].includes(domains[0]?.status ?? ''), true, `${id} terminal status`);
    if (domains[0]?.status === 'shipped') {
      assert.equal(existsSync(resolve(repositoryRoot, productionRecordPath)), true, 'missing production closure record');
      const record = readText(productionRecordPath);
      assert.match(record, /Production-closure audit: BLOCKER 0 \/ HIGH 0/);
      assert.match(record, /Cloudflare active version/);
      assert.match(record, /fresh init-load/);
      assert.doesNotMatch(record, secretMaterial);
      assert.doesNotMatch(record, rawJsonLine);
    }
  }
  if (index > 0) assert.deepEqual(domains[0]?.dependsOn, [ids[index - 1]], `${id} dependency`);
}

const workflow = readText('.github/workflows/deploy-pages.yml');
assert.match(workflow, /npm run check -- --build-base=\/MTG_OneDeck\//);
assert.match(workflow, /npm run check:forbidden -- --diff/);
assert.match(workflow, /actions\/upload-pages-artifact@v5/);
assert.match(workflow, /actions\/deploy-pages@v5/);
assert.doesNotMatch(workflow, /wrangler|cloudflare|CLOUDFLARE_/i);

const contract = readText('research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md');
for (const claim of [
  'O4P-05C', 'npm run check', 'wrangler@4.123.0 deploy', 'revision 96',
  'accepted-command count 96', 'STOP-before-promotion', 'bounded Cloudflare rollback',
  '24-hour wall-clock soak remain outside', 'expected first CI forbidden',
  'reauthorization draft',
]) assert.match(contract, new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const path of [...predecessorReviewPaths, reviewPath]) {
  assert.match(contract, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

console.log(
  'milestone=O4P-05D predecessors=O4P-05A+B+C protected-drift=none ' +
  'cloudflare-deploy=operator-only pages=exact-head-ci release-order=frozen',
);
