import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import {
  coreDecisionMakerForV1,
  type ModeNeutralCoreDecisionAuthoritySliceV1,
} from './decisionAuthorityV1';
import { CoreRuleAuthorityOperationError } from './ruleAuthorityErrorV1';
import { deepFreezeCoreRuleValueV1 } from './ruleValidationSharedV1';
import {
  createModeNeutralCoreSearchSessionSliceV1,
  validateModeNeutralCoreSearchSessionSliceV1,
  type CoreSearchCriteriaV1,
  type CoreSearchSessionV1,
  type CoreSearchPortionV1,
  type ModeNeutralCoreSearchSessionSliceV1,
} from './searchSessionV1';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import type { CoreRuleZoneRefV1 } from './ruleZoneRefV1';

type Raw = Record<string, unknown>;
export type CoreSearchSessionInputV1 = Readonly<{
  readonly zone: CoreRuleZoneRefV1;
  readonly portion: CoreSearchPortionV1;
  readonly criteria: CoreSearchCriteriaV1;
  readonly revealFound: boolean;
  readonly shuffleAfter: boolean;
  readonly rulesActorPlayerId?: CorePlayerId;
}>;
type OperationResult<T> = Readonly<{
  readonly value: T;
  readonly selectedObjectIds?: readonly CoreObjectId[];
  readonly revealFound?: boolean;
  readonly shuffleAfter?: boolean;
}>;

function fail(
  code:
    | 'INVALID_OPERATION_INPUT'
    | 'ID_COLLISION'
    | 'SESSION_NOT_FOUND'
    | 'SEARCH_SNAPSHOT_STALE'
    | 'SEARCH_SELECTION_INVALID'
    | 'CANDIDATE_INVALID'
    | 'DECISION_AUTHORITY_MISSING',
  path: string,
  message: string,
): never {
  throw new CoreRuleAuthorityOperationError({ code, path, message });
}
function record(value: unknown): Raw | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Raw)
    : null;
}
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
function registryOf(value: unknown): ModeNeutralCoreObjectRegistryStateV2 | null {
  const root = record(value);
  if (!root) return null;
  if (root.zones) return root as unknown as ModeNeutralCoreObjectRegistryStateV2;
  const direct = record(root.registry ?? root.objectRegistry);
  if (direct?.zones) return direct as unknown as ModeNeutralCoreObjectRegistryStateV2;
  const stack = record(root.stackBundle);
  const nested = record(stack?.objectRegistry);
  if (nested?.zones) return nested as unknown as ModeNeutralCoreObjectRegistryStateV2;
  const turn = record(root.turnPriorityBundle);
  const turnStack = record(turn?.stackBundle);
  const turnRegistry = record(turnStack?.objectRegistry);
  return turnRegistry?.zones
    ? (turnRegistry as unknown as ModeNeutralCoreObjectRegistryStateV2)
    : null;
}
function zoneIds(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  zone: CoreRuleZoneRefV1,
): readonly CoreObjectId[] {
  return zone.kind === 'player-zone'
    ? (registry.zones.byPlayer[zone.playerId]?.[zone.zone] ?? [])
    : registry.zones.shared[zone.zone];
}
function sliceOf(value: unknown): ModeNeutralCoreSearchSessionSliceV1 | null {
  const root = record(value);
  const candidate = root?.searchSessions ?? value;
  const valid = validateModeNeutralCoreSearchSessionSliceV1(candidate);
  return valid.ok ? valid.value : null;
}
function isBundle(value: unknown): boolean {
  const root = record(value);
  return root?.searchSessions !== undefined;
}
function authoritiesOf(value: unknown): ModeNeutralCoreDecisionAuthoritySliceV1 | null {
  const root = record(value);
  const candidate = root?.decisionAuthorities;
  if (!candidate) return null;
  return candidate as ModeNeutralCoreDecisionAuthoritySliceV1;
}
function replace(value: unknown, next: ModeNeutralCoreSearchSessionSliceV1): unknown {
  if (!isBundle(value)) return next;
  const root = record(value) as Raw;
  return { ...root, searchSessions: next };
}
function remove(
  slice: ModeNeutralCoreSearchSessionSliceV1,
  key: string,
): ModeNeutralCoreSearchSessionSliceV1 {
  const order = slice.sessionOrder.filter((entry) => entry !== key);
  const by = Object.create(null) as Record<string, CoreSearchSessionV1>;
  for (const entry of order) by[entry] = slice.bySession[entry];
  return createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: order,
    bySession: by,
  });
}
function inputSession(
  sessionKey: string,
  input: CoreSearchSessionInputV1,
  registry: ModeNeutralCoreObjectRegistryStateV2 | null,
  bundle: unknown,
): CoreSearchSessionV1 {
  if (
    input === null ||
    typeof input !== 'object' ||
    !input.zone ||
    !input.portion ||
    !input.criteria
  )
    fail('INVALID_OPERATION_INPUT', '', 'Invalid search session input');
  const actor =
    input.rulesActorPlayerId ??
    (input.zone.kind === 'player-zone' ? input.zone.playerId : undefined);
  if (!actor)
    fail(
      'INVALID_OPERATION_INPUT',
      '/rulesActorPlayerId',
      'Search actor is required for a shared zone',
    );
  const ids = registry ? zoneIds(registry, input.zone) : [];
  const candidates = input.portion.kind === 'all' ? ids.slice() : ids.slice(0, input.portion.count);
  let selector = actor;
  const authorities = authoritiesOf(bundle);
  if (authorities)
    selector = coreDecisionMakerForV1(
      authorities,
      input.zone.kind === 'player-zone' ? input.zone.playerId : actor,
      { kind: 'search-session', searchSessionId: sessionKey },
    );
  return deepFreezeCoreRuleValueV1({
    rulesActorPlayerId: actor,
    selectorPlayerId: selector,
    zone: input.zone,
    portion: input.portion,
    candidateObjectIds: candidates,
    criteria: input.criteria,
    revealFound: input.revealFound,
    shuffleAfter: input.shuffleAfter,
  });
}

