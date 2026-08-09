import { isCoreBaseId, isCoreSafeIncarnation } from '../ids';
import type { CoreObjectId, CorePlayerId } from '../ids';

export type CoreAttachmentTargetV1 =
  | {
      readonly kind: 'object';
      readonly objectId: CoreObjectId;
    }
  | {
      readonly kind: 'player';
      readonly playerId: CorePlayerId;
    };

export interface CoreAttachmentStateV1 {
  readonly attachedTo: CoreAttachmentTargetV1 | null;
}

export type CoreAttachmentValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID';

export interface CoreAttachmentValidationIssue {
  readonly code: CoreAttachmentValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreAttachmentValidationResult =
  | {
      readonly ok: true;
      readonly value: CoreAttachmentStateV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreAttachmentValidationIssue[];
    };

export class CoreAttachmentCreationError extends Error {
  readonly issues: readonly CoreAttachmentValidationIssue[];

  constructor(issues: readonly CoreAttachmentValidationIssue[]) {
    super(`Invalid Core attachment state (${issues.length} issue(s))`);
    this.name = 'CoreAttachmentCreationError';
    this.issues = issues;
  }
}

const ROOT_FIELDS = ['attachedTo'] as const;
const TARGET_FIELDS = ['kind', 'objectId', 'playerId'] as const;
const DECIMAL_INCARNATION_PATTERN = /^(0|[1-9][0-9]*)$/;

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
  return { value: descriptor.value as unknown };
}

class IssueCollector {
  private readonly values: CoreAttachmentValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreAttachmentValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreAttachmentValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function readObject(
  value: unknown,
  path: string,
  allowedFields: readonly string[],
  requiredFields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object');
    return null;
  }

  const allowed = new Set(allowedFields);
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed');
      continue;
    }

    const fieldPath = pointer(path, key);
    if (!allowed.has(key)) {
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

  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isCanonicalIncarnationText(value: string): boolean {
  return DECIMAL_INCARNATION_PATTERN.test(value);
}

export function isCanonicalCoreObjectIdV1(value: unknown): value is CoreObjectId {
  if (typeof value !== 'string') return false;

  const separator = value.indexOf(':');
  if (separator <= 0 || separator !== value.lastIndexOf(':') || separator === value.length - 1) return false;

  const physicalCardId = value.slice(0, separator);
  const incarnationText = value.slice(separator + 1);
  if (!isCoreBaseId(physicalCardId) || !isCanonicalIncarnationText(incarnationText)) return false;

  const incarnation = Number(incarnationText);
  return isCoreSafeIncarnation(incarnation);
}

function validateObjectId(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoreObjectId | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core object ID string');
    return null;
  }
  if (!isCanonicalCoreObjectIdV1(value)) {
    issues.add('INVALID_ID', path, 'Invalid canonical Core object ID');
    return null;
  }
  return value;
}

function validatePlayerId(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CorePlayerId | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core player ID string');
    return null;
  }
  if (!isCoreBaseId(value)) {
    issues.add('INVALID_ID', path, 'Invalid Core player ID');
    return null;
  }
  return value as CorePlayerId;
}

function validateTarget(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoreAttachmentTargetV1 | null {
  const target = readObject(value, path, TARGET_FIELDS, ['kind'], issues);
  if (target === null || !hasOwn(target, 'kind')) return null;

  const kind = target.kind;
  if (typeof kind !== 'string') {
    issues.add('INVALID_TYPE', pointer(path, 'kind'), 'Expected an attachment target kind');
    return null;
  }

  if (kind === 'object') {
    if (hasOwn(target, 'playerId')) {
      issues.add('UNKNOWN_FIELD', pointer(path, 'playerId'), 'playerId is not valid for an object target');
    }
    if (!hasOwn(target, 'objectId')) {
      issues.add('MISSING_FIELD', pointer(path, 'objectId'), 'Missing field: objectId');
      return null;
    }
    const objectId = validateObjectId(target.objectId, pointer(path, 'objectId'), issues);
    if (objectId === null) return null;
    return Object.freeze({ kind: 'object' as const, objectId });
  }

  if (kind === 'player') {
    if (hasOwn(target, 'objectId')) {
      issues.add('UNKNOWN_FIELD', pointer(path, 'objectId'), 'objectId is not valid for a player target');
    }
    if (!hasOwn(target, 'playerId')) {
      issues.add('MISSING_FIELD', pointer(path, 'playerId'), 'Missing field: playerId');
      return null;
    }
    const playerId = validatePlayerId(target.playerId, pointer(path, 'playerId'), issues);
    if (playerId === null) return null;
    return Object.freeze({ kind: 'player' as const, playerId });
  }

  issues.add('INVALID_LITERAL', pointer(path, 'kind'), 'Unknown attachment target kind');
  return null;
}

export function validateCoreAttachmentStateV1(value: unknown): CoreAttachmentValidationResult {
  const issues = new IssueCollector();
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return { ok: false, issues: issues.sorted() };
  }

  const root = readObject(value, '', ROOT_FIELDS, ROOT_FIELDS, issues);
  if (root === null || !hasOwn(root, 'attachedTo')) {
    return { ok: false, issues: issues.sorted() };
  }

  const target = root.attachedTo === null
    ? null
    : validateTarget(root.attachedTo, '/attachedTo', issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };

  const validated: CoreAttachmentStateV1 = { attachedTo: target };
  return { ok: true, value: Object.freeze(validated) };
}

export function createCoreAttachmentStateV1(input: unknown): CoreAttachmentStateV1 {
  const validation = validateCoreAttachmentStateV1(input);
  if (!validation.ok) throw new CoreAttachmentCreationError(validation.issues);
  return validation.value;
}
