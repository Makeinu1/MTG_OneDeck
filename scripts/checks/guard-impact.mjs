#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createContextProjection } from '../codex-context.mjs';
import { parseCandidateRecords } from '../lib/supervisor-state.mjs';
import { collectChangedFiles } from './change-detector.mjs';
import { requiredOwner } from './ownership.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (root, args, encoding = 'utf8') => execFileSync('git', args, {
  cwd: root,
  encoding,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const normalized = (path) => path.replaceAll('\\', '/').replace(/^\.\//, '');
const isSupervisorEventPath = (path) =>
  normalized(path).startsWith('research/cr-grounding/supervisor-events/');

function repositoryPaths(root, changedPaths) {
  const tracked = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  return [...new Set([...tracked, ...changedPaths])]
    .map(normalized)
    .filter((path) => !isSupervisorEventPath(path))
    .sort();
}

function baseRepositoryPaths(root, base) {
  return git(root, ['ls-tree', '-r', '--name-only', '-z', base]).split('\0').filter(Boolean)
    .map(normalized)
    .filter((path) => !isSupervisorEventPath(path))
    .sort();
}

function readCandidateText(root, path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size > 2_000_000) return null;
  const value = readFileSync(absolute);
  if (value.includes(0)) return null;
  return value.toString('utf8');
}

function readBaseBytes(root, base, path) {
  try {
    return git(root, ['show', `${base}:${path}`], null);
  } catch {
    return null;
  }
}

function readBaseText(root, base, path) {
  const value = readBaseBytes(root, base, path);
  if (value === null || value.length > 2_000_000 || value.includes(0)) return null;
  return value.toString('utf8');
}

function currentByteIdentity(root, path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return { kind: 'deleted', sha256: null };
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(absolute);
    return { kind: 'symlink', sha256: sha256(target), target };
  }
  return { kind: 'file', sha256: sha256(readFileSync(absolute)) };
}

function baseByteIdentity(root, base, path) {
  const bytes = readBaseBytes(root, base, path);
  return bytes === null ? { kind: 'absent', sha256: null } : { kind: 'present', sha256: sha256(bytes) };
}

function isExecutableGuardPath(path) {
  return /\.(?:[cm]?js|tsx?|jsonc?|ya?ml|toml)$/.test(path) ||
    path === 'package.json' ||
    path === 'eslint.config.js';
}

function importTargets(line, guardPath) {
  const targets = [];
  const matcher = /(?:from\s*|import\s*(?:\(\s*)?|require\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of line.matchAll(matcher)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const base = normalized(posix.normalize(posix.join(posix.dirname(guardPath), specifier)));
    targets.push(base, `${base}.mjs`, `${base}.js`, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
  }
  return targets;
}

function guardReferences(scanEntries, changedPaths, source) {
  const references = [];
  for (const changedPath of changedPaths) {
    for (const { path: guardPath, text } of scanEntries) {
      if (guardPath === changedPath) continue;
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const importsChangedPath = importTargets(line, guardPath).includes(changedPath);
        if (!importsChangedPath && !line.includes(changedPath)) continue;
        const type = importsChangedPath
          ? 'import'
          : /allow(?:list|ed)?|expected(?:Files|Paths)?|protectedPaths|include|exclude|forbidden|ownership/i.test(line)
            ? 'allowlist'
            : 'path-assertion';
        const reference = { source, type, changedPath, guardPath, line: index + 1 };
        references.push({ ...reference, id: sha256(JSON.stringify(reference)) });
      }
    }
  }
  return references.sort((left, right) =>
    left.changedPath.localeCompare(right.changedPath) || left.source.localeCompare(right.source) ||
    left.guardPath.localeCompare(right.guardPath) ||
    left.line - right.line ||
    left.type.localeCompare(right.type),
  );
}

function predecessorHashReferences(root, base, changedPaths, scanEntries, source) {
  const references = [];
  for (const changedPath of changedPaths) {
    const bytes = readBaseBytes(root, base, changedPath);
    if (bytes === null) continue;
    const predecessorSha256 = sha256(bytes);
    for (const { path: guardPath, text } of scanEntries) {
      if (guardPath === changedPath || !text.includes(predecessorSha256)) continue;
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].includes(predecessorSha256)) continue;
        const reference = { source, changedPath, guardPath, line: index + 1, predecessorSha256 };
        references.push({ ...reference, id: sha256(JSON.stringify(reference)) });
      }
    }
  }
  return references.sort((left, right) =>
    left.changedPath.localeCompare(right.changedPath) || left.source.localeCompare(right.source) ||
    left.guardPath.localeCompare(right.guardPath) ||
    left.line - right.line,
  );
}

function hasWildcard(value) {
  if (typeof value === 'string') return /[*?]/.test(value);
  if (Array.isArray(value)) return value.some(hasWildcard);
  if (value && typeof value === 'object') return Object.values(value).some(hasWildcard);
  return false;
}

export function equivalentGuardAcknowledgement(left, report, activeAuthorityPath) {
  if (!left || !report?.acknowledgementRequired || hasWildcard(left)) return false;
  try {
    const normalize = (value, ignoredGuardIds, ignoredPredecessorIds) => {
      const copy = structuredClone(value);
      delete copy.reportFingerprint;
      copy.guardReferenceIds = copy.guardReferenceIds.filter((id) => !ignoredGuardIds.has(id));
      copy.predecessorHashReferenceIds = copy.predecessorHashReferenceIds
        .filter((id) => !ignoredPredecessorIds.has(id));
      return JSON.stringify(copy);
    };
    const ignoredGuardIds = new Set(report.guards
      .filter((entry) => entry.guardPath === activeAuthorityPath)
      .map((entry) => entry.id));
    const ignoredPredecessorIds = new Set(report.predecessorHashes
      .filter((entry) => entry.guardPath === activeAuthorityPath)
      .map((entry) => entry.id));
    return normalize(left, ignoredGuardIds, ignoredPredecessorIds) === normalize(
      report.acknowledgementRequired,
      ignoredGuardIds,
      ignoredPredecessorIds,
    );
  } catch {
    return false;
  }
}

