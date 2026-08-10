import type { CoreObjectId } from '../../ids';
import { isCanonicalCoreObjectIdV2, parseCoreObjectIdV2 } from '../../object/objectIdV2';
import {
  validateCoreGameObjectIdentityV2,
} from '../../object/tokenObjectV2';
import type {
  CoreActivatedAbilityObjectIdentityV2,
  CoreGameObjectIdentityV2,
  CoreSpellCopyObjectIdentityV2,
  CoreTriggeredAbilityObjectIdentityV2,
} from '../../object/tokenObjectV2';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryStateV2';
import type {
  CoreStackAnnouncementRecordV1,
} from '../stackAnnouncementRecordV1';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementSliceV1';
import type { CoreStackTransactionBundleV1 } from './stackTransactionBundleV1';
import { validateCoreStackTransactionBundleV1 } from './stackTransactionValidationV1';
import {
  deepFreezeStackTransactionV1,
  rebuildArrayWithAppendedValueV1,
  rebuildRecordWithKeyV1,
  sortTransactionIssues,
  type StackTransactionNestedIssueV1,
} from './internalStackTransactionV1';
import { CoreStackTransactionErrorV1 } from './stackTransactionErrorV1';

export type CoreSyntheticStackObjectIdentityV1 =
  | CoreSpellCopyObjectIdentityV2
  | CoreActivatedAbilityObjectIdentityV2
  | CoreTriggeredAbilityObjectIdentityV2;

export type CoreSyntheticStackCommitInputV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly object: CoreSyntheticStackObjectIdentityV1;
  readonly announcement:
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: 'spell-copy' }>
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: 'activated-ability' }>
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: 'triggered-ability' }>;
}>;

export type CoreSyntheticStackCommitResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly committedObjectId: CoreObjectId;
}>;

type RawRecord = Record<string, unknown>;

const OPERATION_FIELDS = ['objectId', 'object', 'announcement'] as const;
const ANNOUNCEMENT_FIELDS = [
  'kind',
  'abilityTextSnapshot',
  'chosenModeKeys',
  'targetSelections',
  'announcedVariables',
  'distributions',
  'costChoices',
] as const;
const SYNTHETIC_KINDS = new Set(['spell-copy', 'activated-ability', 'triggered-ability']);

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function issue(
  code: string,
  path: string,
  message: string,
): StackTransactionNestedIssueV1 {
  return { code, path, message };
}

function sortedIssues(
  issues: readonly StackTransactionNestedIssueV1[],
): readonly StackTransactionNestedIssueV1[] {
  return sortTransactionIssues(issues).slice().sort((left, right) =>
    codeUnitCompare(left.path, right.path)
    || codeUnitCompare(left.code, right.code)
    || codeUnitCompare(left.message, right.message));
}

function plainRecord(value: unknown): value is RawRecord {
  try {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function readExactRecord(
  value: unknown,
  fields: readonly string[],
  path: string,
): Readonly<{
  readonly ok: true;
  readonly value: RawRecord;
}> | Readonly<{
  readonly ok: false;
  readonly issues: readonly StackTransactionNestedIssueV1[];
}> {
  if (!plainRecord(value)) {
    return { ok: false, issues: [issue('INVALID_TYPE', path, 'Expected a plain object')] };
  }

  const found: RawRecord = Object.create(null) as RawRecord;
  const issues: StackTransactionNestedIssueV1[] = [];
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return { ok: false, issues: [issue('INVALID_TYPE', path, 'Object descriptors are not readable')] };
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(issue('UNKNOWN_FIELD', `${path}/[symbol]`, 'Symbol fields are not allowed'));
      continue;
    }
    const fieldPath = `${path}/${key}`;
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
    found[key] = descriptor.value;
  }

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(found, field)) {
      issues.push(issue('MISSING_FIELD', `${path}/${field}`, `Missing field: ${field}`));
    }
  }
  if (issues.length > 0) return { ok: false, issues: sortedIssues(issues) };
  return { ok: true, value: found };
}

function operationFailure(
  code: 'INVALID_OPERATION_INPUT'
    | 'OBJECT_ALREADY_EXISTS'
    | 'OBJECT_KIND_MISMATCH'
    | 'ANNOUNCEMENT_KIND_MISMATCH'
    | 'CANDIDATE_INVALID',
  message: string,
  nested: readonly StackTransactionNestedIssueV1[] = [],
): never {
  const issueValue = {
    code,
    path: '',
    message,
    ...(nested.length > 0 ? { nested: sortedIssues(nested) } : {}),
  };
  throw new CoreStackTransactionErrorV1(code, [issueValue]);
}

