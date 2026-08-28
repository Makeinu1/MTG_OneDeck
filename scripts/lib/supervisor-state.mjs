import { createHash } from 'node:crypto';

export const ACTIVE_CANDIDATES_FIELD = 'activeCandidates';

export const AUTHORITY_KEYS = ['commit', 'deploy', 'localWrites', 'push', 'ship'];

export const COUNTER_KEYS = [
  'implementerLineages',
  'coldAuditorLineages',
  'auditWaitChains',
  'ciWaitChains',
  'correctionWaves',
  'fullChecks',
  'semanticPushes',
  'replacementPushes',
  'supervisorModelCycles',
  'supervisorUncachedInputTokens',
  'teamModelCycles',
  'teamUncachedInputTokens',
];

export const SUPPORTED_CANDIDATE_STATES = [
  'clean-baseline',
  'contract-frozen',
  'implementing',
  'audit-ready',
  'audit-repairable',
  'audit-failed-stop',
  'audited',
  'full-check-passed',
  'repair-required',
  'push-ready',
  'ci-passed',
  'shipped',
];

const LIMIT_KEYS = [
  'implementerLineages',
  'coldAuditorLineages',
  'auditWaitChains',
  'ciWaitChains',
  'correctionWaves',
  'fullChecks',
  'semanticPushes',
  'replacementPushes',
  'compactionsPerLineage',
  'freshContinuationsPerLineage',
  'supervisorModelCycles',
  'supervisorUncachedInputTokens',
  'teamModelCycles',
  'teamUncachedInputTokens',
];

const STRUCTURAL_COUNTER_KEYS = new Set([
  'implementerLineages',
  'coldAuditorLineages',
  'auditWaitChains',
  'ciWaitChains',
  'semanticPushes',
  'replacementPushes',
]);

const DEFAULT_LIMITS = {
  implementerLineages: 1,
  coldAuditorLineages: 1,
  auditWaitChains: 1,
  ciWaitChains: 1,
  correctionWaves: 2,
  fullChecks: 2,
  semanticPushes: 1,
  replacementPushes: 1,
  compactionsPerLineage: 2,
  freshContinuationsPerLineage: 1,
  supervisorModelCycles: 160,
  supervisorUncachedInputTokens: 1_000_000,
  teamModelCycles: 400,
  teamUncachedInputTokens: 1_600_000,
};

const GOV_58A_ID = 'GOV-CODEX-58A-2026-08';
const GOV_58A_OVERRIDE = {
  correctionWaves: 3,
  freshContinuationsPerLineage: 3,
  supervisorModelCycles: 360,
  supervisorUncachedInputTokens: 2_100_000,
  teamModelCycles: 620,
  teamUncachedInputTokens: 3_400_000,
};

const CANDIDATE_REQUIRED_KEYS = [
  'acceptanceFingerprint',
  'authority',
  'authoritySource',
  'baseSha',
  'counters',
  'domainId',
  'guardImpact',
  'id',
  'lineages',
  'state',
  'treeFingerprint',
  'version',
  'waitChains',
];

const CANDIDATE_OPTIONAL_KEYS = [
  'repairOf',
  'repairReason',
  'stopReason',
  'usageSnapshot',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sortedKeysEqual = (value, expected) =>
  isObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const exactNumericValues = (value, expected) =>
  sortedKeysEqual(value, Object.keys(expected)) &&
  Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);