export function openCoreSearchSessionV1(
  bundle: unknown,
  sessionKey: CoreRuleKeyV1,
  input: CoreSearchSessionInputV1,
): OperationResult<unknown>;
export function openCoreSearchSessionV1(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  rulesActorPlayerId: CorePlayerId,
  input: Omit<CoreSearchSessionInputV1, 'rulesActorPlayerId'>,
): OperationResult<ModeNeutralCoreSearchSessionSliceV1>;
export function openCoreSearchSessionV1(
  bundleOrRegistry: unknown,
  keyOrActor: string,
  input: CoreSearchSessionInputV1,
): OperationResult<unknown> {
  const adapter = !isBundle(bundleOrRegistry) && registryOf(bundleOrRegistry) !== null;
  const bundle = adapter ? null : bundleOrRegistry;
  const registry = registryOf(bundleOrRegistry);
  const sessionKey = adapter ? 'fixture-search' : keyOrActor;
  const slice = adapter
    ? createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} })
    : sliceOf(bundle ?? bundleOrRegistry);
  if (!slice) fail('INVALID_OPERATION_INPUT', '/searchSessions', 'Invalid search session slice');
  if (slice.bySession[sessionKey])
    fail('ID_COLLISION', `/bySession/${sessionKey}`, 'Session key already exists');
  const actorInput = adapter ? { ...input, rulesActorPlayerId: keyOrActor as CorePlayerId } : input;
  const session = inputSession(sessionKey, actorInput, registry, bundle);
  const next = createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: [...slice.sessionOrder, sessionKey],
    bySession: { ...slice.bySession, [sessionKey]: session },
  });
  return { value: deepFreezeCoreRuleValueV1(replace(bundle ?? bundleOrRegistry, next)) };
}

