#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { computeTreeFingerprint, createContextProjection, parseLoopState } from './codex-context.mjs';
import { collectChangedFiles } from './checks/change-detector.mjs';
import { buildGuardImpact, equivalentGuardAcknowledgement } from './checks/guard-impact.mjs';
import {
  buildSupervisorProjection,
  computeAcceptanceFingerprint,
  evaluateCandidateBudget,
  findActiveSupervisedDomainId,
  parseCandidateRecords,
  replaceLoopField,
  resolveCandidateAuthority,
  resolveSupervisionPolicy,
  validateCandidateRecord,
} from './lib/supervisor-state.mjs';
import {
  createSupervisorBootstrap,
  createSupervisorEvent,
  deriveUsageReceipt,
  readTrackedSupervisorAuthority,
  receiptPlanMatchesAnchor,
  stableJson,
  supervisorAuthorityPath,
  verifySupervisorAuthority,
  verifyUsageReceipt,
} from './lib/supervisor-authority.mjs';

const LOOP_STATE_PATH = '.claude/loop-state.md';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const RELEASE_REPAIR_REASONS = new Set(['release-full-check', 'ci-environment', 'guard-impact']);
const POST_SHIP_REPAIR_REASON = 'ci-environment:terminal-metadata';
const USER_REAUTHORIZE_ACCEPTANCE_KEYS = ['boundary', 'evidence', 'landingState', 'manualBoundary'];
const GUARD_GATED_ACTIONS = new Set([
  'audit', 'start-audit', 'start-audit-wait', 'mark-audited',
  'full-check', 'start-full-check', 'mark-full-check-passed',
  'commit', 'record-commit', 'push', 'record-semantic-push', 'record-replacement-push',
  'start-ci-wait', 'mark-ci-passed', 'deploy', 'record-deploy', 'ship', 'mark-shipped',
  'record-audit-failure', 'start-correction', 'record-audit-stop', 'require-repair', 'derive-repair',
  'repair-resume', 'user-reopen',
]);
const requiredActorRole = (action) => {
  if (['local-write', 'start-implementation', 'start-correction', 'compact-implementer', 'continue-implementer'].includes(action)) return 'implementer';
  if (['audit', 'start-audit', 'start-audit-wait', 'compact-cold-auditor', 'continue-cold-auditor'].includes(action)) return 'cold-auditor';
  return 'supervisor';
};

function failure(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const releaseBindingActions = new Set(['push', 'record-semantic-push', 'record-replacement-push']);

const clone = (value) => structuredClone(value);

export function allowsCumulativeReleaseGuardBase({
  records, candidate, requestedBase, headSha, isAncestor,
}) {
  if (requestedBase === candidate?.baseSha) return true;
  const predecessor = records?.find((entry) => entry.id === candidate?.repairOf);
  const pushed = (entry) => (entry?.counters?.semanticPushes ?? -1) + (entry?.counters?.replacementPushes ?? -1);
  if (
    !predecessor || predecessor.state !== 'repair-required' ||
    predecessor.repairReason !== 'ci-environment' || predecessor.baseSha !== requestedBase ||
    (predecessor.releaseHeadSha ?? null) !== null || pushed(predecessor) !== 0 ||
    !['implementing', 'audit-ready', 'audit-repairable', 'audit-failed-stop', 'audited', 'full-check-passed', 'push-ready', 'ci-passed'].includes(candidate?.state) ||
    predecessor.domainId !== candidate.domainId ||
    predecessor.acceptanceFingerprint !== candidate.acceptanceFingerprint ||
    stableJson(predecessor.authority) !== stableJson(candidate.authority) ||
    predecessor.authoritySource !== candidate.authoritySource ||
    stableJson(predecessor.lineages) !== stableJson(candidate.lineages) ||
    stableJson(predecessor.waitChains?.audit) !== stableJson(candidate.waitChains?.audit) ||
    predecessor.counters?.ciWaitChains !== 0 || predecessor.waitChains?.ci?.length !== 0 ||
    !((candidate.counters?.ciWaitChains === 0 && candidate.waitChains?.ci?.length === 0) ||
      (candidate.counters?.ciWaitChains === 1 && candidate.waitChains?.ci?.length === 1)) ||
    ![0, 1].includes(pushed(candidate)) ||
    !isAncestor(requestedBase, candidate.baseSha) ||
    !isAncestor(candidate.baseSha, headSha)
  ) return false;
  return pushed(candidate) === 0
    ? (candidate.releaseHeadSha ?? null) === null
    : candidate.releaseHeadSha === headSha;
}

export function augmentRepairPredecessor(records, candidate, authority) {
  if (!candidate?.repairOf) return records;
  const matches = (authority?.events ?? []).map((event) => event.candidate)
    .filter((entry) => entry?.id === candidate.repairOf && entry.state === 'repair-required');
  if (matches.length === 0 || new Set(matches.map(stableJson)).size !== 1) return null;
  const loopMatches = records.filter((entry) => entry?.id === candidate.repairOf);
  if (loopMatches.length > 1 || (loopMatches.length === 1 && stableJson(loopMatches[0]) !== stableJson(matches[0]))) {
    return null;
  }
  return loopMatches.length === 1 ? records : [matches[0], ...records];
}

export function gitAncestor(root, base, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', base, descendant], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function requireState(candidate, states) {
  if (candidate.state === 'audit-failed-stop') throw failure('AUDIT_FAILED_STOP_TERMINAL');
  if (!states.includes(candidate.state)) {
    throw failure('INVALID_CANDIDATE_TRANSITION', `${candidate.state} cannot perform this action`);
  }
}

function requirePermission(candidate, permission) {
  if (candidate.authority?.[permission] !== true) {
    throw failure('PERMISSION_REQUIRED', `${permission} authority is required`);
  }
}

function requireValue(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw failure(code);
  return value;
}

function acceptanceFields(entry) {
  return Object.fromEntries(USER_REAUTHORIZE_ACCEPTANCE_KEYS.map((key) => [key, clone(entry?.[key])]));
}

function validateUserReauthorizeAcceptance(value) {
  if (
    !value || typeof value !== 'object' || Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...USER_REAUTHORIZE_ACCEPTANCE_KEYS].sort()) ||
    typeof value.boundary !== 'string' || value.boundary.length === 0 ||
    typeof value.manualBoundary !== 'string' || value.manualBoundary.length === 0
  ) throw failure('INVALID_USER_REAUTHORIZE_ACCEPTANCE');
  for (const key of ['evidence', 'landingState']) {
    if (!Array.isArray(value[key]) || value[key].length === 0 ||
      value[key].some((entry) => typeof entry !== 'string' || entry.length === 0) ||
      new Set(value[key]).size !== value[key].length) {
      throw failure('INVALID_USER_REAUTHORIZE_ACCEPTANCE');
    }
  }
}

export function replaceLedgerEntryText(text, {
  collectionKey,
  identityKey,
  identityValue,
  nextEntry,
}) {
  const collectionMarker = JSON.stringify(collectionKey);
  const collectionIndex = text.indexOf(collectionMarker);
  if (collectionIndex < 0 || text.indexOf(collectionMarker, collectionIndex + collectionMarker.length) >= 0) {
    throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
  }
  const arrayStart = text.indexOf('[', collectionIndex + collectionMarker.length);
  if (arrayStart < 0) throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
  const matches = [];
  let objectStart = null;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      if (objectDepth === 0) objectStart = index;
      objectDepth += 1;
      continue;
    }
    if (character === '}') {
      objectDepth -= 1;
      if (objectDepth < 0 || objectStart === null) {
        throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
      }
      if (objectDepth === 0) {
        const end = index + 1;
        let entry;
        try {
          entry = JSON.parse(text.slice(objectStart, end));
        } catch {
          throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
        }
        if (entry?.[identityKey] === identityValue) matches.push({ start: objectStart, end });
        objectStart = null;
      }
      continue;
    }
    if (character === ']' && objectDepth === 0) break;
  }
  if (matches.length !== 1) throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
  const [{ start, end }] = matches;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const indentation = text.slice(lineStart, start);
  if (!/^\s*$/.test(indentation)) throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
  const rendered = JSON.stringify(nextEntry, null, 2)
    .split('\n')
    .map((line, index) => index === 0 ? line : `${indentation}${line}`)
    .join('\n');
  return `${text.slice(0, start)}${rendered}${text.slice(end)}`;
}

