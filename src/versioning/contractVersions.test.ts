import { describe, expect, it } from 'vitest';

import { validateCurrentContractAgainstMetadata } from '../../scripts/checks/verify-contract-versions';
import {
  CURRENT_CONTRACT_VERSIONS,
  diffContractVersionVectors,
  validateBuildId,
  validateContractVersionVector,
  type ContractVersionVector,
  type VersionValidationResult,
} from './contractVersions';

const ROOT_REQUIRED_FIELDS = [
  'contractSchemaVersion',
  'ruleset',
  'engineSemanticsVersion',
  'stateSchemaVersion',
  'eventSchemaVersion',
  'protocolVersion',
  'projectionSchemaVersion',
] as const;
const RULESET_REQUIRED_FIELDS = ['rulesetId', 'effectiveAsOf', 'sha256'] as const;
const NUMERIC_FIELDS = [
  'contractSchemaVersion',
  'engineSemanticsVersion',
  'stateSchemaVersion',
  'eventSchemaVersion',
  'protocolVersion',
  'projectionSchemaVersion',
] as const;
const PINNED_RULESET_METADATA = {
  rulesetId: 'mtg-cr-2026-06-19',
  effectiveAsOf: '2026-06-19',
  sha256: 'e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b',
} as const;

function mutableCurrent(): Record<string, unknown> {
  return structuredClone(CURRENT_CONTRACT_VERSIONS) as unknown as Record<string, unknown>;
}

function failedIssues(result: VersionValidationResult) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected validation to fail');
  return result.issues;
}

