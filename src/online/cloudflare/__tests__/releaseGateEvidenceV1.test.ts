import { describe, expect, it } from 'vitest';
import {
  O4P_05C_RELEASE_GATE_IDS_V1,
  validateO4p05cReleaseGateEvidenceV1,
} from './releaseGateEvidenceV1';

const FINGERPRINT = 'a'.repeat(64);

function canonical(): Record<string, unknown> {
  return {
    kind: 'o4p-05c-release-gate-evidence-v1',
    schemaVersion: 1,
    semanticFingerprint: FINGERPRINT,
    rulesetId: 'mtg-cr-2026-06-19',
    gates: [
      { gateId: 'privacy', sourceMilestone: 'O4P-03C', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { playerAudienceCount: 4, tableAudienceCount: 1, crossAudienceLeakCount: 0 } },
      { gateId: 'recovery', sourceMilestone: 'O4P-03D', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { checkpointRevision: 64, currentRevision: 96, replaySuffixLength: 32, rejectedRecoveryWriteCount: 0 } },
      { gateId: 'load', sourceMilestone: 'O4P-03D', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { acceptedCommandCount: 96, seatCommandCounts: [24, 24, 24, 24], unexpectedErrorCount: 0 } },
      { gateId: 'security', sourceMilestone: 'O4P-03C', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { authorities: ['host', 'seat', 'table', 'spectator'], expiredCapabilityRejected: true, retiredCapabilityRejected: true, crossRoleRejected: true, leaseConflictRejected: true } },
      { gateId: 'observability', sourceMilestone: 'O4P-03D', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { tailEventCount: 16, recoveryFactCount: 122, tailErrorCount: 0, tailExceptionCount: 0, tailParseFailureCount: 0, tailFactViolationCount: 0 } },
      { gateId: 'information-leakage', sourceMilestone: 'O4P-03C+O4P-03D', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { capabilityLeakCount: 0, capabilityFragmentLeakCount: 0, crossAudiencePrivateLeakCount: 0, forbiddenLogFieldCount: 0 } },
      { gateId: 'long-room', sourceMilestone: 'O4P-03D', semanticFingerprint: FINGERPRINT, outcome: 'passed', facts: { revision: 96, idleDurationMs: 70_000, hibernationObserved: true, distinctDeploymentVersionObserved: true, postCloseHttpStatus: 200 } },
    ],
  };
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected record');
  return value as Record<string, unknown>;
}

function gates(input: Record<string, unknown>): Record<string, unknown>[] {
  const value = input.gates;
  if (!Array.isArray(value)) throw new Error('expected gates');
  return value.map(record);
}

function facts(input: Record<string, unknown>, index: number): Record<string, unknown> {
  return record(gates(input)[index]?.facts);
}

function clone(): Record<string, unknown> {
  return record(JSON.parse(JSON.stringify(canonical())) as unknown);
}