function applyUsage(candidate, usage) {
  if (usage === undefined) return;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) throw failure('INVALID_USAGE_UPDATE');
  const allowed = new Set([
    'supervisorModelCycles',
    'supervisorUncachedInputTokens',
    'teamModelCycles',
    'teamUncachedInputTokens',
  ]);
  for (const [key, value] of Object.entries(usage)) {
    if (!allowed.has(key) || !Number.isSafeInteger(value) || value < candidate.counters[key]) {
      throw failure('INVALID_USAGE_UPDATE');
    }
    candidate.counters[key] = value;
  }
}

function addLineage(candidate, role, lineageId) {
  requireValue(lineageId, 'MISSING_LINEAGE_ID');
  const existing = candidate.lineages[role].find((lineage) => lineage.id === lineageId);
  if (existing) throw failure('DUPLICATE_LINEAGE_ID');
  candidate.lineages[role].push({ id: lineageId, compactions: 0, freshContinuations: 0 });
  const counter = role === 'implementer' ? 'implementerLineages' : 'coldAuditorLineages';
  candidate.counters[counter] = candidate.lineages[role].length;
  return candidate.lineages[role].at(-1);
}

function existingLineage(candidate, role, lineageId) {
  requireValue(lineageId, 'MISSING_LINEAGE_ID');
  const lineage = candidate.lineages[role].find((entry) => entry.id === lineageId);
  if (!lineage) throw failure('UNKNOWN_LINEAGE_ID');
  return lineage;
}

function addWaitChain(candidate, kind, waitChainId) {
  requireValue(waitChainId, 'MISSING_WAIT_CHAIN_ID');
  if (candidate.waitChains[kind].includes(waitChainId)) throw failure('DUPLICATE_WAIT_CHAIN_ID');
  candidate.waitChains[kind].push(waitChainId);
  candidate.counters[kind === 'audit' ? 'auditWaitChains' : 'ciWaitChains'] = candidate.waitChains[kind].length;
}

const STRUCTURAL_COUNTER_KEYS = [
  'implementerLineages', 'coldAuditorLineages', 'auditWaitChains', 'ciWaitChains',
  'semanticPushes',
];

function assertStructuralLimits(candidate, limits) {
  for (const key of STRUCTURAL_COUNTER_KEYS) {
    if (candidate.counters[key] > limits[key]) throw failure('BUDGET_LIMIT_EXCEEDED', key);
  }
}

function bindReleaseHead(candidate, options) {
  if (!/^[0-9a-f]{40}$/.test(options.releaseHeadSha ?? '')) throw failure('MISSING_RELEASE_HEAD_SHA');
  const current = candidate.releaseHeadSha ?? null;
  if (current !== null && current !== options.releaseHeadSha) throw failure('RELEASE_HEAD_ALREADY_BOUND');
  if (current === null && candidate.baseSha === options.releaseHeadSha) throw failure('POST_COMMIT_HEAD_REQUIRED');
  candidate.releaseHeadSha = options.releaseHeadSha;
  if (options.guardImpact) candidate.guardImpact = clone(options.guardImpact);
}

const watchdogAdvisories = (candidate, policy) =>
  evaluateCandidateBudget(candidate, policy).advisories ?? [];

