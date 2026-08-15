import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateO4p05cReleaseGateEvidenceV1 } from './releaseGateEvidenceV1';

const ROOT = resolve(import.meta.dirname, '../../../..');
const AUTHORITY_PATHS = Object.freeze([
  'wrangler.jsonc',
  'research/cr-grounding/archive/o4p-03c-cold-audit-record-2026-08-14.md',
  'research/cr-grounding/archive/o4p-03d-cold-audit-record-2026-08-14.md',
  'scripts/online/o4p-03d-evidence.ts',
  'src/online/cloudflare/codec.ts',
  'src/online/cloudflare/facts.ts',
  'src/online/cloudflare/index.ts',
  'src/online/cloudflare/outbox.ts',
  'src/online/cloudflare/persistence.ts',
  'src/online/cloudflare/runtime.ts',
  'src/online/cloudflare/security.ts',
  'src/online/cloudflare/support.ts',
  'src/online/cloudflare/types.ts',
  'src/online/cloudflare/websocket.ts',
  'src/online/cloudflare/worker.ts',
  'src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts',
  'src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts',
  'src/online/cloudflare/__tests__/evidenceHarnessV1.test.ts',
] as const);

function text(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function authorityFingerprint(): string {
  const material = AUTHORITY_PATHS.map((path) => {
    const digest = createHash('sha256').update(text(path)).digest('hex');
    return `${digest}  ${path}`;
  }).join('\n');
  return createHash('sha256').update(material).digest('hex');
}

function canonical(): Record<string, unknown> {
  const semanticFingerprint = authorityFingerprint();
  return {
    kind: 'o4p-05c-release-gate-evidence-v1',
    schemaVersion: 1,
    semanticFingerprint,
    rulesetId: 'mtg-cr-2026-06-19',
    gates: [
      { gateId: 'privacy', sourceMilestone: 'O4P-03C', semanticFingerprint, outcome: 'passed', facts: { playerAudienceCount: 4, tableAudienceCount: 1, crossAudienceLeakCount: 0 } },
      { gateId: 'recovery', sourceMilestone: 'O4P-03D', semanticFingerprint, outcome: 'passed', facts: { checkpointRevision: 64, currentRevision: 96, replaySuffixLength: 32, rejectedRecoveryWriteCount: 0 } },
      { gateId: 'load', sourceMilestone: 'O4P-03D', semanticFingerprint, outcome: 'passed', facts: { acceptedCommandCount: 96, seatCommandCounts: [24, 24, 24, 24], unexpectedErrorCount: 0 } },
      { gateId: 'security', sourceMilestone: 'O4P-03C', semanticFingerprint, outcome: 'passed', facts: { authorities: ['host', 'seat', 'table', 'spectator'], expiredCapabilityRejected: true, retiredCapabilityRejected: true, crossRoleRejected: true, leaseConflictRejected: true } },
      { gateId: 'observability', sourceMilestone: 'O4P-03D', semanticFingerprint, outcome: 'passed', facts: { tailEventCount: 16, recoveryFactCount: 122, tailErrorCount: 0, tailExceptionCount: 0, tailParseFailureCount: 0, tailFactViolationCount: 0 } },
      { gateId: 'information-leakage', sourceMilestone: 'O4P-03C+O4P-03D', semanticFingerprint, outcome: 'passed', facts: { capabilityLeakCount: 0, capabilityFragmentLeakCount: 0, crossAudiencePrivateLeakCount: 0, forbiddenLogFieldCount: 0 } },
      { gateId: 'long-room', sourceMilestone: 'O4P-03D', semanticFingerprint, outcome: 'passed', facts: { revision: 96, idleDurationMs: 70_000, hibernationObserved: true, distinctDeploymentVersionObserved: true, postCloseHttpStatus: 200 } },
    ],
  };
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected record');
  return value as Record<string, unknown>;
}

function gates(input: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(input.gates)) throw new Error('expected gates');
  return input.gates.map(record);
}

function facts(input: Record<string, unknown>, index: number): Record<string, unknown> {
  return record(gates(input)[index].facts);
}

function clone(): Record<string, unknown> {
  return record(JSON.parse(JSON.stringify(canonical())) as unknown);
}

