import type { CoreObjectId } from '../ids';

export type CorePermutationV1 = readonly number[];

export type CoreZoneOrderErrorCode =
  | 'INVALID_ZONE_ARRAY'
  | 'INVALID_OBJECT_ID'
  | 'INVALID_INDEX'
  | 'OBJECT_NOT_FOUND'
  | 'OBJECT_DUPLICATED'
  | 'OBJECT_ALREADY_PRESENT'
  | 'INVALID_PERMUTATION_LENGTH'
  | 'INVALID_PERMUTATION_VALUE'
  | 'DUPLICATE_PERMUTATION_VALUE';

export class CoreZoneOrderError extends Error {
  readonly code: CoreZoneOrderErrorCode;
  readonly issues: readonly CorePermutationValidationIssue[];

  constructor(
    code: CoreZoneOrderErrorCode,
    message: string,
    issues: readonly CorePermutationValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'CoreZoneOrderError';
    this.code = code;
    this.issues = Object.freeze(issues.slice());
  }
}

export interface CorePermutationValidationIssue {
  readonly code: CoreZoneOrderErrorCode;
  readonly path: string;
  readonly message: string;
}

export type CorePermutationValidationResult =
  | {
      readonly ok: true;
      readonly value: CorePermutationV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CorePermutationValidationIssue[];
    };

interface DataValue {
  readonly value: unknown;
}

function dataValue(descriptor: PropertyDescriptor | undefined): DataValue | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    return null;
  }
  return { value: descriptor.value };
}

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePathSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pathFor(base: string, segment: string): string {
  return `${base}/${escapePathSegment(segment)}`;
}

class IssueCollector {
  private readonly values: CorePermutationValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreZoneOrderErrorCode, path: string, message: string): void {
    const identity = `${path}\u0000${code}`;
    if (this.seen.has(identity)) return;
    this.seen.add(identity);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CorePermutationValidationIssue[] {
    return Object.freeze(
      this.values
        .slice()
        .sort((left, right) => codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)),
    );
  }
}

function isArrayIndexKey(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function readPermutationArray(
  input: unknown,
  issues: IssueCollector,
): readonly unknown[] {
  if (!Array.isArray(input)) {
    issues.add('INVALID_PERMUTATION_VALUE', '', 'Expected a dense array permutation');
    return [];
  }

  const lengthData = dataValue(Object.getOwnPropertyDescriptor(input, 'length'));
  if (
    lengthData === null ||
    typeof lengthData.value !== 'number' ||
    !Number.isSafeInteger(lengthData.value) ||
    lengthData.value < 0
  ) {
    issues.add('INVALID_PERMUTATION_VALUE', '/length', 'Expected an ordinary array length');
    return [];
  }
  const length = lengthData.value;

  for (const key of Reflect.ownKeys(input)) {
    if (key === 'length') continue;
    if (typeof key !== 'string') {
      issues.add(
        'INVALID_PERMUTATION_VALUE',
        pathFor('', String(key)),
        'Symbol array properties are not allowed',
      );
      continue;
    }
    if (!isArrayIndexKey(key, length)) {
      issues.add('INVALID_PERMUTATION_VALUE', pathFor('', key), `Unknown array property: ${key}`);
    }
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const itemPath = pathFor('', String(index));
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    const value = dataValue(descriptor);
    if (descriptor === undefined || !descriptor.enumerable || value === null) {
      issues.add(
        'INVALID_PERMUTATION_VALUE',
        itemPath,
        'Permutation elements must be enumerable data properties',
      );
      values.push(undefined);
      continue;
    }
    values.push(value.value);
  }
  return values;
}

function isValidExpectedLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validateCorePermutationV1(
  input: unknown,
  expectedLength: number,
): CorePermutationValidationResult {
  const issues = new IssueCollector();
  const expectedLengthIsValid = isValidExpectedLength(expectedLength);
  if (!expectedLengthIsValid) {
    issues.add(
      'INVALID_PERMUTATION_LENGTH',
      '/expectedLength',
      'Expected a non-negative safe integer length',
    );
  }

  const values = readPermutationArray(input, issues);
  const comparisonLength = expectedLengthIsValid ? expectedLength : values.length;
  if (expectedLengthIsValid && values.length !== expectedLength) {
    issues.add(
      'INVALID_PERMUTATION_LENGTH',
      '/length',
      `Expected permutation length ${expectedLength}, received ${values.length}`,
    );
  }

  const seen = new Set<number>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value >= comparisonLength
    ) {
      issues.add(
        'INVALID_PERMUTATION_VALUE',
        pathFor('', String(index)),
        `Expected a safe integer in the range 0..${Math.max(comparisonLength - 1, 0)}`,
      );
      continue;
    }
    if (seen.has(value)) {
      issues.add(
        'DUPLICATE_PERMUTATION_VALUE',
        pathFor('', String(index)),
        `Permutation value ${value} occurs more than once`,
      );
      continue;
    }
    seen.add(value);
  }

  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };

  const output = values.map((value) => value as number);
  return { ok: true, value: Object.freeze(output) };
}