export function applyProgramAction({ records, action, options = {}, policy }) {
  const nextRecords = clone(records);
  let candidate = nextRecords.find((entry) => entry.state !== 'repair-required');
  if (action === 'inspect') {
    if (!candidate) throw failure('MISSING_ACTIVE_CANDIDATE');
    return { records: nextRecords, activeCandidate: candidate, mutated: false, advisories: watchdogAdvisories(candidate, policy) };
  }
  if (action === 'derive-repair') {
    if (candidate) throw failure('ACTIVE_CANDIDATE_ALREADY_EXISTS');
    const previous = nextRecords.at(-1);
    if (!previous || previous.state !== 'repair-required') throw failure('REPAIR_NOT_DERIVABLE');
    const candidateId = requireValue(options.candidate, 'MISSING_REPAIR_CANDIDATE_ID');
    if (nextRecords.some((entry) => entry.id === candidateId)) throw failure('DUPLICATE_CANDIDATE_ID');
    candidate = clone(previous);
    candidate.id = candidateId;
    candidate.state = 'implementing';
    candidate.repairOf = previous.id;
    candidate.baseSha = requireValue(options.baseSha, 'MISSING_REPAIR_BASE_SHA');
    candidate.releaseHeadSha = null;
    delete candidate.repairReason;
    delete candidate.stopReason;
    delete candidate.usageSnapshot;
    candidate.guardImpact = { reportFingerprint: null, acknowledgement: null };
    applyUsage(candidate, options.usage);
    nextRecords.push(candidate);
    assertStructuralLimits(candidate, policy.limits);
    return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
  }
  if (action === 'derive-post-ship-repair') {
    if (!candidate || candidate.state !== 'shipped') throw failure('POST_SHIP_REPAIR_NOT_DERIVABLE');
    if (options.reason !== POST_SHIP_REPAIR_REASON) throw failure('INVALID_POST_SHIP_REPAIR_REASON');
    const candidateId = requireValue(options.candidate, 'MISSING_REPAIR_CANDIDATE_ID');
    if (nextRecords.some((entry) => entry.id === candidateId)) throw failure('DUPLICATE_CANDIDATE_ID');
    const priorIndex = nextRecords.indexOf(candidate);
    const previous = clone(candidate);
    previous.state = 'repair-required';
    previous.repairReason = 'ci-environment';
    nextRecords[priorIndex] = previous;
    candidate = clone(candidate);
    candidate.id = candidateId;
    candidate.state = 'implementing';
    candidate.repairOf = previous.id;
    candidate.baseSha = requireValue(options.baseSha, 'MISSING_REPAIR_BASE_SHA');
    candidate.treeFingerprint = requireValue(options.treeFingerprint, 'MISSING_REPAIR_TREE_FINGERPRINT');
    candidate.releaseHeadSha = null;
    delete candidate.repairReason;
    delete candidate.stopReason;
    delete candidate.usageSnapshot;
    candidate.guardImpact = clone(options.guardImpact);
    applyUsage(candidate, options.usage);
    nextRecords.push(candidate);
    assertStructuralLimits(candidate, policy.limits);
    return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
  }
  if (!candidate) throw failure('MISSING_ACTIVE_CANDIDATE');
  applyUsage(candidate, options.usage);
  if (options.guardImpact) candidate.guardImpact = clone(options.guardImpact);

  if (action === 'user-reopen') {
    if (candidate.state !== 'audit-failed-stop') throw failure('INVALID_USER_REOPEN_ORIGIN');
    if (typeof options.reason !== 'string' || !options.reason.startsWith('user-ruling:')) {
      throw failure('MISSING_EXACT_USER_REOPEN_REASON');
    }
    candidate.state = 'audit-repairable';
    delete candidate.stopReason;
    delete candidate.usageSnapshot;
    assertStructuralLimits(candidate, policy.limits);
    return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
  }

  if (action === 'user-reauthorize') {
    if (candidate.state !== 'audited') throw failure('INVALID_USER_REAUTHORIZE_ORIGIN');
    if (typeof options.reason !== 'string' || !options.reason.startsWith('user-ruling:')) {
      throw failure('MISSING_EXACT_USER_REAUTHORIZE_REASON');
    }
    const nextAuthority = options.authority;
    if (!nextAuthority || typeof nextAuthority !== 'object' || Array.isArray(nextAuthority)) {
      throw failure('INVALID_USER_REAUTHORIZE_AUTHORITY');
    }
    const keys = ['commit', 'deploy', 'localWrites', 'push', 'ship'];
    if (JSON.stringify(Object.keys(nextAuthority).sort()) !== JSON.stringify(keys)) {
      throw failure('INVALID_USER_REAUTHORIZE_AUTHORITY');
    }
    if (keys.some((key) => typeof nextAuthority[key] !== 'boolean' ||
      (candidate.authority[key] === true && nextAuthority[key] !== true)) ||
      !keys.some((key) => candidate.authority[key] === false && nextAuthority[key] === true)) {
      throw failure('NON_MONOTONIC_USER_REAUTHORIZE_AUTHORITY');
    }
    if (typeof options.authoritySource !== 'string' || options.authoritySource !== options.reason ||
      !/^[0-9a-f]{64}$/.test(options.acceptanceFingerprint ?? '') ||
      options.acceptanceFingerprint === candidate.acceptanceFingerprint ||
      !/^[0-9a-f]{64}$/.test(options.treeFingerprint ?? '') ||
      options.treeFingerprint === candidate.treeFingerprint) {
      throw failure('INVALID_USER_REAUTHORIZE_EPOCH');
    }
    candidate.authority = clone(nextAuthority);
    candidate.authoritySource = options.authoritySource;
    candidate.acceptanceFingerprint = options.acceptanceFingerprint;
    candidate.treeFingerprint = options.treeFingerprint;
    candidate.guardImpact = { reportFingerprint: null, acknowledgement: null };
    candidate.state = 'implementing';
    assertStructuralLimits(candidate, policy.limits);
    return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
  }

  if (action === 'repair-resume') {
    if (candidate.state !== 'audit-failed-stop') throw failure('INVALID_REPAIR_RESUME_ORIGIN');
    if (typeof options.reason !== 'string' || !options.reason.startsWith('same-scope:') || options.reason.length === 'same-scope:'.length) {
      throw failure('MISSING_SAME_SCOPE_REPAIR_REASON');
    }
    candidate.state = 'audit-repairable';
    delete candidate.stopReason;
    delete candidate.usageSnapshot;
    assertStructuralLimits(candidate, policy.limits);
    return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
  }

  switch (action) {
    case 'local-write':
      requireState(candidate, ['contract-frozen']);
      requirePermission(candidate, 'localWrites');
      addLineage(candidate, 'implementer', options.lineage);
      candidate.state = 'implementing';
      break;
    case 'start-implementation':
      requireState(candidate, ['contract-frozen']);
      requirePermission(candidate, 'localWrites');
      addLineage(candidate, 'implementer', options.lineage);
      candidate.state = 'implementing';
      break;
    case 'mark-audit-ready':
      requireState(candidate, ['implementing']);
      candidate.state = 'audit-ready';
      break;
    case 'audit':
      requireState(candidate, ['implementing', 'audit-ready']);
      candidate.state = 'audit-ready';
      addLineage(candidate, 'coldAuditor', options.lineage);
      addWaitChain(candidate, 'audit', options.waitChain);
      break;
    case 'start-audit':
      requireState(candidate, ['audit-ready']);
      addLineage(candidate, 'coldAuditor', options.lineage);
      break;
    case 'start-audit-wait':
      requireState(candidate, ['audit-ready']);
      addWaitChain(candidate, 'audit', options.waitChain);
      break;
    case 'record-audit-failure':
      requireState(candidate, ['audit-ready']);
      candidate.state = 'audit-repairable';
      break;
    case 'start-correction':
      requireState(candidate, ['audit-repairable']);
      existingLineage(candidate, 'implementer', options.lineage);
      candidate.counters.correctionWaves += 1;
      candidate.state = 'implementing';
      break;
    case 'record-audit-stop':
      requireState(candidate, ['audit-ready', 'audit-repairable']);
      candidate.stopReason = requireValue(options.reason, 'MISSING_AUDIT_STOP_REASON');
      candidate.usageSnapshot = clone(candidate.counters);
      candidate.state = 'audit-failed-stop';
      break;
    case 'mark-audited':
      requireState(candidate, ['audit-ready']);
      if (candidate.counters.coldAuditorLineages !== 1 || candidate.counters.auditWaitChains !== 1) {
        throw failure('INCOMPLETE_AUDIT_CHAIN');
      }
      candidate.state = 'audited';
      break;
    case 'full-check':
    case 'start-full-check':
      requireState(candidate, ['audited']);
      candidate.counters.fullChecks += 1;
      break;
    case 'mark-full-check-passed':
      requireState(candidate, ['audited']);
      if (candidate.counters.fullChecks < 1) throw failure('FULL_CHECK_NOT_STARTED');
      candidate.state = 'full-check-passed';
      break;
    case 'require-repair':
      requireState(candidate, ['audited', 'full-check-passed', 'push-ready', 'ci-passed']);
      if (!RELEASE_REPAIR_REASONS.has(options.reason)) throw failure('INVALID_RELEASE_REPAIR_REASON');
      if (options.reason === 'release-full-check' && candidate.counters.fullChecks < 1) {
        throw failure('FULL_CHECK_NOT_STARTED');
      }
      if (options.reason === 'ci-environment' && !['push-ready', 'ci-passed'].includes(candidate.state)) {
        throw failure('CI_REPAIR_NOT_DERIVABLE');
      }
      candidate.repairReason = options.reason;
      candidate.state = 'repair-required';
      break;
    case 'commit':
    case 'record-commit':
      requireState(candidate, ['full-check-passed']);
      requirePermission(candidate, 'commit');
      candidate.releaseHeadSha = null;
      candidate.state = 'push-ready';
      break;
    case 'push':
      requireState(candidate, ['push-ready']);
      requirePermission(candidate, 'push');
      bindReleaseHead(candidate, options);
      candidate.counters[candidate.repairOf ? 'replacementPushes' : 'semanticPushes'] += 1;
      break;
    case 'record-semantic-push':
      requireState(candidate, ['push-ready']);
      requirePermission(candidate, 'push');
      bindReleaseHead(candidate, options);
      candidate.counters.semanticPushes += 1;
      break;
    case 'record-replacement-push':
      requireState(candidate, ['push-ready']);
      requirePermission(candidate, 'push');
      if (!candidate.repairOf) throw failure('REPLACEMENT_PUSH_REQUIRES_REPAIR');
      bindReleaseHead(candidate, options);
      candidate.counters.replacementPushes += 1;
      break;
    case 'start-ci-wait':
      requireState(candidate, ['push-ready']);
      if (candidate.counters.semanticPushes + candidate.counters.replacementPushes < 1) {
        throw failure('PUSH_NOT_RECORDED');
      }
      addWaitChain(candidate, 'ci', options.waitChain);
      break;
    case 'mark-ci-passed':
      requireState(candidate, ['push-ready']);
      if (candidate.counters.ciWaitChains !== 1) throw failure('INCOMPLETE_CI_CHAIN');
      candidate.state = 'ci-passed';
      break;
    case 'deploy':
    case 'record-deploy':
      requireState(candidate, ['ci-passed']);
      requirePermission(candidate, 'deploy');
      break;
    case 'ship':
    case 'mark-shipped':
      requireState(candidate, ['ci-passed']);
      requirePermission(candidate, 'ship');
      candidate.state = 'shipped';
      break;
    case 'compact-implementer':
    case 'compact-cold-auditor': {
      requireState(candidate, SUPPORTED_NONTERMINAL_STATES);
      const role = action === 'compact-implementer' ? 'implementer' : 'coldAuditor';
      existingLineage(candidate, role, options.lineage).compactions += 1;
      break;
    }
    case 'continue-implementer':
    case 'continue-cold-auditor': {
      requireState(candidate, SUPPORTED_NONTERMINAL_STATES);
      const role = action === 'continue-implementer' ? 'implementer' : 'coldAuditor';
      existingLineage(candidate, role, options.lineage).freshContinuations += 1;
      break;
    }
    default:
      throw failure('UNKNOWN_PROGRAM_ACTION', action);
  }
  assertStructuralLimits(candidate, policy.limits);
  return { records: nextRecords, activeCandidate: candidate, advisories: watchdogAdvisories(candidate, policy) };
}