export function completeCoreSearchSessionV1(
  bundle: unknown,
  sessionKey: CoreRuleKeyV1,
  selectedIds: readonly CoreObjectId[],
): OperationResult<unknown>;
export function completeCoreSearchSessionV1(
  slice: ModeNeutralCoreSearchSessionSliceV1,
  sessionKey: CoreRuleKeyV1,
  selectedIds: readonly CoreObjectId[],
): OperationResult<ModeNeutralCoreSearchSessionSliceV1>;
export function completeCoreSearchSessionV1(
  bundleOrSlice: unknown,
  sessionKey: string,
  selectedIds: unknown,
): OperationResult<unknown> {
  const slice = sliceOf(bundleOrSlice);
  if (!slice) fail('INVALID_OPERATION_INPUT', '/searchSessions', 'Invalid search session slice');
  const session = slice.bySession[sessionKey];
  if (!session) fail('SESSION_NOT_FOUND', `/bySession/${sessionKey}`, 'Search session not found');
  if (!isUnknownArray(selectedIds))
    fail('INVALID_OPERATION_INPUT', '/selectedObjectIds', 'Selected object IDs must be an array');
  const registry = registryOf(bundleOrSlice);
  if (registry) {
    const current =
      session.portion.kind === 'all'
        ? zoneIds(registry, session.zone)
        : zoneIds(registry, session.zone).slice(0, session.portion.count);
    if (
      current.length !== session.candidateObjectIds.length ||
      current.some((id, index) => id !== session.candidateObjectIds[index])
    )
      fail(
        'SEARCH_SNAPSHOT_STALE',
        `/bySession/${sessionKey}/candidateObjectIds`,
        'Search snapshot is stale',
      );
  }
  const seen = new Set<CoreObjectId>();
  const selectedObjectIdsInput: CoreObjectId[] = [];
  for (const rawId of selectedIds) {
    if (!isCanonicalCoreObjectIdV2(rawId))
      fail('CANDIDATE_INVALID', '/selectedObjectIds', 'Selected object ID is invalid');
    const id = rawId;
    if (seen.has(id))
      fail('SEARCH_SELECTION_INVALID', '/selectedObjectIds', 'Selected object IDs must be unique');
    seen.add(id);
    if (!session.candidateObjectIds.includes(id))
      fail('SEARCH_SELECTION_INVALID', '/selectedObjectIds', 'Selected object is not a candidate');
    selectedObjectIdsInput.push(id);
  }
  const criteria = session.criteria;
  if (
    selectedObjectIdsInput.length > criteria.maximum ||
    ((!('mayFailToFind' in criteria) || !criteria.mayFailToFind) &&
      selectedObjectIdsInput.length < criteria.minimum)
  )
    fail('SEARCH_SELECTION_INVALID', '/selectedObjectIds', 'Selection violates quantity bounds');
  const selectedObjectIds = session.candidateObjectIds.filter((id) => seen.has(id));
  const next = remove(slice, sessionKey);
  return {
    value: deepFreezeCoreRuleValueV1(isBundle(bundleOrSlice) ? replace(bundleOrSlice, next) : next),
    selectedObjectIds,
    revealFound: session.revealFound,
    shuffleAfter: session.shuffleAfter,
  };
}

export function cancelCoreSearchSessionV1(
  bundle: unknown,
  sessionKey: CoreRuleKeyV1,
): OperationResult<unknown>;
export function cancelCoreSearchSessionV1(
  slice: ModeNeutralCoreSearchSessionSliceV1,
  sessionKey: CoreRuleKeyV1,
): OperationResult<ModeNeutralCoreSearchSessionSliceV1>;
export function cancelCoreSearchSessionV1(
  bundleOrSlice: unknown,
  sessionKey: string,
): OperationResult<unknown> {
  const slice = sliceOf(bundleOrSlice);
  if (!slice) fail('INVALID_OPERATION_INPUT', '/searchSessions', 'Invalid search session slice');
  if (!slice.bySession[sessionKey])
    fail('SESSION_NOT_FOUND', `/bySession/${sessionKey}`, 'Search session not found');
  const next = remove(slice, sessionKey);
  return {
    value: deepFreezeCoreRuleValueV1(isBundle(bundleOrSlice) ? replace(bundleOrSlice, next) : next),
  };
}
