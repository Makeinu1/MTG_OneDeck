import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  validateModeNeutralCoreObjectRegistrySliceV2,
} from '../object/objectRegistryValidationV2';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../object/objectRegistryStateV2';
import {
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
} from '../object/objectIdV2';
import {
  validateCoreGameObjectIdentityV2,
} from '../object/tokenObjectV2';
import type { CoreTriggeredAbilityObjectIdentityV2 } from '../object/tokenObjectV2';
import {
  validateModeNeutralCoreStackAnnouncementSliceV1,
} from '../stack/stackAnnouncementValidationV1';
import type {
  CoreStackAnnouncementRecordV1,
} from '../stack/stackAnnouncementRecordV1';
import type {
  CorePendingTriggeredAbilityV1,
  ModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerV1';

export type CorePendingTriggerValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'INVALID_OBJECT_REGISTRY'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'INVALID_ARRAY'
  | 'INVALID_ORDER'
  | 'DUPLICATE_VALUE'
  | 'PENDING_TRIGGER_SET_MISMATCH'
  | 'PENDING_TRIGGER_KIND_MISMATCH'
  | 'PENDING_TRIGGER_COLLISION'
  | 'CROSS_SLICE_MISMATCH';

export type CorePendingTriggerValidationIssueV1 = Readonly<{
  readonly code: CorePendingTriggerValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type CorePendingTriggerValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCorePendingTriggerSliceV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CorePendingTriggerValidationIssueV1[];
    }>;

type RawRecord = Record<string, unknown>;

const ROOT_FIELDS = ['kind', 'pendingObjectIds', 'byObject'] as const;
const RECORD_FIELDS = ['stackPlacementBucket', 'object', 'announcement'] as const;
const PENDING_KIND = 'mode-neutral-core-pending-trigger-slice-v1' as const;
const BUCKETS = ['ordinary', 'ability-triggered'] as const;

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(parent: string, child: string): string {
  return `${parent}/${escapePointerSegment(child)}`;
}

function issue(
  code: CorePendingTriggerValidationCodeV1,
  path: string,
  message: string,
): CorePendingTriggerValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function sortedIssues(
  issues: readonly CorePendingTriggerValidationIssueV1[],
): readonly CorePendingTriggerValidationIssueV1[] {
  return Object.freeze(issues.slice().sort((left, right) =>
    compareCodeUnits(left.path, right.path)
    || compareCodeUnits(left.code, right.code)
    || compareCodeUnits(left.message, right.message),
  ).map((current) => Object.freeze({ ...current })));
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readRecord(
  value: unknown,
  at: string,
  fields: readonly string[],
  issues: CorePendingTriggerValidationIssueV1[],
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.push(issue('INVALID_ROOT', at, 'Expected a plain object'));
    return null;
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.push(issue('INVALID_TYPE', at, 'Object descriptors are not readable'));
    return null;
  }

  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(issue('UNKNOWN_FIELD', pointer(at, '[symbol]'), 'Symbol fields are not allowed'));
      continue;
    }
    const fieldPath = pointer(at, key);
    if (!fields.includes(key)) {
      issues.push(issue('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`));
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_TYPE', fieldPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.push(issue('UNKNOWN_FIELD', fieldPath, 'Fields must be enumerable'));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(issue('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed'));
      continue;
    }
    result[key] = descriptor.value;
  }
  for (const field of fields) {
    if (!hasOwn(result, field)) issues.push(issue('MISSING_FIELD', pointer(at, field), 'Required field is missing'));
  }
  return result;
}

function readArray(
  value: unknown,
  at: string,
  issues: CorePendingTriggerValidationIssueV1[],
): readonly unknown[] | null {
  let arrayValue: boolean;
  try {
    arrayValue = Array.isArray(value);
  } catch {
    issues.push(issue('INVALID_ARRAY', at, 'Array shape is not readable'));
    return null;
  }
  if (!arrayValue) {
    issues.push(issue('INVALID_ARRAY', at, 'Expected an array'));
    return null;
  }
  try {
    if (Reflect.getPrototypeOf(value as object) !== Array.prototype) {
      issues.push(issue('INVALID_ARRAY', at, 'Expected an ordinary array'));
    }
  } catch {
    issues.push(issue('INVALID_ARRAY', at, 'Array prototype is not readable'));
  }

  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    issues.push(issue('INVALID_ARRAY', at, 'Array length descriptor is not readable'));
    return null;
  }
  if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
    issues.push(issue('INVALID_ARRAY', at, 'Array length must be a data property'));
    return null;
  }
  const length: unknown = lengthDescriptor.value as unknown;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    issues.push(issue('INVALID_ARRAY', at, 'Array length is invalid'));
    return null;
  }
  const result: unknown[] = [];
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value as object);
  } catch {
    issues.push(issue('INVALID_ARRAY', at, 'Array descriptors are not readable'));
    return null;
  }
  const present = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(issue('UNKNOWN_FIELD', pointer(at, '[symbol]'), 'Symbol fields are not allowed'));
      continue;
    }
    if (key === 'length') continue;
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      issues.push(issue('INVALID_ARRAY', pointer(at, key), 'Extra array properties are not allowed'));
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_ARRAY', pointer(at, key), 'Array entry descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(issue('INVALID_ARRAY', pointer(at, key), 'Array entries must be dense enumerable data properties'));
      continue;
    }
    result[index] = descriptor.value;
    present.add(key);
  }
  for (let index = 0; index < length; index += 1) {
    if (!present.has(String(index))) issues.push(issue('INVALID_ARRAY', pointer(at, String(index)), 'Sparse arrays are not allowed'));
  }
  return result;
}

