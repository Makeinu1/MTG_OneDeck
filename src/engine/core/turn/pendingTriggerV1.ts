import type { CoreObjectId } from '../ids';
import type {
  CoreTriggeredAbilityObjectIdentityV2,
} from '../object/tokenObjectV2';
import type {
  CoreStackAnnouncementRecordV1,
} from '../stack/stackAnnouncementRecordV1';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../object/objectRegistryStateV2';
import {
  validateModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerValidationV1';
import type {
  CorePendingTriggerValidationIssueV1,
} from './pendingTriggerValidationV1';

export type CoreTriggerStackPlacementBucketV1 = 'ordinary' | 'ability-triggered';

export type CorePendingTriggeredAbilityV1 = Readonly<{
  readonly stackPlacementBucket: CoreTriggerStackPlacementBucketV1;
  readonly object: CoreTriggeredAbilityObjectIdentityV2;
  readonly announcement: Extract<
    CoreStackAnnouncementRecordV1,
    { readonly kind: 'triggered-ability' }
  >;
}>;

export type ModeNeutralCorePendingTriggerSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-pending-trigger-slice-v1';
  readonly pendingObjectIds: readonly CoreObjectId[];
  readonly byObject: Readonly<Record<CoreObjectId, CorePendingTriggeredAbilityV1>>;
}>;

export type CorePendingTriggerSliceV1 = ModeNeutralCorePendingTriggerSliceV1;

export type CreateModeNeutralCorePendingTriggerSliceV1Input = Readonly<{
  readonly pendingObjectIds: readonly CoreObjectId[];
  readonly byObject: Readonly<Record<CoreObjectId, CorePendingTriggeredAbilityV1>>;
}>;

export class CorePendingTriggerCreationErrorV1 extends Error {
  readonly issues: readonly CorePendingTriggerValidationIssueV1[];

  constructor(issues: readonly CorePendingTriggerValidationIssueV1[]) {
    super(`Invalid Core pending trigger slice (${issues.length} issue(s))`);
    this.name = 'CorePendingTriggerCreationErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

export class CorePendingTriggerOperationErrorV1 extends Error {
  readonly issues: readonly CorePendingTriggerValidationIssueV1[];

  constructor(issues: readonly CorePendingTriggerValidationIssueV1[]) {
    super(`Invalid Core pending trigger operation (${issues.length} issue(s))`);
    this.name = 'CorePendingTriggerOperationErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

function hasOwnKind(value: unknown): boolean {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.prototype.hasOwnProperty.call(value, 'kind');
  } catch {
    return false;
  }
}

function factoryCandidate(input: unknown): unknown {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input;
  try {
    const candidate = Object.create(null) as Record<string | symbol, unknown>;
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
    }
    Object.defineProperty(candidate, 'kind', {
      value: 'mode-neutral-core-pending-trigger-slice-v1',
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return candidate;
  } catch {
    return input;
  }
}

export function createModeNeutralCorePendingTriggerSliceV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  input: CreateModeNeutralCorePendingTriggerSliceV1Input,
): ModeNeutralCorePendingTriggerSliceV1 {
  if (hasOwnKind(input)) {
    throw new CorePendingTriggerCreationErrorV1([Object.freeze({
      code: 'UNKNOWN_FIELD',
      path: '/kind',
      message: 'Factory input must omit kind',
    })]);
  }
  const result = validateModeNeutralCorePendingTriggerSliceV1(registry, factoryCandidate(input));
  if (!result.ok) throw new CorePendingTriggerCreationErrorV1(result.issues);
  return result.value;
}

export type CorePendingTriggeredAbilityAppendInputV1 = Readonly<{
  readonly objectId: CoreObjectId;
}> & CorePendingTriggeredAbilityV1;

function readStrictArray(value: unknown): readonly unknown[] | null {
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
    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      values.push(descriptor.value);
    }
    return values;
  } catch {
    return null;
  }
}

function appendIssues(
  issues: readonly CorePendingTriggerValidationIssueV1[],
): never {
  throw new CorePendingTriggerOperationErrorV1(issues);
}

function readAppendRecord(
  value: unknown,
): Readonly<{
  readonly objectId: CoreObjectId;
  readonly record: CorePendingTriggeredAbilityV1;
}> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || (Reflect.getPrototypeOf(value) !== Object.prototype && Reflect.getPrototypeOf(value) !== null)) return null;
    const fields = ['objectId', 'stackPlacementBucket', 'object', 'announcement'] as const;
    const found = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !fields.includes(key as typeof fields[number])) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      found[key] = descriptor.value;
    }
    if (fields.some((key) => !Object.prototype.hasOwnProperty.call(found, key))) return null;
    return {
      objectId: found.objectId as CoreObjectId,
      record: {
        stackPlacementBucket: found.stackPlacementBucket as CorePendingTriggeredAbilityV1['stackPlacementBucket'],
        object: found.object as CorePendingTriggeredAbilityV1['object'],
        announcement: found.announcement as CorePendingTriggeredAbilityV1['announcement'],
      },
    };
  } catch {
    return null;
  }
}

export function appendCorePendingTriggeredAbilitiesV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  pending: ModeNeutralCorePendingTriggerSliceV1,
  additions: readonly CorePendingTriggeredAbilityAppendInputV1[],
): ModeNeutralCorePendingTriggerSliceV1 {
  const base = validateModeNeutralCorePendingTriggerSliceV1(registry, pending);
  if (!base.ok) appendIssues(base.issues);
  const incoming = readStrictArray(additions);
  if (incoming === null) {
    appendIssues([Object.freeze({
      code: 'INVALID_ARRAY',
      path: '/additions',
      message: 'Additions must be an ordinary dense array of records',
    })]);
  }
  const pendingObjectIds = pending.pendingObjectIds.slice();
  const byObject = Object.create(null) as Record<string, unknown>;
  for (const objectId of pending.pendingObjectIds) byObject[objectId] = pending.byObject[objectId];
  for (const [index, addition] of incoming.entries()) {
    const parsed = readAppendRecord(addition);
    if (parsed === null) {
      appendIssues([Object.freeze({
        code: 'INVALID_TYPE',
        path: `/additions/${index}`,
        message: 'Append record must contain exactly objectId, stackPlacementBucket, object, and announcement',
      })]);
    }
    const record = parsed.record;
    const objectId = parsed.objectId;
    pendingObjectIds.push(objectId);
    byObject[objectId] = record;
  }
  const result = validateModeNeutralCorePendingTriggerSliceV1(registry, {
    kind: 'mode-neutral-core-pending-trigger-slice-v1',
    pendingObjectIds,
    byObject,
  });
  if (!result.ok) appendIssues(result.issues);
  return result.value;
}

export {
  validateModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerValidationV1';
export type {
  CorePendingTriggerValidationCodeV1,
  CorePendingTriggerValidationIssueV1,
  CorePendingTriggerValidationResultV1,
} from './pendingTriggerValidationV1';