function issuePaths(input: unknown): readonly string[] {
  const result = validateO4p05cReleaseGateEvidenceV1(input);
  if (result.ok) throw new Error('expected rejection');
  return result.issues.map((entry) => `${entry.path}:${entry.code}`);
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

describe('O4P-05C release-gate evidence validator', () => {
  it('returns a fresh deeply frozen canonical aggregate without mutating input', () => {
    const input = canonical();
    const before = JSON.stringify(input);
    const result = validateO4p05cReleaseGateEvidenceV1(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(input);
    expect(result.value).not.toBe(input);
    expect(result.value.gates).not.toBe(input.gates);
    expectDeepFrozen(result);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it('rejects every quantitative gate threshold independently', () => {
    const mutations: ReadonlyArray<readonly [number, string, unknown]> = [
      [0, 'playerAudienceCount', 3], [0, 'tableAudienceCount', 0], [0, 'crossAudienceLeakCount', 1],
      [1, 'checkpointRevision', 63], [1, 'currentRevision', 95], [1, 'replaySuffixLength', 31], [1, 'rejectedRecoveryWriteCount', 1],
      [2, 'acceptedCommandCount', 95], [2, 'unexpectedErrorCount', 1],
      [3, 'expiredCapabilityRejected', false], [3, 'retiredCapabilityRejected', false], [3, 'crossRoleRejected', false], [3, 'leaseConflictRejected', false],
      [4, 'tailEventCount', 0], [4, 'recoveryFactCount', 0], [4, 'tailErrorCount', 1], [4, 'tailExceptionCount', 1], [4, 'tailParseFailureCount', 1], [4, 'tailFactViolationCount', 1],
      [5, 'capabilityLeakCount', 1], [5, 'capabilityFragmentLeakCount', 1], [5, 'crossAudiencePrivateLeakCount', 1], [5, 'forbiddenLogFieldCount', 1],
      [6, 'revision', 95], [6, 'idleDurationMs', 69_999], [6, 'hibernationObserved', false], [6, 'distinctDeploymentVersionObserved', false], [6, 'postCloseHttpStatus', 500],
    ];
    for (const [index, key, value] of mutations) {
      const input = clone();
      facts(input, index)[key] = value;
      expect(validateO4p05cReleaseGateEvidenceV1(input).ok, `${index}:${key}`).toBe(false);
    }
    for (const [index, key] of [[2, 'seatCommandCounts'], [3, 'authorities']] as const) {
      const input = clone();
      const values = facts(input, index)[key];
      if (!Array.isArray(values)) throw new Error('expected array fact');
      values[0] = index === 2 ? 23 : 'seat';
      expect(validateO4p05cReleaseGateEvidenceV1(input).ok, `${index}:${key}`).toBe(false);
    }
  });

  it('rejects ruleset, authority, outcome, gate order, duplicates, and fingerprint drift', () => {
    const rootDrift = clone();
    rootDrift.semanticFingerprint = FINGERPRINT.toUpperCase();
    rootDrift.rulesetId = 'latest';
    expect(issuePaths(rootDrift)).toEqual(expect.arrayContaining([
      '$.semanticFingerprint:INVALID_SEMANTIC_FINGERPRINT',
      '$.rulesetId:UNEXPECTED_VALUE',
    ]));

    const observationDrift = clone();
    gates(observationDrift)[0].sourceMilestone = 'O4P-03D';
    gates(observationDrift)[1].semanticFingerprint = 'b'.repeat(64);
    gates(observationDrift)[2].outcome = 'failed';
    expect(issuePaths(observationDrift)).toEqual(expect.arrayContaining([
      '$.gates[0].sourceMilestone:UNEXPECTED_VALUE',
      '$.gates[1].semanticFingerprint:UNEXPECTED_VALUE',
      '$.gates[2].outcome:UNEXPECTED_VALUE',
    ]));

    const reordered = clone();
    const candidateValues = reordered.gates;
    if (!Array.isArray(candidateValues)) throw new Error('expected gates');
    const values: unknown[] = candidateValues;
    const first = values[0];
    values[0] = values[1];
    values[1] = first;
    expect(issuePaths(reordered).some((entry) => entry.endsWith(':UNEXPECTED_VALUE'))).toBe(true);

    const duplicated = clone();
    gates(duplicated)[1].gateId = 'privacy';
    expect(issuePaths(duplicated)).toContain('$.gates[1].gateId:DUPLICATE_GATE');
    expect(O4P_05C_RELEASE_GATE_IDS_V1).toEqual(['privacy', 'recovery', 'load', 'security', 'observability', 'information-leakage', 'long-room']);
  });

  it('returns complete deterministic issues for missing, extra, and wrong values', () => {
    const input = clone();
    delete input.kind;
    input.extra = true;
    input.schemaVersion = 2;
    facts(input, 0).extra = 'x';
    const first = validateO4p05cReleaseGateEvidenceV1(input);
    const second = validateO4p05cReleaseGateEvidenceV1(input);
    expect(first).toEqual(second);
    expect(issuePaths(input)).toEqual(expect.arrayContaining([
      '$.extra:UNKNOWN_KEY',
      '$.kind:MISSING_KEY',
      '$.schemaVersion:UNEXPECTED_VALUE',
      '$.gates[0].facts.extra:UNKNOWN_KEY',
    ]));
    expectDeepFrozen(first);
  });

  it('rejects accessors and symbols without invoking hostile code', () => {
    const input = clone();
    let invoked = false;
    Object.defineProperty(input, 'kind', { enumerable: true, get: () => { invoked = true; throw new Error('must not run'); } });
    Object.defineProperty(input, Symbol('hostile'), { enumerable: true, value: 'x' });
    const paths = issuePaths(input);
    expect(invoked).toBe(false);
    expect(paths).toContain('$.kind:INVALID_DATA_PROPERTY');
    expect(paths).toContain('$:SYMBOL_KEY');
  });

  it('rejects sparse arrays, aliases, cycles, and unknown array properties', () => {
    const sparse = clone();
    const sparseGates = sparse.gates;
    if (!Array.isArray(sparseGates)) throw new Error('expected gates');
    Reflect.deleteProperty(sparseGates, '3');
    expect(issuePaths(sparse)).toContain('$.gates[3]:SPARSE_ARRAY');

    const alias = clone();
    gates(alias)[1].facts = gates(alias)[0].facts;
    expect(issuePaths(alias)).toContain('$.gates[1].facts:ALIAS_OR_CYCLE');

    const cyclic = clone();
    gates(cyclic)[0].facts = cyclic;
    expect(issuePaths(cyclic)).toContain('$.gates[0].facts:ALIAS_OR_CYCLE');

    const extra = clone();
    const extraGates = extra.gates;
    if (!Array.isArray(extraGates)) throw new Error('expected gates');
    Object.defineProperty(extraGates, 'named', { enumerable: true, value: true });
    expect(issuePaths(extra)).toContain('$.gates.named:UNKNOWN_KEY');
  });
});