function isCoreObjectId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function invalid(
  code: CoreZoneOrderErrorCode,
  message: string,
): CoreZoneOrderError {
  return new CoreZoneOrderError(code, message);
}

function readZoneArray(zone: unknown): readonly string[] {
  if (!Array.isArray(zone)) {
    throw invalid('INVALID_ZONE_ARRAY', 'Zone must be a dense array');
  }

  const lengthData = dataValue(Object.getOwnPropertyDescriptor(zone, 'length'));
  if (
    lengthData === null ||
    typeof lengthData.value !== 'number' ||
    !Number.isSafeInteger(lengthData.value) ||
    lengthData.value < 0
  ) {
    throw invalid('INVALID_ZONE_ARRAY', 'Zone must have an ordinary array length');
  }
  const length = lengthData.value;

  for (const key of Reflect.ownKeys(zone)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !isArrayIndexKey(key, length)) {
      throw invalid('INVALID_ZONE_ARRAY', 'Zone must not contain extra or symbol properties');
    }
  }

  const values: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(zone, String(index));
    const value = dataValue(descriptor);
    if (descriptor === undefined || !descriptor.enumerable || value === null || !isCoreObjectId(value.value)) {
      throw invalid('INVALID_ZONE_ARRAY', 'Zone must contain enumerable string object IDs');
    }
    values.push(value.value);
  }

  const seen = new Set<string>();
  for (const objectId of values) {
    if (seen.has(objectId)) {
      throw invalid('OBJECT_DUPLICATED', `Object ID ${objectId} occurs more than once in the zone`);
    }
    seen.add(objectId);
  }
  return values;
}

function requireObjectId(objectId: unknown): asserts objectId is string {
  if (!isCoreObjectId(objectId)) {
    throw invalid('INVALID_OBJECT_ID', 'Object ID must be a non-empty string');
  }
}

function requireIndex(index: unknown, maximum: number): asserts index is number {
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index > maximum) {
    throw invalid('INVALID_INDEX', `Index must be a safe integer from 0 through ${maximum}`);
  }
}

function permutationError(
  result: Extract<CorePermutationValidationResult, { readonly ok: false }>,
): CoreZoneOrderError {
  const first = result.issues[0];
  if (first === undefined) {
    return invalid('INVALID_PERMUTATION_VALUE', 'Permutation validation failed');
  }
  return new CoreZoneOrderError(first.code, first.message, result.issues);
}

export function removeCoreObjectIdExactlyOnceV1<T extends string>(
  zone: readonly T[],
  objectId: T,
): readonly T[] {
  const values = readZoneArray(zone);
  requireObjectId(objectId);
  const index = values.indexOf(objectId);
  if (index < 0) throw invalid('OBJECT_NOT_FOUND', `Object ID ${objectId} is not in the zone`);
  const output = values.slice() as T[];
  output.splice(index, 1);
  return Object.freeze(output);
}

export function insertCoreObjectIdAtV1<T extends string>(
  zone: readonly T[],
  objectId: T,
  index: number,
): readonly T[] {
  const values = readZoneArray(zone);
  requireObjectId(objectId);
  requireIndex(index, values.length);
  if (values.includes(objectId)) {
    throw invalid('OBJECT_ALREADY_PRESENT', `Object ID ${objectId} is already in the zone`);
  }
  const output = values.slice() as T[];
  output.splice(index, 0, objectId);
  return Object.freeze(output);
}

export function moveCoreObjectIdWithinZoneV1<T extends string>(
  zone: readonly T[],
  objectId: T,
  index: number,
): readonly T[] {
  const values = readZoneArray(zone);
  requireObjectId(objectId);
  const currentIndex = values.indexOf(objectId);
  if (currentIndex < 0) throw invalid('OBJECT_NOT_FOUND', `Object ID ${objectId} is not in the zone`);
  requireIndex(index, values.length - 1);
  const output = values.slice() as T[];
  output.splice(currentIndex, 1);
  output.splice(index, 0, objectId);
  return Object.freeze(output);
}

export function applyCorePermutationV1<T extends string>(
  zone: readonly T[],
  permutation: CorePermutationV1,
): readonly T[] {
  const values = readZoneArray(zone);
  const validation = validateCorePermutationV1(permutation, values.length);
  if (!validation.ok) throw permutationError(validation);
  const output = validation.value.map((sourceIndex) => values[sourceIndex] as T);
  return Object.freeze(output);
}

export type { CoreObjectId };
