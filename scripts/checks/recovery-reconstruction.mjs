#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { candidateFingerprint } from './fingerprint.mjs';
import { validateRepositoryHygiene } from './check-repository-hygiene.mjs';
import {
  readWorkOrder,
  validateWorkOrderAtPlanningBase,
  validateWorkOrderCandidate,
} from './work-order.mjs';

export const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const PROJECT_STATE = 'docs/project-state/index.json';
const PRODUCTION_MAP = 'docs/project-state/production-map.json';

const FORBIDDEN_RECEIPT_KEYS = new Set([
  'activeMilestone',
  'currentMilestone',
  'nextGate',
  'semanticVerdict',
  'verificationPass',
  'verificationStatus',
  'freshness',
  'compatibilityOwnership',
  'writeAuthority',
  'externalWriteAuthority',
  'deployAuthority',
  'rollbackAuthority',
]);

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function tryGit(root, args) {
  try { return git(root, args); } catch { return null; }
}

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function blobSha(root, ref, path) {
  return git(root, ['rev-parse', '--verify', ref + ':' + path]);
}

function currentHead(root) {
  return git(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
}

function currentBranch(root) {
  return tryGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
}

function resolveMain(root) {
  return tryGit(root, ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'])
    ?? tryGit(root, ['rev-parse', '--verify', 'refs/heads/main^{commit}'])
    ?? currentHead(root);
}

function isAncestor(root, ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function changedUnder(root, base, head, paths) {
  if (!paths?.length) return [];
  const output = git(root, ['diff', '--name-only', base + '..' + head, '--', ...paths]);
  return output.split(/\r?\n/u).filter(Boolean);
}

export function canonicalFreshness({ root = DEFAULT_ROOT, head = currentHead(root) } = {}) {
  const index = readJson(root, PROJECT_STATE);
  const production = readJson(root, PRODUCTION_MAP);
  const errors = [];

  const baseline = index.baseline?.commit;
  if (!baseline || !isAncestor(root, baseline, head)) {
    errors.push('Project State baseline is not an ancestor of HEAD');
  } else {
    const changed = changedUnder(root, baseline, head, index.baseline?.watchedRoots ?? []);
    if (changed.length) errors.push('Project State watched roots changed: ' + changed.join(', '));
  }

  const observed = production.observedAtCommit;
  if (!observed || !isAncestor(root, observed, head)) {
    errors.push('production-map observed commit is not an ancestor of HEAD');
  } else {
    const changed = changedUnder(root, observed, head, production.freshness?.watchedPaths ?? []);
    if (changed.length) errors.push('production-map watched paths changed: ' + changed.join(', '));
  }

  return { ok: errors.length === 0, errors };
}

function generatedPairs(root, head) {
  const pairs = [
    ['docs/generated/project-state.md', 'scripts/checks/generate-project-state.mjs'],
    ['docs/generated/engine-api.md', 'scripts/checks/generate-engine-api.mjs'],
    ['research/archive/document-reset-2026-08/legacy-contract-inventory.json', 'scripts/checks/generate-legacy-inventory.mjs'],
    ['research/archive/document-reset-2026-08/migration-map.json', 'scripts/checks/generate-migration-map.mjs'],
  ];
  return pairs.map(([path, generatorPath]) => ({
    path,
    blobSha: blobSha(root, head, path),
    generatorPath,
    generatorBlobSha: blobSha(root, head, generatorPath),
  }));
}

export function buildRecoveryReceipt({
  root = DEFAULT_ROOT,
  workOrderPath = null,
  evidenceRefs = [],
  pr = null,
  unresolvedRefs = [],
} = {}) {
  const head = currentHead(root);
  const main = resolveMain(root);
  const mergeBase = git(root, ['merge-base', main, head]);
  const branch = currentBranch(root);
  const projectState = readJson(root, PROJECT_STATE);
  const workOrder = workOrderPath
    ? {
        ref: workOrderPath,
        sha256: sha256(readFileSync(resolve(root, workOrderPath))),
      }
    : null;

  return {
    schemaVersion: 1,
    repository: projectState.baseline?.repository ?? 'unknown',
    observedMain: main,
    projectState: { path: PROJECT_STATE, blobSha: blobSha(root, head, PROJECT_STATE) },
    productionMap: { path: PRODUCTION_MAP, blobSha: blobSha(root, head, PRODUCTION_MAP) },
    workOrder,
    candidate: {
      branch,
      head,
      mergeBase,
      diffFingerprint: candidateFingerprint({ cwd: root, base: mergeBase, head }),
    },
    verification: { base: mergeBase, head, evidenceRefs: [...evidenceRefs] },
    review: { pr, unresolvedRefs: [...unresolvedRefs] },
    generated: generatedPairs(root, head),
  };
}

function collectForbiddenKeys(value, path = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, path + '[' + index + ']', findings));
    return findings;
  }
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RECEIPT_KEYS.has(key)) findings.push(path + '.' + key);
    collectForbiddenKeys(child, path + '.' + key, findings);
  }
  return findings;
}