const SUPPORTED_NONTERMINAL_STATES = [
  'contract-frozen',
  'implementing',
  'audit-ready',
  'audit-repairable',
  'audited',
  'full-check-passed',
  'push-ready',
  'ci-passed',
];

function parseArguments(argv) {
  const options = {};
  const allowed = new Set([
    '--domain', '--action', '--lineage', '--wait-chain', '--candidate', '--reason',
    '--usage', '--base', '--owner', '--receipt', '--receipt-plan', '--sessions-root',
    '--actor-session', '--actor-role', '--authority', '--authority-source',
    '--acceptance', '--expected-event-hash',
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || options[key.slice(2)] !== undefined) {
      throw failure('INVALID_ARGUMENTS', 'usage: codex-program-step.mjs --domain <id> --action <action> [options]');
    }
    options[key.slice(2)] = value;
  }
  if (!options.domain || !options.action) throw failure('INVALID_ARGUMENTS');
  if (options.usage) {
    try {
      options.usage = JSON.parse(options.usage);
    } catch {
      throw failure('INVALID_USAGE_UPDATE');
    }
  }
  for (const key of ['authority', 'acceptance']) {
    if (!options[key]) continue;
    try {
      options[key] = JSON.parse(options[key]);
    } catch {
      throw failure(key === 'authority'
        ? 'INVALID_USER_REAUTHORIZE_AUTHORITY'
        : 'INVALID_USER_REAUTHORIZE_ACCEPTANCE');
    }
  }
  return options;
}

function postShipTreeFingerprint(root, authorityPath) {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter((path) => path && path !== authorityPath && path !== LOOP_STATE_PATH);
  return computeTreeFingerprint(root, paths);
}

export function writeAtomicTransition(files, operations = {}) {
  const writeFile = operations.writeFile ?? writeFileSync;
  const rename = operations.rename ?? renameSync;
  const exists = operations.exists ?? existsSync;
  const unlink = operations.unlink ?? unlinkSync;
  const suffix = `.tmp-${process.pid}-${Date.now()}`;
  const entries = files.map((entry, index) => ({
    ...entry,
    temporaryPath: `${entry.path}${suffix}-${index}`,
    rollbackPath: `${entry.path}${suffix}-${index}-rollback`,
  }));
  const replaced = [];
  try {
    for (const entry of entries) writeFile(entry.temporaryPath, entry.text);
    for (const entry of entries) {
      rename(entry.temporaryPath, entry.path);
      replaced.push(entry);
    }
  } catch (error) {
    let rollbackError = null;
    for (const entry of [...replaced].reverse()) {
      try {
        writeFile(entry.rollbackPath, entry.previousText);
        rename(entry.rollbackPath, entry.path);
      } catch (candidate) {
        rollbackError ??= candidate;
      }
    }
    for (const entry of entries) {
      for (const path of [entry.temporaryPath, entry.rollbackPath]) {
        if (exists(path)) unlink(path);
      }
    }
    if (rollbackError) throw failure('ATOMIC_TRANSITION_ROLLBACK_FAILED', String(rollbackError));
    throw error;
  }
}

function writePostShipTransition({ authorityPath, authorityText, previousAuthorityText, loopPath, loopText }) {
  writeAtomicTransition([
    { path: authorityPath, text: authorityText, previousText: previousAuthorityText },
    { path: loopPath, text: loopText, previousText: readFileSync(loopPath, 'utf8') },
  ]);
}

function sameCandidateScope(left, right) {
  return left?.domainId === right?.domainId &&
    left?.acceptanceFingerprint === right?.acceptanceFingerprint &&
    stableJson(left?.authority) === stableJson(right?.authority) &&
    left?.authoritySource === right?.authoritySource;
}

