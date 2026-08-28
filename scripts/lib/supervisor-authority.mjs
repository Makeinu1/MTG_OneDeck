import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { readSessionUsageReceipt } from '../codex-usage.mjs';
import { COUNTER_KEYS } from './supervisor-state.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isObject(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};

export const stableJson = (value) => JSON.stringify(stableValue(value));

export function receiptPlanMeaning(value) {
  if (!isObject(value)) return null;
  const supervisor = value.supervisor;
  const participants = value.participants;
  if (!isObject(supervisor) || !Array.isArray(participants)) return null;
  return {
    baseline: structuredClone(value.baseline),
    supervisor: { sessionId: supervisor.sessionId, role: supervisor.role },
    participants: participants.map((source) => ({ sessionId: source?.sessionId, role: source?.role })),
  };
}

export function receiptPlanMatchesAnchor(value, anchorReceipt) {
  const meaning = receiptPlanMeaning(value);
  const anchor = receiptPlanMeaning(anchorReceipt);
  return meaning !== null && anchor !== null && stableJson(meaning) === stableJson(anchor);
}

export function supervisorAuthorityPath(domainId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(domainId)) throw new Error('Unsafe supervisor domain id');
  return `research/cr-grounding/supervisor-events/${domainId}.json`;
}

export function hashSupervisorEvent(event) {
  const { eventHash: _eventHash, ...payload } = event;
  return sha256(stableJson(payload));
}

const receiptSourceKeys = ['byteLength', 'prefixSha256', 'role', 'sessionId'];
const receiptPlanSourceKeys = ['role', 'sessionId'];
const RECEIPT_ROLES = ['supervisor', 'implementer', 'cold-auditor', 'team', 'ci-wait'];

function readVerifiedSource(source, sessionsRoot, { requireCurrent = false } = {}) {
  if (
    !exactKeys(source, receiptSourceKeys) ||
    !UUID.test(source.sessionId) ||
    !RECEIPT_ROLES.includes(source.role) ||
    !Number.isSafeInteger(source.byteLength) || source.byteLength <= 0 ||
    !/^[0-9a-f]{64}$/.test(source.prefixSha256)
  ) throw new Error('INVALID_USAGE_RECEIPT_SOURCE');
  const resolved = readSessionUsageReceipt(source.sessionId, sessionsRoot, source.byteLength);
  if (resolved.prefixSha256 !== source.prefixSha256) throw new Error('USAGE_RECEIPT_HASH_MISMATCH');
  if (requireCurrent && resolved.byteLength !== resolved.currentByteLength) throw new Error('STALE_USAGE_RECEIPT');
  return resolved.report;
}

function measuredObserved(supervisorReport, participants, baseline) {
  const supervisorModelCycles = supervisorReport.modelCycles - baseline.modelCycles;
  const supervisorUncachedInputTokens = supervisorReport.usage.uncachedInputTokens - baseline.uncachedInputTokens;
  return {
    supervisorModelCycles,
    supervisorUncachedInputTokens,
    teamModelCycles: supervisorModelCycles + participants.reduce((sum, item) => sum + item.report.modelCycles, 0),
    teamUncachedInputTokens: supervisorUncachedInputTokens + participants.reduce((sum, item) => sum + item.report.usage.uncachedInputTokens, 0),
    cachedInputTokens: supervisorReport.usage.cachedInputTokens + participants.reduce((sum, item) => sum + item.report.usage.cachedInputTokens, 0),
    totalInputTokens: supervisorReport.usage.inputTokens + participants.reduce((sum, item) => sum + item.report.usage.inputTokens, 0),
  };
}