export function validateRecoveryReceipt(receipt, { root = DEFAULT_ROOT } = {}) {
  const errors = [];
  if (receipt?.schemaVersion !== 1) errors.push('receipt schemaVersion must be 1');
  for (const path of collectForbiddenKeys(receipt)) errors.push('receipt stores forbidden truth/authority field ' + path);
  for (const key of ['repository', 'observedMain', 'projectState', 'productionMap', 'candidate', 'verification', 'review', 'generated']) {
    if (!(key in (receipt ?? {}))) errors.push('receipt missing ' + key);
  }

  const sha = /^[0-9a-f]{40}$/u;
  if (!sha.test(receipt?.observedMain ?? '')) errors.push('receipt observedMain must be exact SHA');
  for (const item of [receipt?.projectState, receipt?.productionMap]) {
    if (!item?.path || !sha.test(item?.blobSha ?? '')) errors.push('receipt canonical pointer invalid');
  }
  if (!sha.test(receipt?.candidate?.head ?? '') || !sha.test(receipt?.candidate?.mergeBase ?? '')) errors.push('receipt candidate SHA invalid');
  if (!/^[0-9a-f]{64}$/u.test(receipt?.candidate?.diffFingerprint ?? '')) errors.push('receipt candidate fingerprint invalid');
  if (receipt?.workOrder !== null && receipt?.workOrder !== undefined) {
    if (!receipt.workOrder.ref || !/^[0-9a-f]{64}$/u.test(receipt.workOrder.sha256 ?? '')) errors.push('receipt Work Order pointer invalid');
  }

  if (errors.length === 0) {
    const current = buildRecoveryReceipt({
      root,
      workOrderPath: receipt.workOrder?.ref ?? null,
      evidenceRefs: receipt.verification?.evidenceRefs ?? [],
      pr: receipt.review?.pr ?? null,
      unresolvedRefs: receipt.review?.unresolvedRefs ?? [],
    });
    if (receipt.projectState.blobSha !== current.projectState.blobSha) errors.push('receipt Project State pointer is stale');
    if (receipt.productionMap.blobSha !== current.productionMap.blobSha) errors.push('receipt production-map pointer is stale');
    if (receipt.candidate.head !== current.candidate.head) errors.push('receipt candidate HEAD is stale');
    if (receipt.candidate.diffFingerprint !== current.candidate.diffFingerprint) errors.push('receipt candidate fingerprint is stale');
    if (receipt.workOrder?.sha256 !== current.workOrder?.sha256) errors.push('receipt Work Order hash is stale');
  }

  return errors;
}

export function classifyRecovery({
  canonicalOk,
  hygieneOk,
  receiptOk,
  mainAncestor,
  workOrderProvided,
  planningValid,
  candidateValid,
} = {}) {
  if (!canonicalOk || !hygieneOk || !receiptOk) return 'BLOCKED';
  if (!mainAncestor) return 'RESCUE';
  if (!workOrderProvided || !planningValid || !candidateValid) return 'REPLAN';
  return 'RESUME';
}

export function reconstructRecovery({
  root = DEFAULT_ROOT,
  workOrderPath = null,
  evidenceRefs = [],
  pr = null,
  unresolvedRefs = [],
} = {}) {
  const receipt = buildRecoveryReceipt({ root, workOrderPath, evidenceRefs, pr, unresolvedRefs });
  const freshness = canonicalFreshness({ root });
  const hygiene = validateRepositoryHygiene({ root });
  const receiptErrors = validateRecoveryReceipt(receipt, { root });
  const mainAncestor = isAncestor(root, receipt.observedMain, receipt.candidate.head)
    || receipt.observedMain === receipt.candidate.head;

  let planningErrors = [];
  let candidateErrors = [];
  if (workOrderPath) {
    const workOrder = readWorkOrder(workOrderPath, root);
    planningErrors = validateWorkOrderAtPlanningBase(workOrder, { root });
    candidateErrors = validateWorkOrderCandidate(workOrder, {
      root,
      head: receipt.candidate.head,
    }).errors;
  }

  const disposition = classifyRecovery({
    canonicalOk: freshness.ok,
    hygieneOk: hygiene.ok,
    receiptOk: receiptErrors.length === 0,
    mainAncestor,
    workOrderProvided: Boolean(workOrderPath),
    planningValid: planningErrors.length === 0,
    candidateValid: candidateErrors.length === 0,
  });

  return {
    disposition,
    receipt,
    diagnostics: {
      canonical: freshness.errors,
      hygiene: hygiene.errors,
      receipt: receiptErrors,
      planning: planningErrors,
      candidate: candidateErrors,
    },
  };
}

function parseArgs(args) {
  const options = { workOrderPath: null, receiptOut: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--work-order') options.workOrderPath = args[++i] ?? null;
    else if (args[i] === '--receipt-out') options.receiptOut = args[++i] ?? null;
    else throw new Error('Usage: check:recovery [--work-order <path>] [--receipt-out <path>]');
  }
  return options;
}

function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = reconstructRecovery({ root: DEFAULT_ROOT, workOrderPath: options.workOrderPath });
  if (options.receiptOut) writeFileSync(resolve(DEFAULT_ROOT, options.receiptOut), JSON.stringify(result.receipt, null, 2) + '\n');
  console.log('recovery-reconstruction: ' + result.disposition);
  for (const [group, errors] of Object.entries(result.diagnostics)) {
    for (const error of errors) console.error(group + ': ' + error);
  }
  process.exitCode = result.disposition === 'BLOCKED' ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) cli();
