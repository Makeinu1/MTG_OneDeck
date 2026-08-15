export const O4P_05C_RELEASE_GATE_KIND_V1 = 'o4p-05c-release-gate-evidence-v1' as const;
export const O4P_05C_RELEASE_GATE_SCHEMA_VERSION_V1 = 1 as const;
export const O4P_05C_RELEASE_RULESET_ID_V1 = 'mtg-cr-2026-06-19' as const;

export const O4P_05C_RELEASE_GATE_IDS_V1 = Object.freeze([
  'privacy',
  'recovery',
  'load',
  'security',
  'observability',
  'information-leakage',
  'long-room',
] as const);

export type O4p05cReleaseGateIdV1 = (typeof O4P_05C_RELEASE_GATE_IDS_V1)[number];
export type O4p05cReleaseGateAuthorityV1 = 'O4P-03C' | 'O4P-03D' | 'O4P-03C+O4P-03D';

export const O4P_05C_RELEASE_GATE_AUTHORITIES_V1: Readonly<Record<O4p05cReleaseGateIdV1, O4p05cReleaseGateAuthorityV1>> =
  Object.freeze({
    privacy: 'O4P-03C',
    recovery: 'O4P-03D',
    load: 'O4P-03D',
    security: 'O4P-03C',
    observability: 'O4P-03D',
    'information-leakage': 'O4P-03C+O4P-03D',
    'long-room': 'O4P-03D',
  });

type ObservationV1<Gate extends O4p05cReleaseGateIdV1, Authority extends O4p05cReleaseGateAuthorityV1, Facts> = Readonly<{
  readonly gateId: Gate;
  readonly sourceMilestone: Authority;
  readonly semanticFingerprint: string;
  readonly outcome: 'passed';
  readonly facts: Readonly<Facts>;
}>;

export type O4p05cPrivacyFactsV1 = Readonly<{
  readonly playerAudienceCount: 4;
  readonly tableAudienceCount: 1;
  readonly crossAudienceLeakCount: 0;
}>;

export type O4p05cRecoveryFactsV1 = Readonly<{
  readonly checkpointRevision: 64;
  readonly currentRevision: 96;
  readonly replaySuffixLength: 32;
  readonly rejectedRecoveryWriteCount: 0;
}>;

export type O4p05cLoadFactsV1 = Readonly<{
  readonly acceptedCommandCount: 96;
  readonly seatCommandCounts: readonly [24, 24, 24, 24];
  readonly unexpectedErrorCount: 0;
}>;

export type O4p05cSecurityFactsV1 = Readonly<{
  readonly authorities: readonly ['host', 'seat', 'table', 'spectator'];
  readonly expiredCapabilityRejected: true;
  readonly retiredCapabilityRejected: true;
  readonly crossRoleRejected: true;
  readonly leaseConflictRejected: true;
}>;

export type O4p05cObservabilityFactsV1 = Readonly<{
  readonly tailEventCount: number;
  readonly recoveryFactCount: number;
  readonly tailErrorCount: 0;
  readonly tailExceptionCount: 0;
  readonly tailParseFailureCount: 0;
  readonly tailFactViolationCount: 0;
}>;

export type O4p05cInformationLeakageFactsV1 = Readonly<{
  readonly capabilityLeakCount: 0;
  readonly capabilityFragmentLeakCount: 0;
  readonly crossAudiencePrivateLeakCount: 0;
  readonly forbiddenLogFieldCount: 0;
}>;

export type O4p05cLongRoomFactsV1 = Readonly<{
  readonly revision: 96;
  readonly idleDurationMs: 70_000;
  readonly hibernationObserved: true;
  readonly distinctDeploymentVersionObserved: true;
  readonly postCloseHttpStatus: 200;
}>;

export type O4p05cReleaseGateObservationV1 =
  | ObservationV1<'privacy', 'O4P-03C', O4p05cPrivacyFactsV1>
  | ObservationV1<'recovery', 'O4P-03D', O4p05cRecoveryFactsV1>
  | ObservationV1<'load', 'O4P-03D', O4p05cLoadFactsV1>
  | ObservationV1<'security', 'O4P-03C', O4p05cSecurityFactsV1>
  | ObservationV1<'observability', 'O4P-03D', O4p05cObservabilityFactsV1>
  | ObservationV1<'information-leakage', 'O4P-03C+O4P-03D', O4p05cInformationLeakageFactsV1>
  | ObservationV1<'long-room', 'O4P-03D', O4p05cLongRoomFactsV1>;