function mapIdentityCode(code: string): CorePendingTriggerValidationCodeV1 {
  switch (code) {
    case 'INVALID_ROOT':
    case 'MISSING_FIELD':
    case 'UNKNOWN_FIELD':
    case 'INVALID_TYPE':
    case 'INVALID_LITERAL':
    case 'INVALID_ID':
      return code;
    default:
      return 'INVALID_TYPE';
  }
}

function appendIdentityIssues(
  found: readonly { readonly code: string; readonly path: string; readonly message: string }[],
  at: string,
  issues: CorePendingTriggerValidationIssueV1[],
): void {
  for (const current of found) {
    const suffix = current.path === '$'
      ? ''
      : current.path.startsWith('$.')
        ? `/${current.path.slice(2).replaceAll('.', '/')}`
        : current.path;
    issues.push(issue(mapIdentityCode(current.code), `${at}${suffix}`, current.message));
  }
}

function mapAnnouncementCode(code: string): CorePendingTriggerValidationCodeV1 {
  switch (code) {
    case 'INVALID_ROOT':
    case 'MISSING_FIELD':
    case 'UNKNOWN_FIELD':
    case 'INVALID_TYPE':
    case 'INVALID_LITERAL':
    case 'INVALID_ID':
    case 'INVALID_ARRAY':
    case 'INVALID_ORDER':
    case 'DUPLICATE_VALUE':
      return code;
    default:
      return 'INVALID_TYPE';
  }
}

function appendAnnouncementIssues(
  found: readonly { readonly code: string; readonly path: string; readonly message: string }[],
  at: string,
  issues: CorePendingTriggerValidationIssueV1[],
): void {
  for (const current of found) {
    const suffix = current.path === '' ? '' : current.path;
    issues.push(issue(mapAnnouncementCode(current.code), `${at}${suffix}`, current.message));
  }
}

function registryContainsObject(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
): boolean {
  if (Object.prototype.hasOwnProperty.call(registry.objects, objectId)) return true;
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    if (zones.library.includes(objectId) || zones.hand.includes(objectId) || zones.graveyard.includes(objectId)) return true;
  }
  const shared = registry.zones.shared;
  return shared.battlefield.includes(objectId)
    || shared.stack.includes(objectId)
    || shared.exile.includes(objectId)
    || shared.command.includes(objectId);
}

function minimalAnnouncementRegistry(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
  object: CoreTriggeredAbilityObjectIdentityV2,
): ModeNeutralCoreObjectRegistrySliceV2 {
  const objects = Object.create(null) as Record<CoreObjectId, CoreTriggeredAbilityObjectIdentityV2>;
  objects[objectId] = object;
  const byPlayer = Object.create(null) as Record<CorePlayerId, {
    readonly library: readonly CoreObjectId[];
    readonly hand: readonly CoreObjectId[];
    readonly graveyard: readonly CoreObjectId[];
  }>;
  for (const playerId of registry.turnOrder) {
    byPlayer[playerId] = { library: [], hand: [], graveyard: [] };
  }
  return {
    kind: 'mode-neutral-core-object-registry-slice-v2',
    players: registry.players,
    turnOrder: registry.turnOrder,
    activePlayerId: registry.activePlayerId,
    cardDefinitions: Object.create(null) as ModeNeutralCoreObjectRegistrySliceV2['cardDefinitions'],
    physicalCards: Object.create(null) as ModeNeutralCoreObjectRegistrySliceV2['physicalCards'],
    objects,
    zones: {
      byPlayer,
      shared: { battlefield: [], stack: [objectId], exile: [], command: [] },
    },
  };
}