describe('ContractVersionVector validation', () => {
  it('accepts CURRENT_CONTRACT_VERSIONS', () => {
    const result = validateContractVersionVector(CURRENT_CONTRACT_VERSIONS);

    expect(result.ok).toBe(true);
  });

  it('returns a distinct deep-frozen copy and does not mutate the input', () => {
    const input = structuredClone(CURRENT_CONTRACT_VERSIONS);
    const before = structuredClone(input);
    const result = validateContractVersionVector(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(input);
    expect(result.value.ruleset).not.toBe(input.ruleset);
    expect(result.value).toEqual(before);
    expect(input).toEqual(before);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.ruleset)).toBe(true);
    expect(Object.isFrozen(CURRENT_CONTRACT_VERSIONS)).toBe(true);
    expect(Object.isFrozen(CURRENT_CONTRACT_VERSIONS.ruleset)).toBe(true);
  });

  it.each(ROOT_REQUIRED_FIELDS)('rejects a missing root field: %s', (field) => {
    const input = mutableCurrent();
    delete input[field];

    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_FIELD', path: field })]),
    );
  });

  it.each(RULESET_REQUIRED_FIELDS)('rejects a missing ruleset field: %s', (field) => {
    const input = mutableCurrent();
    const ruleset = input.ruleset as Record<string, unknown>;
    delete ruleset[field];

    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_FIELD', path: `ruleset.${field}` }),
      ]),
    );
  });

  it('rejects unknown root and ruleset fields', () => {
    const rootInput = mutableCurrent();
    rootInput.extra = true;
    const rulesetInput = mutableCurrent();
    (rulesetInput.ruleset as Record<string, unknown>).extra = true;

    expect(failedIssues(validateContractVersionVector(rootInput))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'extra' })]),
    );
    expect(failedIssues(validateContractVersionVector(rulesetInput))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'ruleset.extra' }),
      ]),
    );
  });

  it.each([
    null,
    [],
    new Date('2026-01-01'),
    new (class VectorClass {})(),
  ])('rejects non-plain roots: %s', (input) => {
    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_ROOT' })]),
    );
  });

  it.each(NUMERIC_FIELDS)('rejects invalid numeric values for %s', (field) => {
    for (const invalid of [0, -1, 1.5, '1', Number.NaN, Number.POSITIVE_INFINITY]) {
      const input = mutableCurrent();
      input[field] = invalid;

      expect(failedIssues(validateContractVersionVector(input))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_VERSION_INTEGER', path: field }),
        ]),
      );
    }
  });

  it('rejects an unsupported contract schema version without guessing', () => {
    const input = mutableCurrent();
    input.contractSchemaVersion = 2;

    expect(failedIssues(validateContractVersionVector(input))).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_CONTRACT_SCHEMA_VERSION',
        path: 'contractSchemaVersion',
      }),
    ]);
  });

  it.each([
    'mtg-cr-2026-6-19',
    'mtg-cr-2026-02-30',
    'wrong-2026-06-19',
    'mtg-cr-2026-06-19\n',
  ])('rejects invalid rulesetId: %s', (rulesetId) => {
    const input = mutableCurrent();
    (input.ruleset as Record<string, unknown>).rulesetId = rulesetId;

    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_RULESET_ID', path: 'ruleset.rulesetId' }),
      ]),
    );
  });

  it('rejects invalid effective dates and ruleset date mismatches', () => {
    const invalidDate = mutableCurrent();
    (invalidDate.ruleset as Record<string, unknown>).effectiveAsOf = '2026-02-30';
    expect(failedIssues(validateContractVersionVector(invalidDate))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_EFFECTIVE_DATE' }),
      ]),
    );

    const mismatch = mutableCurrent();
    (mismatch.ruleset as Record<string, unknown>).effectiveAsOf = '2026-06-20';
    expect(failedIssues(validateContractVersionVector(mismatch))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'RULESET_DATE_MISMATCH' }),
      ]),
    );
  });

  it.each(['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])('rejects invalid SHA-256: %s', (sha256) => {
    const input = mutableCurrent();
    (input.ruleset as Record<string, unknown>).sha256 = sha256;

    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_SHA256', path: 'ruleset.sha256' }),
      ]),
    );
  });

  it('rejects a SHA-256 with a trailing line terminator', () => {
    const input = mutableCurrent();
    (input.ruleset as Record<string, unknown>).sha256 = `${'a'.repeat(64)}\n`;

    expect(failedIssues(validateContractVersionVector(input))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_SHA256', path: 'ruleset.sha256' }),
      ]),
    );
  });

  it('accepts valid BuildId values', () => {
    for (const buildId of ['a', 'build-2026.08_09', 'A'.repeat(64)]) {
      expect(validateBuildId(buildId)).toMatchObject({ ok: true, value: buildId });
    }
  });

  it.each(['', 'A'.repeat(65), 'has space', 'has/slash', 'has:colon', 'valid\n'])('rejects invalid BuildId: %s', (buildId) => {
    expect(validateBuildId(buildId)).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'INVALID_BUILD_ID', path: 'buildId' })],
    });
  });

  it('returns no diff for equal vectors', () => {
    expect(diffContractVersionVectors(CURRENT_CONTRACT_VERSIONS, CURRENT_CONTRACT_VERSIONS)).toEqual([]);
  });

  it('returns every mismatch in the fixed order with expected and actual values', () => {
    const actual: ContractVersionVector = {
      contractSchemaVersion: 2,
      ruleset: {
        rulesetId: 'mtg-cr-2026-06-20',
        effectiveAsOf: '2026-06-20',
        sha256: 'a'.repeat(64),
      },
      engineSemanticsVersion: 2,
      stateSchemaVersion: 2,
      eventSchemaVersion: 2,
      protocolVersion: 2,
      projectionSchemaVersion: 2,
    };
    const mismatches = diffContractVersionVectors(CURRENT_CONTRACT_VERSIONS, actual);

    expect(mismatches.map(({ code }) => code)).toEqual([
      'CONTRACT_SCHEMA_VERSION_MISMATCH',
      'RULESET_ID_MISMATCH',
      'RULESET_EFFECTIVE_DATE_MISMATCH',
      'RULESET_HASH_MISMATCH',
      'ENGINE_SEMANTICS_VERSION_MISMATCH',
      'STATE_SCHEMA_VERSION_MISMATCH',
      'EVENT_SCHEMA_VERSION_MISMATCH',
      'PROTOCOL_VERSION_MISMATCH',
      'PROJECTION_SCHEMA_VERSION_MISMATCH',
    ]);
    expect(mismatches[0]).toEqual({
      code: 'CONTRACT_SCHEMA_VERSION_MISMATCH',
      expected: 1,
      actual: 2,
    });
  });

  it('reports a ruleset hash mismatch independently of a matching rulesetId', () => {
    const actual: ContractVersionVector = {
      ...CURRENT_CONTRACT_VERSIONS,
      ruleset: {
        ...CURRENT_CONTRACT_VERSIONS.ruleset,
        sha256: 'a'.repeat(64),
      },
    };

    expect(diffContractVersionVectors(CURRENT_CONTRACT_VERSIONS, actual)).toEqual([
      {
        code: 'RULESET_HASH_MISMATCH',
        expected: CURRENT_CONTRACT_VERSIONS.ruleset.sha256,
        actual: 'a'.repeat(64),
      },
    ]);
  });

  it('returns multiple validation issues in the fixed field order', () => {
    const input = mutableCurrent();
    input.contractSchemaVersion = 2;
    input.engineSemanticsVersion = 0;
    input.stateSchemaVersion = 0;
    input.eventSchemaVersion = 0;
    input.protocolVersion = 0;
    input.projectionSchemaVersion = 0;
    input.extra = true;
    input.ruleset = {
      rulesetId: CURRENT_CONTRACT_VERSIONS.ruleset.rulesetId,
      effectiveAsOf: '2026-06-20',
      sha256: 'A'.repeat(64),
    };

    const result = validateContractVersionVector(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ code }) => code)).toEqual([
      'UNSUPPORTED_CONTRACT_SCHEMA_VERSION',
      'RULESET_DATE_MISMATCH',
      'INVALID_SHA256',
      'INVALID_VERSION_INTEGER',
      'INVALID_VERSION_INTEGER',
      'INVALID_VERSION_INTEGER',
      'INVALID_VERSION_INTEGER',
      'INVALID_VERSION_INTEGER',
      'UNKNOWN_FIELD',
    ]);
  });

  it('keeps the CR metadata reference synchronized with the current vector', () => {
    const metadata = PINNED_RULESET_METADATA;

    expect(validateCurrentContractAgainstMetadata(metadata)).toEqual([]);
    expect(CURRENT_CONTRACT_VERSIONS.ruleset).toEqual(PINNED_RULESET_METADATA);
  });

  it.each(['rulesetId', 'effectiveAsOf', 'sha256'])(
    'rejects changed CR metadata in CLI-equivalent validation: %s',
    (field) => {
      const metadata = {
        ...PINNED_RULESET_METADATA,
        [field]: field === 'sha256' ? 'a'.repeat(64) : 'changed',
      };

      expect(validateCurrentContractAgainstMetadata(metadata)).toEqual(
        expect.arrayContaining([expect.stringContaining(`CR metadata ${field}`)]),
      );
    },
  );
});
