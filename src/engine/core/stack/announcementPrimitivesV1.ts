import { isCoreBaseId, isCoreUnsafeRecordKey } from '../ids';
import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';

export type CoreStackChoiceKeyV1 = string;

export type CoreStackTargetRefV1 =
  | Readonly<{ kind: 'object'; objectId: CoreObjectId }>
  | Readonly<{ kind: 'player'; playerId: CorePlayerId }>;

export type CoreStackPrimitiveValidationCode =
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'UNKNOWN_FIELD'
  | 'UNSAFE_RECORD_KEY';

export interface CoreStackPrimitiveValidationIssue {
  readonly code: CoreStackPrimitiveValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreStackChoiceKeyValidationResult =
  | Readonly<{ ok: true; value: CoreStackChoiceKeyV1 }>
  | Readonly<{ ok: false; issues: readonly CoreStackPrimitiveValidationIssue[] }>;

export type CoreStackTargetRefValidationResult =
  | Readonly<{ ok: true; value: CoreStackTargetRefV1 }>
  | Readonly<{ ok: false; issues: readonly CoreStackPrimitiveValidationIssue[] }>;

export class CoreStackChoiceKeyCreationError extends Error {
  readonly issues: readonly CoreStackPrimitiveValidationIssue[];

  constructor(issues: readonly CoreStackPrimitiveValidationIssue[]) {
    super(`Invalid Core stack choice key (${issues.length} issue(s))`);
    this.name = 'CoreStackChoiceKeyCreationError';
    this.issues = issues;
  }
}

export class CoreStackTargetRefCreationError extends Error {
  readonly issues: readonly CoreStackPrimitiveValidationIssue[];

  constructor(issues: readonly CoreStackPrimitiveValidationIssue[]) {
    super(`Invalid Core stack target reference (${issues.length} issue(s))`);
    this.name = 'CoreStackTargetRefCreationError';
    this.issues = issues;
  }
}

const CHOICE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const TARGET_FIELDS = ['kind', 'objectId', 'playerId'] as const;
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

function sortedIssues(issues: readonly CoreStackPrimitiveValidationIssue[]): readonly CoreStackPrimitiveValidationIssue[] {
  return issues.slice().sort((left, right) =>
    codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
}

function issue(
  code: CoreStackPrimitiveValidationCode,
  path: string,
  message: string,
): CoreStackPrimitiveValidationIssue {
  return Object.freeze({ code, path, message });
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readTargetRecord(value: unknown): {
  readonly record: RawRecord | null;
  readonly issues: readonly CoreStackPrimitiveValidationIssue[];
} {
  if (!isPlainRecord(value)) {
    return { record: null, issues: [issue('INVALID_TYPE', '', 'Expected a plain object')] };
  }

  const issues: CoreStackPrimitiveValidationIssue[] = [];
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.push(issue('UNKNOWN_FIELD', pointer('', String(key)), 'Symbol fields are not allowed'));
      continue;
    }
    const fieldPath = pointer('', key);
    if (isCoreUnsafeRecordKey(key)) {
      issues.push(issue('UNSAFE_RECORD_KEY', fieldPath, `Unsafe record key: ${key}`));
      continue;
    }
    if (!TARGET_FIELDS.includes(key as (typeof TARGET_FIELDS)[number])) {
      issues.push(issue('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`));
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.push(issue('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed'));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(issue('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed'));
      continue;
    }
    result[key] = descriptor.value;
  }
  return { record: result, issues: sortedIssues(issues) };
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function validateCoreStackChoiceKeyV1(value: unknown): CoreStackChoiceKeyValidationResult {
  if (typeof value !== 'string') {
    return { ok: false, issues: [issue('INVALID_TYPE', '', 'Expected a stack choice key string')] };
  }
  if (!CHOICE_KEY_PATTERN.test(value)) {
    return { ok: false, issues: [issue('INVALID_LITERAL', '', 'Invalid stack choice key pattern')] };
  }
  if (isCoreUnsafeRecordKey(value)) {
    return { ok: false, issues: [issue('UNSAFE_RECORD_KEY', '', `Unsafe record key: ${value}`)] };
  }
  return { ok: true, value };
}

export function createCoreStackChoiceKeyV1(value: unknown): CoreStackChoiceKeyV1 {
  const validation = validateCoreStackChoiceKeyV1(value);
  if (!validation.ok) throw new CoreStackChoiceKeyCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackTargetRefV1(value: unknown): CoreStackTargetRefValidationResult {
  const read = readTargetRecord(value);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortedIssues(issues) };
  const target = read.record;
  if (!hasOwn(target, 'kind')) issues.push(issue('UNKNOWN_FIELD', '/kind', 'Missing field: kind'));
  if (typeof target.kind !== 'string') {
    issues.push(issue('INVALID_TYPE', '/kind', 'Expected a target kind'));
  } else if (target.kind !== 'object' && target.kind !== 'player') {
    issues.push(issue('INVALID_LITERAL', '/kind', 'Unknown target kind'));
  }

  if (target.kind === 'object') {
    if (!hasOwn(target, 'objectId')) issues.push(issue('UNKNOWN_FIELD', '/objectId', 'Missing field: objectId'));
    if (hasOwn(target, 'playerId')) issues.push(issue('UNKNOWN_FIELD', '/playerId', 'playerId is not valid for an object target'));
    if (hasOwn(target, 'objectId') && !isCanonicalCoreObjectIdV2(target.objectId)) {
      issues.push(issue('INVALID_ID', '/objectId', 'Invalid canonical Core object ID'));
    }
    if (issues.length === 0) {
      return { ok: true, value: Object.freeze({ kind: 'object', objectId: target.objectId as CoreObjectId }) };
    }
  } else if (target.kind === 'player') {
    if (!hasOwn(target, 'playerId')) issues.push(issue('UNKNOWN_FIELD', '/playerId', 'Missing field: playerId'));
    if (hasOwn(target, 'objectId')) issues.push(issue('UNKNOWN_FIELD', '/objectId', 'objectId is not valid for a player target'));
    if (hasOwn(target, 'playerId') && !isCoreBaseId(target.playerId)) {
      issues.push(issue('INVALID_ID', '/playerId', 'Invalid Core player ID'));
    }
    if (issues.length === 0) {
      return { ok: true, value: Object.freeze({ kind: 'player', playerId: target.playerId as CorePlayerId }) };
    }
  }
  return { ok: false, issues: sortedIssues(issues) };
}

export function createCoreStackTargetRefV1(value: unknown): CoreStackTargetRefV1 {
  const validation = validateCoreStackTargetRefV1(value);
  if (!validation.ok) throw new CoreStackTargetRefCreationError(validation.issues);
  return validation.value;
}
