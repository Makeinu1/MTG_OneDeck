import { locateCoreObjectV1 } from '../identityZoneState';
import type { CoreObjectId } from '../ids';
import type { CoreZoneIdV1 } from '../identityZoneState';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../identityZoneState';
import { validateCoreAttachmentStateV1 } from './attachment';
import type {
  CoreAttachmentTargetV1,
  CoreAttachmentValidationCode,
  CoreAttachmentValidationIssue,
} from './attachment';
import { validateCoreCardOrientationStateV1 } from './cardOrientation';
import type {
  CoreCardOrientationValidationCode,
  CoreCardOrientationValidationIssue,
} from './cardOrientation';
import { validateCoreCounterDamageStateV1 } from './counterDamage';
import type {
  CoreCounterDamageValidationCode,
  CoreCounterDamageValidationIssue,
} from './counterDamage';
import type {
  CoreCardObjectRuntimeStateV1,
  ModeNeutralCoreCardRuntimeSliceV1,
} from './cardRuntimeState';

export type CoreCardRuntimeValidationCode =
  | CoreCardOrientationValidationCode
  | CoreCounterDamageValidationCode
  | CoreAttachmentValidationCode
  | 'OBJECT_SET_MISMATCH'
  | 'FACE_INDEX_OUT_OF_RANGE'
  | 'FACE_INDEX_NOT_ZERO_OUTSIDE_BATTLEFIELD_OR_STACK'
  | 'FACE_DOWN_NOT_ALLOWED_IN_ZONE'
  | 'TAPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
  | 'FLIPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
  | 'PHASED_OUT_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
  | 'MARKED_DAMAGE_NOT_ALLOWED_OUTSIDE_BATTLEFIELD'
  | 'ATTACHMENT_SOURCE_NOT_ON_BATTLEFIELD'
  | 'ATTACHMENT_TARGET_OBJECT_NOT_FOUND'
  | 'SELF_ATTACHMENT'
  | 'ATTACHMENT_TARGET_PLAYER_NOT_FOUND';

export interface CoreCardRuntimeValidationIssue {
  readonly code: CoreCardRuntimeValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreCardRuntimeValidationResult =
  | { readonly ok: true; readonly value: ModeNeutralCoreCardRuntimeSliceV1 }
  | { readonly ok: false; readonly issues: readonly CoreCardRuntimeValidationIssue[] };

export class CoreCardRuntimeCreationError extends Error {
  readonly issues: readonly CoreCardRuntimeValidationIssue[];

  constructor(issues: readonly CoreCardRuntimeValidationIssue[]) {
    super(`Invalid mode-neutral Core card runtime slice (${issues.length} issue(s))`);
    this.name = 'CoreCardRuntimeCreationError';
    this.issues = issues;
  }
}

const ROOT_KIND = 'mode-neutral-core-card-runtime-slice-v1';
const ROOT_FIELDS = ['kind', 'byObject'] as const;
const RUNTIME_FIELDS = ['orientation', 'counterDamage', 'attachment'] as const;

type RawRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
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

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataDescriptorValue(descriptor: PropertyDescriptor | undefined): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: CoreCardRuntimeValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreCardRuntimeValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreCardRuntimeValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function readObject(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object');
    return null;
  }

  const expected = new Set(fields);
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer(path, key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed');
      continue;
    }
    const data = dataDescriptorValue(descriptor);
    if (data === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = data.value;
  }

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function literalValue(value: unknown, expected: string, path: string, issues: IssueCollector): void {
  if (value !== expected) issues.add('INVALID_LITERAL', path, `Expected ${expected}`);
}

function readByObjectEntries(
  value: unknown,
  path: string,
  issues: IssueCollector,
): readonly (readonly [string, unknown])[] {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object');
    return [];
  }

  const entries: Array<readonly [string, unknown]> = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed');
      continue;
    }
    const entryPath = pointer(path, key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', entryPath, 'Non-enumerable object entries are not allowed');
      continue;
    }
    const data = dataDescriptorValue(descriptor);
    if (data === null) {
      issues.add('INVALID_TYPE', entryPath, 'Accessor object entries are not allowed');
      continue;
    }
    entries.push([key, data.value]);
  }
  return entries;
}