export type O4p05cReleaseGateEvidenceV1 = Readonly<{
  readonly kind: typeof O4P_05C_RELEASE_GATE_KIND_V1;
  readonly schemaVersion: typeof O4P_05C_RELEASE_GATE_SCHEMA_VERSION_V1;
  readonly semanticFingerprint: string;
  readonly rulesetId: typeof O4P_05C_RELEASE_RULESET_ID_V1;
  readonly gates: readonly O4p05cReleaseGateObservationV1[];
}>;

export type O4p05cReleaseGateIssueV1 = Readonly<{
  readonly path: string;
  readonly code: string;
}>;

export type O4p05cReleaseGateValidationV1 =
  | Readonly<{ readonly ok: true; readonly value: O4p05cReleaseGateEvidenceV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly O4p05cReleaseGateIssueV1[] }>;

type DataRecord = Readonly<Record<string, unknown>>;

function issue(issues: O4p05cReleaseGateIssueV1[], path: string, code: string): void {
  issues.push(Object.freeze({ path, code }));
}

function inspectRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
  seen: WeakSet<object>,
  issues: O4p05cReleaseGateIssueV1[],
): DataRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    issue(issues, path, 'EXPECTED_RECORD');
    return null;
  }
  if (seen.has(value)) {
    issue(issues, path, 'ALIAS_OR_CYCLE');
    return null;
  }
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      issue(issues, path, 'SYMBOL_KEY');
      continue;
    }
    if (!expectedKeys.includes(key)) issue(issues, `${path}.${key}`, 'UNKNOWN_KEY');
  }
  const result: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined) {
      issue(issues, `${path}.${key}`, 'MISSING_KEY');
    } else if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      issue(issues, `${path}.${key}`, 'INVALID_DATA_PROPERTY');
    } else {
      result[key] = descriptor.value;
    }
  }
  return result;
}

function inspectArray(
  value: unknown,
  path: string,
  expectedLength: number,
  seen: WeakSet<object>,
  issues: O4p05cReleaseGateIssueV1[],
): readonly unknown[] | null {
  if (!Array.isArray(value)) {
    issue(issues, path, 'EXPECTED_ARRAY');
    return null;
  }
  if (seen.has(value)) {
    issue(issues, path, 'ALIAS_OR_CYCLE');
    return null;
  }
  seen.add(value);
  if (value.length !== expectedLength) issue(issues, `${path}.length`, 'WRONG_LENGTH');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      issue(issues, path, 'SYMBOL_KEY');
      continue;
    }
    if (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)) issue(issues, `${path}.${key}`, 'UNKNOWN_KEY');
  }
  const result: unknown[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined) {
      issue(issues, `${path}[${index}]`, 'SPARSE_ARRAY');
      result.push(undefined);
    } else if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      issue(issues, `${path}[${index}]`, 'INVALID_DATA_PROPERTY');
      result.push(undefined);
    } else {
      result.push(descriptor.value);
    }
  }
  return result;
}

function exact(value: unknown, expected: unknown, path: string, issues: O4p05cReleaseGateIssueV1[]): boolean {
  if (value !== expected) {
    issue(issues, path, 'UNEXPECTED_VALUE');
    return false;
  }
  return true;
}

function nonNegativeSafeInteger(value: unknown, path: string, issues: O4p05cReleaseGateIssueV1[]): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    issue(issues, path, 'EXPECTED_NON_NEGATIVE_SAFE_INTEGER');
    return false;
  }
  return true;
}

function positiveSafeInteger(value: unknown, path: string, issues: O4p05cReleaseGateIssueV1[]): value is number {
  if (!nonNegativeSafeInteger(value, path, issues)) return false;
  if (value === 0) {
    issue(issues, path, 'EXPECTED_POSITIVE_SAFE_INTEGER');
    return false;
  }
  return true;
}

