import type { CoreObjectId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import type { CoreRuleDurationV1 } from './ruleDurationV1';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import {
  createModeNeutralCoreVisibilitySliceV1,
  type CoreVisibilityAudienceV1,
  type CoreVisibilityGrantV1,
  type CoreVisibilitySubjectV1,
  type CoreVisibilityModeV1,
  type ModeNeutralCoreVisibilitySliceV1,
} from './visibilityGrantV1';
import { CoreRuleAuthorityOperationError } from './ruleAuthorityErrorV1';
import { deepFreezeCoreRuleValueV1 } from './ruleValidationSharedV1';
import { coreCanonicalDigestFromValueV1 } from '../closure/canonicalV1';

export type CoreVisibilityGrantInputV1 = Readonly<{
  readonly subject: CoreVisibilitySubjectV1;
  readonly audience: CoreVisibilityAudienceV1;
  readonly mode: CoreVisibilityModeV1;
  readonly sourceObjectId?: CoreObjectId | null;
  readonly duration: CoreRuleDurationV1;
  readonly openingSequence?: number;
  readonly openingObjectIds?: readonly CoreObjectId[];
  readonly topLibraryPrefixDigest?: string;
  readonly networkBound?: boolean;
}>;

export type CoreVisibilityReconciliationContextV1 = Readonly<{
  readonly registry?: ModeNeutralCoreObjectRegistryStateV2;
  readonly acceptedCommandCount?: number;
  readonly currentSequence?: number;
  readonly activePlayerIds?: readonly CorePlayerId[];
  readonly searchSessionIds?: readonly CoreRuleKeyV1[];
  readonly currentTurnNumber?: number;
  /** Accepted library shuffle/reorder operations invalidate every top grant,
   * even when the resulting prefix happens to contain the same object IDs. */
  readonly libraryOrderChangedPlayerIds?: readonly CorePlayerId[];
}>;

export function coreVisibilityTopLibraryPrefixDigestV1(ids: readonly CoreObjectId[]): string {
  return coreCanonicalDigestFromValueV1({ kind: 'top-library-prefix-v1', objectIds: ids.slice() });
}
// Core-only prefixDigest is intentionally never projected to clients.
export const prefixDigestV1 = coreVisibilityTopLibraryPrefixDigestV1;

export type CoreVisibilityGrantOperationResultV1 = Readonly<{
  readonly value: ModeNeutralCoreVisibilitySliceV1;
  readonly grantKey?: CoreRuleKeyV1;
  readonly closedGrantKeys?: readonly CoreRuleKeyV1[];
}>;

function fail(code: string, path: string, message: string): never {
  const allowed = new Set(['INVALID_RULE_AUTHORITY_BUNDLE', 'INVALID_OPERATION_INPUT', 'ID_COLLISION', 'GRANT_NOT_FOUND', 'OBJECT_NOT_CONTROLLABLE', 'SEARCH_SNAPSHOT_STALE', 'SEARCH_SELECTION_INVALID', 'DECISION_AUTHORITY_MISSING', 'TURN_BOUNDARY_MISMATCH', 'CANDIDATE_INVALID']);
  throw new CoreRuleAuthorityOperationError({ code: allowed.has(code) ? code as never : 'INVALID_OPERATION_INPUT', path, message });
}

function checked(slice: ModeNeutralCoreVisibilitySliceV1): ModeNeutralCoreVisibilitySliceV1 {
  return createModeNeutralCoreVisibilitySliceV1({
    grantOrder: slice.grantOrder,
    byGrant: slice.byGrant,
  });
}

/** Add one server-bound grant to the immutable Core visibility slice. */
export function openCoreVisibilityGrantV1(
  sliceInput: ModeNeutralCoreVisibilitySliceV1,
  grantKey: CoreRuleKeyV1,
  input: CoreVisibilityGrantInputV1,
): CoreVisibilityGrantOperationResultV1 {
  const slice = checked(sliceInput);
  if (Object.prototype.hasOwnProperty.call(slice.byGrant, grantKey))
    fail('ID_COLLISION', `/byGrant/${grantKey}`, 'Visibility grant key already exists');
  if (input.mode === 'reveal' && input.audience.kind !== 'all-players')
    fail('INVALID_OPERATION_INPUT', '/audience', 'Reveal grants require all players');
  const grant: CoreVisibilityGrantV1 = deepFreezeCoreRuleValueV1({
    subject: input.subject,
    audience: input.audience,
    mode: input.mode,
    sourceObjectId: input.sourceObjectId ?? null,
    duration: input.duration,
    ...(input.openingSequence === undefined ? {} : { openingSequence: input.openingSequence }),
    ...(input.openingObjectIds === undefined ? {} : { openingObjectIds: input.openingObjectIds }),
    ...(input.topLibraryPrefixDigest === undefined ? {} : { topLibraryPrefixDigest: input.topLibraryPrefixDigest }),
    ...(input.networkBound === undefined ? {} : { networkBound: input.networkBound }),
  });
  return Object.freeze({
    value: createModeNeutralCoreVisibilitySliceV1({
      grantOrder: [...slice.grantOrder, grantKey],
      byGrant: { ...slice.byGrant, [grantKey]: grant },
    }),
    grantKey,
  });
}

/** Close one grant. Closing an absent key is intentionally idempotent. */
export function closeCoreVisibilityGrantV1(
  sliceInput: ModeNeutralCoreVisibilitySliceV1,
  grantKey: CoreRuleKeyV1,
): CoreVisibilityGrantOperationResultV1 {
  const slice = checked(sliceInput);
  if (!Object.prototype.hasOwnProperty.call(slice.byGrant, grantKey))
    return Object.freeze({ value: slice, closedGrantKeys: Object.freeze([]) });
  const order = slice.grantOrder.filter((key) => key !== grantKey);
  return Object.freeze({
    value: createModeNeutralCoreVisibilitySliceV1({
      grantOrder: order,
      byGrant: Object.fromEntries(order.map((key) => [key, slice.byGrant[key]])),
    }),
    grantKey,
    closedGrantKeys: Object.freeze([grantKey]),
  });
}

function objectPresent(registry: ModeNeutralCoreObjectRegistryStateV2 | undefined, objectId: CoreObjectId): boolean {
  return registry === undefined || Object.prototype.hasOwnProperty.call(registry.objects, objectId);
}

function currentTopObjects(registry: ModeNeutralCoreObjectRegistryStateV2 | undefined, subject: CoreVisibilitySubjectV1): readonly CoreObjectId[] | null {
  if (registry === undefined || subject.kind !== 'top-of-library') return null;
  return Object.freeze((registry.zones.byPlayer[subject.playerId]?.library ?? []).slice(0, subject.count));
}

function audienceActive(grant: CoreVisibilityGrantV1, active: ReadonlySet<CorePlayerId> | undefined): boolean {
  if (active === undefined) return true;
  if (grant.audience.kind === 'all-players') return active.size > 0;
  return grant.audience.playerIds.every((playerId) => active.has(playerId));
}

/**
 * Remove grants whose bounded subject, audience, source, choice, or opening
 * snapshot is no longer valid. This function is pure and is called by the
 * Core reducer as part of the accepted transition.
 */
export function reconcileCoreVisibilityGrantsV1(
  sliceInput: ModeNeutralCoreVisibilitySliceV1,
  context: CoreVisibilityReconciliationContextV1 = {},
): CoreVisibilityGrantOperationResultV1 {
  const slice = checked(sliceInput);
  const active = context.activePlayerIds === undefined ? undefined : new Set(context.activePlayerIds);
  const sessions = context.searchSessionIds === undefined ? undefined : new Set(context.searchSessionIds);
  const libraryOrderChanged = context.libraryOrderChangedPlayerIds === undefined
    ? undefined
    : new Set(context.libraryOrderChangedPlayerIds);
  const currentSequence = context.currentSequence ?? context.acceptedCommandCount;
  const keep: CoreRuleKeyV1[] = [];
  const closed: CoreRuleKeyV1[] = [];
  for (const key of slice.grantOrder) {
    const grant = slice.byGrant[key];
    let valid = audienceActive(grant, active);
    if (grant.subject.kind === 'object') valid = valid && objectPresent(context.registry, grant.subject.objectId);
    if (grant.sourceObjectId !== null) valid = valid && objectPresent(context.registry, grant.sourceObjectId);
    if (grant.duration.kind === 'while-source-exists') valid = valid && objectPresent(context.registry, grant.duration.sourceObjectId);
    if (grant.duration.kind === 'until-search-completes' && sessions !== undefined) valid = valid && sessions.has(grant.duration.searchSessionId);
    if (grant.duration.kind === 'until-end-of-turn' && context.currentTurnNumber !== undefined) valid = valid && context.currentTurnNumber <= grant.duration.turnNumber;
    if (grant.duration.kind === 'until-next-command' && currentSequence !== undefined) valid = valid && currentSequence <= grant.duration.openingSequence;
    const top = currentTopObjects(context.registry, grant.subject);
    if (grant.subject.kind === 'top-of-library' && libraryOrderChanged?.has(grant.subject.playerId)) valid = false;
    if (top !== null && grant.openingObjectIds !== undefined) {
      valid = valid && top.length === grant.openingObjectIds.length && top.every((id, index) => id === grant.openingObjectIds?.[index]);
    }
    if (top !== null && grant.topLibraryPrefixDigest !== undefined) valid = valid && coreVisibilityTopLibraryPrefixDigestV1(top) === grant.topLibraryPrefixDigest;
    if (valid) keep.push(key); else closed.push(key);
  }
  if (closed.length === 0) return Object.freeze({ value: slice, closedGrantKeys: Object.freeze([]) });
  return Object.freeze({
    value: createModeNeutralCoreVisibilitySliceV1({
      grantOrder: keep,
      byGrant: Object.fromEntries(keep.map((key) => [key, slice.byGrant[key]])),
    }),
    closedGrantKeys: Object.freeze(closed),
  });
}

export const addCoreVisibilityGrantV1 = openCoreVisibilityGrantV1;
export const removeCoreVisibilityGrantV1 = closeCoreVisibilityGrantV1;
export const pruneCoreVisibilityGrantsV1 = reconcileCoreVisibilityGrantsV1;
