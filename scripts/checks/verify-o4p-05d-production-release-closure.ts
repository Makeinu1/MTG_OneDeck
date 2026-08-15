#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseSha = 'e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c';
const reviewPath = 'src/test/architecture/review.o4p-05d-production-release-closure.test.ts';
const productionRecordPath = 'research/cr-grounding/archive/o4p-05d-cold-audit-record-2026-08-15.md';

const frozenHashes = Object.freeze({
  'research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md': '2b6ec74e576a63068f17916ef1a8ad5f45e3d18ed2788d65523f4880261de777',
  'research/cr-grounding/o4p-05d-acceptance-brief.draft.md': '8c679760b55fa271413d47468c449833294a7052b40d1101cf7b418c7e923e1d',
  'research/cr-grounding/o4p-05d-implementation-brief.draft.md': '3863314d13e5cd7f0107ae6c663879cb295983d5baedf79928831476eca4e021',
  'research/cr-grounding/o4p-05d-cold-audit-brief.draft.md': '2300b1b99f54b0471cc686e45226ba7874d5754a87fdf1945cb6c0538e9da89c',
  'research/cr-grounding/o4p-05d-judge-surgery-1.draft.md': '788d4e100dd96086fc00bde4d4a7bb3788cf8cb4a743e8fb724c0b7ea251bb2b',
  [reviewPath]: '60541f48b4235bf8be2edbb8705e07154b413dcf8a735a01884032c3ab9e95b6',
  'package-lock.json': '37506c0d414b82b91fb9f95662d7aeb9f390138e0a6905a813f401bea0b54832',
  'wrangler.jsonc': 'c5584e703673895c3f69fc5e7b4658ecbff80145f6f8a35ee795d81d2517f9c7',
  '.github/workflows/deploy-pages.yml': '415fe28517b11b869a44b4f770051532b9e1b051aca6a310d27fd6716d8aff84',
  'scripts/checks/verify-o4p-05c-release-gates.ts': 'e19cc3c0dae983033b7ea143f08b68e98d70d21bd89c06849b5c62755f9a5fdf',
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

const trackedProtectedDrift = execFileSync('git', ['diff', '--name-only', baseSha, '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean);
const untrackedProtectedDrift = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean);
const protectedDrift = [...new Set([...trackedProtectedDrift, ...untrackedProtectedDrift])].sort();
assert.deepEqual(protectedDrift, [reviewPath]);

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
assert.deepEqual(ledger.goalPolicy?.activeProgram, { id: 'O4P-05', domainIds: ids });
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
  '24-hour wall-clock soak remain outside',
]) assert.match(contract, new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log(
  'milestone=O4P-05D predecessors=O4P-05A+B+C protected-drift=none ' +
  'cloudflare-deploy=operator-only pages=exact-head-ci release-order=frozen',
);
