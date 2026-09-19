#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { collectChangedFiles } from './change-detector.mjs';
import { buildVerificationPlan } from './semantic-verification.mjs';
import { DEFAULT_ROOT } from './validation-domain-resolver.mjs';

const INDEX_PATH = 'docs/project-state/index.json';
const GENERATED_PATH = 'docs/generated/project-state.md';
const PRODUCT_PATH = 'docs/product-requirements.md';
const AUTHORITY_ROOTS = ['docs/contracts', 'docs/acceptance', PRODUCT_PATH];
const CLASSIFICATIONS = new Set(['PRESERVATION_CANDIDATE', 'REVIEW_REQUIRED', 'UNKNOWN']);

function git(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  }).trim();
}

function resolveCommit(cwd, ref) {
  try {
    return git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  } catch {
    throw new Error(`invalid git ref: ${ref}`);
  }
}

function isAncestor(cwd, base, head) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', base, head], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function assertAncestor(cwd, base, head, label) {
  if (!isAncestor(cwd, base, head)) {
    throw new Error(`${label}: ${base} is not an ancestor of ${head}`);
  }
}

function refIfPresent(cwd, ref) {
  try {
    return resolveCommit(cwd, ref);
  } catch {
    return null;
  }
}

function assertCleanWorktree(cwd) {
  const status = git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status !== '') {
    throw new Error('candidate reconciliation requires a clean working tree and frozen candidate commits');
  }
}

function readAtRef(cwd, ref, path) {
  try {
    return git(cwd, ['show', `${ref}:${path}`]);
  } catch {
    throw new Error(`cannot read ${path} at ${ref}`);
  }
}

function readJsonAtRef(cwd, ref, path) {
  const text = readAtRef(cwd, ref, path);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}@${ref}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

function isWithin(path, root) {
  if (root.endsWith('/')) return path.startsWith(root);
  return path === root || path.startsWith(`${root}/`);
}

export function isWatchedPath(path, watchedRoots) {
  return watchedRoots.some((root) => isWithin(path, root));
}

function isAuthorityPath(path) {
  return AUTHORITY_ROOTS.some((root) => isWithin(path, root));
}

function projectStateControlPaths(index) {
  return new Set([
    INDEX_PATH,
    GENERATED_PATH,
    ...(index.capabilities ?? []).map((entry) => entry.path),
  ]);
}

function capabilityRefs(item, key) {
  return Array.isArray(item?.[key])
    ? item[key].map((ref) => ref?.path).filter((path) => typeof path === 'string' && path !== '')
    : [];
}

function classification(capability, value, reasons) {
  if (!CLASSIFICATIONS.has(value)) throw new Error(`invalid reconciliation classification: ${value}`);
  return {
    capabilityId: capability.id,
    title: capability.title,
    classification: value,
    reasons: [...new Set(reasons)].sort(),
  };
}