function validateAnnouncementRecord(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
  object: CoreTriggeredAbilityObjectIdentityV2,
  input: unknown,
  at: string,
  issues: CorePendingTriggerValidationIssueV1[],
): CoreStackAnnouncementRecordV1 | null {
  const announcementInput = {
    kind: 'mode-neutral-core-stack-announcement-slice-v1',
    byObject: { [objectId]: input },
  };
  let result: ReturnType<typeof validateModeNeutralCoreStackAnnouncementSliceV1>;
  try {
    result = validateModeNeutralCoreStackAnnouncementSliceV1(
      minimalAnnouncementRegistry(registry, objectId, object),
      announcementInput,
    );
  } catch {
    issues.push(issue('INVALID_TYPE', at, 'Announcement descriptors are not readable'));
    return null;
  }
  if (!result.ok) {
    appendAnnouncementIssues(result.issues, at, issues);
    return null;
  }
  const record = result.value.byObject[objectId];
  if (record === undefined || record.kind !== 'triggered-ability') {
    issues.push(issue('PENDING_TRIGGER_KIND_MISMATCH', `${at}/kind`, 'Pending trigger announcement must be triggered-ability'));
    return null;
  }
  return record;
}

function validatePendingRecord(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
  input: unknown,
  at: string,
  issues: CorePendingTriggerValidationIssueV1[],
): CorePendingTriggeredAbilityV1 | null {
  const record = readRecord(input, at, RECORD_FIELDS, issues);
  if (record === null) return null;

  if (!BUCKETS.includes(record.stackPlacementBucket as typeof BUCKETS[number])) {
    issues.push(issue('INVALID_LITERAL', pointer(at, 'stackPlacementBucket'), 'Invalid trigger placement bucket'));
  }

  const identityResult = validateCoreGameObjectIdentityV2(record.object);
  let object: CoreTriggeredAbilityObjectIdentityV2 | null = null;
  if (!identityResult.ok) {
    appendIdentityIssues(identityResult.issues, pointer(at, 'object'), issues);
  } else if (identityResult.value.kind !== 'triggered-ability') {
    issues.push(issue('PENDING_TRIGGER_KIND_MISMATCH', pointer(at, 'object/kind'), 'Pending trigger object must be triggered-ability'));
  } else {
    object = identityResult.value;
    if (!Object.prototype.hasOwnProperty.call(registry.players, object.controllerPlayerId)) {
      issues.push(issue('INVALID_ID', pointer(at, 'object/controllerPlayerId'), 'Controller player must be seated'));
    }
  }

  if (!isCanonicalCoreObjectIdV2(objectId) || parseCoreObjectIdV2(objectId)?.kind !== 'triggered-ability') {
    issues.push(issue('PENDING_TRIGGER_KIND_MISMATCH', at, 'Pending object ID must be a canonical triggered-ability ID'));
  }
  if (registryContainsObject(registry, objectId)) {
    issues.push(issue('PENDING_TRIGGER_COLLISION', at, 'Pending trigger object ID must be absent from registry and zones'));
  }

  const announcement = object === null
    ? null
    : validateAnnouncementRecord(registry, objectId, object, record.announcement, pointer(at, 'announcement'), issues);
  if (announcement === null && object !== null) return null;
  if (object === null || announcement === null) return null;
  const triggeredAnnouncement = announcement as Extract<
    CoreStackAnnouncementRecordV1,
    { readonly kind: 'triggered-ability' }
  >;

  return Object.freeze({
    stackPlacementBucket: record.stackPlacementBucket as 'ordinary' | 'ability-triggered',
    object: Object.freeze({ ...object }),
    announcement: triggeredAnnouncement,
  });
}

function registryResult(input: unknown):
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCoreObjectRegistrySliceV2 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CorePendingTriggerValidationIssueV1[] }> {
  try {
    const result = validateModeNeutralCoreObjectRegistrySliceV2(input);
    if (result.ok) return result;
    return {
      ok: false,
      issues: [issue('INVALID_OBJECT_REGISTRY', '/registry', 'Object Registry V2 is invalid')],
    };
  } catch {
    return {
      ok: false,
      issues: [issue('INVALID_OBJECT_REGISTRY', '/registry', 'Object Registry V2 could not be inspected safely')],
    };
  }
}