export function parseLoopFields(text) {
  const fields = {};
  if (typeof text !== 'string') return fields;
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

export function parseCandidateRecords(loopStateText) {
  const fields = parseLoopFields(loopStateText);
  if (!(ACTIVE_CANDIDATES_FIELD in fields)) {
    return { records: null, errors: [{ code: 'MISSING_ACTIVE_CANDIDATE_RECORD' }] };
  }
  try {
    const records = JSON.parse(fields[ACTIVE_CANDIDATES_FIELD]);
    if (!Array.isArray(records)) {
      return { records: null, errors: [{ code: 'INVALID_ACTIVE_CANDIDATE_RECORD' }] };
    }
    return { records, errors: [] };
  } catch {
    return { records: null, errors: [{ code: 'MALFORMED_ACTIVE_CANDIDATE_RECORD' }] };
  }
}

export function replaceLoopField(text, key, value) {
  const line = `${key}: ${value}`;
  const lines = typeof text === 'string' ? text.split(/\r?\n/) : [];
  const index = lines.findIndex((candidate) => candidate.startsWith(`${key}:`));
  if (index >= 0) lines[index] = line;
  else {
    while (lines.length > 0 && lines.at(-1) === '') lines.pop();
    lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

export function computeAcceptanceFingerprint(entry) {
  return sha256(JSON.stringify({
    boundary: entry?.boundary ?? null,
    landingState: entry?.landingState ?? null,
    manualBoundary: entry?.manualBoundary ?? null,
    evidence: entry?.evidence ?? null,
  }));
}

export function resolveCandidateAuthority({ domain, planned, activeProgram }) {
  const errors = [];
  const domainOverride = domain?.authority;
  const plannedOverride = planned?.authority;
  const domainSource = domain?.authoritySource;
  const plannedSource = planned?.authoritySource;
  const hasAnyOverride = domainOverride !== undefined || plannedOverride !== undefined ||
    domainSource !== undefined || plannedSource !== undefined;
  let authority;
  let authoritySource;
  if (hasAnyOverride) {
    if (
      JSON.stringify(domainOverride) !== JSON.stringify(plannedOverride) ||
      domainSource !== plannedSource ||
      !isNonEmptyString(domainSource)
    ) {
      errors.push({ code: 'CANDIDATE_AUTHORITY_COLLECTION_MISMATCH' });
    }
    authority = domainOverride;
    authoritySource = domainSource;
  } else {
    authority = activeProgram?.authority;
    authoritySource = authority ? 'goalPolicy.activeProgram.authority' : null;
  }
  if (
    !sortedKeysEqual(authority, AUTHORITY_KEYS) ||
    AUTHORITY_KEYS.some((key) => typeof authority?.[key] !== 'boolean')
  ) {
    errors.push({ code: 'INVALID_CANDIDATE_AUTHORITY' });
  }
  if (!isNonEmptyString(authoritySource)) {
    errors.push({ code: 'UNTRACKED_CANDIDATE_AUTHORITY' });
  }
  return { authority: authority ?? null, authoritySource, errors };
}

export function findActiveSupervisedDomainId(ledger) {
  const policy = ledger?.goalPolicy?.supervisionPolicy;
  const domainIds = ledger?.goalPolicy?.activeProgram?.domainIds;
  if (!policy || !Array.isArray(domainIds)) return null;
  const enforcementIndex = domainIds.indexOf(policy.enforceFromDomainId);
  if (enforcementIndex < 0) return null;
  return domainIds.slice(enforcementIndex).find((domainId) => {
    const domain = ledger.domains?.find((entry) => entry?.id === domainId);
    const planned = ledger.plannedSequence?.find((entry) => entry?.domainId === domainId);
    return domain?.status !== 'shipped' || planned?.status !== 'shipped';
  }) ?? null;
}

function validateSupervisionPolicy(ledger, selectedDomainId) {
  const errors = [];
  const activeProgram = ledger?.goalPolicy?.activeProgram;
  const policy = ledger?.goalPolicy?.supervisionPolicy;
  if (policy === undefined) return { enforced: false, policy: null, errors };
  if (
    !isObject(policy) ||
    !sortedKeysEqual(policy, ['candidateOverrides', 'enforceFromDomainId', 'limits', 'version']) ||
    policy.version !== 1 ||
    !isNonEmptyString(policy.enforceFromDomainId) ||
    !sortedKeysEqual(policy.limits, LIMIT_KEYS) ||
    LIMIT_KEYS.some((key) => !Number.isSafeInteger(policy.limits?.[key]) || policy.limits[key] < 0) ||
    !exactNumericValues(policy.limits, DEFAULT_LIMITS) ||
    !sortedKeysEqual(policy.candidateOverrides, [GOV_58A_ID]) ||
    !sortedKeysEqual(policy.candidateOverrides?.[GOV_58A_ID], Object.keys(GOV_58A_OVERRIDE)) ||
    !exactNumericValues(policy.candidateOverrides?.[GOV_58A_ID], GOV_58A_OVERRIDE)
  ) {
    errors.push({ code: 'INVALID_SUPERVISION_POLICY' });
    return { enforced: true, policy: null, errors };
  }
  const domainIds = activeProgram?.domainIds;
  const enforcementIndex = Array.isArray(domainIds)
    ? domainIds.indexOf(policy.enforceFromDomainId)
    : -1;
  if (enforcementIndex < 0) errors.push({ code: 'UNKNOWN_SUPERVISION_ENFORCEMENT_DOMAIN' });
  const supervisedDomainId = findActiveSupervisedDomainId(ledger);
  const enforced = supervisedDomainId !== null;
  if (enforced && selectedDomainId !== supervisedDomainId) {
    errors.push({
      code: 'ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH',
      requestedDomainId: selectedDomainId,
      activeDomainId: supervisedDomainId,
    });
  }
  const resolvedPolicy = policy && supervisedDomainId
    ? {
        ...policy,
        defaultLimits: { ...policy.limits },
        limits: {
          ...policy.limits,
          ...(policy.candidateOverrides[supervisedDomainId] ?? {}),
        },
        appliedCandidateOverride: policy.candidateOverrides[supervisedDomainId] ?? null,
      }
    : policy;
  return { enforced, policy: resolvedPolicy, supervisedDomainId, errors };
}

function validateLineages(candidate, limits, errors) {
  if (!sortedKeysEqual(candidate.lineages, ['coldAuditor', 'implementer'])) {
    errors.push({ code: 'INVALID_CANDIDATE_LINEAGES', candidateId: candidate.id ?? null });
    return;
  }
  for (const [role, counterKey] of [
    ['implementer', 'implementerLineages'],
    ['coldAuditor', 'coldAuditorLineages'],
  ]) {
    const entries = candidate.lineages[role];
    if (!Array.isArray(entries)) {
      errors.push({ code: 'INVALID_CANDIDATE_LINEAGES', role, candidateId: candidate.id });
      continue;
    }
    const ids = new Set();
    for (const lineage of entries) {
      if (
        !sortedKeysEqual(lineage, ['compactions', 'freshContinuations', 'id']) ||
        !isNonEmptyString(lineage.id) ||
        !Number.isSafeInteger(lineage.compactions) || lineage.compactions < 0 ||
        !Number.isSafeInteger(lineage.freshContinuations) || lineage.freshContinuations < 0
      ) {
        errors.push({ code: 'INVALID_LINEAGE_RECORD', role, candidateId: candidate.id });
        continue;
      }
      if (ids.has(lineage.id)) errors.push({ code: 'DUPLICATE_LINEAGE_ID', role, lineageId: lineage.id });
      ids.add(lineage.id);
    }
    if (candidate.counters?.[counterKey] !== entries.length) {
      errors.push({ code: 'LINEAGE_COUNTER_MISMATCH', role, candidateId: candidate.id });
    }
  }
}

function validateWaitChains(candidate, errors) {
  if (!sortedKeysEqual(candidate.waitChains, ['audit', 'ci'])) {
    errors.push({ code: 'INVALID_WAIT_CHAINS', candidateId: candidate.id ?? null });
    return;
  }
  for (const [kind, counterKey] of [['audit', 'auditWaitChains'], ['ci', 'ciWaitChains']]) {
    const chains = candidate.waitChains[kind];
    if (!Array.isArray(chains) || chains.some((id) => !isNonEmptyString(id)) || new Set(chains).size !== chains.length) {
      errors.push({ code: 'INVALID_WAIT_CHAINS', kind, candidateId: candidate.id });
      continue;
    }
    if (candidate.counters?.[counterKey] !== chains.length) {
      errors.push({ code: 'WAIT_COUNTER_MISMATCH', kind, candidateId: candidate.id });
    }
  }
}

export function evaluateCandidateBudget(candidate, policy) {
  const errors = [];
  const advisories = [];
  const limits = policy?.limits;
  if (!limits) return { ok: false, errors: [{ code: 'MISSING_SUPERVISION_LIMITS' }] };
  if (!sortedKeysEqual(candidate?.counters, COUNTER_KEYS)) {
    errors.push({ code: 'INVALID_CANDIDATE_COUNTERS', candidateId: candidate?.id ?? null });
    return { ok: false, errors, advisories };
  }
  for (const key of COUNTER_KEYS) {
    const value = candidate.counters[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      errors.push({ code: 'INVALID_COUNTER_VALUE', counter: key, value });
      continue;
    }
    if (value > limits[key]) {
      const finding = { code: 'BUDGET_LIMIT_EXCEEDED', counter: key, value, limit: limits[key] };
      if (STRUCTURAL_COUNTER_KEYS.has(key)) errors.push(finding);
      else advisories.push({ ...finding, code: 'WATCHDOG_THRESHOLD_EXCEEDED' });
    }
  }
  for (const [role, lineages] of Object.entries(candidate.lineages ?? {})) {
    if (!Array.isArray(lineages)) continue;
    for (const lineage of lineages) {
      for (const [field, limitKey] of [
        ['compactions', 'compactionsPerLineage'],
        ['freshContinuations', 'freshContinuationsPerLineage'],
      ]) {
        if (lineage[field] > limits[limitKey]) {
          advisories.push({
            code: 'WATCHDOG_THRESHOLD_EXCEEDED',
            watchdog: limitKey,
            role,
            lineageId: lineage.id,
            value: lineage[field],
            limit: limits[limitKey],
          });
        }
      }
    }
  }
  return { ok: errors.length === 0, limits: { ...limits }, counters: { ...candidate.counters }, errors, advisories };
}

function validateCandidateShape(candidate, context, errors) {
  const keys = isObject(candidate) ? Object.keys(candidate).sort() : [];
  const allowed = new Set([...CANDIDATE_REQUIRED_KEYS, ...CANDIDATE_OPTIONAL_KEYS]);
  if (
    !isObject(candidate) ||
    CANDIDATE_REQUIRED_KEYS.some((key) => !(key in candidate)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    errors.push({ code: 'INVALID_ACTIVE_CANDIDATE_SHAPE', candidateId: candidate?.id ?? null });
    return;
  }
  if (
    candidate.version !== 1 ||
    !isNonEmptyString(candidate.id) ||
    !isNonEmptyString(candidate.domainId) ||
    !SUPPORTED_CANDIDATE_STATES.includes(candidate.state) ||
    !/^[0-9a-f]{40}$/.test(candidate.baseSha) ||
    !/^[0-9a-f]{64}$/.test(candidate.treeFingerprint) ||
    !/^[0-9a-f]{64}$/.test(candidate.acceptanceFingerprint)
  ) {
    errors.push({ code: 'INVALID_ACTIVE_CANDIDATE_FIELDS', candidateId: candidate.id ?? null });
  }
  if (!sortedKeysEqual(candidate.guardImpact, ['acknowledgement', 'reportFingerprint'])) {
    errors.push({ code: 'INVALID_GUARD_IMPACT_STATE', candidateId: candidate.id ?? null });
  } else if (
    candidate.guardImpact.reportFingerprint !== null &&
    !/^[0-9a-f]{64}$/.test(candidate.guardImpact.reportFingerprint)
  ) {
    errors.push({ code: 'INVALID_GUARD_IMPACT_FINGERPRINT', candidateId: candidate.id });
  }
  const authorityKeysValid = sortedKeysEqual(candidate.authority, AUTHORITY_KEYS) &&
    AUTHORITY_KEYS.every((key) => typeof candidate.authority[key] === 'boolean');
  if (!authorityKeysValid || !isNonEmptyString(candidate.authoritySource)) {
    errors.push({ code: 'INVALID_ACTIVE_CANDIDATE_AUTHORITY', candidateId: candidate.id ?? null });
  }
  validateLineages(candidate, context.policy.limits, errors);
  validateWaitChains(candidate, errors);
  errors.push(...evaluateCandidateBudget(candidate, context.policy).errors);
  const afterImplementation = !['clean-baseline', 'contract-frozen'].includes(candidate.state);
  if (afterImplementation && candidate.counters?.implementerLineages !== 1) {
    errors.push({ code: 'CANDIDATE_STATE_ROLE_MISMATCH', state: candidate.state, role: 'implementer' });
  }
  if (
    ['audit-repairable', 'audit-failed-stop', 'audited', 'full-check-passed', 'repair-required', 'push-ready', 'ci-passed', 'shipped'].includes(candidate.state) &&
    (candidate.counters?.coldAuditorLineages !== 1 || candidate.counters?.auditWaitChains !== 1)
  ) {
    errors.push({ code: 'CANDIDATE_STATE_AUDIT_MISMATCH', state: candidate.state });
  }
  if (
    ['full-check-passed', 'push-ready', 'ci-passed', 'shipped'].includes(candidate.state) &&
    candidate.counters?.fullChecks < 1
  ) {
    errors.push({ code: 'CANDIDATE_STATE_FULL_CHECK_MISMATCH', state: candidate.state });
  }
  if (
    ['ci-passed', 'shipped'].includes(candidate.state) &&
    (candidate.counters?.semanticPushes + candidate.counters?.replacementPushes < 1 || candidate.counters?.ciWaitChains !== 1)
  ) {
    errors.push({ code: 'CANDIDATE_STATE_CI_MISMATCH', state: candidate.state });
  }
  if (candidate.state === 'audit-failed-stop') {
    if (!isNonEmptyString(candidate.stopReason) || !isObject(candidate.usageSnapshot)) {
      errors.push({ code: 'INCOMPLETE_AUDIT_FAILED_STOP', candidateId: candidate.id });
    } else {
      const usageKeys = new Set([
        'supervisorModelCycles', 'supervisorUncachedInputTokens',
        'teamModelCycles', 'teamUncachedInputTokens',
      ]);
      if (!sortedKeysEqual(candidate.usageSnapshot, COUNTER_KEYS)) {
        errors.push({ code: 'AUDIT_STOP_USAGE_MISMATCH', candidateId: candidate.id });
      }
      for (const key of COUNTER_KEYS) {
        const snapshot = candidate.usageSnapshot[key];
        const current = candidate.counters?.[key];
        if (!Number.isSafeInteger(snapshot) || snapshot < 0 ||
            (usageKeys.has(key) ? snapshot > current : snapshot !== current)) {
          errors.push({ code: 'AUDIT_STOP_USAGE_MISMATCH', candidateId: candidate.id, counter: key });
        }
      }
    }
  }
}

export function buildSupervisorProjection({
  ledger,
  selectedDomainId,
  loopStateText,
  loopState,
  headSha,
  treeFingerprint,
}) {
  const errors = [];
  const policyResult = validateSupervisionPolicy(ledger, selectedDomainId);
  errors.push(...policyResult.errors);
  if (!policyResult.enforced) {
    return { enforced: false, policy: policyResult.policy, activeCandidate: null, permissionRequired: null, errors };
  }
  if (!policyResult.policy) {
    return { enforced: true, policy: null, activeCandidate: null, permissionRequired: null, errors };
  }
  const supervisedDomainId = policyResult.supervisedDomainId;
  const domain = ledger.domains?.find((entry) => entry?.id === supervisedDomainId);
  const planned = ledger.plannedSequence?.find((entry) => entry?.domainId === supervisedDomainId);
  const authority = resolveCandidateAuthority({ domain, planned, activeProgram: ledger.goalPolicy?.activeProgram });
  errors.push(...authority.errors);
  const parsed = parseCandidateRecords(loopStateText);
  errors.push(...parsed.errors);
  if (!parsed.records) {
    return { enforced: true, policy: policyResult.policy, activeCandidate: null, permissionRequired: null, errors };
  }
  const ids = new Set();
  let previous = null;
  for (const candidate of parsed.records) {
    validateCandidateShape(candidate, { policy: policyResult.policy }, errors);
    if (ids.has(candidate?.id)) errors.push({ code: 'DUPLICATE_CANDIDATE_ID', candidateId: candidate?.id ?? null });
    ids.add(candidate?.id);
    if (previous && isObject(previous.counters) && isObject(candidate?.counters)) {
      for (const key of COUNTER_KEYS) {
        if (Number.isSafeInteger(previous.counters[key]) && Number.isSafeInteger(candidate.counters[key]) && candidate.counters[key] < previous.counters[key]) {
          errors.push({ code: 'CUMULATIVE_COUNTER_DECREASE', counter: key, previous: previous.counters[key], current: candidate.counters[key] });
        }
      }
      if (candidate.repairOf !== previous.id || previous.state !== 'repair-required') {
        errors.push({ code: 'INVALID_REPAIR_CANDIDATE_CHAIN', candidateId: candidate.id ?? null });
      }
      if (
        JSON.stringify(candidate.authority) !== JSON.stringify(previous.authority) ||
        candidate.authoritySource !== previous.authoritySource ||
        candidate.acceptanceFingerprint !== previous.acceptanceFingerprint
      ) {
        errors.push({ code: 'REPAIR_CANDIDATE_SCOPE_CHANGED', candidateId: candidate.id ?? null });
      }
    }
    previous = candidate;
  }
  const activeRecords = parsed.records.filter((candidate) => candidate?.state !== 'repair-required');
  if (activeRecords.length !== 1) {
    errors.push({ code: activeRecords.length === 0 ? 'MISSING_ACTIVE_CANDIDATE' : 'MULTIPLE_ACTIVE_CANDIDATES', candidateIds: activeRecords.map((candidate) => candidate?.id ?? null) });
  }
  const activeCandidate = activeRecords.length === 1 ? activeRecords[0] : null;
  if (activeCandidate) {
    const expectedAcceptance = computeAcceptanceFingerprint(domain);
    if (activeCandidate.domainId !== supervisedDomainId) errors.push({ code: 'CANDIDATE_DOMAIN_MISMATCH' });
    if (loopState?.milestone !== activeCandidate.domainId) errors.push({ code: 'CANDIDATE_LOOP_MILESTONE_MISMATCH' });
    if (loopState?.step !== activeCandidate.state) errors.push({ code: 'CANDIDATE_LOOP_STATE_MISMATCH' });
    if (activeCandidate.baseSha !== loopState?.baseSha || activeCandidate.baseSha !== headSha) errors.push({ code: 'CANDIDATE_BASE_SHA_MISMATCH' });
    if (activeCandidate.treeFingerprint !== loopState?.treeFingerprint || activeCandidate.treeFingerprint !== treeFingerprint) errors.push({ code: 'CANDIDATE_TREE_FINGERPRINT_MISMATCH' });
    if (activeCandidate.acceptanceFingerprint !== expectedAcceptance) errors.push({ code: 'CANDIDATE_ACCEPTANCE_MISMATCH' });
    if (
      JSON.stringify(activeCandidate.authority) !== JSON.stringify(authority.authority) ||
      activeCandidate.authoritySource !== authority.authoritySource
    ) {
      errors.push({ code: 'CANDIDATE_AUTHORITY_MISMATCH' });
    }
  }
  const permissionRequired = activeCandidate
    ? Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, activeCandidate.authority[key] !== true]))
    : null;
  return {
    enforced: true,
    policy: policyResult.policy,
    activeCandidate,
    permissionRequired,
    records: parsed.records,
    advisories: activeCandidate ? evaluateCandidateBudget(activeCandidate, policyResult.policy).advisories : [],
    errors,
  };
}

export function emptyCandidateCounters() {
  return Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));
}

export function compactActiveCandidate(candidate) {
  if (!candidate) return null;
  const acknowledgement = candidate.guardImpact?.acknowledgement;
  return {
    ...candidate,
    guardImpact: {
      reportFingerprint: candidate.guardImpact?.reportFingerprint ?? null,
      acknowledged: acknowledgement !== null && acknowledgement !== undefined,
      acknowledgementFingerprint: acknowledgement === null || acknowledgement === undefined
        ? null
        : sha256(JSON.stringify(acknowledgement)),
    },
  };
}
