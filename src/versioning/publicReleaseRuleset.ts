import { CURRENT_CONTRACT_VERSIONS, type ContractVersionVector } from './contractVersions';

/**
 * Schema version of the V1 public release-ruleset descriptor.
 */
export const PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1 = 1;

/**
 * The only public descriptor shape released under schema version 1.
 */
export interface PublicReleaseRulesetV1 {
  readonly kind: 'mtg-onedeck-public-release-ruleset-v1';
  readonly schemaVersion: typeof PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1;
  readonly source: 'repository-local-pin';
  readonly contractVersions: ContractVersionVector;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function deepFreeze<T>(value: T): T {
  if (isObjectLike(value) && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (isObjectLike(child)) deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * The MVP public release-ruleset descriptor. It names the repository-local
 * pinned Comprehensive Rules authority by referencing the exact shipped
 * contract version vector instead of copying or retyping it. The value is
 * deeply frozen and deterministic; there is no lookup, fallback, override,
 * or mutable builder around it.
 */
export const PUBLIC_RELEASE_RULESET_V1: PublicReleaseRulesetV1 = deepFreeze({
  kind: 'mtg-onedeck-public-release-ruleset-v1',
  schemaVersion: PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1,
  source: 'repository-local-pin',
  contractVersions: CURRENT_CONTRACT_VERSIONS,
});