export function deriveUsageReceipt(plan, {
  sessionsRoot = join(homedir(), '.codex', 'sessions'),
  contextFingerprint,
} = {}) {
  if (
    !exactKeys(plan, ['baseline', 'participants', 'supervisor', 'version']) ||
    plan.version !== 1 ||
    !exactKeys(plan.baseline, ['modelCycles', 'uncachedInputTokens']) ||
    !Number.isSafeInteger(plan.baseline.modelCycles) || plan.baseline.modelCycles < 0 ||
    !Number.isSafeInteger(plan.baseline.uncachedInputTokens) || plan.baseline.uncachedInputTokens < 0 ||
    !exactKeys(plan.supervisor, receiptPlanSourceKeys) ||
    plan.supervisor.role !== 'supervisor' || !UUID.test(plan.supervisor.sessionId) ||
    !Array.isArray(plan.participants) || plan.participants.length === 0 ||
    plan.participants.some((source) =>
      !exactKeys(source, receiptPlanSourceKeys) ||
      !UUID.test(source.sessionId) ||
      !RECEIPT_ROLES.includes(source.role) ||
      source.role === 'supervisor')
  ) throw new Error('INVALID_USAGE_RECEIPT_PLAN');
  const ids = [plan.supervisor.sessionId, ...plan.participants.map((source) => source.sessionId)];
  if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_USAGE_RECEIPT_SESSION');
  if (!/^[0-9a-f]{64}$/.test(contextFingerprint)) throw new Error('USAGE_RECEIPT_CONTEXT_MISMATCH');

  const resolveSource = (source) => {
    const resolved = readSessionUsageReceipt(source.sessionId, sessionsRoot);
    return {
      source: {
        sessionId: source.sessionId,
        role: source.role,
        byteLength: resolved.byteLength,
        prefixSha256: resolved.prefixSha256,
      },
      report: resolved.report,
    };
  };
  const supervisor = resolveSource(plan.supervisor);
  const participants = plan.participants.map(resolveSource);
  const receipt = {
    version: 1,
    contextFingerprint,
    baseline: structuredClone(plan.baseline),
    supervisor: supervisor.source,
    participants: participants.map((entry) => entry.source),
    observed: measuredObserved(supervisor.report, participants, plan.baseline),
  };
  // Prefixes are re-read only for their exact hashes and contents. They are
  // intentionally not required to remain the session's terminal byte length:
  // later append-only JSONL growth makes this receipt historical, not stale.
  const verified = verifyUsageReceipt(receipt, {
    sessionsRoot,
    expectedContextFingerprint: contextFingerprint,
    requireCurrent: false,
  });
  if (!verified.ok) {
    const error = new Error(JSON.stringify(verified.errors));
    error.code = 'INVALID_DERIVED_USAGE_RECEIPT';
    throw error;
  }
  return { receipt, verified };
}

export function verifyUsageReceipt(receipt, {
  sessionsRoot = join(homedir(), '.codex', 'sessions'),
  expectedContextFingerprint,
  requireCurrent = false,
} = {}) {
  const errors = [];
  if (!exactKeys(receipt, ['baseline', 'contextFingerprint', 'observed', 'participants', 'supervisor', 'version']) || receipt.version !== 1) {
    return { ok: false, errors: [{ code: 'INVALID_USAGE_RECEIPT' }] };
  }
  if (receipt.contextFingerprint !== expectedContextFingerprint || !/^[0-9a-f]{64}$/.test(receipt.contextFingerprint)) {
    errors.push({ code: 'USAGE_RECEIPT_CONTEXT_MISMATCH' });
  }
  if (!exactKeys(receipt.baseline, ['modelCycles', 'uncachedInputTokens']) ||
      !Number.isSafeInteger(receipt.baseline.modelCycles) || receipt.baseline.modelCycles < 0 ||
      !Number.isSafeInteger(receipt.baseline.uncachedInputTokens) || receipt.baseline.uncachedInputTokens < 0) {
    errors.push({ code: 'INVALID_USAGE_RECEIPT_BASELINE' });
  }
  if (!Array.isArray(receipt.participants) || receipt.participants.length === 0) {
    errors.push({ code: 'MISSING_USAGE_RECEIPT_PARTICIPANTS' });
  }
  if (
    !exactKeys(receipt.observed, [
      'cachedInputTokens', 'supervisorModelCycles', 'supervisorUncachedInputTokens',
      'teamModelCycles', 'teamUncachedInputTokens', 'totalInputTokens',
    ]) || Object.values(receipt.observed ?? {}).some((value) => !Number.isSafeInteger(value) || value < 0)
  ) errors.push({ code: 'INVALID_USAGE_RECEIPT_OBSERVED' });
  let supervisorReport = null;
  const participants = [];
  try {
    if (receipt.supervisor?.role !== 'supervisor') throw new Error('INVALID_SUPERVISOR_RECEIPT_ROLE');
    supervisorReport = readVerifiedSource(receipt.supervisor, sessionsRoot, { requireCurrent });
    for (const source of receipt.participants ?? []) {
      if (source.role === 'supervisor') throw new Error('DUPLICATE_SUPERVISOR_RECEIPT');
      participants.push({ source, report: readVerifiedSource(source, sessionsRoot, { requireCurrent }) });
    }
  } catch (error) {
    errors.push({ code: error instanceof Error ? error.message : 'USAGE_RECEIPT_SOURCE_FAILED' });
  }
  const ids = [receipt.supervisor?.sessionId, ...(receipt.participants ?? []).map((source) => source.sessionId)];
  if (new Set(ids).size !== ids.length) errors.push({ code: 'DUPLICATE_USAGE_RECEIPT_SESSION' });
  if (supervisorReport) {
    for (const { source, report } of participants) {
      if (
        report.sessionId !== source.sessionId ||
        report.sourceKind !== 'subagent' ||
        report.parentSessionId !== supervisorReport.sessionId ||
        report.inheritedContext !== false
      ) errors.push({ code: 'USAGE_RECEIPT_LINEAGE_MISMATCH', sessionId: source.sessionId });
    }
    const observed = measuredObserved(supervisorReport, participants, receipt.baseline);
    if (Object.values(observed).some((value) => !Number.isSafeInteger(value) || value < 0) ||
        observed.supervisorModelCycles === 0 || observed.supervisorUncachedInputTokens === 0 ||
        observed.teamModelCycles === 0 || observed.teamUncachedInputTokens === 0) {
      errors.push({ code: 'ZERO_OR_INVALID_USAGE_RECEIPT' });
    }
    if (stableJson(receipt.observed) !== stableJson(observed)) errors.push({ code: 'USAGE_RECEIPT_OBSERVED_MISMATCH' });
    return {
      ok: errors.length === 0,
      errors,
      observed,
      supervisor: supervisorReport,
      participants,
    };
  }
  return { ok: false, errors };
}

