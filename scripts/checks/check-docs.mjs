#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = join(root, 'docs/contracts/manifest.json');
const scenarioPath = join(root, 'docs/acceptance/scenarios.json');
const migrationPath = join(root, 'research/archive/document-reset-2026-08/migration-map.json');
const errors = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${relative(root, path)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function requireFile(path, label) {
  if (!existsSync(path)) errors.push(`${label}: missing ${relative(root, path)}`);
}

function localLinks(path) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/\[[^]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    const target = raw.split(/[?#]/, 1)[0];
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(resolve(dirname(path), target))) errors.push(`${relative(root, path)}: broken link ${target}`);
  }
}

function walk(directory) {
  const files = [];
  if (!existsSync(directory)) return files;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function checkManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object') return;
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const byId = new Map();
  const authorities = new Map();
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      errors.push('manifest: every contract entry must be an object');
      continue;
    }
    for (const key of ['id', 'status', 'path', 'authorityFor', 'owner', 'dependsOn', 'supersedes', 'verifiedBy', 'lastVerifiedCommit']) {
      if (!(key in entry)) errors.push(`manifest ${entry.id ?? '<unknown>'}: missing ${key}`);
    }
    if (typeof entry.id === 'string') {
      if (byId.has(entry.id)) errors.push(`manifest: duplicate contract id ${entry.id}`);
      byId.set(entry.id, entry);
    }
    requireFile(join(root, entry.path ?? ''), `manifest ${entry.id ?? '<unknown>'}`);
    if (entry.status === 'active') {
      const authoritiesForEntry = Array.isArray(entry.authorityFor) ? entry.authorityFor : [entry.authorityFor];
      for (const authority of authoritiesForEntry) {
        if (typeof authority !== 'string') continue;
        const prior = authorities.get(authority);
        if (prior !== undefined) errors.push(`manifest: authority ${authority} owned by both ${prior} and ${entry.id}`);
        else authorities.set(authority, entry.id);
      }
      const path = join(root, entry.path ?? '');
      if (extname(path) === '.md' && existsSync(path)) {
        const content = readFileSync(path, 'utf8');
        const forbidden = [
          /\brevision\b/i, /\bhistorical\b/i, /\bshipped\b/i, /\bsuperseded\b/i,
          /\bpartial\b/i, /\bpass\b/i, /\bdraft\b/i, /\baudit\b/i,
          /LLM\s+(?:session|id)/i, /現行性メモ/, /削除済み/, /作業予定/, /再オーナー化/,
        ];
        for (const pattern of forbidden) if (pattern.test(content)) errors.push(`${entry.path}: volatile lifecycle vocabulary ${pattern}`);
      }
    }
    for (const ref of [...(entry.dependsOn ?? []), ...(entry.supersedes ?? [])]) {
      if (typeof ref === 'string' && !byId.has(ref) && !ref.startsWith('legacy:')) errors.push(`manifest ${entry.id}: unresolved reference ${ref}`);
    }
    for (const verifier of entry.verifiedBy ?? []) requireFile(join(root, verifier), `manifest ${entry.id} verifiedBy`);
    if (typeof entry.lastVerifiedCommit !== 'string' || !/^[0-9a-f]{40}$/.test(entry.lastVerifiedCommit)) errors.push(`manifest ${entry.id}: invalid lastVerifiedCommit`);
  }
  if (Array.isArray(manifest.activeAllowlist)) {
    for (const allowance of manifest.activeAllowlist) {
      if (!allowance.path || !allowance.reason || !Array.isArray(allowance.patterns)) errors.push('manifest activeAllowlist: every entry needs path, patterns, and reason');
    }
  }
}

function checkScenarios(scenarios, migration, contractIds) {
  const seen = new Set();
  const legacyIds = new Set((migration?.legacyIds ?? []).map((entry) => entry.id));
  if (!Array.isArray(scenarios)) {
    errors.push('scenarios: expected an array');
    return;
  }
  for (const scenario of scenarios) {
    for (const key of ['id', 'status', 'risk', 'tags', 'preconditions', 'steps', 'oracle', 'automatedBy', 'manualOnly', 'supersedes', 'contractRefs']) {
      if (!(key in scenario)) errors.push(`scenario ${scenario.id ?? '<unknown>'}: missing ${key}`);
    }
    if (typeof scenario.id !== 'string') continue;
    if (seen.has(scenario.id)) errors.push(`scenario: duplicate id ${scenario.id}`);
    seen.add(scenario.id);
    for (const ref of scenario.contractRefs ?? []) if (!contractIds.has(ref)) errors.push(`scenario ${scenario.id}: unresolved contractRefs ${ref}`);
    for (const path of scenario.automatedBy ?? []) requireFile(join(root, path), `scenario ${scenario.id} automatedBy`);
    for (const ref of scenario.supersedes ?? []) {
      if (typeof ref === 'string' && !legacyIds.has(ref) && !seen.has(ref)) errors.push(`scenario ${scenario.id}: unresolved supersedes ${ref}`);
    }
  }
}

function checkMigrationMap(migration) {
  if (migration === null || typeof migration !== 'object' || !Array.isArray(migration.sources)) return;
  const allowed = new Set(['active automated scenario', 'active manual scenario', 'periodic/online scenario', 'superseded', 'historical release evidence', 'status ledger material', 'unresolved conflict']);
  const counts = new Map();
  for (const entry of migration.sources) {
    const key = `${entry.source}\n${entry.heading}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!allowed.has(entry.classification)) errors.push(`migration map ${key}: invalid classification ${entry.classification}`);
    requireFile(join(root, entry.destination ?? ''), `migration map ${key}`);
  }
  for (const source of ['research/archive/document-reset-2026-08/original-acceptance.md', 'research/archive/document-reset-2026-08/original-engine-spec.md']) {
    const path = join(root, source);
    if (!existsSync(path)) continue;
    for (const heading of readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => /^#{1,6}\s/.test(line.trim())).map((line) => line.trim())) {
      const count = counts.get(`${source}\n${heading}`) ?? 0;
      if (count !== 1) errors.push(`migration map: ${source} ${heading} has ${count} destinations`);
    }
  }
}

function run() {
  requireFile(manifestPath, 'manifest');
  requireFile(scenarioPath, 'scenario registry');
  requireFile(migrationPath, 'migration map');
  const manifest = readJson(manifestPath);
  const migration = readJson(migrationPath);
  const scenarios = readJson(scenarioPath);
  checkManifest(manifest);
  checkScenarios(scenarios?.scenarios, migration, new Set((manifest?.contracts ?? []).map((entry) => entry.id)));
  checkMigrationMap(migration);
  for (const path of [
    join(root, 'README.md'), join(root, 'docs/README.md'), join(root, 'docs/acceptance.md'), join(root, 'docs/engine-spec.md'),
    ...((manifest?.contracts ?? []).map((entry) => join(root, entry.path)).filter((path) => extname(path) === '.md')),
  ]) if (existsSync(path)) localLinks(path);
  const generated = execFileSync(process.execPath, [join(root, 'scripts/checks/generate-engine-api.mjs'), '--check'], { encoding: 'utf8' });
  if (generated.trim()) console.log(generated.trim());
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else console.log(`PASS: docs contracts, scenarios, migration map, links, and generated API`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) run();