export function validateModeNeutralCorePendingTriggerSliceV1(
  registryInput: unknown,
  input: unknown,
): CorePendingTriggerValidationResultV1 {
  const issues: CorePendingTriggerValidationIssueV1[] = [];
  const registry = registryResult(registryInput);
  if (!registry.ok) return Object.freeze({ ok: false, issues: registry.issues });

  const root = readRecord(input, '', ROOT_FIELDS, issues);
  if (root === null) return Object.freeze({ ok: false, issues: sortedIssues(issues) });
  if (root.kind !== PENDING_KIND) issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid pending trigger slice kind'));

  const idsInput = readArray(root.pendingObjectIds, '/pendingObjectIds', issues);
  const ids: CoreObjectId[] = [];
  const seenIds = new Set<string>();
  if (idsInput !== null) {
    idsInput.forEach((value, index) => {
      const at = `/pendingObjectIds/${index}`;
      if (!isCanonicalCoreObjectIdV2(value)) {
        issues.push(issue('INVALID_ID', at, 'Expected a canonical Core ObjectId V2'));
        return;
      }
      const parsed = parseCoreObjectIdV2(value);
      if (parsed?.kind !== 'triggered-ability') {
        issues.push(issue('PENDING_TRIGGER_KIND_MISMATCH', at, 'Pending object ID must be triggered-ability'));
        return;
      }
      if (seenIds.has(value)) issues.push(issue('DUPLICATE_VALUE', at, 'Pending object IDs must be unique'));
      seenIds.add(value);
      ids.push(value);
    });
  }

  const byObjectInput = isPlainRecord(root.byObject) ? root.byObject : null;
  if (byObjectInput === null) {
    issues.push(issue('INVALID_TYPE', '/byObject', 'Expected a plain object'));
  }
  const entries = new Map<string, unknown>();
  if (byObjectInput !== null) {
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(byObjectInput);
    } catch {
      keys = [];
      issues.push(issue('INVALID_TYPE', '/byObject', 'Record descriptors are not readable'));
    }
    for (const key of keys) {
      if (typeof key !== 'string') {
        issues.push(issue('UNKNOWN_FIELD', '/byObject/[symbol]', 'Symbol record keys are not allowed'));
        continue;
      }
      const at = pointer('/byObject', key);
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(byObjectInput, key);
      } catch {
        issues.push(issue('INVALID_TYPE', at, 'Record entry descriptor is not readable'));
        continue;
      }
      if (descriptor === undefined || descriptor.enumerable !== true
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        issues.push(issue('INVALID_TYPE', at, 'Record entries must be enumerable data properties'));
        continue;
      }
      entries.set(key, descriptor.value);
    }
  }
  const expectedSet = new Set<string>(ids);
  if (entries.size !== expectedSet.size || [...entries.keys()].some((key) => !expectedSet.has(key))
    || [...expectedSet].some((key) => !entries.has(key))) {
    issues.push(issue('PENDING_TRIGGER_SET_MISMATCH', '/byObject', 'byObject keys must equal pendingObjectIds'));
  }

  const canonicalByObject = new Map<string, CorePendingTriggeredAbilityV1>();
  for (const objectId of ids) {
    const at = pointer('/byObject', objectId);
    if (!entries.has(objectId)) continue;
    const record = validatePendingRecord(registry.value, objectId, entries.get(objectId), at, issues);
    if (record !== null) canonicalByObject.set(objectId, record);
  }

  if (issues.length > 0) return Object.freeze({ ok: false, issues: sortedIssues(issues) });
  const byObject = Object.create(null) as Record<CoreObjectId, CorePendingTriggeredAbilityV1>;
  for (const objectId of ids) byObject[objectId] = canonicalByObject.get(objectId) as CorePendingTriggeredAbilityV1;
  const value: ModeNeutralCorePendingTriggerSliceV1 = {
    kind: PENDING_KIND,
    pendingObjectIds: Object.freeze(ids.slice()),
    byObject: Object.freeze(byObject),
  };
  return Object.freeze({
    ok: true,
    value: deepFreeze(value),
  });
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

export const validateCorePendingTriggerSliceV1 = validateModeNeutralCorePendingTriggerSliceV1;
export type { CoreObjectId, CorePlayerId };
