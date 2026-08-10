import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  validateModeNeutralCoreObjectRegistrySliceV2,
} from '../object/objectRegistryValidationV2';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../object/objectRegistryStateV2';
import {
  validateModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerValidationV1';
import type {
  CorePendingTriggerValidationIssueV1,
} from './pendingTriggerValidationV1';
import type {
  CoreTriggerStackPlacementBucketV1,
  ModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerV1';

export type CorePendingTriggerOrderGroupV1 = Readonly<{
  readonly stackPlacementBucket: CoreTriggerStackPlacementBucketV1;
  readonly controllerPlayerId: CorePlayerId;
  readonly pendingObjectIds: readonly CoreObjectId[];
}>;

export type CorePendingTriggerPlacementAnalysisV1 = Readonly<{
  readonly kind: 'deterministic-order' | 'manual-order-required';
  readonly groups: readonly CorePendingTriggerOrderGroupV1[];
  readonly orderedObjectIds: readonly CoreObjectId[];
}>;

export type CorePendingTriggerOrderValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'INVALID_ARRAY'
  | 'INVALID_ID'
  | 'DUPLICATE_VALUE'
  | 'PENDING_TRIGGER_SET_MISMATCH'
  | 'INVALID_TRIGGER_ORDER';

export type CorePendingTriggerOrderValidationIssueV1 = Readonly<{
  readonly code: CorePendingTriggerOrderValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type CorePendingTriggerOrderValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: readonly CoreObjectId[] }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CorePendingTriggerOrderValidationIssueV1[];
    }>;

function cmp(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function orderedIssues(
  issues: readonly CorePendingTriggerOrderValidationIssueV1[],
): readonly CorePendingTriggerOrderValidationIssueV1[] {
  return Object.freeze(issues.slice().sort((left, right) => cmp(left.path, right.path) || cmp(left.code, right.code) || cmp(left.message, right.message)).map((current) => Object.freeze({ ...current })));
}

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) freeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function registryValue(input: unknown): ModeNeutralCoreObjectRegistrySliceV2 {
  const result = validateModeNeutralCoreObjectRegistrySliceV2(input);
  if (!result.ok) throw new TypeError('Object Registry V2 is invalid');
  return result.value;
}

export function coreApnapPlayerOrderV1(
  registryInput: ModeNeutralCoreObjectRegistrySliceV2,
): readonly CorePlayerId[] {
  const registry = registryValue(registryInput);
  const activeIndex = registry.turnOrder.indexOf(registry.activePlayerId);
  if (activeIndex < 0) throw new TypeError('Active player is not present in turn order');
  return freeze([
    ...registry.turnOrder.slice(activeIndex),
    ...registry.turnOrder.slice(0, activeIndex),
  ]);
}

function canonicalPending(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  pending: ModeNeutralCorePendingTriggerSliceV1,
): ModeNeutralCorePendingTriggerSliceV1 {
  const result = validateModeNeutralCorePendingTriggerSliceV1(registry, pending);
  if (!result.ok) throw new TypeError('Pending trigger slice is invalid');
  return result.value;
}

export function analyzeCorePendingTriggerPlacementV1(
  registryInput: ModeNeutralCoreObjectRegistrySliceV2,
  pendingInput: ModeNeutralCorePendingTriggerSliceV1,
): CorePendingTriggerPlacementAnalysisV1 {
  const registry = registryValue(registryInput);
  const pending = canonicalPending(registry, pendingInput);
  const apnap = coreApnapPlayerOrderV1(registry);
  const groups: CorePendingTriggerOrderGroupV1[] = [];
  const orderedObjectIds: CoreObjectId[] = [];
  const buckets: readonly CoreTriggerStackPlacementBucketV1[] = ['ordinary', 'ability-triggered'];

  for (const bucket of buckets) {
    for (const controllerPlayerId of apnap) {
      const pendingObjectIds = pending.pendingObjectIds.filter((objectId) => {
        const record = pending.byObject[objectId];
        return record.stackPlacementBucket === bucket
          && record.object.controllerPlayerId === controllerPlayerId;
      });
      if (pendingObjectIds.length === 0) continue;
      const group = Object.freeze({
        stackPlacementBucket: bucket,
        controllerPlayerId,
        pendingObjectIds: Object.freeze(pendingObjectIds.slice()),
      });
      groups.push(group);
      orderedObjectIds.push(...pendingObjectIds);
    }
  }
  const kind = groups.every((group) => group.pendingObjectIds.length <= 1)
    ? 'deterministic-order'
    : 'manual-order-required';
  return freeze({
    kind,
    groups: Object.freeze(groups),
    orderedObjectIds: Object.freeze(orderedObjectIds),
  });
}

function strictOrderArray(value: unknown): readonly CoreObjectId[] | null {
  try {
    if (!Array.isArray(value) || Reflect.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value as object, 'length');
    if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) return null;
    const length: unknown = lengthDescriptor.value as unknown;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return null;
    const keys = Reflect.ownKeys(value);
    const allowed = new Set<string>(['length']);
    for (let index = 0; index < length; index += 1) allowed.add(String(index));
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.has(key)) return null;
      if (key !== 'length') {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || descriptor.enumerable !== true
          || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      }
    }
    const values: CoreObjectId[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) return null;
      values.push(descriptor.value as CoreObjectId);
    }
    return values;
  } catch {
    return null;
  }
}