function transactionFailure(
  code: 'INVALID_TRANSACTION_BUNDLE',
  nested: readonly StackTransactionNestedIssueV1[],
): never {
  throw new CoreStackTransactionErrorV1(code, [{
    code,
    path: '',
    message: 'Transaction bundle input is invalid',
    nested: sortedIssues(nested),
  }]);
}

function identityIssues(
  issues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): readonly StackTransactionNestedIssueV1[] {
  return issues.map((current) => issue(
    current.code,
    current.path === '$'
      ? '/object'
      : `/object${current.path.slice(1).replaceAll('.', '/')}`,
    current.message,
  ));
}

function announcementIssues(
  issues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): readonly StackTransactionNestedIssueV1[] {
  return issues.map((current) => issue(
    current.code,
    current.path === '' ? '/announcement' : `/announcement${current.path}`,
    current.message,
  ));
}

function hasObjectInAnyZone(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
): boolean {
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    if (zones.library.includes(objectId) || zones.hand.includes(objectId) || zones.graveyard.includes(objectId)) {
      return true;
    }
  }
  return (
    registry.zones.shared.battlefield.includes(objectId)
    || registry.zones.shared.stack.includes(objectId)
    || registry.zones.shared.exile.includes(objectId)
    || registry.zones.shared.command.includes(objectId)
  );
}

function registryWithSynthetic(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
  object: CoreSyntheticStackObjectIdentityV1,
): ModeNeutralCoreObjectRegistrySliceV2 {
  return {
    ...registry,
    objects: rebuildRecordWithKeyV1(registry.objects, objectId, object),
    zones: {
      byPlayer: registry.zones.byPlayer,
      shared: {
        ...registry.zones.shared,
        stack: rebuildArrayWithAppendedValueV1(registry.zones.shared.stack, objectId),
      },
    },
  };
}

function announcementsWithSynthetic(
  announcements: ModeNeutralCoreStackAnnouncementSliceV1,
  objectId: CoreObjectId,
  record: CoreStackAnnouncementRecordV1,
): ModeNeutralCoreStackAnnouncementSliceV1 {
  return {
    ...announcements,
    byObject: rebuildRecordWithKeyV1(announcements.byObject, objectId, record),
  };
}

function isSyntheticIdentity(
  object: CoreGameObjectIdentityV2,
): object is CoreSyntheticStackObjectIdentityV1 {
  return SYNTHETIC_KINDS.has(object.kind);
}