export function classifyCapabilities({
  capabilities,
  changedFiles,
  watchedRoots,
  verificationPlan,
  projectStateChanged = false,
  baselineFresh = true,
  mainFresh = true,
} = {}) {
  const watchedChanges = changedFiles.filter((path) => isWatchedPath(path, watchedRoots));
  const reconciliationRequired = watchedChanges.length > 0;
  if (!baselineFresh || !mainFresh || projectStateChanged) {
    const reasons = [];
    if (!baselineFresh) reasons.push('base-project-state-baseline-is-stale');
    if (!mainFresh) reasons.push('candidate-does-not-contain-current-main');
    if (projectStateChanged) reasons.push('candidate-modifies-project-state-control-plane-before-reconciliation');
    return {
      reconciliationRequired,
      outcome: 'UNKNOWN',
      watchedChanges,
      authorityChanges: watchedChanges.filter(isAuthorityPath),
      implementationChanges: watchedChanges.filter((path) => path.startsWith('src/')),
      unclaimedImplementationFiles: [],
      classifications: capabilities.map((item) => classification(item, 'UNKNOWN', reasons)),
    };
  }
  if (!reconciliationRequired) {
    return {
      reconciliationRequired: false,
      outcome: 'NOT_REQUIRED',
      watchedChanges,
      authorityChanges: [],
      implementationChanges: [],
      unclaimedImplementationFiles: [],
      classifications: [],
    };
  }

  const authorityChanges = watchedChanges.filter(isAuthorityPath);
  const implementationChanges = watchedChanges.filter((path) => path.startsWith('src/'));
  const unknownCoverage = verificationPlan?.coverage === 'UNKNOWN_COVERAGE'
    || (verificationPlan?.blockers?.unknownCoverage?.length ?? 0) > 0;

  const implementationOwners = new Map();
  for (const item of capabilities) {
    for (const path of capabilityRefs(item, 'implementationRefs')) {
      if (!implementationOwners.has(path)) implementationOwners.set(path, []);
      implementationOwners.get(path).push(item.id);
    }
  }
  const unclaimedImplementationFiles = implementationChanges.filter((path) => !implementationOwners.has(path));
  const requiredTests = new Set(verificationPlan?.requiredTests ?? []);

  let outcome = 'OWNER_REVIEW_REQUIRED';
  let classifications;

  if (unknownCoverage) {
    outcome = 'UNKNOWN';
    classifications = capabilities.map((item) => classification(item, 'UNKNOWN', ['m3-unknown-coverage']));
  } else if (authorityChanges.length > 0) {
    classifications = capabilities.map((item) => classification(
      item,
      'REVIEW_REQUIRED',
      authorityChanges.map((path) => `authority-surface-changed:${path}`),
    ));
  } else {
    classifications = capabilities.map((item) => {
      const reasons = [];
      const directImplementation = capabilityRefs(item, 'implementationRefs')
        .filter((path) => implementationChanges.includes(path));
      const selectedEvidence = capabilityRefs(item, 'verificationRefs')
        .filter((path) => requiredTests.has(path));

      for (const path of directImplementation) reasons.push(`direct-implementation-ref:${path}`);
      for (const path of selectedEvidence) reasons.push(`selected-capability-evidence:${path}`);

      if (reasons.length > 0) return classification(item, 'REVIEW_REQUIRED', reasons);
      return classification(item, 'PRESERVATION_CANDIDATE', [
        'no-direct-capability-ref-intersection',
        'm3-coverage-known',
      ]);
    });
  }

  return {
    reconciliationRequired,
    outcome,
    watchedChanges,
    authorityChanges,
    implementationChanges,
    unclaimedImplementationFiles,
    classifications,
  };
}

function baselineFreshness({ cwd, index, base }) {
  const audited = resolveCommit(cwd, index.baseline.commit);
  assertAncestor(cwd, audited, base, 'project-state baseline');
  const changed = collectChangedFiles({ cwd, base: audited, head: base }).files
    .filter((path) => isWatchedPath(path, index.baseline.watchedRoots ?? []));
  return {
    fresh: changed.length === 0,
    auditedAt: audited,
    invalidatingChanges: changed,
  };
}

function readCapabilities(cwd, ref, index) {
  return (index.capabilities ?? []).map((entry) => readJsonAtRef(cwd, ref, entry.path));
}

function mainFreshness({ cwd, index, head }) {
  const branch = index.baseline?.branch;
  if (typeof branch !== 'string' || branch === '') {
    return { status: 'NOT_CHECKED', ref: null, sha: null };
  }
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) {
    const sha = refIfPresent(cwd, ref);
    if (!sha) continue;
    return {
      status: isAncestor(cwd, sha, head) ? 'CURRENT' : 'STALE',
      ref,
      sha,
    };
  }
  return { status: 'NOT_CHECKED', ref: null, sha: null };
}