function validateFacts(
  gateId: O4p05cReleaseGateIdV1,
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  issues: O4p05cReleaseGateIssueV1[],
): Readonly<Record<string, unknown>> | null {
  const schemas: Readonly<Record<O4p05cReleaseGateIdV1, readonly string[]>> = Object.freeze({
    privacy: Object.freeze(['playerAudienceCount', 'tableAudienceCount', 'crossAudienceLeakCount']),
    recovery: Object.freeze(['checkpointRevision', 'currentRevision', 'replaySuffixLength', 'rejectedRecoveryWriteCount']),
    load: Object.freeze(['acceptedCommandCount', 'seatCommandCounts', 'unexpectedErrorCount']),
    security: Object.freeze(['authorities', 'expiredCapabilityRejected', 'retiredCapabilityRejected', 'crossRoleRejected', 'leaseConflictRejected']),
    observability: Object.freeze(['tailEventCount', 'recoveryFactCount', 'tailErrorCount', 'tailExceptionCount', 'tailParseFailureCount', 'tailFactViolationCount']),
    'information-leakage': Object.freeze(['capabilityLeakCount', 'capabilityFragmentLeakCount', 'crossAudiencePrivateLeakCount', 'forbiddenLogFieldCount']),
    'long-room': Object.freeze(['revision', 'idleDurationMs', 'hibernationObserved', 'distinctDeploymentVersionObserved', 'postCloseHttpStatus']),
  });
  const record = inspectRecord(value, path, schemas[gateId], seen, issues);
  if (record === null) return null;
  switch (gateId) {
    case 'privacy':
      exact(record.playerAudienceCount, 4, `${path}.playerAudienceCount`, issues);
      exact(record.tableAudienceCount, 1, `${path}.tableAudienceCount`, issues);
      exact(record.crossAudienceLeakCount, 0, `${path}.crossAudienceLeakCount`, issues);
      break;
    case 'recovery':
      exact(record.checkpointRevision, 64, `${path}.checkpointRevision`, issues);
      exact(record.currentRevision, 96, `${path}.currentRevision`, issues);
      exact(record.replaySuffixLength, 32, `${path}.replaySuffixLength`, issues);
      exact(record.rejectedRecoveryWriteCount, 0, `${path}.rejectedRecoveryWriteCount`, issues);
      break;
    case 'load': {
      exact(record.acceptedCommandCount, 96, `${path}.acceptedCommandCount`, issues);
      const counts = inspectArray(record.seatCommandCounts, `${path}.seatCommandCounts`, 4, seen, issues);
      if (counts !== null) counts.forEach((count, index) => exact(count, 24, `${path}.seatCommandCounts[${index}]`, issues));
      exact(record.unexpectedErrorCount, 0, `${path}.unexpectedErrorCount`, issues);
      break;
    }
    case 'security': {
      const authorities = inspectArray(record.authorities, `${path}.authorities`, 4, seen, issues);
      const expected = ['host', 'seat', 'table', 'spectator'] as const;
      if (authorities !== null) authorities.forEach((authority, index) => exact(authority, expected[index], `${path}.authorities[${index}]`, issues));
      exact(record.expiredCapabilityRejected, true, `${path}.expiredCapabilityRejected`, issues);
      exact(record.retiredCapabilityRejected, true, `${path}.retiredCapabilityRejected`, issues);
      exact(record.crossRoleRejected, true, `${path}.crossRoleRejected`, issues);
      exact(record.leaseConflictRejected, true, `${path}.leaseConflictRejected`, issues);
      break;
    }
    case 'observability':
      positiveSafeInteger(record.tailEventCount, `${path}.tailEventCount`, issues);
      positiveSafeInteger(record.recoveryFactCount, `${path}.recoveryFactCount`, issues);
      exact(record.tailErrorCount, 0, `${path}.tailErrorCount`, issues);
      exact(record.tailExceptionCount, 0, `${path}.tailExceptionCount`, issues);
      exact(record.tailParseFailureCount, 0, `${path}.tailParseFailureCount`, issues);
      exact(record.tailFactViolationCount, 0, `${path}.tailFactViolationCount`, issues);
      break;
    case 'information-leakage':
      exact(record.capabilityLeakCount, 0, `${path}.capabilityLeakCount`, issues);
      exact(record.capabilityFragmentLeakCount, 0, `${path}.capabilityFragmentLeakCount`, issues);
      exact(record.crossAudiencePrivateLeakCount, 0, `${path}.crossAudiencePrivateLeakCount`, issues);
      exact(record.forbiddenLogFieldCount, 0, `${path}.forbiddenLogFieldCount`, issues);
      break;
    case 'long-room':
      exact(record.revision, 96, `${path}.revision`, issues);
      exact(record.idleDurationMs, 70_000, `${path}.idleDurationMs`, issues);
      exact(record.hibernationObserved, true, `${path}.hibernationObserved`, issues);
      exact(record.distinctDeploymentVersionObserved, true, `${path}.distinctDeploymentVersionObserved`, issues);
      exact(record.postCloseHttpStatus, 200, `${path}.postCloseHttpStatus`, issues);
      break;
  }
  return record;
}