function commitSynthetic(
  bundleInput: unknown,
  input: unknown,
): CoreSyntheticStackCommitResultV1 {
  const bundleResult = validateCoreStackTransactionBundleV1(bundleInput);
  if (!bundleResult.ok) {
    transactionFailure('INVALID_TRANSACTION_BUNDLE', bundleResult.issues.flatMap((current) => current.nested ?? []));
  }
  const bundle = bundleResult.value;

  const operation = readExactRecord(input, OPERATION_FIELDS, '');
  if (!operation.ok) operationFailure('INVALID_OPERATION_INPUT', 'Operation input is invalid', operation.issues);
  const objectId = operation.value.objectId;
  const objectInput = operation.value.object;
  const announcementInput = operation.value.announcement;

  if (!isCanonicalCoreObjectIdV2(objectId)) {
    operationFailure('INVALID_OPERATION_INPUT', 'Object ID is not canonical', [
      issue('INVALID_ID', '/objectId', 'Object ID must be a canonical Core object ID V2'),
    ]);
  }
  const parsedObjectId = parseCoreObjectIdV2(objectId);
  if (parsedObjectId === null) {
    operationFailure('INVALID_OPERATION_INPUT', 'Object ID is not canonical', [
      issue('INVALID_ID', '/objectId', 'Object ID must be a canonical Core object ID V2'),
    ]);
  }

  const identityResult = validateCoreGameObjectIdentityV2(objectInput);
  if (!identityResult.ok) {
    operationFailure('INVALID_OPERATION_INPUT', 'Synthetic object identity is invalid', identityIssues(identityResult.issues));
  }
  const identity = identityResult.value;
  if (!isSyntheticIdentity(identity)) {
    operationFailure('INVALID_OPERATION_INPUT', 'Object identity is not a synthetic stack identity', [
      issue('INVALID_LITERAL', '/object/kind', 'Only spell-copy, activated-ability, and triggered-ability are allowed'),
    ]);
  }
  if (parsedObjectId.kind !== identity.kind) {
    operationFailure('OBJECT_KIND_MISMATCH', 'Object ID family does not match object identity kind', [
      issue('OBJECT_KIND_MISMATCH', '/objectId', 'Object ID family must match object identity kind'),
    ]);
  }

  const announcementRecord = readExactRecord(
    announcementInput,
    ANNOUNCEMENT_FIELDS,
    '/announcement',
  );
  if (!announcementRecord.ok) {
    operationFailure('INVALID_OPERATION_INPUT', 'Stack announcement input is invalid', announcementRecord.issues);
  }
  const announcementKind = announcementRecord.value.kind;
  if (typeof announcementKind !== 'string' || !SYNTHETIC_KINDS.has(announcementKind)) {
    operationFailure('INVALID_OPERATION_INPUT', 'Stack announcement kind is invalid', [
      issue('INVALID_LITERAL', '/announcement/kind', 'Invalid synthetic stack announcement kind'),
    ]);
  }
  if (announcementKind !== identity.kind) {
    operationFailure('ANNOUNCEMENT_KIND_MISMATCH', 'Announcement kind does not match object identity kind', [
      issue('ANNOUNCEMENT_KIND_MISMATCH', '/announcement/kind', 'Announcement kind must match object identity kind'),
    ]);
  }

  if (Object.prototype.hasOwnProperty.call(bundle.objectRegistry.objects, objectId)
    || hasObjectInAnyZone(bundle.objectRegistry, objectId)) {
    operationFailure('OBJECT_ALREADY_EXISTS', 'Synthetic object ID already exists', [
      issue('OBJECT_ALREADY_EXISTS', '/objectId', 'Object ID must be absent from the registry and every zone'),
    ]);
  }
  if (!Object.prototype.hasOwnProperty.call(bundle.objectRegistry.players, identity.controllerPlayerId)) {
    operationFailure('INVALID_OPERATION_INPUT', 'Synthetic object controller is not seated', [
      issue('SOURCE_NOT_FOUND', '/object/controllerPlayerId', 'Controller player must be present in the registry players'),
    ]);
  }
  if (identity.kind === 'spell-copy'
    && !Object.prototype.hasOwnProperty.call(bundle.objectRegistry.cardDefinitions, identity.definitionId)) {
    operationFailure('INVALID_OPERATION_INPUT', 'Spell-copy definition is not registered', [
      issue('SOURCE_NOT_FOUND', '/object/definitionId', 'Spell-copy definition must exist in cardDefinitions'),
    ]);
  }

  const candidateRegistry = registryWithSynthetic(bundle.objectRegistry, objectId, identity);
  const candidateAnnouncements = announcementsWithSynthetic(
    bundle.stackAnnouncements,
    objectId,
    announcementRecord.value as CoreStackAnnouncementRecordV1,
  );
  let announcementValidation: ReturnType<typeof validateModeNeutralCoreStackAnnouncementSliceV1>;
  try {
    announcementValidation = validateModeNeutralCoreStackAnnouncementSliceV1(
      candidateRegistry,
      candidateAnnouncements,
    );
  } catch {
    operationFailure('INVALID_OPERATION_INPUT', 'Stack announcement input could not be inspected safely', [
      issue('INVALID_TYPE', '/announcement', 'Stack announcement descriptors are not readable'),
    ]);
  }
  if (!announcementValidation.ok) {
    operationFailure(
      'INVALID_OPERATION_INPUT',
      'Stack announcement input is invalid',
      announcementIssues(announcementValidation.issues),
    );
  }

  const canonicalAnnouncement = announcementValidation.value.byObject[objectId];
  const finalAnnouncements = announcementsWithSynthetic(
    bundle.stackAnnouncements,
    objectId,
    canonicalAnnouncement,
  );
  const finalResult = validateCoreStackTransactionBundleV1({
    objectRegistry: candidateRegistry,
    objectRuntime: bundle.objectRuntime,
    stackAnnouncements: finalAnnouncements,
  });
  if (!finalResult.ok) {
    operationFailure(
      'CANDIDATE_INVALID',
      'Synthetic stack commit candidate is invalid',
      finalResult.issues.flatMap((current) => current.nested ?? []),
    );
  }
  return deepFreezeStackTransactionV1({
    bundle: finalResult.value,
    committedObjectId: objectId,
  });
}

export function commitCoreSyntheticStackObjectV1(
  bundle: CoreStackTransactionBundleV1,
  input: CoreSyntheticStackCommitInputV1,
): CoreSyntheticStackCommitResultV1 {
  try {
    return commitSynthetic(bundle, input);
  } catch (error: unknown) {
    if (error instanceof CoreStackTransactionErrorV1) throw error;
    throw new CoreStackTransactionErrorV1('INVALID_OPERATION_INPUT', [{
      code: 'INVALID_OPERATION_INPUT',
      path: '',
      message: 'Synthetic stack commit input could not be inspected safely',
      nested: [{ code: 'INVALID_TYPE', path: '', message: 'Input descriptors are not readable' }],
    }]);
  }
}