export function runProgramStep({ root = process.cwd(), ...options } = {}) {
  const loopPath = resolve(root, LOOP_STATE_PATH);
  const loopStateText = readFileSync(loopPath, 'utf8');
  const parsed = parseCandidateRecords(loopStateText);
  if (!parsed.records) return { ok: false, domain: options.domain, action: options.action, errors: parsed.errors };
  const currentCandidate = parsed.records.find((entry) => entry.state !== 'repair-required') ?? parsed.records.at(-1);
  const activeAuthorityPath = currentCandidate?.domainId
    ? supervisorAuthorityPath(currentCandidate.domainId)
    : null;
  let authorityDriftPaths = [];
  try {
    authorityDriftPaths = collectChangedFiles({ cwd: root, base: 'HEAD' }).files
      .filter((path) => path.startsWith('research/cr-grounding/supervisor-events/'));
  } catch (error) {
    return {
      ok: false,
      domain: options.domain,
      action: options.action,
      errors: [{ code: 'SUPERVISOR_AUTHORITY_DRIFT_SCAN_FAILED', message: error instanceof Error ? error.message : String(error) }],
    };
  }
  const unexpectedAuthorityPaths = authorityDriftPaths.filter((path) => path !== activeAuthorityPath);
  if (unexpectedAuthorityPaths.length > 0) {
    return {
      ok: false,
      domain: options.domain,
      action: options.action,
      errors: unexpectedAuthorityPaths.map((path) => ({
        code: 'UNEXPECTED_SUPERVISOR_AUTHORITY_DRIFT',
        path,
        expectedPath: activeAuthorityPath,
      })),
    };
  }
  const readReceipt = (contextFingerprint = currentCandidate?.treeFingerprint) => {
    if (!options.receipt && !options['receipt-plan']) throw failure('MISSING_VERIFIED_USAGE_RECEIPT');
    if (options.receipt && options['receipt-plan']) throw failure('AMBIGUOUS_USAGE_RECEIPT_INPUT');
    let receipt;
    let verified;
    if (options['receipt-plan']) {
      const plan = JSON.parse(readFileSync(resolve(root, options['receipt-plan']), 'utf8'));
      const tracked = readTrackedSupervisorAuthority(root, currentCandidate?.domainId);
      if (tracked.authority && !receiptPlanMatchesAnchor(plan, tracked.authority.events?.[0]?.receipt)) {
        throw failure('USAGE_RECEIPT_PLAN_ANCHOR_MISMATCH');
      }
      ({ receipt, verified } = deriveUsageReceipt(plan, {
        sessionsRoot: options['sessions-root'],
        contextFingerprint,
      }));
    } else {
      receipt = JSON.parse(readFileSync(resolve(root, options.receipt), 'utf8'));
      const tracked = readTrackedSupervisorAuthority(root, currentCandidate?.domainId);
      if (tracked.authority && !receiptPlanMatchesAnchor(receipt, tracked.authority.events?.[0]?.receipt)) {
        throw failure('USAGE_RECEIPT_PLAN_ANCHOR_MISMATCH');
      }
      verified = verifyUsageReceipt(receipt, {
        sessionsRoot: options['sessions-root'],
        expectedContextFingerprint: contextFingerprint,
        requireCurrent: true,
      });
    }
    if (!verified.ok) throw failure('INVALID_VERIFIED_USAGE_RECEIPT', JSON.stringify(verified.errors));
    if (!options['actor-session'] || !options['actor-role']) throw failure('MISSING_VERIFIED_ACTOR');
    const actor = options['actor-session'] === receipt.supervisor.sessionId
      ? { source: receipt.supervisor, report: verified.supervisor }
      : verified.participants.find((item) => item.source.sessionId === options['actor-session']);
    if (
      !actor ||
      actor.source.role !== options['actor-role'] ||
      options['actor-role'] !== requiredActorRole(options.action)
    ) throw failure('VERIFIED_ACTOR_MISMATCH');
    if (typeof options.afterReceiptDerived === 'function') {
      options.afterReceiptDerived({ receipt: structuredClone(receipt), action: options.action });
    }
    return { receipt, verified, actor };
  };
  if (options.action === 'bootstrap-authority') {
    try {
      const ledger = JSON.parse(readFileSync(resolve(root, LEDGER_PATH), 'utf8'));
      const activeDomainId = findActiveSupervisedDomainId(ledger);
      if (!activeDomainId || options.domain !== activeDomainId || currentCandidate?.domainId !== activeDomainId) {
        throw failure('ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH');
      }
      const tracked = readTrackedSupervisorAuthority(root, activeDomainId);
      if (tracked.errors?.length) {
        throw failure('INVALID_HEAD_SUPERVISOR_AUTHORITY', JSON.stringify(tracked.errors));
      }
      if (tracked.authority || tracked.headAuthority) {
        throw failure('TRACKED_SUPERVISOR_AUTHORITY_ALREADY_EXISTS');
      }
      const bootstrapFingerprint = computeTreeFingerprint(root);
      const verifiedReceipt = readReceipt(bootstrapFingerprint);
      const bootstrapCandidate = clone(currentCandidate);
      applyUsage(bootstrapCandidate, Object.fromEntries(
        ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']
          .map((key) => [key, verifiedReceipt.verified.observed[key]]),
      ));
      bootstrapCandidate.treeFingerprint = bootstrapFingerprint;
      for (const [role, receiptRole] of [['implementer', 'implementer'], ['coldAuditor', 'cold-auditor']]) {
        const verifiedIds = verifiedReceipt.receipt.participants
          .filter((source) => source.role === receiptRole)
          .map((source) => source.sessionId);
        if (bootstrapCandidate.lineages?.[role]?.length === 1) {
          if (verifiedIds.length !== 1) throw failure('BOOTSTRAP_ROLE_IDENTITY_MISMATCH', role);
          bootstrapCandidate.lineages[role][0].id = verifiedIds[0];
        }
      }
      if (bootstrapCandidate.waitChains?.audit?.length === 1) {
        const auditorId = bootstrapCandidate.lineages?.coldAuditor?.[0]?.id;
        if (!auditorId) throw failure('BOOTSTRAP_ROLE_IDENTITY_MISMATCH', 'audit-wait');
        bootstrapCandidate.waitChains.audit[0] = auditorId;
      }
      let bootstrapLoopText = replaceLoopField(loopStateText, ACTIVE_CANDIDATES_KEY, JSON.stringify([bootstrapCandidate]));
      bootstrapLoopText = replaceLoopField(bootstrapLoopText, 'step', bootstrapCandidate.state);
      bootstrapLoopText = replaceLoopField(bootstrapLoopText, 'treeFingerprint', bootstrapFingerprint);
      const bootstrapProjection = buildSupervisorProjection({
        ledger,
        selectedDomainId: activeDomainId,
        loopStateText: bootstrapLoopText,
        loopState: parseLoopState(bootstrapLoopText, {
          headSha: bootstrapCandidate.baseSha,
          treeFingerprint: bootstrapFingerprint,
        }),
        headSha: bootstrapCandidate.baseSha,
        treeFingerprint: bootstrapFingerprint,
      });
      if (bootstrapProjection.errors.length > 0 || !bootstrapProjection.activeCandidate) {
        throw failure('INVALID_BOOTSTRAP_CANDIDATE', JSON.stringify(bootstrapProjection.errors));
      }
      return {
        ok: true,
        domain: options.domain,
        action: options.action,
        trackedPath: supervisorAuthorityPath(options.domain),
        bootstrapLoopCandidate: bootstrapCandidate,
        bootstrapAuthority: createSupervisorBootstrap({
          candidate: bootstrapCandidate,
          receipt: verifiedReceipt.receipt,
          actorSessionId: options['actor-session'],
          actorRole: options['actor-role'],
        }),
        advisories: bootstrapProjection.advisories ?? [],
        errors: [],
      };
    } catch (error) {
      return { ok: false, domain: options.domain, action: options.action, errors: [{ code: error?.code ?? 'BOOTSTRAP_FAILED', message: error instanceof Error ? error.message : String(error) }] };
    }
  }
  if (options.action === 'derive-post-ship-repair') {
    try {
      if (options.reason !== POST_SHIP_REPAIR_REASON) throw failure('INVALID_POST_SHIP_REPAIR_REASON');
      if (!['judge', 'implementer'].includes(options.owner)) {
        throw failure('MISSING_GUARD_ACKNOWLEDGEMENT_OWNER');
      }
      const ledger = JSON.parse(readFileSync(resolve(root, LEDGER_PATH), 'utf8'));
      const domainIds = ledger.goalPolicy?.activeProgram?.domainIds;
      const enforcementIndex = domainIds?.indexOf(ledger.goalPolicy?.supervisionPolicy?.enforceFromDomainId);
      const domainIndex = domainIds?.indexOf(options.domain);
      const domain = ledger.domains?.find((entry) => entry?.id === options.domain);
      const planned = ledger.plannedSequence?.find((entry) => entry?.domainId === options.domain);
      const activeDomainId = findActiveSupervisedDomainId(ledger);
      const synchronizedShipped = domain?.status === 'shipped' && planned?.status === 'shipped';
      if (
        !Array.isArray(domainIds) || enforcementIndex < 0 || domainIndex < enforcementIndex ||
        !domain || !planned || domain.status !== planned.status ||
        (activeDomainId !== options.domain && !synchronizedShipped)
      ) throw failure('ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH');
      if (parsed.records.some((entry) => entry.domainId !== options.domain)) {
        throw failure('ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH');
      }
      const tracked = readTrackedSupervisorAuthority(root, options.domain);
      if (tracked.errors?.length) throw failure('INVALID_HEAD_SUPERVISOR_AUTHORITY', JSON.stringify(tracked.errors));
      if (!tracked.authority || !tracked.headAuthority) throw failure('MISSING_TRACKED_SUPERVISOR_AUTHORITY');
      if (stableJson(tracked.authority) !== stableJson(tracked.headAuthority)) {
        throw failure('POST_SHIP_AUTHORITY_NOT_EXACT_HEAD');
      }
      if (tracked.authority.events.some((event) => event.action === 'derive-post-ship-repair')) {
        throw failure('POST_SHIP_REPAIR_ALREADY_DERIVED');
      }
      const shippedCandidate = tracked.authority.events.at(-1)?.candidate;
      if (!shippedCandidate || shippedCandidate.state !== 'shipped' || shippedCandidate.domainId !== options.domain) {
        throw failure('POST_SHIP_REPAIR_NOT_DERIVABLE');
      }
      const loopCandidate = parsed.records.find((entry) => entry.state !== 'repair-required') ?? parsed.records.at(-1);
      if (loopCandidate && !sameCandidateScope(loopCandidate, shippedCandidate)) {
        throw failure('POST_SHIP_LOOP_SCOPE_MISMATCH');
      }
      const historical = verifySupervisorAuthority({
        authority: tracked.authority,
        headAuthority: tracked.headAuthority,
        loopCandidate: shippedCandidate,
        sessionsRoot: options['sessions-root'],
        completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!historical.ok) throw failure('INVALID_TRACKED_SUPERVISOR_AUTHORITY', JSON.stringify(historical.errors));
      const candidateId = requireValue(options.candidate, 'MISSING_REPAIR_CANDIDATE_ID');
      if (
        parsed.records.some((entry) => entry.id === candidateId) ||
        tracked.authority.events.some((event) => event.candidate?.id === candidateId)
      ) throw failure('DUPLICATE_CANDIDATE_ID');
      const head = collectChangedFiles({ cwd: root, base: 'HEAD' }).head;
      if (options.base !== head) throw failure('POST_SHIP_REPAIR_BASE_MISMATCH');
      const treeFingerprint = postShipTreeFingerprint(root, tracked.relativePath);
      const verifiedReceipt = readReceipt(treeFingerprint);
      const policyResult = resolveSupervisionPolicy(ledger, options.domain);
      if (!policyResult.enforced || !policyResult.policy || policyResult.errors.length > 0) {
        throw failure('INVALID_SUPERVISION_POLICY', JSON.stringify(policyResult.errors));
      }
      const transitioned = applyProgramAction({
        records: [shippedCandidate],
        action: options.action,
        options: {
          candidate: candidateId,
          reason: options.reason,
          baseSha: head,
          treeFingerprint,
          guardImpact: { reportFingerprint: null, acknowledgement: null },
          usage: Object.fromEntries(
            ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']
              .map((key) => [key, verifiedReceipt.verified.observed[key]]),
          ),
        },
        policy: policyResult.policy,
      });
      const guardReport = buildGuardImpact({
        root,
        base: head,
        domain: options.domain,
        projection: { activeCandidate: transitioned.activeCandidate },
      });
      if (
        options.owner !== 'judge' &&
        guardReport.acknowledgementRequired.paths.some((entry) => entry.owner === 'judge')
      ) throw failure('GUARD_ACKNOWLEDGEMENT_OWNER_REQUIRED');
      transitioned.activeCandidate.guardImpact = {
        reportFingerprint: guardReport.reportFingerprint,
        acknowledgement: guardReport.acknowledgementRequired,
      };
      const candidateValidation = validateCandidateRecord(transitioned.activeCandidate, policyResult.policy);
      if (!candidateValidation.ok) {
        throw failure('INVALID_POST_SHIP_REPAIR_CANDIDATE', JSON.stringify(candidateValidation.errors));
      }
      const nextAuthority = clone(tracked.authority);
      nextAuthority.events.push(createSupervisorEvent({
        sequence: nextAuthority.events.length,
        action: options.action,
        actorSessionId: options['actor-session'],
        actorRole: options['actor-role'],
        candidate: transitioned.activeCandidate,
        receipt: verifiedReceipt.receipt,
        previousHash: nextAuthority.events.at(-1)?.eventHash ?? null,
        reason: options.reason,
      }));
      nextAuthority.candidateId = transitioned.activeCandidate.id;
      const verifiedNext = verifySupervisorAuthority({
        authority: nextAuthority,
        headAuthority: tracked.headAuthority,
        loopCandidate: transitioned.activeCandidate,
        sessionsRoot: options['sessions-root'],
        completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!verifiedNext.ok) throw failure('INVALID_POST_SHIP_REPAIR_AUTHORITY', JSON.stringify(verifiedNext.errors));
      let nextLoopText = replaceLoopField(loopStateText, ACTIVE_CANDIDATES_KEY, JSON.stringify(transitioned.records));
      nextLoopText = replaceLoopField(nextLoopText, 'step', transitioned.activeCandidate.state);
      nextLoopText = replaceLoopField(nextLoopText, 'baseSha', head);
      nextLoopText = replaceLoopField(nextLoopText, 'treeFingerprint', treeFingerprint);
      const authorityPath = resolve(root, tracked.relativePath);
      writePostShipTransition({
        authorityPath,
        authorityText: `${JSON.stringify(nextAuthority, null, 2)}\n`,
        previousAuthorityText: readFileSync(authorityPath, 'utf8'),
        loopPath,
        loopText: nextLoopText,
      });
      return {
        ok: true,
        domain: options.domain,
        action: options.action,
        activeCandidate: transitioned.activeCandidate,
        errors: [],
        advisories: transitioned.advisories ?? watchdogAdvisories(transitioned.activeCandidate, policyResult.policy),
      };
    } catch (error) {
      return {
        ok: false,
        domain: options.domain,
        action: options.action,
        errors: [{ code: error?.code ?? 'POST_SHIP_REPAIR_FAILED', message: error instanceof Error ? error.message : String(error) }],
      };
    }
  }
  if (options.action === 'refresh-fingerprint') {
    try {
      requireValue(options.base, 'MISSING_GUARD_IMPACT_BASE');
      if (!['judge', 'implementer'].includes(options.owner)) {
        throw failure('MISSING_GUARD_ACKNOWLEDGEMENT_OWNER');
      }
      const ledger = JSON.parse(readFileSync(resolve(root, LEDGER_PATH), 'utf8'));
      const activeDomainId = findActiveSupervisedDomainId(ledger);
      if (!activeDomainId || options.domain !== activeDomainId || currentCandidate?.domainId !== activeDomainId) {
        throw failure('ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH');
      }
      const tracked = readTrackedSupervisorAuthority(root, activeDomainId);
      if (tracked.errors?.length) throw failure('INVALID_HEAD_SUPERVISOR_AUTHORITY', JSON.stringify(tracked.errors));
      if (!tracked.authority) throw failure('MISSING_TRACKED_SUPERVISOR_AUTHORITY');
      const historical = verifySupervisorAuthority({
        authority: tracked.authority,
        headAuthority: tracked.headAuthority,
        loopCandidate: currentCandidate,
        sessionsRoot: options['sessions-root'],
        completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!historical.ok) {
        throw failure('INVALID_TRACKED_SUPERVISOR_AUTHORITY', JSON.stringify(historical.errors));
      }

      const refreshedFingerprint = computeTreeFingerprint(root);
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
      const cumulativeRecords = augmentRepairPredecessor(parsed.records, currentCandidate, tracked.authority);
      if (!cumulativeRecords || !allowsCumulativeReleaseGuardBase({
        records: cumulativeRecords, candidate: currentCandidate, requestedBase: options.base, headSha: head,
        isAncestor: (left, right) => gitAncestor(root, left, right),
      })) throw failure('CANDIDATE_GUARD_BASE_MISMATCH');
      const verifiedReceipt = readReceipt(refreshedFingerprint);
      const refreshedCandidate = clone(currentCandidate);
      applyUsage(refreshedCandidate, Object.fromEntries(
        ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']
          .map((key) => [key, verifiedReceipt.verified.observed[key]]),
      ));
      refreshedCandidate.treeFingerprint = refreshedFingerprint;
      const guardReport = buildGuardImpact({
        root,
        base: options.base,
        domain: options.domain,
        projection: { activeCandidate: refreshedCandidate },
      });
      if (
        options.owner !== 'judge' &&
        guardReport.acknowledgementRequired.paths.some((entry) => entry.owner === 'judge')
      ) {
        throw failure('GUARD_ACKNOWLEDGEMENT_OWNER_REQUIRED');
      }
      refreshedCandidate.guardImpact = {
        reportFingerprint: guardReport.reportFingerprint,
        acknowledgement: guardReport.acknowledgementRequired,
      };

      let refreshedLoopText = replaceLoopField(
        loopStateText,
        ACTIVE_CANDIDATES_KEY,
        JSON.stringify(cumulativeRecords.map((entry) => entry.id === refreshedCandidate.id ? refreshedCandidate : entry)),
      );
      refreshedLoopText = replaceLoopField(refreshedLoopText, 'step', refreshedCandidate.state);
      refreshedLoopText = replaceLoopField(
        refreshedLoopText,
        'treeFingerprint',
        refreshedFingerprint,
      );
      const refreshedProjection = buildSupervisorProjection({
        ledger,
        selectedDomainId: activeDomainId,
        loopStateText: refreshedLoopText,
        loopState: parseLoopState(refreshedLoopText, {
          headSha: refreshedCandidate.baseSha,
          treeFingerprint: refreshedFingerprint,
        }),
        headSha: refreshedCandidate.baseSha,
        treeFingerprint: refreshedFingerprint,
      });
      if (refreshedProjection.errors.length > 0 || !refreshedProjection.activeCandidate) {
        throw failure('INVALID_REFRESHED_CANDIDATE', JSON.stringify(refreshedProjection.errors));
      }

      const nextAuthority = clone(tracked.authority);
      const previousHash = nextAuthority.events.at(-1)?.eventHash ?? null;
      nextAuthority.events.push(createSupervisorEvent({
        sequence: nextAuthority.events.length,
        action: options.action,
        actorSessionId: options['actor-session'],
        actorRole: options['actor-role'],
        candidate: refreshedCandidate,
        receipt: verifiedReceipt.receipt,
        previousHash,
      }));
      nextAuthority.candidateId = refreshedCandidate.id;
      const verifiedNext = verifySupervisorAuthority({
        authority: nextAuthority,
        headAuthority: tracked.headAuthority,
        loopCandidate: refreshedCandidate,
        sessionsRoot: options['sessions-root'],
        completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!verifiedNext.ok) {
        throw failure('INVALID_REFRESHED_AUTHORITY', JSON.stringify(verifiedNext.errors));
      }
      writeFileSync(resolve(root, tracked.relativePath), `${JSON.stringify(nextAuthority, null, 2)}\n`);
      writeFileSync(loopPath, refreshedLoopText);
      return {
        ok: true,
        domain: options.domain,
        action: options.action,
        activeCandidate: refreshedCandidate,
        reportFingerprint: guardReport.reportFingerprint,
        advisories: refreshedProjection.advisories ?? [],
        errors: [],
      };
    } catch (error) {
      return {
        ok: false,
        domain: options.domain,
        action: options.action,
        errors: [{ code: error?.code ?? 'REFRESH_FINGERPRINT_FAILED', message: error instanceof Error ? error.message : String(error) }],
      };
    }
  }
  if (options.action === 'user-reauthorize') {
    try {
      if (options.base !== currentCandidate?.baseSha) throw failure('USER_REAUTHORIZE_BASE_MISMATCH');
      const ledgerPath = resolve(root, LEDGER_PATH);
      const ledgerText = readFileSync(ledgerPath, 'utf8');
      const ledger = JSON.parse(ledgerText);
      const domainIndexes = (ledger.domains ?? [])
        .map((entry, index) => entry?.id === options.domain ? index : -1).filter((index) => index >= 0);
      const plannedIndexes = (ledger.plannedSequence ?? [])
        .map((entry, index) => entry?.domainId === options.domain ? index : -1).filter((index) => index >= 0);
      if (domainIndexes.length !== 1 || plannedIndexes.length !== 1) {
        throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
      }
      const domain = ledger.domains[domainIndexes[0]];
      const planned = ledger.plannedSequence[plannedIndexes[0]];
      const policyResult = resolveSupervisionPolicy(ledger, options.domain);
      const currentAuthority = resolveCandidateAuthority({
        domain, planned, activeProgram: ledger.goalPolicy?.activeProgram,
      });
      if (
        stableJson(acceptanceFields(domain)) !== stableJson(acceptanceFields(planned)) ||
        computeAcceptanceFingerprint(domain) !== currentCandidate.acceptanceFingerprint ||
        currentAuthority.errors.length > 0 ||
        stableJson(currentAuthority.authority) !== stableJson(currentCandidate.authority) ||
        currentAuthority.authoritySource !== currentCandidate.authoritySource ||
        !policyResult.policy || policyResult.errors.length
      ) {
        throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
      }
      const reason = options.reason;
      const authoritySource = options.authoritySource ?? options['authority-source'];
      const expectedEventHash = options.expectedEventHash ?? options['expected-event-hash'];
      validateUserReauthorizeAcceptance(options.acceptance);
      if (typeof reason !== 'string' || !reason.startsWith('user-ruling:') ||
        authoritySource !== reason || !/^[0-9a-f]{64}$/.test(expectedEventHash ?? '')) {
        throw failure('INVALID_USER_REAUTHORIZE_EPOCH');
      }
      const tracked = readTrackedSupervisorAuthority(root, options.domain);
      if (!tracked.authority || tracked.authority.events?.at(-1)?.eventHash !== expectedEventHash) {
        throw failure('USER_REAUTHORIZE_PREDECESSOR_HASH_MISMATCH');
      }
      const historical = verifySupervisorAuthority({
        authority: tracked.authority, headAuthority: tracked.headAuthority, loopCandidate: currentCandidate,
        sessionsRoot: options['sessions-root'], completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!historical.ok) throw failure('INVALID_TRACKED_SUPERVISOR_AUTHORITY', JSON.stringify(historical.errors));
      const nextLedger = clone(ledger);
      for (const [collection, index] of [
        [nextLedger.domains, domainIndexes[0]],
        [nextLedger.plannedSequence, plannedIndexes[0]],
      ]) {
        Object.assign(collection[index], clone(options.acceptance), {
          authority: clone(options.authority),
          authoritySource,
        });
      }
      let nextLedgerText = replaceLedgerEntryText(ledgerText, {
        collectionKey: 'domains',
        identityKey: 'id',
        identityValue: options.domain,
        nextEntry: nextLedger.domains[domainIndexes[0]],
      });
      nextLedgerText = replaceLedgerEntryText(nextLedgerText, {
        collectionKey: 'plannedSequence',
        identityKey: 'domainId',
        identityValue: options.domain,
        nextEntry: nextLedger.plannedSequence[plannedIndexes[0]],
      });
      if (stableJson(JSON.parse(nextLedgerText)) !== stableJson(nextLedger)) {
        throw failure('CANDIDATE_AUTHORITY_COLLECTION_MISMATCH');
      }
      const nextAcceptanceFingerprint = computeAcceptanceFingerprint(nextLedger.domains[domainIndexes[0]]);
      if (nextAcceptanceFingerprint === currentCandidate.acceptanceFingerprint) {
        throw failure('INVALID_USER_REAUTHORIZE_EPOCH');
      }
      const nextTreeFingerprint = computeTreeFingerprint(root, undefined, {
        [LEDGER_PATH]: nextLedgerText,
      });
      const verifiedReceipt = readReceipt(nextTreeFingerprint);
      const transitioned = applyProgramAction({
        records: parsed.records, action: options.action,
        options: {
          reason, authority: options.authority, authoritySource,
          acceptanceFingerprint: nextAcceptanceFingerprint,
          treeFingerprint: nextTreeFingerprint,
          usage: Object.fromEntries(['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens'].map((key) => [key, verifiedReceipt.verified.observed[key]])),
        }, policy: policyResult.policy,
      });
      const nextAuthority = clone(tracked.authority);
      nextAuthority.events.push(createSupervisorEvent({
        sequence: nextAuthority.events.length, action: options.action,
        actorSessionId: options['actor-session'], actorRole: options['actor-role'],
        candidate: transitioned.activeCandidate, receipt: verifiedReceipt.receipt,
        previousHash: nextAuthority.events.at(-1)?.eventHash ?? null, reason,
      }));
      nextAuthority.candidateId = transitioned.activeCandidate.id;
      const verified = verifySupervisorAuthority({
        authority: nextAuthority, headAuthority: tracked.headAuthority, loopCandidate: transitioned.activeCandidate,
        sessionsRoot: options['sessions-root'], completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
      });
      if (!verified.ok) throw failure('INVALID_USER_REAUTHORIZE_AUTHORITY', JSON.stringify(verified.errors));
      let nextLoopText = replaceLoopField(loopStateText, ACTIVE_CANDIDATES_KEY, JSON.stringify(transitioned.records));
      nextLoopText = replaceLoopField(nextLoopText, 'step', transitioned.activeCandidate.state);
      nextLoopText = replaceLoopField(nextLoopText, 'treeFingerprint', nextTreeFingerprint);
      const nextProjection = buildSupervisorProjection({
        ledger: nextLedger,
        selectedDomainId: options.domain,
        loopStateText: nextLoopText,
        loopState: parseLoopState(nextLoopText, {
          headSha: transitioned.activeCandidate.baseSha,
          treeFingerprint: nextTreeFingerprint,
        }),
        headSha: transitioned.activeCandidate.baseSha,
        treeFingerprint: nextTreeFingerprint,
      });
      if (nextProjection.errors.length > 0) {
        throw failure('INVALID_USER_REAUTHORIZE_PROJECTION', JSON.stringify(nextProjection.errors));
      }
      const authorityPath = resolve(root, tracked.relativePath);
      writeAtomicTransition([
        { path: ledgerPath, text: nextLedgerText, previousText: ledgerText },
        {
          path: authorityPath,
          text: `${JSON.stringify(nextAuthority, null, 2)}\n`,
          previousText: readFileSync(authorityPath, 'utf8'),
        },
        { path: loopPath, text: nextLoopText, previousText: loopStateText },
      ]);
      return { ok: true, domain: options.domain, action: options.action, activeCandidate: transitioned.activeCandidate, errors: [] };
    } catch (error) {
      return { ok: false, domain: options.domain, action: options.action, errors: [{ code: error?.code ?? 'USER_REAUTHORIZE_FAILED', message: error instanceof Error ? error.message : String(error) }] };
    }
  }
  const projection = createContextProjection(root, options.domain, { sessionsRoot: options['sessions-root'] });
  const deriveOnlyErrors = projection.health.errors.every((error) => error.code === 'MISSING_ACTIVE_CANDIDATE');
  if (!projection.health.ok && !(options.action === 'derive-repair' && deriveOnlyErrors)) {
    return { ok: false, domain: options.domain, action: options.action, errors: projection.health.errors };
  }
  if (options.action === 'repair-resume' && projection.activeProgram?.autonomy?.mode !== 'complete') {
    return {
      ok: false,
      domain: options.domain,
      action: options.action,
      errors: [{ code: 'REPAIR_RESUME_REQUIRES_COMPLETE_AUTONOMY' }],
    };
  }
  try {
    const verifiedReceipt = options.action === 'inspect' ? null : readReceipt();
    let guardReport = null;
    let exactAuthorityOnlyGuardDrift = false;
    if (GUARD_GATED_ACTIONS.has(options.action)) {
      if (!options.base) throw failure('MISSING_GUARD_IMPACT_BASE');
      const guardProjection = projection.activeCandidate
        ? projection
        : { ...projection, activeCandidate: currentCandidate };
      guardReport = buildGuardImpact({ root, base: options.base, domain: options.domain, projection: guardProjection });
      const tracked = readTrackedSupervisorAuthority(root, currentCandidate?.domainId);
      if (tracked.errors?.length || !tracked.authority) throw failure('INVALID_TRACKED_SUPERVISOR_AUTHORITY');
      const cumulativeRecords = augmentRepairPredecessor(parsed.records, currentCandidate, tracked.authority);
      if (currentCandidate?.repairOf && !cumulativeRecords && guardReport.baseSha !== currentCandidate.baseSha) {
        throw failure('MISSING_CUMULATIVE_REPAIR_PREDECESSOR');
      }
      if (!allowsCumulativeReleaseGuardBase({
        records: cumulativeRecords ?? parsed.records, candidate: currentCandidate, requestedBase: guardReport.baseSha,
        headSha: projection.headSha, isAncestor: (left, right) => gitAncestor(root, left, right),
      })) {
        throw failure('CANDIDATE_GUARD_BASE_MISMATCH');
      }
      const guardRepairTransition =
        (options.action === 'require-repair' && options.reason === 'guard-impact') ||
        (options.action === 'derive-repair' && currentCandidate?.repairReason === 'guard-impact');
      const verifiedGuardDefect = guardRepairTransition &&
        guardReport.errors.length > 0 &&
        guardReport.errors.every((error) => [
          'STALE_GUARD_REPORT_FINGERPRINT',
          'MISSING_GUARD_ACKNOWLEDGEMENT',
          'GUARD_ACKNOWLEDGEMENT_MISMATCH',
        ].includes(error.code));
      exactAuthorityOnlyGuardDrift =
        guardReport.errors.every((error) => [
          'STALE_GUARD_REPORT_FINGERPRINT',
          'GUARD_ACKNOWLEDGEMENT_MISMATCH',
        ].includes(error.code)) &&
        equivalentGuardAcknowledgement(
          currentCandidate.guardImpact?.acknowledgement,
          guardReport,
          activeAuthorityPath,
        );
      if (!guardReport.ok && !verifiedGuardDefect && !exactAuthorityOnlyGuardDrift) {
        throw failure('INTRINSIC_GUARD_VALIDATION_FAILED', JSON.stringify(guardReport.errors));
      }
    }
    let transitioned;
    if (options.action === 'acknowledge-guard-impact') {
      requireValue(options.base, 'MISSING_GUARD_IMPACT_BASE');
      const records = clone(parsed.records);
      const activeCandidate = records.find((entry) => entry.state !== 'repair-required');
      if (!activeCandidate) throw failure('MISSING_ACTIVE_CANDIDATE');
      applyUsage(activeCandidate, Object.fromEntries(
        ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']
          .map((key) => [key, verifiedReceipt.verified.observed[key]]),
      ));
      const report = buildGuardImpact({ root, base: options.base, domain: options.domain, projection });
      if (!['judge', 'implementer'].includes(options.owner)) throw failure('MISSING_GUARD_ACKNOWLEDGEMENT_OWNER');
      if (options.owner !== 'judge' && report.acknowledgementRequired.paths.some((entry) => entry.owner === 'judge')) {
        throw failure('GUARD_ACKNOWLEDGEMENT_OWNER_REQUIRED');
      }
      activeCandidate.guardImpact = {
        reportFingerprint: report.reportFingerprint,
        acknowledgement: report.acknowledgementRequired,
      };
      transitioned = { records, activeCandidate };
    } else {
      transitioned = applyProgramAction({
        records: parsed.records,
        action: options.action,
        options: {
          lineage: verifiedReceipt?.actor.source.sessionId ?? options.lineage,
          waitChain: verifiedReceipt?.actor.source.sessionId ?? options['wait-chain'],
          candidate: options.candidate,
          reason: options.reason,
          baseSha: projection.headSha,
          releaseHeadSha: projection.headSha,
          guardImpact: guardReport && (guardReport.ok || exactAuthorityOnlyGuardDrift)
            ? {
                reportFingerprint: guardReport.reportFingerprint,
                acknowledgement: guardReport.acknowledgementRequired,
              }
            : null,
          usage: verifiedReceipt
            ? Object.fromEntries(
                ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']
                  .map((key) => [key, verifiedReceipt.verified.observed[key]]),
              )
            : options.usage,
        },
        policy: projection.supervisionPolicy,
      });
    }
    if (transitioned.mutated !== false) {
      const tracked = readTrackedSupervisorAuthority(root, currentCandidate.domainId);
      if (tracked.errors?.length) throw failure('INVALID_HEAD_SUPERVISOR_AUTHORITY', JSON.stringify(tracked.errors));
      if (!tracked.authority) throw failure('MISSING_TRACKED_SUPERVISOR_AUTHORITY');
      const events = tracked.authority.events;
      const event = createSupervisorEvent({
        sequence: events.length,
        action: options.action,
        actorSessionId: options['actor-session'],
        actorRole: options['actor-role'],
        candidate: transitioned.activeCandidate,
        receipt: verifiedReceipt.receipt,
        previousHash: events.at(-1)?.eventHash ?? null,
        reason: options.reason ?? null,
      });
      tracked.authority.events.push(event);
      tracked.authority.candidateId = transitioned.activeCandidate.id;
      writeFileSync(resolve(root, tracked.relativePath), `${JSON.stringify(tracked.authority, null, 2)}\n`);
    }
    let nextText = replaceLoopField(loopStateText, ACTIVE_CANDIDATES_KEY, JSON.stringify(transitioned.records));
    nextText = replaceLoopField(nextText, 'step', transitioned.activeCandidate.state);
    if (options.action === 'derive-repair') {
      nextText = replaceLoopField(nextText, 'baseSha', transitioned.activeCandidate.baseSha);
    }
    if (transitioned.mutated !== false) writeFileSync(loopPath, nextText);
    return {
      ok: true,
      domain: options.domain,
      action: options.action,
      activeCandidate: transitioned.activeCandidate,
      permissionRequired: Object.fromEntries(
        ['localWrites', 'commit', 'push', 'deploy', 'ship']
          .map((key) => [key, transitioned.activeCandidate.authority[key] !== true]),
      ),
      errors: [],
      advisories: transitioned.advisories ?? watchdogAdvisories(transitioned.activeCandidate, projection.supervisionPolicy),
    };
  } catch (error) {
    return {
      ok: false,
      domain: options.domain,
      action: options.action,
      errors: [{ code: error?.code ?? 'PROGRAM_STEP_FAILED', message: error instanceof Error ? error.message : String(error) }],
    };
  }
}

const ACTIVE_CANDIDATES_KEY = 'activeCandidates';

export function runProgramStepCli(argv = process.argv.slice(2), root = process.cwd()) {
  const report = runProgramStep({ root, ...parseArguments(argv) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runProgramStepCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