export function buildGuardImpact({ root = process.cwd(), base, domain, projection } = {}) {
  const changes = collectChangedFiles({ cwd: root, base });
  const activeProjection = projection ?? createContextProjection(root, domain);
  const changedPaths = changes.files.filter((path) => !isSupervisorEventPath(path));
  const scanEntries = repositoryPaths(root, changedPaths)
    .map((path) => ({ path, text: readCandidateText(root, path) }))
    .filter((entry) => entry.text !== null);
  const baseScanEntries = baseRepositoryPaths(root, changes.base)
    .map((path) => ({ path, text: readBaseText(root, changes.base, path) }))
    .filter((entry) => entry.text !== null);
  const guards = [
    ...guardReferences(baseScanEntries.filter((entry) => isExecutableGuardPath(entry.path)), changedPaths, 'base'),
    ...guardReferences(scanEntries.filter((entry) => isExecutableGuardPath(entry.path)), changedPaths, 'current'),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const predecessorHashes = [
    ...predecessorHashReferences(root, changes.base, changedPaths, baseScanEntries, 'base'),
    ...predecessorHashReferences(root, changes.base, changedPaths, scanEntries, 'current'),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const changed = changedPaths.map((path) => ({
    path,
    owner: requiredOwner(path),
    base: baseByteIdentity(root, changes.base, path),
    current: currentByteIdentity(root, path),
  }));
  const reauthorizationRequired = changed.map(({ path, owner, base: baseBytes, current }) => ({
    path,
    owner,
    base: baseBytes,
    current,
    guardReferenceIds: guards.filter((guard) => guard.changedPath === path).map((guard) => guard.id),
    predecessorHashReferenceIds: predecessorHashes
      .filter((reference) => reference.changedPath === path)
      .map((reference) => reference.id),
  }));
  const fingerprintInput = {
    version: 1,
    baseSha: changes.base,
    headSha: changes.head,
    domain,
    candidateId: activeProjection.activeCandidate?.id ?? null,
    candidateTreeFingerprint: activeProjection.activeCandidate?.treeFingerprint ?? null,
    changedPaths: changed,
    guards,
    predecessorHashes,
    reauthorizationRequired,
  };
  const reportFingerprint = sha256(JSON.stringify(fingerprintInput));
  const acknowledgementRequired = {
    reportFingerprint,
    candidateId: fingerprintInput.candidateId,
    candidateTreeFingerprint: fingerprintInput.candidateTreeFingerprint,
    paths: reauthorizationRequired.map(({ path, owner, base: baseBytes, current }) => ({ path, owner, base: baseBytes, current })),
    guardReferenceIds: guards.map((guard) => guard.id),
    predecessorHashReferenceIds: predecessorHashes.map((reference) => reference.id),
  };
  let candidate = activeProjection.activeCandidate ?? null;
  if (candidate && !Object.hasOwn(candidate.guardImpact ?? {}, 'acknowledgement')) {
    const loopPath = resolve(root, '.claude/loop-state.md');
    if (existsSync(loopPath)) {
      const parsed = parseCandidateRecords(readFileSync(loopPath, 'utf8'));
      candidate = parsed.records?.find((record) => record?.id === candidate.id) ?? candidate;
    }
  }
  const guardImpact = candidate?.guardImpact ?? null;
  const errors = [];
  if (!guardImpact) {
    errors.push({ code: 'MISSING_GUARD_IMPACT_STATE' });
  } else {
    if (guardImpact.reportFingerprint !== reportFingerprint) {
      errors.push({
        code: 'STALE_GUARD_REPORT_FINGERPRINT',
        expected: reportFingerprint,
        actual: guardImpact.reportFingerprint ?? null,
      });
    }
    if (guardImpact.acknowledgement === null || guardImpact.acknowledgement === undefined) {
      errors.push({ code: 'MISSING_GUARD_ACKNOWLEDGEMENT' });
    } else {
      if (hasWildcard(guardImpact.acknowledgement)) {
        errors.push({ code: 'WILDCARD_GUARD_ACKNOWLEDGEMENT' });
      }
      if (JSON.stringify(guardImpact.acknowledgement) !== JSON.stringify(acknowledgementRequired)) {
        errors.push({ code: 'GUARD_ACKNOWLEDGEMENT_MISMATCH' });
      }
    }
  }
  return {
    ok: errors.length === 0,
    ...fingerprintInput,
    reportFingerprint,
    acknowledgementRequired,
    errors,
  };
}

function parseArguments(argv) {
  const options = {};
  const allowed = new Set(['--base', '--domain']);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || options[key.slice(2)] !== undefined) {
      throw new Error('usage: guard-impact.mjs --base <sha> --domain <id>');
    }
    options[key.slice(2)] = value;
  }
  if (Object.keys(options).length !== 2) {
    throw new Error('usage: guard-impact.mjs --base <sha> --domain <id>');
  }
  return options;
}

export function runGuardImpactCli(argv = process.argv.slice(2), root = process.cwd()) {
  const report = buildGuardImpact({ root, ...parseArguments(argv) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runGuardImpactCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