function appendNestedIssues(
  issues: IssueCollector,
  path: string,
  nestedIssues: readonly (
    | CoreCardOrientationValidationIssue
    | CoreCounterDamageValidationIssue
    | CoreAttachmentValidationIssue
  )[],
): void {
  for (const issue of nestedIssues) issues.add(issue.code, `${path}${issue.path}`, issue.message);
}

function readRuntimeState(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoreCardObjectRuntimeStateV1 | null {
  const root = readObject(value, path, RUNTIME_FIELDS, issues);
  if (root === null) return null;

  const orientation = validateCoreCardOrientationStateV1(root.orientation);
  const counterDamage = validateCoreCounterDamageStateV1(root.counterDamage);
  const attachment = validateCoreAttachmentStateV1(root.attachment);
  if (!orientation.ok) appendNestedIssues(issues, pointer(path, 'orientation'), orientation.issues);
  if (!counterDamage.ok) appendNestedIssues(issues, pointer(path, 'counterDamage'), counterDamage.issues);
  if (!attachment.ok) appendNestedIssues(issues, pointer(path, 'attachment'), attachment.issues);
  if (!orientation.ok || !counterDamage.ok || !attachment.ok) return null;

  return Object.freeze({
    orientation: orientation.value,
    counterDamage: counterDamage.value,
    attachment: attachment.value,
  });
}

function identityObjectIds(identityState: ModeNeutralCoreIdentityZoneSliceV1): readonly CoreObjectId[] {
  return Object.keys(identityState.cardObjects).sort(codeUnitCompare) as CoreObjectId[];
}

function locationZoneOf(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  objectId: CoreObjectId,
): CoreZoneIdV1 | null {
  return locateCoreObjectV1(identityState, objectId)?.zone ?? null;
}

function definitionFaceCountOf(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  objectId: CoreObjectId,
): number | null {
  const object = identityState.cardObjects[objectId];
  if (object === undefined) return null;
  const physicalCard = identityState.physicalCards[object.physicalCardId];
  if (physicalCard === undefined) return null;
  const definition = identityState.cardDefinitions[physicalCard.definitionId];
  if (definition === undefined) return null;
  return definition.faces.length;
}

function validateCrossState(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  objectId: CoreObjectId,
  value: CoreCardObjectRuntimeStateV1,
  objectIds: ReadonlySet<string>,
  playerIds: ReadonlySet<string>,
  issues: IssueCollector,
): void {
  const basePath = pointer('/byObject', objectId);
  const zone = locationZoneOf(identityState, objectId);
  if (zone === null) return;

  const faceIndexPath = pointer(`${basePath}/orientation`, 'faceIndex');
  const faceCount = definitionFaceCountOf(identityState, objectId);
  if (faceCount !== null && value.orientation.faceIndex >= faceCount) {
    issues.add('FACE_INDEX_OUT_OF_RANGE', faceIndexPath, 'faceIndex must be less than the definition face count');
  }
  if (zone !== 'battlefield' && zone !== 'stack' && value.orientation.faceIndex !== 0) {
    issues.add(
      'FACE_INDEX_NOT_ZERO_OUTSIDE_BATTLEFIELD_OR_STACK',
      faceIndexPath,
      'faceIndex must be zero outside battlefield and stack',
    );
  }
  if (value.orientation.faceDown && zone !== 'battlefield' && zone !== 'stack' && zone !== 'exile') {
    issues.add(
      'FACE_DOWN_NOT_ALLOWED_IN_ZONE',
      pointer(`${basePath}/orientation`, 'faceDown'),
      'faceDown is only allowed in battlefield, stack, and exile',
    );
  }
  if (zone !== 'battlefield') {
    if (value.orientation.tapped) {
      issues.add(
        'TAPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD',
        pointer(`${basePath}/orientation`, 'tapped'),
        'tapped must be false outside battlefield',
      );
    }
    if (value.orientation.flipped) {
      issues.add(
        'FLIPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD',
        pointer(`${basePath}/orientation`, 'flipped'),
        'flipped must be false outside battlefield',
      );
    }
    if (value.orientation.phasedOut) {
      issues.add(
        'PHASED_OUT_NOT_ALLOWED_OUTSIDE_BATTLEFIELD',
        pointer(`${basePath}/orientation`, 'phasedOut'),
        'phasedOut must be false outside battlefield',
      );
    }
    if (value.counterDamage.markedDamage !== 0) {
      issues.add(
        'MARKED_DAMAGE_NOT_ALLOWED_OUTSIDE_BATTLEFIELD',
        pointer(`${basePath}/counterDamage`, 'markedDamage'),
        'markedDamage must be zero outside battlefield',
      );
    }
  }

  const attachedTo = value.attachment.attachedTo;
  if (attachedTo === null) return;
  if (zone !== 'battlefield') {
    issues.add(
      'ATTACHMENT_SOURCE_NOT_ON_BATTLEFIELD',
      pointer(`${basePath}/attachment`, 'attachedTo'),
      'A card outside battlefield cannot have an attachment target',
    );
  }
  validateAttachmentTarget(attachedTo, objectId, objectIds, playerIds, basePath, issues);
}

function validateAttachmentTarget(
  target: CoreAttachmentTargetV1,
  sourceObjectId: CoreObjectId,
  objectIds: ReadonlySet<string>,
  playerIds: ReadonlySet<string>,
  basePath: string,
  issues: IssueCollector,
): void {
  if (target.kind === 'object') {
    const targetPath = pointer(`${basePath}/attachment/attachedTo`, 'objectId');
    if (!objectIds.has(target.objectId)) {
      issues.add('ATTACHMENT_TARGET_OBJECT_NOT_FOUND', targetPath, 'Attachment target object does not exist');
    }
    if (target.objectId === sourceObjectId) {
      issues.add('SELF_ATTACHMENT', targetPath, 'An object cannot attach to itself');
    }
    return;
  }

  if (!playerIds.has(target.playerId)) {
    issues.add(
      'ATTACHMENT_TARGET_PLAYER_NOT_FOUND',
      pointer(`${basePath}/attachment/attachedTo`, 'playerId'),
      'Attachment target player does not exist',
    );
  }
}

function canonicalRuntimeValue(
  states: ReadonlyMap<CoreObjectId, CoreCardObjectRuntimeStateV1>,
  objectIds: readonly CoreObjectId[],
): ModeNeutralCoreCardRuntimeSliceV1 {
  const byObject: Record<string, CoreCardObjectRuntimeStateV1> = Object.create(null) as Record<
    string,
    CoreCardObjectRuntimeStateV1
  >;
  for (const objectId of objectIds) {
    const state = states.get(objectId);
    if (state === undefined) throw new Error(`Missing validated runtime state for ${objectId}`);
    Object.defineProperty(byObject, objectId, {
      value: state,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  Object.freeze(byObject);
  return Object.freeze({ kind: ROOT_KIND, byObject });
}

export function validateModeNeutralCoreCardRuntimeSliceV1(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  input: unknown,
): CoreCardRuntimeValidationResult {
  const issues = new IssueCollector();
  const root = readObject(input, '', ROOT_FIELDS, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };
  literalValue(root.kind, ROOT_KIND, '/kind', issues);

  const objectIds = identityObjectIds(identityState);
  const objectIdSet = new Set<string>(objectIds);
  const entries = readByObjectEntries(root.byObject, '/byObject', issues);
  const values = new Map<string, unknown>(entries);
  for (const objectId of objectIds) {
    if (!values.has(objectId)) {
      issues.add('OBJECT_SET_MISMATCH', pointer('/byObject', objectId), 'Runtime state is missing an identity object');
    }
  }
  for (const [objectId] of entries) {
    if (!objectIdSet.has(objectId)) {
      issues.add('OBJECT_SET_MISMATCH', pointer('/byObject', objectId), 'Runtime state contains an extra object');
    }
  }

  const playerIds = new Set<string>(Object.keys(identityState.players));
  const states = new Map<CoreObjectId, CoreCardObjectRuntimeStateV1>();
  for (const objectId of objectIds) {
    if (!values.has(objectId)) continue;
    const rawValue = values.get(objectId);
    const path = pointer('/byObject', objectId);
    const state = readRuntimeState(rawValue, path, issues);
    if (state === null) continue;
    states.set(objectId, state);
    validateCrossState(identityState, objectId, state, objectIdSet, playerIds, issues);
  }

  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };
  return { ok: true, value: canonicalRuntimeValue(states, objectIds) };
}