function validateOrderAgainstGroups(
  ordered: readonly CoreObjectId[],
  groups: readonly CorePendingTriggerOrderGroupV1[],
  issues: CorePendingTriggerOrderValidationIssueV1[],
): void {
  let offset = 0;
  for (const group of groups) {
    const segment = ordered.slice(offset, offset + group.pendingObjectIds.length);
    if (segment.length !== group.pendingObjectIds.length
      || new Set(segment).size !== segment.length
      || segment.some((objectId) => !group.pendingObjectIds.includes(objectId))) {
      issues.push({
        code: 'INVALID_TRIGGER_ORDER',
        path: '/orderedObjectIds',
        message: 'Ordered pending IDs must preserve bucket and APNAP group order',
      });
      return;
    }
    offset += group.pendingObjectIds.length;
  }
  if (offset !== ordered.length) {
    issues.push({
      code: 'INVALID_TRIGGER_ORDER',
      path: '/orderedObjectIds',
      message: 'Ordered pending IDs contain entries outside the analyzed groups',
    });
  }
}

export function validateCorePendingTriggerOrderV1(
  registryInput: ModeNeutralCoreObjectRegistrySliceV2,
  pendingInput: ModeNeutralCorePendingTriggerSliceV1,
  orderedInput: unknown,
): CorePendingTriggerOrderValidationResultV1;
export function validateCorePendingTriggerOrderV1(
  pendingInput: ModeNeutralCorePendingTriggerSliceV1,
  orderedInput: unknown,
): CorePendingTriggerOrderValidationResultV1;
export function validateCorePendingTriggerOrderV1(
  first: ModeNeutralCoreObjectRegistrySliceV2 | ModeNeutralCorePendingTriggerSliceV1,
  second: unknown,
  third?: unknown,
): CorePendingTriggerOrderValidationResultV1 {
  const hasRegistry = third !== undefined || (
    first !== null
    && typeof first === 'object'
    && 'kind' in first
    && first.kind === 'mode-neutral-core-object-registry-slice-v2'
  );
  const pending = (hasRegistry ? second : first) as ModeNeutralCorePendingTriggerSliceV1;
  const orderedInput = hasRegistry ? third : second;
  const issues: CorePendingTriggerOrderValidationIssueV1[] = [];
  const ordered = strictOrderArray(orderedInput);
  if (ordered === null) {
    return Object.freeze({ ok: false, issues: Object.freeze([Object.freeze({
      code: 'INVALID_ARRAY',
      path: '/orderedObjectIds',
      message: 'Ordered pending IDs must be an ordinary dense array',
    })]) });
  }
  const pendingIds = pending.pendingObjectIds;
  const expected = new Set(pendingIds);
  const seen = new Set<string>();
  ordered.forEach((objectId, index) => {
    if (typeof objectId !== 'string') {
      issues.push({ code: 'INVALID_ID', path: `/orderedObjectIds/${index}`, message: 'Expected a Core ObjectId' });
      return;
    }
    if (!expected.has(objectId)) issues.push({ code: 'PENDING_TRIGGER_SET_MISMATCH', path: `/orderedObjectIds/${index}`, message: 'Ordered ID is not pending' });
    if (seen.has(objectId)) issues.push({ code: 'DUPLICATE_VALUE', path: `/orderedObjectIds/${index}`, message: 'Ordered IDs must be unique' });
    seen.add(objectId);
  });
  if (ordered.length !== pendingIds.length || pendingIds.some((objectId) => !seen.has(objectId))) {
    issues.push({ code: 'PENDING_TRIGGER_SET_MISMATCH', path: '/orderedObjectIds', message: 'Ordered IDs must equal pendingObjectIds exactly' });
  }
  if (issues.length === 0 && hasRegistry) {
    try {
      const analysis = analyzeCorePendingTriggerPlacementV1(
        first as ModeNeutralCoreObjectRegistrySliceV2,
        pending,
      );
      validateOrderAgainstGroups(ordered, analysis.groups, issues);
    } catch {
      issues.push({ code: 'INVALID_ROOT', path: '/registry', message: 'Registry or pending slice is invalid' });
    }
  }
  if (issues.length > 0) return Object.freeze({ ok: false, issues: orderedIssues(issues) });
  return Object.freeze({ ok: true, value: freeze(ordered.slice()) });
}

export const validateCorePendingTriggerPlacementOrderV1 = validateCorePendingTriggerOrderV1;
export const analyzeCorePendingTriggerOrderV1 = analyzeCorePendingTriggerPlacementV1;
export type { CorePendingTriggerValidationIssueV1 };
