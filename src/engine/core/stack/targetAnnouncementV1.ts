import {
  validateCoreStackChoiceKeyV1,
  validateCoreStackTargetRefV1,
} from './announcementPrimitivesV1';
import type {
  CoreStackChoiceKeyV1,
  CoreStackPrimitiveValidationIssue,
  CoreStackTargetRefV1,
} from './announcementPrimitivesV1';

export type CoreStackTargetSelectionV1 = Readonly<{
  selectionId: CoreStackChoiceKeyV1;
  groupKey: CoreStackChoiceKeyV1;
  target: CoreStackTargetRefV1;
}>;

export type CoreStackTargetSelectionValidationCode =
  | CoreStackPrimitiveValidationIssue['code']
  | 'INVALID_ARRAY'
  | 'DUPLICATE_TARGET_SELECTION_ID'
  | 'DUPLICATE_TARGET_IN_GROUP';

export type CoreStackTargetSelectionValidationIssue = Readonly<{
  code: CoreStackTargetSelectionValidationCode;
  path: string;
  message: string;
}>;

export type CoreStackTargetSelectionValidationResult =
  | Readonly<{ ok: true; value: CoreStackTargetSelectionV1 }>
  | Readonly<{ ok: false; issues: readonly CoreStackTargetSelectionValidationIssue[] }>;

export type CoreStackTargetSelectionsValidationResult =
  | Readonly<{ ok: true; value: readonly CoreStackTargetSelectionV1[] }>
  | Readonly<{ ok: false; issues: readonly CoreStackTargetSelectionValidationIssue[] }>;

export class CoreStackTargetSelectionCreationError extends Error {
  readonly issues: readonly CoreStackTargetSelectionValidationIssue[];

  constructor(issues: readonly CoreStackTargetSelectionValidationIssue[]) {
    super(`Invalid Core stack target selection (${issues.length} issue(s))`);
    this.name = 'CoreStackTargetSelectionCreationError';
    this.issues = issues;
  }
}

type RawRecord = Record<string, unknown>;
const SELECTION_FIELDS = ['selectionId', 'groupKey', 'target'] as const;

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

function issue(
  code: CoreStackTargetSelectionValidationCode,
  path: string,
  message: string,
): CoreStackTargetSelectionValidationIssue {
  return Object.freeze({ code, path, message });
}

function sortedIssues(
  issues: readonly CoreStackTargetSelectionValidationIssue[],
): readonly CoreStackTargetSelectionValidationIssue[] {
  return Object.freeze(issues.slice().sort((left, right) =>
    codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)));
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readSelectionRecord(value: unknown, path: string): {
  readonly record: RawRecord | null;
  readonly issues: readonly CoreStackTargetSelectionValidationIssue[];
} {
  if (!isPlainRecord(value)) {
    return { record: null, issues: [issue('INVALID_TYPE', path, 'Expected a plain object')] };
  }
  try {
    const issues: CoreStackTargetSelectionValidationIssue[] = [];
    const record: RawRecord = Object.create(null) as RawRecord;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        issues.push(issue('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed'));
        continue;
      }
      const fieldPath = pointer(path, key);
      if (!SELECTION_FIELDS.includes(key as (typeof SELECTION_FIELDS)[number])) {
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
      record[key] = descriptor.value;
    }
    return { record, issues };
  } catch {
    return { record: null, issues: [issue('INVALID_TYPE', path, 'Unable to inspect target selection')] };
  }
}

function prefixIssues(
  issues: readonly CoreStackPrimitiveValidationIssue[],
  path: string,
): CoreStackTargetSelectionValidationIssue[] {
  return issues.map((current) => issue(
    current.code,
    current.path === '' ? path : `${path}${current.path}`,
    current.message,
  ));
}

function targetKey(target: CoreStackTargetRefV1): string {
  return target.kind === 'object' ? `object:${target.objectId}` : `player:${target.playerId}`;
}

export function validateCoreStackTargetSelectionV1(
  value: unknown,
  path = '',
): CoreStackTargetSelectionValidationResult {
  try {
    const read = readSelectionRecord(value, path);
    const issues = [...read.issues];
    if (read.record === null) return { ok: false, issues: sortedIssues(issues) };
    const record = read.record;
    for (const field of SELECTION_FIELDS) {
      if (!hasOwn(record, field)) issues.push(issue('UNKNOWN_FIELD', pointer(path, field), `Missing field: ${field}`));
    }
    const selectionIdResult = validateCoreStackChoiceKeyV1(record.selectionId);
    if (!selectionIdResult.ok) issues.push(...prefixIssues(selectionIdResult.issues, pointer(path, 'selectionId')));
    const groupKeyResult = validateCoreStackChoiceKeyV1(record.groupKey);
    if (!groupKeyResult.ok) issues.push(...prefixIssues(groupKeyResult.issues, pointer(path, 'groupKey')));
    const targetResult = validateCoreStackTargetRefV1(record.target);
    if (!targetResult.ok) issues.push(...prefixIssues(targetResult.issues, pointer(path, 'target')));
    if (issues.length > 0 || !selectionIdResult.ok || !groupKeyResult.ok || !targetResult.ok) {
      return { ok: false, issues: sortedIssues(issues) };
    }
    return {
      ok: true,
      value: Object.freeze({
        selectionId: selectionIdResult.value,
        groupKey: groupKeyResult.value,
        target: targetResult.value,
      }),
    };
  } catch {
    return { ok: false, issues: [issue('INVALID_TYPE', path, 'Unable to validate target selection')] };
  }
}