function rejected(input: unknown): readonly string[] {
  const result = validateO4p05cReleaseGateEvidenceV1(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map(({ path, code }) => `${path}:${code}`);
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

describe('O4P-05C Judge release gates', () => {
  it('binds the shipped predecessor evidence into one common-fingerprint passing aggregate', () => {
    const securityRecord = text('research/cr-grounding/archive/o4p-03c-cold-audit-record-2026-08-14.md');
    expect(securityRecord).toMatch(/BLOCKER 0 \/ HIGH 0 \/ MEDIUM 0 \/ LOW 0/);
    expect(securityRecord).toMatch(/host\/seat\/table\/spectator/);
    expect(securityRecord).toMatch(/secret-free properties and values/);

    const productionRecord = text('research/cr-grounding/archive/o4p-03d-cold-audit-record-2026-08-14.md');
    for (const evidence of [
      /revision 96/,
      /checkpoint revision 64/,
      /replay suffix 32/,
      /70-second idle/,
      /hibernation observed/,
      /tail errors 0, exceptions 0, parse failures 0/,
      /HTTP 200/,
    ]) expect(productionRecord).toMatch(evidence);

    const input = canonical();
    const before = JSON.stringify(input);
    const result = validateO4p05cReleaseGateEvidenceV1(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.semanticFingerprint).toBe(authorityFingerprint());
    expect(result.value.gates.map(({ gateId }) => gateId)).toEqual([
      'privacy', 'recovery', 'load', 'security', 'observability', 'information-leakage', 'long-room',
    ]);
    expectDeepFrozen(result);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('fails every quantitative release claim when independently weakened', () => {
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
    const load = clone();
    const counts = facts(load, 2).seatCommandCounts;
    if (!Array.isArray(counts)) throw new Error('expected seat counts');
    counts[3] = 23;
    expect(validateO4p05cReleaseGateEvidenceV1(load).ok).toBe(false);
    const security = clone();
    const authorities = facts(security, 3).authorities;
    if (!Array.isArray(authorities)) throw new Error('expected authorities');
    authorities[0] = 'seat';
    expect(validateO4p05cReleaseGateEvidenceV1(security).ok).toBe(false);
  });

  it('rejects candidate, ruleset, authority, outcome, order, and duplication drift', () => {
    const input = clone();
    input.rulesetId = 'mtg-cr-latest';
    input.semanticFingerprint = ` ${authorityFingerprint()}`;
    gates(input)[0].sourceMilestone = 'O4P-03D';
    gates(input)[1].semanticFingerprint = 'b'.repeat(64);
    gates(input)[2].outcome = 'failed';
    expect(rejected(input)).toEqual(expect.arrayContaining([
      '$.semanticFingerprint:INVALID_SEMANTIC_FINGERPRINT',
      '$.rulesetId:UNEXPECTED_VALUE',
      '$.gates[0].sourceMilestone:UNEXPECTED_VALUE',
      '$.gates[1].semanticFingerprint:UNEXPECTED_VALUE',
      '$.gates[2].outcome:UNEXPECTED_VALUE',
    ]));

    const reordered = clone();
    const reorderedGates = reordered.gates;
    if (!Array.isArray(reorderedGates)) throw new Error('expected gates');
    const reorderedValues: unknown[] = reorderedGates;
    const first = reorderedValues[0];
    reorderedValues[0] = reorderedValues[1];
    reorderedValues[1] = first;
    expect(rejected(reordered).some((entry) => entry.endsWith(':UNEXPECTED_VALUE'))).toBe(true);

    const duplicate = clone();
    gates(duplicate)[1].gateId = 'privacy';
    expect(rejected(duplicate)).toContain('$.gates[1].gateId:DUPLICATE_GATE');
  });

  it('rejects missing/extra/hostile descriptors, symbols, sparse arrays, aliases, and cycles', () => {
    const shape = clone();
    delete shape.kind;
    shape.extra = true;
    facts(shape, 0).extra = true;
    expect(rejected(shape)).toEqual(expect.arrayContaining([
      '$.kind:MISSING_KEY', '$.extra:UNKNOWN_KEY', '$.gates[0].facts.extra:UNKNOWN_KEY',
    ]));

    const hostile = clone();
    let invoked = false;
    Object.defineProperty(hostile, 'kind', { enumerable: true, get: () => { invoked = true; return 'wrong'; } });
    Object.defineProperty(hostile, Symbol('secret'), { enumerable: true, value: true });
    expect(rejected(hostile)).toEqual(expect.arrayContaining(['$.kind:INVALID_DATA_PROPERTY', '$:SYMBOL_KEY']));
    expect(invoked).toBe(false);

    const sparse = clone();
    const sparseGates = sparse.gates;
    if (!Array.isArray(sparseGates)) throw new Error('expected gates');
    Reflect.deleteProperty(sparseGates, '4');
    expect(rejected(sparse)).toContain('$.gates[4]:SPARSE_ARRAY');

    const alias = clone();
    gates(alias)[1].facts = gates(alias)[0].facts;
    expect(rejected(alias)).toContain('$.gates[1].facts:ALIAS_OR_CYCLE');
    const cycle = clone();
    gates(cycle)[0].facts = cycle;
    expect(rejected(cycle)).toContain('$.gates[0].facts:ALIAS_OR_CYCLE');
  });
});