export function createSupervisorEvent({ sequence, action, actorSessionId, actorRole, candidate, receipt, previousHash = null, reason = null }) {
  const event = {
    sequence,
    action,
    actorSessionId,
    actorRole,
    reason,
    previousHash,
    candidate: structuredClone(candidate),
    receipt: structuredClone(receipt),
    eventHash: null,
  };
  event.eventHash = hashSupervisorEvent(event);
  return event;
}

export function createSupervisorBootstrap({ candidate, receipt, actorSessionId, actorRole = 'implementer' }) {
  return {
    version: 1,
    domainId: candidate.domainId,
    candidateId: candidate.id,
    events: [createSupervisorEvent({
      sequence: 0,
      action: 'bootstrap',
      actorSessionId,
      actorRole,
      candidate,
      receipt,
      previousHash: null,
      reason: 'migration-from-loop-state',
    })],
  };
}

function compareCandidateHistory(previousEvent, event, errors) {
  const previous = previousEvent.candidate;
  const current = event.candidate;
  for (const key of COUNTER_KEYS) {
    if (current.counters?.[key] < previous.counters?.[key]) {
      errors.push({ code: 'TRACKED_COUNTER_DECREASE', counter: key });
    }
  }
  if (
    previous.state === 'audit-failed-stop' && current.state !== 'audit-failed-stop' &&
    !(
      (event.action === 'user-reopen' && typeof event.reason === 'string' && event.reason.startsWith('user-ruling:')) ||
      (event.action === 'repair-resume' && current.state === 'audit-repairable' &&
        typeof event.reason === 'string' && event.reason.startsWith('same-scope:') && event.reason.length > 'same-scope:'.length)
    )
  ) errors.push({ code: 'TRACKED_AUDIT_STOP_LAUNDERING' });
  if (current.state === 'repair-required') {
    if (
      event.action !== 'require-repair' ||
      !['audited', 'full-check-passed', 'push-ready', 'ci-passed'].includes(previous.state) ||
      !['release-full-check', 'ci-environment', 'guard-impact'].includes(current.repairReason) ||
      current.repairReason !== event.reason
    ) errors.push({ code: 'TRACKED_INVALID_REPAIR_ORIGIN' });
  }
  if (current.id !== previous.id) {
    if (event.action !== 'derive-repair' || previous.state !== 'repair-required' || current.repairOf !== previous.id) {
      errors.push({ code: 'TRACKED_CANDIDATE_ID_RESET' });
    }
  }
  if (
    current.acceptanceFingerprint !== previous.acceptanceFingerprint ||
    stableJson(current.authority) !== stableJson(previous.authority) ||
    current.authoritySource !== previous.authoritySource
  ) errors.push({ code: 'TRACKED_CANDIDATE_SCOPE_CHANGED' });
}