export function createCoreStackTargetSelectionV1(value: unknown): CoreStackTargetSelectionV1 {
  const result = validateCoreStackTargetSelectionV1(value);
  if (!result.ok) throw new CoreStackTargetSelectionCreationError(result.issues);
  return result.value;
}

function readArray(value: unknown, path: string): {
  readonly values: readonly unknown[] | null;
  readonly issues: readonly CoreStackTargetSelectionValidationIssue[];
} {
  try {
    if (!Array.isArray(value)) return { values: null, issues: [issue('INVALID_ARRAY', path, 'Expected an array')] };
    const issues: CoreStackTargetSelectionValidationIssue[] = [];
    const values: unknown[] = [];
    const presentIndices = new Set<number>();
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
      return { values: null, issues: [issue('INVALID_ARRAY', pointer(path, 'length'), 'Array length must be a data property')] };
    }
    const arrayLength: unknown = lengthDescriptor.value;
    if (typeof arrayLength !== 'number' || !Number.isSafeInteger(arrayLength) || arrayLength < 0) {
      return { values: null, issues: [issue('INVALID_ARRAY', pointer(path, 'length'), 'Array length must be a nonnegative integer')] };
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)) {
        issues.push(issue('UNKNOWN_FIELD', pointer(path, typeof key === 'string' ? key : String(key)), 'Array extra fields are not allowed'));
        continue;
      }
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= arrayLength) {
        issues.push(issue('UNKNOWN_FIELD', pointer(path, key), 'Array index is out of bounds'));
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable) {
        issues.push(issue('UNKNOWN_FIELD', pointer(path, key), 'Array entries must be enumerable'));
      } else if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        issues.push(issue('INVALID_TYPE', pointer(path, key), 'Accessor array entries are not allowed'));
      } else {
        presentIndices.add(index);
        values[index] = descriptor.value;
      }
    }
    for (let index = 0; index < arrayLength; index += 1) {
      if (!presentIndices.has(index)) {
        issues.push(issue('INVALID_ARRAY', pointer(path, String(index)), 'Sparse arrays are not allowed'));
      }
    }
    return { values: issues.length === 0 ? values : null, issues };
  } catch {
    return { values: null, issues: [issue('INVALID_ARRAY', path, 'Unable to inspect target selection array')] };
  }
}

export function validateCoreStackTargetSelectionsV1(
  value: unknown,
  path = '',
): CoreStackTargetSelectionsValidationResult {
  try {
    const read = readArray(value, path);
    if (read.values === null) return { ok: false, issues: sortedIssues(read.issues) };
    const issues = [...read.issues];
    const selections: CoreStackTargetSelectionV1[] = [];
    const selectionIds = new Set<string>();
    const targetsByGroup = new Map<string, Set<string>>();
    for (let index = 0; index < read.values.length; index += 1) {
      const itemPath = pointer(path, String(index));
      const result = validateCoreStackTargetSelectionV1(read.values[index], itemPath);
      if (!result.ok) {
        issues.push(...result.issues);
        continue;
      }
      const selection = result.value;
      if (selectionIds.has(selection.selectionId)) {
        issues.push(issue('DUPLICATE_TARGET_SELECTION_ID', pointer(itemPath, 'selectionId'), 'Duplicate selectionId'));
      }
      selectionIds.add(selection.selectionId);
      const groupTargets = targetsByGroup.get(selection.groupKey) ?? new Set<string>();
      const key = targetKey(selection.target);
      if (groupTargets.has(key)) {
        issues.push(issue('DUPLICATE_TARGET_IN_GROUP', pointer(itemPath, 'target'), 'Target is duplicated within its group'));
      }
      groupTargets.add(key);
      targetsByGroup.set(selection.groupKey, groupTargets);
      selections.push(selection);
    }
    if (issues.length > 0) return { ok: false, issues: sortedIssues(issues) };
    return { ok: true, value: Object.freeze(selections.map((selection) => Object.freeze(selection))) };
  } catch {
    return { ok: false, issues: [issue('INVALID_ARRAY', path, 'Unable to validate target selection array')] };
  }
}

export function createCoreStackTargetSelectionsV1(value: unknown): readonly CoreStackTargetSelectionV1[] {
  const result = validateCoreStackTargetSelectionsV1(value);
  if (!result.ok) throw new CoreStackTargetSelectionCreationError(result.issues);
  return result.value;
}

export const validateCoreStackTargetAnnouncementV1 = validateCoreStackTargetSelectionsV1;
export const createCoreStackTargetAnnouncementV1 = createCoreStackTargetSelectionsV1;