function freezeObservation(
  gateId: O4p05cReleaseGateIdV1,
  semanticFingerprint: string,
  facts: Readonly<Record<string, unknown>>,
): O4p05cReleaseGateObservationV1 {
  const clonedFacts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(facts)) {
    if (Array.isArray(value)) {
      const clonedArray: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) clonedArray.push(value[index] as unknown);
      clonedFacts[key] = Object.freeze(clonedArray);
    } else {
      clonedFacts[key] = value;
    }
  }
  return Object.freeze({
    gateId,
    sourceMilestone: O4P_05C_RELEASE_GATE_AUTHORITIES_V1[gateId],
    semanticFingerprint,
    outcome: 'passed',
    facts: Object.freeze(clonedFacts),
  }) as O4p05cReleaseGateObservationV1;
}

export function validateO4p05cReleaseGateEvidenceV1(input: unknown): O4p05cReleaseGateValidationV1 {
  const issues: O4p05cReleaseGateIssueV1[] = [];
  const seen = new WeakSet<object>();
  const root = inspectRecord(input, '$', ['kind', 'schemaVersion', 'semanticFingerprint', 'rulesetId', 'gates'], seen, issues);
  if (root === null) return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  exact(root.kind, O4P_05C_RELEASE_GATE_KIND_V1, '$.kind', issues);
  exact(root.schemaVersion, O4P_05C_RELEASE_GATE_SCHEMA_VERSION_V1, '$.schemaVersion', issues);
  const fingerprint = typeof root.semanticFingerprint === 'string' ? root.semanticFingerprint : '';
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) issue(issues, '$.semanticFingerprint', 'INVALID_SEMANTIC_FINGERPRINT');
  exact(root.rulesetId, O4P_05C_RELEASE_RULESET_ID_V1, '$.rulesetId', issues);
  const gates = inspectArray(root.gates, '$.gates', O4P_05C_RELEASE_GATE_IDS_V1.length, seen, issues);
  const canonical: O4p05cReleaseGateObservationV1[] = [];
  const observedGateIds = new Set<string>();
  if (gates !== null) {
    for (let index = 0; index < O4P_05C_RELEASE_GATE_IDS_V1.length; index += 1) {
      const path = `$.gates[${index}]`;
      const observation = inspectRecord(gates[index], path, ['gateId', 'sourceMilestone', 'semanticFingerprint', 'outcome', 'facts'], seen, issues);
      if (observation === null) continue;
      const expectedGate = O4P_05C_RELEASE_GATE_IDS_V1[index];
      const actualGate = observation.gateId;
      if (typeof actualGate === 'string') {
        if (observedGateIds.has(actualGate)) issue(issues, `${path}.gateId`, 'DUPLICATE_GATE');
        observedGateIds.add(actualGate);
      }
      exact(actualGate, expectedGate, `${path}.gateId`, issues);
      exact(observation.sourceMilestone, O4P_05C_RELEASE_GATE_AUTHORITIES_V1[expectedGate], `${path}.sourceMilestone`, issues);
      exact(observation.semanticFingerprint, fingerprint, `${path}.semanticFingerprint`, issues);
      exact(observation.outcome, 'passed', `${path}.outcome`, issues);
      const facts = validateFacts(expectedGate, observation.facts, `${path}.facts`, seen, issues);
      if (facts !== null) canonical.push(freezeObservation(expectedGate, fingerprint, facts));
    }
  }
  if (issues.length > 0 || canonical.length !== O4P_05C_RELEASE_GATE_IDS_V1.length) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  const value: O4p05cReleaseGateEvidenceV1 = Object.freeze({
    kind: O4P_05C_RELEASE_GATE_KIND_V1,
    schemaVersion: O4P_05C_RELEASE_GATE_SCHEMA_VERSION_V1,
    semanticFingerprint: fingerprint,
    rulesetId: O4P_05C_RELEASE_RULESET_ID_V1,
    gates: Object.freeze(canonical),
  });
  return Object.freeze({ ok: true, value });
}