const IMPLEMENTER_ACTIONS = new Set([
  'local-write', 'start-implementation', 'start-correction',
  'compact-implementer', 'continue-implementer',
]);
const AUDITOR_ACTIONS = new Set([
  'audit', 'start-audit', 'start-audit-wait',
  'compact-cold-auditor', 'continue-cold-auditor',
]);

function expectedActorRole(action) {
  if (IMPLEMENTER_ACTIONS.has(action)) return 'implementer';
  if (AUDITOR_ACTIONS.has(action)) return 'cold-auditor';
  return 'supervisor';
}

function verifyEventActorAndUsage(event, receipt, errors) {
  if (!receipt.ok || !receipt.observed) return;
  const sources = new Map([
    [event.receipt.supervisor.sessionId, 'supervisor'],
    ...event.receipt.participants.map((source) => [source.sessionId, source.role]),
  ]);
  const verifiedRole = sources.get(event.actorSessionId);
  if (
    verifiedRole !== event.actorRole ||
    event.actorRole !== expectedActorRole(event.action)
  ) errors.push({ code: 'TRACKED_EVENT_ACTOR_MISMATCH', sequence: event.sequence });
  for (const key of ['supervisorModelCycles', 'supervisorUncachedInputTokens', 'teamModelCycles', 'teamUncachedInputTokens']) {
    if (event.candidate.counters?.[key] !== receipt.observed[key]) {
      errors.push({ code: 'TRACKED_USAGE_COUNTER_MISMATCH', sequence: event.sequence, counter: key });
    }
  }
  for (const lineage of event.candidate.lineages?.implementer ?? []) {
    if (sources.get(lineage.id) !== 'implementer') errors.push({ code: 'UNVERIFIED_IMPLEMENTER_LINEAGE', sequence: event.sequence, lineageId: lineage.id });
  }
  for (const lineage of event.candidate.lineages?.coldAuditor ?? []) {
    if (sources.get(lineage.id) !== 'cold-auditor') errors.push({ code: 'UNVERIFIED_AUDITOR_LINEAGE', sequence: event.sequence, lineageId: lineage.id });
  }
  for (const waitId of event.candidate.waitChains?.audit ?? []) {
    if (sources.get(waitId) !== 'cold-auditor') errors.push({ code: 'UNVERIFIED_AUDIT_WAIT', sequence: event.sequence, waitId });
  }
  for (const waitId of event.candidate.waitChains?.ci ?? []) {
    if (!sources.has(waitId) || !['supervisor', 'ci-wait'].includes(sources.get(waitId))) {
      errors.push({ code: 'UNVERIFIED_CI_WAIT', sequence: event.sequence, waitId });
    }
  }
}

function lineageValue(candidate, role, id, key) {
  return candidate.lineages?.[role]?.find((entry) => entry.id === id)?.[key];
}

function validateActorBoundDelta(previousEvent, event, errors) {
  if (!previousEvent) return;
  const previous = previousEvent.candidate;
  const current = event.candidate;
  const actor = event.actorSessionId;
  const checks = {
    'compact-implementer': ['implementer', 'compactions'],
    'continue-implementer': ['implementer', 'freshContinuations'],
    'compact-cold-auditor': ['coldAuditor', 'compactions'],
    'continue-cold-auditor': ['coldAuditor', 'freshContinuations'],
  };
  const check = checks[event.action];
  if (check) {
    const [role, key] = check;
    if (lineageValue(current, role, actor, key) !== lineageValue(previous, role, actor, key) + 1) {
      errors.push({ code: 'TRACKED_LINEAGE_EVENT_MISMATCH', sequence: event.sequence });
    }
  }
  if (['local-write', 'start-implementation', 'start-correction'].includes(event.action) &&
      !current.lineages?.implementer?.some((entry) => entry.id === actor)) {
    errors.push({ code: 'TRACKED_LINEAGE_EVENT_MISMATCH', sequence: event.sequence });
  }
  if (['audit', 'start-audit'].includes(event.action) &&
      !current.lineages?.coldAuditor?.some((entry) => entry.id === actor)) {
    errors.push({ code: 'TRACKED_LINEAGE_EVENT_MISMATCH', sequence: event.sequence });
  }
  if (['audit', 'start-audit-wait'].includes(event.action) && !current.waitChains?.audit?.includes(actor)) {
    errors.push({ code: 'TRACKED_WAIT_EVENT_MISMATCH', sequence: event.sequence });
  }
  if (event.action === 'start-ci-wait' && !current.waitChains?.ci?.includes(actor)) {
    errors.push({ code: 'TRACKED_WAIT_EVENT_MISMATCH', sequence: event.sequence });
  }
}

