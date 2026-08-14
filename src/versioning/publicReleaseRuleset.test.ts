import { describe, expect, it } from 'vitest';

import {
  CURRENT_CONTRACT_VERSIONS,
  PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1,
  PUBLIC_RELEASE_RULESET_V1,
  validateContractVersionVector,
  type PublicReleaseRulesetV1,
} from './index';

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child));
}

describe('publicReleaseRuleset descriptor', () => {
  it('is the exact V1 descriptor with the repository-local-pin source', () => {
    const descriptor: PublicReleaseRulesetV1 = PUBLIC_RELEASE_RULESET_V1;

    expect(PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1).toBe(1);
    expect(descriptor).toEqual({
      kind: 'mtg-onedeck-public-release-ruleset-v1',
      schemaVersion: 1,
      source: 'repository-local-pin',
      contractVersions: CURRENT_CONTRACT_VERSIONS,
    });
    expect(Object.keys(descriptor).sort()).toEqual([
      'contractVersions',
      'kind',
      'schemaVersion',
      'source',
    ]);
    expect(descriptor.schemaVersion).toBe(PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1);
  });

  it('references the exact CURRENT_CONTRACT_VERSIONS object without copying it', () => {
    expect(PUBLIC_RELEASE_RULESET_V1.contractVersions).toBe(CURRENT_CONTRACT_VERSIONS);
    expect(PUBLIC_RELEASE_RULESET_V1.contractVersions.ruleset).toBe(
      CURRENT_CONTRACT_VERSIONS.ruleset,
    );
  });

  it('keeps the shipped version vector at the exact V1 values', () => {
    const versions = PUBLIC_RELEASE_RULESET_V1.contractVersions;

    expect(versions.contractSchemaVersion).toBe(1);
    expect(versions.engineSemanticsVersion).toBe(1);
    expect(versions.stateSchemaVersion).toBe(1);
    expect(versions.eventSchemaVersion).toBe(1);
    expect(versions.protocolVersion).toBe(1);
    expect(versions.projectionSchemaVersion).toBe(1);
    expect(versions.ruleset).toEqual({
      rulesetId: 'mtg-cr-2026-06-19',
      effectiveAsOf: '2026-06-19',
      sha256: 'e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b',
    });
  });

  it('is deeply frozen, including the referenced version vector', () => {
    expect(isDeepFrozen(PUBLIC_RELEASE_RULESET_V1)).toBe(true);
    expect(Object.isFrozen(PUBLIC_RELEASE_RULESET_V1)).toBe(true);
    expect(Object.isFrozen(PUBLIC_RELEASE_RULESET_V1.contractVersions)).toBe(true);
    expect(Object.isFrozen(PUBLIC_RELEASE_RULESET_V1.contractVersions.ruleset)).toBe(true);
  });

  it('rejects mutation attempts on the descriptor and its nested values', () => {
    const descriptor = PUBLIC_RELEASE_RULESET_V1 as unknown as Record<string, unknown>;

    expect(() => {
      descriptor.kind = 'tampered';
    }).toThrow(TypeError);
    expect(() => {
      descriptor.extra = true;
    }).toThrow(TypeError);
    expect(() => {
      (descriptor.contractVersions as Record<string, unknown>).protocolVersion = 2;
    }).toThrow(TypeError);
    expect(() => {
      const ruleset = PUBLIC_RELEASE_RULESET_V1.contractVersions.ruleset;
      (ruleset as unknown as Record<string, unknown>).sha256 = '0'.repeat(64);
    }).toThrow(TypeError);

    expect(PUBLIC_RELEASE_RULESET_V1.kind).toBe('mtg-onedeck-public-release-ruleset-v1');
    expect(Object.hasOwn(PUBLIC_RELEASE_RULESET_V1, 'extra')).toBe(false);
    expect(PUBLIC_RELEASE_RULESET_V1.contractVersions.protocolVersion).toBe(1);
  });

  it('keeps the referenced contract version vector independently valid', () => {
    const result = validateContractVersionVector(PUBLIC_RELEASE_RULESET_V1.contractVersions);

    expect(result.ok).toBe(true);
  });
});