export function buildCandidateReconciliation({
  cwd = DEFAULT_ROOT,
  base,
  head,
} = {}) {
  if (!base || !head) throw new Error('project-state reconciliation requires explicit --base and --head');
  assertCleanWorktree(cwd);

  const baseSha = resolveCommit(cwd, base);
  const headSha = resolveCommit(cwd, head);
  assertAncestor(cwd, baseSha, headSha, 'candidate');

  const baseIndex = readJsonAtRef(cwd, baseSha, INDEX_PATH);
  const baseCapabilities = readCapabilities(cwd, baseSha, baseIndex);
  const changes = collectChangedFiles({ cwd, base: baseSha, head: headSha });
  const exactFiles = changes.files;

  const freshness = baselineFreshness({ cwd, index: baseIndex, base: baseSha });
  const currentMain = mainFreshness({ cwd, index: baseIndex, head: headSha });
  const controlPaths = projectStateControlPaths(baseIndex);
  const controlPlaneChanges = exactFiles.filter((path) => controlPaths.has(path));

  let verificationPlan = {
    coverage: 'VERIFIED_WITHIN_DECLARED_COVERAGE',
    semanticImpact: {},
    scenarioImpact: {},
    requiredTests: [],
    blockers: {
      manualRequired: [],
      deferredScenarios: [],
      deferredSemantics: [],
      unbound: [],
      characterizationOnly: [],
      unknownCoverage: [],
    },
  };
  if (exactFiles.some((path) => isWatchedPath(path, baseIndex.baseline.watchedRoots ?? []))) {
    verificationPlan = buildVerificationPlan({ cwd, base: baseSha, head: headSha });
  }

  const classified = classifyCapabilities({
    capabilities: baseCapabilities,
    changedFiles: exactFiles,
    watchedRoots: baseIndex.baseline.watchedRoots ?? [],
    verificationPlan,
    projectStateChanged: controlPlaneChanges.length > 0,
    baselineFresh: freshness.fresh,
    mainFresh: currentMain.status !== 'STALE',
  });

  const impactedSemantics = Object.keys(verificationPlan.semanticImpact ?? {}).sort();
  const impactedScenarios = Object.keys(verificationPlan.scenarioImpact ?? {}).sort();
  const summary = Object.fromEntries(
    ['PRESERVATION_CANDIDATE', 'REVIEW_REQUIRED', 'UNKNOWN']
      .map((key) => [key, classified.classifications.filter((item) => item.classification === key).length]),
  );

  return {
    schemaVersion: 1,
    base: baseSha,
    head: headSha,
    projectStateBaseline: freshness.auditedAt,
    baselineFreshAtBase: freshness.fresh,
    baselineInvalidatingChangesBeforeCandidate: freshness.invalidatingChanges,
    currentMain,
    reconciliationRequired: classified.reconciliationRequired,
    outcome: classified.outcome,
    watchedChanges: classified.watchedChanges,
    authorityChanges: classified.authorityChanges,
    implementationChanges: classified.implementationChanges,
    projectStateControlChanges: controlPlaneChanges,
    unclaimedImplementationFiles: classified.unclaimedImplementationFiles,
    m3: {
      coverage: verificationPlan.coverage,
      impactedSemantics,
      impactedScenarios,
      semanticImpact: verificationPlan.semanticImpact ?? {},
      scenarioImpact: verificationPlan.scenarioImpact ?? {},
      requiredTests: verificationPlan.requiredTests ?? [],
      blockers: verificationPlan.blockers ?? {},
    },
    summary,
    classifications: classified.classifications,
    invariants: {
      semanticVerdict: 'NOT_COMPUTED',
      projectStateMutation: 'NOT_PERFORMED',
      preservationCandidateMeaning: 'Owner-review candidate only; existing M1 refs are not a proof of non-impact.',
      rebaselineRule: 'Advance baseline/auditedAtCommit only after M1 owner reviews every classification and resolves REVIEW_REQUIRED/UNKNOWN.',
    },
  };
}

function parseArgs(argv) {
  const options = { base: null, head: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') options.base = argv[++index] ?? null;
    else if (arg === '--head') options.head = argv[++index] ?? null;
    else if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.base || !options.head) {
    throw new Error('Usage: node scripts/checks/project-state-reconciliation.mjs --base <sha> --head <sha> [--json]');
  }
  return options;
}

function printHuman(result) {
  console.log(`project-state reconciliation: ${result.outcome}`);
  console.log(`base: ${result.base}`);
  console.log(`head: ${result.head}`);
  console.log(`project-state baseline: ${result.projectStateBaseline}`);
  console.log(`current main relation: ${result.currentMain.status}${result.currentMain.sha ? ` (${result.currentMain.sha})` : ''}`);
  if (result.outcome === 'NOT_REQUIRED') {
    console.log('watched roots unchanged; M1 rebaseline is not required');
    return;
  }
  console.log(`M3 coverage: ${result.m3.coverage}`);
  console.log(`classifications: preserve-candidate=${result.summary.PRESERVATION_CANDIDATE}, review=${result.summary.REVIEW_REQUIRED}, unknown=${result.summary.UNKNOWN}`);
  if (result.unclaimedImplementationFiles.length > 0) {
    console.log(`unclaimed implementation paths (advisory; not auto-preserved): ${result.unclaimedImplementationFiles.join(', ')}`);
  }
  for (const item of result.classifications) {
    console.log(`- ${item.capabilityId}: ${item.classification} [${item.reasons.join(', ')}]`);
  }
  console.log('semantic verdict: NOT_COMPUTED');
  console.log('project-state mutation: NOT_PERFORMED');
}

function cli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    const result = buildCandidateReconciliation({
      base: options.base,
      head: options.head,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printHuman(result);
    process.exitCode = result.outcome === 'UNKNOWN' ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) cli();