export function verifySupervisorAuthority({
  authority,
  headAuthority = null,
  loopCandidate,
  sessionsRoot,
  requireCurrentReceipt = false,
  completeAutonomy = false,
}) {
  const errors = [];
  if (!exactKeys(authority, ['candidateId', 'domainId', 'events', 'version']) || authority.version !== 1 || !Array.isArray(authority.events) || authority.events.length === 0) {
    return { ok: false, errors: [{ code: 'INVALID_TRACKED_SUPERVISOR_AUTHORITY' }] };
  }
  if (headAuthority) {
    if (!Array.isArray(headAuthority.events) || authority.events.length < headAuthority.events.length) {
      errors.push({ code: 'TRACKED_SUPERVISOR_HISTORY_TRUNCATED' });
    } else if (stableJson(authority.events.slice(0, headAuthority.events.length)) !== stableJson(headAuthority.events)) {
      errors.push({ code: 'TRACKED_SUPERVISOR_HISTORY_REWRITTEN' });
    }
  }
  let previousEvent = null;
  let latestReceipt = null;
  const receiptPlanAnchor = authority.events[0]?.receipt;
  for (let index = 0; index < authority.events.length; index += 1) {
    const event = authority.events[index];
    if (!exactKeys(event, ['action', 'actorRole', 'actorSessionId', 'candidate', 'eventHash', 'previousHash', 'reason', 'receipt', 'sequence']) ||
        event.sequence !== index || event.previousHash !== (previousEvent?.eventHash ?? null) ||
        event.eventHash !== hashSupervisorEvent(event) || !UUID.test(event.actorSessionId)) {
      errors.push({ code: 'INVALID_TRACKED_SUPERVISOR_EVENT', sequence: index });
    }
    if (!receiptPlanMatchesAnchor(event.receipt, receiptPlanAnchor)) {
      errors.push({ code: 'TRACKED_RECEIPT_PLAN_MISMATCH', sequence: index });
    }
    if (event.action === 'repair-resume' && !completeAutonomy) {
      errors.push({ code: 'TRACKED_REPAIR_RESUME_REQUIRES_COMPLETE_AUTONOMY', sequence: index });
    }
    const receipt = verifyUsageReceipt(event.receipt, {
      sessionsRoot,
      expectedContextFingerprint: event.candidate?.treeFingerprint,
      requireCurrent: requireCurrentReceipt && index === authority.events.length - 1,
    });
    errors.push(...receipt.errors.map((error) => ({ ...error, sequence: index })));
    verifyEventActorAndUsage(event, receipt, errors);
    if (previousEvent) compareCandidateHistory(previousEvent, event, errors);
    validateActorBoundDelta(previousEvent, event, errors);
    latestReceipt = receipt;
    previousEvent = event;
  }
  const latest = authority.events.at(-1);
  if (authority.domainId !== loopCandidate?.domainId || authority.candidateId !== latest?.candidate?.id || stableJson(latest?.candidate) !== stableJson(loopCandidate)) {
    errors.push({ code: 'TRACKED_SUPERVISOR_LOOP_MISMATCH' });
  }
  const receipt = latestReceipt ?? { ok: false, errors: [{ code: 'MISSING_USAGE_RECEIPT' }] };
  return { ok: errors.length === 0, errors, latestEvent: latest, receipt };
}

export function readTrackedSupervisorAuthority(root, domainId) {
  const relativePath = supervisorAuthorityPath(domainId);
  const path = resolve(root, relativePath);
  if (!existsSync(path)) return { relativePath, authority: null, headAuthority: null };
  const authority = JSON.parse(readFileSync(path, 'utf8'));
  let headAuthority = null;
  try {
    headAuthority = JSON.parse(execFileSync('git', ['show', `HEAD:${relativePath}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch {
    // An exact bootstrap has no HEAD predecessor yet.
  }
  return { relativePath, authority, headAuthority };
}
